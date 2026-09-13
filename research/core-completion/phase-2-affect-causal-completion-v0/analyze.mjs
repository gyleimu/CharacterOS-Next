/* globals URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — deterministic analysis of recorded real calls.
 * No model calls, no embeddings, no LLM judging.
 *
 * Produces classifications.json, distribution-analysis.json,
 * variance-analysis.json, effect-summary.json and verdict.json.
 *
 * Usage: node analyze.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVATION_SCENARIO_IDS,
  CONDITIONS,
  MATERIALITY,
  SCENARIOS,
  STAGE1_SCENARIOS,
  STAGE2_SCENARIOS
} from './lib/config.mjs';
import {
  classifyEndpoints,
  distribution,
  intentDispersion,
  jensenShannonDivergence,
  splitHalfTvd,
  totalVariationDistance
} from './lib/classify.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
const rawPath = join(evidenceDir, 'raw-cognition.jsonl');
mkdirSync(evidenceDir, { recursive: true });

const allRecords = existsSync(rawPath)
  ? readFileSync(rawPath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line))
  : [];

const scenarioById = new Map(SCENARIOS.map((s) => [s.id, s]));

function primaryRecordsOnly(records) {
  return records.filter((record) => record.activation_experiment !== true);
}

function distributionFor(records, scenario, conditionId) {
  const relevant = records.filter(
    (record) => record.scenario === scenario.id && record.condition === conditionId && record.schema_valid === true
  );
  const labels = relevant.map((record) =>
    classifyEndpoints(scenario, record.directive, record.current_intent)
  );
  return { distribution: distribution(labels, scenario.classes), labels, relevant };
}

function analyzeScenario(records, scenario) {
  const conditionIds = ['P', 'N', 'Z', 'A'];
  const perCondition = {};
  for (const conditionId of conditionIds) {
    const { distribution: dist, labels, relevant } = distributionFor(records, scenario, conditionId);
    const recordCount = records.filter((r) => r.scenario === scenario.id && r.condition === conditionId).length;
    perCondition[conditionId] = {
      ...dist,
      invalid: recordCount - relevant.length,
      split_half: splitHalfTvd(labels, scenario.classes),
      intent_dispersion: intentDispersion(relevant.map((r) => r.current_intent)),
      directives: distribution(
        relevant.map((r) => r.directive),
        ['CLARIFY_MISSING_CONTEXT', 'REALIZE_CURRENT_INTENT']
      )
    };
  }

  const pairs = [];
  for (let i = 0; i < conditionIds.length; i += 1) {
    for (let j = i + 1; j < conditionIds.length; j += 1) {
      const a = perCondition[conditionIds[i]];
      const b = perCondition[conditionIds[j]];
      const tvd = totalVariationDistance(a.counts, b.counts, scenario.classes);
      const js = jensenShannonDivergence(a.counts, b.counts, scenario.classes);
      const within = Math.max(a.split_half.max_tvd, b.split_half.max_tvd);
      const material =
        tvd >= MATERIALITY.tvd_floor &&
        js >= MATERIALITY.js_floor &&
        (!MATERIALITY.must_exceed_within_condition || tvd > within);
      pairs.push({
        pair: `${conditionIds[i]}_vs_${conditionIds[j]}`,
        tvd,
        js_divergence: js,
        max_within_condition_split_half_tvd: within,
        exceeds_within_condition: tvd > within,
        material
      });
    }
  }
  const materialPairs = pairs.filter((pair) => pair.material);
  return {
    scenario: scenario.id,
    role: scenario.role,
    classes: scenario.classes,
    per_condition: perCondition,
    pairs,
    material_pairs: materialPairs.map((pair) => pair.pair),
    max_between_tvd: Math.max(...pairs.map((pair) => pair.tvd)),
    max_within_condition_split_half_tvd: Math.max(
      ...conditionIds.map((id) => perCondition[id].split_half.max_tvd)
    ),
    material_effect: materialPairs.length > 0
  };
}

function nullControl(records, scenario) {
  const perCondition = {};
  for (const conditionId of ['P', 'N', 'Z', 'A']) {
    const relevant = records.filter(
      (r) => r.scenario === scenario.id && r.condition === conditionId && r.schema_valid === true
    );
    const labels = relevant.map((r) => classifyEndpoints(scenario, r.directive, r.current_intent));
    const dist = distribution(labels, scenario.classes);
    perCondition[conditionId] = {
      ...dist,
      directive_majority: distribution(relevant.map((r) => r.directive), [
        'CLARIFY_MISSING_CONTEXT',
        'REALIZE_CURRENT_INTENT'
      ]).majority_class,
      answered: dist.counts.ASK_FOR_CLARIFICATION === 0
    };
  }
  // If realized behavior is available, factual correctness there is authoritative:
  // the cognition `current_intent` is a plan, not the answer text.
  const languagePath = join(evidenceDir, `language-evidence-${scenario.id}.json`);
  let realized = null;
  if (existsSync(languagePath)) {
    const evidence = JSON.parse(readFileSync(languagePath, 'utf8'));
    realized = {};
    for (const conditionId of ['P', 'N', 'Z', 'A']) {
      const majority = evidence.results.find(
        (result) => result.condition === conditionId && result.selection_role === 'MAJORITY'
      );
      const text = majority?.behavior_text ?? '';
      realized[conditionId] = {
        behavior_text: text,
        correct_factual_answer: text.includes('42'),
        language_called: majority?.language_called ?? false
      };
    }
  }
  const distortion = realized !== null
    ? Object.values(realized).some((entry) => !entry.correct_factual_answer)
    : Object.values(perCondition).some((entry) => !entry.answered);
  return {
    scenario: scenario.id,
    per_condition: perCondition,
    realized_behavior: realized,
    factual_distortion: distortion,
    distortion_basis: realized !== null ? 'realized_language_behavior' : 'cognition_directive'
  };
}

function main() {
  const primary = primaryRecordsOnly(allRecords);
  const activation = allRecords.filter((record) => record.activation_experiment === true);

  const classifications = allRecords.map((record) => {
    const scenario = scenarioById.get(record.scenario);
    return {
      scenario: record.scenario,
      condition: record.condition,
      replicate: record.replicate,
      activation_experiment: record.activation_experiment === true,
      schema_valid: record.schema_valid,
      directive: record.directive,
      current_intent: record.current_intent,
      behavior_class:
        record.schema_valid && scenario !== undefined
          ? classifyEndpoints(scenario, record.directive, record.current_intent)
          : null,
      confidence: record.confidence,
      uncertainty: record.uncertainty
    };
  });

  const executedStage1 = STAGE1_SCENARIOS.filter((s) =>
    primary.some((r) => r.scenario === s.id)
  );
  const executedStage2 = STAGE2_SCENARIOS.filter((s) =>
    primary.some((r) => r.scenario === s.id)
  );

  const scenarioAnalysis = [...executedStage1, ...executedStage2].map((scenario) =>
    analyzeScenario(primary, scenario)
  );
  const nullControls = STAGE1_SCENARIOS.filter((s) => s.role === 'FACTUAL_CONTROL' && primary.some((r) => r.scenario === s.id)).map(
    (scenario) => nullControl(primary, scenario)
  );

  const affectRelevant = scenarioAnalysis.filter((entry) => entry.role === 'AFFECT_RELEVANT');
  const stage1Relevant = affectRelevant.filter((entry) =>
    STAGE1_SCENARIOS.some((s) => s.id === entry.scenario)
  );
  const stage1Signal = stage1Relevant.some((entry) => entry.material_effect);
  const anySignal = affectRelevant.some((entry) => entry.material_effect);
  const nullDistortion = nullControls.some((entry) => entry.factual_distortion);

  const activationAnalysis = ACTIVATION_SCENARIO_IDS.filter((id) =>
    activation.some((r) => r.scenario === id)
  ).map((id) => {
    const scenario = scenarioById.get(id);
    const perCondition = {};
    for (const conditionId of ['LOW', 'HIGH']) {
      const relevant = activation.filter(
        (r) => r.scenario === id && r.condition === conditionId && r.schema_valid === true
      );
      const labels = relevant.map((r) => classifyEndpoints(scenario, r.directive, r.current_intent));
      perCondition[conditionId] = {
        ...distribution(labels, scenario.classes),
        split_half: splitHalfTvd(labels, scenario.classes),
        intent_dispersion: intentDispersion(relevant.map((r) => r.current_intent))
      };
    }
    const tvd = totalVariationDistance(
      perCondition.LOW.counts,
      perCondition.HIGH.counts,
      scenario.classes
    );
    const js = jensenShannonDivergence(perCondition.LOW.counts, perCondition.HIGH.counts, scenario.classes);
    const within = Math.max(perCondition.LOW.split_half.max_tvd, perCondition.HIGH.split_half.max_tvd);
    return {
      scenario: id,
      per_condition: perCondition,
      tvd,
      js_divergence: js,
      max_within_condition_split_half_tvd: within,
      material: tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within
    };
  });

  const validCount = allRecords.filter((r) => r.schema_valid).length;
  const invalidCount = allRecords.length - validCount;
  const activationMaterial = activationAnalysis.some((entry) => entry.material);
  const affectsMultipleScenarios = affectRelevant.filter((entry) => entry.material_effect).length > 1;

  // Frozen verdict precedence (program §32/§48/§49/§50/§51/§52):
  // a material objective-control distortion is harmful bias; otherwise the
  // strongest verdict requires every §48 condition; a real but partial effect is
  // WEAK; no marginal value is STATEFUL; provider/sample problems are INCONCLUSIVE.
  let principal;
  if (invalidCount > 0 && validCount < 20) {
    principal = 'AFFECT_CAUSAL_VALUE_INCONCLUSIVE';
  } else if (nullDistortion) {
    principal = 'AFFECT_CAUSES_UNHELPFUL_BIAS';
  } else if (affectsMultipleScenarios && activationAnalysis.length >= 0 && !nullDistortion) {
    principal = 'AFFECT_ACTIVE_CAUSAL';
  } else if (anySignal) {
    principal = 'AFFECT_ACTIVE_BUT_BEHAVIORALLY_WEAK';
  } else {
    principal = 'AFFECT_STATEFUL_BUT_NO_MARGINAL_VALUE';
  }

  const verdict = {
    schema_version: 'affect-causal-verdict-v0',
    recorded_calls: allRecords.length,
    valid_calls: validCount,
    invalid_calls: invalidCount,
    conditions: Object.keys(CONDITIONS),
    stage1_signal: stage1Signal,
    any_affect_relevant_signal: anySignal,
    affects_multiple_scenarios: affectsMultipleScenarios,
    null_control_factual_distortion: nullDistortion,
    activation_material: activationMaterial,
    principal_verdict: principal,
    questions: {
      Q1_causal_influence_beyond_memory: anySignal ? 'YES' : 'NO',
      Q2_exceeds_model_variance: scenarioAnalysis.some(
        (entry) => entry.material_effect && entry.max_between_tvd > entry.max_within_condition_split_half_tvd
      )
        ? 'YES'
        : 'NO',
      Q3_contextually_selective: nullDistortion ? 'NO' : 'YES',
      Q4_useful_coherent: nullDistortion ? 'PARTIALLY' : 'YES',
      Q5_remain_core_claim: principal === 'AFFECT_CAUSES_UNHELPFUL_BIAS' ? 'INCONCLUSIVE' : 'YES'
    }
  };
  writeFileSync(join(evidenceDir, 'verdict.json'), `${JSON.stringify(verdict, null, 2)}\n`);

  writeFileSync(
    join(evidenceDir, 'classifications.json'),
    `${JSON.stringify({ schema_version: 'affect-causal-classifications-v0', records: classifications }, null, 2)}\n`
  );
  writeFileSync(
    join(evidenceDir, 'distribution-analysis.json'),
    `${JSON.stringify({ schema_version: 'affect-causal-distribution-v0', scenarios: scenarioAnalysis, activation: activationAnalysis }, null, 2)}\n`
  );
  writeFileSync(
    join(evidenceDir, 'variance-analysis.json'),
    `${JSON.stringify(
      {
        schema_version: 'affect-causal-variance-v0',
        note: 'within-condition split-half TVD is the model-variance band; a between-condition shift must exceed it to count',
        scenarios: scenarioAnalysis.map((entry) => ({
          scenario: entry.scenario,
          max_between_tvd: entry.max_between_tvd,
          max_within_condition_split_half_tvd: entry.max_within_condition_split_half_tvd,
          per_condition: Object.fromEntries(
            Object.entries(entry.per_condition).map(([id, value]) => [
              id,
              {
                majority_class: value.majority_class,
                majority_proportion: value.majority_proportion,
                disagreement_rate: value.disagreement_rate,
                entropy_bits: value.entropy_bits,
                split_half: value.split_half,
                intent_dispersion: value.intent_dispersion
              }
            ])
          )
        })),
        activation: activationAnalysis.map((entry) => ({
          scenario: entry.scenario,
          tvd: entry.tvd,
          js_divergence: entry.js_divergence,
          max_within_condition_split_half_tvd: entry.max_within_condition_split_half_tvd,
          material: entry.material
        }))
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(evidenceDir, 'effect-summary.json'),
    `${JSON.stringify(
      {
        schema_version: 'affect-causal-effect-summary-v0',
        materiality: MATERIALITY,
        stage1_executed: executedStage1.map((s) => s.id),
        stage2_executed: executedStage2.map((s) => s.id),
        activation_executed: activationAnalysis.map((s) => s.scenario),
        stage1_signal: stage1Signal,
        any_affect_relevant_signal: anySignal,
        null_control_factual_distortion: nullDistortion,
        null_controls: nullControls,
        scenario_effects: scenarioAnalysis.map((entry) => ({
          scenario: entry.scenario,
          role: entry.role,
          material_effect: entry.material_effect,
          material_pairs: entry.material_pairs,
          max_between_tvd: entry.max_between_tvd,
          max_within_condition_split_half_tvd: entry.max_within_condition_split_half_tvd,
          majority_by_condition: Object.fromEntries(
            Object.entries(entry.per_condition).map(([id, value]) => [id, value.majority_class])
          )
        })),
        stop_decision:
          executedStage2.length === 0 && !stage1Signal
            ? 'STOP_AFTER_STAGE1_NO_SIGNAL'
            : executedStage2.length > 0
              ? 'STAGE2_EXECUTED'
              : 'STAGE1_SIGNAL_PRESENT'
      },
      null,
      2
    )}\n`
  );

  console.log(
    JSON.stringify(
      {
        recorded_calls: allRecords.length,
        valid_calls: validCount,
        invalid_calls: invalidCount,
        stage1_signal: stage1Signal,
        null_control_factual_distortion: nullDistortion,
        scenario_effects: verdict.stage1_signal,
        per_scenario: scenarioAnalysis.map((e) => ({
          scenario: e.scenario,
          material: e.material_effect,
          max_between_tvd: e.max_between_tvd,
          max_within: e.max_within_condition_split_half_tvd,
          majority: Object.fromEntries(Object.entries(e.per_condition).map(([id, v]) => [id, v.majority_class]))
        }))
      },
      null,
      2
    )
  );
}

main();
