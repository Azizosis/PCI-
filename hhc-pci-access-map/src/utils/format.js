/**
 * format.js — display formatting utilities
 *
 * All functions are pure and return strings suitable for direct insertion
 * into HTML or text nodes.
 */

/**
 * Format a population value as compact thousands (e.g. 45000 → "45K", 1300 → "1.3K").
 * Values below 1000 are returned as plain integers.
 *
 * @param {number} value
 * @returns {string}
 */
export function fmtK(value) {
  if (value < 1000) return String(Math.round(value));
  return (value / 1000).toFixed(value < 10000 ? 1 : 0) + 'K';
}

/**
 * Format a population value as millions (e.g. 1300000 → "1.30M").
 *
 * @param {number} value
 * @returns {string}
 */
export function fmtM(value) {
  return (value / 1_000_000).toFixed(2) + 'M';
}

/**
 * Format a decimal fraction as a percentage string (e.g. 0.724 → "72.4%").
 *
 * @param {number} fraction
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function fmtPct(fraction, decimals = 1) {
  return (fraction * 100).toFixed(decimals) + '%';
}

/**
 * Produce a short name for a placement site.
 * Cluster snap sites are rendered with a leading bullet marker.
 *   "Cluster-7 (snap → Yanbu)" → "* Yanbu"
 * City sites are returned as-is.
 *
 * @param {{ n: string }} site
 * @returns {string}
 */
export function siteShortName(site) {
  return site.n.replace(/^Cluster-\d+ \(snap → /, '* ').replace(/\)$/, '');
}

/**
 * Build a short hospital name suitable for compact list display.
 *
 * @param {string} fullName
 * @returns {string}
 */
export function shortHospName(fullName) {
  return fullName
    .replace('King ', 'K. ')
    .replace('Prince ', 'Pr. ')
    .replace('Cardiac Center', 'CC')
    .replace('Hospital', 'Hosp.')
    .replace('Specialist', 'Spec.');
}
