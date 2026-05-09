/**
 * state.js — global application state and mode-transition logic
 *
 * This module owns the single source of truth for:
 *   - current view mode  ('zone' | 'catchment' | 'priority' | 'placement')
 *   - selected region / hospital / site index
 *   - placement result (computed lazily, cached thereafter)
 *   - per-layer visibility flags
 *   - active placement markers (MapLibre Marker instances)
 *
 * Every transition goes through setViewMode(), which ensures the map layers,
 * left panel, and legends are all updated atomically.
 *
 * Design rule: this module IMPORTS from engine/ui/map modules but is
 * not imported by them — data flows downward only.
 */

import {
  HOSPITALS, REGIONS,
  HARAS_TO_BEST_CANDIDATE,
  CATCHMENT_MATCH,
  PLACEMENT_DATA,
  cloneGeojson,
} from './data/data-index.js';
import { PLACEMENT_NUM_SITES, DEFAULT_LAYER_STATE } from './config.js';

import { computePlacement, annotatePlacementOnFeatures,
         setSiteFocusOnFeatures, clearSiteFocusOnFeatures,
         getPlacementFill }                  from './engine/placement-engine.js';
import { computePriority }                   from './engine/priority-score.js';

import { updateViewModeButtons }             from './ui/controls.js';
import { buildZoneList, buildCatchmentList,
         buildPriorityList, buildPlacementList,
         showPlacementMarkers, refreshPlacementMarkers,
         renderMarginalCurve }               from './ui/left-panel.js';
import { renderZoneLegend, renderCatchmentLegend,
         renderPriorityLegend, renderPlacementLegend } from './ui/legends.js';
import { openRegionDossier, openCatchmentDossier,
         openSiteDossier, closeDossier }     from './ui/dossier.js';

import { flyToRegion, flyToHospital,
         flyToSite, resetCamera }            from './map/camera.js';
import { setLayerVisibility }               from './map/layers.js';

// ── Private state ─────────────────────────────────────────────────────────────
let _map             = null;   // maplibregl.Map — set once by init()

let _viewMode        = 'zone'; // current mode
let _selectedRegion  = null;   // region ID string | null
let _selectedHospital= null;   // hospital name | null
let _selectedSite    = -1;     // 0-indexed rank in placement ranking, -1 = none
let _placementResult = null;   // PlacementResult | null  (lazy, cached)
let _placementMarkers= [];     // maplibregl.Marker[]
let _layerState      = { ...DEFAULT_LAYER_STATE };
let _geoWork         = null;   // mutable working copy of HARAS_GEOJSON (cloned per mode)

// ── Initialisation ────────────────────────────────────────────────────────────
/**
 * Bind the map instance.  Must be called once inside `map.on('load')`.
 *
 * @param {maplibregl.Map} map
 */
export function init(map) {
  _map = map;
}

// ── Public getters (used by interactions.js callbacks) ────────────────────────
export const getViewMode        = () => _viewMode;
export const getSelectedSite    = () => _selectedSite;
export const getPlacementResult = () => _placementResult;
export const getLayerState      = () => ({ ..._layerState });

// ── View mode transitions ──────────────────────────────────────────────────────
/**
 * Transition to a new view mode.
 *
 * This is the single entry point for all mode changes — keyboard shortcuts,
 * button clicks, and map interaction callbacks all call this function.
 *
 * @param {'zone' | 'catchment' | 'priority' | 'placement'} mode
 */
export function setViewMode(mode) {
  if (!_map) return;
  const prev = _viewMode;
  _viewMode  = mode;

  // Clear any site-specific focus annotations from the previous mode
  if (prev === 'placement' && _selectedSite >= 0) {
    _clearSiteFocus();
  }
  _selectedSite = -1;
  closeDossier(null);           // close panel, don't reset camera (transition will)

  updateViewModeButtons(mode);

  switch (mode) {
    case 'zone':      _enterZone();      break;
    case 'catchment': _enterCatchment(); break;
    case 'priority':  _enterPriority();  break;
    case 'placement': _enterPlacement(); break;
  }
}

// ── Dossier entry points (called from interactions.js) ────────────────────────
/**
 * Open the region dossier and fly to the region.
 * Safe to call regardless of current view mode.
 *
 * @param {string} regionId
 */
export function openDossier(regionId) {
  _selectedRegion = regionId;
  const r = REGIONS.find((x) => x.id === regionId);
  if (r && _map) flyToRegion(_map, r.lng, r.lat);
  openRegionDossier(regionId, _geoWork);
}

/**
 * Compute catchment statistics for a hospital without touching the map or DOM.
 * This is the pure business-logic function referenced by interactions.js via
 * deps.computeHospitalStats() — it must never import from map or UI modules.
 *
 * @param {string} hospName
 * @returns {{ haras: number, pop: number }}
 */
export function computeHospitalStats(hospName) {
  const stats = { haras: 0, pop: 0 };
  // _geoWork is the current working copy of the GeoJSON — it accurately
  // reflects any annotations already applied by the current view mode.
  const features = _geoWork ? _geoWork.features : [];
  for (const f of features) {
    if (f.properties.Nearest_Hospital === hospName) {
      stats.haras++;
      stats.pop += +(f.properties.POPULATION || 0);
    }
  }
  return stats;
}

/**
 * Fly to a hospital by name (pure camera call, no dossier side-effects).
 * Called from interactions.js deps after the catchment dossier is opened.
 *
 * @param {string} hospName
 */
export function flyToHospitalByName(hospName) {
  const hosp = HOSPITALS.find((h) => h.name === hospName);
  if (hosp && _map) flyToHospital(_map, hosp.lng, hosp.lat);
}

/**
 * Open the catchment dossier for a hospital.
 *
 * @param {string} hospName
 * @param {{ haras: number, pop: number }} stats
 * @param {string} color
 */
export function openCatchmentDossierForHospital(hospName, stats, color) {
  _selectedHospital = hospName;
  openCatchmentDossier(hospName, stats, color, _geoWork);
}

/**
 * Open the site dossier and focus the corresponding placement marker.
 *
 * @param {number} siteIdx
 */
export function openPlacementDossier(siteIdx) {
  if (!_placementResult) return;

  _selectedSite = siteIdx;

  // Update markers and open dossier immediately — before any source mutation —
  // so the marker never disappears due to a canvas repaint triggered by setData.
  refreshPlacementMarkers(_placementMarkers, siteIdx);
  openSiteDossier(_placementResult, siteIdx);

  const r = _placementResult.ranking[siteIdx];
  if (_map) flyToSite(_map, r.site.lng, r.site.lat);

  // Defer source mutation to the next animation frame so the marker click
  // completes its event cycle before MapLibre repaints the canvas.
  requestAnimationFrame(() => {
    clearSiteFocusOnFeatures(_geoWork);
    setSiteFocusOnFeatures(_geoWork, _placementResult, siteIdx);
    _map.getSource('haras')?.setData(_geoWork);

    if (_map.getLayer('haras-fill')) {
      _map.setPaintProperty('haras-fill', 'fill-color', getPlacementFill(siteIdx));
    }
    if (_map.getLayer('haras-outline')) {
      _map.setPaintProperty('haras-outline', 'line-color', getPlacementFill(siteIdx));
    }
  });
}

/** Active reverse-lookup popup (placement mode Zone X clicks). */
let _reversePopup = null;

/**
 * Handle a click on a Zone X haras in placement mode.
 * Shows a MapLibre popup with three branches:
 *   1) Covered in the top-10 ranking → which site and new drive time
 *   2) Not in top-10 but has a best candidate ��� show best alternative
 *   3) Unreachable by any candidate
 *
 * @param {object} props   — GeoJSON feature properties
 * @param {maplibregl.LngLat} lngLat
 */
export function showHarasPlacementReverse(props, lngLat) {
  if (!_placementResult || !_map) return;

  const hid    = +props.HARA_ID;
  const oldMin = parseFloat(props.Driving_Min) || 0;
  const popVal = parseInt(props.POPULATION || 0);
  const top10Rank = +(props.rescued_by || -1);

  let top10Block = '';
  if (top10Rank >= 1) {
    const r      = _placementResult.ranking[top10Rank - 1];
    const entry  = PLACEMENT_DATA.cov[r.idx].find((e) => e[0] === hid);
    const newMin = entry ? entry[1] : null;
    const newClass = (newMin != null && newMin <= 60) ? '≤60 min (optimal)' : '60–120 min (acceptable)';
    const newColor = (newMin != null && newMin <= 60) ? '#00e5b4' : '#d4a017';
    const shortN = r.site.n.replace(/^Cluster-\d+ \(snap → /, '⚡ ').replace(/\)$/, '');
    top10Block = `
      <div style="margin-top:8px;padding:8px;border-radius:4px;background:rgba(0,229,180,0.08);border:1px solid rgba(0,229,180,0.25)">
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:0.15em;color:#00e5b4">✓ COVERED IN TOP 10</div>
        <div style="margin-top:4px;font-size:11px;color:#fff">Site #${top10Rank} — ${shortN}</div>
        <div style="margin-top:3px;font-size:10px;color:#c8d8e4">${oldMin.toFixed(0)} min → <span style="color:${newColor};font-weight:500">${newMin != null ? newMin.toFixed(0) : '?'} min</span></div>
        <div style="margin-top:1px;font-size:9px;color:#6a8090">New access: <span style="color:${newColor}">${newClass}</span></div>
      </div>`;
  } else {
    const best = HARAS_TO_BEST_CANDIDATE.get(hid);
    if (best) {
      const site     = PLACEMENT_DATA.sites[best.siteIdx];
      const newClass = best.newMin <= 60 ? '≤60 min (optimal)' : '60–120 min (acceptable)';
      const newColor = best.newMin <= 60 ? '#00e5b4' : '#d4a017';
      const shortN   = site.n.replace(/^Cluster-\d+ \(snap → /, '⚡ ').replace(/\)$/, '');
      top10Block = `
        <div style="margin-top:8px;padding:8px;border-radius:4px;background:rgba(255,107,62,0.08);border:1px solid rgba(255,107,62,0.25)">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:0.15em;color:#ff6b3e">⚠ NOT IN TOP 10</div>
          <div style="margin-top:4px;font-size:10px;color:#c8d8e4">Best alternative candidate:</div>
          <div style="margin-top:2px;font-size:11px;color:#fff">${shortN} <span style="font-size:9px;color:#4a6070">· ${site.s === 'kmeans' ? 'k-means' : site.g || 'city'}</span></div>
          <div style="margin-top:3px;font-size:10px;color:#c8d8e4">${oldMin.toFixed(0)} min → <span style="color:${newColor};font-weight:500">${best.newMin.toFixed(0)} min</span></div>
          <div style="margin-top:1px;font-size:9px;color:#6a8090">Would gain: <span style="color:${newColor}">${newClass}</span></div>
        </div>`;
    } else {
      top10Block = `
        <div style="margin-top:8px;padding:8px;border-radius:4px;background:rgba(224,62,62,0.1);border:1px solid rgba(224,62,62,0.3)">
          <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:0.15em;color:#e03e3e">✕ UNREACHABLE</div>
          <div style="margin-top:4px;font-size:10px;color:#c8d8e4">No candidate site brings this haras within 120 min.</div>
        </div>`;
    }
  }

  if (_reversePopup) _reversePopup.remove();
  _reversePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 8, maxWidth: '280px' })
    .setLngLat(lngLat)
    .setHTML(`
      <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4a6070;letter-spacing:0.1em;margin-bottom:4px">${(props.Region || '').toUpperCase()}</div>
      <div style="color:#fff;font-size:12px;margin-bottom:2px">${props.HARA_NAME_ENG || '—'}</div>
      <div style="color:#8ca0b0;font-size:13px;direction:rtl;text-align:right;margin-bottom:6px">${props.HARA_NAME || ''}</div>
      <div style="display:flex;gap:12px">
        <span style="padding:2px 8px;border-radius:3px;background:#e03e3e22;color:#e03e3e;font-size:9px;font-weight:700">Zone X</span>
        <span style="color:#c8d8e4;font-size:10px">${oldMin.toFixed(0)} min currently</span>
      </div>
      <div style="margin-top:5px;font-size:10px;color:#4a6070">Pop: ${popVal.toLocaleString()}</div>
      ${top10Block}
    `)
    .addTo(_map);
}

// ── Layer toggle (called from left panel checkboxes) ──────────────────────────
/**
 * Toggle a layer group on/off and update internal state.
 *
 * @param {string} id  — 'haras' | 'hospitals' | 'towers' | 'arcs'
 * @param {boolean} visible
 * @param {deck.MapboxOverlay} deckOverlay
 * @param {any[]} arcData
 */
export function toggleLayer(id, visible, deckOverlay, arcData) {
  _layerState[id] = visible;
  setLayerVisibility(_map, id, visible, deckOverlay, arcData, _layerState);
}

// ── Private transition helpers ──────────────────────────────────────────���─────
function _enterZone() {
  _geoWork = cloneGeojson();
  resetCamera(_map);
  _clearPlacementMarkers();
  _setHarasFill(_zoneFill());
  _map.getSource('haras')?.setData(_geoWork);
  buildZoneList((regionId) => openDossier(regionId));
  renderZoneLegend('legend-section');
}

function _enterCatchment() {
  _geoWork = cloneGeojson();
  resetCamera(_map);
  _clearPlacementMarkers();
  _setHarasFill(_catchmentFill());
  _map.getSource('haras')?.setData(_geoWork);
  buildCatchmentList(_geoWork, (name, stats, col) => {
    const hosp = HOSPITALS.find((h) => h.name === name);
    if (hosp) flyToHospital(_map, hosp.lng, hosp.lat);
    openCatchmentDossierForHospital(name, stats, col);
  });
  renderCatchmentLegend('legend-section');
}

function _enterPriority() {
  _geoWork = cloneGeojson();
  resetCamera(_map);
  _clearPlacementMarkers();
  const { fillExpression } = computePriority(_geoWork); // writes priority_score; returns quantile fill expr
  _map.getSource('haras')?.setData(_geoWork);
  _setHarasFill(fillExpression);
  buildPriorityList(_geoWork, (regionId) => openDossier(regionId));
  renderPriorityLegend('legend-section');
}

function _enterPlacement() {
  // Fresh working copy every time — rescued_by must be re-annotated from a
  // clean baseline so re-entering placement always reflects current ranking.
  _geoWork = cloneGeojson();

  if (!_placementResult) {
    _placementResult = computePlacement(PLACEMENT_NUM_SITES);
  }
  annotatePlacementOnFeatures(_geoWork, _placementResult);

  _map.getSource('haras')?.setData(_geoWork);
  _setHarasFill(getPlacementFill(-1));

  // Remove old markers, add new ones
  _clearPlacementMarkers();
  _placementMarkers = showPlacementMarkers(_map, _placementResult, (i) => {
    openPlacementDossier(i);
  });

  buildPlacementList(_placementResult, (i) => openPlacementDossier(i));
  renderMarginalCurve(_placementResult.ranking);
  renderPlacementLegend('legend-section');
}

function _clearSiteFocus() {
  clearSiteFocusOnFeatures(_geoWork);
  if (_map.getLayer('haras-fill')) {
    _map.setPaintProperty('haras-fill', 'fill-color', getPlacementFill(-1));
  }
  refreshPlacementMarkers(_placementMarkers, -1);
}

function _clearPlacementMarkers() {
  _placementMarkers.forEach((m) => m.remove());
  _placementMarkers = [];
}

function _setHarasFill(expr) {
  if (_map.getLayer('haras-fill')) {
    _map.setPaintProperty('haras-fill', 'fill-color', expr);
  }
  if (_map.getLayer('haras-outline')) {
    _map.setPaintProperty('haras-outline', 'line-color', expr);
  }
}

// ── Fill expression helpers ───────────────────────────────────────────────────
function _zoneFill() {
  return ['match', ['get', 'Zone'],
    'Zone 1', '#00e5b4',
    'Zone 2', '#d4a017',
    '#e03e3e',
  ];
}

function _catchmentFill() {
  // CATCHMENT_MATCH is a pre-built MapLibre 'match' expression exported from
  // hospitals.js via data-index.js — no window globals needed.
  return CATCHMENT_MATCH;
}


