/* globals URL */
/**
 * AFFECT_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — deterministic harness laws
 * (node --test, zero real calls).
 *
 * Run: node --test research.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCanonicalAffectShape } from '../../../packages/subject-core/dist/index.js';
import { CONDITIONS, REPLICATES, activationSchedule, primarySchedule } from './lib/config.mjs';
import { hashJson, memorySection } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  assertNoExperimentalLabels,
  auditAffectVariant,
  removeAffectSection,
  swapAffectValue,
  verifyAbsentIsBaseMinusAffect,
  affectValueLine
} from '../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import { classifyAffectBehavior, classifyNullBehavior } from './lib/classify.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');

test('condition values are valid canonical Affect; absent is not neutral', () => {
  for (const id of ['P', 'N', 'Z']) {
    const check = validateCanonicalAffectShape({ schema_version: 'canonical-affect-v0', valence: CONDITIONS[id].valence, activation: CONDITIONS[id].activation });
    assert.equal(check.ok, true, `${id}`);
  }
  assert.equal(CONDITIONS.A.kind, 'ABSENT');
});

test('schedules are balanced and deterministic', () => {
  const schedule = primarySchedule(REPLICATES);
  assert.equal(schedule.length, REPLICATES * 4);
  for (let r = 0; r < REPLICATES; r += 1) {
    assert.deepEqual([...schedule.slice(r * 4, r * 4 + 4)].sort(), ['A', 'N', 'P', 'Z']);
  }
  assert.equal(activationSchedule(REPLICATES).length, REPLICATES * 2);
});

test('final-behavior classifier precedence is frozen and deterministic', () => {
  assert.equal(classifyAffectBehavior('Could you clarify what you mean?'), 'ASK_FOR_CLARIFICATION');
  assert.equal(classifyAffectBehavior("I can't take that on this week."), 'REALIZE_DECLINE');
  assert.equal(classifyAffectBehavior('It depends on the deadline.'), 'REALIZE_CAUTIOUS');
  assert.equal(classifyAffectBehavior('Yes, I would be happy to help.'), 'REALIZE_SUPPORT');
  assert.equal(classifyAffectBehavior('Noted.'), 'REALIZE_OTHER');
  assert.equal(classifyNullBehavior('42', 'The sum of 17 and 25 is 42.'), 'CORRECT_42');
  assert.equal(classifyNullBehavior('42', 'I cannot answer that.'), 'INCORRECT_OR_OTHER');
  assert.equal(classifyNullBehavior('MATCH', 'The token is a MATCH.'), 'CORRECT_MATCH');
  assert.equal(classifyNullBehavior('BBCB', 'AACA -> BBCB'), 'CORRECT_BBCB');
});

test('isolation helpers preserve Memory and the non-Affect invariant on a synthetic request', () => {
  const base = [
    '[identity] subject_id="s"',
    '[context] scene="x" task="y"',
    '[affect (canonical)] valence=0.1 activation=0.2',
    '[affect (canonical) legend] Canonical affect is a continuous internal state.',
    '[PRIOR FACTUAL MEMORY — validated]',
    '[BEGIN HISTORICAL FACTUAL CONTENT]',
    '- episode_ref: "episode:x"',
    '[END HISTORICAL FACTUAL CONTENT]',
    'CITEABLE CONTEXT REFS (only the exact refs listed below may appear in relevant_memory_refs, considered_context_refs, or evidence_refs):',
    '[ALLOWED ACTION SPACE]',
    '[projection_hash] sha256:abc'
  ].join('\n');
  for (const id of ['P', 'N', 'Z']) {
    const variant = swapAffectValue(base, affectValueLine(CONDITIONS[id].valence, CONDITIONS[id].activation));
    assert.equal(auditAffectVariant(base, variant.transformed, []).ok, true);
  }
  const absent = removeAffectSection(base);
  assert.equal(verifyAbsentIsBaseMinusAffect(base, absent.transformed, absent.removedIndices).ok, true);
  assert.equal(memorySection(base), memorySection(absent.transformed));
  assert.equal(assertNoExperimentalLabels(base).ok, true);
});

test('freeze.json is present, hashed and internally consistent (when prepared)', () => {
  const path = join(evidenceDir, 'freeze.json');
  if (!existsSync(path)) return;
  const freeze = JSON.parse(readFileSync(path, 'utf8'));
  const { freeze_hash: recorded, ...body } = freeze;
  assert.equal(recorded, hashJson(body));
  assert.equal(freeze.replicates, REPLICATES);
  assert.equal(freeze.protocol, 'conversation-cognition-proposal-v2 + language-realization-input-v3');
  assert.equal(freeze.scenarios.length, 10);
});

test('request attestation proves only Affect differs (when prepared)', () => {
  const path = join(evidenceDir, 'request-attestation.json');
  if (!existsSync(path)) return;
  const attestation = JSON.parse(readFileSync(path, 'utf8'));
  for (const [scenarioId, entry] of Object.entries(attestation.scenarios)) {
    assert.equal(entry.ok, true, `${scenarioId}: ${entry.problems.join('; ')}`);
    assert.equal(entry.conditions.P.memory_section_sha256, entry.conditions.A.memory_section_sha256);
    assert.equal(entry.conditions.P.invariant_digest, entry.conditions.A.invariant_digest);
    assert.equal(entry.conditions.A.removed_indices.length, 2);
    assert.equal(entry.conditions.P.differing_indices.length, 1);
  }
});
