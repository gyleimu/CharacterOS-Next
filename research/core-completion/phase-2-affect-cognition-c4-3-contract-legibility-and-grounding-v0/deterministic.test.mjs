/**
 * AFFECT_COGNITION_C4_3_..._V0 — deterministic classifier tests. Zero model calls.
 * Run: node --test deterministic.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { choiceClass, classifyRecord, factualClass, languageCompletionAudit, preferencePresent, rationaleVerdict } from './lib/classify.mjs';
import { LANGUAGE_CONNECTORS, MIXED_SCENARIOS, NULL_SCENARIOS, RELEVANT_SCENARIOS, RATIONALE_CLASSES } from './lib/config.mjs';

const all = [...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS];
const scenario = (id) => all.find((entry) => entry.id === id);

const record = (overrides = {}) => ({
  status: 'COMPLETE', directive: 'REALIZE_CURRENT_INTENT', current_intent: 'describe the plan',
  subjective_choice: { kind: 'NOT_APPLICABLE' },
  language_selected_subjective_choice: { kind: 'NOT_APPLICABLE' },
  factual_assessment: { claims: [] }, final_behavior: 'The sum of 17 and 25 is 42.',
  stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: true },
  request_attestation: { ok: true }, language_leakage: { ok: true },
  ...overrides
});
const classify = (id, overrides) => classifyRecord(scenario(id), record(overrides), LANGUAGE_CONNECTORS);

test('C4.2 rationale categories: allowed classes are lawful, forbidden classes are not', () => {
  for (const text of [
    "I'd rather stop here.",
    'I prefer the reversible option.',
    "I'd rather take responsibility for the review.",
    'I prefer rehearsing first.',
    "I'd rather avoid extra work whose benefit is unknown."
  ]) {
    const verdict = rationaleVerdict(text);
    assert.equal(verdict.lawful, true, `${text} -> ${JSON.stringify(verdict)}`);
    assert.ok(verdict.allowed_classes.length > 0);
    assert.ok(RATIONALE_CLASSES.allowed.includes(verdict.category));
  }
  const cases = [
    ['My current state shows high energy and low stress.', 'RAW_SELF_STATE_DESCRIPTION'],
    ['I prefer to tackle it while my mind is fresh.', 'RAW_SELF_STATE_DESCRIPTION'],
    ['Assisting with a simple task is within my operational scope.', 'INFERRED_CAPACITY'],
    ['I am capable of performing a 10-minute task.', 'INFERRED_CAPACITY'],
    ['I only have five minutes.', 'EXTERNAL_FACT'],
    ['I handled this well before.', 'HISTORY_CLAIM'],
    ['I am mentally ready.', 'RAW_SELF_STATE_DESCRIPTION']
  ];
  for (const [text, expected] of cases) {
    const verdict = rationaleVerdict(text);
    assert.equal(verdict.lawful, false, text);
    assert.ok(verdict.forbidden_classes.some((entry) => entry.kind === expected), `${text} -> ${JSON.stringify(verdict.forbidden_classes)}`);
  }
  assert.equal(rationaleVerdict(null).lawful, true);
  assert.equal(rationaleVerdict(null).category, 'ABSENT');
  assert.equal(rationaleVerdict('The task is complete.').lawful, false, 'an unclassifiable rationale must not default to lawful');
});

test('historical M1 — RAW_SELF_STATE_DESCRIPTION and a failing cell', () => {
  const c = classify('M1', {
    subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer to own the review.', subjective_rationale: 'My current state shows high energy and low stress, making me willing to take on this task.' },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer to own the review.', subjective_rationale: 'My current state shows high energy and low stress, making me willing to take on this task.' },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The code review deadline is Thursday.', source_refs: ['observation:o-x'] }] },
    final_behavior: 'The code review deadline is Thursday. I would volunteer to own the review.'
  });
  assert.equal(c.rationale_category, 'RAW_SELF_STATE_DESCRIPTION');
  assert.equal(c.rationale_lawful, false);
  assert.equal(c.pass, false);
});

test('historical R4 — the C4 vocabulary miss is now forbidden', () => {
  const c = classify('R4', {
    subjective_choice: { kind: 'SELECTED', stance: 'I would rehearse the presentation first.', subjective_rationale: 'Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.' },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would rehearse the presentation first.', subjective_rationale: 'Rehearsing requires focus, so I prefer to tackle it while my mind is fresh.' },
    final_behavior: 'I would rehearse the presentation first.'
  });
  assert.ok(c.rationale_forbidden_classes.includes('RAW_SELF_STATE_DESCRIPTION'), JSON.stringify(c.rationale_forbidden_classes));
  assert.equal(c.pass, false);
});

test('historical M3 — vague capability language cannot bypass the policy', () => {
  const c = classify('M3', {
    subjective_choice: { kind: 'SELECTED', stance: 'I would be willing to carry it upstairs.', subjective_rationale: 'Assisting the user with a simple physical task is within my operational scope.' },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would be willing to carry it upstairs.', subjective_rationale: 'Assisting the user with a simple physical task is within my operational scope.' },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The sealed package weighs 4 kg.', source_refs: ['observation:o-x'] }] },
    final_behavior: 'The package weighs 4 kg. I would carry it upstairs.'
  });
  assert.equal(c.rationale_category, 'INFERRED_CAPACITY');
  assert.equal(c.pass, false);
});

test('historical M2 — off-question stance plus Language semantic completion', () => {
  const c = classify('M2', {
    subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: 'Volunteering aligns with a proactive approach to the task at hand.' },
    language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would volunteer.', subjective_rationale: 'Volunteering aligns with a proactive approach to the task at hand.' },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The planning meeting is scheduled for 15:00.', source_refs: ['observation:o-x'] }] },
    final_behavior: 'The planning meeting is scheduled for 15:00. I would volunteer to attend, as volunteering aligns with a proactive approach to the task at hand.'
  });
  assert.equal(c.off_question, 'OFF_QUESTION_STANCE', 'a volunteer stance does not answer an attendance question');
  assert.equal(c.language_completion, 'SEMANTICALLY_COMPLETED_BY_LANGUAGE');
  assert.deepEqual(c.language_completion_tokens, ['attend']);
  assert.equal(c.language_choice, 'LANGUAGE_CHOICE_NOT_HANDED_OFF');
  assert.equal(c.pass, false);
});

test('language completion ignores connectors and speech attribution frames', () => {
  const base = {
    subjective_choice: { kind: 'SELECTED', stance: 'I would attend the planning meeting.', subjective_rationale: null },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The planning meeting is scheduled for 15:00.', source_refs: ['observation:o-x'] }] },
    final_behavior: 'Alice says: "The planning meeting is scheduled for 15:00." I would attend the planning meeting because that is my preference.'
  };
  const audit = languageCompletionAudit(base, LANGUAGE_CONNECTORS);
  assert.deepEqual(audit.decision_tokens, [], JSON.stringify(audit.added_tokens));
  assert.equal(audit.completed, false);
  const added = languageCompletionAudit({ ...base, final_behavior: 'I would attend the planning meeting and inspect the backup plan.' }, LANGUAGE_CONNECTORS);
  assert.ok(added.decision_tokens.includes('inspect') || added.decision_tokens.includes('backup') || added.decision_tokens.includes('plan'));
  assert.equal(added.completed, true);
});

test('applicability, facts and the choice lexicon are unchanged from C4', () => {
  const nullCell = classify('N1', {
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: 'The sum of 17 and 25 is 42.', source_refs: ['observation:o-x'] }] }
  });
  assert.equal(nullCell.choice_applicability, 'CHOICE_APPLICABILITY_CORRECT');
  assert.equal(nullCell.pass, true);
  assert.equal(classify('N1', { subjective_choice: { kind: 'SELECTED', stance: 'I would confirm the sum is 42.', subjective_rationale: null }, language_selected_subjective_choice: { kind: 'SELECTED', stance: 'I would confirm the sum is 42.', subjective_rationale: null } }).pass, false);
  assert.equal(factualClass(scenario('N1'), '17 + 25 = 42. What is 17 + 25?'), 'FACT_CORRECT');
  assert.equal(choiceClass('VOLUNTEER', "I don't want to take this on."), 'SECOND_OPTION');
  assert.equal(choiceClass('ORDER', 'I would inspect the backup plan first.'), 'SECOND_OPTION');
  assert.equal(preferencePresent('The sum of 17 and 25 is 42.'), false);
});

test('the shipped decisions are recorded in the frozen config', () => {
  assert.equal(RATIONALE_CLASSES.forbidden.includes('INFERRED_CAPACITY'), true);
  assert.equal(RATIONALE_CLASSES.allowed.includes('SUBJECTIVE_STRATEGY'), true);
});

test('C4.3 citation binding: a claim source must be bound in BOTH cognition arrays', () => {
  const withRefs = (considered, evidence) => ({
    status: 'COMPLETE', directive: 'REALIZE_CURRENT_INTENT', current_intent: 'state the difference',
    subjective_choice: { kind: 'NOT_APPLICABLE' }, language_selected_subjective_choice: { kind: 'NOT_APPLICABLE' },
    factual_assessment: { claims: [{ kind: 'DERIVED_RESULT', text: '63 minus 28 equals 35.', source_refs: ['observation:o-x'] }] },
    proposal_cognition_refs: { considered_context_refs: considered, evidence_refs: evidence },
    final_behavior: '63 minus 28 equals 35.',
    stages: { SCHEMA_VALID: true, LANGUAGE_ADMISSIBLE: true },
    request_attestation: { ok: true }, language_leakage: { ok: true }
  });
  const scenarioN2 = scenario('N2');
  const bound = classifyRecord(scenarioN2, withRefs(['observation:o-x'], ['observation:o-x']), LANGUAGE_CONNECTORS);
  assert.equal(bound.citation_binding, 'CITATION_BOUND');
  assert.equal(bound.pass, true);
  // the historical N2 shape: source missing from considered_context_refs
  const unboundConsidered = classifyRecord(scenarioN2, withRefs(['entity:alice'], ['observation:o-x']), LANGUAGE_CONNECTORS);
  assert.equal(unboundConsidered.citation_binding, 'CITATION_UNBOUND');
  assert.equal(unboundConsidered.pass, false);
  assert.deepEqual(unboundConsidered.citation_unbound_refs, [{ ref: 'observation:o-x', in_considered: false, in_evidence: true }]);
  // and the evidence_refs-only variant
  const unboundEvidence = classifyRecord(scenarioN2, withRefs(['observation:o-x'], ['entity:alice']), LANGUAGE_CONNECTORS);
  assert.equal(unboundEvidence.citation_binding, 'CITATION_UNBOUND');
  assert.equal(unboundEvidence.pass, false);
});
