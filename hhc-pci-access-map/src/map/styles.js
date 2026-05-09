/**
 * styles.js — MapLibre paint expression factories
 *
 * These functions return MapLibre expression arrays.  They are pure:
 * given the same inputs they return the same expression, with no side effects.
 */

import { CATCHMENT_MATCH } from '../data/data-index.js';

/** Zone classification fill/outline color expression */
export const ZONE_FILL_EXPR = [
  'match', ['get', 'Zone'],
  'Zone 1', '#00e5b4',
  'Zone 2', '#d4a017',
  'Zone X', '#e03e3e',
  '#888',
];

/** Opacity that scales with zoom so haras boundaries don't overwhelm at low zoom */
export const HARAS_FILL_OPACITY = [
  'interpolate', ['linear'], ['zoom'],
  4, 0.45,
  8, 0.55,
];

/** Outline width scaled with zoom */
export const HARAS_LINE_WIDTH = [
  'interpolate', ['linear'], ['zoom'],
  4,  0.1,
  8,  0.5,
  12, 1,
];

/** Catchment fill — same CATCHMENT_MATCH expression from data */
export { CATCHMENT_MATCH as CATCHMENT_FILL_EXPR };

/**
 * Priority fill expression — built from precomputed quantile thresholds.
 * Returned directly from computePriority() in priority-score.js and cached
 * on the state object.
 *
 * @param {number[]} thresholds  [q50, q75, q90, q97]
 * @returns {any[]}
 */
export function buildPriorityFillExpr(thresholds) {
  return [
    'step', ['get', 'priority_score'],
    '#1a2840',
    thresholds[0], '#3a5a90',
    thresholds[1], '#d4a017',
    thresholds[2], '#ff6b3e',
    thresholds[3], '#ff1e3c',
  ];
}
