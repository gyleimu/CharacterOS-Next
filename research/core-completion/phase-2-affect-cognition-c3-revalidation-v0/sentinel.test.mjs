/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — deterministic transport sentinel
 * (ZERO model calls).
 *
 * Proves, with fake transports, that the C3 harness actually exercises the
 * production C3 surfaces before any model call is issued:
 *   - the V4 request reaches the transport exactly once per cognition cell and
 *     requests the closed native JSON schema;
 *   - the advertised schema and system prompt never ask the model for a
 *     projection hash (host-bound identity);
 *   - a proposal WITHOUT a model-emitted projection_hash validates, and the
 *     host binds its own authoritative hash;
 *   - a valid explicit stance survives validation and reaches Language V5 as
 *     `selected_subjective_choice` (with no `selected_current_intent`);
 *   - a directive-enum echo stance is rejected by the host and never reaches
 *     Language;
 *   - a null choice completes the turn but cannot satisfy the choice endpoint,
 *     and the Language prompt forbids inventing one;
 *   - CLARIFY routes the host branch and never calls Language.
 *
 * Run: node --test sentinel.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONDITIONS, MIXED_SCENARIOS, QUALIFICATION_SCENARIOS } from './lib/config.mjs';
import { conditionVariant, growSnapshot, runCondition } from './lib/pipeline.mjs';
import { classifyRecord, stanceVerdict } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCENARIO = MIXED_SCENARIOS[0];

/** Deterministic fake cognition transport: builds a lawful V4 proposal from the request. */
function fakeCognition({ directive = 'REALIZE_CURRENT_INTENT', stance = 'I would volunteer to own the review.' } = {}) {
  const calls = [];
  return {
    calls,
    transport: {
      complete: async (request) => {
        calls.push(request);
        const user = request.messages.find((message) => message.role === 'user').content;
        const observationRef = /^\[current observation\] (\S+)$/m.exec(user)?.[1];
        const factualBlock = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(user)?.[0] ?? '';
        const refs = [...factualBlock.matchAll(/^- (\S+)$/gm)].map((match) => match[1]);
        assert.ok(observationRef, 'sentinel: current observation ref must be rendered');
        assert.ok(refs.length > 0, 'sentinel: FACTUAL SOURCE REFS must advertise inspectable sources');
        assert.ok(refs.includes(observationRef), 'sentinel: the current observation must be a factual source');
        const sortedRefs = [...refs].sort();
        const isClarify = directive === 'CLARIFY_MISSING_CONTEXT';
        const proposal = {
          schema_version: 'conversation-cognition-proposal-v4',
          // NOTE: no projection_hash anywhere — identity is host-owned.
          factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The supplied material states a deadline of Thursday.', source_refs: sortedRefs }] },
          cognition: {
            schema_version: 'cognition-proposal-v0', reasoning_summary: 'sentinel',
            relevant_memory_refs: [], considered_context_refs: sortedRefs,
            current_intent: 'summarize the request and the intended reply',
            confidence: 0.8, uncertainty: 0.2, action_intent: null, evidence_refs: sortedRefs
          },
          subjective_choice: isClarify ? null : (stance === null ? null : { stance }),
          communication_directive: { kind: directive },
          clarification_basis: isClarify
            ? { current_observation_ref: observationRef, missing_information: 'the missing detail', needed_for: 'answering the request' }
            : null
        };
        return { content: JSON.stringify(proposal), model: 'sentinel-fake' };
      }
    }
  };
}

function fakeLanguage() {
  const calls = [];
  return {
    calls,
    transport: {
      complete: async (request) => {
        calls.push(request);
        return {
          content: JSON.stringify({
            schema_version: 'language-realization-semantic-draft-v1',
            text: 'The deadline is Thursday. I would volunteer.',
            evidence_refs: []
          }),
          model: 'sentinel-fake'
        };
      }
    }
  };
}

const languagePromptOf = (request) => request.messages.find((message) => message.role === 'system')?.content ?? '';
const languageUserOf = (request) => request.messages.find((message) => message.role === 'user')?.content ?? '';

test('condition variants are deterministic and attestation-safe', () => {
  const base = ['[identity] subject_id="s"', '[context] scene="x" task="y"', '[affect (canonical)] valence=0.1 activation=0.2', '[affect (canonical) legend] legend', 'CITEABLE CONTEXT REFS:', '[ALLOWED ACTION SPACE]'].join('\n');
  for (const id of ['P', 'N', 'Z']) {
    const variant = conditionVariant(base, id);
    assert.equal(variant.removedIndices.length, 0);
    assert.equal(variant.transformed.split('\n').length, base.split('\n').length);
  }
  const absent = conditionVariant(base, 'A');
  assert.equal(absent.removedIndices.length, 2, 'A removes the value line and the legend');
  assert.deepEqual(absent.removedIndices, conditionVariant(base, 'A').removedIndices, 'removedIndices is deterministic');
  assert.equal(QUALIFICATION_SCENARIOS.length, 13);
  assert.equal(CONDITIONS.A.kind, 'ABSENT');
});

test('REALIZE sentinel: V4 request, host-bound hash, explicit stance, V5 handoff', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition();
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c3-realize'
  });
  assert.equal(cognition.calls.length, 1, 'cognition transport must be reached exactly once');
  assert.equal(record.cognition_calls, 1);
  assert.ok(record.raw_cognition_request, 'request must be captured');
  assert.equal(record.raw_cognition_request.structured_output?.kind, 'JSON_SCHEMA', 'native structured output must be requested');
  // HOST_BOUND_PROJECTION_HASH_OUTSIDE_MODEL_OUTPUT: the model is never asked for it.
  assert.ok(!JSON.stringify(record.raw_cognition_request.structured_output.schema).includes('projection_hash'), 'V4 schema must not advertise projection_hash');
  assert.ok(!languagePromptOf(record.raw_cognition_request).includes('projection_hash'), 'V4 prompt must not ask for a projection hash');
  assert.equal(record.stages.SCHEMA_VALID, true, `V4 proposal must validate without a model-emitted hash: ${record.failure_detail}`);
  assert.equal(record.status, 'COMPLETE', `sentinel turn must complete: ${record.failure_detail}`);
  assert.equal(record.failure_stage, null, 'no pre-transport or validation failure');
  assert.deepEqual(record.subjective_choice, { stance: 'I would volunteer to own the review.' });
  assert.deepEqual(record.language_selected_subjective_choice, { stance: 'I would volunteer to own the review.' });
  assert.equal(record.current_intent, 'summarize the request and the intended reply');
  assert.ok(record.request_attestation, 'request attestation must be written');
  assert.equal(record.request_attestation.ok, true);
  assert.equal(record.language_leakage.ok, true, JSON.stringify(record.language_leakage.found));
  assert.equal(language.calls.length, 1, 'REALIZE must reach the Language branch exactly once');
  const languagePrompt = languagePromptOf(language.calls[0]);
  assert.ok(languagePrompt.includes('ALREADY-SELECTED SUBJECTIVE CHOICE'), 'Language must be told the choice is already selected');
  assert.ok(languagePrompt.includes('do NOT produce, imply or hedge any preference'), 'null-choice prohibition must be present');
  assert.ok(languageUserOf(language.calls[0]).includes('"selected_subjective_choice"'), 'V5 handoff must carry the explicit choice');
  assert.ok(!languageUserOf(language.calls[0]).includes('"selected_current_intent"'), 'V5 must not carry the descriptive intent');
  assert.equal(record.stages.FINAL_BEHAVIOR, true);
  const classification = classifyRecord(SCENARIO, record);
  assert.equal(classification.primary_endpoint, 'CHOICE_SELECTED_AT_COGNITION');
  assert.equal(classification.choice_fidelity, 'CHOICE_PRESERVED');
  assert.equal(classification.pass, true, JSON.stringify(classification));
});

test('enum-echo sentinel: the host rejects the echo and Language is never reached', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ stance: 'REALIZE_CURRENT_INTENT' });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c3-echo'
  });
  assert.equal(cognition.calls.length, 1);
  assert.equal(record.status, 'FAILED', 'the directive-enum echo must fail the turn');
  assert.equal(record.stages.EXECUTOR_ADMISSIBLE, false, 'the host must reject the echoed stance');
  assert.equal(record.stages.SCHEMA_VALID, true, 'the raw response still declared the V4 schema (probe, not a host verdict)');
  // The runtime surfaces a generic fail-closed message, so the echo itself is the
  // evidence; the raw response keeps the model's exact stance.
  assert.equal(language.calls.length, 0, 'Language must not be reached');
  assert.equal(record.subjective_choice.stance, 'REALIZE_CURRENT_INTENT');
  assert.equal(stanceVerdict(record.subjective_choice.stance).kind, 'ENUM_ECHO');
  const classification = classifyRecord(SCENARIO, record);
  assert.equal(classification.choice_defect, 'ENUM_ECHO');
  assert.equal(classification.pass, false);
});

test('null-choice sentinel: the turn completes but the choice endpoint fails and Language may not invent', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ stance: null });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c3-null'
  });
  assert.equal(record.status, 'COMPLETE', `a null choice is structurally admissible: ${record.failure_detail}`);
  assert.equal(record.subjective_choice, null);
  assert.equal(record.language_selected_subjective_choice, null);
  assert.equal(language.calls.length, 1);
  assert.ok(languageUserOf(language.calls[0]).includes('"selected_subjective_choice": null'), 'V5 must hand off null explicitly');
  const classification = classifyRecord(SCENARIO, record);
  assert.equal(classification.primary_endpoint, 'NO_CHOICE_AT_COGNITION');
  assert.equal(classification.choice_defect, 'NULL_CHOICE');
  assert.equal(classification.pass, false, 'a null choice cannot satisfy a choice-bearing scenario');
});

test('CLARIFY sentinel: null choice with a lawful basis routes the host branch and never calls Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT' });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c3-clarify'
  });
  assert.equal(cognition.calls.length, 1);
  assert.equal(record.status, 'COMPLETE', `sentinel CLARIFY must complete: ${record.failure_detail}`);
  assert.equal(record.directive, 'CLARIFY_MISSING_CONTEXT');
  assert.equal(record.subjective_choice, null);
  assert.notEqual(record.clarification_basis, null);
  assert.equal(language.calls.length, 0, 'CLARIFY must not call the Language provider');
  assert.equal(record.language_calls, 0);
  assert.equal(record.request_attestation.ok, true);
  assert.equal(classifyRecord(SCENARIO, record).false_clarify, true, 'no scenario here genuinely lacks information');
});

test('freeze artifacts are internally consistent once prepared', () => {
  for (const file of ['qualification-freeze.json', 'formal-freeze.json', 'lawful-freeze.json']) {
    let freeze;
    try {
      freeze = JSON.parse(readFileSync(resolve(here, file), 'utf8'));
    } catch {
      continue; // not prepared yet in this checkout
    }
    assert.ok(freeze.freeze_hash, `${file}: freeze_hash required`);
    assert.equal(freeze.provider.digest, freeze.declared_provider.required_digest);
  }
});
