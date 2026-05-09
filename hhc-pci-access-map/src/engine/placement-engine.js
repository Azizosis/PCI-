/**
 * placement-engine.js
 *
 * Greedy maximum-coverage facility-location analysis.
 *
 * TWO DISTINCT SCORES — DO NOT CONFLATE:
 *
 *   priority_score (computed in priority-score.js):
 *     = POPULATION × Driving_Min / 60
 *     Answers: "Where is the problem?"  Drives the PRIORITY view.
 *
 *   invScore (computed here in augmentRankingWithScore()):
 *     = weighted blend of (Zone X beneficiaries, ≤60-min beneficiaries,
 *       access fragility, STEMI volume)
 *     Answers: "Where should we act?"   Drives the PLACEMENT view.
 *
 * A haras with high priority_score may or may not be cheaply rescuable;
 * a site with high invScore must rescue a lot of burden.
 * Keeping them separate keeps the analytical logic auditable.
 */

import { PLACEMENT_DATA, HARA_INDEX }               from '../data/data-index.js';
import {
  STEMI_RATE,
  CLASS_THRESHOLDS,
  GREEDY_W_Z1,
  GREEDY_W_Z2,
  SCORE_WEIGHTS,
} from './assumptions.js';
import { normalizeToMax, safeMax }  from '../utils/normalize.js';
import { fragilitySeverity }        from './fragility.js';

// ── Public types ──────────────────────────────────────────────────────────────
/**
 * @typedef {{ label: string, color: string }} DecisionClass
 *
 * @typedef {{
 *   idx:            number,
 *   site:           object,
 *   score:          number,
 *   popZ1:          number,
 *   popZ2:          number,
 *   harasCount:     number,
 *   redundancy:     number,
 *   avgSaved:       number,
 *   stemiYr:        number,
 *   invScore:       number,
 *   scoreParts:     { pop: number, z1: number, red: number, stemi: number },
 *   classification: DecisionClass,
 * }} RankedSite
 *
 * @typedef {{ ranking: RankedSite[], covered: Set<number> }} PlacementResult
 */

// ── Do-nothing comparator ─────────────────────────────────────────────────────
/**
 * STEMI cases per year under the current status quo — i.e. the counterfactual
 * used in the dossier "Impact without this site" block.
 *
 * This number is derived from the Zone X population total (all haras with
 * Driving_Min > 120 or unreachable) multiplied by STEMI_RATE.  It is
 * intentionally labelled as a "do-nothing" baseline so analysts can see the
 * clinical cost of inaction, not just the benefit of action.
 *
 * Populated by augmentRankingWithScore() from the placement result; exposed
 * here as a placeholder for documentation purposes.
 */
export let DO_NOTHING_STEMI_YR = null; // set after computePlacement() resolves

// ── Classification ────────────────────────────────────────────────────────────
/**
 * Classify a proposed site into PCI Hub / tPA Spoke / Transfer Optimization.
 *
 * WHY PCI Hub uses AND logic:
 *   A PCI Hub requires both high investment value AND a large enough population
 *   to justify full cath-lab infrastructure.  Meeting only one criterion is
 *   insufficient — a site with a great score but only 20K residents cannot
 *   sustain 24/7 PCI staffing; a site with 500K residents but a low score
 *   means existing capacity nearby may be adequate.
 *
 * WHY tPA Spoke uses OR logic:
 *   A tPA-capable stabilization site has a much lower operational bar.  Either
 *   a sufficiently high investment score (indicating rescued burden is large) OR
 *   a sufficiently large served population (indicating throughput demand) is
 *   enough to justify a thrombolysis-capable facility.  A site meeting both
 *   criteria would have already qualified as a PCI Hub.
 *
 * @param {number} invScore   0–100 investment score from augmentRankingWithScore()
 * @param {number} popReached total population promoted out of Zone X by this site
 * @returns {DecisionClass}
 */
export function classifySite(invScore, popReached) {
  // PCI Hub: AND — both score and population must clear the bar
  if (invScore >= CLASS_THRESHOLDS.PCI_HUB.scoreMin && popReached >= CLASS_THRESHOLDS.PCI_HUB.popMin) {
    return CLASS_THRESHOLDS.PCI_HUB;
  }
  // tPA Spoke: OR — either high burden value or high population demand suffices
  if (invScore >= CLASS_THRESHOLDS.TPA.scoreMin || popReached >= CLASS_THRESHOLDS.TPA.popMin) {
    return CLASS_THRESHOLDS.TPA;
  }
  // Transfer: below both thresholds — optimize routing, do not build new capacity
  return CLASS_THRESHOLDS.TRANSFER;
}

/**
 * Human-readable facility type label for the dossier subtitle.
 *
 * @param {DecisionClass} cls
 * @returns {string}
 */
export function facilityTypeText(cls) {
  if (cls.label === CLASS_THRESHOLDS.PCI_HUB.label)  return 'Proposed PCI-capable cardiac center';
  if (cls.label === CLASS_THRESHOLDS.TPA.label)       return 'Proposed tPA-capable stabilization site';
  return 'Transfer optimization candidate';
}

// ── Greedy coverage ───────────────────────────────────────────────────────────
/**
 * Run the greedy facility-location algorithm and return the top `numSites` sites.
 *
 * Score per candidate = 2 × pop rescued to ≤60 min + 1 × pop rescued to 61–120 min.
 * Haras already covered by an earlier pick are excluded from marginal gain.
 *
 * @param {number} [numSites=10]
 * @returns {PlacementResult}
 */
export function computePlacement(numSites = 10) {
  const Z1_MIN  = PLACEMENT_DATA.meta.z1_promo_min;
  const covered = new Set();   // hids already rescued by an earlier pick
  const usedIdx = new Set();
  const ranking = [];

  for (let pick = 0; pick < numSites; pick++) {
    let bestI = -1, bestScore = 0, bestStats = null;

    for (let i = 0; i < PLACEMENT_DATA.cov.length; i++) {
      if (usedIdx.has(i)) continue;
      let popZ1 = 0, popZ2 = 0, hCount = 0;

      for (const e of PLACEMENT_DATA.cov[i]) {
        if (covered.has(e[0])) continue;
        if (e[1] <= Z1_MIN) { popZ1 += e[2]; } else { popZ2 += e[2]; }
        hCount++;
      }

      // GREEDY_W_Z1 and GREEDY_W_Z2 are defined in assumptions.js.
      // Zone 1 (≤60-min) promotion is weighted twice Zone 2 (61-120-min)
      // because primary PCI within 60 minutes has substantially greater
      // clinical benefit than transfer with additional delay.
      const score = GREEDY_W_Z1 * popZ1 + GREEDY_W_Z2 * popZ2;
      if (score > bestScore) {
        bestScore = score; bestI = i;
        bestStats = { popZ1, popZ2, hCount };
      }
    }

    if (bestI < 0 || bestScore === 0) break;
    usedIdx.add(bestI);
    for (const e of PLACEMENT_DATA.cov[bestI]) covered.add(e[0]);
    ranking.push({
      idx:        bestI,
      site:       PLACEMENT_DATA.sites[bestI],
      score:      bestScore,
      popZ1:      bestStats.popZ1,
      popZ2:      bestStats.popZ2,
      harasCount: bestStats.hCount,
    });
  }

  augmentRankingWithScore(ranking);
  return { ranking, covered };
}

// ── Score augmentation ────────────────────────────────────────────────────────
/**
 * Add invScore, scoreParts, redundancy, avgSaved, stemiYr, and classification
 * to each ranked site in-place.
 *
 * @param {RankedSite[]} ranking  — mutated in place
 * @param {GeoJSON.FeatureCollection} geojson  — used for drive-time lookup
 */
export function augmentRankingWithScore(ranking, geojson) {
  // Build HARA_ID → currentDriveMin lookup from GeoJSON features
  const currentDM = new Map();
  if (geojson) {
    for (const f of geojson.features) {
      const dm = parseFloat(f.properties.Driving_Min);
      if (dm > 0) currentDM.set(+f.properties.HARA_ID, dm);
    }
  }

  // Raw component values per site
  for (const r of ranking) {
    const popReached = r.popZ1 + r.popZ2;
    let redSum = 0, redN = 0, savedSum = 0, savedN = 0;

    for (const e of PLACEMENT_DATA.cov[r.idx]) {
      const aux = HARA_INDEX.get(e[0]);
      const dm  = currentDM.get(e[0]);
      if (aux && aux.d2 > 0 && dm > 0) { redSum += Math.max(0, aux.d2 - dm); redN++; }
      if (dm > 0 && e[1] > 0)          { savedSum += dm - e[1]; savedN++; }
    }

    r.redundancy = redN    > 0 ? redSum   / redN    : 0;
    r.avgSaved   = savedN  > 0 ? savedSum / savedN  : 0;
    r.stemiYr    = popReached * STEMI_RATE;
  }

  // Normalise component values to 0..1 across peers, then compute weighted score
  const maxPop   = safeMax(ranking, r => r.popZ1 + r.popZ2);
  const maxZ1    = safeMax(ranking, r => r.popZ1);
  const maxRed   = safeMax(ranking, r => r.redundancy);
  const maxSTEMI = safeMax(ranking, r => r.stemiYr);

  for (const r of ranking) {
    const popReached = r.popZ1 + r.popZ2;
    const popN  = normalizeToMax(popReached,   maxPop);
    const z1N   = normalizeToMax(r.popZ1,      maxZ1);
    const redN  = normalizeToMax(r.redundancy, maxRed);
    const stN   = normalizeToMax(r.stemiYr,    maxSTEMI);

    // invScore: weighted blend of per-site components, each normalised to 0–1.
    // Weights are policy inputs defined in assumptions.js (SCORE_WEIGHTS).
    // This score answers "Where should we act?" — distinct from priority_score.
    r.invScore = Math.round(100 * (
      SCORE_WEIGHTS.pop   * popN  +
      SCORE_WEIGHTS.z1    * z1N   +
      SCORE_WEIGHTS.red   * redN  +
      SCORE_WEIGHTS.stemi * stN
    ));
    r.scoreParts   = { pop: popN, z1: z1N, red: redN, stemi: stN };
    r.classification = classifySite(r.invScore, popReached);
  }
}

// ── Feature annotation (mutates GeoJSON) ─────────────────────────────────────
/**
 * Write rescued_by rank (1-indexed) onto each Zone X feature.
 * Must be called after computePlacement() and before map.setData().
 *
 * @param {GeoJSON.FeatureCollection} geojson  — mutated in place
 * @param {PlacementResult} result
 */
export function annotatePlacementOnFeatures(geojson, result) {
  const rescuedByMap = new Map();
  result.ranking.forEach((r, i) => {
    for (const e of PLACEMENT_DATA.cov[r.idx]) {
      if (!rescuedByMap.has(e[0])) rescuedByMap.set(e[0], i + 1);
    }
  });

  for (const f of geojson.features) {
    if (f.properties.Zone === 'Zone X') {
      f.properties.rescued_by = rescuedByMap.get(+f.properties.HARA_ID) || -1;
    }
  }
}

/**
 * Write site_focus tiers onto Zone X features for the focused site.
 *   1 → gains ≤60-min access
 *   2 → gains 60–120-min access
 *   0 → still unreachable after this site
 *
 * @param {GeoJSON.FeatureCollection} geojson  — mutated in place
 * @param {PlacementResult} result
 * @param {number} siteIndex  0-indexed rank in result.ranking
 */
export function setSiteFocusOnFeatures(geojson, result, siteIndex) {
  const r = result.ranking[siteIndex];
  const Z1_MIN  = PLACEMENT_DATA.meta.z1_promo_min;
  const focusMap = new Map();

  for (const e of PLACEMENT_DATA.cov[r.idx]) {
    focusMap.set(e[0], e[1] <= Z1_MIN ? 1 : 2);
  }

  for (const f of geojson.features) {
    if (f.properties.Zone === 'Zone X') {
      f.properties.site_focus = focusMap.get(+f.properties.HARA_ID) || 0;
    }
  }
}

/**
 * Remove site_focus annotations from Zone X features.
 *
 * @param {GeoJSON.FeatureCollection} geojson  — mutated in place
 */
export function clearSiteFocusOnFeatures(geojson) {
  for (const f of geojson.features) {
    if (f.properties.site_focus !== undefined) delete f.properties.site_focus;
  }
}

// ── Geography helpers ─────────────────────────────────────────────────────────
/**
 * Group rescued haras by governorate and aggregate population + tier counts.
 * Uses HARA_INDEX directly — no haraGov argument needed.
 *
 * @param {number} siteIndex
 * @param {PlacementResult} result
 * @returns {Array<[string, { haras: number, popZ1: number, popZ2: number }]>}
 *   Sorted descending by total rescued population.
 */
export function buildAffectedByGovernorate(siteIndex, result) {
  const r      = result.ranking[siteIndex];
  const Z1_MIN = PLACEMENT_DATA.meta.z1_promo_min;
  const byGov  = new Map();

  for (const e of PLACEMENT_DATA.cov[r.idx]) {
    const gov = HARA_INDEX.get(e[0])?.gov ?? '—';
    if (!byGov.has(gov)) byGov.set(gov, { haras: 0, popZ1: 0, popZ2: 0 });
    const b = byGov.get(gov);
    b.haras++;
    if (e[1] <= Z1_MIN) { b.popZ1 += e[2]; } else { b.popZ2 += e[2]; }
  }

  return [...byGov.entries()].sort((a, b) => (b[1].popZ1 + b[1].popZ2) - (a[1].popZ1 + a[1].popZ2));
}

/**
 * Group rescued haras by KSA administrative region.
 *
 * @param {number} siteIndex
 * @param {PlacementResult} result
 * @param {GeoJSON.FeatureCollection} geojson  — used for region lookup
 * @returns {Array<[string, { haras: number, popZ1: number, popZ2: number }]>}
 */
export function buildAffectedByRegion(siteIndex, result, geojson) {
  const r      = result.ranking[siteIndex];
  const Z1_MIN = PLACEMENT_DATA.meta.z1_promo_min;
  const hidToRegion = new Map();

  for (const f of geojson.features) {
    hidToRegion.set(+f.properties.HARA_ID, f.properties.Region);
  }

  const byRegion = new Map();
  for (const e of PLACEMENT_DATA.cov[r.idx]) {
    const region = hidToRegion.get(e[0]) || '—';
    if (!byRegion.has(region)) byRegion.set(region, { haras: 0, popZ1: 0, popZ2: 0 });
    const b = byRegion.get(region);
    b.haras++;
    if (e[1] <= Z1_MIN) { b.popZ1 += e[2]; } else { b.popZ2 += e[2]; }
  }

  return [...byRegion.entries()].sort((a, b) => (b[1].popZ1 + b[1].popZ2) - (a[1].popZ1 + a[1].popZ2));
}

// ── MapLibre fill expressions ─────────────────────────────────────────────────
/**
 * Generate the MapLibre fill-color expression for placement view.
 *
 * @param {number} selectedSite  -1 = show all rescues; >=0 = focus on one site
 * @returns {any[]} MapLibre expression
 */
export function getPlacementFill(selectedSite) {
  if (selectedSite < 0) {
    return ['case',
      ['!=', ['get', 'Zone'], 'Zone X'],         '#1a2236',
      ['>=', ['coalesce', ['get', 'rescued_by'], -1], 1], '#00e5b4',
      '#ff1e3c',
    ];
  }
  return ['case',
    ['!=', ['get', 'Zone'], 'Zone X'],            '#0e1620',
    ['==', ['coalesce', ['get', 'site_focus'], 0], 1], '#00e5b4',   // optimal (<=60 min)
    ['==', ['coalesce', ['get', 'site_focus'], 0], 2], '#d4a017',   // acceptable (60–120 min)
    '#3a1a22',                                                        // still Zone X
  ];
}
