/**
 * Research-only projection ablation.
 *
 * Ablation happens at the RENDERED-REQUEST level: it removes exactly the
 * SUBJECT DATA lines whose production renderer emits a designated non-Memory
 * psychological section. Canonical subject state is never read or written here;
 * the production projection_hash is deliberately preserved as a lineage
 * identifier so the request diff is limited strictly to the removed sections.
 *
 * `verifyAblation` is a strict, machine-checkable proof that the ablated request
 * equals the full request minus exactly the designated lines, in order.
 */

import { memorySection, withoutLines } from './hash.mjs';

/**
 * Designated non-Memory sections. `block: true` means the header line starts a
 * multi-line block that continues until the next `[`-prefixed header line.
 */
export const DESIGNATED_SECTIONS = Object.freeze([
  Object.freeze({ prefix: '[affect (canonical)]', block: false }),
  Object.freeze({ prefix: '[affect]', block: false }),
  Object.freeze({ prefix: '[mood]', block: false }),
  Object.freeze({ prefix: '[regulation]', block: false }),
  Object.freeze({ prefix: '[SUBJECTIVE BELIEF STANCES', block: true }),
  Object.freeze({ prefix: '[relationships]', block: false }),
  Object.freeze({ prefix: '[interaction familiarity —', block: true }),
  Object.freeze({ prefix: '[interaction familiarity cognition influence —', block: true }),
  Object.freeze({ prefix: '[traits seed (read-only evidence)]', block: false }),
  Object.freeze({ prefix: '[current acquired personality (read-only;', block: false }),
  Object.freeze({ prefix: '[current acquired personality semantics', block: false }),
  Object.freeze({ prefix: '[personality disposition role —', block: false })
]);

export const AFFECT_PREFIXES = Object.freeze(['[affect (canonical)]', '[affect]', '[mood]']);

function matchSection(line) {
  const trimmed = line.trimStart();
  for (const section of DESIGNATED_SECTIONS) {
    if (trimmed.startsWith(section.prefix)) return section;
  }
  return null;
}

/** Indices of lines that a full-ablation removes. */
export function designatedLineIndices(lines) {
  const removed = [];
  for (let index = 0; index < lines.length; index += 1) {
    const section = matchSection(lines[index]);
    if (section === null) continue;
    removed.push(index);
    if (section.block) {
      let cursor = index + 1;
      while (cursor < lines.length && !lines[cursor].trimStart().startsWith('[')) {
        removed.push(cursor);
        cursor += 1;
      }
      index = cursor - 1;
    }
  }
  return removed;
}

/** Indices of only the canonical affect line(s). */
export function affectLineIndices(lines) {
  const removed = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trimStart();
    if (AFFECT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) removed.push(index);
  }
  return removed;
}

function ablate(userContent, indicesOf) {
  const lines = userContent.split('\n');
  const removedIndices = indicesOf(lines);
  return {
    ablated: withoutLines(lines, removedIndices),
    removedIndices,
    removedLines: removedIndices.map((index) => lines[index])
  };
}

export function ablateAllDesignated(userContent) {
  return ablate(userContent, designatedLineIndices);
}

export function ablateAffectOnly(userContent) {
  return ablate(userContent, affectLineIndices);
}

/**
 * Strict proof that `ablated` is exactly `full` minus `removedIndices`.
 * Returns { ok, reasons }. Any failing reason invalidates the experiment.
 */
export function verifyAblation(full, ablated, removedIndices, { allowedIndices } = {}) {
  const reasons = [];
  const lines = full.split('\n');
  const allowed = new Set(allowedIndices ?? designatedLineIndices(lines));

  for (const index of removedIndices) {
    if (index < 0 || index >= lines.length) reasons.push(`removed index ${index} out of range`);
    else if (!allowed.has(index)) reasons.push(`removed line ${index} is not designated: ${JSON.stringify(lines[index])}`);
  }

  if (withoutLines(lines, removedIndices) !== ablated) reasons.push('ablated text is not full-minus-removed in order');
  const reinserted = [...ablated.split('\n')];
  for (const index of [...removedIndices].sort((a, b) => a - b)) {
    reinserted.splice(index, 0, lines[index]);
  }
  if (reinserted.join('\n') !== full) reasons.push('reinsertion of removed lines does not reconstruct full');

  const fullMemory = memorySection(full);
  const ablatedMemory = memorySection(ablated);
  if (fullMemory !== ablatedMemory) reasons.push('shared Memory section differs after ablation');
  if (fullMemory === '') reasons.push('full request has no factual Memory section');

  if (!ablated.includes('[identity] subject_id=')) reasons.push('ablated request lost identity');
  if (!ablated.includes('[projection_hash]')) reasons.push('ablated request lost projection_hash');
  if (!ablated.includes('CITEABLE CONTEXT REFS')) reasons.push('ablated request lost citeable refs');
  if (!ablated.includes('[ALLOWED ACTION SPACE]')) reasons.push('ablated request lost allowed action space');

  return { ok: reasons.length === 0, reasons };
}

/** Replace the canonical affect line with a lawfully-produced affect line. */
export function swapAffectLine(userContent, replacementLine) {
  const lines = userContent.split('\n');
  const indices = affectLineIndices(lines);
  if (indices.length !== 1) {
    throw new Error(`swapAffectLine: expected exactly one affect line, found ${indices.length}`);
  }
  const original = lines[indices[0]];
  lines[indices[0]] = replacementLine;
  return { swapped: lines.join('\n'), original, replacement: replacementLine };
}
