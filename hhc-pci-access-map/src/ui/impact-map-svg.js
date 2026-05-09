/**
 * impact-map-svg.js — System Impact SVG map renderer
 *
 * Renders a miniature proportional-symbol map showing which KSA governorates
 * benefit from a proposed placement site.  Each governorate is represented as
 * a circle whose radius is proportional to sqrt(population rescued), surrounded
 * by a label deconfliction pass to avoid overlaps.
 *
 * Design notes:
 *  - Uses an equirectangular projection clipped to KSA bounds.
 *  - Four label-placement passes: right, left, above, below.
 *  - Leader lines drawn when a label is offset > 14px from its anchor.
 *  - Assumes KSA lat/lng bounds: lat 16–33, lng 34–56 (approx).
 *
 * DEPENDENCY: buildAffectedByGovernorate() must be called externally and
 *             the result passed in as `govData`.
 */

/** Approximate KSA bounding box used for the equirectangular projection. */
const BOUNDS = { minLat: 15.5, maxLat: 33.5, minLng: 34.5, maxLng: 56.5 };

/**
 * Reference lat/lng centroids per governorate for placement.
 * Partial list covering major governorates — unmapped fall back to a grid.
 * @type {Record<string, [number, number]>}
 */
const GOV_CENTERS = {
  'Riyadh':           [24.69, 46.72],
  'Jeddah':           [21.49, 39.19],
  'Makkah':           [21.42, 39.83],
  'Madinah':          [24.47, 39.61],
  'Al Ahsa':          [25.38, 49.58],
  'Dammam':           [26.43, 50.10],
  'Tabuk':            [28.38, 36.57],
  'Hail':             [27.51, 41.69],
  'Najran':           [17.49, 44.13],
  'Jizan':            [16.89, 42.55],
  'Jizan City':       [16.89, 42.55],
  'Abha':             [18.22, 42.50],
  'Khamis Mushait':   [18.30, 42.73],
  'Buraydah':         [26.33, 43.97],
  'Al Quwaiiyah':     [24.07, 45.27],
  'Wadi Al Dawasir':  [20.51, 45.13],
  'Al Kharj':         [24.16, 47.30],
  'Hafar Al Batin':   [28.43, 45.96],
  'Arar':             [30.97, 41.02],
  'Sakaka':           [29.97, 40.21],
  'Guraiат':          [31.02, 37.35],
  'Yanbu':            [24.09, 38.06],
  'Al Ula':           [26.62, 37.92],
  'Baha':             [20.01, 41.47],
  'Bisha':            [20.00, 42.60],
  'Dhahran':          [26.29, 50.15],
  'Khobar':           [26.28, 50.21],
  'Jubail':           [27.01, 49.66],
  'Khafji':           [28.42, 48.49],
  'Taif':             [21.43, 40.52],
};

/**
 * Equirectangular projection of (lat, lng) into SVG pixel coordinates.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} W  SVG width
 * @param {number} H  SVG height
 * @param {number} pad  padding in pixels
 * @returns {[number, number]}
 */
function project(lat, lng, W, H, pad = 10) {
  const { minLat, maxLat, minLng, maxLng } = BOUNDS;
  const x = pad + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * pad);
  const y = pad + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * pad);
  return [x, y];
}

/**
 * Four candidate label anchor points relative to a circle center.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} r  circle radius
 * @returns {Array<{ x: number, y: number, anchor: string }>}
 */
function candidatePositions(cx, cy, r) {
  const gap = r + 4;
  return [
    { x: cx + gap,  y: cy,       anchor: 'start'  },   // right
    { x: cx - gap,  y: cy,       anchor: 'end'    },   // left
    { x: cx,        y: cy - gap, anchor: 'middle' },   // above
    { x: cx,        y: cy + gap, anchor: 'middle' },   // below
  ];
}

/**
 * Approximate bounding box for a label.
 *
 * @param {{ x: number, y: number, anchor: string }} pos
 * @param {string} text
 * @returns {{ x1: number, y1: number, x2: number, y2: number }}
 */
function labelBBox(pos, text) {
  const charW = 5.5, lineH = 9;
  const w = text.length * charW;
  const { x, y, anchor } = pos;
  let x1;
  if (anchor === 'start')  x1 = x;
  else if (anchor === 'end') x1 = x - w;
  else x1 = x - w / 2;
  return { x1, y1: y - lineH, x2: x1 + w, y2: y + 2 };
}

/**
 * Return true if two bounding boxes overlap.
 *
 * @param {{ x1: number, y1: number, x2: number, y2: number }} a
 * @param {{ x1: number, y1: number, x2: number, y2: number }} b
 * @returns {boolean}
 */
function bboxOverlap(a, b) {
  return !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
}

/**
 * Render the system impact SVG into the given container element.
 *
 * @param {string | HTMLElement} container  — CSS selector string or DOM element
 * @param {Array<[string, { haras: number, popZ1: number, popZ2: number }]>} govData
 *   Sorted descending by total rescued population (from buildAffectedByGovernorate()).
 * @param {{ n: string, lat: number, lng: number }} site
 *   The proposed site being visualised.
 * @param {{ minPopThreshold?: number, maxBubbles?: number }} [opts]
 * @returns {void}
 */
export function renderImpactMap(container, govData, site, opts = {}) {
  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  if (!el) return;

  const { minPopThreshold = 1000, maxBubbles = 18 } = opts;
  const W = 340, H = 190;

  // Filter and cap entries
  const entries = govData
    .filter(([name, v]) => name !== '—' && (v.popZ1 + v.popZ2) >= minPopThreshold)
    .slice(0, maxBubbles);

  if (entries.length === 0) {
    el.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:8px">No governorate data available.</div>';
    return;
  }

  const maxPop = Math.max(1, ...entries.map(([, v]) => v.popZ1 + v.popZ2));
  const MAX_R  = 22, MIN_R = 4;

  // Build bubble data with projected coordinates
  const bubbles = entries.map(([name, v], idx) => {
    const total = v.popZ1 + v.popZ2;
    const r     = MIN_R + (MAX_R - MIN_R) * Math.sqrt(total / maxPop);
    const center = GOV_CENTERS[name];
    let cx, cy;
    if (center) {
      [cx, cy] = project(center[0], center[1], W, H);
    } else {
      // Grid fallback for unmapped governorates
      const col = idx % 4, row = Math.floor(idx / 4);
      cx = 20 + col * 80;
      cy = 155 + row * 18;
    }
    const color = v.popZ1 > v.popZ2 ? '#00e5b4' : '#d4a017';
    return { name, total, r, cx, cy, color, popZ1: v.popZ1, popZ2: v.popZ2 };
  });

  // Site marker
  const [siteCx, siteCy] = project(site.lat, site.lng, W, H);

  // Label deconfliction
  const placed = [];  // { bbox, cx, cy, r } for overlap checks

  const labelEls = bubbles.map((b) => {
    const candidates = candidatePositions(b.cx, b.cy, b.r);
    let chosen = null;

    for (const cand of candidates) {
      const bbox = labelBBox(cand, b.name);
      const overlaps =
        placed.some((p) => bboxOverlap(bbox, p.bbox)) ||
        bbox.x1 < 0 || bbox.x2 > W || bbox.y1 < 0 || bbox.y2 > H;
      if (!overlaps) { chosen = { ...cand, bbox }; break; }
    }
    // Fallback: use right position even if overlapping
    if (!chosen) {
      const fb = candidates[0];
      chosen = { ...fb, bbox: labelBBox(fb, b.name) };
    }

    placed.push({ bbox: chosen.bbox, cx: b.cx, cy: b.cy, r: b.r });

    const dx = chosen.x - b.cx, dy = chosen.y - b.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const leaderLine = dist > 14
      ? `<line x1="${b.cx.toFixed(1)}" y1="${b.cy.toFixed(1)}" x2="${chosen.x.toFixed(1)}" y2="${chosen.y.toFixed(1)}" stroke="#2a4050" stroke-width="0.7"/>`
      : '';

    return { bubble: b, label: chosen, leaderLine };
  });

  // Build SVG
  const siteEl = `
    <circle cx="${siteCx.toFixed(1)}" cy="${siteCy.toFixed(1)}" r="6" fill="#9d4edd" stroke="#fff" stroke-width="1.5" opacity="0.95"/>
    <circle cx="${siteCx.toFixed(1)}" cy="${siteCy.toFixed(1)}" r="11" fill="none" stroke="#9d4edd" stroke-width="0.8" opacity="0.4"/>
    <text x="${(siteCx + 9).toFixed(1)}" y="${(siteCy + 3).toFixed(1)}" font-size="7" fill="#9d4edd" font-family="'Space Mono',monospace">SITE</text>
  `;

  const bubblesEl = labelEls.map(({ bubble: b, label, leaderLine }) => `
    ${leaderLine}
    <circle cx="${b.cx.toFixed(1)}" cy="${b.cy.toFixed(1)}" r="${b.r.toFixed(1)}" fill="${b.color}" opacity="0.25"/>
    <circle cx="${b.cx.toFixed(1)}" cy="${b.cy.toFixed(1)}" r="${b.r.toFixed(1)}" fill="none" stroke="${b.color}" stroke-width="1"/>
    <text
      x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}"
      text-anchor="${label.anchor}"
      font-size="7" fill="#c8d8e4"
      font-family="'Space Mono',monospace"
      paint-order="stroke"
      stroke="#0a111a" stroke-width="2.5"
    >${b.name}</text>
  `).join('');

  // Legend
  const legendEl = `
    <g transform="translate(4,${H - 22})">
      <circle cx="5" cy="5" r="5" fill="#00e5b4" opacity="0.4"/>
      <circle cx="5" cy="5" r="5" fill="none" stroke="#00e5b4" stroke-width="0.8"/>
      <text x="13" y="9" font-size="7" fill="#6a8090" font-family="'Space Mono',monospace">60-min gain</text>
      <circle cx="70" cy="5" r="5" fill="#d4a017" opacity="0.4"/>
      <circle cx="70" cy="5" r="5" fill="none" stroke="#d4a017" stroke-width="0.8"/>
      <text x="78" y="9" font-size="7" fill="#6a8090" font-family="'Space Mono',monospace">60-120-min gain</text>
    </g>
  `;

  el.innerHTML = `
    <svg
      width="${W}" height="${H}"
      viewBox="0 0 ${W} ${H}"
      style="display:block;background:#0a111a;border-radius:4px"
      aria-label="System impact map showing affected governorates"
      role="img"
    >
      ${bubblesEl}
      ${siteEl}
      ${legendEl}
    </svg>
  `;
}
