/* globals URL, Response, DOMException, structuredClone */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/providers/cognition/ollama-native-cognition-transport.js';
import { candidateFromRaw, equal, expectedWire, FIXED_CANDIDATE, inferIntoSlot, requestIdentity, TurnSlot } from '../appraisal-exact-input-reuse-shadow-v0/identity.mjs';
import { candidateCheck, comparePair, continueSecond, runBaselinePair, withTurnScope } from './harness.mjs';

const raw = JSON.stringify(FIXED_CANDIDATE), response = { ok: true, content: raw };
const sample = { id: 'offline', text: 'I feel relieved and uncertain at the same time.' };
let saved = false;
const pair = await runBaselinePair(sample, async side => { if (side === 'B') assert.ok(saved, 'S must be saved before B starts'); return raw; }, async () => { saved = true; });
const config = { base_url: 'http://127.0.0.1:11434', model: 'offline', timeout_ms: 10, num_predict: 256, context_window_tokens: 4096 };
const environment = { provider_implementation: 'native', digest: 'fixed', timeout_ms: 10, schema: 'ABSENT' };
const wire = expectedWire(pair.requests[1], config), identity = requestIdentity(wire, environment);
const scope = { subject: 's', turn: 1, process: 'p', restart: 0, provider_instance: 'provider' };
const evidence = {};

test('V0 sixth failure is the unmodified MODEL_SCHEMA_VIOLATION, not harness/fixture/transport defect', async () => {
  const old = JSON.parse(readFileSync(new URL('../appraisal-exact-input-reuse-shadow-v0/evidence/S06-A.json', import.meta.url), 'utf8'));
  assert.equal(old.raw_envelope.message.content, old.response.content);
  assert.equal(old.raw_envelope.done_reason, 'stop'); assert.equal(old.trace.outcome, 'SUCCESS');
  assert.ok(old.request.messages[0].content.includes('goal_congruence'));
  assert.ok(!JSON.stringify(old.request).includes('goal_conguence'));
  const decoded = JSON.parse(old.response.content);
  assert.ok(Object.hasOwn(decoded, 'goal_conguence')); assert.ok(!Object.hasOwn(decoded, 'goal_congruence'));
  await assert.rejects(() => candidateFromRaw(old.response.content, old.context), /unexpected key set/);
  evidence.v0_failure = { classification: 'MODEL_SCHEMA_VIOLATION', raw_unmodified: true, correct_prompt_field: true, parser_truthful: true };
});
test('first-turn no opportunity; later distinct events and complete identity; real same-S rebind and lifecycle', async () => {
  assert.equal(pair.semanticEntries.length, 5); assert.equal(pair.responses.length, 3);
  assert.equal(pair.semanticEntries.filter(e => e.result === 'ALREADY_COMPLETED').length, 2);
  assert.ok(equal(requestIdentity(expectedWire(pair.requests[2], config), environment), identity));
  const comparison = await comparePair(pair, identity);
  assert.ok(comparison.authorityEqual && comparison.canonicalEqual && comparison.affectEqual && comparison.projectionEqual);
  assert.deepEqual(comparison.shadow.appended.map(b => b.transition_type), ['Learning', 'AffectApplication']);
  assert.notEqual(comparison.shadow.proposals[0].factual_event_ref, pair.contexts[1].factual_event_ref);
  evidence.same_state = { exact: true, authority: true, canonical: true, projection: true, saved_before_B: saved };
});
test('malformed A terminates only its turn; no B, no entry, next independent sample remains lawful', async () => {
  const bad = await runBaselinePair({ ...sample, id: 'bad-a' }, async () => '{"goal_conguence":0.1}', async () => { throw new Error('B must not be reached'); });
  assert.equal(bad.second.status, 'FAILED'); assert.equal(bad.beforeSecond, null); assert.equal(bad.responses.length, 2);
  const slot = new TurnSlot(scope);
  assert.equal(await slot.offer(identity, bad.responses[1].content, bad.contexts[1]), false);
  assert.equal(slot.get(scope, identity), null);
  const next = await runBaselinePair({ ...sample, id: 'after-bad-a' }, async () => raw, async () => {});
  assert.equal(next.second.status, 'COMPLETE');
  evidence.invalid_A = { failed_turn: true, B_calls: 0, cached: false, next_independent_sample: 'COMPLETE' };
});
test('malformed independent B compares from SAVED S: failure boundary visible, no repair or fallback', async () => {
  let stateSaved = false;
  const bad = await runBaselinePair({ ...sample, id: 'bad-b' }, async side => side === 'A' ? raw : '{"goal_conguence":0.1}', async () => { stateSaved = true; });
  assert.ok(stateSaved); assert.equal(bad.second.status, 'FAILED');
  const result = await comparePair(bad, identity);
  assert.equal(result.control.status, 'FAILED'); assert.equal(result.control.appended.length, 0);
  assert.equal(result.shadow.status, 'COMMITTED'); assert.equal(result.authorityEqual, false);
  assert.ok(result.classifications.includes('FAILURE_BOUNDARY_EFFECT'));
  evidence.invalid_B = { synthetic: true, classifications: result.classifications, control: result.control.status, shadow: result.shadow.status, authority_equivalent: false, event_authority_bypassed: false };
});
test('numeric candidate sensitivity reaches canonical Affect and existing cognition projection', async () => {
  const changed = await runBaselinePair({ ...sample, id: 'changed' }, async side => side === 'A' ? raw : JSON.stringify({ ...FIXED_CANDIDATE, goal_congruence: 0, intensity: 0.9 }), async () => {});
  const result = await comparePair(changed, identity);
  assert.equal(result.authorityEqual, true); assert.equal(result.affectEqual, false); assert.equal(result.projectionEqual, false);
  evidence.sensitivity = { classifications: result.classifications, projection_differences: result.projectionDiff };
});
test('event-B stale/grounding/context/subject/prepare/commit failures cannot be bypassed by reusable A', async () => {
  const outcomes = [];
  for (const field of ['subject_id', 'factual_event_ref', 'context_projection_hash', 'evidence_refs']) {
    const result = await continueSecond(pair.beforeSecond, response, { mutateProposal: async ({ proposal }) => ({ ...proposal, [field]: field === 'subject_id' ? 'foreign' : field === 'evidence_refs' ? [pair.contexts[1].factual_event_ref] : pair.contexts[1][field] }) });
    assert.equal(result.status, 'FAILED'); assert.equal(result.appended.length, 0);
    outcomes.push({ case: field, error: result.error, proposal_deliveries: result.contexts.length });
  }
  const grounding = await continueSecond(pair.beforeSecond, response, { beforeDrain: async authority => { authority.pending[0].observation_ref = 'observation:foreign'; } });
  assert.equal(grounding.status, 'FAILED'); assert.equal(grounding.contexts.length, 0); assert.equal(grounding.appended.length, 0);
  outcomes.push({ case: 'grounding', error: grounding.error });
  const stale = await continueSecond(pair.beforeSecond, response, { mutateProposal: async ({ authority, proposal, ordinal }) => { await authority.advanceTime(1, `stale-${ordinal}`); return proposal; } });
  assert.equal(stale.status, 'FAILED'); assert.equal(stale.contexts.length, 2);
  assert.ok(stale.appended.every(b => b.transition_type === 'Time'));
  outcomes.push({ case: 'stale', error: stale.error, existing_bounded_rebuild_proposals: stale.contexts.length, model_retries: 0 });
  for (const fault of ['prepare', 'commit']) {
    const result = await continueSecond(pair.beforeSecond, response, { beforeDrain: async authority => {
      if (fault === 'prepare') authority.durableSource().repo.prepareRevisionForIntent = async () => { throw new Error('injected unavailable'); };
      else authority.container.subjectCore.commitReserved = async () => ({ kind: 'REJECTED', failure: { error_code: 'TRANSITION_ID_REUSE', reason: 'IDEM-REUSE-001', detail: 'injected conflict' } });
    } });
    assert.equal(result.status, 'FAILED'); assert.equal(result.appended.length, 0);
    outcomes.push({ case: fault, error: result.error });
  }
  evidence.event_failures = outcomes;
});
test('scope/config/prompt/format/order/budget firewalls and normalized comparison defeat hash collision', async () => {
  const slot = new TurnSlot(scope); await slot.offer(identity, raw, pair.contexts[1]);
  for (const key of Object.keys(scope)) assert.equal(slot.get({ ...scope, [key]: 'other' }, identity), null);
  const mutations = [w => { w.endpoint += '/changed'; }, w => { w.body.model = 'other'; }, w => { w.body.messages.reverse(); }, w => { w.body.messages[0].content += ' other'; }, w => { w.body.messages[1].content += ' other task/scene'; }, w => { w.body.format = 'json'; }, w => { w.body.options.num_predict++; }, w => { w.body.options.num_ctx++; }, w => { w.body.options.temperature++; }, w => { w.body.think = true; }, w => { w.body.stream = true; }];
  for (const mutate of mutations) {
    const changed = structuredClone(wire); mutate(changed);
    const id = requestIdentity(changed, environment); assert.notEqual(id.fingerprint, identity.fingerprint);
    assert.equal(slot.get(scope, id), null); assert.equal(slot.get(scope, { ...id, fingerprint: identity.fingerprint }), null);
  }
  assert.equal(slot.get(scope, requestIdentity(wire, { ...environment, digest: 'other' })), null);
  evidence.firewalls = { scope_dimensions: Object.keys(scope), request_variants: mutations.length, normalized_collision_check: true };
});
test('native timeout/unavailable/truncation and malformed/range violations never create reusable first candidate', async () => {
  const originalFetch = globalThis.fetch, results = [];
  try {
    for (const failure of ['timeout', 'unavailable', 'truncated']) {
      let calls = 0;
      globalThis.fetch = async (endpoint, init) => {
        void endpoint; calls++;
        if (failure === 'unavailable') throw new Error('unavailable');
        if (failure === 'timeout') return new Promise((resolve, reject) => { void resolve; init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); });
        return new Response(JSON.stringify({ model: 'offline', message: { content: raw }, done: true, done_reason: 'length' }));
      };
      const transport = new OllamaNativeCognitionTransportV0(config), slot = new TurnSlot(scope);
      assert.equal(await inferIntoSlot(slot, identity, pair.contexts[1], () => transport.complete(pair.requests[1])), false);
      assert.equal(slot.get(scope, identity), null); assert.equal(calls, 1);
      results.push({ failure, calls, cached: false });
    }
  } finally { globalThis.fetch = originalFetch; }
  for (const bad of ['{', '{}', JSON.stringify({ ...FIXED_CANDIDATE, relevance: 2 }), JSON.stringify({ ...FIXED_CANDIDATE, attribution: 'invented' }), JSON.stringify({ ...FIXED_CANDIDATE, intensity: null })]) assert.equal((await candidateCheck(bad, pair.contexts[1])).valid, false);
  evidence.provider_failures = results;
});
test('automatic finally cleanup on success/throw/failure/shutdown/restart; no persistent slot', async () => {
  for (const end of ['success', 'turn_failure', 'runtime_failure', 'shutdown', 'restart']) {
    let held;
    const run = () => withTurnScope(scope, async slot => { held = slot; await slot.offer(identity, raw, pair.contexts[1]); assert.ok(slot.get(scope, identity)); if (end !== 'success') throw new Error(end); });
    if (end === 'success') await run(); else await assert.rejects(run, new RegExp(end));
    assert.equal(held.get(scope, identity), null); assert.equal(JSON.stringify(held), '{}');
  }
  const result = await continueSecond(pair.beforeSecond, response);
  assert.equal(JSON.stringify(result.after).includes('normalized_identity'), false);
  evidence.cleanup = { automatic_finally_paths: 5, persisted_slot: false };
});
test('persist V1 deterministic evidence, never V0 files', () => {
  assert.equal(Object.keys(evidence).length, 9);
  writeFileSync(fileURLToPath(new URL('./deterministic-evidence.json', import.meta.url)), JSON.stringify(evidence, null, 2) + '\n');
});
