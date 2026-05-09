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

  // Clear previous site-focus annotations, then apply new ones — on the working copy
  clearSiteFocusOnFeatures(_geoWork);
  setSiteFocusOnFeatures(_geoWork, _placementResult, siteIdx);
  _map.getSource('haras')?.setData(_geoWork);

  // Update fill expression for focus mode
  if (_map.getLayer('haras-fill')) {
    _map.setPaintProperty('haras-fill', 'fill-color', getPlacementFill(siteIdx));
  }

  _selectedSite = siteIdx;
  refreshPlacementMarkers(_placementMarkers, siteIdx);

  const r = _placementResult.ranking[siteIdx];
  if (_map) flyToSite(_map, r.site.lng, r.site.lat);

  openSiteDossier(_placementResult, siteIdx);
}

/**
 * Handle a click on an unreached Zone X haras in placement mode.
 * Shows a popup-style info note in the dossier about the best candidate site.
 *
 * @param {object} props   — GeoJSON feature properties
 * @param {maplibregl.LngLat} _lngLat  — (reserved for future popup use)
 */
export function showHarasPlacementReverse(props, _lngLat) {
  // No-op if no result yet or haras is already rescued
  if (!_placementResult) return;

  // Delegate to openPlacementDossier for the best site covering this haras.
  // HARAS_TO_BEST_CANDIDATE is a proper ES-module import — no window globals.
  const best = HARAS_TO_BEST_CANDIDATE.get(+props.HARA_ID);
  if (!best) return;

  // Find the rank of this site in the placement ranking
  const rankIdx = _placementResult.ranking.findIndex((r) => r.idx === best.siteIdx);
  if (rankIdx >= 0) openPlacementDossier(rankIdx);
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
  renderZoneLegend('map-legend');
}

function _enterCatchment() {
  _geoWork = cloneGeojson();
  resetCamera(_map);
  _clearPlacementMarkers();
  _setHarasFill(_catchmentFill());
  _map.getSource('haras')?.setData(_geoWork);
  buildCatchmentList((name, stats, col) => {
    const hosp = HOSPITALS.find((h) => h.name === name);
    if (hosp) flyToHospital(_map, hosp.lng, hosp.lat);
    openCatchmentDossierForHospital(name, stats, col);
  });
  renderCatchmentLegend('map-legend');
}

function _enterPriority() {
  _geoWork = cloneGeojson();
  resetCamera(_map);
  _clearPlacementMarkers();
  computePriority(_geoWork);           // writes priority_score onto the working copy
  _map.getSource('haras')?.setData(_geoWork);
  _setHarasFill(_priorityFill());
  buildPriorityList((regionId) => openDossier(regionId));
  renderPriorityLegend('map-legend');
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
  renderPlacementLegend('map-legend');
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

function _priorityFill() {
  return ['interpolate', ['linear'],
    ['coalesce', ['get', 'priority_score'], 0],
    0,       '#1a2236',
    500,     '#3a5a90',
    5000,    '#d4a017',
    20000,   '#ff6b3e',
    80000,   '#ff1e3c',
  ];
}
