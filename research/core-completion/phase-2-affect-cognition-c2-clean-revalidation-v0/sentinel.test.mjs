/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — deterministic transport sentinel
 * and attestation preflight (ZERO model calls).
 *
 * Exists specifically to prevent a repeat of the previous slice's
 * "65 records / 0 provider calls" incident: it proves, with fake transports,
 * that the research wrapper constructs attestation successfully, actually
 * reaches the transport exactly once per cognition cell, captures the request,
 * processes the response, and routes the Language branch by directive.
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
import { classifyRecord } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCENARIO = MIXED_SCENARIOS[0];

/** Deterministic fake cognition transport: builds a valid V3 proposal from the request. */
function fakeCognition({ directive = 'REALIZE_CURRENT_INTENT' } = {}) {
  const calls = [];
  return {
    calls,
    transport: {
      complete: async (request) => {
        calls.push(request);
        const user = request.messages.find((message) => message.role === 'user').content;
        const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1];
        const observationRef = /^\[current observation\] (\S+)$/m.exec(user)?.[1];
        const factualBlock = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(user)?.[0] ?? '';
        const refs = [...factualBlock.matchAll(/^- (\S+)$/gm)].map((match) => match[1]);
        assert.ok(projectionHash, 'sentinel: projection_hash must be captured');
        assert.ok(observationRef, 'sentinel: current observation ref must be rendered');
        assert.ok(refs.length > 0, 'sentinel: FACTUAL SOURCE REFS must advertise inspectable sources');
        assert.ok(refs.includes(observationRef), 'sentinel: the current observation must be a factual source');
        const sortedRefs = [...refs].sort();
        const proposal =
          directive === 'CLARIFY_MISSING_CONTEXT'
            ? {
                schema_version: 'conversation-cognition-proposal-v3',
                factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The supplied material states a deadline.', source_refs: refs }] },
                cognition: {
                  schema_version: 'cognition-proposal-v0', projection_hash: projectionHash, reasoning_summary: 'sentinel',
                  relevant_memory_refs: [], considered_context_refs: sortedRefs, current_intent: 'Ask Alice for the missing detail',
                  confidence: 0.5, uncertainty: 0.5, action_intent: null, evidence_refs: sortedRefs
                },
                communication_directive: { kind: 'CLARIFY_MISSING_CONTEXT' },
                clarification_basis: { current_observation_ref: observationRef, missing_information: 'the missing detail', needed_for: 'answering the request' }
              }
            : {
                schema_version: 'conversation-cognition-proposal-v3',
                factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The supplied material states a deadline of Thursday.', source_refs: refs }] },
                cognition: {
                  schema_version: 'cognition-proposal-v0', projection_hash: projectionHash, reasoning_summary: 'sentinel',
                  relevant_memory_refs: [], considered_context_refs: sortedRefs, current_intent: 'I would volunteer to own the review',
                  confidence: 0.8, uncertainty: 0.2, action_intent: null, evidence_refs: sortedRefs
                },
                communication_directive: { kind: 'REALIZE_CURRENT_INTENT' },
                clarification_basis: null
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

test('condition variants are deterministic and attestation-safe (no ReferenceError path)', () => {
  const base = ['[identity] subject_id="s"', '[context] scene="x" task="y"', '[affect (canonical)] valence=0.1 activation=0.2', '[affect (canonical) legend] legend', 'CITEABLE CONTEXT REFS:', '[ALLOWED ACTION SPACE]'].join('\n');
  for (const id of ['P', 'N', 'Z']) {
    const variant = conditionVariant(base, id);
    assert.equal(variant.removedIndices.length, 0);
    assert.equal(variant.transformed.split('\n').length, base.split('\n').length);
  }
  const absent = conditionVariant(base, 'A');
  assert.equal(absent.removedIndices.length, 2, 'A removes the value line and the legend');
  assert.deepEqual(absent.removedIndices, conditionVariant(base, 'A').removedIndices, 'removedIndices is deterministic');
  assert.equal(SCENARIO.expected, 'Thursday');
  assert.equal(QUALIFICATION_SCENARIOS.length, 13);
  assert.equal(CONDITIONS.A.kind, 'ABSENT');
});

test('REALIZE sentinel: transport reached exactly once, request captured, attestation written, Language reached', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition();
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-realize'
  });
  assert.equal(cognition.calls.length, 1, 'cognition transport must be reached exactly once');
  assert.equal(record.cognition_calls, 1);
  assert.ok(record.raw_cognition_request, 'request must be captured');
  assert.equal(record.raw_cognition_request.structured_output?.kind, 'JSON_SCHEMA', 'native structured output must be requested');
  assert.equal(record.stages.SCHEMA_VALID, true);
  assert.equal(record.status, 'COMPLETE', `sentinel turn must complete: ${record.failure_detail}`);
  assert.equal(record.failure_stage, null, 'no pre-transport or validation failure');
  assert.ok(record.request_attestation, 'request attestation must be written');
  assert.equal(record.request_attestation.ok, true);
  assert.equal(record.language_leakage.ok, true);
  assert.equal(language.calls.length, 1, 'REALIZE must reach the Language branch exactly once');
  assert.equal(record.stages.FINAL_BEHAVIOR, true);
  assert.equal(classifyRecord(SCENARIO, record).pass, true, JSON.stringify(classifyRecord(SCENARIO, record)));
});

test('CLARIFY sentinel: valid basis routes the host branch and never calls Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT' });
  const language = fakeLanguage();
  const record = await runCondition({
    snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport,
    languageTransport: language.transport, sessionId: 'sentinel-clarify'
  });
  assert.equal(cognition.calls.length, 1);
  assert.equal(record.status, 'COMPLETE', `sentinel CLARIFY must complete: ${record.failure_detail}`);
  assert.equal(record.directive, 'CLARIFY_MISSING_CONTEXT');
  assert.equal(language.calls.length, 0, 'CLARIFY must not call the Language provider');
  assert.equal(record.language_calls, 0);
  assert.equal(record.request_attestation.ok, true);
});

test('freeze artifacts are internally consistent once prepared', () => {
  for (const file of ['qualification-freeze.json', 'formal-freeze.json']) {
    let freeze;
    try {
      freeze = JSON.parse(readFileSync(resolve(here, file), 'utf8'));
    } catch {
      continue; // not prepared yet in this checkout
    }
    assert.ok(freeze.freeze_hash, `${file}: freeze_hash required`);
    assert.equal(freeze.created_before_model_calls, true);
    assert.equal(freeze.provider.digest, freeze.declared_provider.required_digest);
  }
});
