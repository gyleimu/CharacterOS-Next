/**
 * AFFECT_COGNITION_INSTRUMENT_ALIGNMENT_AND_INPUT_STABILITY_V0 —
 * formal analysis (deterministic, zero model calls). Written for the frozen
 * formal matrix; NOT EXECUTED in this slice because the qualification gate failed
 * (55/65), so `raw-cognition.jsonl` does not exist.
 *
 * Choice-level separation is reported twice: on the authoritative cognition
 * selection (primary endpoint) and on the delivered behavior.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHOICE_UNIVERSE, distribution, jensenShannon, totalVariation } from './lib/classify.mjs';
import { HISTORICAL_SCENARIOS, MATERIALITY, MIXED_SCENARIOS, NULL_SCENARIOS, RELEVANT_SCENARIOS } from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
if (!existsSync(resolve(here, 'raw-cognition.jsonl'))) {
  process.stdout.write(`${JSON.stringify({ status: 'NOT_RUN', reason: 'qualification gate failed; the frozen formal matrix was not executed' }, null, 2)}\n`);
  process.exit(0);
}
const read = (name) => JSON.parse(readFileSync(resolve(here, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`);
const rows = readFileSync(resolve(here, 'raw-cognition.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const byScenario = (id) => rows.filter((row) => row.scenario === id);
const conditions = ['P', 'N', 'A', 'Z'];

const nullAnalysis = { schema_version: 'affect-cognition-instrument-alignment-null-analysis-v0', per_scenario: {}, aggregate: { correct: 0, required: 0 }, pass: false };
for (const scenario of NULL_SCENARIOS) {
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    const correct = cells.filter((row) => row.classification.protocol === 'PASS' && row.classification.final_fact === 'FACT_CORRECT'
      && row.classification.applicability === 'NO_SUBJECTIVE_SELECTION' && row.classification.language_invented_preference === false
      && !row.classification.false_clarify && row.classification.unsupported_premises.length === 0);
    perCondition[condition] = { cells: cells.length, correct: correct.length };
    nullAnalysis.aggregate.correct += correct.length;
    nullAnalysis.aggregate.required += cells.length;
  }
  nullAnalysis.per_scenario[scenario.id] = perCondition;
}
nullAnalysis.pass = nullAnalysis.aggregate.correct === 168;
write('null-analysis.json', nullAnalysis);

const mixedAnalysis = { schema_version: 'affect-cognition-instrument-alignment-mixed-analysis-v0', aggregate: { facts_correct: 0, selected: 0, preserved: 0, unsupported: 0, self_state: 0, total: 0 }, separation: {}, material_scenarios: [], pass: false };
for (const scenario of MIXED_SCENARIOS) {
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    mixedAnalysis.aggregate.facts_correct += cells.filter((row) => row.classification.final_fact === 'FACT_CORRECT').length;
    mixedAnalysis.aggregate.selected += cells.filter((row) => row.classification.applicability === 'SUBJECTIVE_SELECTION').length;
    mixedAnalysis.aggregate.preserved += cells.filter((row) => row.classification.language_choice === 'LANGUAGE_CHOICE_PRESERVED').length;
    mixedAnalysis.aggregate.unsupported += cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0);
    mixedAnalysis.aggregate.self_state += cells.reduce((sum, row) => sum + row.classification.factual_self_state_assertion.length, 0);
    mixedAnalysis.aggregate.total += cells.length;
  }
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.stance_selected);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.stance_selected);
  mixedAnalysis.separation[scenario.id] = { p: distribution(p), n: distribution(n), tvd: Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4)), js: Number(jensenShannon(p, n, CHOICE_UNIVERSE).toFixed(4)) };
}
mixedAnalysis.material_scenarios = Object.entries(mixedAnalysis.separation).filter(([, v]) => v.tvd >= MATERIALITY.tvd_floor && v.js >= MATERIALITY.js_floor).map(([id]) => id);
mixedAnalysis.pass = mixedAnalysis.aggregate.facts_correct === 84 && mixedAnalysis.aggregate.selected === 84
  && mixedAnalysis.aggregate.preserved === 84 && mixedAnalysis.aggregate.unsupported === 0 && mixedAnalysis.aggregate.self_state === 0
  && mixedAnalysis.material_scenarios.length >= 1;
write('mixed-analysis.json', mixedAnalysis);

const relevantAnalysis = { schema_version: 'affect-cognition-instrument-alignment-relevant-analysis-v0', per_scenario: {}, material_scenarios: [], pass: false };
for (const scenario of RELEVANT_SCENARIOS) {
  const p = byScenario(scenario.id).filter((row) => row.condition === 'P').map((row) => row.classification.stance_selected);
  const n = byScenario(scenario.id).filter((row) => row.condition === 'N').map((row) => row.classification.stance_selected);
  const tvd = Number(totalVariation(p, n, CHOICE_UNIVERSE).toFixed(4));
  const js = Number(jensenShannon(p, n, CHOICE_UNIVERSE).toFixed(4));
  const perCondition = {};
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    const labels = cells.map((row) => row.classification.stance_selected);
    const counts = distribution(labels);
    const maxCount = Math.max(...Object.values(counts));
    const even = labels.filter((_, index) => index % 2 === 0);
    const odd = labels.filter((_, index) => index % 2 === 1);
    perCondition[condition] = { cells: cells.length, counts, consistent: maxCount >= MATERIALITY.min_consistent, split_half_tvd: Number(totalVariation(even, odd, CHOICE_UNIVERSE).toFixed(4)) };
  }
  const within = Math.max(perCondition.P.split_half_tvd, perCondition.N.split_half_tvd);
  const material = tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within && perCondition.P.consistent && perCondition.N.consistent;
  relevantAnalysis.per_scenario[scenario.id] = { p: distribution(p), n: distribution(n), tvd, js, within, material, per_condition: perCondition };
}
relevantAnalysis.material_scenarios = Object.entries(relevantAnalysis.per_scenario).filter(([, v]) => v.material).map(([id]) => id);
relevantAnalysis.pass = relevantAnalysis.material_scenarios.length >= 3;
write('relevant-analysis.json', relevantAnalysis);

const historicalAnalysis = { schema_version: 'affect-cognition-instrument-alignment-historical-analysis-v0', diagnostic_only: true, claim: 'no causal claim is made from S cells', per_scenario: {} };
for (const scenario of HISTORICAL_SCENARIOS) {
  for (const condition of conditions) {
    const cells = byScenario(scenario.id).filter((row) => row.condition === condition);
    historicalAnalysis.per_scenario[`${scenario.id}/${condition}`] = { cells: cells.length, tags: distribution(cells.map((row) => row.classification.applicability), ['NO_SUBJECTIVE_SELECTION', 'SUBJECTIVE_SELECTION', 'UNLAWFUL']), unsupported: cells.reduce((sum, row) => sum + row.classification.unsupported_premises.length, 0) };
  }
}
write('historical-analysis.json', historicalAnalysis);

const readQualification = read('qualification-summary.json');
const flags = {
  qualification_passed: readQualification.all_qualification_passed === true,
  null_pass: nullAnalysis.pass, mixed_pass: mixedAnalysis.pass, relevant_pass: relevantAnalysis.pass,
  protocol_failures: rows.filter((row) => row.classification.protocol === 'FAIL').length,
  self_state_facts: rows.reduce((sum, row) => sum + row.classification.factual_self_state_assertion.length, 0),
  unlawful_sources: rows.reduce((sum, row) => sum + row.classification.unlawful_factual_source_refs.length, 0),
  false_clarify: rows.filter((row) => row.classification.false_clarify).length,
  language_changed: rows.filter((row) => ['LANGUAGE_CHOICE_CHANGED', 'LANGUAGE_CHOICE_CHANGED_AT_HANDOFF', 'LANGUAGE_CHOICE_DROPPED'].includes(row.classification.language_choice)).length,
  off_question_stances: rows.filter((row) => row.classification.off_question === 'OFF_QUESTION_STANCE').length,
  rationale_forbidden: rows.filter((row) => (row.classification.rationale_forbidden_classes ?? []).length > 0).length,
  semantic_completions: rows.filter((row) => row.classification.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE').length,
  language_invented: rows.filter((row) => row.classification.language_invented_preference === true || row.classification.language_choice === 'LANGUAGE_CHOICE_INVENTED').length,
  material_scenarios: relevantAnalysis.material_scenarios
};
let principal;
const formalTruncations = rows.filter((row) => (row.wrapper_error ?? '').includes('TRUNCATED') || (row.cognition_trace ?? []).some((event) => event?.ollama?.done_reason === 'length')).length;
flags.truncations = formalTruncations;
flags.transport_degeneration = formalTruncations > 0;
if (flags.transport_degeneration) principal = 'AFFECT_COGNITION_TRANSPORT_DEGENERATION_FAILED';
else if (flags.protocol_failures > rows.length * 0.1) principal = 'AFFECT_COGNITION_IMPLEMENTATION_FAILED';
else if (!flags.null_pass) principal = 'AFFECT_COGNITION_APPLICABILITY_FAILED';
else if (flags.rationale_forbidden > 0) principal = 'AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED';
else if (flags.off_question_stances > 0) principal = 'AFFECT_COGNITION_APPLICABILITY_FAILED';
else if (flags.self_state_facts > 0 || flags.unlawful_sources > 0) principal = 'AFFECT_COGNITION_FACTUAL_ASSESSMENT_FAILED';
else if (flags.language_changed > 0 || flags.language_invented > 0 || flags.semantic_completions > 0) principal = 'AFFECT_COGNITION_LANGUAGE_FIDELITY_FAILED';
else if (!flags.relevant_pass) principal = 'AFFECT_COGNITION_SUBJECTIVE_DIFFERENTIATION_FAILED';
else if (flags.false_clarify > 0) principal = 'AFFECT_COGNITION_CLARIFICATION_BOUNDARY_FAILED';
else if (flags.mixed_pass && flags.relevant_pass && flags.null_pass && flags.language_changed === 0) principal = 'AFFECT_COGNITION_VALIDATED';
else principal = 'AFFECT_COGNITION_REVALIDATION_INCONCLUSIVE';
write('verdict.json', { schema_version: 'affect-cognition-instrument-alignment-formal-verdict-v0', rows: rows.length, flags, principal_verdict: principal });
process.stdout.write(`${JSON.stringify({ rows: rows.length, flags, principal_verdict: principal }, null, 2)}\n`);
