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

import { initMap }                             from './map/map-init.js';
import { addAllLayers }                        from './map/layers.js';
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
  computeHospitalStats,
  flyToHospitalByName,
}                                              from './state.js';
import { closeDossier }                        from './ui/dossier.js';
import { DEFAULT_LAYER_STATE }                 from './config.js';

// ── Initialise map ────────────────────────────────────────────────────────────
const map = initMap('map');

// ── Map load ──────────────────────────────────────────────────────────────────
map.on('load', async () => {
  // ── 1. Add all map layers ────────────────────────────────────────────────
  const { deckOverlay, arcData } = addAllLayers(map, HARAS_GEOJSON, HOSPITALS);

  // Update arc-count badge here (layers.js is DOM-free)
  const arcCountEl = document.getElementById('arc-count');
  if (arcCountEl) arcCountEl.textContent = arcData.length.toLocaleString();

  // ── 2. Bind state module to map ──────────────────────────────────────────
  initState(map);

  // ── 3. Wire map interactions ─────────────────────────────────────────────
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
    computeHospitalStats,
    flyToHospital:          flyToHospitalByName,
  });

  // ── 4. Wire left-panel view-mode buttons ─────────────────────────────────
  renderViewModeSection('viewmode-section', 'zone', (mode) => setViewMode(mode));

  // ── 5. Render layer toggle panel into the correct container ──────────────
  renderTogglePanel('layers-section', DEFAULT_LAYER_STATE);

  // ── 6. Wire layer toggle rows (pill-style) ────────────────────────────────
  const toggleIds = ['haras', 'hospitals', 'towers', 'arcs'];
  toggleIds.forEach((id) => {
    const row  = document.querySelector(`[data-layer="${id}"]`);
    const pill = document.getElementById(`toggle-${id}`);
    if (!row || !pill) return;

    let on = DEFAULT_LAYER_STATE[id] ?? false;

    const handleToggle = () => {
      on = !on;
      pill.classList.toggle('on', on);
      row.setAttribute('aria-pressed', String(on));
      toggleLayer(id, on, deckOverlay, arcData);
    };

    row.addEventListener('click', handleToggle);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handleToggle();
    });
  });

  // ── 7. Wire zoom + dossier-close buttons ─────────────────────────────────
  wireZoomControls(map);
  wireDossierClose(() => closeDossier(map));

  // ── 8. Enter default view mode ───────────────────────────────────────────
  setViewMode('zone');
});

// ── Map error handler ─────────────────────────────────────────────────────────
map.on('error', (e) => {
  console.error('[HHC-PCI] MapLibre error:', e.error);
});
