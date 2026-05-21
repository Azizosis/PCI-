/**
 * dossier.js — slide-in analytical dossier panel
 *
 * Exposes four public entry points:
 *   openRegionDossier(regionId, geojson)
 *   openCatchmentDossier(hospName, stats, color)
 *   openSiteDossier(result, siteIndex, geojson, haraGov)
 *   closeDossier(map)
 *
 * All DOM mutation is scoped to #dossier and its children.
 * The dossier element is assumed to exist in index.html.
 */

import { REGIONS, HOSPITAL_COLORS, HOSPITALS, PLACEMENT_DATA } from '../data/data-index.js';
import { STEMI_RATE, STEMI_NOTE, REGION_CAPITAL } from '../engine/assumptions.js';

import { getCatchmentForHospital }  from '../engine/catchments.js';
import {
  buildAffectedByGovernorate,
  facilityTypeText,
} from '../engine/placement-engine.js';
import { fmtK, fmtPct, siteShortName, siteDisplayLabel } from '../utils/format.js';
import { renderImpactMap }          from './impact-map-svg.js';
import { resetCamera }              from '../map/camera.js';

// ── Design token reads ────────────────────────────────────────────────────────
// Snapshot CSS custom properties once so HTML template strings reference named
// constants rather than hardcoded hex literals.  If a token value changes in
// tokens.css the new value is automatically picked up on the next page load.
function tok(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const C_Z1            = tok('--z1');
const C_Z2            = tok('--z2');
const C_ZX            = tok('--zx');
const C_ACCENT_PURPLE = tok('--accent-purple');
const C_ACCENT_ORANGE = tok('--accent-orange');
const C_PRIORITY_HIGH = tok('--priority-high');
const C_HOSP_FALLBACK = tok('--hosp-fallback');

// ── Dossier DOM refs ──────────────────────────────────────────────────────────
// IDs match index.html: #dossier-name, #dossier-meta, #dossier-badge, #dossier-body
const $ = (id) => document.getElementById(id);

function getDossier() { return $('dossier');       }
function getName()    { return $('dossier-name');  }
function getMeta()    { return $('dossier-meta');  }
function getBadge()   { return $('dossier-badge'); }
function getBody()    { return $('dossier-body');  }

// ── Section factory ───────────────────────────────────────────────────────────
/**
 * Wrap arbitrary HTML in a labelled dossier section div.
 * Replaces ad-hoc repetition of the same markup pattern.
 *
 * @param {string} label   — section heading text (shown in monospace)
 * @param {string} content — inner HTML for the section body
 * @returns {string}
 */
function section(label, content) {
  return `
    <div class="dossier-section">
      <div class="dossier-section-label">${label}</div>
      ${content}
    </div>
  `;
}

// ── Badge helper ──────────────────────────────────────────────────────────────
/**
 * Update the dossier badge chip.
 *
 * @param {string} text   — short badge text (2–4 chars)
 * @param {string} color  — accent colour hex
 */
function setBadge(text, color) {
  const el = getBadge();
  if (!el) return;
  el.textContent         = text;
  el.style.background    = `${color}22`;
  el.style.color         = color;
  el.style.border        = `1px solid ${color}44`;
}

/**
 * Set the dossier header name + meta line and open the panel.
 *
 * @param {string} name
 * @param {string} meta
 */
function openDossierPanel(name, meta) {
  const n = getName();
  const m = getMeta();
  if (n) n.textContent = name;
  if (m) m.textContent = meta;
  const d = getDossier();
  if (d) d.classList.add('open');
}

/**
 * Close the dossier panel and optionally reset the map camera.
 *
 * @param {maplibregl.Map | null} [map]
 */
export function closeDossier(map = null) {
  const d = getDossier();
  if (d) d.classList.remove('open');
  if (map) resetCamera(map);
}

// ── renderRegionDossier ───────────────────────────────────────────────────────
/**
 * Render and open the region-level analytical dossier.
 *
 * @param {string} regionId
 * @param {GeoJSON.FeatureCollection} geojson  — working copy passed by state.js
 */
export function openRegionDossier(regionId, geojson) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;

  const { z1, z2, zx, total } = region;
  const stemiZ1  = Math.round(z1.pop  * STEMI_RATE);
  const stemiZ2  = Math.round(z2.pop  * STEMI_RATE);
  const stemiZx  = Math.round(zx.pop  * STEMI_RATE);
  const capital  = REGION_CAPITAL[region.name] || region.name;

  // Accumulate priority_score only from the working copy (never HARAS_GEOJSON)
  let totalPrioScore = 0;
  for (const f of geojson.features) {
    if (f.properties.Region === region.name) {
      totalPrioScore += f.properties.priority_score || 0;
    }
  }

  // Region-level severity: derived from Zone X population share, not backup hospital distance.
  // fragilitySeverity() is for per-site redundancy minutes; here we use a pct_pop ladder instead.
  const frag = zx.pct_pop >= 0.5
    ? { label: 'Critical', color: '#e03e3e' }
    : zx.pct_pop >= 0.3
    ? { label: 'High',     color: '#ff8c42' }
    : zx.pct_pop >= 0.1
    ? { label: 'Moderate', color: '#f5d033' }
    : { label: 'Low',      color: '#7ed957' };

  setBadge('REG', C_Z1);
  openDossierPanel(
    region.name,
    `Administrative Region · ${total.nbhd.toLocaleString()} haras`,
  );

  getBody().innerHTML = renderRegionDossier({ region, z1, z2, zx, stemiZ1, stemiZ2, stemiZx, totalPrioScore, frag, capital });
}

/**
 * Pure render function — returns the full dossier body HTML string for a region.
 * Separated from the DOM-mutation caller so it can be tested or reused.
 */
function renderRegionDossier({ region, z1, z2, zx, stemiZ1, stemiZ2, stemiZx, totalPrioScore, frag, capital }) {
  const hospitalsSection = region.hospitals?.length
    ? section('PCI Centers Serving This Region', `
        <div class="dossier-hosp-list">
          ${region.hospitals.map((h) => {
            const col = HOSPITAL_COLORS[h] || C_HOSP_FALLBACK;
            return `<div class="dossier-hosp-item">
              <span class="dossier-hosp-dot" style="background:${col}"></span>
              <span class="dossier-hosp-name">${h}</span>
            </div>`;
          }).join('')}
        </div>
      `)
    : '';

  return `
    ${section('Access Zone Breakdown', `
      <div class="dossier-zone-bars">
        ${zoneBar('Zone 1 ≤60 min',    z1.pct_pop, z1.pop, z1.nbhd, C_Z1, stemiZ1)}
        ${zoneBar('Zone 2 61-120 min', z2.pct_pop, z2.pop, z2.nbhd, C_Z2, stemiZ2)}
        ${zoneBar('Zone X >120 min',   zx.pct_pop, zx.pop, zx.nbhd, C_ZX, stemiZx)}
      </div>
    `)}

    ${section('Access Burden', `
      <div class="dossier-stat-grid">
        ${stat(fmtK(zx.pop),                           'people beyond 120 min',  C_ZX)}
        ${stat(`${Math.round(totalPrioScore / 1000)}K`, 'person-hrs of burden',   C_PRIORITY_HIGH)}
        ${stat(`~${stemiZx.toLocaleString()}`,          'delayed STEMI/yr',        C_ZX)}
        ${stat(frag.label,                              'fragility severity',      frag.color)}
      </div>
    `)}

    ${section('System Dependency', `
      <div class="dossier-narrative">
        ${zx.pct_pop >= 0.3
          ? `<strong style="color:${C_ZX}">${fmtPct(zx.pct_pop)}</strong> of ${region.name}&apos;s population
             (${fmtK(zx.pop)} people) live beyond 120-min drive time of any PCI-capable center.
             This cohort relies on <em>transfer chains</em> from ${capital}, with typical delays
             exceeding 3 hours &mdash; well beyond the 90-min door-to-balloon target.`
          : `<strong style="color:${C_Z1}">${fmtPct(z1.pct_pop)}</strong> of ${region.name}&apos;s population
             has optimal PCI access (&le;60 min). The remaining ${fmtPct(zx.pct_pop)} in Zone X
             &mdash; ${fmtK(zx.pop)} people &mdash; still depend on extended transfers.`
        }
      </div>
    `)}

    ${hospitalsSection}
    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;
}

// ── renderCatchmentDossier ────────────────────────────────────────────────────
/**
 * Render and open the catchment dossier for a hospital.
 *
 * @param {string} hospName
 * @param {{ haras: number, pop: number }} basicStats  from state.computeHospitalStats()
 * @param {string} color
 * @param {GeoJSON.FeatureCollection} geojson  — working copy passed by state.js
 */
export function openCatchmentDossier(hospName, basicStats, color, geojson) {
  const full = getCatchmentForHospital(geojson, hospName);
  const s    = full ?? { haras: basicStats.haras, pop: basicStats.pop, z1: { h: 0, p: 0 }, z2: { h: 0, p: 0 }, zx: { h: 0, p: 0 } };

  setBadge('PCI', color);
  openDossierPanel(
    hospName,
    `PCI-capable center · ${s.haras.toLocaleString()} haras in catchment`,
  );
  getBody().innerHTML = renderCatchmentDossier({ s, hospName, color });
}

/**
 * Pure render function — returns the full dossier body HTML string for a catchment.
 */
function renderCatchmentDossier({ s, hospName, color }) {
  const stemiZx = Math.round((s.zx?.p ?? 0) * STEMI_RATE);

  return `
    ${section('Catchment Zone Breakdown', `
      <div class="dossier-zone-bars">
        ${catchmentZoneBar('Zone 1 ≤60 min',   s.z1.h, s.haras, s.z1.p, C_Z1)}
        ${catchmentZoneBar('Zone 2 61-120 min', s.z2.h, s.haras, s.z2.p, C_Z2)}
        ${catchmentZoneBar('Zone X >120 min',   s.zx.h, s.haras, s.zx.p, C_ZX)}
      </div>
    `)}

    ${section('Catchment Metrics', `
      <div class="dossier-stat-grid">
        ${stat(fmtK(s.pop),                   'total catchment pop',   color)}
        ${stat(fmtK(s.zx?.p ?? 0),            'Zone X population',     C_ZX)}
        ${stat(`~${stemiZx.toLocaleString()}`, 'delayed STEMI/yr',      C_ZX)}
        ${stat(s.z1.h.toLocaleString(),        'haras in 60-min zone',  color)}
      </div>
    `)}

    ${section('Coverage Narrative', `
      <div class="dossier-narrative">
        ${hospName} serves <strong>${s.haras.toLocaleString()} haras</strong>
        with a total catchment population of <strong>${fmtK(s.pop)}</strong>.
        ${s.zx.h > 0
          ? `However, <strong style="color:${C_ZX}">${s.zx.h.toLocaleString()} haras</strong>
             (${fmtK(s.zx.p)} people) fall in Zone X &mdash; over 120 min drive-time &mdash;
             indicating a structural access gap that cannot be resolved by optimizing
             existing routing alone.`
          : `All catchment haras fall within 120 minutes, representing strong spatial coverage.`
        }
      </div>
    `)}

    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;
}

// ── renderSiteDossier ─────────────────────────────────────────────────────────
/**
 * Render and open the dossier for a proposed placement site.
 * Governorate lookup uses HARA_INDEX internally via buildAffectedByGovernorate.
 *
 * @param {import('../engine/placement-engine.js').PlacementResult} result
 * @param {number} siteIndex  0-indexed rank in result.ranking
 */
export function openSiteDossier(result, siteIndex) {
  const r       = result.ranking[siteIndex];
  const cls     = r.classification;
  const site    = r.site;
  const lbl     = siteDisplayLabel(site);
  const govData = buildAffectedByGovernorate(siteIndex, result);

  setBadge(`#${siteIndex + 1}`, cls.color);
  openDossierPanel(lbl.primary, facilityTypeText(cls));
  getBody().innerHTML = renderSiteDossier({ r, cls, govData });

  // renderImpactMap must run after innerHTML sets the #dossier-impact-map node
  renderImpactMap(
    document.getElementById('dossier-impact-map'),
    govData,
    { n: site.n, lat: site.lat, lng: site.lng },
  );
}

/**
 * Pure render function — returns full dossier body HTML for a placement site.
 * The #dossier-impact-map div is left empty here; renderImpactMap fills it
 * after this string is injected into the DOM.
 */
function renderSiteDossier({ r, cls, govData }) {
  const popReached = r.popZ1 + r.popZ2;
  const stemiYr    = Math.round(popReached * STEMI_RATE);

  return `
    ${section('Classification', `
      <div class="dossier-cls-badge" style="background:${cls.color}18;border:1px solid ${cls.color}55">
        <span class="dossier-cls-dot" style="background:${cls.color}"></span>
        <span class="dossier-cls-label" style="color:${cls.color}">${cls.label}</span>
        <span class="dossier-cls-score">inv. score ${r.invScore}/100</span>
      </div>
    `)}

    ${section('Population Impact', `
      <div class="dossier-stat-grid">
        ${stat(fmtK(r.popZ1),               'gain &le;60-min access',       C_Z1)}
        ${stat(fmtK(r.popZ2),               'gain 60-120-min access',       C_Z2)}
        ${stat(fmtK(popReached),             'total population rescued',     C_ACCENT_PURPLE)}
        ${stat(`~${stemiYr.toLocaleString()}`, 'STEMI/yr gaining timely care', C_Z1)}
      </div>
    `)}

    ${section('Intervention Score Breakdown', `
      <div class="dossier-score-bars">
        ${scorePart('Pop coverage',    r.scoreParts.pop,   0.40, C_ACCENT_PURPLE)}
        ${scorePart('&le;60-min gain', r.scoreParts.z1,    0.30, C_Z1)}
        ${scorePart('Redundancy red.', r.scoreParts.red,   0.15, C_Z2)}
        ${scorePart('STEMI volume',    r.scoreParts.stemi, 0.15, C_ACCENT_ORANGE)}
      </div>
    `)}

    ${section('Affected Governorates (top 6)', `
      <div class="dossier-gov-list">
        ${govData.slice(0, 6).map(([gov, v]) => {
          const tot = v.popZ1 + v.popZ2;
          return `<div class="dossier-gov-item">
            <span class="dossier-gov-name">${gov}</span>
            <span class="dossier-gov-z1" style="color:${C_Z1}">${fmtK(v.popZ1)}</span>
            <span class="dossier-gov-z2" style="color:${C_Z2}">${fmtK(v.popZ2)}</span>
            <span class="dossier-gov-tot">${fmtK(tot)}</span>
          </div>`;
        }).join('')}
      </div>
    `)}

    ${section('System Impact Map', `
      <div id="dossier-impact-map" style="margin-top:6px"></div>
    `)}

    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;
}

// ── Private helpers ────────────────────────────────────────────────────────────
/**
 * Render a single stat card (value + label).
 * Used inside .dossier-stat-grid containers.
 *
 * @param {string} value   — formatted number string (already human-readable)
 * @param {string} label   — short descriptor text
 * @param {string} color   — accent hex colour for the value
 * @returns {string}
 */
function stat(value, label, color) {
  return `
    <div class="dossier-stat">
      <div class="dossier-stat-value" style="color:${color}">${value}</div>
      <div class="dossier-stat-label">${label}</div>
    </div>
  `;
}

/**
 * Render a zone bar row with label, % bar, and supplementary stats.
 */
function zoneBar(label, pct, pop, nbhd, color, stemi) {
  return `
    <div class="dossier-zone-row">
      <div class="dossier-zone-label">${label}</div>
      <div class="dossier-zone-track">
        <div class="dossier-zone-fill" style="width:${(pct * 100).toFixed(1)}%;background:${color}55;border-right:2px solid ${color}"></div>
      </div>
      <div class="dossier-zone-pct" style="color:${color}">${fmtPct(pct)}</div>
      <div class="dossier-zone-pop">${fmtK(pop)} · ${nbhd.toLocaleString()} haras</div>
      <div class="dossier-zone-stemi" style="color:${color === C_ZX ? C_ZX : 'var(--muted)'}">~${stemi.toLocaleString()} STEMI/yr</div>
    </div>
  `;
}

/**
 * Render a catchment zone bar row.
 */
function catchmentZoneBar(label, haras, totalHaras, pop, color) {
  const pct = totalHaras > 0 ? haras / totalHaras : 0;
  return `
    <div class="dossier-zone-row">
      <div class="dossier-zone-label">${label}</div>
      <div class="dossier-zone-track">
        <div class="dossier-zone-fill" style="width:${(pct * 100).toFixed(1)}%;background:${color}55;border-right:2px solid ${color}"></div>
      </div>
      <div class="dossier-zone-pct" style="color:${color}">${(pct * 100).toFixed(0)}%</div>
      <div class="dossier-zone-pop">${haras.toLocaleString()} haras · ${fmtK(pop)} pop</div>
    </div>
  `;
}

/**
 * Render a score component bar.
 */
function scorePart(label, normalized, weight, color) {
  const pct = (normalized * 100).toFixed(0);
  const contribution = Math.round(normalized * weight * 100);
  return `
    <div class="dossier-score-row">
      <div class="dossier-score-label">${label}</div>
      <div class="dossier-score-track">
        <div class="dossier-score-fill" style="width:${pct}%;background:${color}66;border-right:1px solid ${color}"></div>
      </div>
      <div class="dossier-score-pct" style="color:${color}">${pct}%</div>
      <div class="dossier-score-weight" style="color:var(--muted)">×${(weight * 100).toFixed(0)}%</div>
      <div class="dossier-score-contrib" style="color:${color}">+${contribution}</div>
    </div>
  `;
}
