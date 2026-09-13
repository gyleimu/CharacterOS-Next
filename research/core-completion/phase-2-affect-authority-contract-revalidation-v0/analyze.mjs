/* globals URL */
/**
 * Revalidation analysis. Endpoint: final production-admissible observable
 * behavior. Produces the required evidence artifacts and the component
 * pass/fail flags used for the principal verdict.
 *
 * Usage: node analyze.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AFFECT_SCENARIOS, MATERIALITY, NULL_SCENARIOS, PRIMARY_SCENARIOS, REPLICATES, SUCCESS, ACTIVATION_SCENARIO_IDS } from './lib/config.mjs';
import {
  classUniverse,
  classifyRecord,
  distribution,
  jensenShannonDivergence,
  splitHalfTvd,
  totalVariationDistance
} from './lib/classify.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });
const rawPath = join(evidenceDir, 'raw-cognition.jsonl');
const records = existsSync(rawPath)
  ? readFileSync(rawPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line))
  : [];
const scenarioById = new Map(PRIMARY_SCENARIOS.map((s) => [s.id, s]));

const primary = records.filter((r) => r.stage === 'primary');
const activation = records.filter((r) => r.stage === 'activation');

// ---- raw language evidence -----------------------------------------------------
writeFileSync(
  join(evidenceDir, 'raw-language.jsonl'),
  `${records
    .filter((r) => r.raw_language_response !== null)
    .map((r) => JSON.stringify({ scenario: r.scenario, condition: r.condition, replicate: r.replicate, raw_language_response: r.raw_language_response }))
    .join('\n')}\n`
);

// ---- executor validation staging ----------------------------------------------
const stageCounts = {};
for (const record of records) {
  for (const [stage, ok] of Object.entries(record.stages)) {
    stageCounts[stage] = stageCounts[stage] ?? { ok: 0, fail: 0 };
    stageCounts[stage][ok ? 'ok' : 'fail'] += 1;
  }
}
const failuresByStage = {};
for (const record of records.filter((r) => r.status !== 'COMPLETE')) {
  failuresByStage[record.failure_stage] = (failuresByStage[record.failure_stage] ?? 0) + 1;
}
writeFileSync(
  join(evidenceDir, 'executor-validation.json'),
  `${JSON.stringify({ schema_version: 'affect-authority-executor-validation-v0', total: records.length, stage_counts: stageCounts, failures_by_stage: failuresByStage }, null, 2)}\n`
);

// ---- final behaviors -----------------------------------------------------------
const finalBehaviors = records.map((record) => ({
  scenario: record.scenario,
  condition: record.condition,
  replicate: record.replicate,
  activation: record.activation_experiment === true,
  status: record.status,
  directive: record.directive,
  language_calls: record.language_calls,
  final_behavior: record.final_behavior,
  class: (() => {
    const scenario = scenarioById.get(record.scenario);
    return scenario ? classifyRecord(scenario, record) : null;
  })()
}));
writeFileSync(
  join(evidenceDir, 'final-behaviors.json'),
  `${JSON.stringify({ schema_version: 'affect-authority-final-behaviors-v0', records: finalBehaviors }, null, 2)}\n`
);

// ---- null controls: correct/168 ------------------------------------------------
const nullAnalysis = { perScenario: {}, total: 0, correct: 0 };
for (const scenario of NULL_SCENARIOS) {
  const universe = classUniverse(scenario);
  const perCondition = {};
  for (const conditionId of ['P', 'N', 'Z', 'A']) {
    const rows = finalBehaviors.filter((r) => r.scenario === scenario.id && r.condition === conditionId && !r.activation);
    const labels = rows.map((r) => r.class).filter((c) => c !== null);
    perCondition[conditionId] = {
      attempted: rows.length,
      delivered: labels.length,
      correct: labels.filter((c) => c === `CORRECT_${scenario.expected}`).length,
      distribution: distribution(labels, universe),
      sample_behavior: rows.find((r) => r.final_behavior !== null)?.final_behavior ?? null
    };
    nullAnalysis.total += labels.length;
    nullAnalysis.correct += perCondition[conditionId].correct;
  }
  nullAnalysis.perScenario[scenario.id] = { expected: scenario.expected, per_condition: perCondition };
}
nullAnalysis.required = SUCCESS.null_controls_required_correct;
nullAnalysis.pass = nullAnalysis.correct === nullAnalysis.required;
writeFileSync(join(evidenceDir, 'null-control-analysis.json'), `${JSON.stringify(nullAnalysis, null, 2)}\n`);

// ---- affect-relevant separation ------------------------------------------------
function analyzeScenario(scenario) {
  const universe = scenario.classes;
  const perCondition = {};
  for (const conditionId of ['P', 'N', 'Z', 'A']) {
    const rows = finalBehaviors.filter((r) => r.scenario === scenario.id && r.condition === conditionId && !r.activation);
    const labels = rows.map((r) => r.class).filter((c) => c !== null);
    const dist = distribution(labels, universe);
    perCondition[conditionId] = {
      ...dist,
      delivered: labels.length,
      attempted: rows.length,
      split_half: splitHalfTvd(labels, universe),
      consistent: dist.majority_count >= MATERIALITY.min_consistent
    };
  }
  const pairs = [];
  const ids = ['P', 'N', 'Z', 'A'];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = perCondition[ids[i]];
      const b = perCondition[ids[j]];
      const tvd = totalVariationDistance(a.counts, b.counts, universe);
      const js = jensenShannonDivergence(a.counts, b.counts, universe);
      const within = Math.max(a.split_half.max_tvd, b.split_half.max_tvd);
      const material = tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within;
      pairs.push({ pair: `${ids[i]}_vs_${ids[j]}`, tvd, js_divergence: js, max_within: within, material });
    }
  }
  const materialPairs = pairs.filter((p) => p.material);
  return {
    scenario: scenario.id,
    classes: universe,
    per_condition: perCondition,
    pairs,
    material_pairs: materialPairs.map((p) => p.pair),
    max_between_tvd: Math.max(...pairs.map((p) => p.tvd)),
    max_within: Math.max(...ids.map((id) => perCondition[id].split_half.max_tvd)),
    material_effect: materialPairs.length > 0,
    all_conditions_consistent: ids.every((id) => perCondition[id].consistent),
    all_delivered: ids.every((id) => perCondition[id].delivered === REPLICATES)
  };
}
const affectAnalysis = AFFECT_SCENARIOS.filter((s) => primary.some((r) => r.scenario === s.id)).map(analyzeScenario);
writeFileSync(join(evidenceDir, 'affect-relevant-analysis.json'), `${JSON.stringify({ schema_version: 'affect-authority-relevant-v0', scenarios: affectAnalysis }, null, 2)}\n`);

// ---- clarification basis analysis ---------------------------------------------
const clarificationBases = [];
for (const record of records.filter((r) => r.stages.SCHEMA_VALID)) {
  try {
    const parsed = JSON.parse(record.raw_cognition_response);
    if (parsed.communication_directive?.kind !== 'CLARIFY_MISSING_CONTEXT') continue;
    clarificationBases.push({
      scenario: record.scenario,
      condition: record.condition,
      replicate: record.replicate,
      basis: parsed.clarification_basis ?? null,
      final_behavior: record.final_behavior,
      delivered: record.status === 'COMPLETE'
    });
  } catch {
    /* validated records only */
  }
}
writeFileSync(
  join(evidenceDir, 'clarification-bases.json'),
  `${JSON.stringify(
    {
      schema_version: 'affect-authority-clarification-bases-v0',
      note: 'host verifies schema/ref/binding only; semantic necessity is research adjudication, not runtime authority',
      count: clarificationBases.length,
      records: clarificationBases
    },
    null,
    2
  )}\n`
);

// ---- activation -----------------------------------------------------------------
const activationAnalysis = ACTIVATION_SCENARIO_IDS.filter((id) => activation.some((r) => r.scenario === id)).map((id) => {
  const scenario = scenarioById.get(id);
  const universe = scenario.classes;
  const perCondition = {};
  for (const conditionId of ['LOW', 'HIGH']) {
    const labels = finalBehaviors
      .filter((r) => r.scenario === id && r.condition === conditionId && r.activation)
      .map((r) => r.class)
      .filter((c) => c !== null);
    perCondition[conditionId] = { ...distribution(labels, universe), split_half: splitHalfTvd(labels, universe), delivered: labels.length };
  }
  const tvd = totalVariationDistance(perCondition.LOW.counts, perCondition.HIGH.counts, universe);
  const js = jensenShannonDivergence(perCondition.LOW.counts, perCondition.HIGH.counts, universe);
  const within = Math.max(perCondition.LOW.split_half.max_tvd, perCondition.HIGH.split_half.max_tvd);
  return { scenario: id, per_condition: perCondition, tvd, js_divergence: js, max_within: within, material: tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within };
});
writeFileSync(join(evidenceDir, 'activation-analysis.json'), `${JSON.stringify({ schema_version: 'affect-authority-activation-v0', scenarios: activationAnalysis }, null, 2)}\n`);

// ---- mixed fact + subjective (deterministic note) ------------------------------
writeFileSync(
  join(evidenceDir, 'mixed-case-analysis.json'),
  `${JSON.stringify(
    {
      schema_version: 'affect-authority-mixed-v0',
      live_cases: 0,
      note:
        'The frozen GPT-6 cognition budget (318) is fully consumed by the 4+6 primary matrix, activation and lawful confirmation, so mixed fact+subjective behaviour is covered by deterministic regression tests (conversation-cognition-proposal-v2.test.ts: REALIZE preserves the factual projection binding and a lawful null basis) rather than live scenarios.',
      deterministic_coverage: [
        'REALIZE with clarification_basis null is the only accepted subjective outlet',
        'the factual current observation and Memory binding are unchanged by the affect line',
        'the null-control oracles are the live factual-invariance check'
      ]
    },
    null,
    2
  )}\n`
);

// ---- component flags ------------------------------------------------------------
const affectRelevantWithEffect = affectAnalysis.filter((s) => s.material_effect);
const summary = {
  schema_version: 'affect-authority-summary-v0',
  recorded_calls: records.length,
  primary_records: primary.length,
  activation_records: activation.length,
  executor_all_admissible: records.every((r) => r.stages.EXECUTOR_ADMISSIBLE),
  final_behavior_all_delivered: records.every((r) => r.stages.FINAL_BEHAVIOR),
  null_controls: { correct: nullAnalysis.correct, required: nullAnalysis.required, pass: nullAnalysis.pass },
  affect_relevant: {
    scenarios_with_material_effect: affectRelevantWithEffect.map((s) => s.scenario),
    count: affectRelevantWithEffect.length,
    required: SUCCESS.affect_relevant_min_scenarios,
    pass: affectRelevantWithEffect.length >= SUCCESS.affect_relevant_min_scenarios,
    all_conditions_consistent: affectAnalysis.every((s) => s.all_conditions_consistent),
    all_delivered: affectAnalysis.every((s) => s.all_delivered)
  },
  clarifying_calls: clarificationBases.length,
  activation_material: activationAnalysis.some((a) => a.material),
  factual_boundary_pass: nullAnalysis.pass && records.every((r) => r.stages.EXECUTOR_ADMISSIBLE && r.stages.FINAL_BEHAVIOR),
  affect_retained: affectRelevantWithEffect.length >= SUCCESS.affect_relevant_min_scenarios,
  selectivity_pass: nullAnalysis.pass && affectRelevantWithEffect.length >= SUCCESS.affect_relevant_min_scenarios,
  details: affectAnalysis.map((s) => ({
    scenario: s.scenario,
    material: s.material_effect,
    max_between_tvd: s.max_between_tvd,
    max_within: s.max_within,
    majority: Object.fromEntries(Object.entries(s.per_condition).map(([id, v]) => [id, v.majority_class]))
  }))
};
writeFileSync(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
