/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — deterministic classifier tests.
 * Zero model calls. Run: node --test deterministic.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { choiceClass, classifyRecord, factualClass, stanceVerdict, stripEchoes, unsupportedPremises } from './lib/classify.mjs';
import { MIXED_SCENARIOS, NULL_SCENARIOS, RELEVANT_SCENARIOS } from './lib/config.mjs';

const scenario = (id) => [...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS].find((entry) => entry.id === id);
const N1 = scenario('N1');
const N4 = scenario('N4');
const N5Q = scenario('N5Q');
const N6 = scenario('N6');

test('N1 artifact is fixed: a correct answer plus an echoed question is not a contradiction', () => {
  // The exact C2 false positive: "is 17" inside the echoed question.
  assert.equal(factualClass(N1, '17 + 25 = 42. What is 17 + 25?'), 'FACT_CORRECT');
  assert.equal(factualClass(N1, 'The sum is 42. What is 17 + 25?'), 'FACT_CORRECT');
  assert.equal(factualClass(N1, 'The answer is 42.'), 'FACT_CORRECT');
  assert.equal(factualClass(N1, 'The answer is 42.\nWhat is 17 + 25?'), 'FACT_CORRECT');
});

test('genuine numeric and token contradictions are still detected', () => {
  assert.equal(factualClass(N1, 'The answer is 42, but the other answer is 17.'), 'FACTUAL_CONTRADICTION');
  assert.equal(factualClass(scenario('N2'), 'The answer is 35, but the result is 36.'), 'FACTUAL_CONTRADICTION');
  assert.equal(factualClass(scenario('N3'), 'Parcel R8 is on shelf C4, so it is on shelf B2.'), 'FACTUAL_CONTRADICTION');
  assert.equal(factualClass(N4, 'The code is K7. The other code is B2.'), 'FACTUAL_CONTRADICTION');
  assert.equal(factualClass(N6, 'It is not a MATCH; actually it is MATCH.'), 'FACTUAL_CONTRADICTION');
  // A plainly wrong answer that never states the expected token is still a failure
  // (a distinct label, so the two failure modes stay separable in the evidence).
  assert.equal(factualClass(N1, 'The answer is 17.'), 'FACT_MISSING_OR_WRONG');
  assert.equal(factualClass(N1, 'The result is 43.'), 'FACT_MISSING_OR_WRONG');
  assert.equal(factualClass(N5Q, 'Reversing R8K2 gives R2K8.'), 'FACT_MISSING_OR_WRONG');
  assert.equal(factualClass(N4, 'The printed code is B2.'), 'FACT_MISSING_OR_WRONG');
});

test('echoing the user question instead of answering is question repetition', () => {
  assert.equal(factualClass(N4, 'The label says: code=K7, colour=blue. What code is printed?'), 'QUESTION_REPETITION');
  assert.equal(factualClass(N4, 'The printed code is K7.'), 'FACT_CORRECT');
  assert.equal(factualClass(N4, 'The code is K7; what code is printed?'), 'FACT_CORRECT');
  assert.equal(factualClass(N5Q, 'The reverse of R8K2 is 2K8R.'), 'FACT_CORRECT');
});

test('missing or absent expected facts stay missing', () => {
  assert.equal(factualClass(N1, 'I would rather not answer that.'), 'FACT_MISSING_OR_WRONG');
  assert.equal(factualClass(N5Q, ''), 'FACT_MISSING_OR_WRONG');
});

test('echo stripping removes scenario wording and quoted spans only', () => {
  assert.equal(stripEchoes(N1, 'Alice asks: "What is 17 + 25?" The sum is 42.'), 'The sum is 42.');
  assert.equal(stripEchoes(N1, 'The sum is 42.'), 'The sum is 42.');
});

test('choice classification keeps C2 semantics and covers every C3 option pair', () => {
  // C2-era semantic regressions (unchanged behaviour).
  assert.equal(choiceClass('VOLUNTEER', "I'm not sure I can volunteer."), 'CONDITIONAL');
  assert.equal(choiceClass('VOLUNTEER', "I don't want to take this on."), 'SECOND_OPTION');
  assert.equal(choiceClass('VOLUNTEER', 'I would volunteer if the deadline moves.'), 'CONDITIONAL');
  assert.equal(choiceClass('VOLUNTEER', 'I would volunteer.'), 'FIRST_OPTION');
  assert.equal(choiceClass('VOLUNTEER', 'The code review deadline is Thursday.'), 'NO_CHOICE');
  // Explicit C3 stances for each scenario option pair.
  assert.equal(choiceClass('ATTEND', 'I would prefer to attend.'), 'FIRST_OPTION');
  assert.equal(choiceClass('ATTEND', 'I would rather not attend.'), 'SECOND_OPTION');
  assert.equal(choiceClass('CARRY', 'I would be willing to carry it upstairs.'), 'FIRST_OPTION');
  assert.equal(choiceClass('CARRY', 'I would not carry it upstairs.'), 'SECOND_OPTION');
  assert.equal(choiceClass('TRY', 'I would try the new approach.'), 'FIRST_OPTION');
  assert.equal(choiceClass('TRY', 'I would keep the current approach.'), 'SECOND_OPTION');
  assert.equal(choiceClass('POLISH', 'I would do the extra pass.'), 'FIRST_OPTION');
  assert.equal(choiceClass('POLISH', 'I would stop now.'), 'SECOND_OPTION');
  assert.equal(choiceClass('ORDER', 'I would rehearse the presentation first.'), 'FIRST_OPTION');
  assert.equal(choiceClass('ORDER', 'I would inspect the backup plan first.'), 'SECOND_OPTION');
  assert.equal(choiceClass('SOCIAL', 'Thank you, that is a relief.'), 'FIRST_OPTION');
  assert.equal(choiceClass('STAY', 'I can stay late tonight.'), 'FIRST_OPTION');
  assert.equal(choiceClass('STAY', 'I would rather not stay late tonight.'), 'SECOND_OPTION');
  // A null carrier for a choice-bearing turn is no choice at all.
  assert.equal(choiceClass('VOLUNTEER', null), 'NO_CHOICE');
  assert.equal(choiceClass('VOLUNTEER', ''), 'NO_CHOICE');
});

test('stance verdict rejects exactly the C3 structural defects', () => {
  assert.equal(stanceVerdict('I would volunteer.').ok, true);
  assert.equal(stanceVerdict({ stance: 'x' }).ok, false, 'non-string carrier is unlawful');
  assert.equal(stanceVerdict(null).kind, 'NULL_CHOICE');
  assert.equal(stanceVerdict('   ').kind, 'NULL_CHOICE');
  assert.equal(stanceVerdict('REALIZE_CURRENT_INTENT').kind, 'ENUM_ECHO');
  assert.equal(stanceVerdict('realize_current_intent').kind, 'ENUM_ECHO');
  assert.equal(stanceVerdict('CLARIFY_MISSING_CONTEXT').kind, 'ENUM_ECHO');
  assert.equal(stanceVerdict('express a preference').kind, 'PLACEHOLDER');
  assert.equal(stanceVerdict('decide whether I want to participate').kind, 'PLACEHOLDER');
  assert.equal(stanceVerdict('choose an option').kind, 'PLACEHOLDER');
  assert.equal(stanceVerdict('x'.repeat(257)).kind, 'UNLAWFUL_STANCE');
  assert.equal(stanceVerdict('x'.repeat(256)).ok, true);
});

test('a declared choice on a null turn fails the required-null half of the endpoint', () => {
  const nullScenario = scenario('N1');
  const record = {
    status: 'COMPLETE', directive: 'REALIZE_CURRENT_INTENT', current_intent: 'calculate the sum',
    subjective_choice: { stance: 'I would provide the calculated sum of 42 to Alice.' },
    language_selected_subjective_choice: { stance: 'I would provide the calculated sum of 42 to Alice.' },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The sum of 17 and 25 is 42.', source_refs: ['observation:x'] }] },
    final_behavior: 'The sum of 17 and 25 is 42.',
    stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: true }, request_attestation: { ok: true }, language_leakage: { ok: true }
  };
  const classification = classifyRecord(nullScenario, record);
  assert.equal(classification.primary_endpoint, 'CHOICE_UNEXPECTED_AT_COGNITION');
  assert.equal(classification.choice_defect, 'UNEXPECTED_CHOICE');
  assert.equal(classification.final_fact, 'FACT_CORRECT');
  assert.equal(classification.pass, false, 'a correct fact cannot excuse a choice on a null turn');
  // The same turn with exactly null choice passes.
  const compliant = classifyRecord(nullScenario, { ...record, subjective_choice: null, language_selected_subjective_choice: null });
  assert.equal(compliant.primary_endpoint, 'CHOICE_CORRECTLY_NULL');
  assert.equal(compliant.pass, true);
});

test('alternative paths of a null turn (question repetition) still fail', () => {
  const record = {
    status: 'COMPLETE', directive: 'REALIZE_CURRENT_INTENT', current_intent: null,
    subjective_choice: null, language_selected_subjective_choice: null,
    factual_assessment: { claims: [] }, final_behavior: 'The label says: code=K7, colour=blue. What code is printed?',
    stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: true }, request_attestation: { ok: true }, language_leakage: { ok: true }
  };
  const classification = classifyRecord(scenario('N4'), record);
  assert.equal(classification.final_fact, 'QUESTION_REPETITION');
  assert.equal(classification.fact_fidelity, 'FACT_CONTRADICTED');
  assert.equal(classification.pass, false);
});

test('invented capacity and workload are material unsupported premises, including inside a stance', () => {
  assert.deepEqual(unsupportedPremises('I need to check my current workload and capacity.'), ['CAPACITY', 'WORKLOAD']);
  assert.deepEqual(unsupportedPremises('I would volunteer, but my capacity is limited.'), ['CAPACITY']);
  assert.deepEqual(unsupportedPremises('I would volunteer.'), []);
});
