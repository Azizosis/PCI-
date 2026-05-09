/**
 * styles.js — MapLibre paint expression factories
 *
 * All colour values are resolved from CSS design tokens via getComputedStyle.
 * This gives us a single source of truth: tokens.css owns every colour value;
 * this file only references them by name.  The snapshot is taken once at
 * module load — not on every render — so there is no per-frame overhead.
 */

import { CATCHMENT_MATCH } from '../data/data-index.js';

/** Read a CSS custom property from :root as a trimmed string. */
function tok(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Snapshot tokens once at module initialisation time.
const Z1         = tok('--z1');
const Z2         = tok('--z2');
const ZX         = tok('--zx');
const P_LOW      = tok('--priority-low');
const P_MODERATE = tok('--priority-moderate');
const P_ELEVATED = tok('--priority-elevated');
const P_HIGH     = tok('--priority-high');
const P_CRITICAL = tok('--priority-critical');

// No-zone fallback: a neutral grey that is intentionally not a named
// design token (it represents "unknown/unmapped", not a zone).
const ZONE_FALLBACK = '#888888';

/** Zone classification fill/outline colour expression. */
export const ZONE_FILL_EXPR = [
  'match', ['get', 'Zone'],
  'Zone 1', Z1,
  'Zone 2', Z2,
  'Zone X', ZX,
  ZONE_FALLBACK,
];

/** Opacity that scales with zoom so haras boundaries don't overwhelm at low zoom. */
export const HARAS_FILL_OPACITY = [
  'interpolate', ['linear'], ['zoom'],
  4, 0.45,
  8, 0.55,
];

/** Outline width scaled with zoom. */
export const HARAS_LINE_WIDTH = [
  'interpolate', ['linear'], ['zoom'],
  4,  0.1,
  8,  0.5,
  12, 1,
];

/** Catchment fill — passthrough of the CATCHMENT_MATCH expression from data-index. */
export { CATCHMENT_MATCH as CATCHMENT_FILL_EXPR };

/**
 * Priority fill expression — built from precomputed quantile thresholds.
 * Colours are sourced from the --priority-* tokens in tokens.css.
 *
 * @param {number[]} thresholds  [q50, q75, q90, q97]
 * @returns {any[]}
 */
export function buildPriorityFillExpr(thresholds) {
  return [
    'step', ['get', 'priority_score'],
    P_LOW,
    thresholds[0], P_MODERATE,
    thresholds[1], P_ELEVATED,
    thresholds[2], P_HIGH,
    thresholds[3], P_CRITICAL,
  ];
}
