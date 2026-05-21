/**
 * smoke-test.js
 *
 * Validates data integrity after GeoJSON loads.
 * Runs once at startup, logs a concise pass/fail table to the console.
 * Never throws — failures are surfaced as console.warn so they don't break
 * the user session, but are visible to developers in DevTools.
 *
 * Expected values (canonical from hhc-pci-access-map_10.html):
 *   - HARAS_GEOJSON features : 23,360
 *   - HARA_INDEX size        : 21,943  (access-indexed haras)
 *   - HOSPITALS              : 26
 *   - Placement candidates   : 272
 *   - Top placement site     : Yanbu
 */

import {
  HARAS_GEOJSON,
  HARA_INDEX,
  HOSPITALS,
  PLACEMENT_DATA,
} from '../data/data-index.js';
import { computePlacement } from '../engine/placement-engine.js';

const EXPECTED = {
  geojsonFeatures:      23360,
  haraIndexSize:        21943,
  hospitalCount:        26,
  placementCandidates:  272,
  topSiteName:          'Yanbu',
};

/**
 * Run all smoke-test assertions and log results.
 * Called once from main.js immediately after `await dataReady`.
 */
export function runSmokeTest() {
  const results = [];

  function check(label, actual, expected, compareFn = (a, e) => a === e) {
    const pass = compareFn(actual, expected);
    results.push({ label, pass, actual, expected });
  }

  // 1. GeoJSON feature count
  check(
    'HARAS_GEOJSON features',
    HARAS_GEOJSON?.features?.length ?? 0,
    EXPECTED.geojsonFeatures,
  );

  // 2. Access-indexed haras (HARA_INDEX is built from HARA_AUX_IDS which has
  //    only haras with valid road access data — 21,943 of the 23,360 total)
  check(
    'HARA_INDEX size (access-indexed)',
    HARA_INDEX.size,
    EXPECTED.haraIndexSize,
  );

  // 3. Hospital count
  check(
    'HOSPITALS count',
    HOSPITALS.length,
    EXPECTED.hospitalCount,
  );

  // 4. Placement candidates
  check(
    'Placement candidates',
    PLACEMENT_DATA.sites.length,
    EXPECTED.placementCandidates,
  );

  // 5. Top placement site — run the greedy algorithm for the top 1 pick
  let topSite = null;
  try {
    const { ranking } = computePlacement(1);
    topSite = ranking[0]?.site?.n ?? null;
  } catch (e) {
    topSite = `ERROR: ${e.message}`;
  }
  check(
    'Top placement site',
    topSite,
    EXPECTED.topSiteName,
    (actual, expected) => typeof actual === 'string' && actual.includes(expected),
  );

  // ── Report ──────────────────────────────────────────────────────────────
  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  const allOk = pass === total;

  const style = allOk
    ? 'color:#00e5b4;font-weight:bold'
    : 'color:#ff6b3e;font-weight:bold';

  console.groupCollapsed(`%c[HHC-PCI Smoke Test] ${pass}/${total} checks passed`, style);
  for (const r of results) {
    if (r.pass) {
      console.log(`  %c PASS %c ${r.label}: ${r.actual}`, 'color:#00e5b4', 'color:#888');
    } else {
      console.warn(`  FAIL  ${r.label}: got ${r.actual}, expected ${r.expected}`);
    }
  }
  if (!allOk) {
    console.warn('[HHC-PCI] Data integrity issues detected. Check data migration.');
  }
  console.groupEnd();
}
