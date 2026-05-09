/**
 * catchments.js — Hospital catchment aggregation
 *
 * Derives per-hospital statistics (haras count, zone mix, total population)
 * by iterating over the HARAS_GEOJSON features once.  Results are used by
 * both the catchment list panel and the catchment dossier.
 */

/**
 * Build a summary table of all hospital catchments.
 *
 * @param {GeoJSON.FeatureCollection} geojson
 * @returns {Map<string, { haras: number, pop: number, z1: {h:number,p:number}, z2: {h:number,p:number}, zx: {h:number,p:number} }>}
 */
export function buildCatchmentStats(geojson) {
  /** @type {Map<string, any>} */
  const stats = new Map();

  for (const f of geojson.features) {
    const hosp = f.properties.Nearest_Hospital || '—';
    const zone = f.properties.Zone;
    const pop  = f.properties.POPULATION || 0;

    if (!stats.has(hosp)) {
      stats.set(hosp, {
        haras: 0,
        pop:   0,
        z1:    { h: 0, p: 0 },
        z2:    { h: 0, p: 0 },
        zx:    { h: 0, p: 0 },
      });
    }

    const s = stats.get(hosp);
    s.haras++;
    s.pop += pop;

    if (zone === 'Zone 1')      { s.z1.h++; s.z1.p += pop; }
    else if (zone === 'Zone 2') { s.z2.h++; s.z2.p += pop; }
    else                        { s.zx.h++; s.zx.p += pop; }
  }

  return stats;
}

/**
 * Return catchment stats for a single hospital, or null if not found.
 *
 * @param {GeoJSON.FeatureCollection} geojson
 * @param {string} hospName
 * @returns {{ haras: number, pop: number, z1: object, z2: object, zx: object } | null}
 */
export function getCatchmentForHospital(geojson, hospName) {
  const all = buildCatchmentStats(geojson);
  return all.get(hospName) ?? null;
}
