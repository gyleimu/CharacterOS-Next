/* globals URL */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { equal, expectedWire, hash, requestIdentity } from '../appraisal-exact-input-reuse-shadow-v0/identity.mjs';
import { candidateCheck, comparePair } from './harness.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const unzip = name => JSON.parse(gunzipSync(readFileSync(join(root, name))).toString('utf8'));
const freeze = read('freeze.json'), collection = read('collection.json');
globalThis.fetch = async () => { throw new Error('offline verifier forbids network/model calls'); };
const journal = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.equal(journal.filter(e => e.phase === 'INFERENCE_START').length, collection.calls);
assert.equal(journal.filter(e => e.phase === 'INFERENCE_END').length, collection.calls);
assert.ok(collection.calls <= 40);
assert.equal(new Set(journal.filter(e => e.phase === 'INFERENCE_START').map(e => e.id)).size, collection.calls);
const verified = [];
let semantic = 0, replays = 0, real = 0;
for (const row of collection.samples) {
  const pair = unzip(`evidence/${row.id}-baseline.json.gz`);
  semantic += pair.semanticEntries.length;
  replays += pair.semanticEntries.filter(e => e.result === 'ALREADY_COMPLETED').length;
  const observations = row.stage === 'PAIRED_EVALUATION' ? ['A', 'B'] : ['A'];
  for (const side of observations) {
    real++;
    const call = read(`evidence/${row.id}-${side}.json`);
    assert.equal(call.wire_calls, 1);
    assert.ok(equal(call.wire, expectedWire(call.request, freeze.metadata.config)));
    assert.equal(call.trace.request_hash, hash(JSON.stringify(call.wire.body)));
    assert.ok(equal(call.identity, requestIdentity(call.wire, freeze.metadata.environment)));
    assert.equal(call.latency_ms, Math.max(0, call.client_latency_ms - call.instrumentation_measured_ms));
    if (call.response) {
      assert.equal(call.trace.outcome, 'SUCCESS');
      assert.equal(call.raw_envelope.message.content, call.response.content);
      assert.equal(call.raw_envelope.model, freeze.metadata.config.model);
      assert.equal(call.raw_envelope.done, true);
      assert.ok(equal(await candidateCheck(call.response.content, call.context), row[`candidate_${side}`]));
    }
  }
  if (row.stage === 'PAIRED_EVALUATION') {
    const state = unzip(`evidence/${row.id}-S.json.gz`), stored = unzip(`evidence/${row.id}-comparison.json.gz`);
    assert.ok(equal(state, pair.beforeSecond));
    const saveIndex = journal.findIndex(e => e.phase === 'PRE_B_STATE_PERSISTED' && e.id === row.id);
    const bIndex = journal.findIndex(e => e.phase === 'INFERENCE_START' && e.id === `${row.id}-B`);
    assert.ok(saveIndex >= 0 && saveIndex < bIndex);
    assert.equal(journal[saveIndex].state_hash, hash(state));
    const a = read(`evidence/${row.id}-A.json`), b = read(`evidence/${row.id}-B.json`);
    assert.ok(equal(a.identity, b.identity)); assert.notEqual(a.context.factual_event_ref, b.context.factual_event_ref);
    const replay = await comparePair(pair, a.identity);
    assert.ok(equal(replay, stored), 'independent real-authority replay differs from archived comparison');
    assert.equal(replay.authorityEqual, row.authority_equal); assert.equal(replay.canonicalEqual, row.canonical_equal);
    assert.equal(replay.projectionEqual, row.downstream === 'DOWNSTREAM_EQUIVALENT');
    verified.push({ id: row.id, exact_pre_state: true, persisted_before_B: true, exact_replay: true, classifications: replay.classifications });
  } else {
    assert.equal(row.candidate_A.valid, false); assert.equal(pair.beforeSecond, null);
    assert.equal(journal.some(e => e.id === `${row.id}-B`), false);
    verified.push({ id: row.id, failed_A_retained: true, B_not_invoked: true });
  }
}
assert.equal(real, collection.calls);
assert.equal(execFileSync('git', ['diff', freeze.baseline, '--name-only', '--', 'research/experiments/appraisal-exact-input-reuse-shadow-v0', 'packages', 'product'], { encoding: 'utf8' }).trim(), '');
const counters = { semantic_appraisal_invocations: semantic, already_completed_replay_invocations: replays,
  initial_event_evaluations: semantic - replays, deterministic_setup_candidates: collection.started_samples,
  real_appraisal_inferences: collection.calls, reuse_eligible: collection.evaluated_pairs, baseline_reuse_hits: 0,
  isolated_shadow_reuse_hits: collection.evaluated_pairs, reuse_misses: 0,
  reuse_rejected: collection.samples.filter(r => r.stage === 'PAIRED_EVALUATION' && r.shadow_status === 'FAILED').length,
  invalid_first_candidates_not_reused: collection.samples.filter(r => r.stage === 'FIRST_INFERENCE_FAILED').length,
  shadow_inferences: 0, counter_scope: 'Collected baseline lifecycles and one archived shadow branch per reached B. Adversarial test counters excluded.' };
writeFileSync(join(root, 'verification.json'), JSON.stringify({ result: 'PASS', model_calls: 0, network_calls: 0, V0_unchanged: true, production_unchanged: true, verified, counters }, null, 2) + '\n');
console.log(JSON.stringify({ result: 'PASS', verified_samples: verified.length, verified_pairs: collection.evaluated_pairs, model_calls: 0 }));
