/**
 * Research-only Affect counterfactual/ablation at the RENDERED-REQUEST level.
 *
 * Canonical subject state is never read or written here. All transformations
 * are pure string operations over one captured production cognition request, so
 * every non-Affect byte is preserved exactly. The production `projection_hash`
 * line is deliberately preserved as a lineage identifier.
 *
 * The canonical Affect section is exactly two rendered lines:
 *   [affect (canonical)] valence=<n> activation=<n>
 *   [affect (canonical) legend] ...
 * Legacy `[affect]` / `[mood]` lines are handled defensively (never present on
 * the V2 production surface).
 */

import { memorySection, subjectDataInvariantDigest, withoutLines } from './hash.mjs';

export const AFFECT_VALUE_PREFIX = '[affect (canonical)] valence=';
export const AFFECT_LEGEND_PREFIX = '[affect (canonical) legend]';
export const LEGACY_AFFECT_PREFIXES = Object.freeze(['[affect] ', '[mood] ']);

export function affectValueLine(valence, activation) {
  return `[affect (canonical)] valence=${valence} activation=${activation}`;
}

/** Indices of the canonical Affect value line. Must be exactly one. */
export function affectValueIndices(lines) {
  const indices = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trimStart();
    if (t.startsWith(AFFECT_VALUE_PREFIX)) indices.push(i);
  }
  return indices;
}

/** Indices of the whole Affect state section (value + legend + legacy). */
export function affectSectionIndices(lines) {
  const indices = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trimStart();
    if (t.startsWith(AFFECT_VALUE_PREFIX)) indices.push(i);
    else if (t.startsWith(AFFECT_LEGEND_PREFIX)) indices.push(i);
    else if (LEGACY_AFFECT_PREFIXES.some((p) => t.startsWith(p))) indices.push(i);
  }
  return indices;
}

/** Replace ONLY the canonical Affect value line; the legend is untouched. */
export function swapAffectValue(userContent, replacementLine) {
  const lines = userContent.split('\n');
  const indices = affectValueIndices(lines);
  if (indices.length !== 1) {
    throw new Error(`swapAffectValue: expected exactly one affect value line, found ${indices.length}`);
  }
  const original = lines[indices[0]];
  lines[indices[0]] = replacementLine;
  return { transformed: lines.join('\n'), original, replacement: replacementLine, removedIndices: [] };
}

/** Remove the whole Affect state section (value + legend). */
export function removeAffectSection(userContent) {
  const lines = userContent.split('\n');
  const removedIndices = affectSectionIndices(lines);
  if (removedIndices.length === 0) throw new Error('removeAffectSection: no affect section found');
  return {
    transformed: withoutLines(lines, removedIndices),
    removedIndices,
    removedLines: removedIndices.map((i) => lines[i])
  };
}

/** Exact indices where two same-length line arrays differ. */
function differingIndices(a, b) {
  const differences = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) if (a[i] !== b[i]) differences.push(i);
  return differences;
}

/**
 * Strict proof that `variant` differs from `base` ONLY within the Affect state
 * section. `removedIndices` are the indices removed (empty for P/N/Z swaps).
 */
export function auditAffectVariant(base, variant, removedIndices = []) {
  const reasons = [];
  const baseLines = base.split('\n');
  const variantLines = variant.split('\n');
  const affectIndices = new Set(affectSectionIndices(baseLines));

  if (baseLines.length === variantLines.length) {
    const differences = differingIndices(baseLines, variantLines);
    for (const index of differences) {
      if (!affectIndices.has(index)) {
        reasons.push(`line ${index} differs outside the Affect section: ${JSON.stringify(baseLines[index])}`);
      }
    }
  } else {
    for (const index of removedIndices) {
      if (!affectIndices.has(index)) reasons.push(`removed line ${index} is not part of the affect section`);
    }
    if (withoutLines(baseLines, removedIndices) !== variant) {
      reasons.push('variant is not exactly base minus removed affect lines, in order');
    }
    const removedOutside = baseLines.length - variantLines.length;
    if (removedOutside !== removedIndices.length) {
      reasons.push(`removed ${removedOutside} lines but ${removedIndices.length} affect lines were designated`);
    }
  }

  if (memorySection(base) === '') reasons.push('base request has no factual Memory section');
  if (memorySection(base) !== memorySection(variant)) reasons.push('Memory section changed');
  if (subjectDataInvariantDigest(base) !== subjectDataInvariantDigest(variant)) {
    reasons.push('non-Affect subject data digest changed');
  }
  return {
    ok: reasons.length === 0,
    reasons,
    differing_indices: baseLines.length === variantLines.length ? differingIndices(baseLines, variantLines) : []
  };
}

/** Strict proof that `absent` is exactly `base` minus the Affect section. */
export function verifyAbsentIsBaseMinusAffect(base, absent, removedIndices) {
  const reasons = [];
  const lines = base.split('\n');
  const designated = new Set(affectSectionIndices(lines));
  for (const index of removedIndices) {
    if (!designated.has(index)) reasons.push(`removed line ${index} is not part of the affect section`);
  }
  if (withoutLines(lines, removedIndices) !== absent) reasons.push('absent is not exactly base-minus-affect in order');
  if (memorySection(base) !== memorySection(absent)) reasons.push('Memory section differs after affect removal');
  if (absent.includes(AFFECT_VALUE_PREFIX)) reasons.push('absent still contains an affect value line');
  if (absent.includes(AFFECT_LEGEND_PREFIX)) reasons.push('absent still contains the affect legend');
  if (!absent.includes('[identity] subject_id=')) reasons.push('absent lost identity');
  if (!absent.includes('[projection_hash]')) reasons.push('absent lost projection_hash');
  if (!absent.includes('CITEABLE CONTEXT REFS')) reasons.push('absent lost citeable refs');
  if (!absent.includes('[ALLOWED ACTION SPACE]')) reasons.push('absent lost allowed action space');
  return { ok: reasons.length === 0, reasons };
}

const FORBIDDEN_LABEL_TOKENS = Object.freeze([
  'CONDITION_P',
  'CONDITION_N',
  'CONDITION_Z',
  'CONDITION_A',
  'AFFECT_ABSENT',
  'POSITIVE_AFFECT',
  'NEGATIVE_AFFECT',
  'NEUTRAL_AFFECT',
  'TEST_BRANCH',
  'SCENARIO_',
  'REPLICATE_',
  'ACTIVATION_LOW',
  'ACTIVATION_HIGH'
]);

/** Experimental condition/scenario labels must never reach the provider. */
export function assertNoExperimentalLabels(text) {
  const found = FORBIDDEN_LABEL_TOKENS.filter((token) => text.includes(token));
  return { ok: found.length === 0, found };
}
