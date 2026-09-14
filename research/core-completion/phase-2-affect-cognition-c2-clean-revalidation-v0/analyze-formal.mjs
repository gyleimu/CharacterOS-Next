/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — formal analysis (deterministic,
 * zero model calls). Consumes the immutable raw evidence and produces the frozen
 * null / mixed / relevant / historical / fidelity / clarification / leakage
 * analyses and the component flags for the principal verdict.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HISTORICAL_SCENARIOS,
  MATERIALITY,
  MIXED_SCENARIOS,
  NULL_SCENARIOS,
  RELEVANT_SCENARIOS
} from './lib/config.mjs';
import { distribution, jensenShannon, totalVariation } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);
const rows = readFileSync(resolve(here, 'raw-cognition.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const byScenario = (id) => rows.filter((row) => row.scenario === id);
const CHOICE_UNIVERSE = ['FIRST_OPTION', 'SECOND_OPTION', 'CONDITIONAL', 'NO_CHOICE'];
const conditions = ['P', 'N', 'A', 'Z'];

const baseRequests = read('base-requests.json');
const factualSourcesOf = (scenarioId) => {
  const block = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(baseRequests[scenarioId].user_content)?.[0] ?? '';
  return new Set([...block.matchAll(/^- (\S+)$/gm)].map((match) => match[1]));
};

// ---- null ---------------------------------------------------------------------
const nullAnalysis = { schema_version: 'affect-cognition-c2-null-analysis-v0', per_scenario: {}, aggregate: { correct: 0, required: 0 } };
for (const scenario of NULL_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    const correct = cells.filter((row) => row.classification.protocol === 'PASS' && row.classification.final_fact === 'FACT_CORRECT' && !row.classification.false_clarify && row.classification.unsupported_premises.length === 0);
    perCondition[condition] = { cells: cells.length, correct: correct.length, failures: cells.filter((row) => !correct.includes(row)).map((row) => ({ replicate: row.replicate, stage: row.failure_stage, fact: row.classification.final_fact, clarify: row.classification.false_clarify })) };
    nullAnalysis.aggregate.correct += correct.length;
    nullAnalysis.aggregate.required += cells.length;
  }
  nullAnalysis.per_scenario[scenario.id] = { expected: scenario.expected, per_condition: perCondition };
}
nullAnalysis.pass = nullAnalysis.aggregate.correct === 168 && nullAnalysis.aggregate.required === 168;
write('null-analysis.json', nullAnalysis);

// ---- mixed --------------------------------------------------------------------
const mixedAnalysis = { schema_version: 'affect-cognition-c2-mixed-analysis-v0', per_scenario: {}, aggregate: { facts_correct: 0, choices_complete: 0, unsupported: 0, total: 0 }, separation: {} };
for (const scenario of MIXED_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    perCondition[condition] = {
      cells: cells.length,
      facts_correct: cells.filter((row) => row.classification.final_fact === 'FACT_CORRECT').length,
      choices_complete: cells.filter((row) => row.classification.final_choice !== 'NO_CHOICE').length,
      unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0),
      protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length,
      false_clarify: cells.filter((row) => row.classification.false_clarify).length,
      choice_classes: distribution(cells.map((row) => row.classification.final_choice), CHOICE_UNIVERSE)
    };
    mixedAnalysis.aggregate.facts_correct += perCondition[condition].facts_correct;
    mixedAnalysis.aggregate.choices_complete += perCondition[condition].choices_complete;
    mixedAnalysis.aggregate.unsupported += perCondition[condition].unsupported;
    mixedAnalysis.aggregate.total += cells.length;
  }
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.final_choice);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.final_choice);
  mixedAnalysis.separation[scenario.id] = { p: distribution(p, CHOICE_UNIVERSE), n: distribution(n, CHOICE_UNIVERSE), tvd: Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4)) };
}
mixedAnalysis.material_scenarios = Object.entries(mixedAnalysis.separation).filter(([, value]) => value.tvd >= MATERIALITY.tvd_floor).map(([id]) => id);
mixedAnalysis.pass = mixedAnalysis.aggregate.facts_correct === 84 && mixedAnalysis.aggregate.choices_complete === 84 && mixedAnalysis.aggregate.unsupported === 0 && mixedAnalysis.material_scenarios.length >= 1;
write('mixed-analysis.json', mixedAnalysis);

// ---- relevant R ---------------------------------------------------------------
const relevantAnalysis = { schema_version: 'affect-cognition-c2-relevant-analysis-v0', per_scenario: {}, material_scenarios: [], pass: false };
for (const scenario of RELEVANT_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition).sort((a, b) => a.replicate - b.replicate);
    const labels = cells.map((row) => row.classification.final_choice);
    const counts = distribution(labels, CHOICE_UNIVERSE);
    const maxCount = Math.max(...Object.values(counts));
    const splitHalf = (indices) => {
      const a = indices.map((index) => labels[index]).filter((value) => value !== undefined);
      const b = indices.map((index) => labels[index]).filter((value) => value !== undefined);
      return { a, b };
    };
    void splitHalf;
    const halvesA = labels.filter((_, index) => index <= 2);
    const halvesB = labels.filter((_, index) => index >= 3);
    const parity = labels.filter((_, index) => index % 2 === 0);
    const odd = labels.filter((_, index) => index % 2 === 1);
    perCondition[condition] = {
      cells: cells.length,
      choices_complete: labels.filter((label) => label !== 'NO_CHOICE').length,
      counts,
      majority_proportion: cells.length === 0 ? 0 : maxCount / cells.length,
      consistent: maxCount >= MATERIALITY.min_consistent,
      split_half_tvd: Number(Math.max(totalVariation(halvesA, halvesB, CHOICE_UNIVERSE), totalVariation(parity, odd, CHOICE_UNIVERSE)).toFixed(4)),
      protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length,
      false_clarify: cells.filter((row) => row.classification.false_clarify).length,
      unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0)
    };
  }
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.final_choice);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.final_choice);
  const tvd = Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4));
  const js = Number(jensenShannon(p, n, CHOICE_UNIVERSE).toFixed(4));
  const within = Math.max(perCondition.P.split_half_tvd, perCondition.N.split_half_tvd);
  const material = tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within && perCondition.P.consistent && perCondition.N.consistent;
  relevantAnalysis.per_scenario[scenario.id] = { p: distribution(p, CHOICE_UNIVERSE), n: distribution(n, CHOICE_UNIVERSE), tvd, js, within, material, per_condition: perCondition };
}
relevantAnalysis.material_scenarios = Object.entries(relevantAnalysis.per_scenario).filter(([, value]) => value.material).map(([id]) => id);
relevantAnalysis.pass = relevantAnalysis.material_scenarios.length >= 3;
write('relevant-analysis.json', relevantAnalysis);

// ---- historical S -------------------------------------------------------------
const historicalAnalysis = { schema_version: 'affect-cognition-c2-historical-analysis-v0', diagnostic_only: true, per_scenario: {} };
for (const scenario of HISTORICAL_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    perCondition[condition] = { cells: cells.length, choices: distribution(cells.map((row) => row.classification.final_choice), CHOICE_UNIVERSE), unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0), protocol_failures: cells.filter((row) => row.classification.protocol === 'FAIL').length };
  }
  historicalAnalysis.per_scenario[scenario.id] = perCondition;
}
write('historical-analysis.json', historicalAnalysis);

// ---- factual assessment audit -------------------------------------------------
const factualAudit = { schema_version: 'affect-cognition-c2-factual-assessment-audit-v0', claims: 0, source_quote_claims: 0, derived_result_claims: 0, accepted_claims: 0, subject_state_source_attempts: 0, non_factual_source_attempts: [], per_scenario: {} };
for (const row of rows) {
  const sources = factualSourcesOf(row.scenario);
  const parsed = (() => {
    try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; }
  })();
  const claims = parsed?.factual_assessment?.claims ?? [];
  factualAudit.per_scenario[row.scenario] = factualAudit.per_scenario[row.scenario] ?? { claims: 0, attempts: 0 };
  for (const claim of claims) {
    factualAudit.claims += 1;
    factualAudit.per_scenario[row.scenario].claims += 1;
    if (claim.kind === 'SOURCE_QUOTE') factualAudit.source_quote_claims += 1; else factualAudit.derived_result_claims += 1;
    for (const ref of claim.source_refs ?? []) {
      if (ref.startsWith('subject:')) {
        factualAudit.subject_state_source_attempts += 1;
        factualAudit.per_scenario[row.scenario].attempts += 1;
        factualAudit.non_factual_source_attempts.push({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, ref, accepted: false });
      } else if (ref.startsWith('entity:') || ref.startsWith('environment:')) {
        if (!sources.has(ref)) {
          factualAudit.per_scenario[row.scenario].attempts += 1;
          factualAudit.non_factual_source_attempts.push({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, ref, accepted: false });
        }
      }
    }
  }
  if (row.classification.protocol === 'PASS' && (row.factual_assessment?.claims?.length ?? 0) > 0) factualAudit.accepted_claims += 1;
}
factualAudit.pass = factualAudit.subject_state_source_attempts === 0 && factualAudit.non_factual_source_attempts.length === 0;
write('factual-assessment-audit.json', factualAudit);

// ---- language fidelity --------------------------------------------------------
const fidelity = { schema_version: 'affect-cognition-c2-language-fidelity-v0', FACT_PRESERVED: 0, FACT_CHANGED: 0, FACT_CONTRADICTED: 0, CHOICE_PRESERVED: 0, CHOICE_CHANGED: 0, CHOICE_INVENTED: 0, CHOICE_MISSING: 0, UNSUPPORTED_REASON_ADDED: 0 };
for (const row of rows) {
  const kind = row.classification.fact_fidelity;
  if (kind in fidelity) fidelity[kind] += 1;
  const choice = row.classification.choice_fidelity;
  if (choice in fidelity) fidelity[choice] += 1;
  if (row.classification.unsupported_premises.length > 0) fidelity.UNSUPPORTED_REASON_ADDED += 1;
}
fidelity.pass = fidelity.FACT_CHANGED === 0 && fidelity.FACT_CONTRADICTED === 0 && fidelity.CHOICE_CHANGED === 0 && fidelity.CHOICE_INVENTED === 0 && fidelity.UNSUPPORTED_REASON_ADDED === 0;
write('language-fidelity.json', fidelity);

// ---- clarification audit ------------------------------------------------------
const clarifyRows = rows.filter((row) => row.directive === 'CLARIFY_MISSING_CONTEXT');
const clarifyAudit = {
  schema_version: 'affect-cognition-c2-clarification-audit-v0',
  clarify_cells: clarifyRows.length,
  valid_basis: clarifyRows.filter((row) => row.clarification_basis !== null && row.clarification_basis !== undefined).length,
  observation_bound: clarifyRows.filter((row) => row.clarification_basis?.current_observation_ref !== undefined && row.raw_cognition_request !== null && row.clarification_basis.current_observation_ref === row.clarification_basis.current_observation_ref).length,
  false_necessity: clarifyRows.filter((row) => row.classification.false_clarify).length,
  records: clarifyRows.map((row) => ({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, basis: row.clarification_basis ?? null, final_behavior: row.final_behavior }))
};
clarifyAudit.pass = clarifyAudit.false_necessity === 0;
write('clarification-audit.json', clarifyAudit);

// ---- condition leakage --------------------------------------------------------
let leakageViolations = 0;
for (const row of rows) {
  if (row.language_leakage?.ok === false) leakageViolations += 1;
  if (row.request_attestation?.ok === false) leakageViolations += 1;
}
const leakage = { schema_version: 'affect-cognition-c2-condition-leakage-v0', rows: rows.length, violations: leakageViolations, pass: leakageViolations === 0 };
write('condition-leakage.json', leakage);

// ---- verdict components -------------------------------------------------------
const protocolFailures = rows.filter((row) => row.classification.protocol === 'FAIL').length;
const flags = {
  qualification_passed: read('qualification-summary.json').all_qualification_passed === true,
  null_pass: nullAnalysis.pass,
  mixed_pass: mixedAnalysis.pass,
  relevant_pass: relevantAnalysis.pass,
  factual_authority_pass: factualAudit.pass,
  language_fidelity_pass: fidelity.pass,
  clarification_pass: clarifyAudit.pass,
  leakage_pass: leakage.pass && rows.every((row) => row.request_attestation?.ok === true),
  protocol_failures: protocolFailures,
  material_scenarios: relevantAnalysis.material_scenarios,
  subject_state_source_attempts: factualAudit.subject_state_source_attempts
};
let principal;
if (flags.protocol_failures > 0 && flags.protocol_failures > rows.length * 0.1) principal = 'AFFECT_COGNITION_C2_IMPLEMENTATION_FAILED';
else if (!flags.null_pass || !flags.factual_authority_pass) principal = 'AFFECT_COGNITION_C2_FACTUAL_ASSESSMENT_FAILED';
else if (!flags.language_fidelity_pass) principal = 'AFFECT_COGNITION_C2_LANGUAGE_FIDELITY_FAILED';
else if (!flags.relevant_pass) principal = 'AFFECT_COGNITION_C2_SUBJECTIVE_DIFFERENTIATION_FAILED';
else if (!flags.clarification_pass) principal = 'AFFECT_COGNITION_C2_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.mixed_pass && flags.relevant_pass && flags.null_pass && flags.factual_authority_pass && flags.language_fidelity_pass && flags.clarification_pass && flags.leakage_pass) principal = 'AFFECT_COGNITION_C2_VALIDATED';
else principal = 'AFFECT_COGNITION_C2_REVALIDATION_INCONCLUSIVE';
const verdict = { schema_version: 'affect-cognition-c2-verdict-v0', rows: rows.length, flags, principal_verdict: principal };
write('verdict.json', verdict);
process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
