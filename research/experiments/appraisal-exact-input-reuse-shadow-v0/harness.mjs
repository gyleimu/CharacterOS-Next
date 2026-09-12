/* globals structuredClone */
import assert from 'node:assert/strict';
import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from '../../../packages/runtime/dist/session/interactive-subject-runtime-v0.js';
import { ExplicitV4SessionAuthorityV0 } from '../../../packages/runtime/dist/session/explicit-v4-session-authority-v0.js';
import { captureSessionStoreImageV0, rebuildSessionStoreSourceV0 } from '../../../packages/runtime/dist/session/session-store-image-v0.js';
import { InMemoryConversationDeliveryLedger } from '../../../packages/runtime/dist/transitions/conversation/behavior-delivery-ledger.js';
import { InMemoryConversationIngressLedger } from '../../../packages/runtime/dist/transitions/conversation/conversation-ingress-ledger.js';
import { buildCognitiveContextProjectionV2ForExplicitV4 } from '../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js';
import { createProductAppraisalProviderV0 } from '../../../product/sandbox/dist/product-appraisal-provider.js';
import { FIXED_CANDIDATE, adapterForRaw, equal, hash, normalized } from './identity.mjs';

export function options(provider, subject = 'reuse-research') {
  return {
    subject: { subject_id: subject, display_name: '', identity_anchors: [] }, v3_source: createInteractiveSubjectSeedV0(subject),
    session_id: 'reuse-shadow', interval_ticks: 1, provider_identity: { model: 'research-local', num_predict: 256 },
    clock: () => '2026-09-12T00:00:00.000Z', factualEventAppraisalProvider: provider,
    conversationCognitionTransport: { complete: async request => ({ model: 'DETERMINISTIC_NO_INFERENCE', content: JSON.stringify({
      schema_version: 'conversation-cognition-proposal-v1', cognition: { schema_version: 'cognition-proposal-v0',
        projection_hash: /\[projection_hash\]\s+(\S+)/.exec(request.messages.find(m => m.role === 'user')?.content ?? '')?.[1] ?? '',
        reasoning_summary: 'Research lifecycle fixture.', relevant_memory_refs: [], considered_context_refs: [], current_intent: 'respond', confidence: 0.7, uncertainty: 0.3, action_intent: null, evidence_refs: [] },
      communication_directive: { kind: 'CLARIFY_MISSING_CONTEXT' }
    }) }) },
    languageTransport: { complete: async () => { throw new Error('language inference forbidden'); } }
  };
}

export async function capture(authority) {
  return structuredClone({ durable: await authority.captureDurableState([]), store: await captureSessionStoreImageV0(authority.durableSource()), pending: authority.pendingWork(), snapshot: await authority.readSnapshot() });
}
export async function restore(image, provider) {
  const copy = JSON.parse(JSON.stringify(image));
  const deliveryLedger = new InMemoryConversationDeliveryLedger();
  const ingressLedger = new InMemoryConversationIngressLedger();
  assert.equal((await deliveryLedger.restoreState(copy.durable.delivery_ledger_state)).ok, true);
  assert.equal((await ingressLedger.restoreState(copy.durable.ingress_ledger_state)).ok, true);
  const source = await rebuildSessionStoreSourceV0(copy.store);
  const { authority } = await ExplicitV4SessionAuthorityV0.restoreFromDurableState({ ...options(provider, copy.snapshot.identity.subject_id), deliveryLedger, ingressLedger }, copy.durable, source);
  copy.pending.forEach(work => authority.enqueuePending(work));
  assert.ok(equal(await capture(authority), image), 'restored full authoritative state S must be exactly identical');
  assert.notEqual(authority.durableSource().repo, source.repo);
  return authority;
}

/** Runs the ACTUAL interactive runtime. Only the three model-origin candidates are supplied.
 * The read-only research access to TS-private runtime.authority captures S without calling
 * runtime.snapshot(), whose public contract would prematurely flush pending work.
 */
export async function preparePair(text, infer, subject = 'reuse-research') {
  const contexts = [], requests = [], raw = [];
  let runtime, beforeSecond;
  const provider = { proposeFactualEventAppraisal: async context => {
    const ordinal = contexts.length;
    contexts.push(structuredClone(context));
    if (ordinal === 2) beforeSecond = await capture(runtime.authority);
    const adapter = createProductAppraisalProviderV0({ transport: { complete: async request => {
      requests.push(structuredClone(request));
      const content = ordinal === 0 ? JSON.stringify(FIXED_CANDIDATE) : await infer(ordinal === 1 ? 'A' : 'B', request, context);
      raw.push(content);
      return { content, model: 'research-local' };
    } } }).provider;
    return adapter.proposeFactualEventAppraisal(context);
  } };
  runtime = await InteractiveSubjectRuntimeV0.create(options(provider, subject));
  const first = await runtime.submitUserText('Let us discuss what happened today.');
  assert.equal(first.status, 'COMPLETE', JSON.stringify(first));
  assert.equal(contexts.length, 1, 'first human turn: exactly one model-backed event, no pair');
  const second = await runtime.submitUserText(text);
  assert.equal(second.status, 'COMPLETE', JSON.stringify(second));
  assert.equal(contexts.length, 3, 'later human turn: two separately appraised events');
  assert.ok(beforeSecond && beforeSecond.pending.length === 1 && beforeSecond.pending[0].kind === 'REPLY');
  assert.notEqual(contexts[1].factual_event_ref, contexts[2].factual_event_ref);
  assert.notEqual(contexts[1].context_projection_hash, contexts[2].context_projection_hash);
  return { contexts, requests, raw, beforeSecond, baselineAfter: await capture(runtime.authority) };
}

export async function continueSecond(image, raw, mutation) {
  const proposals = [], contexts = [];
  let authority;
  const provider = { proposeFactualEventAppraisal: async context => {
    contexts.push(structuredClone(context));
    let proposal = await adapterForRaw(raw).proposeFactualEventAppraisal(context);
    if (mutation) proposal = await mutation({ authority, context, proposal, ordinal: contexts.length });
    proposals.push(structuredClone(proposal));
    return proposal;
  } };
  authority = await restore(image, provider);
  const preHash = hash(await capture(authority));
  let status = 'COMMITTED', error = null;
  try { await authority.completePendingLifecycleWork(); }
  catch (failure) { status = 'FAILED'; error = { name: failure.name, message: failure.message, code: failure.error_code ?? null }; }
  const after = await capture(authority);
  const projection = await buildCognitiveContextProjectionV2ForExplicitV4(after.snapshot);
  const appended = after.store.committed_bundles.slice(image.store.committed_bundles.length);
  return { preHash, status, error, contexts, proposals, after, projection, appended };
}
export function differences(a, b, path = '') {
  if (equal(a, b)) return [];
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return [{ path, control: a, shadow: b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(key => differences(a[key], b[key], `${path}/${key}`));
}
export async function comparePair(pair) {
  const control = await continueSecond(pair.beforeSecond, pair.raw[2]);
  const shadow = await continueSecond(pair.beforeSecond, pair.raw[1]);
  assert.equal(control.preHash, shadow.preHash);
  assert.equal(control.preHash, hash(pair.beforeSecond));
  assert.ok(equal(control.contexts, shadow.contexts), 'trusted second context must be identical');
  assert.ok(equal(control.after.snapshot, pair.baselineAfter.snapshot), 'control replay must reproduce original canonical snapshot');
  assert.ok(equal(control.after.store.revisions, pair.baselineAfter.store.revisions), 'control replay must reproduce original repository');
  // The production restore creates a fresh reservation first_seen_sequence counter.
  // Only this baseline-vs-restored comparison permits that counter and its derived
  // receipt/checksum identities. CONTROL-vs-SHADOW below removes NOTHING.
  const baselineRestoreDiff = differences(pair.baselineAfter, control.after);
  const restoreIdentityLeaf = /\/(first_seen_sequence|record_checksum|previous_record_checksum|commit_ref|result_ref|terminal_result_ref)$/;
  assert.ok(baselineRestoreDiff.every(d => restoreIdentityLeaf.test(d.path)), 'unexpected baseline restore divergence');
  for (const path of [control, shadow]) {
    assert.equal(path.contexts.length, 1, 'one proposal delivery, no hidden inference retry');
    assert.equal(path.proposals[0].factual_event_ref, pair.contexts[2].factual_event_ref);
    assert.equal(path.proposals[0].context_projection_hash, pair.contexts[2].context_projection_hash);
    assert.deepEqual(path.proposals[0].evidence_refs, [pair.contexts[2].factual_event_ref]);
  }
  const canonicalDiff = differences(control.after, shadow.after);
  const projectionDiff = differences(control.projection, shadow.projection);
  const affectEqual = equal(control.after.snapshot.affect, shadow.after.snapshot.affect);
  const order = path => path.appended.map(bundle => [bundle.transition_type, bundle.expected_revision, bundle.next_revision, bundle.logical_time_after]);
  const authorityEqual = control.status === shadow.status && equal(order(control), order(shadow)) && equal(control.error, shadow.error);
  return { control, shadow, canonicalDiff, projectionDiff, baselineRestoreDiff, affectEqual, authorityEqual,
    canonicalEqual: canonicalDiff.length === 0, projectionEqual: projectionDiff.length === 0,
    classification: canonicalDiff.length === 0 ? 'NONE' : control.status !== shadow.status ? 'ADMISSION' : !affectEqual ? 'AFFECT_TRAJECTORY' : 'APPRAISAL_SEMANTIC',
    normalization: 'Sorted object keys only; no value, identity, revision, hash, ledger, or persistence field removed.',
    serializedPersistenceEqual: normalized(control.after) === normalized(shadow.after) };
}
