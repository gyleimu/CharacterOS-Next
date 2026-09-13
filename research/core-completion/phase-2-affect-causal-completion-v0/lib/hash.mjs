/**
 * Shared hashing + section extraction helpers (research harness only).
 * Uses the SAME `sha256:<hex>` convention and byte inputs the production
 * request-identity audit uses.
 */

import { createHash } from 'node:crypto';

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

/** Canonical sorted-key JSON (stable across key insertion order). */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashJson(value) {
  return sha256(canonicalJson(value));
}

/** Exact production request-identity body (subject-session-v0.ts requestIdentity). */
export function requestIdentityBody({ model, systemContent, userContent, numPredict, contextWindowTokens }) {
  const options = { temperature: 0, num_predict: numPredict };
  if (contextWindowTokens !== undefined) options.num_ctx = contextWindowTokens;
  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ],
    think: false,
    stream: false,
    options
  });
}

const MEMORY_START = '[PRIOR FACTUAL MEMORY';
const MEMORY_END = '[END HISTORICAL FACTUAL CONTENT]';

/** The shared factual-Memory section, byte-exact. Empty string when absent. */
export function memorySection(text) {
  const start = text.indexOf(MEMORY_START);
  if (start < 0) return '';
  const end = text.indexOf(MEMORY_END, start);
  return end < 0 ? text.slice(start) : text.slice(start, end + MEMORY_END.length);
}

/** Everything except the removed lines, concatenated back (no reordering). */
export function withoutLines(lines, removedIndices) {
  const removed = new Set(removedIndices);
  return lines.filter((_, index) => !removed.has(index)).join('\n');
}

/** Identity/task/scene/observation/citeable/action-space digest of a request. */
export function subjectDataInvariantDigest(userContent) {
  const lines = userContent.split('\n');
  const keep = lines.filter((line) => {
    const t = line.trimStart();
    if (t.startsWith('[affect (canonical)]')) return false;
    if (t.startsWith('[affect (canonical) legend]')) return false;
    if (t.startsWith('[affect]')) return false;
    if (t.startsWith('[mood]')) return false;
    if (t.startsWith('[projection_hash]')) return false;
    return true;
  });
  return sha256(keep.join('\n'));
}
