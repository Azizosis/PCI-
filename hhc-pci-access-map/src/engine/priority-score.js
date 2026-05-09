/**
 * priority-score.js
 *
 * Computes the per-haras ACCESS BURDEN SCORE:
 *   priority_score = POPULATION × Driving_Min / 60  (person-hours of access burden)
 *
 * This is DISTINCT from the invScore in placement-engine.js:
 *   priority_score  — "Where is the problem?"  Drives the PRIORITY view.
 *   invScore        — "Where should we act?"   Drives the PLACEMENT view.
 *
 * A haras with high priority_score may or may not be cheaply rescuable;
 * this score purely reflects the burden of the status quo.
 *
 * Quantile breakpoints are defined in assumptions.js (PRIORITY_QUANTILES)
 * so the colour ramp can be recalibrated without touching this file.
 */

import { PRIORITY_QUANTILES } from './assumptions.js';

/**
 * Annotate every haras feature with a priority_score, then compute
 * quantile thresholds and return a MapLibre 'step' fill expression.
 *
 * NOTE: geojson must be the mutable working copy (_geoWork from state.js),
 * never the raw HARAS_GEOJSON import.
 *
 * @param {GeoJSON.FeatureCollection} geojson  — working copy, mutated in place
 * @returns {{ thresholds: number[], fillExpression: any[] }}
 */
export function computePriority(geojson) {
  const scores = [];

  for (const f of geojson.features) {
    const pop   = +f.properties.POPULATION || 0;
    const dm    = parseFloat(f.properties.Driving_Min) || 0;
    const score = pop * dm / 60;   // person-hours of access burden
    f.properties.priority_score = score;
    if (score > 0) scores.push(score);
  }

  scores.sort((a, b) => a - b);

  const Q = (p) =>
    scores.length
      ? scores[Math.min(scores.length - 1, Math.floor(scores.length * p))]
      : 0;

  // PRIORITY_QUANTILES = [0.50, 0.75, 0.90, 0.97] — see assumptions.js.
  // Biased toward the upper tail: the top 3% concentrates the most
  // clinically urgent neighbourhoods and should stand out clearly.
  const thresholds = PRIORITY_QUANTILES.map(Q);

  const fillExpression = [
    'step', ['get', 'priority_score'],
    '#1a2840',                    // below q50: low burden — deep navy
    thresholds[0], '#3a5a90',    // q50–q75: moderate  — slate blue
    thresholds[1], '#d4a017',    // q75–q90: elevated  — amber
    thresholds[2], '#ff6b3e',    // q90–q97: high      — orange-red
    thresholds[3], '#ff1e3c',    // top 3%: critical   — crimson
  ];

  return { thresholds, fillExpression };
}
