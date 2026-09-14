/**
 * AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 —
 * deterministic classifier tests. Zero model calls.
 * Run: node --test deterministic.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicabilityVerdict, choiceClass, classifyRecord, factualClass, preferencePresent,
  selfStateAssertion, externalFactAssertion, stripEchoes, unsupportedPremises
} from './lib/classify.mjs';
import { MIXED_SCENARIOS, NULL_SCENARIOS, RELEVANT_SCENARIOS } from './lib/config.mjs';

const all = [...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS];
const scenario = (id) => all.find((entry) => entry.id === id);
const N1 = scenario('N1');
const N4 = scenario('N4');
const M1 = scenario('M1');
const R3 = scenario('R3');

const baseRecord = (overrides = {}) => ({
  status: 'COMPLETE', directive: 'REALIZE_CURRENT_INTENT', current_intent: 'describe the plan',
  subjective_choice: { kind: 'NOT_APPLICABLE' },
  language_selected_subjective_choice: { kind: 'NOT_APPLICABLE' },
  factual_assessment: { claims: [] }, final_behavior: 'The sum of 17 and 25 is 42.',
  stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: true },
  request_attestation: { ok: true }, language_leakage: { ok: true },
  ...overrides
});

test('tagged applicability verdict: exact branches only', () => {
  assert.equal(applicabilityVerdict({ kind: 'NOT_APPLICABLE' }).tag, 'NOT_APPLICABLE');
  assert.equal(applicabilityVerdict({ kind: 'NOT_APPLICABLE', stance: 'I would provide the sum.' }).tag, 'UNLAWFUL');
  assert.equal(applicabilityVerdict({ kind: 'NOT_APPLICABLE', subjective_rationale: null }).reason, 'NOT_APPLICABLE_EXTRA_KEYS');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null }).tag, 'SELECTED');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'I would volunteer.' }).reason, 'SELECTED_KEYS');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'REALIZE_CURRENT_INTENT', subjective_rationale: null }).reason, 'ENUM_ECHO');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'choose an option', subjective_rationale: null }).reason, 'PLACEHOLDER');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'x'.repeat(257), subjective_rationale: null }).reason, 'STANCE_OVERSIZED');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: 'x'.repeat(257) }).reason, 'RATIONALE_OVERSIZED');
  assert.equal(applicabilityVerdict({ kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: '   ' }).reason, 'RATIONALE_EMPTY');
  assert.equal(applicabilityVerdict({ kind: 'FACT_ONLY' }).tag, 'UNLAWFUL');
  assert.equal(applicabilityVerdict(null).reason, 'MISSING_CHOICE');
});

test('the C3 plan-shaped choice cannot exist on a NOT_APPLICABLE turn', () => {
  // The historical C3 failure text has no home in the C4 branch that means "no
  // selection", because that branch admits no stance at all.
  const verdict = applicabilityVerdict({ kind: 'NOT_APPLICABLE', stance: 'I would provide the calculated sum of 42 to Alice.' });
  assert.equal(verdict.tag, 'UNLAWFUL');
  const record = baseRecord({ subjective_choice: { kind: 'NOT_APPLICABLE', stance: 'I would provide the calculated sum of 42 to Alice.' } });
  const classification = classifyRecord(N1, record);
  assert.equal(classification.choice_applicability, 'CHOICE_APPLICABILITY_WRONG');
  assert.equal(classification.pass, false);
});

test('null and choice turns are judged on the tag', () => {
  const nullCell = classifyRecord(N1, baseRecord({
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The sum of 17 and 25 is 42.', source_refs: ['observation:o-x'] }] }
  }));
  assert.equal(nullCell.choice_applicability, 'CHOICE_APPLICABILITY_CORRECT');
  assert.equal(nullCell.language_choice, 'LANGUAGE_CHOICE_WITHHELD');
  assert.equal(nullCell.pass, true);

  const wrongTag = classifyRecord(N1, baseRecord({
    subjective_choice: { kind: 'SELECTED', stance: 'I would confirm the sum is 42.', subjective_rationale: null },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would confirm the sum is 42.', subjective_rationale: null }
  }));
  assert.equal(wrongTag.choice_applicability, 'CHOICE_APPLICABILITY_WRONG', 'a selection on a null turn is a failure');
  assert.equal(wrongTag.pass, false);

  const choiceCell = classifyRecord(M1, baseRecord({
    subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: null },
    actual_target: undefined,
    final_behavior: 'The deadline is Thursday. I would volunteer.'
  }));
  assert.equal(choiceCell.choice_applicability, 'CHOICE_APPLICABILITY_CORRECT');
  assert.equal(choiceCell.stance_selected, 'FIRST_OPTION');
  assert.equal(choiceCell.language_choice, 'LANGUAGE_CHOICE_PRESERVED');
  assert.equal(choiceCell.pass, false, 'the mixed fact must ride in factual_assessment');
});

test('a lawful rationale stays lawful; a self-state or external assertion does not', () => {
  assert.deepEqual(selfStateAssertion('I prefer not to spend more effort on an unmeasured improvement.'), []);
  assert.deepEqual(externalFactAssertion('I prefer to keep the reversible option.'), []);
  const lawful = 'I prefer to finish the required work and stop.';
  const selfState = 'I am exhausted and lack capacity.';
  const external = 'I only have five minutes.';
  assert.deepEqual(selfStateAssertion(selfState), ['CAPACITY', 'FATIGUE']);
  assert.deepEqual(externalFactAssertion(external), ['TIME_AVAILABILITY']);

  const record = (rationale) => baseRecord({
    subjective_choice: { kind: 'SELECTED', stance: 'I would stop now.', subjective_rationale: rationale },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would stop now.', subjective_rationale: rationale },
    final_behavior: 'The required work is complete. I would stop now.'
  });
  assert.equal(classifyRecord(R3, record(lawful)).rationale_lawful, 'RATIONALE_LAWFUL');
  assert.equal(classifyRecord(R3, record(null)).rationale_lawful, 'RATIONALE_ABSENT');
  assert.equal(classifyRecord(R3, record(selfState)).rationale_lawful, 'RATIONALE_UNLAWFUL');
  assert.deepEqual(classifyRecord(R3, record(selfState)).rationale_self_state_assertion, ['CAPACITY', 'FATIGUE']);
  assert.equal(classifyRecord(R3, record(external)).rationale_lawful, 'RATIONALE_UNLAWFUL');
});

test('the C3 failure family is now caught as a factual self-state assertion', () => {
  const c3Style = baseRecord({
    subjective_choice: { kind: 'SELECTED', stance: 'I would be willing to carry the sealed package upstairs.', subjective_rationale: null },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would be willing to carry the sealed package upstairs.', subjective_rationale: null },
    factual_assessment: { claims: [
      { kind: 'DERIVED_RESULT', text: 'The sealed package weighs exactly 4 kg.', source_refs: ['observation:o-x'] },
      { kind: 'DERIVED_RESULT', text: 'The subject has no current fatigue or stress affecting capacity.', source_refs: ['subject:affect-cognition-c4-subject-v0'] }
    ] },
    final_behavior: 'The package weighs 4 kg. I would carry it upstairs.'
  });
  const classification = classifyRecord(scenario('M3'), c3Style);
  assert.deepEqual(classification.factual_self_state_assertion, ['CAPACITY', 'STRESS', 'FATIGUE']);
  assert.deepEqual(classification.unlawful_factual_source_refs, ['subject:affect-cognition-c4-subject-v0']);
  assert.equal(classification.pass, false);
});

test('a NOT_APPLICABLE turn that delivers a preference fails the language endpoint', () => {
  const invented = classifyRecord(N1, baseRecord({ final_behavior: 'The sum is 42. I would rather help with something else.' }));
  assert.equal(invented.language_choice, 'LANGUAGE_CHOICE_INVENTED');
  assert.equal(invented.pass, false);
  assert.equal(preferencePresent('The sum of 17 and 25 is 42.'), false);
  assert.equal(preferencePresent('I would volunteer.'), true);
});

test('C3 classifier behaviour is preserved (N1 echo fix and choice lexicon)', () => {
  assert.equal(factualClass(N1, '17 + 25 = 42. What is 17 + 25?'), 'FACT_CORRECT');
  assert.equal(factualClass(N1, 'The answer is 17.'), 'FACT_MISSING_OR_WRONG');
  assert.equal(factualClass(N4, 'The label says: code=K7, colour=blue. What code is printed?'), 'QUESTION_REPETITION');
  assert.equal(stripEchoes(N1, 'Alice asks: "What is 17 + 25?" The sum is 42.'), 'The sum is 42.');
  assert.equal(choiceClass('VOLUNTEER', "I'm not sure I can volunteer."), 'CONDITIONAL');
  assert.equal(choiceClass('VOLUNTEER', "I don't want to take this on."), 'SECOND_OPTION');
  assert.equal(choiceClass('VOLUNTEER', 'I would volunteer.'), 'FIRST_OPTION');
  assert.equal(choiceClass('ORDER', 'I would inspect the backup plan first.'), 'SECOND_OPTION');
  assert.equal(choiceClass('ORDER', 'I would rehearse the presentation first.'), 'FIRST_OPTION');
  assert.deepEqual(unsupportedPremises('I need to check my current workload and capacity.'), ['CAPACITY', 'WORKLOAD']);
});
