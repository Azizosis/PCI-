/**
 * placement-data.js
 *
 * Exports the precomputed facility-location dataset used by the placement engine.
 *
 * PLACEMENT_DATA shape:
 * {
 *   meta: {
 *     z1_promo_min: number,   // drive-time threshold for Zone 1 promotion (60)
 *     total_zx_pop: number,   // total Zone X population across KSA
 *   },
 *   sites: Array<{
 *     n:   string,  // site name / label
 *     lat: number,
 *     lng: number,
 *     s:   string,  // source type: 'kmeans' | 'city'
 *     g?:  string,  // governorate (city-sourced sites)
 *   }>,
 *   cov: Array<Array<[hid: number, newMin: number, pop: number]>>,
 *   //   cov[i] = list of haras rescued if site i is built:
 *   //           [HARA_ID, new_drive_minutes, population]
 * }
 *
 * Paste PLACEMENT_DATA value from hhc-pci-access-map_10.html here.
 */
export const PLACEMENT_DATA = /* INSERT_PLACEMENT_DATA */ {
  meta:  { z1_promo_min: 60, total_zx_pop: 0 },
  sites: [],
  cov:   [],
};
