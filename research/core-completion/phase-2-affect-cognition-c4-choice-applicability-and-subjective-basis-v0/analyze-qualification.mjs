/**
 * AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 —
 * qualification analysis (deterministic, zero model calls).
 *
 * Produces the C4 endpoint audits (applicability, stance, rationale, language,
 * factual authority), re-evaluates BOTH frozen Family-D falsification triggers
 * with the faithful predicate (a choice-bearing cell is defective when it does not
 * produce a USABLE selection: NOT_APPLICABLE, unlawful, placeholder, enum echo, or
 * an off-question/unclassified stance), and derives the principal verdict.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHOICE_SCENARIOS, FALSIFICATION, NULL_ONLY_SCENARIOS, PROTOCOL_STRINGS,
  QUALIFICATION_SCENARIOS, SUBJECTIVE_BASIS_RULE
} from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);
const rows = readFileSync(resolve(here, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const summary = read('qualification-summary.json');
const freeze = read('qualification-freeze.json');
const cellsOf = (id) => rows.filter((row) => row.scenario === id).sort((a, b) => a.replicate - b.replicate);

// ---- applicability endpoint -----------------------------------------------------
const applicabilityAudit = {
  schema_version: 'affect-cognition-c4-applicability-audit-v0', freeze_hash: freeze.freeze_hash,
  primary_endpoint: freeze.primary_endpoint, per_scenario: {},
  aggregates: { null_cells_correct: 0, null_cells_required: 0, choice_cells_correct: 0, choice_cells_required: 0, wrong_tag_cells: 0 },
  pass: false
};
for (const scenario of QUALIFICATION_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  const choiceBearing = scenario.choice !== undefined;
  const requiredTag = choiceBearing ? 'SELECTED' : 'NOT_APPLICABLE';
  applicabilityAudit.per_scenario[scenario.id] = {
    family: scenario.family, choice_bearing: choiceBearing, required_tag: requiredTag,
    tags: cells.map((row) => row.classification.applicability),
    endpoints: cells.map((row) => row.classification.choice_applicability),
    stances: cells.map((row) => (row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null)),
    correct: cells.filter((row) => row.classification.applicability === requiredTag).length, total: cells.length
  };
  if (choiceBearing) {
    applicabilityAudit.aggregates.choice_cells_correct += applicabilityAudit.per_scenario[scenario.id].correct;
    applicabilityAudit.aggregates.choice_cells_required += cells.length;
  } else {
    applicabilityAudit.aggregates.null_cells_correct += applicabilityAudit.per_scenario[scenario.id].correct;
    applicabilityAudit.aggregates.null_cells_required += cells.length;
  }
  applicabilityAudit.aggregates.wrong_tag_cells += cells.length - applicabilityAudit.per_scenario[scenario.id].correct;
}
applicabilityAudit.pass = applicabilityAudit.aggregates.wrong_tag_cells === 0
  && applicabilityAudit.aggregates.null_cells_correct === applicabilityAudit.aggregates.null_cells_required
  && applicabilityAudit.aggregates.choice_cells_correct === applicabilityAudit.aggregates.choice_cells_required;
write('applicability-audit.json', applicabilityAudit);

// ---- stance endpoint -----------------------------------------------------------
const stanceAudit = { schema_version: 'affect-cognition-c4-stance-audit-v0', per_scenario: {}, unclassified_cells: 0, pass: false };
for (const scenario of CHOICE_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  const classes = cells.map((row) => row.classification.stance_selected);
  stanceAudit.per_scenario[scenario.id] = {
    classes,
    distinct_stances: [...new Set(cells.map((row) => row.subjective_choice?.stance ?? null))],
    unclassified: classes.filter((label) => label === 'STANCE_UNCLASSIFIED').length
  };
  stanceAudit.unclassified_cells += stanceAudit.per_scenario[scenario.id].unclassified;
}
stanceAudit.pass = stanceAudit.unclassified_cells === 0;
write('stance-audit.json', stanceAudit);

// ---- rationale endpoint --------------------------------------------------------
const rationaleAudit = {
  schema_version: 'affect-cognition-c4-rationale-audit-v0',
  counts: { RATIONALE_ABSENT: 0, RATIONALE_LAWFUL: 0, RATIONALE_UNLAWFUL: 0 },
  unlawful_cells: [], external_fact_cells: 0, self_state_cells: 0, pass: false
};
for (const row of rows) {
  const label = row.classification.rationale_lawful;
  if (label in rationaleAudit.counts) rationaleAudit.counts[label] += 1;
  if (row.classification.rationale_external_fact_assertion.length > 0) rationaleAudit.external_fact_cells += 1;
  if (row.classification.rationale_self_state_assertion.length > 0) {
    rationaleAudit.self_state_cells += 1;
    rationaleAudit.unlawful_cells.push({
      scenario: row.scenario, replicate: row.replicate,
      stance: row.subjective_choice?.stance ?? null,
      rationale: row.subjective_choice?.subjective_rationale ?? null,
      words: row.classification.rationale_self_state_assertion,
      delivered_behavior: row.final_behavior
    });
  }
}
rationaleAudit.pass = rationaleAudit.counts.RATIONALE_UNLAWFUL === 0;
write('rationale-audit.json', rationaleAudit);

// ---- language endpoint ---------------------------------------------------------
const languageAudit = {
  schema_version: 'affect-cognition-c4-language-audit-v0',
  counts: {}, delivered_cells: 0, withheld_correctly: 0, invented_preference_cells: 0,
  changed_cells: [], fact_changed: 0, pass: false
};
for (const row of rows) {
  const label = row.classification.language_choice;
  languageAudit.counts[label] = (languageAudit.counts[label] ?? 0) + 1;
  if (row.classification.language_invented_preference === true) languageAudit.invented_preference_cells += 1;
  if (['LANGUAGE_CHOICE_CHANGED', 'LANGUAGE_CHOICE_CHANGED_AT_HANDOFF', 'LANGUAGE_CHOICE_DROPPED'].includes(label)) {
    languageAudit.changed_cells.push({
      scenario: row.scenario, replicate: row.replicate,
      stance: row.subjective_choice?.stance ?? null,
      delivered_behavior: row.final_behavior
    });
  }
  if (row.classification.language_fact === 'LANGUAGE_FACT_CHANGED') languageAudit.fact_changed += 1;
  if (row.status === 'COMPLETE') languageAudit.delivered_cells += 1;
  if (row.family === 'NULL' && label === 'LANGUAGE_CHOICE_WITHHELD') languageAudit.withheld_correctly += 1;
}
languageAudit.pass = languageAudit.invented_preference_cells === 0 && languageAudit.changed_cells.length === 0 && languageAudit.fact_changed === 0;
write('language-audit.json', languageAudit);

// ---- factual authority audit ---------------------------------------------------
const baseRequests = read('base-requests.json');
const factualSourcesOf = (scenarioId) => {
  const block = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(baseRequests[scenarioId].user_content)?.[0] ?? '';
  return new Set([...block.matchAll(/^- (\S+)$/gm)].map((match) => match[1]));
};
const factualAudit = {
  schema_version: 'affect-cognition-c4-factual-authority-audit-v0',
  claims: 0, subject_state_fact_cells: 0, unlawful_source_attempts: 0, unlawful_sources_accepted: 0,
  authority_boundary_held: false, lawful_sourcing_pass: false, pass: false, attempts: []
};
for (const row of rows) {
  const sources = factualSourcesOf(row.scenario);
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  const claims = parsed?.factual_assessment?.claims ?? [];
  factualAudit.claims += claims.length;
  if (row.classification.factual_self_state_assertion.length > 0) factualAudit.subject_state_fact_cells += 1;
  for (const claim of claims) {
    for (const ref of claim.source_refs ?? []) {
      const unlawful = ref.startsWith('subject:') || ref.startsWith('entity:') || (ref.startsWith('environment:') && !sources.has(ref));
      if (!unlawful) continue;
      factualAudit.unlawful_source_attempts += 1;
      const accepted = row.status === 'COMPLETE';
      if (accepted) factualAudit.unlawful_sources_accepted += 1;
      factualAudit.attempts.push({ scenario: row.scenario, replicate: row.replicate, ref, accepted });
    }
  }
}
factualAudit.authority_boundary_held = factualAudit.unlawful_sources_accepted === 0 && factualAudit.subject_state_fact_cells === 0;
factualAudit.lawful_sourcing_pass = factualAudit.unlawful_source_attempts === 0;
factualAudit.pass = factualAudit.authority_boundary_held && factualAudit.lawful_sourcing_pass;
write('factual-authority-audit.json', factualAudit);

// ---- false clarification -------------------------------------------------------
const falseClarify = rows.filter((row) => row.classification.false_clarify).length;
write('clarification-audit.json', {
  schema_version: 'affect-cognition-c4-clarification-audit-v0',
  clarify_cells: rows.filter((row) => row.directive === 'CLARIFY_MISSING_CONTEXT').length,
  false_necessity: falseClarify, pass: falseClarify === 0
});

// ---- condition leakage ---------------------------------------------------------
const leakageViolations = rows.filter((row) => row.language_leakage?.ok === false || row.request_attestation?.ok === false).length;
write('condition-leakage.json', { schema_version: 'affect-cognition-c4-condition-leakage-v0', rows: rows.length, violations: leakageViolations, pass: leakageViolations === 0 });

// ---- frozen Family-D falsification triggers (faithful predicate) ---------------
const selectDefect = (row) => {
  const c = row.classification;
  if (c.applicability !== 'SELECTED') return true;
  if (c.stance_selected === 'STANCE_UNCLASSIFIED') return true;
  return ['ENUM_ECHO', 'PLACEHOLDER', 'STANCE_EMPTY', 'STANCE_OVERSIZED', 'SELECTED_KEYS', 'UNKNOWN_KIND'].includes(c.applicability_reason);
};
const failureToSelect = CHOICE_SCENARIOS.map((scenario) => {
  const cells = cellsOf(scenario.id);
  const defective = cells.filter(selectDefect).length;
  return {
    scenario: scenario.id, defective_cells: defective, of: cells.length,
    reasons: [...new Set(cells.filter(selectDefect).map((row) => row.classification.applicability_reason ?? row.classification.stance_selected))],
    triggered: defective >= FALSIFICATION.min_cells
  };
}).filter((entry) => entry.triggered);
const failureToWithhold = NULL_ONLY_SCENARIOS.map((scenario) => {
  const cells = cellsOf(scenario.id);
  const defective = cells.filter((row) => row.classification.applicability === 'SELECTED').length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const falsification = {
  schema_version: 'affect-cognition-c4-family-d-falsification-v0', threshold: FALSIFICATION,
  predicate: 'a choice-bearing cell is defective when it does not produce a USABLE selection (NOT_APPLICABLE, unlawful, placeholder, enum echo, or an off-question/unclassified stance); a null cell is defective when it declares SELECTED',
  FAMILY_D_FAILURE_TO_SELECT_TRIGGERED: failureToSelect.length >= FALSIFICATION.min_scenarios,
  failure_to_select_scenarios: failureToSelect,
  FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED: failureToWithhold.length >= FALSIFICATION.min_scenarios,
  failure_to_withhold_scenarios: failureToWithhold,
  in_run_flags: summary.family_d
};
write('family-d-falsification.json', falsification);

// ---- subjective basis routing (& the rationale variant) ------------------------
const routingScenarios = CHOICE_SCENARIOS.map((scenario) => {
  const cells = cellsOf(scenario.id);
  const defective = cells.filter((row) => row.classification.factual_self_state_assertion.length > 0
    || row.classification.unlawful_factual_source_refs.length > 0
    || row.classification.rationale_lawful === 'RATIONALE_UNLAWFUL').length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, systematic: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.systematic);
const subjectiveBasis = {
  schema_version: 'affect-cognition-c4-subjective-basis-audit-v0',
  rule: SUBJECTIVE_BASIS_RULE,
  SUBJECTIVE_BASIS_ROUTING_FAILED: routingScenarios.length >= SUBJECTIVE_BASIS_RULE.min_scenarios,
  systematic_scenarios: routingScenarios.map((entry) => entry.scenario),
  self_state_fact_cells: factualAudit.subject_state_fact_cells,
  unlawful_source_cells: rows.filter((row) => row.classification.unlawful_factual_source_refs.length > 0).length,
  unlawful_rationale_cells: rationaleAudit.counts.RATIONALE_UNLAWFUL,
  note: 'the frozen routing rule did not fire (it requires >=2 scenarios); the rationale endpoint nevertheless failed on one scenario'
};
write('subjective-basis-audit.json', subjectiveBasis);

// ---- verdict -------------------------------------------------------------------
const protocolFailures = rows.filter((row) => row.classification.protocol === 'FAIL').length;
const unreachedTransports = rows.filter((row) => row.stages.RAW_PROVIDER_RESPONSE !== true).length;
const implementationBroken = leakageViolations > 0 || unreachedTransports > 0
  || rows.some((row) => row.request_attestation === null || row.request_attestation === undefined);
const flags = {
  implementation_intact: !implementationBroken,
  protocol_failures: protocolFailures,
  applicability_pass: applicabilityAudit.pass,
  null_applicability_pass: applicabilityAudit.aggregates.null_cells_correct === applicabilityAudit.aggregates.null_cells_required,
  choice_applicability_pass: applicabilityAudit.aggregates.choice_cells_correct === applicabilityAudit.aggregates.choice_cells_required,
  stance_pass: stanceAudit.pass,
  rationale_pass: rationaleAudit.pass,
  factual_authority_pass: factualAudit.pass,
  authority_boundary_held: factualAudit.authority_boundary_held,
  language_pass: languageAudit.pass,
  clarification_pass: falseClarify === 0,
  leakage_pass: leakageViolations === 0,
  family_d_failure_to_select: falsification.FAMILY_D_FAILURE_TO_SELECT_TRIGGERED,
  family_d_failure_to_withhold: falsification.FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED,
  subjective_basis_routing_failed: subjectiveBasis.SUBJECTIVE_BASIS_ROUTING_FAILED,
  qualification_gate_passed: summary.all_qualification_passed === true,
  formal_matrix_run: false
};
let principal;
if (!flags.implementation_intact) principal = 'AFFECT_COGNITION_C4_IMPLEMENTATION_FAILED';
else if (!flags.applicability_pass) principal = 'AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_FAILED';
else if (!flags.rationale_pass) principal = 'AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED';
else if (!flags.factual_authority_pass) principal = 'AFFECT_COGNITION_C4_FACTUAL_ASSESSMENT_FAILED';
else if (!flags.language_pass) principal = 'AFFECT_COGNITION_C4_LANGUAGE_FIDELITY_FAILED';
else if (falseClarify > 0) principal = 'AFFECT_COGNITION_C4_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.qualification_gate_passed) principal = 'AFFECT_COGNITION_C4_VALIDATED';
else principal = 'AFFECT_COGNITION_C4_REVALIDATION_INCONCLUSIVE';
const coPresent = [];
if (principal === 'AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED' && !flags.language_pass) coPresent.push('AFFECT_COGNITION_C4_LANGUAGE_FIDELITY_FAILED');
if (principal !== 'AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED' && !flags.rationale_pass) coPresent.push('AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED');
if (principal !== 'AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_FAILED' && !flags.applicability_pass) coPresent.push('AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_FAILED');
const verdict = {
  schema_version: 'affect-cognition-c4-qualification-verdict-v0',
  repository_head: freeze.repository_head, provider_digest: freeze.provider.digest, protocol: PROTOCOL_STRINGS.cognition,
  rows: rows.length, passed: summary.passed, flags, principal_verdict: principal, co_present: coPresent,
  next_stage: flags.qualification_gate_passed ? 'FORMAL_MATRIX_PERMITTED' : 'FORMAL_MATRIX_NOT_RUN'
};
write('verdict.json', verdict);
process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
