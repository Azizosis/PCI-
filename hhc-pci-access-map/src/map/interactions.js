/**
 * interactions.js — MapLibre mouse/click event wiring
 *
 * `wireInteractions(map, deps)` registers all hover and click handlers.
 * It is called once inside `map.on('load')`.
 *
 * Replaces the duck-punched `e.originalEvent._handledByHosp` pattern with
 * the clean module-scoped flag from utils/events.js.
 */

import { HARA_AUX, HARAS_TO_BEST_CANDIDATE, HARAS_GEOJSON, HOSPITALS } from '../data/data-index.js';
import { HOSPITAL_COLORS } from '../data/data-index.js';
import { PLACEMENT_DATA }  from '../data/data-index.js';
import { markHandled, wasHandled, clearHandled } from '../utils/events.js';
import { flyToRegion, flyToHospital, flyToSite } from './camera.js';
import { siteShortName } from '../utils/format.js';

/**
 * @typedef {{
 *   REGIONS_LIST:        Array<{ id: string, name: string, lng: number, lat: number }>,
 *   getViewMode:         () => string,
 *   getSelectedSite:     () => number,
 *   getPlacementResult:  () => import('../engine/placement-engine.js').PlacementResult | null,
 *   openDossier:         (regionId: string) => void,
 *   openCatchmentDossier:(name: string, stats: object, col: string) => void,
 *   openPlacementDossier:(siteIdx: number) => void,
 *   setViewMode:         (mode: string) => void,
 *   showHarasPlacementReverse: (props: object, lngLat: maplibregl.LngLat) => void,
 * }} InteractionDeps
 */

/**
 * Register all map interaction handlers.
 *
 * @param {maplibregl.Map} map
 * @param {InteractionDeps} deps
 */
export function wireInteractions(map, deps) {
  let nbhdPopup  = null;
  let hospPopup  = null;

  // ── Haras hover popup ───────────────────────────────────────────────────────
  map.on('mousemove', 'haras-fill', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    const p         = e.features[0].properties;
    const zoneColor = p.Zone === 'Zone 1' ? '#00e5b4' : p.Zone === 'Zone 2' ? '#d4a017' : '#e03e3e';
    const aux       = HARA_AUX.get(+p.HARA_ID);

    const detour = (aux && aux.dist > 0 && aux.hav > 0)
      ? `<div style="margin-top:3px;font-size:9px;color:#6a8090">Route ${aux.dist.toFixed(0)}km · direct ${aux.hav.toFixed(0)}km · <span style="color:${(aux.dist / aux.hav) >= 1.5 ? '#e85d3e' : '#6a8090'}">${(aux.dist / aux.hav).toFixed(2)}x detour</span></div>`
      : '';

    const backup = (aux && aux.d2 > 0)
      ? `<div style="margin-top:1px;font-size:9px;color:#4a6070">Backup hosp: ${aux.d2.toFixed(0)} min away</div>`
      : '';

    const prio = (+p.priority_score > 0)
      ? `<div style="margin-top:4px;font-size:9px;color:#4a6070">Priority: <span style="color:#ff6b3e;font-family:'Space Mono',monospace">${(+p.priority_score).toFixed(0)} person-hrs</span></div>`
      : '';

    let placement = '';
    const viewMode     = deps.getViewMode();
    const selectedSite = deps.getSelectedSite();
    const placementResult = deps.getPlacementResult();

    if (viewMode === 'placement' && selectedSite >= 0 && p.Zone === 'Zone X' && +p.site_focus > 0) {
      const r = placementResult.ranking[selectedSite];
      const entry = PLACEMENT_DATA.cov[r.idx].find((e) => e[0] === +p.HARA_ID);
      if (entry) {
        const oldMin   = parseFloat(p.Driving_Min) || 0;
        const newMin   = entry[1];
        const saveMin  = Math.max(0, oldMin - newMin);
        const newClass = newMin <= 60
          ? '<span style="color:#00e5b4">60 min (optimal)</span>'
          : '<span style="color:#d4a017">60-120 min (acceptable)</span>';
        placement = `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #1c2a35;font-size:9px;color:#9d4edd;letter-spacing:0.1em;font-family:'Space Mono',monospace">AFTER SITE #${selectedSite + 1}</div>
          <div style="font-size:10px;color:#c8d8e4;margin-top:2px">${oldMin.toFixed(0)} min &rarr; <span style="color:#00e5b4;font-weight:500">${newMin.toFixed(0)} min</span> (saves ${saveMin.toFixed(0)} min)</div>
          <div style="font-size:9px;color:#6a8090;margin-top:1px">New access class: ${newClass}</div>`;
      }
    }

    if (nbhdPopup) nbhdPopup.remove();
    nbhdPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:#4a6070;letter-spacing:0.1em;margin-bottom:4px">${p.Region.toUpperCase()}</div>
        <div style="color:#fff;font-size:12px;margin-bottom:2px">${p.HARA_NAME_ENG || '—'}</div>
        <div style="color:#8ca0b0;font-size:13px;font-family:'DM Sans',sans-serif;margin-bottom:6px;direction:rtl;text-align:right">${p.HARA_NAME || ''}</div>
        <div style="display:flex;gap:12px">
          <span style="padding:2px 8px;border-radius:3px;background:${zoneColor}22;color:${zoneColor};font-size:9px;font-weight:700">${p.Zone}</span>
          <span style="color:#c8d8e4;font-size:10px">${p.Driving_Min ? p.Driving_Min + ' min drive' : '—'}</span>
        </div>
        <div style="margin-top:5px;font-size:10px;color:#4a6070">Pop: ${parseInt(p.POPULATION || 0).toLocaleString()}</div>
        <div style="margin-top:2px;font-size:9px;color:#2a4050">${p.Nearest_Hospital}</div>
        ${detour}${backup}${prio}${placement}
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'haras-fill', () => {
    map.getCanvas().style.cursor = '';
    if (nbhdPopup) { nbhdPopup.remove(); nbhdPopup = null; }
  });

  // ── Hospital hover popup ────────────────────────────────────────────────────
  map.on('mouseenter', 'hosp-pts', (e) => {
    map.getCanvas().style.cursor = 'pointer';
    if (hospPopup) hospPopup.remove();
    hospPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      .setLngLat(e.lngLat)
      .setHTML(`<span style="color:#0077ff;font-size:10px;font-family:'Space Mono',monospace">[H] </span><span style="color:#fff;font-size:11px">${e.features[0].properties.name}</span>`)
      .addTo(map);
  });

  map.on('mouseleave', 'hosp-pts', () => {
    map.getCanvas().style.cursor = '';
    if (hospPopup) { hospPopup.remove(); hospPopup = null; }
  });

  // ── Hospital click ──────────────────────────────────────────────────────────
  map.on('click', 'hosp-pts', (e) => {
    markHandled('map-click');
    const hospName = e.features[0].properties.name;
    const col      = HOSPITAL_COLORS[hospName] || '#0077ff';

    const stats = { haras: 0, pop: 0 };
    for (const f of HARAS_GEOJSON.features) {
      if (f.properties.Nearest_Hospital === hospName) {
        stats.haras++;
        stats.pop += (f.properties.POPULATION || 0);
      }
    }

    deps.setViewMode('catchment');
    deps.openCatchmentDossier(hospName, stats, col);

    const hosp = HOSPITALS.find((h) => h.name === hospName);
    if (hosp) flyToHospital(map, hosp.lng, hosp.lat);
  });

  // ── Haras click ─────────────────────────────────────────────────────────────
  map.on('click', 'haras-fill', (e) => {
    if (wasHandled('map-click')) { clearHandled('map-click'); return; }

    const viewMode = deps.getViewMode();

    if (viewMode === 'placement' && e.features[0].properties.Zone === 'Zone X') {
      deps.showHarasPlacementReverse(e.features[0].properties, e.lngLat);
      return;
    }

    const region  = e.features[0].properties.Region;
    // Fuzzy-match: exact, includes, or first word.
    // REGIONS_LIST is passed via deps to avoid a circular import and to
    // eliminate the invalid `await import()` inside a synchronous handler.
    const REGIONS_LIST = deps.REGIONS_LIST;
    const r = REGIONS_LIST.find(
      (x) => x.name === region || x.name.includes(region) || region.includes(x.name.split(' ')[0])
    );
    if (r) {
      flyToRegion(map, r.lng, r.lat);
      deps.openDossier(r.id);
    }
  });
}
