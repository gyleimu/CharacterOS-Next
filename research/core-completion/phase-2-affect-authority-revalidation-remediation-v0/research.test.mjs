import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(resolve(here, name), 'utf8'));

test('run-of-record and lawful evidence are complete and bounded', async () => {
  const collection = await readJson('collection-primary.json');
  const lawful = await readJson('lawful-confirmation.json');
  assert.equal(collection.recorded_records, 364);
  assert.equal(collection.cognition_calls, 364);
  assert.equal(collection.infrastructure_retries, 0);
  assert.equal(lawful.total_cognition_calls, 10);
  assert.equal(lawful.infrastructure_retries, 0);
});

test('structured output is reliable but the qualified null aggregate fails 167/168', async () => {
  const summary = await readJson('analysis-summary.json');
  assert.equal(summary.structured_output_reliability_passed, true);
  assert.deepEqual(summary.null, { correct: 167, total: 168 });
  assert.equal(summary.qualified_symbolic_null.correct, 28);
  assert.equal(summary.qualified_symbolic_null.total, 28);
  assert.equal(summary.principal_verdict, 'AFFECT_AUTHORITY_CONTRACT_FACTUAL_BOUNDARY_FAILED');
});

test('mixed facts remain invariant while subjective latitude remains observable', async () => {
  const summary = await readJson('analysis-summary.json');
  assert.deepEqual(summary.mixed_facts, { correct: 84, total: 84 });
  assert.ok(summary.mixed_subjective_variation.includes('M1_DEADLINE_AND_VOLUNTEER'));
  assert.ok(summary.mixed_subjective_variation.includes('M3_WEIGHT_AND_CARRYING'));
});

test('request isolation and lawful restore confirmation hold', async () => {
  const summary = await readJson('analysis-summary.json');
  assert.equal(summary.request_isolation.pass, true);
  assert.equal(summary.lawful_persistent_affect_passed, true);
  for (const state of Object.values(summary.lawful)) {
    assert.equal(state.round_trip, true);
    assert.equal(state.schema_valid, 5);
    assert.equal(state.executor_valid, 5);
    assert.equal(state.delivered, 5);
  }
});
