/**
 * normalize.js — numeric normalization helpers
 *
 * Used by the placement engine and score components to produce 0..1 values
 * suitable for weighted aggregation.
 */

/**
 * Normalize a value to the [0, 1] range given a maximum.
 * Returns 0 when max is 0 (avoids division by zero).
 *
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
export function normalizeToMax(value, max) {
  if (!max) return 0;
  return value / max;
}

/**
 * Compute the maximum of an array of numbers extracted via a selector.
 * Returns 1 as a safe fallback when the array is empty or all zeros.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} selector
 * @returns {number}
 */
export function safeMax(items, selector) {
  return Math.max(1, ...items.map(selector));
}

/**
 * Clamp a value to the [min, max] range.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
