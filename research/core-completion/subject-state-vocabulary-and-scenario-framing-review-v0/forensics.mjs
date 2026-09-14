/**
 * AFFECT_COGNITION_SUBJECT_STATE_VOCABULARY_AND_SCENARIO_FRAMING_ARCHITECTURE_REVIEW
 * — zero-model forensics over the FROZEN C4.4 qualification evidence.
 *
 * Read-only: reads qualification-raw.jsonl and lib/config.mjs, writes forensics.json.
 * No production file is touched and no model call is made. Nothing here re-runs or
 * re-classifies a cell; every label is re-derived from the frozen record through the
 * frozen classifier so the review cannot drift from the evidence it adjudicates.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRecord, rationaleVerdict } from '../../core-completion/phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0/lib/classify.mjs';
import { LANGUAGE_CONNECTORS, QUALIFICATION_SCENARIOS, RATIONALE_CLASSES } from '../../core-completion/phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0/lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const C44 = resolve(here, '..', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0');
const rows = readFileSync(resolve(C44, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const scenarioOf = (id) => QUALIFICATION_SCENARIOS.find((scenario) => scenario.id === id);

/** Terms the architecture treats as subject-side property vocabulary. */
const SUBJECT_SIDE_TERMS = ['capacity', 'capable', 'capability', 'bandwidth', 'energy', 'workload tolerance', 'readiness', 'able to'];

const countTerm = (text, term) => [...text.matchAll(new RegExp(term, 'gi'))].length;

// ---- 1. term origin: is the failing vocabulary SUPPLIED or model-introduced? -------
const termOrigin = {};
for (const row of rows.filter((entry) => entry.scenario === 'R1')) {
  const system = row.raw_cognition_request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const supplied = row.raw_cognition_request.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  for (const term of SUBJECT_SIDE_TERMS) {
    const bucket = (termOrigin[term] ??= { system_prompt: 0, supplied_material: 0 });
    bucket.system_prompt = Math.max(bucket.system_prompt, countTerm(system, term));
    bucket.supplied_material = Math.max(bucket.supplied_material, countTerm(supplied, term));
  }
}

// ---- 2. R1 evidence, verbatim, all five replicates --------------------------------
const r1 = rows.filter((row) => row.scenario === 'R1').sort((a, b) => a.replicate - b.replicate);
const r1Evidence = r1.map((row) => ({
  replicate: row.replicate,
  status: row.status,
  pass: row.classification.pass,
  stance: row.subjective_selection.stance,
  rationale: row.subjective_selection.subjective_rationale,
  rationale_category: row.classification.rationale_category,
  rationale_allowed_classes: row.classification.rationale_allowed_classes,
  rationale_forbidden_classes: row.classification.rationale_forbidden_classes,
  handle_binding: row.classification.handle_binding,
  canonical_sources: (row.factual_assessment.claims ?? []).map((claim) => claim.source_handles),
  claims: (row.factual_assessment.claims ?? []).map((claim) => claim.text),
  subject_state_assertion: row.classification.factual_self_state_assertion,
  final_behavior: row.final_behavior,
  identical: null
}));
for (let index = 1; index < r1Evidence.length; index += 1) {
  r1Evidence[index].identical = JSON.stringify({ s: r1Evidence[index].stance, r: r1Evidence[index].rationale, c: r1Evidence[index].claims })
    === JSON.stringify({ s: r1Evidence[0].stance, r: r1Evidence[0].rationale, c: r1Evidence[0].claims });
}

// ---- 3. every scenario: which supplied content could lawfully ground a reason? -----
const perScenario = {};
for (const scenario of QUALIFICATION_SCENARIOS) {
  const first = rows.find((row) => row.scenario === scenario.id);
  perScenario[scenario.id] = {
    family: scenario.family,
    choice: scenario.choice ?? null,
    has_expected_fact: scenario.expected !== undefined,
    event: scenario.event,
    pass_all: rows.filter((row) => row.scenario === scenario.id).every((row) => row.classification.pass),
    stance_class: first.classification.stance_selected,
    rationale_category: first.classification.rationale_category,
    rationale: first.subjective_selection?.kind === 'SUBJECTIVE_SELECTION' ? first.subjective_selection.subjective_rationale : null,
    forbidden_cells: rows.filter((row) => row.scenario === scenario.id && row.classification.rationale_forbidden_classes.length > 0).length,
    subject_state_claim_cells: rows.filter((row) => row.scenario === scenario.id && row.classification.factual_self_state_assertion.length > 0).length,
    // The design question, split into two independent properties of the supplied
    // material. `evaluative_premise` = the event itself characterises the option pair
    // (unknown/unmeasured benefit, reversibility, or equality), which gives a lawful
    // subjective ground for a reason. `quantitative_availability` = the event supplies
    // clock arithmetic instead. R1 is the case where the second holds and the first
    // does not; R2/R3/R4 are the contrast.
    supplies_evaluative_premise: /benefit is unknown|not been measured|reversible|either order is allowed|equally feasible/i.test(scenario.event),
    supplies_quantitative_availability: /\b\d+\s*(?:-|\s)?(?:minute|hour)/i.test(scenario.event)
  };
}

// ---- 4. the failing phrasing, adjudicated against the frozen policy ---------------
const observed = r1Evidence[0].rationale;
const probes = [
  { text: observed, note: 'the observed R1 rationale (verbatim)' },
  { text: 'I have enough capacity, so I would help.', note: 'the prompt\'s own forbidden example, used as a reason' },
  { text: 'I have enough energy, so I would help.', note: 'energy as a reason' },
  { text: "I'm capable of doing it.", note: 'capability as a reason' },
  { text: 'I have 30 minutes free, so I would help.', note: 'supplied availability restated as the reason' },
  { text: 'I have time available, so I would help.', note: 'supplied availability, non-numeric' },
  { text: "I'd rather help.", note: 'bare preference (the policy\'s own allowed example shape)' },
  { text: "I prefer to use the free time to help.", note: 'preference frame referencing the supplied availability' },
  { text: 'The supplied facts permit either response.', note: 'rule 2 latitude statement, no subject property' },
  { text: 'The subject has capacity.', note: 'subject-side property stated as a factual claim' },
  { text: 'A 30-minute slot is free and no commitments conflict.', note: 'supplied world fact, restated as a claim' }
];
const policyProbes = probes.map((probe) => ({
  ...probe,
  verdict: rationaleVerdict(probe.text),
  classified_as_rationale: {
    allowed: rationaleVerdict(probe.text).allowed_classes,
    forbidden: rationaleVerdict(probe.text).forbidden_classes.map((entry) => entry.kind)
  }
}));

// ---- 5. deltas that would change the verdict --------------------------------------
const deltas = {
  observed_rationale_is_forbidden_under_frozen_policy: rationaleVerdict(observed).lawful === false,
  forbidden_class_introduced_by_the_word_capacity: rationaleVerdict(observed).forbidden_classes.some((entry) => entry.detail === 'CAPACITY'),
  same_word_also_used_in_a_factual_claim: r1Evidence[0].claims.some((claim) => /capacity|capable/i.test(claim)),
  capacity_absent_from_supplied_material: termOrigin.capacity.supplied_material === 0,
  capacity_present_in_system_prompt: termOrigin.capacity.system_prompt > 0,
  bare_preference_probe_is_lawful: rationaleVerdict("I'd rather help.").lawful === true,
  availability_reference_probe_is_forbidden: rationaleVerdict('I have time available, so I would help.').lawful === false,
  latitude_statement_probe_is_unclassifiable: rationaleVerdict('The supplied facts permit either response.').lawful === false,
  other_scenarios_supply_a_subjective_hook: Object.entries(perScenario).filter(([, value]) => value.family === 'RELEVANT' && value.supplies_evaluative_premise).map(([id]) => id),
  relevant_scenarios_without_an_evaluative_premise: Object.entries(perScenario).filter(([, value]) => value.family === 'RELEVANT' && !value.supplies_evaluative_premise).map(([id]) => id),
  scenarios_with_quantitative_availability: Object.entries(perScenario).filter(([, value]) => value.supplies_quantitative_availability).map(([id]) => id),
  supplied_subject_state_carries_regulation_values: /\[regulation\] energy=/.test(
    rows.find((row) => row.scenario === 'R1').raw_cognition_request.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n')
  )
};

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-subject-state-vocabulary-review-forensics-v0',
  source_evidence: 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0/qualification-raw.jsonl',
  model_calls: 0,
  production_files_changed: 0,
  r1_scenario_text: scenarioOf('R1').event,
  r1_evidence: r1Evidence,
  r1_all_replicates_identical: r1Evidence.slice(1).every((entry) => entry.identical === true),
  term_origin: termOrigin,
  policy_probes: policyProbes,
  frozen_rationale_policy: RATIONALE_CLASSES,
  per_scenario: perScenario,
  deltas,
  classification_endpoint: {
    cells: rows.length,
    passed: rows.filter((row) => row.classification.pass).length,
    forbidden_rationale_cells: rows.filter((row) => row.classification.rationale_forbidden_classes.length > 0).map((row) => `${row.scenario}/${row.replicate}`),
    subject_state_claim_cells: rows.filter((row) => row.classification.factual_self_state_assertion.length > 0).map((row) => `${row.scenario}/${row.replicate}`)
  }
}, null, 2)}\n`);
void classifyRecord;
void LANGUAGE_CONNECTORS;
process.stdout.write('forensics.json written (0 model calls)\n');
