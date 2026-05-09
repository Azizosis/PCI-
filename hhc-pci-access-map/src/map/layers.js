/**
 * layers.js — add all map layers and the deck.gl overlay
 *
 * Layer ordering (preserved from original):
 *   haras-fill → haras-outline → haras-3d (lazy) → hosp-pts
 *
 * Each named function adds exactly one layer group and returns nothing;
 * side-effects are on the map only.
 *
 * addUnreachableExtrusionLayer() is NOT called at load time.  The 3D
 * extrusion layer is created lazily via ensureExtrusionLayer() the first
 * time the towers toggle is switched on, keeping GPU memory free until
 * the user explicitly requests 3D.
 */

import { ZONE_FILL_EXPR, HARAS_FILL_OPACITY, HARAS_LINE_WIDTH } from './styles.js';
import { polyCentroid } from '../utils/geo.js';

/** Read a CSS custom property from :root as a trimmed string. */
function tok(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Per-layer add functions ───────────────────────────────────────────────────

/**
 * Add the haras fill layer.
 * Must be called after the 'haras' source is already registered.
 *
 * @param {maplibregl.Map} map
 */
export function addHarasFillLayer(map) {
  map.addLayer({
    id:     'haras-fill',
    type:   'fill',
    source: 'haras',
    paint: {
      'fill-color':   ZONE_FILL_EXPR,
      'fill-opacity': HARAS_FILL_OPACITY,
    },
  });
}

/**
 * Add the haras outline layer.
 * Must be called after addHarasFillLayer() to respect stacking order.
 *
 * @param {maplibregl.Map} map
 */
export function addHarasOutlineLayer(map) {
  map.addLayer({
    id:     'haras-outline',
    type:   'line',
    source: 'haras',
    paint: {
      'line-color':   ZONE_FILL_EXPR,
      'line-width':   HARAS_LINE_WIDTH,
      'line-opacity': 0.5,
    },
  });
}

/**
 * Add the 3D population extrusion layer (Zone X haras only).
 *
 * Height formula: min(30 km, 45 × pop^0.6)
 * "These are the people the system isn't reaching."
 *
 * This function is deliberately NOT called by addAllLayers() at load time.
 * It is only invoked by ensureExtrusionLayer() when the user first toggles
 * the towers layer on.  This keeps the fill-extrusion geometry out of GPU
 * memory until explicitly requested.
 *
 * @param {maplibregl.Map} map
 */
export function addUnreachableExtrusionLayer(map) {
  map.addLayer(
    {
      id:     'haras-3d',
      type:   'fill-extrusion',
      source: 'haras',
      layout: { visibility: 'visible' },
      filter: ['==', ['get', 'Zone'], 'Zone X'],
      paint: {
        'fill-extrusion-color':             tok('--zx'),
        'fill-extrusion-height':            ['min', 30000, ['*', 45, ['^', ['get', 'POPULATION'], 0.6]]],
        'fill-extrusion-base':              0,
        'fill-extrusion-opacity':           0.85,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // Insert before hosp-pts so hospitals render on top of extrusions
    'hosp-pts',
  );
}

/**
 * Add the PCI hospital circle layer.
 * Must be called last to sit on top of all haras layers.
 *
 * @param {maplibregl.Map} map
 * @param {Array<{ name: string, lat: number, lng: number }>} hospitals
 */
export function addHospitalLayer(map, hospitals) {
  const features = hospitals.map((h) => ({
    type:       'Feature',
    properties: { name: h.name },
    geometry:   { type: 'Point', coordinates: [h.lng, h.lat] },
  }));

  map.addSource('hospitals', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
    id:     'hosp-pts',
    type:   'circle',
    source: 'hospitals',
    paint: {
      'circle-radius':       6,
      'circle-color':        tok('--hosp'),
      'circle-opacity':      0.95,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': tok('--hosp-stroke'),
    },
  });
}

// ── Lazy extrusion guard ──────────────────────────────────────────────────────

let _extrusionAdded = false;

/**
 * Ensure the extrusion layer exists, creating it lazily if not yet added.
 * Safe to call multiple times — only adds the layer once.
 *
 * @param {maplibregl.Map} map
 */
export function ensureExtrusionLayer(map) {
  if (_extrusionAdded || map.getLayer('haras-3d')) {
    _extrusionAdded = true;
    return;
  }
  addUnreachableExtrusionLayer(map);
  _extrusionAdded = true;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Add all initial map layers in the correct stacking order.
 * The extrusion layer is NOT added here — it is created on first use.
 *
 * Returns the arc data array; the arc-count DOM update is intentionally left
 * to main.js so this module remains free of DOM dependencies.
 *
 * @param {maplibregl.Map} map
 * @param {GeoJSON.FeatureCollection} geojson
 * @param {Array<{ name: string, lat: number, lng: number }>} hospitals
 * @returns {{ deckOverlay: deck.MapboxOverlay, arcData: any[] }}
 */
export function addAllLayers(map, geojson, hospitals) {
  // 1. Register haras source
  map.addSource('haras', { type: 'geojson', data: geojson, generateId: true });

  // 2. Haras layers — fill before outline before hospital points
  addHarasFillLayer(map);
  addHarasOutlineLayer(map);
  // NOTE: haras-3d is NOT added here; see ensureExtrusionLayer()

  // 3. Hospital points on top
  addHospitalLayer(map, hospitals);

  // 4. deck.gl arc overlay (Zone X → nearest PCI hospital)
  const hospByName = Object.fromEntries(hospitals.map((h) => [h.name, [h.lng, h.lat]]));
  const arcData    = [];

  for (const f of geojson.features) {
    if (f.properties.Zone !== 'Zone X') continue;
    const hc = hospByName[f.properties.Nearest_Hospital];
    if (!hc) continue;
    const c = polyCentroid(f.geometry);
    if (!c) continue;
    arcData.push({ from: c, to: hc, pop: f.properties.POPULATION || 0 });
  }

  const deckOverlay = new deck.MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(deckOverlay);

  return { deckOverlay, arcData };
}

// ── Arc rendering ─────────────────────────────────────────────────────────────

/**
 * (Re)render the arc layer based on current visibility state.
 *
 * @param {deck.MapboxOverlay} deckOverlay
 * @param {any[]} arcData
 * @param {boolean} visible
 */
export function renderArcs(deckOverlay, arcData, visible) {
  deckOverlay.setProps({
    layers: [
      new deck.ArcLayer({
        id:                'access-arcs',
        data:              arcData,
        visible,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor:    [224, 62, 62, 210],
        getTargetColor:    [0, 170, 255, 230],
        getWidth:          (d) => Math.max(0.6, Math.log10((d.pop || 1) + 10) * 0.7),
        getHeight:         0.45,
        greatCircle:       false,
        pickable:          false,
      }),
    ],
  });
}

// ── Layer visibility ──────────────────────────────────────────────────────────

/**
 * Toggle a named layer group on/off.
 * For 'towers', the extrusion layer is created lazily on first enable.
 *
 * @param {maplibregl.Map} map
 * @param {'haras'|'hospitals'|'towers'|'arcs'} id
 * @param {boolean} visible
 * @param {deck.MapboxOverlay} deckOverlay
 * @param {any[]} arcData
 * @param {{ arcs: boolean }} layerState
 */
export function setLayerVisibility(map, id, visible, deckOverlay, arcData, layerState) {
  const vis = visible ? 'visible' : 'none';

  if (id === 'haras') {
    ['haras-fill', 'haras-outline'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', vis);
    });
  }

  if (id === 'hospitals') {
    if (map.getLayer('hosp-pts')) map.setLayoutProperty('hosp-pts', 'visibility', vis);
  }

  if (id === 'towers') {
    if (visible) {
      // Create the layer lazily the first time it is requested
      ensureExtrusionLayer(map);
      map.setLayoutProperty('haras-3d', 'visibility', 'visible');
      map.easeTo({ pitch: 55, bearing: -15, duration: 1200 });
    } else {
      if (map.getLayer('haras-3d')) map.setLayoutProperty('haras-3d', 'visibility', 'none');
      if (map.getPitch() > 5) map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    }
  }

  if (id === 'arcs' && deckOverlay) {
    renderArcs(deckOverlay, arcData, layerState.arcs);
  }
}
