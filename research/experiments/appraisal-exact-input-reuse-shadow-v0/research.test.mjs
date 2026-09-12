/* globals Response, DOMException, structuredClone, URL */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ExplicitV4SessionAuthorityV0 } from '../../../packages/runtime/dist/session/explicit-v4-session-authority-v0.js';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/providers/cognition/ollama-native-cognition-transport.js';
import { createProductAppraisalProviderV0 } from '../../../product/sandbox/dist/product-appraisal-provider.js';
import { adapterForRaw, candidateFromRaw, equal, expectedWire, FIXED_CANDIDATE, hash, inferIntoSlot, requestIdentity, TurnSlot } from './identity.mjs';
import { capture, comparePair, continueSecond, options, preparePair, restore } from './harness.mjs';

const raw = JSON.stringify(FIXED_CANDIDATE);
const scope = { subject: 'reuse-research', human_turn: '1', process: 'process-1', restart: 'restart-1', provider_instance: 'provider-1' };
const config = { base_url: 'http://127.0.0.1:11434', model: 'test', timeout_ms: 10 };
const environment = { provider_implementation: 'OllamaNativeCognitionTransportV0', model_digest: 'test-digest', server_version: 'test', model_configuration: {}, timeout_ms: 10, response_format: 'ABSENT' };
const pair = await preparePair('The train arrives at noon.', async () => raw);
const wire = expectedWire(pair.requests[1], config);
const identity = requestIdentity(wire, environment);
const context = pair.contexts[1];
const evidence = {};

test('actual runtime first turn has one inference; later pair has equal requests, distinct events and contexts', () => {
  assert.equal(pair.contexts.length, 3);
  assert.ok(equal(pair.requests[1], pair.requests[2]));
  assert.notEqual(pair.contexts[1].factual_event_ref, pair.contexts[2].factual_event_ref);
  assert.notEqual(pair.contexts[1].context_projection_hash, pair.contexts[2].context_projection_hash);
  evidence.first_turn = { inferences: 1, opportunities: 0 };
});
test('both isolated clones start from exact S; real validation, Learning and Affect; persistence/projection exact', async () => {
  const result = await comparePair(pair);
  assert.ok(result.authorityEqual && result.canonicalEqual && result.projectionEqual);
  assert.deepEqual(result.control.appended.map(b => b.transition_type), ['Learning', 'AffectApplication']);
  assert.notEqual(pair.contexts[1].factual_event_ref, result.shadow.proposals[0].factual_event_ref);
  assert.equal(result.shadow.after.pending.length, 0);
  evidence.equivalent = { state_hash: result.control.preHash, canonical: result.canonicalEqual, projection: result.projectionEqual, baseline_restore_identity_differences: result.baselineRestoreDiff };
});
test('sensitivity positive control: different valid candidate changes canonical Affect and real V2 projection', async () => {
  const varied = await preparePair('You broke my trust.', async side => side === 'A' ? raw : JSON.stringify({ ...FIXED_CANDIDATE, goal_congruence: 0, intensity: 0.9 }));
  const result = await comparePair(varied);
  assert.equal(result.authorityEqual, true);
  assert.equal(result.canonicalEqual, false);
  assert.equal(result.affectEqual, false);
  assert.equal(result.projectionEqual, false);
  evidence.sensitivity = { classification: result.classification, projection_differences: result.projectionDiff, affect_control: result.control.after.snapshot.affect, affect_shadow: result.shadow.after.snapshot.affect };
});
test('all effective request differences miss, normalized identity checks defeated simulated hash collision', async () => {
  const slot = new TurnSlot(scope);
  assert.equal(await slot.offer(identity, raw, context), true);
  assert.deepEqual(slot.get(scope, identity), FIXED_CANDIDATE);
  const variants = [
    w => { w.body.model += '-changed'; }, w => { w.endpoint += '/other'; },
    w => { w.body.messages.reverse(); }, w => { w.body.messages[0].content += '\nChanged prompt.'; },
    w => { w.body.options.num_predict++; }, w => { w.body.options.num_ctx++; },
    w => { w.body.options.temperature = 0.2; }, w => { w.body.think = true; },
    w => { w.body.stream = true; }, w => { w.body.format = 'json'; }, w => { w.body.options.seed = 42; },
    w => { w.body.keep_alive = 0; }, w => { w.body.messages[1].content += ' changed'; }
  ];
  for (const mutate of variants) {
    const changed = structuredClone(wire); mutate(changed);
    const id = requestIdentity(changed, environment);
    assert.notEqual(id.fingerprint, identity.fingerprint);
    assert.equal(slot.get(scope, id), null);
    assert.equal(slot.get(scope, { ...id, fingerprint: identity.fingerprint }), null);
  }
  for (const key of Object.keys(environment)) {
    const id = requestIdentity(wire, { ...environment, [key]: 'changed' });
    assert.notEqual(id.fingerprint, identity.fingerprint); assert.equal(slot.get(scope, id), null);
  }
  for (const key of Object.keys(scope)) assert.equal(slot.get({ ...scope, [key]: 'other' }, identity), null);
  evidence.firewalls = { scope_dimensions: Object.keys(scope), request_variations: variants.length, environment_dimensions: Object.keys(environment), collision: 'MISS' };
});
test('lawful task and scene misses; null task abstains before provider without inventing candidate', async () => {
  const requests = [];
  const provider = createProductAppraisalProviderV0({ transport: { complete: async request => { requests.push(request); return { content: raw, model: 'test' }; } } }).provider;
  const authority = await ExplicitV4SessionAuthorityV0.createFresh(options(provider));
  const situations = [{ scene: 'A package arrived.', task: 'Respond to the message.' }, { scene: 'A package arrived.', task: 'Clarify the delivery details.' }, { scene: 'The package is missing.', task: 'Clarify the delivery details.' }, { scene: 'No current task.', task: null }];
  for (const [index, situation] of situations.entries()) {
    const admitted = await authority.admitFactualEvent(`miss-${index}`, situation.scene, index, situation);
    authority.enqueuePending({ ...admitted, source_event_id: `miss-${index}`, kind: 'PRIMARY' });
    if (situation.task === null) await assert.rejects(() => authority.completePendingLifecycleWork(), /NOT_ELIGIBLE/);
    else await authority.completePendingLifecycleWork();
  }
  assert.equal(requests.length, 3);
  const identities = requests.map(r => requestIdentity(expectedWire(r, config), environment));
  assert.notEqual(identities[0].fingerprint, identities[1].fingerprint);
  assert.notEqual(identities[1].fingerprint, identities[2].fingerprint);
  const image = await capture(authority);
  assert.ok(image.store.revisions.flatMap(r => r.payloads).some(p => p.payload.schema_version === 'factual-event-appraisal-abstention-record-v0'));
  evidence.lawful_misses = { task: 'MISS', scene: 'MISS', null_task_provider_calls: 0, null_task_appraisal: 'DURABLE_ABSTENTION', subsequent_session_affect: 'NOT_ELIGIBLE (preserved existing behavior)' };
});
test('closed parser/range validation prevents malformed, extra authority, out-of-range and abstention slots', async () => {
  const malformed = ['{', '{}', 'null', JSON.stringify({ ...FIXED_CANDIDATE, subject_id: 'foreign' }), JSON.stringify({ ...FIXED_CANDIDATE, relevance: 2 }), JSON.stringify({ ...FIXED_CANDIDATE, attribution: 'unknown' }), JSON.stringify({ ...FIXED_CANDIDATE, intensity: '0.5' }), JSON.stringify({ status: 'ABSTAINED_INSUFFICIENT_CONTEXT' })];
  for (const content of malformed) {
    const slot = new TurnSlot(scope);
    assert.equal(await slot.offer(identity, content, context), false);
    assert.equal(slot.get(scope, identity), null);
  }
  assert.deepEqual(await candidateFromRaw(raw, context), FIXED_CANDIDATE);
  evidence.malformed = { cases: malformed.length, cached: 0 };
});
test('actual native wire identity and timeout/unavailable/truncation fail without candidate or retry', async () => {
  const originalFetch = globalThis.fetch;
  const outcomes = [];
  try {
    for (const mode of ['success', 'timeout', 'unavailable', 'truncated']) {
      let calls = 0, observed;
      globalThis.fetch = async (endpoint, init) => {
        calls++; observed = { endpoint, method: init.method, headers: init.headers, body: JSON.parse(init.body) };
        if (mode === 'unavailable') throw new Error('test connection unavailable');
        if (mode === 'timeout') return new Promise((resolve, reject) => { void resolve; init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); });
        return new Response(JSON.stringify({ model: 'test', message: { content: raw }, done: true, done_reason: mode === 'truncated' ? 'length' : 'stop' }), { status: 200 });
      };
      const slot = new TurnSlot(scope);
      const transport = new OllamaNativeCognitionTransportV0({ ...config, num_predict: 256, context_window_tokens: 4096 });
      const accepted = await inferIntoSlot(slot, identity, context, () => transport.complete(pair.requests[1]));
      assert.equal(accepted, mode === 'success'); assert.equal(calls, 1);
      assert.ok(equal(observed, wire));
      if (!accepted) assert.equal(slot.get(scope, identity), null);
      outcomes.push({ mode, calls, accepted });
    }
  } finally { globalThis.fetch = originalFetch; }
  evidence.transport = outcomes;
});
test('second-event binding, grounding, freshness, repository prepare and commit failures stay real failures', async () => {
  const outcomes = [];
  for (const field of ['subject_id', 'factual_event_ref', 'context_projection_hash', 'evidence_refs']) {
    const result = await continueSecond(pair.beforeSecond, raw, async ({ proposal }) => ({ ...proposal, [field]: field === 'subject_id' ? 'foreign' : field === 'evidence_refs' ? [pair.contexts[1].factual_event_ref] : pair.contexts[1][field] }));
    assert.equal(result.status, 'FAILED'); assert.equal(result.appended.length, 0); assert.equal(result.contexts.length, 1);
    outcomes.push({ case: field, status: result.status, error: result.error, proposals: result.contexts.length });
  }
  const invalid = structuredClone(pair.beforeSecond);
  invalid.pending[0].observation_ref = 'observation:foreign';
  const grounding = await continueSecond(invalid, raw);
  assert.equal(grounding.status, 'FAILED'); assert.equal(grounding.contexts.length, 0); assert.equal(grounding.appended.length, 0);
  outcomes.push({ case: 'grounding', error: grounding.error, proposals: 0 });
  const stale = await continueSecond(pair.beforeSecond, raw, async ({ authority, proposal, ordinal }) => { await authority.advanceTime(1, `concurrent-${ordinal}`); return proposal; });
  assert.equal(stale.status, 'FAILED'); assert.equal(stale.contexts.length, 2, 'existing bounded stale rebuild only');
  assert.ok(stale.appended.every(b => b.transition_type === 'Time'));
  outcomes.push({ case: 'stale_head_both_attempts', error: stale.error, proposals: stale.contexts.length, new_appraisal_commits: 0 });
  const prepare = await continueSecond(pair.beforeSecond, raw, async ({ authority, proposal }) => { authority.durableSource().repo.prepareRevisionForIntent = async () => { throw new Error('injected repository unavailable'); }; return proposal; });
  assert.equal(prepare.status, 'FAILED'); assert.equal(prepare.appended.length, 0);
  outcomes.push({ case: 'repository_prepare', error: prepare.error, proposals: prepare.contexts.length });
  const conflict = await continueSecond(pair.beforeSecond, raw, async ({ authority, proposal }) => {
    // Isolated instance port fault, not a changed production authority implementation.
    authority.container.subjectCore.commitReserved = async () => ({ kind: 'REJECTED', failure: { error_code: 'TRANSITION_ID_REUSE', reason: 'IDEM-REUSE-001', detail: 'injected commit conflict' } });
    return proposal;
  });
  assert.equal(conflict.status, 'FAILED'); assert.equal(conflict.appended.length, 0);
  outcomes.push({ case: 'commit_conflict', error: conflict.error, proposals: conflict.contexts.length });
  evidence.failures = outcomes;
});
test('cleanup success/failure/runtime failure/shutdown/restart closes slot and never serializes it', async () => {
  for (const reason of ['success', 'turn_failure', 'runtime_failure', 'shutdown', 'restart']) {
    const slot = new TurnSlot(scope);
    await slot.offer(identity, raw, context); slot.close(reason);
    assert.equal(slot.get(scope, identity), null);
    assert.equal(await slot.offer(identity, raw, context), false);
    assert.equal(JSON.stringify(slot), '{}');
  }
  const authority = await restore(pair.beforeSecond, adapterForRaw(raw));
  assert.equal(hash(await capture(authority)), hash(pair.beforeSecond));
  assert.equal(JSON.stringify(await capture(authority)).includes('normalized_identity'), false);
  evidence.cleanup = { paths: 5, restart_hit: false, persistent_candidate: false };
});
test('write deterministic evidence after all preceding assertions', () => {
  assert.equal(Object.keys(evidence).length, 9);
  writeFileSync(fileURLToPath(new URL('./deterministic-evidence.json', import.meta.url)), JSON.stringify(evidence, null, 2) + '\n');
});
