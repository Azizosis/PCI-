/**
 * haras.geojson.js
 *
 * Exports the HARAS_GEOJSON FeatureCollection and the parallel auxiliary
 * arrays that carry per-haras drive-time data from the xlsx analysis.
 *
 * NOTE: The actual geometry + aux arrays are large binary payloads extracted
 * verbatim from hhc-pci-access-map_10.html.  They are kept in this single
 * data module so every other module imports clean references rather than
 * reading from a global namespace.
 *
 * Parallel arrays (all indexed by position, matching HARA_AUX_IDS order):
 *   HARA_AUX_IDS  — HARA_ID values
 *   HARA_AUX_DIST — road distance (km) to nearest PCI hospital
 *   HARA_AUX_HAV  — haversine distance (km) to nearest PCI hospital
 *   HARA_AUX_D2   — drive time (min) to 2nd-nearest PCI hospital
 *   HARA_AUX_D3   — drive time (min) to 3rd-nearest PCI hospital
 *
 * Governorate auxiliary arrays:
 *   HARA_GOV_IDS  — HARA_ID values (same sequence as HARA_AUX_IDS)
 *   HARA_GOV_IDX  — index into HARA_GOV_TABLE for each haras
 *   HARA_GOV_TABLE — deduplicated governorate name strings
 */

// ─── GeoJSON FeatureCollection ───────────────────────────────────────────────
// Paste HARAS_GEOJSON value from hhc-pci-access-map_10.html here.
export const HARAS_GEOJSON = /* INSERT_HARAS_GEOJSON */ null;

// ─── Parallel auxiliary arrays ────────────────────────────────────────────────
// Paste HARA_AUX_IDS, HARA_AUX_DIST, HARA_AUX_HAV, HARA_AUX_D2, HARA_AUX_D3
// from hhc-pci-access-map_10.html here.
export const HARA_AUX_IDS  = /* INSERT */ [];
export const HARA_AUX_DIST = /* INSERT */ [];
export const HARA_AUX_HAV  = /* INSERT */ [];
export const HARA_AUX_D2   = /* INSERT */ [];
export const HARA_AUX_D3   = /* INSERT */ [];

// ─── Governorate arrays ───────────────────────────────────────────────────────
export const HARA_GOV_IDS   = /* INSERT */ [];
export const HARA_GOV_IDX   = /* INSERT */ [];
export const HARA_GOV_TABLE = /* INSERT */ [];
