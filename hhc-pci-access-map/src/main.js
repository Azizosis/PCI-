/**
 * main.js — application entry point
 *
 * Execution sequence:
 *   1. Initialise the MapLibre map
 *   2. On map 'load': add sources + layers, wire interactions, wire UI controls
 *   3. Enter the default 'zone' view mode
 *
 * This file should contain NO business logic — it wires together the
 * modules in the correct order and hands off control to state.js.
 */

import { HARAS_GEOJSON, HOSPITALS }           from './data/data-index.js';
import { HOSPITAL_COLORS, HARA_GOV, HARA_AUX,
         HARAS_TO_BEST_CANDIDATE }             from './data/data-index.js';

import { initMap }                             from './map/map-init.js';
import { addAllLayers, setLayerVisibility }    from './map/layers.js';
import { wireInteractions }                    from './map/interactions.js';

import { renderViewModeSection,
         updateViewModeButtons,
         wireZoomControls,
         wireDossierClose }                    from './ui/controls.js';
import { renderTogglePanel }                   from './ui/legends.js';

import {
  init            as initState,
  setViewMode,
  getViewMode,
  getSelectedSite,
  getPlacementResult,
  openDossier,
  openCatchmentDossierForHospital,
  openPlacementDossier,
  showHarasPlacementReverse,
  toggleLayer,
}                                              from './state.js';
import { closeDossier }                        from './ui/dossier.js';
import { DEFAULT_LAYER_STATE }                 from './config.js';

// ── Initialise map ────────────────────────────────────────────────────────────
const map = initMap('map');

// ── Map load ──────────────────────────────────────────────────────────────────
map.on('load', async () => {
  // ── 1. Add all map layers ────────────────────────────────────────────────
  const { deckOverlay, arcData } = addAllLayers(map, HARAS_GEOJSON, HOSPITALS);

  // Expose layers module seam for state.js toggleLayer()
  window.__layers__ = { setLayerVisibility };

  // ── 2. Bind state module to map ──────────────────────────────────────────
  initState(map);

  // ── 3. Wire map interactions ─────────────────────────────────────────────
  // REGIONS is a static export — import it at the top level
  const { REGIONS } = await import('./data/data-index.js');

  wireInteractions(map, {
    REGIONS_LIST:           REGIONS,
    getViewMode,
    getSelectedSite,
    getPlacementResult,
    openDossier,
    openCatchmentDossier:   openCatchmentDossierForHospital,
    openPlacementDossier,
    setViewMode,
    showHarasPlacementReverse,
  });

  // ── 4. Wire left-panel view-mode buttons ─────────────────────────────────
  renderViewModeSection('viewmode-section', 'zone', (mode) => setViewMode(mode));

  // ── 5. Wire layer toggle checkboxes ──────────────────────────────────────
  const toggleIds = ['haras', 'hospitals', 'towers', 'arcs'];
  toggleIds.forEach((id) => {
    const el = document.getElementById(`toggle-${id}`);
    if (!el) return;
    el.checked = DEFAULT_LAYER_STATE[id] ?? true;
    el.addEventListener('change', () => {
      toggleLayer(id, el.checked, deckOverlay, arcData);
    });
  });

  // ── 6. Wire zoom + dossier-close buttons ─────────────────────────────────
  wireZoomControls(map);
  wireDossierClose(() => closeDossier(map));

  // ── 7. Render layer toggle panel ─────────────────────────────────────────
  renderTogglePanel('toggle-panel');

  // ── 8. Enter default view mode ───────────────────────────────────────────
  setViewMode('zone');
});

// ── Map error handler ─────────────────────────────────────────────────────────
map.on('error', (e) => {
  console.error('[HHC-PCI] MapLibre error:', e.error);
});
