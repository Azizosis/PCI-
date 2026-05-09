/**
 * events.js — lightweight application event bus
 *
 * Replaces the duck-punched `e.originalEvent._handledByHosp` pattern with a
 * clean, module-scoped flag that is set and cleared within the same event tick.
 *
 * Usage:
 *   import { markHandled, wasHandled, clearHandled } from '../utils/events.js';
 *
 *   // In hospital click handler (fires first due to layer order):
 *   map.on('click', 'hosp-pts', e => {
 *     markHandled('map-click');
 *     ...
 *   });
 *
 *   // In haras click handler (fires second):
 *   map.on('click', 'haras-fill', e => {
 *     if (wasHandled('map-click')) { clearHandled('map-click'); return; }
 *     ...
 *   });
 */

/** @type {Set<string>} */
const _flags = new Set();

/**
 * Mark an event as handled by a named channel.
 * @param {string} channel
 */
export function markHandled(channel) {
  _flags.add(channel);
}

/**
 * Check whether an event was already handled on the given channel.
 * @param {string} channel
 * @returns {boolean}
 */
export function wasHandled(channel) {
  return _flags.has(channel);
}

/**
 * Clear the handled flag for the given channel.
 * Should be called once the second handler has consumed the flag.
 * @param {string} channel
 */
export function clearHandled(channel) {
  _flags.delete(channel);
}
