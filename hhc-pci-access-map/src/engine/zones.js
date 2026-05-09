/**
 * zones.js — Zone 1 colour scale and Zone X alert thresholds
 */

/**
 * Colour for a region's Zone 1 population share.
 * Used by the list badge and the dossier badge background.
 *
 * @param {number} pct_pop  Fraction of population in Zone 1 (0..1)
 * @returns {string} hex color
 */
export function z1Color(pct_pop) {
  if (pct_pop >= 0.70) return '#00e5b4';
  if (pct_pop >= 0.50) return '#4caf7d';
  if (pct_pop >= 0.30) return '#d4a017';
  if (pct_pop >= 0.15) return '#e06030';
  return '#e03e3e';
}

/**
 * Generate a Zone X alert message for a region, or null if not critical.
 *
 * @param {{ zx: { pct_pop: number, pop: number, nbhd: number, avg: number } }} region
 * @returns {string | null}
 */
export function zxAlert(region) {
  const { pct_pop, pop, nbhd, avg } = region.zx;
  if (pct_pop >= 0.50) {
    return `Zone X covers ${(pct_pop * 100).toFixed(1)}% of population (${pop.toLocaleString()} people). Avg unreachable drive: ${avg} min. Critical PCI service gap.`;
  }
  if (pct_pop >= 0.35) {
    return `${(pct_pop * 100).toFixed(1)}% of population in Zone X. ${nbhd} neighborhoods beyond 120-min drive.`;
  }
  return null;
}
