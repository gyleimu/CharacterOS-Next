/** Deterministic research classifier tests. ZERO model calls. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  choiceClass,
  classifyRecord,
  factualClass,
  languageCompletionAudit,
  preferencePresent,
  rationaleVerdict
} from './lib/classify.mjs';
import {
  DERIVATION_REGISTRY,
  LANGUAGE_CONNECTORS,
  MIXED_SCENARIOS,
  NULL_SCENARIOS,
  RELEVANT_SCENARIOS,
  RATIONALE_CLASSES
} from './lib/config.mjs';

const scenarios = [...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS];
const scenario = (id) => scenarios.find((entry) => entry.id === id);

function record(overrides = {}) {
  const rawSelection = overrides.subjective_selection ?? { kind: 'NO_SUBJECTIVE_SELECTION' };
  const rawAssessment = overrides.raw_model_factual_assessment ?? overrides.factual_assessment ?? {
    claims: [{ kind: 'HOST_VERIFIABLE_DERIVATION', operation: 'INTEGER_ARITHMETIC', source_handles: ['F1'], derivation: { source_expression: '17 + 25', operands: { left: 17, operator: 'ADD', right: 25 }, claimed_result: 42 } }]
  };
  const authoritativeAssessment = overrides.authoritative_factual_assessment ?? {
    claims: [{ kind: 'HOST_VERIFIABLE_DERIVATION', operation: 'INTEGER_ARITHMETIC', source_refs: ['observation:o-x'], derivation: { source_expression: '17 + 25', operands: { left: 17, operator: 'ADD', right: 25 }, claimed_result: 42 }, text: '17 + 25 = 42.' }]
  };
  const authoritativeSelection = overrides.authoritative_subjective_selection
    ?? overrides.language_selected_subjective_selection
    ?? rawSelection;
  const status = overrides.status ?? 'COMPLETE';
  const trace = overrides.factual_authorization_trace ?? rawAssessment.claims.map((claim) => ({
    status: 'AUTHORIZED_DERIVED_RESULT', rejection_code: null, raw_claim: claim
  }));
  return {
    status,
    directive: 'REALIZE_CURRENT_INTENT',
    current_intent: 'describe the plan',
    subjective_selection: rawSelection,
    language_selected_subjective_selection: authoritativeSelection,
    factual_assessment: rawAssessment,
    authoritative_proposal_minted: status === 'COMPLETE',
    authoritative_proposal_hash_minted: status === 'COMPLETE',
    advertised_handles: { factual: ['F1'], context: ['C1'], handle_to_ref: { F1: 'observation:o-x', C1: 'entity:alice' } },
    raw_cognition_wire: { cognition: { considered_handles: ['F1'], evidence_handles: ['F1'] } },
    final_behavior: '17 + 25 = 42.',
    language_calls: status === 'COMPLETE' ? 1 : 0,
    stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: status === 'COMPLETE' },
    request_attestation: { ok: true },
    language_leakage: { ok: true },
    ...overrides,
    authoritative_subjective_selection: authoritativeSelection,
    raw_model_factual_assessment: rawAssessment,
    authoritative_factual_assessment: authoritativeAssessment,
    factual_authorization_trace: trace
  };
}

const classify = (id, overrides = {}) => classifyRecord(scenario(id), record(overrides), LANGUAGE_CONNECTORS);

test('the research registry is the minimal frozen workload registry', () => {
  assert.deepEqual(DERIVATION_REGISTRY.operations, ['INTEGER_ARITHMETIC', 'STRING_REVERSE', 'RULE_CLASSIFICATION']);
  assert.ok(DERIVATION_REGISTRY.excludes.includes('PARAPHRASE'));
  assert.ok(DERIVATION_REGISTRY.excludes.includes('SEMANTIC_INFERENCE'));
});

test('rationale categories keep runtime authority and raw compliance distinct', () => {
  assert.equal(rationaleVerdict("I'd rather stop here.").lawful, true);
  assert.equal(rationaleVerdict('I prefer this while my energy is high.').lawful, false);
  assert.ok(RATIONALE_CLASSES.forbidden.includes('INFERRED_CAPACITY'));
  const classified = classify('M1', {
    subjective_selection: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer to own the review.', subjective_rationale: 'I prefer this while my energy is high.' },
    authoritative_subjective_selection: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer to own the review.', subjective_rationale: null },
    authoritative_factual_assessment: { claims: [{ kind: 'SOURCE_QUOTE', text: 'Thursday', source_refs: ['observation:o-x'] }] },
    final_behavior: 'Thursday. I would volunteer to own the review.'
  });
  assert.equal(classified.runtime_authoritative_rationale_safe, true);
  assert.equal(classified.raw_model_rationale_compliance, false);
  assert.equal(classified.rationale_category, 'ABSENT');
});

test('authorized factual cell reaches the unchanged null endpoint', () => {
  const result = classify('N1');
  assert.equal(result.authoritative_runtime_factual_validity, true);
  assert.equal(result.raw_model_factual_compliance, true);
  assert.equal(result.selection_applicability, 'SELECTION_APPLICABILITY_CORRECT');
  assert.equal(result.pass, true, JSON.stringify(result));
});

test('factual rejection suppresses stance and cannot pass', () => {
  const raw = { claims: [{ kind: 'DERIVED_RESULT', text: 'The subject has capacity.', source_handles: ['F1'] }] };
  const result = classify('R1', {
    status: 'FAILED',
    subjective_selection: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would volunteer.', subjective_rationale: 'I prefer to help.' },
    raw_model_factual_assessment: raw,
    factual_assessment: raw,
    authoritative_factual_assessment: null,
    authoritative_subjective_selection: null,
    factual_authorization_trace: [{ status: 'REJECTED', rejection_code: 'REJECTED_UNSUPPORTED_CLAIM_KIND', raw_claim: raw.claims[0] }],
    authoritative_proposal_minted: false,
    authoritative_proposal_hash_minted: false,
    language_calls: 0,
    final_behavior: null
  });
  assert.equal(result.raw_model_factual_compliance, false);
  assert.equal(result.authoritative_runtime_factual_validity, false);
  assert.deepEqual(result.factual_authorization_rejection_codes, ['REJECTED_UNSUPPORTED_CLAIM_KIND']);
  assert.equal(result.stance_selected, 'NOT_SCORED');
  assert.equal(result.selection_applicability, 'NOT_SCORED');
  assert.equal(result.pass, false);
});

test('handle binding remains a separate exact provenance audit', () => {
  const bound = classify('N1');
  assert.equal(bound.handle_binding, 'HANDLE_BOUND');
  const escalated = classify('N1', {
    factual_assessment: { claims: [{ kind: 'SOURCE_QUOTE', text: 'x', source_handles: ['C1'] }] },
    raw_model_factual_assessment: { claims: [{ kind: 'SOURCE_QUOTE', text: 'x', source_handles: ['C1'] }] }
  });
  assert.equal(escalated.handle_binding, 'HANDLE_NAMESPACE_ERROR');
  assert.equal(escalated.pass, false);
});

test('language completion audits only the authoritative payload', () => {
  const base = {
    authoritative_subjective_selection: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would attend the planning meeting.', subjective_rationale: null },
    authoritative_factual_assessment: { claims: [{ kind: 'SOURCE_QUOTE', text: '15:00', source_refs: ['observation:o-x'] }] },
    final_behavior: '15:00. I would attend the planning meeting because that is my preference.'
  };
  assert.deepEqual(languageCompletionAudit(base, LANGUAGE_CONNECTORS).decision_tokens, []);
  assert.equal(languageCompletionAudit({ ...base, final_behavior: 'I would attend and inspect the backup plan.' }, LANGUAGE_CONNECTORS).completed, true);
});

test('frozen factual and choice endpoint helpers remain stable', () => {
  assert.equal(factualClass(scenario('N1'), '17 + 25 = 42.'), 'FACT_CORRECT');
  assert.equal(choiceClass('VOLUNTEER', "I don't want to take this on."), 'SECOND_OPTION');
  assert.equal(choiceClass('ORDER', 'I would inspect the backup plan first.'), 'SECOND_OPTION');
  assert.equal(preferencePresent('17 + 25 = 42.'), false);
});
