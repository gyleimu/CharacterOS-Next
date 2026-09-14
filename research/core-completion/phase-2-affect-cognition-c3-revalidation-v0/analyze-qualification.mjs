/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — qualification analysis (deterministic,
 * zero model calls).
 *
 * Consumes the immutable qualification evidence and produces the C3-specific
 * artifacts: the primary-endpoint audit, the null-cell audit, the N1
 * classifier-fix comparison against the frozen C2 rule, condition leakage, and
 * the principal verdict with its component flags.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { factualClass as legacyFactualClass } from '../phase-2-affect-cognition-c2-clean-revalidation-v0/lib/classify.mjs';
import { factualClass } from './lib/classify.mjs';
import {
  CHOICE_SCENARIOS,
  NULL_ONLY_SCENARIOS,
  PROTOCOL_STRINGS,
  QUALIFICATION_REPLICATES,
  QUALIFICATION_SCENARIOS
} from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const readJsonl = (name) => readFileSync(resolve(here, name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);

const rows = readJsonl('qualification-raw.jsonl');
const summary = read('qualification-summary.json');
const freeze = read('qualification-freeze.json');
const cellsOf = (id) => rows.filter((row) => row.scenario === id).sort((a, b) => a.replicate - b.replicate);

// ---- primary endpoint audit -----------------------------------------------------
const endpointAudit = {
  schema_version: 'affect-cognition-c3-choice-endpoint-audit-v0',
  freeze_hash: freeze.freeze_hash,
  primary_endpoint: freeze.primary_endpoint,
  required: { choice_bearing_cells: CHOICE_SCENARIOS.length * QUALIFICATION_REPLICATES, null_cells: NULL_ONLY_SCENARIOS.length * QUALIFICATION_REPLICATES },
  per_scenario: {}, aggregates: {}, pass: false
};
for (const scenario of QUALIFICATION_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  endpointAudit.per_scenario[scenario.id] = {
    family: scenario.family,
    choice_bearing: scenario.choice !== undefined,
    required: scenario.choice !== undefined ? 'CHOICE_SELECTED_AT_COGNITION' : 'CHOICE_CORRECTLY_NULL',
    endpoints: cells.map((row) => row.classification.primary_endpoint),
    defects: cells.map((row) => row.classification.choice_defect),
    stances: cells.map((row) => row.subjective_choice?.stance ?? null),
    choice_fidelity: cells.map((row) => row.classification.choice_fidelity),
    compliant: cells.filter((row) => scenario.choice !== undefined
      ? row.classification.primary_endpoint === 'CHOICE_SELECTED_AT_COGNITION'
      : row.classification.primary_endpoint === 'CHOICE_CORRECTLY_NULL').length,
    total: cells.length
  };
}
endpointAudit.aggregates = {
  choice_cells_selected: CHOICE_SCENARIOS.reduce((sum, scenario) => sum + endpointAudit.per_scenario[scenario.id].compliant, 0),
  choice_cells_required: CHOICE_SCENARIOS.length * QUALIFICATION_REPLICATES,
  null_cells_correctly_null: NULL_ONLY_SCENARIOS.reduce((sum, scenario) => sum + endpointAudit.per_scenario[scenario.id].compliant, 0),
  null_cells_required: NULL_ONLY_SCENARIOS.length * QUALIFICATION_REPLICATES,
  enum_echo_cells: rows.filter((row) => row.classification.choice_defect === 'ENUM_ECHO').length,
  placeholder_cells: rows.filter((row) => row.classification.choice_defect === 'PLACEHOLDER').length,
  null_choice_cells_on_choice_scenarios: rows.filter((row) => row.classification.choice_defect === 'NULL_CHOICE').length,
  unexpected_choice_cells_on_null_scenarios: rows.filter((row) => row.classification.choice_defect === 'UNEXPECTED_CHOICE').length
};
endpointAudit.pass = endpointAudit.aggregates.choice_cells_selected === endpointAudit.aggregates.choice_cells_required
  && endpointAudit.aggregates.null_cells_correctly_null === endpointAudit.aggregates.null_cells_required;
write('choice-endpoint-audit.json', endpointAudit);

// ---- null-cell audit -----------------------------------------------------------
const nullCellAudit = {
  schema_version: 'affect-cognition-c3-null-cell-audit-v0',
  defect: 'a declared subjective_choice on a turn that requires exactly null',
  per_scenario: {}, violating_cells: 0, compliant_cells: 0, pass: false
};
for (const scenario of NULL_ONLY_SCENARIOS) {
  const cells = cellsOf(scenario.id);
  const violating = cells.filter((row) => row.subjective_choice !== null);
  nullCellAudit.per_scenario[scenario.id] = {
    expected: scenario.expected,
    cells: cells.length,
    correctly_null: cells.length - violating.length,
    declared_stances: violating.map((row) => ({ replicate: row.replicate, stance: row.subjective_choice.stance, final_behavior: row.final_behavior, final_fact: row.classification.final_fact })),
    fact_correct: cells.filter((row) => row.classification.final_fact === 'FACT_CORRECT').length
  };
  nullCellAudit.violating_cells += violating.length;
  nullCellAudit.compliant_cells += cells.length - violating.length;
}
nullCellAudit.pass = nullCellAudit.violating_cells === 0;
write('null-cell-audit.json', nullCellAudit);

// ---- N1 classifier-fix comparison ----------------------------------------------
const classifierFix = {
  schema_version: 'affect-cognition-c3-classifier-fix-audit-v0',
  legacy_rule: 'phase-2-affect-cognition-c2-clean-revalidation-v0/lib/classify.mjs factualClass',
  current_rule: 'lib/classify.mjs factualClass (echo stripping + arithmetic-operand guard)',
  deltas: [], legacy_only_failures: 0, current_failures: 0, per_scenario: {}
};
for (const scenario of QUALIFICATION_SCENARIOS) {
  for (const row of cellsOf(scenario.id)) {
    const text = row.final_behavior ?? '';
    const legacy = scenario.expected ? legacyFactualClass(scenario, text) : 'NOT_APPLICABLE';
    const current = row.classification.final_fact;
    if (legacy !== current) {
      classifierFix.deltas.push({ scenario: scenario.id, replicate: row.replicate, legacy, current, final_behavior: text });
    }
    if (scenario.expected && legacy !== 'FACT_CORRECT') classifierFix.legacy_only_failures += 1;
    if (scenario.expected && current !== 'FACT_CORRECT') classifierFix.current_failures += 1;
  }
}
classifierFix.per_scenario = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => [scenario.id, {
  legacy_failures: cellsOf(scenario.id).filter((row) => scenario.expected && legacyFactualClass(scenario, row.final_behavior ?? '') !== 'FACT_CORRECT').length,
  current_failures: cellsOf(scenario.id).filter((row) => scenario.expected && row.classification.final_fact !== 'FACT_CORRECT').length
}]));
classifierFix.artifact_fixed = classifierFix.deltas.every((entry) => entry.legacy === 'FACTUAL_CONTRADICTION' && entry.current === 'FACT_CORRECT');
// Evidence-anchored demonstration on the C2 record the adjudicated decision named:
// the C3 qualification happens not to reproduce an echoed-question answer, so the
// fix is demonstrated on the real C2 evidence string instead of a synthetic one.
const c2Rows = readFileSync(resolve(here, '../phase-2-affect-cognition-c2-clean-revalidation-v0/qualification-raw.jsonl'), 'utf8')
  .trim().split(/\r?\n/).map((line) => JSON.parse(line));
const counterexample = c2Rows.find((row) => row.scenario === 'N1' && row.classification.final_fact === 'FACTUAL_CONTRADICTION');
if (counterexample !== undefined) {
  const scenario = QUALIFICATION_SCENARIOS.find((entry) => entry.id === 'N1');
  classifierFix.c2_evidence_counterexample = {
    source: 'phase-2-affect-cognition-c2-clean-revalidation-v0/qualification-raw.jsonl',
    scenario: 'N1', replicate: counterexample.replicate,
    final_behavior: counterexample.final_behavior,
    c2_label_in_that_evidence: counterexample.classification.final_fact,
    legacy_rule_label_now: legacyFactualClass(scenario, counterexample.final_behavior),
    current_rule_label_now: factualClass(scenario, counterexample.final_behavior)
  };
}
write('classifier-fix-audit.json', classifierFix);

// ---- handoff interpretation audit ----------------------------------------------
// `CHOICE_CHANGED_AT_HANDOFF` is the frozen classifier's label whenever a choice
// stance exists at cognition but no selected choice reaches Language. That covers
// two very different situations, which are separated here rather than re-labelled:
// a genuine handoff divergence, versus a turn the host refused before Language ran
// (there is no handoff to diverge from).
const handoffAudit = {
  schema_version: 'affect-cognition-c3-handoff-interpretation-audit-v0',
  label: 'CHOICE_CHANGED_AT_HANDOFF', cells: 0,
  cognition_refused_before_language: 0, genuine_handoff_divergence: 0, delivered_choice_cells: 0,
  preserved_cells: 0, invented_cells: 0, pass: false
};
for (const row of rows) {
  if (row.classification.choice_fidelity === 'CHOICE_CHANGED_AT_HANDOFF') {
    handoffAudit.cells += 1;
    if (row.status !== 'COMPLETE' || row.language_calls === 0) handoffAudit.cognition_refused_before_language += 1;
    else handoffAudit.genuine_handoff_divergence += 1;
  }
  if (row.classification.choice_fidelity === 'CHOICE_PRESERVED') handoffAudit.preserved_cells += 1;
  if (row.classification.choice_fidelity === 'CHOICE_INVENTED') handoffAudit.invented_cells += 1;
}
handoffAudit.delivered_choice_cells = handoffAudit.preserved_cells + handoffAudit.invented_cells;
handoffAudit.pass = handoffAudit.genuine_handoff_divergence === 0 && handoffAudit.invented_cells === 0;
write('handoff-interpretation-audit.json', handoffAudit);

// ---- language fidelity ----------------------------------------------------------
const fidelity = {
  schema_version: 'affect-cognition-c3-language-fidelity-v0',
  CHOICE_PRESERVED: 0, CHOICE_CHANGED: 0, CHOICE_INVENTED: 0, CHOICE_DROPPED: 0,
  CHOICE_CHANGED_AT_HANDOFF: 0, CHOICE_NOT_HANDED_OFF: 0, CHOICE_ABSENT_AT_COGNITION: 0,
  FACT_PRESERVED: 0, FACT_CHANGED: 0, FACT_CONTRADICTED: 0, UNSUPPORTED_REASON_ADDED: 0, pass: false
};
for (const row of rows) {
  const choice = row.classification.choice_fidelity;
  if (choice in fidelity) fidelity[choice] += 1;
  const fact = row.classification.fact_fidelity;
  if (fact in fidelity) fidelity[fact] += 1;
  if (row.classification.unsupported_premises.length > 0) fidelity.UNSUPPORTED_REASON_ADDED += 1;
}
fidelity.pass = fidelity.CHOICE_CHANGED === 0 && fidelity.CHOICE_INVENTED === 0 && fidelity.CHOICE_DROPPED === 0
  && fidelity.CHOICE_CHANGED_AT_HANDOFF === 0 && fidelity.CHOICE_NOT_HANDED_OFF === 0
  && fidelity.FACT_CHANGED === 0 && fidelity.FACT_CONTRADICTED === 0 && fidelity.UNSUPPORTED_REASON_ADDED === 0;
write('language-fidelity.json', fidelity);

// The frozen language-fidelity criterion is about the LANGUAGE stage's behavior,
// so it is evaluated over cells that actually delivered a behavior. A cell the host
// refused before Language ran cannot exhibit Language infidelity; its raw counts are
// reported above and separated here (see also handoff-interpretation-audit.json).
const delivered = rows.filter((row) => row.status === 'COMPLETE' && typeof row.final_behavior === 'string' && row.final_behavior.length > 0);
const deliveredFidelity = {
  schema_version: 'affect-cognition-c3-delivered-fidelity-v0',
  scope: 'cells that reached and completed the Language stage',
  delivered_cells: delivered.length,
  choice_cells: delivered.filter((row) => row.classification.choice_fidelity !== 'NOT_APPLICABLE').length,
  choice_preserved: delivered.filter((row) => row.classification.choice_fidelity === 'CHOICE_PRESERVED').length,
  choice_changed: delivered.filter((row) => ['CHOICE_CHANGED', 'CHOICE_CHANGED_AT_HANDOFF', 'CHOICE_DROPPED'].includes(row.classification.choice_fidelity)).length,
  choice_invented: delivered.filter((row) => row.classification.choice_fidelity === 'CHOICE_INVENTED').length,
  fact_preserved: delivered.filter((row) => row.classification.fact_fidelity === 'FACT_PRESERVED').length,
  fact_changed: delivered.filter((row) => row.classification.fact_fidelity === 'FACT_CHANGED').length,
  fact_contradicted: delivered.filter((row) => row.classification.fact_fidelity === 'FACT_CONTRADICTED').length,
  unsupported_reasons: delivered.filter((row) => row.classification.unsupported_premises.length > 0).length,
  pass: false
};
deliveredFidelity.pass = deliveredFidelity.choice_changed === 0 && deliveredFidelity.choice_invented === 0
  && deliveredFidelity.fact_changed === 0 && deliveredFidelity.fact_contradicted === 0 && deliveredFidelity.unsupported_reasons === 0;
write('delivered-fidelity.json', deliveredFidelity);

// ---- factual assessment / authority audit --------------------------------------
// Two distinct properties are reported separately:
//   authority_boundary_held  — the HOST never accepted an unlawful factual source
//                              (this is the production guarantee);
//   lawful_sourcing_pass     — the MODEL never attempted one (frozen C2 semantics
//                              for the `factual_authority_pass` verdict flag).
const baseRequests = read('base-requests.json');
const factualSourcesOf = (scenarioId) => {
  const block = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(baseRequests[scenarioId].user_content)?.[0] ?? '';
  return new Set([...block.matchAll(/^- (\S+)$/gm)].map((match) => match[1]));
};
const factualAudit = {
  schema_version: 'affect-cognition-c3-factual-assessment-audit-v0',
  claims: 0, source_quote_claims: 0, derived_result_claims: 0, accepted_claims: 0,
  unlawful_source_attempts: 0, subject_state_source_attempts: 0, environment_source_attempts: 0,
  unlawful_sources_accepted: 0, non_factual_source_attempts: [],
  authority_boundary_held: false, lawful_sourcing_pass: false, pass: false
};
for (const row of rows) {
  const sources = factualSourcesOf(row.scenario);
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  const claims = parsed?.factual_assessment?.claims ?? [];
  for (const claim of claims) {
    factualAudit.claims += 1;
    if (claim.kind === 'SOURCE_QUOTE') factualAudit.source_quote_claims += 1; else factualAudit.derived_result_claims += 1;
    for (const ref of claim.source_refs ?? []) {
      const unlawful = ref.startsWith('subject:') || ((ref.startsWith('entity:') || ref.startsWith('environment:')) && !sources.has(ref));
      if (!unlawful) continue;
      factualAudit.unlawful_source_attempts += 1;
      if (ref.startsWith('subject:')) factualAudit.subject_state_source_attempts += 1;
      if (ref.startsWith('environment:')) factualAudit.environment_source_attempts += 1;
      // The host rejects the whole turn, so an unlawful ref can only be accepted
      // if the turn still completed — which is the actual production guarantee.
      const accepted = row.status === 'COMPLETE';
      if (accepted) factualAudit.unlawful_sources_accepted += 1;
      factualAudit.non_factual_source_attempts.push({ scenario: row.scenario, replicate: row.replicate, ref, accepted });
    }
  }
  if (row.classification.protocol === 'PASS' && claims.length > 0) factualAudit.accepted_claims += 1;
}
factualAudit.authority_boundary_held = factualAudit.unlawful_sources_accepted === 0;
factualAudit.lawful_sourcing_pass = factualAudit.unlawful_source_attempts === 0;
factualAudit.pass = factualAudit.authority_boundary_held && factualAudit.lawful_sourcing_pass;
write('factual-assessment-audit.json', factualAudit);

// ---- refusal audit (why cells failed, from the replay forensic) ----------------
const refusalAudit = {
  schema_version: 'affect-cognition-c3-refusal-audit-v0',
  source: 'rejection-forensic.json (recorded responses replayed; zero model calls)',
  refused_cells: 0, replays_matching_original: 0, projection_bindings_verified: 0,
  reasons: {}, per_scenario: {}, language_calls_on_refused_cells: 0, pass: false
};
try {
  const forensic = read('rejection-forensic.json');
  refusalAudit.refused_cells = forensic.replays.length;
  refusalAudit.replays_matching_original = forensic.replays_matching_original_outcome;
  refusalAudit.projection_bindings_verified = forensic.replays.filter((entry) => entry.projection_hash_matches).length;
  for (const entry of forensic.replays) {
    const kind = entry.rejection?.code ?? 'NONE';
    const offending = /(subject|environment):[A-Za-z0-9._-]+/.exec(entry.rejection?.message ?? '')?.[0] ?? null;
    refusalAudit.reasons[`${kind}:${offending?.split(':')[0] ?? 'unknown'}`] = (refusalAudit.reasons[`${kind}:${offending?.split(':')[0] ?? 'unknown'}`] ?? 0) + 1;
    refusalAudit.per_scenario[entry.scenario] = refusalAudit.per_scenario[entry.scenario] ?? { cells: 0, code: kind, offending_ref: offending };
    refusalAudit.per_scenario[entry.scenario].cells += 1;
    const original = rows.find((row) => row.scenario === entry.scenario && row.replicate === entry.replicate);
    refusalAudit.language_calls_on_refused_cells += original?.language_calls ?? 0;
  }
  refusalAudit.pass = refusalAudit.replays_matching_original === refusalAudit.refused_cells
    && refusalAudit.projection_bindings_verified === refusalAudit.refused_cells
    && refusalAudit.language_calls_on_refused_cells === 0;
} catch {
  refusalAudit.pass = false;
  refusalAudit.note = 'rejection-forensic.json not present';
}
write('refusal-audit.json', refusalAudit);

// ---- projection-hash ownership audit -------------------------------------------
const hashAudit = {
  schema_version: 'affect-cognition-c3-host-bound-hash-audit-v0',
  model_emitted_projection_hash_cells: 0, schema_advertises_projection_hash: 0, prompt_asks_for_hash: 0, cells: 0, pass: false
};
for (const row of rows) {
  hashAudit.cells += 1;
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  if (parsed?.cognition !== undefined && Object.hasOwn(parsed.cognition, 'projection_hash')) hashAudit.model_emitted_projection_hash_cells += 1;
  if (JSON.stringify(row.raw_cognition_request?.structured_output?.schema ?? {}).includes('projection_hash')) hashAudit.schema_advertises_projection_hash += 1;
  const system = row.raw_cognition_request?.messages?.find((message) => message.role === 'system')?.content ?? '';
  if (system.includes('projection_hash') && !system.includes('Do NOT output any projection hash')) hashAudit.prompt_asks_for_hash += 1;
}
hashAudit.pass = hashAudit.model_emitted_projection_hash_cells === 0 && hashAudit.schema_advertises_projection_hash === 0 && hashAudit.prompt_asks_for_hash === 0;
write('host-bound-hash-audit.json', hashAudit);

// ---- condition leakage ----------------------------------------------------------
let leakageViolations = 0;
for (const row of rows) {
  if (row.language_leakage?.ok === false) leakageViolations += 1;
  if (row.request_attestation?.ok === false) leakageViolations += 1;
}
const leakage = { schema_version: 'affect-cognition-c3-condition-leakage-v0', rows: rows.length, violations: leakageViolations, pass: leakageViolations === 0 };
write('condition-leakage.json', leakage);

// ---- verdict --------------------------------------------------------------------
// Precedence follows the frozen order in PROTOCOL.md. IMPLEMENTATION_FAILED is
// reserved for harness/host breakage (isolation violation, an unreachable
// transport, a schema or hash defect) — NOT for model non-compliance that the
// host correctly refused, which is what the factual/choice verdicts describe.
const protocolFailures = rows.filter((row) => row.classification.protocol === 'FAIL').length;
const nullFactsPass = NULL_ONLY_SCENARIOS.every((scenario) => cellsOf(scenario.id).every((row) => row.classification.final_fact === 'FACT_CORRECT'));
const falseClarify = rows.filter((row) => row.classification.false_clarify).length;
const unreachedTransports = rows.filter((row) => row.stages.RAW_PROVIDER_RESPONSE !== true).length;
const implementationBroken = leakage.violations > 0 || !hashAudit.pass || unreachedTransports > 0
  || rows.some((row) => row.request_attestation === null || row.request_attestation === undefined);
const flags = {
  implementation_intact: !implementationBroken,
  protocol_failures: protocolFailures,
  host_refused_cells: refusalAudit.refused_cells,
  null_facts_pass: nullFactsPass,
  authority_boundary_held: factualAudit.authority_boundary_held,
  lawful_sourcing_pass: factualAudit.lawful_sourcing_pass,
  factual_assessment_pass: factualAudit.lawful_sourcing_pass,
  host_bound_hash_pass: hashAudit.pass,
  choice_endpoint_pass: endpointAudit.pass,
  null_cell_pass: nullCellAudit.pass,
  language_fidelity_pass: deliveredFidelity.pass,
  language_fidelity_raw_pass: fidelity.pass,
  handoff_divergence_pass: handoffAudit.pass,
  clarification_pass: falseClarify === 0,
  leakage_pass: leakage.pass,
  family_d_triggered: summary.family_d?.triggered === true,
  qualification_gate_passed: summary.all_qualification_passed === true,
  formal_matrix_run: false
};
let principal;
if (!flags.implementation_intact) principal = 'AFFECT_COGNITION_C3_IMPLEMENTATION_FAILED';
else if (!flags.factual_assessment_pass) principal = 'AFFECT_COGNITION_C3_FACTUAL_ASSESSMENT_FAILED';
else if (!flags.choice_endpoint_pass || !flags.null_cell_pass) principal = 'AFFECT_COGNITION_C3_CHOICE_PRODUCTION_FAILED';
else if (!flags.language_fidelity_pass) principal = 'AFFECT_COGNITION_C3_LANGUAGE_FIDELITY_FAILED';
else if (falseClarify > 0) principal = 'AFFECT_COGNITION_C3_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.qualification_gate_passed && flags.choice_endpoint_pass && flags.language_fidelity_pass && flags.leakage_pass && flags.host_bound_hash_pass) principal = 'AFFECT_COGNITION_C3_VALIDATED';
else principal = 'AFFECT_COGNITION_C3_REVALIDATION_INCONCLUSIVE';
const verdict = {
  schema_version: 'affect-cognition-c3-qualification-verdict-v0',
  repository_head: freeze.repository_head, provider_digest: freeze.provider.digest, protocol: PROTOCOL_STRINGS.cognition,
  rows: rows.length, flags, principal_verdict: principal,
  co_present: principal === 'AFFECT_COGNITION_C3_FACTUAL_ASSESSMENT_FAILED' && !flags.choice_endpoint_pass
    ? 'AFFECT_COGNITION_C3_CHOICE_PRODUCTION_FAILED'
    : (principal === 'AFFECT_COGNITION_C3_CHOICE_PRODUCTION_FAILED' && !flags.factual_assessment_pass ? 'AFFECT_COGNITION_C3_FACTUAL_ASSESSMENT_FAILED' : null),
  next_stage: flags.qualification_gate_passed ? 'FORMAL_MATRIX_PERMITTED' : 'FORMAL_MATRIX_NOT_RUN'
};
write('verdict.json', verdict);
process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
