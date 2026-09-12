/* globals URL */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { comparePair, preparePair } from './harness.mjs';
import { candidateFromRaw, equal, hash, requestIdentity } from './identity.mjs';
import { FactualEventAppraisalExecutorV0 } from '../../../packages/runtime/dist/factual-event-appraisal/factual-event-appraisal-executor.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'));
const freeze = read('freeze.json'), collection = read('collection.json');
globalThis.fetch = async () => { throw new Error('offline evidence verifier forbids network/model calls'); };
assert.equal(collection.collection_failure.sample, 'S06');
assert.equal(collection.calls, 11);
assert.equal(collection.completed_pairs, 5);
const journal = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.equal(journal.filter(e => e.phase === 'START').length, 11);
assert.equal(journal.filter(e => e.phase === 'END').length, 11);
assert.equal(new Set(journal.filter(e => e.phase === 'START').map(e => e.call_id)).size, 11);
const outputs = [];
for (const row of collection.samples) {
  const stored = JSON.parse(gunzipSync(readFileSync(join(root, `evidence/${row.id}-state.json.gz`))).toString('utf8'));
  const a = read(`evidence/${row.id}-A.json`), b = read(`evidence/${row.id}-B.json`);
  for (const call of [a, b]) {
    assert.equal(call.error, null);
    assert.equal(call.wire_calls, 1);
    assert.equal(call.trace.outcome, 'SUCCESS');
    assert.equal(call.trace.request_hash, hash(JSON.stringify(call.wire.body)));
    assert.equal(call.raw_envelope.model, freeze.metadata.config.model);
    assert.equal(call.raw_envelope.done, true);
    assert.notEqual(call.raw_envelope.done_reason, 'length');
    assert.equal(call.raw_envelope.message.content, call.response.content);
    assert.ok(equal(call.identity, requestIdentity(call.wire, freeze.metadata.environment)));
    assert.ok(Number.isFinite(call.latency_ms) && call.latency_ms > 0);
  }
  assert.ok(equal(a.identity, b.identity));
  assert.equal(stored.pair.raw[1], a.response.content);
  assert.equal(stored.pair.raw[2], b.response.content);
  assert.ok(equal(await candidateFromRaw(a.response.content, a.context), row.candidate_A));
  assert.ok(equal(await candidateFromRaw(b.response.content, b.context), row.candidate_B));
  const replay = await comparePair(stored.pair);
  assert.ok(equal(replay, stored.comparison), 'independent offline authority replay must exactly reproduce archived paths');
  assert.equal(hash(replay.control.after), row.canonical_control_hash);
  assert.equal(hash(replay.shadow.after), row.canonical_shadow_hash);
  outputs.push({ sample: row.id, exact_offline_replay: true, pre_state: replay.control.preHash, canonical_equal: replay.canonicalEqual, projection_equal: replay.projectionEqual });
}
const malformed = read('evidence/S06-A.json');
assert.equal(malformed.raw_envelope.message.content, malformed.response.content);
assert.equal(malformed.trace.outcome, 'SUCCESS', 'transport success does not imply valid candidate');
await assert.rejects(() => candidateFromRaw(malformed.response.content, malformed.context), /unexpected key set/);
assert.equal(journal.some(e => e.call_id === 'S06-B'), false);
// Count actual executor entries in a separate offline replay, distinguishing
// semantic invocations from the provider's already-completed event replay.
const entries = [];
const originalAppraise = FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent;
FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent = async function (ctx, input) {
  const entry = { subject_id: input.subject_id, source_event_id: input.source_event_id, result: null };
  entries.push(entry);
  try { const result = await originalAppraise.call(this, ctx, input); entry.result = result.kind; return result; }
  catch (error) { entry.result = 'THREW'; throw error; }
};
try {
  for (const sample of freeze.protocol.samples.slice(0, 6)) {
    const run = () => preparePair(sample.text, async side => read(`evidence/${sample.id}-${side}.json`).response.content, `reuse-${sample.id.toLowerCase()}`);
    if (sample.id === 'S06') await assert.rejects(run, /unexpected key set/);
    else await run();
  }
} finally { FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent = originalAppraise; }
assert.equal(entries.length, 28);
assert.equal(entries.filter(e => e.source_event_id !== 'turn-0').length, 16);
assert.equal(entries.filter(e => e.result === 'ALREADY_COMPLETED').length, 11);
const counters = { scope: 'Six started baseline two-turn lifecycles; offline entry accounting replays the recorded candidates with zero inference.',
  semantic_appraisal_invocations: entries.length, later_turn_semantic_appraisal_invocations: 16,
  already_completed_replay_invocations: 11, distinct_model_backed_event_evaluations: 17,
  deterministic_setup_candidates: 6, real_appraisal_inferences: collection.calls,
  eligible_reuse_opportunities: 5, exact_request_matches: 5, reuse_misses: 0, invalid_reuse_attempts: 0,
  malformed_first_candidates: 1, second_stage_not_reached: 1, control_replay_deliveries: 5, shadow_candidate_deliveries: 5, shadow_real_inferences: 0 };
writeFileSync(join(root, 'verification.json'), JSON.stringify({ result: 'PASS', empirical_collection: 'INCOMPLETE_AS_PREREGISTERED_ON_MALFORMED_A', verified_pairs: outputs.length, malformed_first_result: 'REJECTED_NO_B_CALL', model_calls: 0, network_calls: 0, counters, executor_entries: entries, samples: outputs }, null, 2) + '\n');
console.log(JSON.stringify({ result: 'PASS', verified_pairs: outputs.length, malformed_first_result: 'REJECTED_NO_B_CALL', model_calls: 0, network_calls: 0 }));
