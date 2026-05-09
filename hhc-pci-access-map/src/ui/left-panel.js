/**
 * left-panel.js — cluster list rendering for all four view modes
 *
 * Each `build*List()` function populates `#cluster-list` and sets
 * `#list-label`.  They are called from state.js whenever the view mode
 * or placement result changes.
 */

import { REGIONS, HOSPITAL_COLORS, PLACEMENT_DATA } from '../data/data-index.js';
import { z1Color } from '../engine/zones.js';
import { siteShortName, shortHospName, fmtK } from '../utils/format.js';
import { STEMI_RATE, STEMI_NOTE } from '../engine/assumptions.js';

// ── Zone mode ──────────────────────────────────────────────────────────────────
/**
 * @param {(regionId: string) => void} onRegionClick
 */
export function buildZoneList(onRegionClick) {
  setLabel('Regions — % Pop in Zone 1');
  const sorted = [...REGIONS].sort((a, b) => b.z1.pct_pop - a.z1.pct_pop);
  const list   = getList(); list.innerHTML = '';

  sorted.forEach((r) => {
    const col = z1Color(r.z1.pct_pop);
    const div = makeItem(`ci-${r.id}`);
    div.innerHTML = `
      <div class="cluster-badge" style="background:${col}20;color:${col}">${(r.z1.pct_pop * 100).toFixed(0)}%</div>
      <span class="cluster-name">${r.name}</span>
      ${r.zx.pct_pop >= 0.35 ? `<span style="color:var(--zx);font-size:10px" aria-label="Critical Zone X">!</span>` : ''}
      <span class="cluster-stat" style="color:${r.zx.pct_pop >= 0.35 ? 'var(--zx)' : 'var(--muted)'}">ZX:${(r.zx.pct_pop * 100).toFixed(0)}%</span>
    `;
    div.addEventListener('click', () => onRegionClick(r.id));
    list.appendChild(div);
  });
}

// ── Catchment mode ─────────────────────────────────────────────────────────────
/**
 * @param {GeoJSON.FeatureCollection} geojson  — working copy from state.js
 * @param {(name: string, stats: object, col: string) => void} onHospClick
 */
export function buildCatchmentList(geojson, onHospClick) {
  setLabel('Hospitals — Catchment Size');
  const stats = {};
  // Iterate the working copy, not the raw import, so annotations are visible
  for (const f of geojson.features) {
    const h = f.properties.Nearest_Hospital || '—';
    if (!stats[h]) stats[h] = { haras: 0, pop: 0 };
    stats[h].haras++;
    stats[h].pop += (f.properties.POPULATION || 0);
  }

  const sorted = Object.entries(stats).sort((a, b) => b[1].pop - a[1].pop);
  const list   = getList(); list.innerHTML = '';

  sorted.forEach(([hosp, s]) => {
    const col  = HOSPITAL_COLORS[hosp] || '#888';
    const div  = makeItem();
    div.innerHTML = `
      <div style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></div>
      <span class="cluster-name" title="${hosp}">${shortHospName(hosp)}</span>
      <span class="cluster-stat" style="color:var(--muted)">${(s.pop / 1000).toFixed(0)}K</span>
    `;
    div.addEventListener('click', () => onHospClick(hosp, s, col));
    list.appendChild(div);
  });
}

// ── Priority mode ──────────────────────────────────────────────────────────────
/**
 * @param {GeoJSON.FeatureCollection} geojson  — working copy from state.js
 * @param {(regionId: string) => void} onRegionClick
 */
export function buildPriorityList(geojson, onRegionClick) {
  setLabel('Regions — Person-Hours of Access Burden');
  const regionScores = {};
  // Use the working copy so priority_score annotations from computePriority() are present
  for (const f of geojson.features) {
    const r = f.properties.Region || '—';
    regionScores[r] = (regionScores[r] || 0) + (f.properties.priority_score || 0);
  }

  const ranked = REGIONS.map((r) => ({ ...r, prio: regionScores[r.name] || 0 }))
                        .sort((a, b) => b.prio - a.prio);
  const max  = Math.max(1, ranked[0].prio);
  const list = getList(); list.innerHTML = '';

  ranked.forEach((r) => {
    const pct = r.prio / max;
    const col = pct >= 0.7 ? '#ff1e3c' : pct >= 0.4 ? '#ff6b3e' : pct >= 0.18 ? '#d4a017' : '#3a5a90';
    const kHrs = (r.prio / 1000).toFixed(r.prio >= 100_000 ? 0 : 1);
    const div  = makeItem(`ci-${r.id}`);
    div.innerHTML = `
      <div class="cluster-badge" style="background:${col}22;color:${col}">${kHrs}K</div>
      <span class="cluster-name">${r.name}</span>
      <span class="cluster-stat" style="color:${col}">person-hrs</span>
    `;
    div.addEventListener('click', () => onRegionClick(r.id));
    list.appendChild(div);
  });
}

// ── Placement mode ─────────────────────────────────────────────────────────────
/**
 * @param {import('../engine/placement-engine.js').PlacementResult} result
 * @param {(siteIdx: number) => void} onSiteClick
 */
export function buildPlacementList(result, onSiteClick) {
  setLabel('Recommended PCI Sites — Pop Gaining Timely Access');
  const ranking  = result.ranking;
  const list     = getList(); list.innerHTML = '';

  const totalPop    = ranking.reduce((s, r) => s + r.popZ1 + r.popZ2, 0);
  const totalHaras  = ranking.reduce((s, r) => s + r.harasCount, 0);
  const pctCovered  = (100 * totalPop / PLACEMENT_DATA.meta.total_zx_pop).toFixed(1);
  const r1          = ranking[0];
  const r1Total     = r1 ? (r1.popZ1 + r1.popZ2) : 0;
  const r5          = ranking.slice(0, 5).reduce((s, r) => s + r.popZ1 + r.popZ2, 0);
  const r1Name      = r1 ? siteShortName(r1.site) : '';

  const totalZxPop         = PLACEMENT_DATA.meta.total_zx_pop;
  const delayedSTEMI       = Math.round(totalZxPop * STEMI_RATE);
  const rescuedSTEMI       = Math.round(totalPop   * STEMI_RATE);
  const remainingDelayed   = delayedSTEMI - rescuedSTEMI;

  const summary = document.createElement('div');
  summary.style.cssText = 'padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(157,78,221,0.04)';
  summary.innerHTML = `
    <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:0.15em;color:#9d4edd;margin-bottom:8px">PLACEMENT SUMMARY</div>
    <div style="font-size:11px;line-height:1.45;color:var(--text);margin-bottom:10px">
      <span style="color:#9d4edd;font-weight:500">${r1Name}</span> is the strongest first placement —
      improves PCI access for <span style="color:#fff">${fmtK(r1Total)} people</span>,
      including <span style="color:#00e5b4">${fmtK(r1?.popZ1 ?? 0)}</span>
      who move into <span style="color:#00e5b4">60-min access</span>.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
      <div><div style="color:var(--muted);font-size:9px">If 1 site is built</div><div style="color:#fff;font-family:'Space Mono',monospace">${fmtK(r1Total)} gain access</div></div>
      <div><div style="color:var(--muted);font-size:9px">If 5 sites are built</div><div style="color:#fff;font-family:'Space Mono',monospace">${fmtK(r5)} gain access</div></div>
      <div><div style="color:var(--muted);font-size:9px">All 10 sites combined</div><div style="color:#9d4edd;font-family:'Space Mono',monospace">${fmtK(totalPop)} · ${totalHaras.toLocaleString()} haras</div></div>
      <div><div style="color:var(--muted);font-size:9px">Of total Zone X pop</div><div style="color:#9d4edd;font-family:'Space Mono',monospace">${pctCovered}% reached</div></div>
    </div>
    <div id="placement-curve" style="margin-top:10px"></div>
    <div style="margin-top:12px;padding:11px 12px;border-radius:6px;background:rgba(224,62,62,0.1);border:1px solid rgba(224,62,62,0.4)">
      <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:0.18em;color:#ff5566;margin-bottom:5px;font-weight:700">DO-NOTHING COMPARATOR</div>
      <div style="font-size:10px;color:var(--text);line-height:1.55">
        Without any new sites: <span style="color:#ff5566;font-family:'Space Mono',monospace;font-weight:700">~${delayedSTEMI.toLocaleString()}</span> STEMI cases/yr in Zone X.<br>
        After top 10 are built: <span style="color:#00e5b4;font-family:'Space Mono',monospace;font-weight:700">~${rescuedSTEMI.toLocaleString()}</span> reach timely care;
        <span style="color:#ff6b3e;font-family:'Space Mono',monospace;font-weight:700">~${remainingDelayed.toLocaleString()}</span> still delayed.
      </div>
      <div style="font-size:8px;color:var(--muted);margin-top:5px;line-height:1.4;font-style:italic;opacity:0.7">${STEMI_NOTE}</div>
    </div>
  `;
  list.appendChild(summary);

  ranking.forEach((r, i) => {
    const div       = makeItem(`site-${i}`, 'cluster-item placement');
    const z1k       = fmtK(r.popZ1);
    const z2k       = fmtK(r.popZ2);
    const cleanName = siteShortName(r.site);
    const cls       = r.classification;
    const score     = r.invScore || 0;
    div.innerHTML = `
      <div class="cluster-badge" style="background:#9d4edd22;color:#9d4edd;font-size:10px">${i + 1}</div>
      <span class="cluster-name" title="${r.site.n} — ${cls.label}">
        <div style="font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cleanName}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:1px">
          <span style="font-size:8px;font-family:'Space Mono',monospace;color:${cls.color};background:${cls.color}22;padding:1px 5px;border-radius:2px;letter-spacing:0.05em">${cls.label}</span>
          <span style="font-size:8px;color:var(--muted);font-family:'Space Mono',monospace">${score}/100</span>
        </div>
      </span>
      <div style="text-align:right;font-family:'Space Mono',monospace;font-size:9px;flex-shrink:0">
        <div style="color:#00e5b4" title="Population gaining 60-min access">+${z1k} 60min</div>
        <div style="color:#d4a017" title="Population gaining 60-120-min access">+${z2k} 60-120min</div>
      </div>
    `;
    div.addEventListener('click', () => onSiteClick(i));
    list.appendChild(div);
  });
}

// ── Placement site marker management ─────────────────────────────────────────────
/**
 * Create and add numbered placement markers to the map.
 *
 * @param {maplibregl.Map} map
 * @param {import('../engine/placement-engine.js').PlacementResult} result
 * @param {(i: number) => void} onMarkerClick
 * @returns {maplibregl.Marker[]}
 */
export function showPlacementMarkers(map, result, onMarkerClick) {
  return result.ranking.map((r, i) => {
    const sz = Math.max(20, 32 - i * 1.2);
    const el = document.createElement('div');

    // Base styles — no transform set here; refreshPlacementMarkers owns transform/opacity.
    // will-change:transform keeps the element on its own compositing layer so
    // MapLibre canvas repaints never cause it to flicker or disappear.
    el.style.cssText = [
      `width:${sz}px`,
      `height:${sz}px`,
      'border-radius:50%',
      'background:#9d4edd',
      'color:#fff',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      `font-family:'Space Mono',monospace`,
      `font-size:${i < 3 ? 12 : 10}px`,
      'font-weight:700',
      'border:2px solid #fff',
      'box-shadow:0 0 14px rgba(157,78,221,0.55)',
      'cursor:pointer',
      'transition:transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
      'pointer-events:auto',
      'will-change:transform',
    ].join(';');
    el.textContent = String(i + 1);
    el.title = `#${i + 1} ${r.site.n} — rescues ${fmtK(r.popZ1 + r.popZ2)}`;

    // Hover: only add a brighter outline and slight scale.
    // We read data-state (set exclusively by refreshPlacementMarkers) to decide
    // which base style to return to on mouseleave — never mutate source data.
    el.addEventListener('mouseenter', () => {
      el.style.borderColor = '#00e5b4';
      if (el.dataset.state !== 'selected') {
        el.style.transform = 'scale(1.18)';
      }
    });

    el.addEventListener('mouseleave', () => {
      // Restore the exact style refreshPlacementMarkers last set
      switch (el.dataset.state) {
        case 'selected':
          el.style.transform   = 'scale(1.25)';
          el.style.borderColor = '#00e5b4';
          break;
        case 'dimmed':
          el.style.transform   = 'scale(0.85)';
          el.style.borderColor = '#fff';
          break;
        default: // 'idle'
          el.style.transform   = 'scale(1)';
          el.style.borderColor = '#fff';
          break;
      }
    });

    el.addEventListener('click', (evt) => {
      evt.stopPropagation();
      onMarkerClick(i);
    });

    return new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([r.site.lng, r.site.lat])
      .addTo(map);
  });
}

/**
 * Refresh marker visual state based on which site (if any) is focused.
 *
 * @param {maplibregl.Marker[]} markers
 * @param {number} selectedSite  -1 = none selected
 */
export function refreshPlacementMarkers(markers, selectedSite) {
  markers.forEach((m, i) => {
    const el = m.getElement();

    if (selectedSite < 0) {
      el.dataset.state     = 'idle';
      el.style.opacity     = '1';
      el.style.transform   = 'scale(1)';
      el.style.boxShadow   = '0 0 14px rgba(157,78,221,0.55)';
      el.style.borderColor = '#fff';
    } else if (selectedSite === i) {
      el.dataset.state     = 'selected';
      el.style.opacity     = '1';
      el.style.transform   = 'scale(1.25)';
      el.style.boxShadow   = '0 0 28px rgba(157,78,221,0.95), 0 0 8px #00e5b4';
      el.style.borderColor = '#00e5b4';
    } else {
      el.dataset.state     = 'dimmed';
      el.style.opacity     = '0.45';
      el.style.transform   = 'scale(0.85)';
      el.style.boxShadow   = 'none';
      el.style.borderColor = '#fff';
    }
  });
}

// ── Marginal coverage curve ────────────────────────────────────────────────────
/**
 * Render marginal + cumulative curve SVG into #placement-curve.
 *
 * @param {import('../engine/placement-engine.js').RankedSite[]} ranking
 */
export function renderMarginalCurve(ranking) {
  const target = document.getElementById('placement-curve');
  if (!target) return;

  const W = 240, H = 46, padX = 4, padY = 4;
  const innerW = W - 2 * padX, innerH = H - 2 * padY;
  const marg   = ranking.map((r) => r.popZ1 + r.popZ2);
  const cum    = []; let s = 0;
  for (const m of marg) { s += m; cum.push(s); }
  const yMax = Math.max(1, ...cum);
  const N    = ranking.length;
  const barW = Math.max(2, innerW / N - 2);
  const xFor = (i) => padX + (innerW * (i + 0.5) / N);
  const yFor = (v) => H - padY - (v / yMax) * innerH;

  const bars = marg.map((m, i) => {
    const h = Math.max(1, (m / yMax) * innerH);
    const x = xFor(i) - barW / 2;
    return `<rect x="${x.toFixed(1)}" y="${(H - padY - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="#9d4edd" opacity="0.35"/>`;
  }).join('');

  const path = cum.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  const pts  = cum.map((v, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="2" fill="#9d4edd"/>`).join('');

  target.innerHTML = `
    <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:0.15em;color:var(--muted);margin-bottom:3px">MARGINAL / CUMULATIVE</div>
    <svg width="${W}" height="${H}" style="display:block;background:rgba(0,0,0,0.2);border-radius:3px">
      ${bars}
      <path d="${path}" stroke="#9d4edd" stroke-width="1.5" fill="none"/>
      ${pts}
    </svg>
    <div style="display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:8px;color:var(--muted);margin-top:2px">
      <span>1</span><span>5</span><span>${N}</span>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getList() { return document.getElementById('cluster-list'); }
function setLabel(text) {
  const el = document.getElementById('list-label');
  if (el) el.textContent = text;
}
function makeItem(id, className = 'cluster-item') {
  const div = document.createElement('div');
  div.className = className;
  if (id) div.id = id;
  return div;
}
