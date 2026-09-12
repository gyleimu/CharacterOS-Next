/* globals structuredClone */
import assert from 'node:assert/strict';
import { InteractiveSubjectRuntimeV0 } from '../../../packages/runtime/dist/session/interactive-subject-runtime-v0.js';
import { FactualEventAppraisalExecutorV0 } from '../../../packages/runtime/dist/factual-event-appraisal/factual-event-appraisal-executor.js';
import { buildCognitiveContextProjectionV2ForExplicitV4 } from '../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js';
import { createProductAppraisalProviderV0 } from '../../../product/sandbox/dist/product-appraisal-provider.js';
import { capture, restore, options, differences } from '../appraisal-exact-input-reuse-shadow-v0/harness.mjs';
import { adapterForRaw, candidateFromRaw, equal, FIXED_CANDIDATE, hash, TurnSlot } from '../appraisal-exact-input-reuse-shadow-v0/identity.mjs';

export async function withTurnScope(scope, work) {
  const slot = new TurnSlot(scope);
  try { return await work(slot); }
  finally { slot.close(); }
}
export async function candidateCheck(content, context) {
  try { return { valid: true, candidate: await candidateFromRaw(content, context), error: null }; }
  catch (error) { return { valid: false, candidate: null, error: error.message }; }
}

/** Research observation only. B is dispatched only after await saveBeforeB(S).
 * Failed first candidates terminate their own real runtime turn, not other subjects.
 */
export async function runBaselinePair(sample, infer, saveBeforeB) {
  let runtime, beforeSecond = null;
  const contexts = [], requests = [], responses = [], semanticEntries = [];
  const original = FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent;
  FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent = async function (ctx, input) {
    const entry = { source_event_id: input.source_event_id, result: null };
    semanticEntries.push(entry);
    try { const result = await original.call(this, ctx, input); entry.result = result.kind; return result; }
    catch (error) { entry.result = 'THREW'; throw error; }
  };
  try {
    const provider = { proposeFactualEventAppraisal: async context => {
      const ordinal = contexts.length;
      contexts.push(structuredClone(context));
      if (ordinal === 2) {
        beforeSecond = await capture(runtime.authority);
        await saveBeforeB(beforeSecond);
      }
      const adapter = createProductAppraisalProviderV0({ transport: { complete: async request => {
        requests.push(structuredClone(request));
        if (ordinal === 0) {
          responses.push({ ok: true, content: JSON.stringify(FIXED_CANDIDATE) });
          return { content: JSON.stringify(FIXED_CANDIDATE), model: 'DETERMINISTIC_SETUP' };
        }
        assert.ok(ordinal <= 2, 'no extra real inference from hidden retry/rebase');
        try {
          const content = await infer(ordinal === 1 ? 'A' : 'B', request, context);
          responses.push({ ok: true, content }); return { content, model: 'research-local' };
        } catch (error) {
          responses.push({ ok: false, error: { name: error.name, message: error.message, code: error.code ?? null } });
          throw error;
        }
      } } }).provider;
      return adapter.proposeFactualEventAppraisal(context);
    } };
    runtime = await InteractiveSubjectRuntimeV0.create(options(provider, `reuse-v1-${sample.id.toLowerCase()}`));
    const first = await runtime.submitUserText('I would like to tell you what has been happening.');
    assert.equal(first.status, 'COMPLETE'); assert.equal(contexts.length, 1);
    const second = await runtime.submitUserText(sample.text);
    assert.ok(contexts.length === 2 || contexts.length === 3);
    if (contexts.length === 3) {
      assert.ok(beforeSecond && beforeSecond.pending.length === 1);
      assert.notEqual(contexts[1].factual_event_ref, contexts[2].factual_event_ref);
      assert.notEqual(contexts[1].context_projection_hash, contexts[2].context_projection_hash);
    } else assert.equal(second.status, 'FAILED');
    return { contexts, requests, responses, beforeSecond, first, second, baselineAfter: await capture(runtime.authority), semanticEntries };
  } finally { FactualEventAppraisalExecutorV0.prototype.appraiseIncomingEvent = original; }
}

export async function continueSecond(image, response, options = {}) {
  const contexts = [], proposals = [], validations = [];
  let authority;
  const provider = { proposeFactualEventAppraisal: async context => {
    contexts.push(structuredClone(context));
    if (!response.ok) throw Object.assign(new Error(response.error.message), { name: response.error.name, code: response.error.code });
    const validation = await candidateCheck(response.content, context);
    validations.push(validation);
    let proposal = await adapterForRaw(response.content).proposeFactualEventAppraisal(context);
    if (options.mutateProposal) proposal = await options.mutateProposal({ authority, proposal, context, ordinal: contexts.length });
    proposals.push(structuredClone(proposal)); return proposal;
  } };
  authority = await restore(image, provider);
  const preHash = hash(await capture(authority));
  if (options.beforeDrain) await options.beforeDrain(authority);
  let status = 'COMMITTED', error = null;
  try { await authority.completePendingLifecycleWork(); }
  catch (failure) { status = 'FAILED'; error = { name: failure.name, code: failure.error_code ?? null, message: failure.message }; }
  const after = await capture(authority);
  return { preHash, status, error, contexts, proposals, validations, after,
    appended: after.store.committed_bundles.slice(image.store.committed_bundles.length),
    projection: await buildCognitiveContextProjectionV2ForExplicitV4(after.snapshot) };
}

export async function comparePair(pair, identity) {
  assert.ok(pair.beforeSecond);
  assert.ok(equal(pair.requests[1], pair.requests[2]));
  const control = await continueSecond(pair.beforeSecond, pair.responses[2]);
  const scope = { subject: pair.contexts[1].subject_id, turn: 1, process: 'isolated-shadow-process', restart: 0, provider: 'isolated-shadow-provider' };
  // Counterfactual injection into a NEW isolated scope, not a cache transferred
  // across a real restart. Both candidate source and trusted A context are explicit.
  const shadow = await withTurnScope(scope, async slot => {
    assert.equal(await slot.offer(identity, pair.responses[1].content, pair.contexts[1]), true);
    const candidate = slot.get(scope, identity);
    assert.ok(candidate);
    return continueSecond(pair.beforeSecond, { ok: true, content: JSON.stringify(candidate) });
  });
  assert.equal(control.preHash, hash(pair.beforeSecond)); assert.equal(shadow.preHash, control.preHash);
  assert.ok(equal(control.contexts, shadow.contexts));
  assert.ok(equal(control.after.snapshot, pair.baselineAfter.snapshot));
  assert.ok(equal(control.after.store.revisions, pair.baselineAfter.store.revisions));
  const baselineRestoreDiff = differences(pair.baselineAfter, control.after);
  assert.ok(baselineRestoreDiff.every(d => /\/(first_seen_sequence|record_checksum|previous_record_checksum|commit_ref|result_ref|terminal_result_ref)$/.test(d.path)));
  for (const path of [control, shadow]) {
    assert.equal(path.contexts.length, 1, 'no hidden model fallback or extra proposal delivery');
    for (const proposal of path.proposals) {
      assert.equal(proposal.subject_id, pair.contexts[2].subject_id);
      assert.equal(proposal.factual_event_ref, pair.contexts[2].factual_event_ref);
      assert.equal(proposal.context_projection_hash, pair.contexts[2].context_projection_hash);
      assert.deepEqual(proposal.evidence_refs, [pair.contexts[2].factual_event_ref]);
    }
  }
  const canonicalDiff = differences(control.after, shadow.after), projectionDiff = differences(control.projection, shadow.projection);
  const affectEqual = equal(control.after.snapshot.affect, shadow.after.snapshot.affect);
  const trajectory = path => path.appended.map(b => ({ type: b.transition_type, revision: b.next_revision, time: b.logical_time_after }));
  const authorityEqual = control.status === shadow.status && equal(control.error, shadow.error) && equal(trajectory(control), trajectory(shadow));
  const canonicalEqual = canonicalDiff.length === 0, projectionEqual = projectionDiff.length === 0;
  const classes = [];
  if (control.status !== shadow.status) classes.push('FAILURE_BOUNDARY_EFFECT', 'ADMISSION_EFFECT');
  if (!projectionEqual) classes.push('DOWNSTREAM_COGNITION_INPUT_EFFECT');
  if (!affectEqual) classes.push('AFFECT_TRAJECTORY_EFFECT');
  if (!canonicalEqual) classes.push('NUMERIC_CANONICAL_EFFECT');
  if (classes.length === 0) classes.push(equal(pair.responses[1], pair.responses[2]) ? 'NONE' : 'OUTPUT_ONLY_NO_CANONICAL_EFFECT');
  return { control, shadow, baselineRestoreDiff, canonicalDiff, projectionDiff, affectEqual, authorityEqual, canonicalEqual, projectionEqual,
    classifications: classes, principal_classification: classes[0],
    material: !authorityEqual || !canonicalEqual || !projectionEqual,
    normalization: 'Object key order only. No state, metadata, numerical, hash or receipt fields removed between CONTROL and SHADOW.' };
}
