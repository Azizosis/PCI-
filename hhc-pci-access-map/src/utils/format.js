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
 * Facility-based display labels for the top placement sites.
 * Keys are the canonical site.n strings from PLACEMENT_DATA.
 * Values are { primary, secondary } where:
 *   primary   — nearest hospital or facility name (executive label)
 *   secondary — locality / governorate (context line below)
 *
 * Sites not listed here fall back to siteShortName(site) as primary
 * with site.g (governorate) as secondary.
 */
const SITE_LABELS = {
  'Yanbu': {
    primary:   'King Fahd Hospital — Yanbu',
    secondary: 'Yanbu Al Bahr, Madinah Region',
  },
  'Cluster-2 (snap → Abo Hadeed farm)': {
    primary:   'King Saud Hospital — Dawadmi',
    secondary: 'Ad Duwadimi, Riyadh Region',
  },
  'Cluster-7 (snap → Station of Al Mafrij)': {
    primary:   'Wadi Ad Dawasir General Hospital',
    secondary: 'Wadi Ad Dawasir, Riyadh Region',
  },
  'Cluster-4 (snap → Qaswan)': {
    primary:   'Al Khafji General Hospital — Northern Eastern Province',
    secondary: 'Al Khafji / Qaryah Al Ulya, Eastern Province',
  },
  'Al Wadiah': {
    primary:   'Sharurah General Hospital',
    secondary: 'Al Wadiah / Sharurah, Najran Region',
  },
};

/**
 * Return { primary, secondary } display labels for a placement site.
 * Uses the curated SITE_LABELS map for top sites; falls back to the
 * algorithmic siteShortName() + governorate for all others.
 *
 * @param {{ n: string, g?: string }} site
 * @returns {{ primary: string, secondary: string }}
 */
export function siteDisplayLabel(site) {
  if (SITE_LABELS[site.n]) return SITE_LABELS[site.n];
  return {
    primary:   siteShortName(site),
    secondary: site.g || '',
  };
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
