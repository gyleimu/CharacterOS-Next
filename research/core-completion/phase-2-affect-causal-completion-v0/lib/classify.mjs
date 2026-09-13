/**
 * Frozen scenario-specific behavior classification + distribution/variance
 * metrics. No LLM judging, no embeddings: classification is a deterministic
 * function of the validated structured proposal (directive + the model's own
 * current_intent text via a frozen keyword taxonomy).
 */

import { INTENT_KEYWORDS } from './config.mjs';
import { intentTokens, jaccard } from './proposal.mjs';

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Map ONE validated cognition result into a frozen scenario behavior class.
 * Precedence is explicit and frozen:
 *   CLARIFY directive -> ASK_FOR_CLARIFICATION
 *   else scenario-specific intent taxonomy (DECLINE > CAUTIOUS > SUPPORT)
 *   else REALIZE_OTHER / INCORRECT_OTHER
 */
export function classifyEndpoints(scenario, directive, currentIntent) {
  const intent = String(currentIntent ?? '').toLowerCase();
  if (directive === 'CLARIFY_MISSING_CONTEXT') return 'ASK_FOR_CLARIFICATION';
  if (scenario.id === 'N1_ARITHMETIC') {
    return intent.includes('42') ? 'CORRECT_42' : 'INCORRECT_OTHER';
  }
  if (containsAny(intent, INTENT_KEYWORDS.REALIZE_DECLINE)) return 'REALIZE_DECLINE';
  if (containsAny(intent, INTENT_KEYWORDS.REALIZE_CAUTIOUS)) return 'REALIZE_CAUTIOUS';
  if (containsAny(intent, INTENT_KEYWORDS.REALIZE_SUPPORT)) return 'REALIZE_SUPPORT';
  return 'REALIZE_OTHER';
}

export function classifyBehavior(scenario, proposal) {
  return classifyEndpoints(
    scenario,
    proposal.communication_directive.kind,
    proposal.cognition.current_intent
  );
}

/** Distribution over a frozen label set from an array of class labels. */
export function distribution(labels, universe) {
  const counts = {};
  for (const label of universe) counts[label] = 0;
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
  const n = labels.length;
  const proportions = {};
  for (const label of universe) proportions[label] = n === 0 ? 0 : counts[label] / n;
  let majority = universe[0];
  for (const label of universe) if (counts[label] > (counts[majority] ?? 0)) majority = label;
  const majorityCount = counts[majority] ?? 0;
  let entropy = 0;
  for (const label of universe) {
    const p = proportions[label];
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return {
    n,
    counts,
    proportions: Object.fromEntries(
      Object.entries(proportions).map(([k, v]) => [k, Number(v.toFixed(4))])
    ),
    majority_class: majority,
    majority_count: majorityCount,
    majority_proportion: n === 0 ? 0 : Number((majorityCount / n).toFixed(4)),
    disagreement_rate: n === 0 ? 0 : Number(((n - majorityCount) / n).toFixed(4)),
    entropy_bits: Number(entropy.toFixed(4))
  };
}

/** Total variation distance between two label-count maps over a universe. */
export function totalVariationDistance(countsA, countsB, universe) {
  const nA = Object.values(countsA).reduce((a, b) => a + b, 0);
  const nB = Object.values(countsB).reduce((a, b) => a + b, 0);
  if (nA === 0 || nB === 0) return 0;
  let sum = 0;
  for (const label of universe) {
    sum += Math.abs((countsA[label] ?? 0) / nA - (countsB[label] ?? 0) / nB);
  }
  return Number((sum / 2).toFixed(4));
}

/** Jensen-Shannon divergence (base 2) between two label-count maps. */
export function jensenShannonDivergence(countsA, countsB, universe) {
  const nA = Object.values(countsA).reduce((a, b) => a + b, 0);
  const nB = Object.values(countsB).reduce((a, b) => a + b, 0);
  if (nA === 0 || nB === 0) return 0;
  const p = universe.map((label) => (countsA[label] ?? 0) / nA);
  const q = universe.map((label) => (countsB[label] ?? 0) / nB);
  const m = p.map((value, index) => (value + q[index]) / 2);
  const kl = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] > 0 && b[i] > 0) sum += a[i] * Math.log2(a[i] / b[i]);
    }
    return sum;
  };
  return Number(((kl(p, m) + kl(q, m)) / 2).toFixed(4));
}

/**
 * Same-condition split-half instability: TVD between the odd/even replicate
 * halves and between the first/second halves (max of the two).
 */
export function splitHalfTvd(labels, universe) {
  const odd = labels.filter((_, index) => index % 2 === 1);
  const even = labels.filter((_, index) => index % 2 === 0);
  const half = Math.ceil(labels.length / 2);
  const first = labels.slice(0, half);
  const second = labels.slice(half);
  const counts = (items) => {
    const result = {};
    for (const label of universe) result[label] = 0;
    for (const label of items) result[label] = (result[label] ?? 0) + 1;
    return result;
  };
  const parity = totalVariationDistance(counts(odd), counts(even), universe);
  const halves = totalVariationDistance(counts(first), counts(second), universe);
  return { parity_tvd: parity, halves_tvd: halves, max_tvd: Math.max(parity, halves) };
}

/** Mean pairwise intent-token Jaccard within a set of intents (dispersion). */
export function intentDispersion(intents) {
  if (intents.length < 2) return 1;
  const tokenSets = intents.map((intent) => intentTokens(intent));
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < tokenSets.length; i += 1) {
    for (let j = i + 1; j < tokenSets.length; j += 1) {
      sum += jaccard(tokenSets[i], tokenSets[j]);
      pairs += 1;
    }
  }
  return pairs === 0 ? 1 : Number((sum / pairs).toFixed(4));
}
