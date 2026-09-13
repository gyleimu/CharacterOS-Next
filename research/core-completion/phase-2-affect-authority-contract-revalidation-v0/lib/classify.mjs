/**
 * Revalidation classification + distributions. Final observable behavior is the
 * endpoint (never parser acceptance or free-form intent).
 */

import {
  distribution,
  jensenShannonDivergence,
  splitHalfTvd,
  totalVariationDistance
} from '../../phase-2-affect-causal-completion-v0/lib/classify.mjs';
import { BEHAVIOR_RULES } from './config.mjs';

export { distribution, jensenShannonDivergence, splitHalfTvd, totalVariationDistance };

/** Frozen final-behavior class for an affect-relevant scenario. */
export function classifyAffectBehavior(text) {
  const value = String(text ?? '');
  for (const rule of BEHAVIOR_RULES) {
    if (new RegExp(rule.re, 'i').test(value)) return rule.class;
  }
  return 'REALIZE_OTHER';
}

/** Objective oracle: did the final behavior contain the expected answer as a TOKEN? */
export function classifyNullBehavior(expected, text) {
  const value = String(text ?? '');
  const wanted = String(expected);
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Token boundaries: never accept a substring inside a longer alphanumeric run
  // (e.g. "BBBCB" must NOT satisfy "BBCB").
  const re = new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`);
  return re.test(value) ? `CORRECT_${wanted}` : 'INCORRECT_OR_OTHER';
}

export function classUniverse(scenario) {
  if (scenario.role === 'FACTUAL_CONTROL') return [`CORRECT_${scenario.expected}`, 'INCORRECT_OR_OTHER'];
  return scenario.classes;
}

export function classifyRecord(scenario, record) {
  if (record.status !== 'COMPLETE' || record.final_behavior === null) return null;
  return scenario.role === 'FACTUAL_CONTROL'
    ? classifyNullBehavior(scenario.expected, record.final_behavior)
    : classifyAffectBehavior(record.final_behavior);
}
