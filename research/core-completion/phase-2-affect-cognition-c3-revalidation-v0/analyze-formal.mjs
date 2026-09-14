/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — formal analysis (deterministic, zero
 * model calls).
 *
 * Consumes the immutable formal evidence and produces the frozen null / mixed /
 * relevant / historical / fidelity / clarification / leakage analyses plus the
 * component flags for the principal verdict.
 *
 * Choice-level separation is computed twice and reported separately: on the
 * authoritative cognition selection (`cognition_choice`, the primary endpoint)
 * and on the delivered behavior (`final_choice`). The materiality gate uses the
 * primary endpoint; the delivered-behavior figures are reported as the
 * behavioral counterpart.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHOICE_UNIVERSE, distribution, jensenShannon, totalVariation
} from './lib/classify.mjs';
import {
  HISTORICAL_SCENARIOS, MATERIALITY, MIXED_SCENARIOS, NULL_SCENARIOS, RELEVANT_SCENARIOS
} from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);
const rows = readFileSync(resolve(here, 'raw-cognition.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const byScenario = (id) => rows.filter((row) => row.scenario === id);
const conditions = ['P', 'N', 'A', 'Z'];
const baseRequests = read('base-requests.json');
const factualSourcesOf = (scenarioId) => {
  const block = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(baseRequests[scenarioId].user_content)?.[0] ?? '';
  return new Set([...block.matchAll(/^- (\S+)$/gm)].map((match) => match[1]));
};

// ---- null ---------------------------------------------------------------------
const nullAnalysis = { schema_version: 'affect-cognition-c3-null-analysis-v0', per_scenario: {}, aggregate: { correct: 0, required: 0 } };
for (const scenario of NULL_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    const correct = cells.filter((row) => row.classification.protocol === 'PASS' && row.classification.final_fact === 'FACT_CORRECT'
      && row.classification.primary_endpoint === 'CHOICE_CORRECTLY_NULL' && !row.classification.false_clarify && row.classification.unsupported_premises.length === 0);
    perCondition[condition] = {
      cells: cells.length, correct: correct.length,
      failures: cells.filter((row) => !correct.includes(row)).map((row) => ({ replicate: row.replicate, stage: row.failure_stage, fact: row.classification.final_fact, endpoint: row.classification.primary_endpoint, clarify: row.classification.false_clarify }))
    };
    nullAnalysis.aggregate.correct += correct.length;
    nullAnalysis.aggregate.required += cells.length;
  }
  nullAnalysis.per_scenario[scenario.id] = { expected: scenario.expected, per_condition: perCondition };
}
nullAnalysis.pass = nullAnalysis.aggregate.correct === 168 && nullAnalysis.aggregate.required === 168;
write('null-analysis.json', nullAnalysis);

// ---- mixed --------------------------------------------------------------------
const mixedAnalysis = {
  schema_version: 'affect-cognition-c3-mixed-analysis-v0', per_scenario: {},
  aggregate: { facts_correct: 0, choices_selected: 0, choices_preserved: 0, unsupported: 0, total: 0 },
  separation: {}, separation_delivered: {}, material_scenarios: [], pass: false
};
for (const scenario of MIXED_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    perCondition[condition] = {
      cells: cells.length,
      facts_correct: cells.filter((row) => row.classification.final_fact === 'FACT_CORRECT').length,
      choices_selected: cells.filter((row) => row.classification.primary_endpoint === 'CHOICE_SELECTED_AT_COGNITION').length,
      choices_preserved: cells.filter((row) => row.classification.choice_fidelity === 'CHOICE_PRESERVED').length,
      unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0),
      protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length,
      false_clarify: cells.filter((row) => row.classification.false_clarify).length,
      choice_classes: distribution(cells.map((row) => row.classification.cognition_choice))
    };
    mixedAnalysis.aggregate.facts_correct += perCondition[condition].facts_correct;
    mixedAnalysis.aggregate.choices_selected += perCondition[condition].choices_selected;
    mixedAnalysis.aggregate.choices_preserved += perCondition[condition].choices_preserved;
    mixedAnalysis.aggregate.unsupported += perCondition[condition].unsupported;
    mixedAnalysis.aggregate.total += cells.length;
  }
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.cognition_choice);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.cognition_choice);
  const pFinal = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.final_choice);
  const nFinal = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.final_choice);
  mixedAnalysis.separation[scenario.id] = { p: distribution(p), n: distribution(n), tvd: Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4)), js: Number(jensenShannon(p, n, CHOICE_UNIVERSE).toFixed(4)) };
  mixedAnalysis.separation_delivered[scenario.id] = { p: distribution(pFinal), n: distribution(nFinal), tvd: Number(totalVariation(pFinal, nFinal, CHOICE_UNIVERSE).toFixed(4)) };
}
mixedAnalysis.material_scenarios = Object.entries(mixedAnalysis.separation)
  .filter(([, value]) => value.tvd >= MATERIALITY.tvd_floor && value.js >= MATERIALITY.js_floor).map(([id]) => id);
mixedAnalysis.pass = mixedAnalysis.aggregate.facts_correct === 84 && mixedAnalysis.aggregate.choices_selected === 84
  && mixedAnalysis.aggregate.choices_preserved === 84 && mixedAnalysis.aggregate.unsupported === 0
  && mixedAnalysis.material_scenarios.length >= 1;
write('mixed-analysis.json', mixedAnalysis);

// ---- relevant R ---------------------------------------------------------------
const relevantAnalysis = { schema_version: 'affect-cognition-c3-relevant-analysis-v0', per_scenario: {}, material_scenarios: [], pass: false };
for (const scenario of RELEVANT_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    const labels = cells.map((row) => row.classification.cognition_choice);
    const counts = distribution(labels);
    const maxCount = Math.max(...Object.values(counts));
    const even = labels.filter((_, index) => index % 2 === 0);
    const odd = labels.filter((_, index) => index % 2 === 1);
    perCondition[condition] = {
      cells: cells.length,
      choices_selected: cells.filter((row) => row.classification.primary_endpoint === 'CHOICE_SELECTED_AT_COGNITION').length,
      counts,
      majority_proportion: cells.length === 0 ? 0 : maxCount / cells.length,
      consistent: maxCount >= MATERIALITY.min_consistent,
      split_half_tvd: Number(totalVariation(even, odd, CHOICE_UNIVERSE).toFixed(4)),
      protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length,
      unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0)
    };
  }
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.cognition_choice);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.cognition_choice);
  const tvd = Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4));
  const js = Number(jensenShannon(p, n, CHOICE_UNIVERSE).toFixed(4));
  const within = Math.max(perCondition.P.split_half_tvd, perCondition.N.split_half_tvd);
  const material = tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within
    && perCondition.P.consistent && perCondition.N.consistent;
  const pFinal = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.final_choice);
  const nFinal = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.final_choice);
  relevantAnalysis.per_scenario[scenario.id] = {
    p: distribution(p), n: distribution(n), tvd, js, within, material,
    delivered_tvd: Number(totalVariation(pFinal, nFinal, CHOICE_UNIVERSE).toFixed(4)), per_condition: perCondition
  };
}
relevantAnalysis.material_scenarios = Object.entries(relevantAnalysis.per_scenario).filter(([, value]) => value.material).map(([id]) => id);
relevantAnalysis.pass = relevantAnalysis.material_scenarios.length >= 3;
write('relevant-analysis.json', relevantAnalysis);

// ---- historical S (diagnostic) -------------------------------------------------
const historicalAnalysis = { schema_version: 'affect-cognition-c3-historical-analysis-v0', diagnostic_only: true, claim: 'no causal claim is made from S cells', per_scenario: {} };
for (const scenario of HISTORICAL_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    perCondition[condition] = {
      cells: cells.length,
      choices: distribution(cells.map((row) => row.classification.cognition_choice)),
      selected_at_cognition: cells.filter((row) => row.classification.primary_endpoint === 'CHOICE_SELECTED_AT_COGNITION').length,
      unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0),
      protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length
    };
  }
  historicalAnalysis.per_scenario[scenario.id] = perCondition;
}
write('historical-analysis.json', historicalAnalysis);

// ---- factual authority audit ---------------------------------------------------
const factualAudit = { schema_version: 'affect-cognition-c3-factual-assessment-audit-v0', claims: 0, subject_state_source_attempts: 0, non_factual_source_attempts: [], pass: false };
for (const row of rows) {
  const sources = factualSourcesOf(row.scenario);
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  for (const claim of parsed?.factual_assessment?.claims ?? []) {
    factualAudit.claims += 1;
    for (const ref of claim.source_refs ?? []) {
      if (ref.startsWith('subject:')) {
        factualAudit.subject_state_source_attempts += 1;
        factualAudit.non_factual_source_attempts.push({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, ref, accepted: false });
      } else if ((ref.startsWith('entity:') || ref.startsWith('environment:')) && !sources.has(ref)) {
        factualAudit.non_factual_source_attempts.push({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, ref, accepted: false });
      }
    }
  }
}
factualAudit.pass = factualAudit.subject_state_source_attempts === 0 && factualAudit.non_factual_source_attempts.length === 0;
write('factual-assessment-audit.json', factualAudit);

// ---- model-owned integrity audit ----------------------------------------------
const hashAudit = { schema_version: 'affect-cognition-c3-host-bound-hash-audit-v0', cells: rows.length, model_emitted_projection_hash_cells: 0, pass: false };
for (const row of rows) {
  const parsed = (() => { try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; } })();
  if (parsed?.cognition !== undefined && Object.hasOwn(parsed.cognition, 'projection_hash')) hashAudit.model_emitted_projection_hash_cells += 1;
}
hashAudit.pass = hashAudit.model_emitted_projection_hash_cells === 0;
write('host-bound-hash-audit.json', hashAudit);

// ---- language fidelity ---------------------------------------------------------
const fidelity = { schema_version: 'affect-cognition-c3-language-fidelity-v0', CHOICE_PRESERVED: 0, CHOICE_CHANGED: 0, CHOICE_INVENTED: 0, CHOICE_DROPPED: 0, CHOICE_CHANGED_AT_HANDOFF: 0, CHOICE_NOT_HANDED_OFF: 0, FACT_PRESERVED: 0, FACT_CHANGED: 0, FACT_CONTRADICTED: 0, UNSUPPORTED_REASON_ADDED: 0, pass: false };
for (const row of rows) {
  const choice = row.classification.choice_fidelity;
  if (choice in fidelity) fidelity[choice] += 1;
  const fact = row.classification.fact_fidelity;
  if (fact in fidelity) fidelity[fact] += 1;
  if (row.classification.unsupported_premises.length > 0) fidelity.UNSUPPORTED_REASON_ADDED += 1;
}
fidelity.pass = fidelity.CHOICE_CHANGED === 0 && fidelity.CHOICE_INVENTED === 0 && fidelity.CHOICE_DROPPED === 0 && fidelity.CHOICE_CHANGED_AT_HANDOFF === 0 && fidelity.CHOICE_NOT_HANDED_OFF === 0 && fidelity.FACT_CHANGED === 0 && fidelity.FACT_CONTRADICTED === 0 && fidelity.UNSUPPORTED_REASON_ADDED === 0;
write('language-fidelity.json', fidelity);

// ---- clarification audit -------------------------------------------------------
const clarifyRows = rows.filter((row) => row.directive === 'CLARIFY_MISSING_CONTEXT');
const clarifyAudit = {
  schema_version: 'affect-cognition-c3-clarification-audit-v0',
  clarify_cells: clarifyRows.length,
  valid_basis: clarifyRows.filter((row) => row.clarification_basis !== null && row.clarification_basis !== undefined).length,
  null_choice: clarifyRows.filter((row) => row.subjective_choice === null).length,
  false_necessity: clarifyRows.filter((row) => row.classification.false_clarify).length,
  records: clarifyRows.map((row) => ({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, basis: row.clarification_basis ?? null, final_behavior: row.final_behavior }))
};
clarifyAudit.pass = clarifyAudit.false_necessity === 0;
write('clarification-audit.json', clarifyAudit);

// ---- leakage -------------------------------------------------------------------
let violations = 0;
for (const row of rows) {
  if (row.language_leakage?.ok === false) violations += 1;
  if (row.request_attestation?.ok === false) violations += 1;
}
const leakage = { schema_version: 'affect-cognition-c3-condition-leakage-v0', rows: rows.length, violations, pass: violations === 0 };
write('condition-leakage.json', leakage);

// ---- verdict -------------------------------------------------------------------
const protocolFailures = rows.filter((row) => row.classification.protocol === 'FAIL').length;
const flags = {
  qualification_passed: read('qualification-summary.json').all_qualification_passed === true,
  null_pass: nullAnalysis.pass, mixed_pass: mixedAnalysis.pass, relevant_pass: relevantAnalysis.pass,
  factual_authority_pass: factualAudit.pass, host_bound_hash_pass: hashAudit.pass,
  language_fidelity_pass: fidelity.pass, clarification_pass: clarifyAudit.pass,
  leakage_pass: leakage.pass && rows.every((row) => row.request_attestation?.ok === true),
  protocol_failures: protocolFailures,
  material_scenarios: relevantAnalysis.material_scenarios,
  subject_state_source_attempts: factualAudit.subject_state_source_attempts
};
let principal;
if (flags.protocol_failures > rows.length * 0.1) principal = 'AFFECT_COGNITION_C3_IMPLEMENTATION_FAILED';
else if (!flags.null_pass || !flags.factual_authority_pass) principal = 'AFFECT_COGNITION_C3_FACTUAL_ASSESSMENT_FAILED';
else if (!flags.language_fidelity_pass) principal = 'AFFECT_COGNITION_C3_LANGUAGE_FIDELITY_FAILED';
else if (!flags.relevant_pass) principal = 'AFFECT_COGNITION_C3_SUBJECTIVE_DIFFERENTIATION_FAILED';
else if (!flags.clarification_pass) principal = 'AFFECT_COGNITION_C3_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.mixed_pass && flags.relevant_pass && flags.null_pass && flags.factual_authority_pass && flags.language_fidelity_pass && flags.clarification_pass && flags.leakage_pass && flags.host_bound_hash_pass) principal = 'AFFECT_COGNITION_C3_VALIDATED';
else principal = 'AFFECT_COGNITION_C3_REVALIDATION_INCONCLUSIVE';
write('verdict.json', { schema_version: 'affect-cognition-c3-formal-verdict-v0', rows: rows.length, flags, principal_verdict: principal });
process.stdout.write(`${JSON.stringify({ rows: rows.length, flags, principal_verdict: principal }, null, 2)}\n`);
