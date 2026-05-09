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
 */
export const STEMI_RATE = 70 / 100_000;

export const STEMI_NOTE =
  'Assumption: 70 STEMI events per 100,000 population/year.';

// ── Drive-time thresholds ─────────────────────────────────────────────────────
/** Drive-time ceiling for Zone 1 (optimal PCI access), in minutes. */
export const Z1_THRESHOLD = 60;

/** Drive-time ceiling for Zone 2 (acceptable access), in minutes. */
export const Z2_THRESHOLD = 120;

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
