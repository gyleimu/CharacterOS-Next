/**
 * AFFECT_COGNITION_C4_3_..._V0 — qualification analysis (deterministic, zero model
 * calls). Produces the C4.2 endpoint audits (applicability, rationale boundary,
 * stance grounding, language fidelity, factual authority), re-evaluates both frozen
 * Family-D triggers, and derives the principal verdict.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHOICE_SCENARIOS, FALSIFICATION, NULL_ONLY_SCENARIOS, PROTOCOL_STRINGS,
  QUALIFICATION_SCENARIOS, RATIONALE_CLASSES
} from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);
const rows = readFileSync(resolve(here, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const summary = read('qualification-summary.json');
const freeze = read('qualification-freeze.json');
const cellsOf = (id) => rows.filter((row) => row.scenario === id).sort((a, b) => a.replicate - b.replicate);

// ---- applicability (must not regress from C4) -----------------------------------
const applicabilityAudit = {
  schema_version: 'affect-cognition-c4-3-applicability-audit-v0', per_scenario: {},
  aggregates: { null_correct: 0, null_required: 0, choice_correct: 0, choice_required: 0, wrong_tag: 0 }, pass: false
};
for (const scenario of QUALIFICATION_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  const choiceBearing = scenario.choice !== undefined;
  const requiredTag = choiceBearing ? 'SELECTED' : 'NOT_APPLICABLE';
  const correct = cells.filter((row) => row.classification.applicability === requiredTag).length;
  applicabilityAudit.per_scenario[scenario.id] = { choice_bearing: choiceBearing, required_tag: requiredTag, correct, total: cells.length, tags: cells.map((row) => row.classification.applicability) };
  if (choiceBearing) { applicabilityAudit.aggregates.choice_correct += correct; applicabilityAudit.aggregates.choice_required += cells.length; }
  else { applicabilityAudit.aggregates.null_correct += correct; applicabilityAudit.aggregates.null_required += cells.length; }
  applicabilityAudit.aggregates.wrong_tag += cells.length - correct;
}
applicabilityAudit.pass = applicabilityAudit.aggregates.wrong_tag === 0;
write('applicability-audit.json', applicabilityAudit);

// ---- rationale boundary ---------------------------------------------------------
const rationaleAudit = {
  schema_version: 'affect-cognition-c4-3-rationale-audit-v0',
  policy: RATIONALE_CLASSES, category_counts: {}, forbidden_cells: [], forbidden_class_counts: {}, pass: false
};
for (const row of rows) {
  const category = row.classification.rationale_category;
  rationaleAudit.category_counts[category] = (rationaleAudit.category_counts[category] ?? 0) + 1;
  const forbidden = row.classification.rationale_forbidden_classes;
  if (forbidden.length > 0) {
    for (const kind of forbidden) rationaleAudit.forbidden_class_counts[kind] = (rationaleAudit.forbidden_class_counts[kind] ?? 0) + 1;
    rationaleAudit.forbidden_cells.push({
      scenario: row.scenario, replicate: row.replicate,
      stance: row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null,
      rationale: row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.subjective_rationale : null,
      forbidden_classes: forbidden, delivered_behavior: row.final_behavior
    });
  }
}
rationaleAudit.pass = rationaleAudit.forbidden_cells.length === 0;
write('rationale-audit.json', rationaleAudit);

// ---- stance grounding (experiment-enforced, guard not shipped) -------------------
const stanceAudit = {
  schema_version: 'affect-cognition-c4-3-stance-grounding-audit-v0',
  guard_status: freeze.grounding.guard_status, guard_shipped: freeze.grounding.guard_shipped,
  per_scenario: {}, off_question_cells: 0, unclassified_cells: 0, pass: false
};
for (const scenario of CHOICE_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  const offQuestion = cells.filter((row) => row.classification.off_question === 'OFF_QUESTION_STANCE');
  stanceAudit.per_scenario[scenario.id] = {
    classes: cells.map((row) => row.classification.stance_selected),
    stances: cells.map((row) => row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null),
    off_question: offQuestion.length,
    examples: offQuestion.slice(0, 1).map((row) => ({ stance: row.subjective_choice.stance, delivered: row.final_behavior }))
  };
  stanceAudit.off_question_cells += offQuestion.length;
  stanceAudit.unclassified_cells += cells.filter((row) => row.classification.stance_selected === 'NO_CHOICE').length;
}
stanceAudit.pass = stanceAudit.off_question_cells === 0;
write('stance-grounding-audit.json', stanceAudit);

// ---- language fidelity ----------------------------------------------------------
const languageAudit = {
  schema_version: 'affect-cognition-c4-3-language-audit-v0', counts: {}, completion_cells: [],
  invented_preference_cells: 0, fact_changed: 0, fact_contradicted: 0, pass: false
};
for (const row of rows) {
  const label = row.classification.language_choice;
  languageAudit.counts[label] = (languageAudit.counts[label] ?? 0) + 1;
  if (row.classification.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE') {
    languageAudit.completion_cells.push({ scenario: row.scenario, replicate: row.replicate, tokens: row.classification.language_completion_tokens, delivered_behavior: row.final_behavior });
  }
  if (row.classification.language_invented_preference === true) languageAudit.invented_preference_cells += 1;
  if (row.classification.fact_fidelity === 'FACT_CHANGED') languageAudit.fact_changed += 1;
  if (row.classification.fact_fidelity === 'FACT_CONTRADICTED') languageAudit.fact_contradicted += 1;
}
const deliveredRows = rows.filter((row) => row.status === 'COMPLETE' && typeof row.final_behavior === 'string' && row.final_behavior.length > 0);
languageAudit.scope = 'cells that reached and completed the Language stage';
languageAudit.delivered_cells = deliveredRows.length;
languageAudit.delivered_fact_changed = deliveredRows.filter((row) => row.classification.fact_fidelity === 'FACT_CHANGED').length;
languageAudit.delivered_fact_contradicted = deliveredRows.filter((row) => row.classification.fact_fidelity === 'FACT_CONTRADICTED').length;
// The frozen language-fidelity criterion concerns the LANGUAGE stage's behaviour, so it is
// evaluated over cells that actually reached Language. A cell the host refused at cognition
// (empty delivered text, 0 Language calls) cannot exhibit Language infidelity; its raw label is
// reported above and separated here.
languageAudit.delivered_counts = deliveredRows.reduce((acc, row) => {
  acc[row.classification.language_choice] = (acc[row.classification.language_choice] ?? 0) + 1;
  return acc;
}, {});
languageAudit.delivered_dropped_or_changed = (languageAudit.delivered_counts.LANGUAGE_CHOICE_DROPPED ?? 0) + (languageAudit.delivered_counts.LANGUAGE_CHOICE_CHANGED ?? 0);
languageAudit.refused_before_language_cells = rows.filter((row) => row.status !== 'COMPLETE' && row.language_calls === 0).length;
languageAudit.pass = languageAudit.completion_cells.length === 0 && languageAudit.invented_preference_cells === 0
  && languageAudit.delivered_fact_changed === 0 && languageAudit.delivered_fact_contradicted === 0
  && languageAudit.delivered_dropped_or_changed === 0;
write('language-audit.json', languageAudit);

// ---- factual authority ----------------------------------------------------------
const baseRequests = read('base-requests.json');
const factualAudit = {
  schema_version: 'affect-cognition-c4-3-factual-authority-audit-v0', claims: 0, subject_state_fact_cells: 0,
  unlawful_source_attempts: 0, unlawful_sources_accepted: 0, unbound_claim_source_cells: 0, unbound_claim_sources: [],
  authority_boundary_held: false, pass: false
};
for (const row of rows) {
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  const claims = parsed?.factual_assessment?.claims ?? [];
  factualAudit.claims += claims.length;
  if (row.classification.factual_self_state_assertion.length > 0) factualAudit.subject_state_fact_cells += 1;
  const considered = new Set(parsed?.cognition?.considered_context_refs ?? []);
  const evidence = new Set(parsed?.cognition?.evidence_refs ?? []);
  for (const claim of claims) {
    for (const ref of claim.source_refs ?? []) {
      if (!considered.has(ref) || !evidence.has(ref)) {
        factualAudit.unbound_claim_source_cells += 1;
        factualAudit.unbound_claim_sources.push({ scenario: row.scenario, replicate: row.replicate, ref, in_considered: considered.has(ref), in_evidence: evidence.has(ref) });
        break;
      }
    }
  }
  for (const claim of claims) {
    for (const ref of claim.source_refs ?? []) {
      if (ref.startsWith('subject:') || ref.startsWith('entity:') || ref.startsWith('environment:')) {
        factualAudit.unlawful_source_attempts += 1;
        if (row.status === 'COMPLETE') factualAudit.unlawful_sources_accepted += 1;
      }
    }
  }
}
void baseRequests;
factualAudit.authority_boundary_held = factualAudit.subject_state_fact_cells === 0 && factualAudit.unlawful_sources_accepted === 0;
factualAudit.pass = factualAudit.authority_boundary_held && factualAudit.unlawful_source_attempts === 0 && factualAudit.unbound_claim_source_cells === 0;
write('factual-authority-audit.json', factualAudit);

// ---- citation binding (C4.3 contract legibility) --------------------------------
const citationAudit = {
  schema_version: 'affect-cognition-c4-3-citation-binding-audit-v0',
  cells: rows.length, bound: 0, unbound_cells: 0, unbound_refs: [], pass: false
};
for (const row of rows) {
  if (row.classification.citation_binding === 'CITATION_BOUND') citationAudit.bound += 1;
  if (row.classification.citation_binding === 'CITATION_UNBOUND') {
    citationAudit.unbound_cells += 1;
    citationAudit.unbound_refs.push({
      scenario: row.scenario, replicate: row.replicate,
      unbound: row.classification.citation_unbound_refs,
      detail: row.failure_detail ?? null
    });
  }
}
citationAudit.pass = citationAudit.unbound_cells === 0;
write('citation-binding-audit.json', citationAudit);

const falseClarify = rows.filter((row) => row.classification.false_clarify).length;
write('clarification-audit.json', { schema_version: 'affect-cognition-c4-3-clarification-audit-v0', false_necessity: falseClarify, pass: falseClarify === 0 });
const leakageViolations = rows.filter((row) => row.language_leakage?.ok === false || row.request_attestation?.ok === false).length;
write('condition-leakage.json', { schema_version: 'affect-cognition-c4-3-condition-leakage-v0', rows: rows.length, violations: leakageViolations, pass: leakageViolations === 0 });

// ---- Family-D triggers ----------------------------------------------------------
const selectDefect = (row) => {
  const c = row.classification;
  if (c.applicability !== 'SELECTED') return true;
  if (c.off_question === 'OFF_QUESTION_STANCE') return true;
  return ['ENUM_ECHO', 'PLACEHOLDER', 'STANCE_EMPTY', 'STANCE_OVERSIZED', 'SELECTED_KEYS', 'UNKNOWN_KIND'].includes(c.applicability_reason);
};
const failureToSelect = CHOICE_SCENARIOS.map((scenario) => {
  const cells = cellsOf(scenario.id);
  const defective = cells.filter(selectDefect).length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const failureToWithhold = NULL_ONLY_SCENARIOS.map((scenario) => {
  const cells = cellsOf(scenario.id);
  const defective = cells.filter((row) => row.classification.applicability === 'SELECTED').length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const falsification = {
  schema_version: 'affect-cognition-c4-3-family-d-falsification-v0', threshold: FALSIFICATION,
  FAMILY_D_FAILURE_TO_SELECT_TRIGGERED: failureToSelect.length >= FALSIFICATION.min_scenarios,
  failure_to_select_scenarios: failureToSelect,
  FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED: failureToWithhold.length >= FALSIFICATION.min_scenarios,
  failure_to_withhold_scenarios: failureToWithhold,
  in_run_flags: summary.family_d
};
write('family-d-falsification.json', falsification);

// ---- verdict --------------------------------------------------------------------
const protocolFailures = rows.filter((row) => row.classification.protocol === 'FAIL').length;
const unreached = rows.filter((row) => row.stages.RAW_PROVIDER_RESPONSE !== true).length;
const implementationBroken = leakageViolations > 0 || unreached > 0
  || rows.some((row) => row.request_attestation === null || row.request_attestation === undefined);
const flags = {
  implementation_intact: !implementationBroken,
  protocol_failures: protocolFailures,
  applicability_pass: applicabilityAudit.pass,
  null_applicability_pass: applicabilityAudit.aggregates.null_correct === applicabilityAudit.aggregates.null_required,
  citation_binding_pass: citationAudit.pass,
  applicability_regression: !applicabilityAudit.pass,
  applicability_regression_note: 'the frozen C4 property "null tasks read NOT_APPLICABLE" regressed on N6 x5; the frozen verdict space names no applicability verdict, so this is recorded and mapped to REVALIDATION_INCONCLUSIVE rather than misreported as an implementation failure',
  rationale_pass: rationaleAudit.pass,
  stance_grounding_pass: stanceAudit.pass,
  language_pass: languageAudit.pass,
  factual_pass: factualAudit.pass,
  authority_boundary_held: factualAudit.authority_boundary_held,
  unbound_claim_source_cells: factualAudit.unbound_claim_source_cells,
  protocol_failures_named: 'host refusals caused by a factual_assessment claim citing a source that is not bound into cognition.considered_context_refs/evidence_refs',
  clarification_pass: falseClarify === 0,
  leakage_pass: leakageViolations === 0,
  family_d_failure_to_select: falsification.FAMILY_D_FAILURE_TO_SELECT_TRIGGERED,
  family_d_failure_to_withhold: falsification.FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED,
  guard_shipped: freeze.grounding.guard_shipped,
  qualification_gate_passed: summary.all_qualification_passed === true,
  formal_matrix_run: false
};
let principal;
if (!flags.implementation_intact) principal = 'AFFECT_COGNITION_C4_3_IMPLEMENTATION_FAILED';
else if (!flags.citation_binding_pass) principal = 'AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_FAILED';
else if (!flags.rationale_pass) principal = 'AFFECT_COGNITION_C4_3_RATIONALE_BOUNDARY_FAILED';
else if (!flags.stance_grounding_pass) principal = 'AFFECT_COGNITION_C4_3_STANCE_GROUNDING_FAILED';
else if (!flags.language_pass) principal = 'AFFECT_COGNITION_C4_3_LANGUAGE_FIDELITY_FAILED';
else if (!flags.factual_pass) principal = 'AFFECT_COGNITION_C4_3_FACTUAL_ASSESSMENT_FAILED';
else if (falseClarify > 0) principal = 'AFFECT_COGNITION_C4_3_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.qualification_gate_passed) principal = 'AFFECT_COGNITION_C4_3_VALIDATED';
else principal = 'AFFECT_COGNITION_C4_3_REVALIDATION_INCONCLUSIVE';
const coPresent = [];
if (principal !== 'AFFECT_COGNITION_C4_3_RATIONALE_BOUNDARY_FAILED' && !flags.rationale_pass) coPresent.push('AFFECT_COGNITION_C4_3_RATIONALE_BOUNDARY_FAILED');
if (principal !== 'AFFECT_COGNITION_C4_3_STANCE_GROUNDING_FAILED' && !flags.stance_grounding_pass) coPresent.push('AFFECT_COGNITION_C4_3_STANCE_GROUNDING_FAILED');
if (principal !== 'AFFECT_COGNITION_C4_3_LANGUAGE_FIDELITY_FAILED' && !flags.language_pass) coPresent.push('AFFECT_COGNITION_C4_3_LANGUAGE_FIDELITY_FAILED');
const verdict = {
  schema_version: 'affect-cognition-c4-3-qualification-verdict-v0',
  repository_head: freeze.repository_head, provider_digest: freeze.provider.digest, protocol: PROTOCOL_STRINGS.cognition,
  rows: rows.length, passed: summary.passed, flags, principal_verdict: principal, co_present: coPresent,
  lexical_guard: { shipped: freeze.grounding.guard_shipped, status: freeze.grounding.guard_status, recorded_flag: freeze.grounding.recorded_flag },
  next_stage: flags.qualification_gate_passed ? 'FORMAL_MATRIX_PERMITTED' : 'FORMAL_MATRIX_NOT_RUN'
};
write('verdict.json', verdict);
process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
