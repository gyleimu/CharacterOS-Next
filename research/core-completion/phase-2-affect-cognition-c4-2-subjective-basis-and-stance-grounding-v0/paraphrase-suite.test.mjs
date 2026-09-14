/**
 * C4.2 — the ONE permitted evaluation of the candidate lexical grounding guard
 * against the frozen paraphrase suite. Zero model calls. No tuning.
 *
 * Run: node --test paraphrase-suite.test.mjs
 * Writes: lexical-guard-evaluation.json
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentTokens, groundingVerdict } from './lib/grounding-guard.mjs';
import { ACCEPTANCE_STANDARD, INVALID, LAWFUL, LEXICAL_CEILING_DIAGNOSTIC } from './paraphrase-suite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const evaluate = (entry) => ({ id: entry.id, category: entry.category, request: entry.request, stance: entry.stance, ...groundingVerdict(entry.stance, entry.request, []) });

const lawfulResults = LAWFUL.map(evaluate);
const invalidResults = INVALID.map(evaluate);
const ceilingResults = LEXICAL_CEILING_DIAGNOSTIC.map((entry) => ({ ...evaluate(entry), expected: 'OFF_QUESTION_BUT_LEXICALLY_OVERLAPPING' }));

const lawfulAccepted = lawfulResults.filter((r) => r.grounded);
const lawfulRejected = lawfulResults.filter((r) => !r.grounded);
const invalidDetected = invalidResults.filter((r) => !r.grounded);
const invalidMissed = invalidResults.filter((r) => r.grounded);
const ceilingUndetectable = ceilingResults.filter((r) => r.grounded);

const passed = invalidDetected.length === ACCEPTANCE_STANDARD.invalid_required
  && lawfulAccepted.length >= ACCEPTANCE_STANDARD.lawful_required;

const evaluation = {
  schema_version: 'affect-cognition-c4-2-lexical-guard-evaluation-v0',
  suite_sha256: JSON.parse(readFileSync(resolve(here, 'paraphrase-suite-freeze.json'), 'utf8')).suite.suite_sha256,
  model_calls: 0,
  rule: 'grounded = shares >= 1 content token with (request text UNION lawful claim texts)',
  scores: {
    lawful_accepted: lawfulAccepted.length,
    lawful_total: LAWFUL.length,
    lawful_rejected: lawfulRejected.length,
    invalid_detected: invalidDetected.length,
    invalid_total: INVALID.length,
    invalid_missed: invalidMissed.length,
    lexical_ceiling_undetectable: ceilingUndetectable.length,
    lexical_ceiling_total: LEXICAL_CEILING_DIAGNOSTIC.length
  },
  acceptance_standard: ACCEPTANCE_STANDARD,
  shipped: passed,
  recorded_flag: passed ? null : 'LEXICAL_GROUNDING_GUARD_TOO_BRITTLE',
  lawful_rejections: lawfulRejected.map((r) => ({ id: r.id, category: r.category, stance: r.stance, stance_tokens: r.stance_tokens, request: r.request.slice(0, 90) })),
  invalid_misses: invalidMissed.map((r) => ({ id: r.id, category: r.category, stance: r.stance, shared: r.shared_tokens })),
  lexical_ceiling: ceilingResults.map((r) => ({ id: r.id, stance: r.stance, shared: r.shared_tokens })),
  per_case: { lawful: lawfulResults, invalid: invalidResults }
};
writeFileSync(resolve(here, 'lexical-guard-evaluation.json'), `${JSON.stringify(evaluation, null, 2)}\n`);

process.stdout.write(`lawful accepted ${lawfulAccepted.length}/${LAWFUL.length} (need >= ${ACCEPTANCE_STANDARD.lawful_required})\n`);
process.stdout.write(`invalid detected ${invalidDetected.length}/${INVALID.length} (need ${ACCEPTANCE_STANDARD.invalid_required})\n`);
process.stdout.write(`lexical-ceiling undetectable ${ceilingUndetectable.length}/${LEXICAL_CEILING_DIAGNOSTIC.length}\n`);
process.stdout.write(`lawful rejected: ${lawfulRejected.map((r) => `${r.id}:${r.category}`).join(', ') || 'none'}\n`);
process.stdout.write(`invalid missed: ${invalidMissed.map((r) => `${r.id}:${r.category}`).join(', ') || 'none'}\n`);
process.stdout.write(`VERDICT: ${passed ? 'SHIP' : evaluation.recorded_flag}\n`);

test('the frozen suite is structurally sound (40 lawful / 20 invalid, unique ids)', () => {
  assert.equal(LAWFUL.length, 40);
  assert.equal(INVALID.length, 20);
  assert.equal(new Set([...LAWFUL, ...INVALID].map((entry) => entry.id)).size, 60);
  assert.ok(LAWFUL.every((entry) => entry.request.length > 0 && entry.stance.length > 0));
  assert.equal(ACCEPTANCE_STANDARD.invalid_required, 20);
});

test('content-token extraction is deterministic and stopword-aware', () => {
  assert.deepEqual(contentTokens('I would attend the planning meeting.'), ['attend', 'planning', 'meeting']);
  assert.deepEqual(contentTokens("I'd be up for it."), []);
  assert.deepEqual(contentTokens('REALIZE_CURRENT_INTENT'), ['realize', 'current', 'intent']);
  assert.deepEqual(contentTokens('   '), []);
});

test('the guard evaluation was performed once and its outcome is recorded', () => {
  assert.ok(evaluation.scores.lawful_total === 40 && evaluation.scores.invalid_total === 20);
  if (!passed) assert.equal(evaluation.recorded_flag, 'LEXICAL_GROUNDING_GUARD_TOO_BRITTLE');
});
