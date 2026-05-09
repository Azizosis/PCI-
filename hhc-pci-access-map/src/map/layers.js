/**
 * layers.js — add all map layers and the deck.gl overlay
 *
 * `addAllLayers(map, geojson, hospitals)` is called once inside `map.on('load')`.
 * It returns a `{ deckOverlay, arcData }` object for use by the arc-toggle logic.
 *
 * Layer ordering: haras-fill → haras-outline → haras-3d → hosp-pts
 */

import { ZONE_FILL_EXPR, HARAS_FILL_OPACITY, HARAS_LINE_WIDTH } from './styles.js';
import { polyCentroid } from '../utils/geo.js';

/**
 * @param {maplibregl.Map} map
 * @param {GeoJSON.FeatureCollection} geojson
 * @param {Array<{ name: string, lat: number, lng: number }>} hospitals
 * @returns {{ deckOverlay: deck.MapboxOverlay, arcData: any[] }}
 */
export function addAllLayers(map, geojson, hospitals) {
  // ── Haras neighborhood boundaries ──────────────────────────────────────────
  map.addSource('haras', { type: 'geojson', data: geojson, generateId: true });

  map.addLayer({
    id: 'haras-fill',
    type: 'fill',
    source: 'haras',
    paint: {
      'fill-color':   ZONE_FILL_EXPR,
      'fill-opacity': HARAS_FILL_OPACITY,
    },
  });

  map.addLayer({
    id: 'haras-outline',
    type: 'line',
    source: 'haras',
    paint: {
      'line-color':   ZONE_FILL_EXPR,
      'line-width':   HARAS_LINE_WIDTH,
      'line-opacity': 0.5,
    },
  });

  // ── 3D population towers (Zone X only) ─────────────────────────────────────
  // Height = pop^0.6 × 45, hard-capped at 30 km.
  // "These are the people the system isn't reaching."
  map.addLayer({
    id: 'haras-3d',
    type: 'fill-extrusion',
    source: 'haras',
    layout: { visibility: 'none' },
    filter: ['==', ['get', 'Zone'], 'Zone X'],
    paint: {
      'fill-extrusion-color':             '#e03e3e',
      'fill-extrusion-height':            ['min', 30000, ['*', 45, ['^', ['get', 'POPULATION'], 0.6]]],
      'fill-extrusion-base':              0,
      'fill-extrusion-opacity':           0.85,
      'fill-extrusion-vertical-gradient': true,
    },
  });

  // ── PCI hospital points ─────────────────────────────────────────────────────
  const hospFeatures = hospitals.map((h) => ({
    type: 'Feature',
    properties: { name: h.name },
    geometry:   { type: 'Point', coordinates: [h.lng, h.lat] },
  }));

  map.addSource('hospitals', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: hospFeatures },
  });

  map.addLayer({
    id: 'hosp-pts',
    type: 'circle',
    source: 'hospitals',
    paint: {
      'circle-radius':       6,
      'circle-color':        '#0077ff',
      'circle-opacity':      0.95,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#001f5c',
    },
  });

  // ── deck.gl arc overlay (Zone X → nearest PCI hospital) ────────────────────
  const hospByName = Object.fromEntries(hospitals.map((h) => [h.name, [h.lng, h.lat]]));
  const arcData = [];

  for (const f of geojson.features) {
    if (f.properties.Zone !== 'Zone X') continue;
    const hc = hospByName[f.properties.Nearest_Hospital];
    if (!hc) continue;
    const c = polyCentroid(f.geometry);
    if (!c) continue;
    arcData.push({ from: c, to: hc, pop: f.properties.POPULATION || 0 });
  }

  // Update arc count badge
  const arcCountEl = document.getElementById('arc-count');
  if (arcCountEl) arcCountEl.textContent = arcData.length.toLocaleString();

  const deckOverlay = new deck.MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(deckOverlay);

  return { deckOverlay, arcData };
}

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

/**
 * Toggle a named map layer group on/off.
 *
 * @param {maplibregl.Map} map
 * @param {string} id  — 'haras' | 'hospitals' | 'towers' | 'arcs'
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
    if (map.getLayer('haras-3d')) map.setLayoutProperty('haras-3d', 'visibility', vis);
    if (visible) {
      map.easeTo({ pitch: 55, bearing: -15, duration: 1200 });
    } else if (map.getPitch() > 5) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    }
  }

  if (id === 'arcs' && deckOverlay) {
    renderArcs(deckOverlay, arcData, layerState.arcs);
  }
}
