/**
 * AFFECT_COGNITION_RATIONALE_VOCABULARY_AND_LATITUDE_LEGIBILITY_V0 — zero-model
 * probe assertions and the historical regression. Run: node --test probes.test.mjs
 *
 * The historical regression reads the FROZEN C4.4 qualification evidence and
 * re-classifies its R1 rationale with the unchanged instrument. It must still be
 * unlawful: old evidence is never made green.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORICAL_R1_RATIONALE, PROBES, SUBJECT_PROPERTY_TERMS, runProbes } from './probes.mjs';
import { rationaleVerdict } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const C44 = resolve(here, '..', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0');

test('the pre-registered probe suite passes with no strict divergence and no class miss', () => {
  const outcome = runProbes();
  assert.deepEqual(outcome.strict_divergences, [], 'a semantically lawful form must never be forbidden by the instrument');
  assert.deepEqual(outcome.class_expectation_misses, []);
  assert.equal(outcome.pass, true, JSON.stringify(outcome));
  assert.equal(outcome.probes.length, PROBES.length);
  assert.ok(PROBES.length >= 25, 'coverage must include the frozen minimum probe set');
});

test('the probe suite covers every channel and every semantic direction required', () => {
  const byChannel = (channel) => PROBES.filter((probe) => probe.channel === channel);
  assert.ok(byChannel('rationale').filter((probe) => probe.semantic === 'lawful').length >= 5);
  assert.ok(byChannel('rationale').filter((probe) => probe.semantic === 'forbidden').length >= 9);
  assert.ok(byChannel('claim').filter((probe) => probe.semantic === 'lawful').length >= 3);
  assert.ok(byChannel('claim').filter((probe) => probe.semantic === 'forbidden').length >= 4);
  const outcome = runProbes();
  const lawfulRationale = outcome.probes.filter((probe) => probe.channel === 'rationale' && probe.semantic_expectation === 'lawful');
  for (const probe of lawfulRationale) assert.equal(probe.lawful, true, `${probe.id} ${probe.text}`);
  const forbiddenRationale = outcome.probes.filter((probe) => probe.channel === 'rationale' && probe.semantic_expectation === 'forbidden');
  for (const probe of forbiddenRationale) assert.equal(probe.lawful, false, `${probe.id} ${probe.text}`);
  const forbiddenClaims = outcome.probes.filter((probe) => probe.channel === 'claim' && probe.semantic_expectation === 'forbidden');
  const declaredGaps = outcome.lenient_coverage_gaps.map((gap) => gap.id);
  for (const probe of forbiddenClaims) {
    if (declaredGaps.includes(probe.id)) continue; // declared instrument gap, asserted separately
    assert.equal(probe.lawful, false, `${probe.id} ${probe.text}`);
  }
  const lawfulClaims = outcome.probes.filter((probe) => probe.channel === 'claim' && probe.semantic_expectation === 'lawful');
  for (const probe of lawfulClaims) assert.equal(probe.lawful, true, `${probe.id} ${probe.text}`);
});

test('the vocabulary distinguishes availability from capability in both channels', () => {
  const outcome = runProbes();
  const pick = (id) => outcome.probes.find((probe) => probe.id === id);
  // A supplied availability fact is lawful as a claim and is not a rationale.
  assert.equal(pick('LA-1').lawful, true);
  assert.equal(pick('NR-1').lawful, false, 'a fact plus an action is not a subjective rationale');
  // The same availability restated as a subject property is unlawful in both channels.
  assert.equal(pick('FU-1').lawful, false);
  assert.equal(pick('FR-2').lawful, false);
  // Preference frames that reference availability stay lawful.
  assert.equal(pick('LR-2').lawful, true);
  assert.equal(pick('LR-3').lawful, true);
  // Fact-relative latitude is lawful; subject-relative latitude is not.
  assert.equal(pick('LT-1').lawful, true);
  assert.equal(pick('LT-2').lawful, false);
  assert.equal(pick('LT-1R').lawful, false, 'a latitude statement is not a rationale');
});

test('historical R1 regression: the frozen C4.4 rationale still fails the old contract', () => {
  const rows = readFileSync(resolve(C44, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const r1 = rows.filter((row) => row.scenario === 'R1');
  assert.equal(r1.length, 5, 'the frozen R1 cells must still be present and unmodified');
  for (const row of r1) {
    assert.equal(row.subjective_selection.subjective_rationale, HISTORICAL_R1_RATIONALE);
    const verdict = rationaleVerdict(row.subjective_selection.subjective_rationale);
    assert.equal(verdict.lawful, false, 'old evidence must not be made green');
    assert.ok(verdict.forbidden_classes.some((entry) => entry.kind === 'INFERRED_CAPACITY'));
  }
  const outcome = runProbes();
  assert.equal(outcome.historical_r1_replay.still_unlawful_under_frozen_instrument, true);
  assert.ok(outcome.historical_r1_replay.forbidden_classes.includes('INFERRED_CAPACITY'));
});

test('the lenient instrument coverage gaps are declared, not repaired', () => {
  const outcome = runProbes();
  // The frozen classifier polices a subset of the contract's named subject-property
  // vocabulary. Every gap is declared here; none is closed by editing the instrument.
  assert.deepEqual(outcome.lenient_coverage_gaps.map((gap) => gap.id), ['FU-4']);
  assert.ok(SUBJECT_PROPERTY_TERMS.includes('workload tolerance'));
  const verdict = rationaleVerdict('The subject has sufficient workload tolerance.');
  assert.equal(verdict.lawful, false, 'it is unlawful because it is not a rationale at all');
});
