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
 * computePriority() mutates feature.properties directly (same pattern as
 * the original file) and returns the MapLibre 'step' fill expression.
 */

/**
 * Annotate every haras feature with a priority_score, then compute
 * quantile thresholds and return a MapLibre fill expression.
 *
 * @param {GeoJSON.FeatureCollection} geojson  — mutated in place
 * @returns {{ thresholds: number[], fillExpression: any[] }}
 */
export function computePriority(geojson) {
  const scores = [];

  for (const f of geojson.features) {
    const pop   = +f.properties.POPULATION || 0;
    const dm    = parseFloat(f.properties.Driving_Min) || 0;
    const score = pop * dm / 60;
    f.properties.priority_score = score;
    if (score > 0) scores.push(score);
  }

  scores.sort((a, b) => a - b);

  const Q = (p) =>
    scores.length
      ? scores[Math.min(scores.length - 1, Math.floor(scores.length * p))]
      : 0;

  const thresholds = [Q(0.50), Q(0.75), Q(0.90), Q(0.97)];

  const fillExpression = [
    'step', ['get', 'priority_score'],
    '#1a2840',                    // below q50: low burden — deep blue
    thresholds[0], '#3a5a90',    // q50–q75: moderate — slate blue
    thresholds[1], '#d4a017',    // q75–q90: elevated — amber
    thresholds[2], '#ff6b3e',    // q90–q97: high — orange-red
    thresholds[3], '#ff1e3c',    // top 3%: critical — crimson
  ];

  return { thresholds, fillExpression };
}
