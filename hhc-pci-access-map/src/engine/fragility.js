/**
 * fragility.js — Access fragility and priority-level classification
 *
 * These two functions provide distinct but complementary risk signals:
 *
 *   fragilitySeverity — "How dependent is a site's catchment on a single hospital?"
 *                       Keyed on extra minutes to the 2nd-nearest hospital.
 *                       Uses a risk-only color ramp (green → red), deliberately
 *                       distinct from the map zone palette.
 *
 *   scoreLevel        — "How urgently should this site be built?"
 *                       Keyed on the 0–100 investment score (invScore).
 *                       Returns actionable decision labels — never "Low Priority"
 *                       for sites that score as tPA Spokes.
 *
 * Thresholds are defined in assumptions.js (FRAGILITY_THRESHOLDS,
 * SCORE_LEVEL_THRESHOLDS) so they can be adjusted without touching this file.
 */

import { FRAGILITY_THRESHOLDS, SCORE_LEVEL_THRESHOLDS } from './assumptions.js';

/**
 * @param {number} extraMinutes  Average extra minutes to reach the 2nd-nearest PCI hospital
 * @returns {{ label: string, color: string, desc: string }}
 */
export function fragilitySeverity(extraMinutes) {
  if (extraMinutes < FRAGILITY_THRESHOLDS.low) {
    return { label: 'Low',      color: '#7ed957', desc: 'Rescued areas have a reachable backup hospital nearby.' };
  }
  if (extraMinutes < FRAGILITY_THRESHOLDS.moderate) {
    return { label: 'Moderate', color: '#f5d033', desc: `Rescued areas have a backup hospital, but it adds ~${Math.round(extraMinutes)} min travel.` };
  }
  if (extraMinutes < FRAGILITY_THRESHOLDS.high) {
    return { label: 'High',     color: '#ff8c42', desc: 'Rescued areas currently depend on a single reachable hospital.' };
  }
  return   { label: 'Critical', color: '#e03e3e', desc: 'Rescued areas have no realistic backup hospital — single point of failure.' };
}

/**
 * @param {number} score  Investment score 0–100 (invScore from placement-engine.js)
 * @returns {{ label: string, color: string }}
 */
export function scoreLevel(score) {
  if (score >= SCORE_LEVEL_THRESHOLDS.high)   return { label: 'High Priority',          color: '#00e5b4' };
  if (score >= SCORE_LEVEL_THRESHOLDS.medium) return { label: 'Medium Priority',        color: '#d4a017' };
  return                                             { label: 'Selective / Conditional', color: '#7aa0c0' };
}
