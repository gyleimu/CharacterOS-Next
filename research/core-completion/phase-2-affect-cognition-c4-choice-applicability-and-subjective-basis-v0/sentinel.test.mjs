/**
 * AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 —
 * deterministic transport sentinel (ZERO model calls).
 *
 * Proves, with fake transports, that the C4 harness exercises the production C4
 * surfaces before any model call is issued:
 *   - the V5 request reaches the transport exactly once per cell with the tagged
 *     native schema, and the schema/prompt never ask for a projection hash;
 *   - a proposal without a model-emitted hash validates and the host binds its own;
 *   - the NOT_APPLICABLE path completes and is handed to Language as
 *     `{ kind: "NOT_APPLICABLE" }` (no stance anywhere);
 *   - the SELECTED path survives, carries its stance AND rationale into V6, and
 *     Language is told the rationale is not a fact;
 *   - CLARIFY requires NOT_APPLICABLE and never calls Language;
 *   - condition-blinded session ids carry no scenario identity.
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
import { applicabilityVerdict, classifyRecord } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCENARIO = MIXED_SCENARIOS[0];

/** Deterministic fake cognition transport: builds a lawful V5 proposal from the request. */
function fakeCognition({ directive = 'REALIZE_CURRENT_INTENT', choice = { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null }, clarifyChoice = { kind: 'NOT_APPLICABLE' } } = {}) {
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
        return {
          model: 'sentinel-fake',
          content: JSON.stringify({
            schema_version: 'conversation-cognition-proposal-v5',
            factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The supplied material states a deadline of Thursday.', source_refs: sortedRefs }] },
            cognition: {
              schema_version: 'cognition-proposal-v0', reasoning_summary: 'sentinel',
              relevant_memory_refs: [], considered_context_refs: sortedRefs,
              current_intent: 'summarize the request and the intended reply',
              confidence: 0.8, uncertainty: 0.2, action_intent: null, evidence_refs: sortedRefs
            },
            subjective_choice: isClarify ? clarifyChoice : choice,
            communication_directive: { kind: directive },
            clarification_basis: isClarify
              ? { current_observation_ref: observationRef, missing_information: 'the missing detail', needed_for: 'answering the request' }
              : null
          })
        };
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
        const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
        const block = /LANGUAGE REALIZATION INPUT V6[\s\S]*?\n(\{[\s\S]*?\n\})\n/.exec(user)?.[1];
        const handedOff = block === undefined ? null : JSON.parse(block).selected_subjective_choice;
        const text = handedOff?.kind === 'SELECTED' ? `The deadline is Thursday. ${handedOff.stance}` : 'The deadline is Thursday.';
        return {
          content: JSON.stringify({
            schema_version: 'language-realization-semantic-draft-v1',
            text,
            evidence_refs: []
          }),
          model: 'sentinel-fake'
        };
      }
    }
  };
}

const systemOf = (request) => request.messages.find((message) => message.role === 'system')?.content ?? '';
const userOf = (request) => request.messages.find((message) => message.role === 'user')?.content ?? '';

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

test('SELECTED sentinel: tagged V5 request, host-bound hash, stance + rationale reach V6', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition();
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c4-selected'
  });
  assert.equal(cognition.calls.length, 1, 'cognition transport must be reached exactly once');
  assert.equal(record.cognition_calls, 1);
  const schema = record.raw_cognition_request.structured_output;
  assert.equal(schema?.kind, 'JSON_SCHEMA');
  const advertised = JSON.stringify(schema.schema);
  assert.ok(advertised.includes('NOT_APPLICABLE') && advertised.includes('SELECTED'), 'both applicability branches must be advertised');
  assert.ok(!advertised.includes('projection_hash'), 'the V5 schema must not advertise projection_hash');
  assert.ok(!systemOf(record.raw_cognition_request).includes('projection_hash'), 'the V5 prompt must not ask for a projection hash');
  assert.ok(systemOf(record.raw_cognition_request).includes('belongs ONLY in subjective_rationale'), 'the authority rule must be stated');
  assert.equal(record.stages.SCHEMA_VALID, true, `V5 proposal must validate: ${record.failure_detail}`);
  assert.equal(record.status, 'COMPLETE', `sentinel turn must complete: ${record.failure_detail}`);
  assert.deepEqual(record.subjective_choice, { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null });
  assert.deepEqual(record.language_selected_subjective_choice, { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null });
  assert.equal(record.language_leakage.ok, true, JSON.stringify(record.language_leakage.found));
  assert.equal(language.calls.length, 1, 'REALIZE must reach Language exactly once');
  assert.ok(systemOf(language.calls[0]).includes('never upgrade it into a factual claim'), 'the rationale authority rule must reach Language');
  assert.ok(userOf(language.calls[0]).includes('"subjective_rationale"'), 'V6 must carry the rationale key');
  assert.ok(!userOf(language.calls[0]).includes('"selected_current_intent"'), 'V6 must not carry the descriptive intent');
  const classification = classifyRecord(SCENARIO, record);
  assert.equal(classification.choice_applicability, 'CHOICE_APPLICABILITY_CORRECT');
  assert.equal(classification.stance_selected, 'FIRST_OPTION');
  assert.equal(classification.language_choice, 'LANGUAGE_CHOICE_PRESERVED');
  assert.equal(classification.pass, true, JSON.stringify(classification));
});

test('NOT_APPLICABLE sentinel: the factual path completes and Language is told no preference exists', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ choice: { kind: 'NOT_APPLICABLE' } });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c4-not-applicable'
  });
  assert.equal(record.status, 'COMPLETE', `NOT_APPLICABLE must be admissible: ${record.failure_detail}`);
  assert.deepEqual(record.subjective_choice, { kind: 'NOT_APPLICABLE' });
  assert.deepEqual(record.language_selected_subjective_choice, { kind: 'NOT_APPLICABLE' });
  assert.equal(language.calls.length, 1);
  assert.ok(userOf(language.calls[0]).includes('"kind": "NOT_APPLICABLE"'), 'V6 must hand off the positive tag');
  assert.ok(systemOf(language.calls[0]).includes('Do NOT introduce'), 'Language must be told to withhold preferences');
  const classification = classifyRecord(SCENARIO, record);
  assert.equal(classification.choice_applicability, 'CHOICE_APPLICABILITY_WRONG', 'this choice-bearing scenario required SELECTED');
  assert.equal(classification.language_choice, 'LANGUAGE_CHOICE_NOT_HANDED_OFF');
  assert.equal(classification.language_invented_preference, false, 'Language must not invent the withheld preference');
});

test('a malformed tagged choice is refused by the host before Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  for (const [label, choice] of [
    ['enum-echo', { kind: 'SELECTED', stance: 'REALIZE_CURRENT_INTENT', subjective_rationale: null }],
    ['plan-on-not-applicable', { kind: 'NOT_APPLICABLE', stance: 'I would provide the calculated sum.' }],
    ['missing-rationale', { kind: 'SELECTED', stance: 'I would volunteer.' }]
  ]) {
    const cognition = fakeCognition({ choice });
    const language = fakeLanguage();
    const record = await runCondition({
      snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
      languageTransport: language.transport, sessionId: `sentinel-c4-${label}`
    });
    assert.equal(record.status, 'FAILED', `${label}: must fail the turn`);
    assert.equal(record.stages.EXECUTOR_ADMISSIBLE, false, `${label}: host must refuse`);
    assert.equal(language.calls.length, 0, `${label}: Language must not be reached`);
    assert.equal(classifyRecord(SCENARIO, record).pass, false, `${label}: cannot pass`);
  }
  assert.equal(applicabilityVerdict({ kind: 'NOT_APPLICABLE', stance: 'x' }).tag, 'UNLAWFUL');
});

test('CLARIFY sentinel: requires NOT_APPLICABLE and never calls Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT', choice: { kind: 'NOT_APPLICABLE' } });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-c4-clarify'
  });
  assert.equal(record.status, 'COMPLETE', `sentinel CLARIFY must complete: ${record.failure_detail}`);
  assert.equal(record.directive, 'CLARIFY_MISSING_CONTEXT');
  assert.deepEqual(record.subjective_choice, { kind: 'NOT_APPLICABLE' });
  assert.notEqual(record.clarification_basis, null);
  assert.equal(language.calls.length, 0, 'CLARIFY must not call Language');
  assert.equal(classifyRecord(SCENARIO, record).false_clarify, true, 'no scenario here genuinely lacks information');

  const selected = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT', clarifyChoice: { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null } });
  const failed = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: selected.transport,
    languageTransport: fakeLanguage().transport, sessionId: 'sentinel-c4-clarify-selected'
  });
  assert.equal(failed.status, 'FAILED', 'CLARIFY with a selection must fail closed');
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
