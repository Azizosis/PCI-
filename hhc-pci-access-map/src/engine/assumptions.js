/**
 * assumptions.js
 *
 * Centralised policy inputs and classification thresholds.
 * All values here are explicit, auditable, and replaceable when better
 * local data becomes available.
 */

// ── STEMI incidence ───────────────────────────────────────────────────────────
/**
 * STEMI events per person per year.
 * Source: national-level placeholder — 70 per 100,000.
 * Replace with region-specific rates when available.
 *
 * POLICY INPUT: This single number drives every "~N STEMI cases/yr" figure
 * displayed in the placement dossier.  A 2× change here produces a 2× change
 * in all displayed STEMI estimates.
 */
export const STEMI_RATE = 70 / 100_000;

export const STEMI_NOTE =
  'Assumption: 70 STEMI events per 100,000 population/year (national placeholder).';

// ── Drive-time thresholds ─────────────────────────────────────────────────────
/** Drive-time ceiling for Zone 1 (optimal PCI access), in minutes. */
export const Z1_THRESHOLD = 60;

/** Drive-time ceiling for Zone 2 (acceptable access), in minutes. */
export const Z2_THRESHOLD = 120;

// ── Greedy placement weights ──────────────────────────────────────────────────
/**
 * Marginal-gain weights for the greedy coverage selector.
 * The algorithm scores each candidate as:
 *   GREEDY_W_Z1 × pop promoted to ≤60-min access
 *   + GREEDY_W_Z2 × pop promoted to 61–120-min access
 *
 * Weighting Zone 1 twice as much as Zone 2 reflects the clinical consensus
 * that primary PCI within 60 minutes is substantially more beneficial than
 * transfer with an additional delay.
 */
export const GREEDY_W_Z1 = 2;
export const GREEDY_W_Z2 = 1;

// ── Investment-score component weights ────────────────────────────────────────
/**
 * Weights for augmentRankingWithScore() in placement-engine.js.
 * Each component is normalised to 0–1 across peers before weighting.
 * Weights must sum to 1.0.
 *
 *   WEIGHT_POP   — total population rescued (primary driver)
 *   WEIGHT_Z1    — fraction promoted to ≤60-min access (optimal tier bonus)
 *   WEIGHT_RED   — access redundancy gained (resilience bonus)
 *   WEIGHT_STEMI — estimated STEMI volume rescued (clinical urgency)
 */
export const SCORE_WEIGHTS = {
  pop:   0.40,
  z1:    0.30,
  red:   0.15,
  stemi: 0.15,
};

// ── Access-fragility thresholds ───────────────────────────────────────────────
/**
 * Breakpoints for fragilitySeverity() in fragility.js.
 * Values represent extra minutes to reach the 2nd-nearest PCI hospital.
 */
export const FRAGILITY_THRESHOLDS = {
  low:      30,   // < 30 min extra → Low    (backup hospital is close)
  moderate: 60,   // < 60 min extra → Moderate
  high:     120,  // < 120 min extra → High   (single realistic option)
                  // >= 120 min     → Critical (no realistic backup)
};

// ── Score-level classification thresholds ────────────────────────────────────
/**
 * Breakpoints for scoreLevel() in fragility.js.
 * Applied to the 0–100 investment score (invScore).
 */
export const SCORE_LEVEL_THRESHOLDS = {
  high:   75,  // >= 75 → High Priority
  medium: 60,  // >= 60 → Medium Priority
               // < 60  → Selective / Conditional
};

// ── Priority-score quantile breakpoints ──────────────────────────────────────
/**
 * Population percentiles used to bin haras features in the Priority view.
 * Adjusted to emphasise the upper tail — the top 3% of person-hour burden
 * concentrates the most clinically urgent neighbourhoods.
 */
export const PRIORITY_QUANTILES = [0.50, 0.75, 0.90, 0.97];

// ── Facility classification thresholds ───────────────────────────────────────
/**
 * Decision classes applied to each proposed site.
 * Colors are deliberately distinct from map zone colors:
 *   PCI Hub teal intentionally mirrors Zone 1 (both signal "good access");
 *   tPA orange (#ff8c42) is distinct from Zone 2 amber (#d4a017) to avoid
 *   map ↔ decision confusion.
 *
 * Classification logic (applied in order):
 *   PCI Hub  — score >= scoreMin AND pop >= popMin
 *   tPA Spoke— score >= scoreMin OR  pop >= popMin
 *   Transfer — below both thresholds
 */
export const CLASS_THRESHOLDS = {
  PCI_HUB:  { scoreMin: 75,  popMin: 150_000, label: 'Build PCI Hub',       color: '#00e5b4' },
  TPA:      { scoreMin: 50,  popMin: 50_000,  label: 'tPA Spoke',           color: '#ff8c42' },
  TRANSFER: { scoreMin: 0,   popMin: 0,       label: 'Optimize Transfer',   color: '#7aa0c0' },
};

// ── Regional capital anchors ──────────────────────────────────────────────────
/**
 * City name for each administrative region — used in the System Impact
 * narrative to name the source of PCI dependence.
 * Key = Region name as it appears in the GeoJSON.
 */
export const REGION_CAPITAL = {
  'Ar Riyadh':       'Riyadh city',
  'Al Madinah':      'Al Madinah city',
  'Makkah':          'Makkah city',
  'Eastern Province':'Dammam',
  'Al Qaseem':       'Buraidah',
  'Tabuk':           'Tabuk city',
  'Hail':            'Hail city',
  'Al Bahah':        'Al Bahah city',
  'Aseer':           'Abha',
  'Najran':          'Najran city',
  'Jazan':           'Jazan city',
  'Northern Borders':'Arar',
  'Al Jawf':         'Sakaka',
};
