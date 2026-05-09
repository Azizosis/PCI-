/**
 * geo.js — pure geographic utility functions
 */

/**
 * Compute the centroid of a GeoJSON Polygon or MultiPolygon geometry.
 * For MultiPolygon, uses the longest outer ring as the representative ring.
 *
 * @param {{ type: string, coordinates: any[] }} geom
 * @returns {[number, number] | null}  [lng, lat] centroid, or null if unsupported type
 */
export function polyCentroid(geom) {
  let coords;
  if (geom.type === 'Polygon') {
    coords = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    let best = geom.coordinates[0][0];
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        if (ring.length > best.length) best = ring;
      }
    }
    coords = best;
  } else {
    return null;
  }

  let x = 0, y = 0;
  const n = coords.length;
  for (const c of coords) { x += c[0]; y += c[1]; }
  return [x / n, y / n];
}

/**
 * Compute a population-weighted centroid for a set of { point, weight } pairs.
 *
 * @param {Array<{ point: [number, number], weight: number }>} items
 * @returns {[number, number]}
 */
export function weightedCentroid(items) {
  let sumLng = 0, sumLat = 0, sumW = 0;
  for (const { point, weight } of items) {
    const w = Math.max(1, weight);
    sumLng += point[0] * w;
    sumLat += point[1] * w;
    sumW   += w;
  }
  return [sumLng / sumW, sumLat / sumW];
}
