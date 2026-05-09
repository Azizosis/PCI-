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
import { fragilitySeverity }        from '../engine/fragility.js';
import { getCatchmentForHospital }  from '../engine/catchments.js';
import {
  buildAffectedByGovernorate,
  facilityTypeText,
} from '../engine/placement-engine.js';
import { fmtK, fmtPct, siteShortName } from '../utils/format.js';
import { renderImpactMap }          from './impact-map-svg.js';
import { resetCamera }              from '../map/camera.js';

// ── Dossier DOM refs ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function getDossier()    { return $('dossier');         }
function getTitle()      { return $('dossier-title');   }
function getSubtitle()   { return $('dossier-subtitle');}
function getBody()       { return $('dossier-body');    }

function showDossier() {
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

// ── Region dossier ─────────────────────────────────────────────────────────────
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

  // Count haras and sum priority score for this region
  let totalPrioScore = 0;
  for (const f of geojson.features) {
    if (f.properties.Region === region.name) {
      totalPrioScore += f.properties.priority_score || 0;
    }
  }

  const fragSeverity = fragilitySeverity(zx.pct_pop, totalPrioScore);

  getTitle().textContent    = region.name;
  getSubtitle().textContent = `Administrative Region · ${total.nbhd.toLocaleString()} haras`;

  getBody().innerHTML = `
    <!-- Zone breakdown -->
    <div class="dossier-section">
      <div class="dossier-section-label">Access Zone Breakdown</div>
      <div class="dossier-zone-bars">
        ${zoneBar('Zone 1 ≤60 min',   z1.pct_pop, z1.pop, z1.nbhd, '#00e5b4', stemiZ1)}
        ${zoneBar('Zone 2 61-120 min', z2.pct_pop, z2.pop, z2.nbhd, '#d4a017', stemiZ2)}
        ${zoneBar('Zone X >120 min',   zx.pct_pop, zx.pop, zx.nbhd, '#e03e3e', stemiZx)}
      </div>
    </div>

    <!-- Burden summary -->
    <div class="dossier-section">
      <div class="dossier-section-label">Access Burden</div>
      <div class="dossier-stat-grid">
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#e03e3e">${fmtK(zx.pop)}</div>
          <div class="dossier-stat-label">people beyond 120 min</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#ff6b3e">${Math.round(totalPrioScore / 1000)}K</div>
          <div class="dossier-stat-label">person-hrs of burden</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#e03e3e">~${stemiZx.toLocaleString()}</div>
          <div class="dossier-stat-label">delayed STEMI/yr</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:${fragSeverity.color}">${fragSeverity.label}</div>
          <div class="dossier-stat-label">fragility severity</div>
        </div>
      </div>
    </div>

    <!-- Narrative -->
    <div class="dossier-section">
      <div class="dossier-section-label">System Dependency</div>
      <div class="dossier-narrative">
        ${zx.pct_pop >= 0.3
          ? `<strong style="color:#e03e3e">${fmtPct(zx.pct_pop)}</strong> of ${region.name}'s population
             (${fmtK(zx.pop)} people) live beyond 120-min drive time of any PCI-capable center.
             This cohort relies on <em>transfer chains</em> from ${capital}, with typical delays
             exceeding 3 hours — well beyond the 90-min door-to-balloon target.`
          : `<strong style="color:#00e5b4">${fmtPct(z1.pct_pop)}</strong> of ${region.name}'s population
             has optimal PCI access (&le;60 min). The remaining ${fmtPct(zx.pct_pop)} in Zone X
             — ${fmtK(zx.pop)} people — still depend on extended transfers.`
        }
      </div>
    </div>

    <!-- PCI hospitals -->
    ${region.hospitals && region.hospitals.length
      ? `<div class="dossier-section">
          <div class="dossier-section-label">PCI Centers Serving This Region</div>
          <div class="dossier-hosp-list">
            ${region.hospitals.map((h) => {
              const col = HOSPITAL_COLORS[h] || '#0077ff';
              return `<div class="dossier-hosp-item">
                <span class="dossier-hosp-dot" style="background:${col}"></span>
                <span class="dossier-hosp-name">${h}</span>
              </div>`;
            }).join('')}
          </div>
         </div>`
      : ''}

    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;

  showDossier();
}

// ── Catchment dossier ──────────────────────────────────────────────────────────
/**
 * Render and open the catchment dossier for a hospital.
 *
 * @param {string} hospName
 * @param {{ haras: number, pop: number }} basicStats  from the list panel click
 * @param {string} color
 * @param {GeoJSON.FeatureCollection} [geojson]
 */
export function openCatchmentDossier(hospName, basicStats, color, geojson) {
  const full = getCatchmentForHospital(geojson, hospName);
  const s    = full ?? { haras: basicStats.haras, pop: basicStats.pop, z1: { h: 0, p: 0 }, z2: { h: 0, p: 0 }, zx: { h: 0, p: 0 } };

  const stemiZx = Math.round((s.zx?.p ?? 0) * STEMI_RATE);

  getTitle().textContent    = hospName;
  getSubtitle().textContent = `PCI-capable center · ${s.haras.toLocaleString()} haras in catchment`;

  getBody().innerHTML = `
    <!-- Catchment zone breakdown -->
    <div class="dossier-section">
      <div class="dossier-section-label">Catchment Zone Breakdown</div>
      <div class="dossier-zone-bars">
        ${catchmentZoneBar('Zone 1 ≤60 min',    s.z1.h, s.haras, s.z1.p, '#00e5b4')}
        ${catchmentZoneBar('Zone 2 61-120 min',  s.z2.h, s.haras, s.z2.p, '#d4a017')}
        ${catchmentZoneBar('Zone X >120 min',    s.zx.h, s.haras, s.zx.p, '#e03e3e')}
      </div>
    </div>

    <!-- Key metrics -->
    <div class="dossier-section">
      <div class="dossier-section-label">Catchment Metrics</div>
      <div class="dossier-stat-grid">
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:${color}">${fmtK(s.pop)}</div>
          <div class="dossier-stat-label">total catchment pop</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#e03e3e">${fmtK(s.zx?.p ?? 0)}</div>
          <div class="dossier-stat-label">Zone X population</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#e03e3e">~${stemiZx.toLocaleString()}</div>
          <div class="dossier-stat-label">delayed STEMI/yr</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:${color}">${s.z1.h.toLocaleString()}</div>
          <div class="dossier-stat-label">haras in 60-min zone</div>
        </div>
      </div>
    </div>

    <!-- Narrative -->
    <div class="dossier-section">
      <div class="dossier-section-label">Coverage Narrative</div>
      <div class="dossier-narrative">
        ${hospName} serves <strong>${s.haras.toLocaleString()} haras</strong>
        with a total catchment population of <strong>${fmtK(s.pop)}</strong>.
        ${s.zx.h > 0
          ? `However, <strong style="color:#e03e3e">${s.zx.h.toLocaleString()} haras</strong>
             (${fmtK(s.zx.p)} people) fall in Zone X — over 120 min drive-time —
             indicating a structural access gap that cannot be resolved by optimizing
             existing routing alone.`
          : `All catchment haras fall within 120 minutes, representing strong spatial coverage.`
        }
      </div>
    </div>

    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;

  showDossier();
}

// ── Placement site dossier ─────────────────────────────────────────────────────
/**
 * Render and open the dossier for a proposed placement site.
 * Governorate lookup uses HARA_INDEX internally — no GeoJSON needed here.
 *
 * @param {import('../engine/placement-engine.js').PlacementResult} result
 * @param {number} siteIndex  0-indexed rank in result.ranking
 */
export function openSiteDossier(result, siteIndex) {
  const r    = result.ranking[siteIndex];
  const cls  = r.classification;
  const site = r.site;
  const name = siteShortName(site);

  const popReached = r.popZ1 + r.popZ2;
  const stemiYr    = Math.round(popReached * STEMI_RATE);
  const govData    = buildAffectedByGovernorate(siteIndex, result);
  const typeText   = facilityTypeText(cls);

  getTitle().textContent    = name;
  getSubtitle().textContent = typeText;

  getBody().innerHTML = `
    <!-- Classification badge -->
    <div class="dossier-section">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:5px;background:${cls.color}18;border:1px solid ${cls.color}55">
        <span style="width:8px;height:8px;border-radius:50%;background:${cls.color}"></span>
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:${cls.color};letter-spacing:0.1em">${cls.label}</span>
        <span style="font-size:9px;color:var(--muted)">inv. score ${r.invScore}/100</span>
      </div>
    </div>

    <!-- Population impact -->
    <div class="dossier-section">
      <div class="dossier-section-label">Population Impact</div>
      <div class="dossier-stat-grid">
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#00e5b4">${fmtK(r.popZ1)}</div>
          <div class="dossier-stat-label">gain ≤60-min access</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#d4a017">${fmtK(r.popZ2)}</div>
          <div class="dossier-stat-label">gain 60-120-min access</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#9d4edd">${fmtK(popReached)}</div>
          <div class="dossier-stat-label">total population rescued</div>
        </div>
        <div class="dossier-stat">
          <div class="dossier-stat-value" style="color:#00e5b4">~${stemiYr.toLocaleString()}</div>
          <div class="dossier-stat-label">STEMI/yr gaining timely care</div>
        </div>
      </div>
    </div>

    <!-- Score breakdown -->
    <div class="dossier-section">
      <div class="dossier-section-label">Intervention Score Breakdown</div>
      <div class="dossier-score-bars">
        ${scorePart('Pop coverage',   r.scoreParts.pop,   0.40, '#9d4edd')}
        ${scorePart('≤60-min gain',   r.scoreParts.z1,    0.30, '#00e5b4')}
        ${scorePart('Redundancy red.',r.scoreParts.red,   0.15, '#d4a017')}
        ${scorePart('STEMI volume',   r.scoreParts.stemi, 0.15, '#ff8c42')}
      </div>
    </div>

    <!-- Affected governorates -->
    <div class="dossier-section">
      <div class="dossier-section-label">Affected Governorates (top 6)</div>
      <div class="dossier-gov-list">
        ${govData.slice(0, 6).map(([gov, v]) => {
          const tot = v.popZ1 + v.popZ2;
          return `<div class="dossier-gov-item">
            <span class="dossier-gov-name">${gov}</span>
            <span class="dossier-gov-z1" style="color:#00e5b4">${fmtK(v.popZ1)}</span>
            <span class="dossier-gov-z2" style="color:#d4a017">${fmtK(v.popZ2)}</span>
            <span class="dossier-gov-tot">${fmtK(tot)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- System impact map -->
    <div class="dossier-section">
      <div class="dossier-section-label">System Impact Map</div>
      <div id="dossier-impact-map" style="margin-top:6px"></div>
    </div>

    <div class="dossier-assumption">${STEMI_NOTE}</div>
  `;

  // Render the SVG impact map after innerHTML is set
  renderImpactMap(
    '#dossier-impact-map',
    govData,
    { n: site.n, lat: site.lat, lng: site.lng },
  );

  showDossier();
}

// ── Private helpers ────────────────────────────────────────────────────────────
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
      <div class="dossier-zone-stemi" style="color:${color === '#e03e3e' ? '#e03e3e' : 'var(--muted)'}">~${stemi.toLocaleString()} STEMI/yr</div>
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
