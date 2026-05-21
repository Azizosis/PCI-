/**
 * config.js — compile-time configuration constants
 *
 * All tuneable values for the application that are NOT analytical assumptions
 * (those live in engine/assumptions.js) belong here.
 *
 * Centralising them here means a single touch-point for environment-specific
 * changes (tile URLs, initial view, number of placement candidates, etc.).
 */

// ── Map initialisation ────────────────────────────────────────────────────────

/** Initial map center [lng, lat] — roughly the geographic center of KSA. */
export const MAP_INITIAL_CENTER = [44.5, 23.5];

/** Initial zoom level. */
export const MAP_INITIAL_ZOOM = 5.0;

/** Minimum zoom (fully zoomed out). */
export const MAP_MIN_ZOOM = 3;

/** Maximum zoom (fully zoomed in). */
export const MAP_MAX_ZOOM = 14;

// ── Placement engine ──────────────────────────────────────────────────────────

/** How many candidate sites the greedy placement algorithm evaluates (internal pool). */
export const PLACEMENT_NUM_SITES = 10;

/**
 * How many ranked sites are shown by default in the placement panel and on the map.
 * The full PLACEMENT_NUM_SITES pool is always computed internally; this constant
 * controls only the visible presentation for executive use.
 */
export const DEFAULT_VISIBLE_PLACEMENTS = 5;

// ── Layer defaults ────────────────────────────────────────────────────────────

/**
 * Default visibility state for optional map layers.
 * Toggle-able via the left panel checkboxes.
 */
export const DEFAULT_LAYER_STATE = {
  haras:     true,
  hospitals: true,
  towers:    false,
  arcs:      false,
};

// ── UI behaviour ──────────────────────────────────────────────────────────────

/**
 * Number of governorate bubbles shown in the system impact SVG map.
 * Higher values can make the SVG crowded; 18 is the tested maximum.
 */
export const IMPACT_MAP_MAX_BUBBLES = 18;

/**
 * Minimum rescued population for a governorate to appear in the impact map.
 * Suppresses near-zero blobs that clutter the legend area.
 */
export const IMPACT_MAP_MIN_POP = 1_000;
