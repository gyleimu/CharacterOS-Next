/**
 * AFFECT_COGNITION_EVALUATOR_V2_..._V0 — deterministic transport sentinel (ZERO model calls).
 *
 * Proves, with fake transports against the real runtime, that C4.2 exercises the
 * production surfaces before any model call:
 *   - the pipeline reaches the Cognition transport with the tagged V5 schema;
 *   - the C4.2 rationale policy and the grounded-stance requirement are present in
 *     the sent cognition prompt;
 *   - the Language prompt carries the no-semantic-completion rule;
 *   - NOT_APPLICABLE and SELECTED both work, and the rationale survives the V6 handoff;
 *   - the grounding guard state is explicit: RESEARCH_ONLY (it did not survive its
 *     paraphrase evaluation and never fails a turn);
 *   - host binding works and session ids stay condition-blind.
 *
 * Run: node --test sentinel.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONDITIONS, GROUNDING, MIXED_SCENARIOS, QUALIFICATION_SCENARIOS } from './lib/config.mjs';
import { conditionVariant, growSnapshot, runCondition } from './lib/pipeline.mjs';
import { applicabilityVerdict, classifyRecord } from './lib/classify.mjs';
import { LANGUAGE_CONNECTORS } from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCENARIO = MIXED_SCENARIOS[0];

function fakeCognition({ directive = 'REALIZE_CURRENT_INTENT', choice = { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer to own the review.', subjective_rationale: null }, clarifyChoice = { kind: 'NO_SUBJECTIVE_SELECTION' } } = {}) {
  const calls = [];
  return {
    calls,
    transport: {
      complete: async (request) => {
        calls.push(request);
        const user = request.messages.find((message) => message.role === 'user').content;
        const observationRef = /^\[current observation\] (\S+)$/m.exec(user)?.[1];
        // C4.4: the model selects advertised HANDLES; it never echoes a canonical ref.
        const factualHandles = (() => {
          const block = /FACTUAL SOURCE HANDLES[\s\S]*?(?=\nCONTEXT HANDLES)/.exec(user)?.[0] ?? '';
          return [...block.matchAll(/^- (F\d+): (\S+)$/gm)].map((match) => ({ handle: match[1], ref: match[2] }));
        })();
        const contextHandles = (() => {
          const block = /CONTEXT HANDLES[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(user)?.[0] ?? '';
          return [...block.matchAll(/^- (C\d+): (\S+)$/gm)].map((match) => ({ handle: match[1], ref: match[2] }));
        })();
        assert.ok(observationRef, 'sentinel: current observation ref must be rendered');
        const observationHandle = factualHandles.find((entry) => entry.ref === observationRef)?.handle;
        assert.ok(observationHandle, 'sentinel: the current observation must be an advertised factual source handle');
        const contextObservationHandle = contextHandles.find((entry) => entry.ref === observationRef)?.handle;
        // Namespaces are disjoint: a factual source carries exactly one handle, an F
        // handle, and is never re-advertised in the C namespace.
        assert.equal(contextObservationHandle, undefined, 'sentinel: a factual source must not be advertised as a context handle');
        const isClarify = directive === 'CLARIFY_MISSING_CONTEXT';
        return {
          model: 'sentinel-fake',
          content: JSON.stringify({
            schema_version: 'conversation-cognition-proposal-v6',
            factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The supplied material states a deadline of Thursday.', source_handles: [observationHandle] }] },
            cognition: {
              schema_version: 'cognition-proposal-v0', reasoning_summary: 'sentinel',
              relevant_memory_handles: [], considered_handles: [observationHandle],
              current_intent: 'summarize the request and the intended reply',
              confidence: 0.8, uncertainty: 0.2, action_intent: null, evidence_handles: [observationHandle]
            },
            subjective_selection: isClarify ? clarifyChoice : choice,
            communication_directive: { kind: directive },
            clarification_basis: isClarify ? { current_observation_ref: observationRef, missing_information: 'the missing detail', needed_for: 'answering the request' } : null
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
        const block = /LANGUAGE REALIZATION INPUT V7[\s\S]*?\n(\{[\s\S]*?\n\})\n/.exec(user)?.[1];
        const handedOff = block === undefined ? null : JSON.parse(block).selected_subjective_selection;
        const text = handedOff?.kind === 'SUBJECTIVE_SELECTION' ? `The deadline is Thursday. ${handedOff.stance}` : 'The deadline is Thursday.';
        return { content: JSON.stringify({ schema_version: 'language-realization-semantic-draft-v1', text, evidence_refs: [] }), model: 'sentinel-fake' };
      }
    }
  };
}

const systemOf = (request) => request.messages.find((message) => message.role === 'system')?.content ?? '';

test('condition variants are deterministic and attestation-safe', () => {
  const base = ['[identity] subject_id="s"', '[context] scene="x" task="y"', '[affect (canonical)] valence=0.1 activation=0.2', '[affect (canonical) legend] legend', 'CITEABLE CONTEXT REFS:', '[ALLOWED ACTION SPACE]'].join('\n');
  for (const id of ['P', 'N', 'Z']) {
    const variant = conditionVariant(base, id);
    assert.equal(variant.removedIndices.length, 0);
  }
  assert.equal(conditionVariant(base, 'A').removedIndices.length, 2);
  assert.equal(QUALIFICATION_SCENARIOS.length, 13);
  assert.equal(CONDITIONS.A.kind, 'ABSENT');
});

test('SELECTED sentinel: C4.2 policy prompts, tagged request, V6 handoff', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition();
  const language = fakeLanguage();
  const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: 'sentinel-ev2-selected' });
  assert.equal(cognition.calls.length, 1);
  assert.equal(record.raw_cognition_request.structured_output?.kind, 'JSON_SCHEMA');
  const system = systemOf(record.raw_cognition_request);
  assert.ok(system.includes('FORBIDDEN rationale content'), 'rationale policy must be present');
  assert.ok(system.includes('STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION'), 'the C4.4 latitude discriminator must be present');
  assert.ok(system.includes('FACTUAL SOURCE HANDLES'), 'the handle namespaces must be advertised');
  assert.ok(system.includes('CITATION BINDING'), 'C4.3 restored citation-binding contract must be present');
  assert.ok(system.includes('cognition.considered_handles AND cognition.evidence_handles'), 'the citation binding must name both cognition handle arrays');
  assert.ok(system.includes('stays LATENT'), 'latent subject state must be stated');
  assert.ok(system.includes('stance is ONE short sentence stating the choice itself and which alternative was selected'), 'the grounded-stance requirement (V6 rule 4) must be present');
  assert.ok(!system.includes('projection_hash'), 'no model-owned integrity field');
  // Compaction + example-neutrality repair: out-of-domain positive examples, the
  // central subject-property boundary, and the fact-relative latitude form.
  for (const lawful of ['I prefer the window seat because I like the quieter side.', "I'd rather spend the available time reading.", "I'd rather use the blue notebook because it keeps my notes organized."]) {
    assert.ok(system.includes(lawful), `neutral lawful example must be present: ${lawful}`);
  }
  for (const removed of ["I'd rather avoid extra work whose benefit is unknown.", "I'd rather help.", "I'd prefer to decline.", 'I prefer to use the free time to help.', "I'd be willing to spend the available time on the review.", "I'd rather stop here.", 'I prefer the reversible option.']) {
    assert.ok(!system.includes(removed), `directionally contaminated example must be ABSENT: ${removed}`);
  }
  for (const unlawful of ['I have enough capacity.', "I'm capable of doing it.", 'My mind is fresh.']) {
    assert.ok(system.includes(unlawful), `compact unlawful example must be present: ${unlawful}`);
  }
  assert.ok(system.includes('SUBJECT-PROPERTY BOUNDARY'), 'the central subject-property boundary rule must be present');
  assert.ok(system.includes('AVAILABILITY IS NOT CAPACITY'), 'the availability != capacity rule must be stated');
  assert.ok(system.includes('the supplied facts permit either response'), 'the fact-relative latitude example must be present');
  assert.ok(system.includes('the subject has capacity for either response'), 'the forbidden subject-relative latitude form must be named');
  assert.ok(system.includes('The supplied facts leave both responses feasible.'), 'the lawful fact-relative claim must be named');
  assert.ok(system.includes('rule 5d applies to claims verbatim'), 'the factual rule must reference the central boundary');
  assert.equal(record.status, 'COMPLETE', `turn must complete: ${record.failure_detail}`);
  assert.deepEqual(record.language_selected_subjective_selection, { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer to own the review.', subjective_rationale: null });
  const languageSystem = systemOf(language.calls[0]);
  assert.ok(languageSystem.includes('NEVER supply a decision target'), 'the language no-semantic-completion rule must be present');
  assert.ok(languageSystem.includes('you must NOT repair it'), 'the language prohibition must be explicit');
  const classification = classifyRecord(SCENARIO, record, LANGUAGE_CONNECTORS);
  assert.equal(classification.selection_applicability, 'SELECTION_APPLICABILITY_CORRECT');
  assert.equal(classification.off_question, 'ON_QUESTION_STANCE');
  assert.equal(classification.language_completion, 'PRESERVED');
  assert.equal(classification.pass, true, JSON.stringify({ classification, leakage: record.language_leakage, attestation: record.request_attestation?.ok }));
});

test('NOT_APPLICABLE sentinel: factual path completes, Language withholds preference', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ choice: { kind: 'NO_SUBJECTIVE_SELECTION' } });
  const language = fakeLanguage();
  const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: 'sentinel-ev2-not-applicable' });
  assert.equal(record.status, 'COMPLETE', `must complete: ${record.failure_detail}`);
  const classification = classifyRecord(SCENARIO, record, LANGUAGE_CONNECTORS);
  // this choice-bearing scenario was handed NOT_APPLICABLE: the honest label is
  // 'not handed off', and Language must not have invented the withheld preference.
  assert.equal(classification.language_choice, 'LANGUAGE_CHOICE_NOT_HANDED_OFF');
  assert.equal(classification.language_invented_preference, false);
  assert.equal(classification.language_completion, 'PRESERVED');
});

test('default-off guard: an ungrounded stance is a RESEARCH verdict, never a host refusal', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  // The historical M2 stance shape on a SCENARIO whose pair is VOLUNTEER (M1) is on-question;
  // the point here is that the turn still DELIVERS: the guard is not in production.
  const cognition = fakeCognition({ choice: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would instead consider something else entirely.', subjective_rationale: null } });
  const language = fakeLanguage();
  const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: 'sentinel-ev2-guard-off' });
  assert.equal(record.status, 'COMPLETE', 'the lexical guard must NOT fail a turn (guard_shipped=false)');
  assert.equal(record.stages.EXECUTOR_ADMISSIBLE, true);
  assert.equal(GROUNDING.guard_shipped, false);
  assert.equal(GROUNDING.guard_status, 'RESEARCH_ONLY_LEXICAL_GROUNDING_GUARD_TOO_BRITTLE');
  const classification = classifyRecord(SCENARIO, record, LANGUAGE_CONNECTORS);
  assert.equal(classification.off_question, 'OFF_QUESTION_STANCE', 'the experiment still detects it');
  assert.equal(classification.pass, false);
});

test('malformed tagged choices are still refused by the host before Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  for (const [label, choice] of [
    ['enum-echo', { kind: 'SUBJECTIVE_SELECTION', stance: 'REALIZE_CURRENT_INTENT', subjective_rationale: null }],
    ['plan-on-not-applicable', { kind: 'NO_SUBJECTIVE_SELECTION', stance: 'I would provide the calculated sum.' }],
    ['missing-rationale', { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer.' }]
  ]) {
    const cognition = fakeCognition({ choice });
    const language = fakeLanguage();
    const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: `sentinel-ev2-${label}` });
    assert.equal(record.status, 'FAILED', `${label}: must fail`);
    assert.equal(language.calls.length, 0, `${label}: Language must not be reached`);
  }
  assert.equal(applicabilityVerdict({ kind: 'NO_SUBJECTIVE_SELECTION', stance: 'x' }).tag, 'UNLAWFUL');
});

test('CLARIFY requires NOT_APPLICABLE and never calls Language', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT' });
  const language = fakeLanguage();
  const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: 'sentinel-ev2-clarify' });
  assert.equal(record.status, 'COMPLETE', `must complete: ${record.failure_detail}`);
  assert.equal(language.calls.length, 0);
  const selected = fakeCognition({ directive: 'CLARIFY_MISSING_CONTEXT', clarifyChoice: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer.', subjective_rationale: null } });
  const failed = await runCondition({ snapshot, scenario: SCENARIO, conditionId: null, cognitionTransport: selected.transport, languageTransport: fakeLanguage().transport, sessionId: 'sentinel-ev2-clarify-selected' });
  assert.equal(failed.status, 'FAILED');
});

test('frozen mechanics are unchanged by the vocabulary repair', async () => {
  const snapshot = await growSnapshot(['Alice asks how the project documentation is currently organized.']);
  const cognition = fakeCognition();
  const language = fakeLanguage();
  const record = await runCondition({ snapshot, scenario: SCENARIO, conditionId: 'A', cognitionTransport: cognition.transport, languageTransport: language.transport, sessionId: 'sentinel-ev2-frozen' });
  const system = systemOf(record.raw_cognition_request);
  assert.ok(system.includes('conversation-cognition-proposal-v6'), 'the V6 selection protocol is unchanged');
  assert.ok(system.includes('kind NO_SUBJECTIVE_SELECTION'), 'the NO_SUBJECTIVE_SELECTION rule is unchanged');
  assert.ok(system.includes('kind SUBJECTIVE_SELECTION'), 'the SUBJECTIVE_SELECTION rule is unchanged');
  assert.ok(system.includes('EVIDENCE HANDLES') && system.includes('CITATION BINDING'), 'handle rules unchanged');
  const schema = JSON.stringify(record.raw_cognition_request.structured_output.schema);
  for (const key of ['relevant_memory_handles', 'considered_handles', 'evidence_handles', 'source_handles', 'subjective_selection']) {
    assert.ok(schema.includes(key), `wire schema key must be unchanged: ${key}`);
  }
  assert.ok(!schema.includes('projection_hash'), 'no model-owned integrity field in the wire schema');
  const languageUser = language.calls[0].messages.find((message) => message.role === 'user').content;
  assert.ok(languageUser.includes('LANGUAGE REALIZATION INPUT V7'), 'the Language protocol is unchanged');
  const visible = record.raw_cognition_request.messages.map((message) => message.content).join('\n');
  for (const token of ['condition_id', 'scenario_id', 'replicate', 'canonical_affect', 'valence']) {
    assert.ok(!visible.includes(token), `condition-blind: ${token} must not be model-visible`);
  }
});

test('freeze artifacts are internally consistent once prepared', () => {
  for (const file of ['qualification-freeze.json', 'formal-freeze.json']) {
    let freeze;
    try {
      freeze = JSON.parse(readFileSync(resolve(here, file), 'utf8'));
    } catch {
      continue;
    }
    assert.ok(freeze.freeze_hash, `${file}: freeze_hash required`);
    assert.equal(freeze.provider.digest, freeze.declared_provider.required_digest);
    assert.equal(freeze.grounding.guard_shipped, false, `${file}: the lexical guard must not be shipped`);
  }
});
