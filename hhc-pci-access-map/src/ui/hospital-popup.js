/**
 * hospital-popup.js — HTML builder for the PCI hospital hover popup
 *
 * Deliberately decoupled from MapLibre so it can be unit-tested
 * or reused in a tooltip context without a map instance.
 */

import { HOSPITAL_COLORS } from '../data/data-index.js';

/**
 * Build the inner HTML for a hospital hover popup.
 *
 * @param {string} name        — hospital full name
 * @param {{ haras: number, pop: number } | null} catchStats
 *   Optional catchment stats (haras count + total pop).  Pass null to omit.
 * @returns {string}  innerHTML string for a maplibregl.Popup
 */
export function buildHospitalPopupHTML(name, catchStats = null) {
  const col = HOSPITAL_COLORS[name] || '#0077ff';

  const statsRow = catchStats
    ? `<div style="margin-top:5px;display:flex;gap:12px;font-size:9px;font-family:'Space Mono',monospace">
         <span style="color:${col}">${catchStats.haras.toLocaleString()} haras</span>
         <span style="color:#6a8090">${(catchStats.pop / 1000).toFixed(0)}K pop</span>
       </div>`
    : '';

  return `
    <div style="min-width:160px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="1" y="1" width="8" height="8" rx="2" fill="${col}" opacity="0.9"/>
          <path d="M5 2.5v5M2.5 5h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:0.12em;color:${col}">PCI CENTER</span>
      </div>
      <div style="color:#fff;font-size:11px;line-height:1.35">${name}</div>
      ${statsRow}
    </div>
  `;
}
