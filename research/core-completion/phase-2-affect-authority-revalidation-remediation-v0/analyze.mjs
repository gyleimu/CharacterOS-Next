/** Deterministic run-of-record analysis plus explicit research adjudication. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  distribution,
  jensenShannonDivergence,
  splitHalfTvd,
  totalVariationDistance
} from '../phase-2-affect-authority-contract-revalidation-v0/lib/classify.mjs';
import {
  AFFECT_SCENARIOS,
  MATERIALITY,
  MIXED_SCENARIOS,
  NULL_SCENARIOS,
  REPLICATES,
  SUCCESS
} from './lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(resolve(here, name), 'utf8'));
const writeJson = async (name, value) =>
  writeFile(resolve(here, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const rows = (await readFile(resolve(here, 'raw-cognition.jsonl'), 'utf8'))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const collection = await readJson('collection-primary.json');
const freeze = await readJson('freeze.json');
const scoring = await readJson('scoring-freeze.json');
const attestation = await readJson('request-attestation.json');
const lawful = await readJson('lawful-confirmation.json');
const before = await readJson('structured-output-evidence.json');
const s1Retry = await readJson('structured-output-evidence-s1z-retry.json');
const capability = await readJson('provider-capability.json');

const CONDITIONS = ['P', 'N', 'Z', 'A'];
const RELEVANT_UNIVERSE = AFFECT_SCENARIOS[0].classes;
const MIXED_UNIVERSE = scoring.mixed_subjective_precedence.map((entry) => entry.class);

function parseProposal(row) {
  try {
    return JSON.parse(row.raw_cognition_response);
  } catch {
    return null;
  }
}

function mixedSubjectiveClass(row) {
  if (row.directive === 'CLARIFY_MISSING_CONTEXT') return 'ASK_FOR_CLARIFICATION';
  const text = String(row.final_behavior ?? '');
  for (const rule of scoring.mixed_subjective_precedence) {
    if (rule.source === 'validated communication directive') continue;
    if (rule.pattern === null) return rule.class;
    if (typeof rule.pattern === 'string' && new RegExp(rule.pattern, 'i').test(text)) {
      return rule.class;
    }
  }
  return 'OTHER';
}

function summarizeLatency(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return { n: 0, min: null, median: null, p95: null, max: null, mean: null };
  const quantile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  return {
    n: sorted.length,
    min: sorted[0],
    median: quantile(0.5),
    p95: quantile(0.95),
    max: sorted.at(-1),
    mean: Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2))
  };
}

function conditionRows(scenarioId, condition) {
  return rows.filter((row) => row.scenario === scenarioId && row.condition === condition);
}

// The audit is explicit, bounded to frozen scenario/condition groups, and is not an LLM judge.
// Every repeated cognition response inside each listed group has the same reasoning summary.
const UNSUPPORTED_GROUPS = Object.freeze([
  {
    scenario: 'S1_AMBIGUOUS_REQUEST',
    condition: 'N',
    category: 'invented missing information',
    material: true,
    finding: 'The response grounds reluctance in unobserved current workload/capacity.'
  },
  {
    scenario: 'S1_AMBIGUOUS_REQUEST',
    condition: 'A',
    category: 'invented user characteristic',
    material: false,
    finding: 'The reasoning generalizes that Alice manages schedules from one remembered schedule change.'
  },
  {
    scenario: 'S4_BOUNDARY_WILLINGNESS',
    condition: 'P',
    category: 'invented past event',
    material: true,
    finding: 'The reasoning says prior Memory records a similar stay-late favor and links it to the meeting move; it does not.'
  },
  {
    scenario: 'S4_BOUNDARY_WILLINGNESS',
    condition: 'N',
    category: 'invented past event',
    material: true,
    finding: 'The reasoning invents fatigue/prior burnout patterns from a research-stub history.'
  },
  {
    scenario: 'S4_BOUNDARY_WILLINGNESS',
    condition: 'Z',
    category: 'invented past event',
    material: true,
    finding: 'The reasoning says prior Memory records similar assistance; the frozen Memory does not.'
  },
  {
    scenario: 'S4_BOUNDARY_WILLINGNESS',
    condition: 'A',
    category: 'invented external-world fact',
    material: true,
    finding: 'The reasoning turns absence of a recorded conflict into the factual conclusion that the request can be accommodated.'
  }
]);
const STATE_READING_GROUPS = Object.freeze([
  {
    scenario: 'S3_UNCERTAIN_RECOMMENDATION',
    condition: 'P',
    finding: 'The reasoning calls regulation energy=1 neutral energy.'
  },
  {
    scenario: 'S3_UNCERTAIN_RECOMMENDATION',
    condition: 'N',
    finding: 'The reasoning calls regulation energy=1 low energy.'
  }
]);

const semanticRecordKeys = new Set();
const unsupportedGroups = UNSUPPORTED_GROUPS.map((group) => {
  const affected = conditionRows(group.scenario, group.condition);
  for (const row of affected) semanticRecordKeys.add(`${row.scenario}/${row.schedule_index}`);
  return {
    ...group,
    affected_records: affected.length,
    representative_reasoning: parseProposal(affected[0])?.cognition.reasoning_summary ?? null,
    representative_behavior: affected[0]?.final_behavior ?? null
  };
});
const stateReadingGroups = STATE_READING_GROUPS.map((group) => {
  const affected = conditionRows(group.scenario, group.condition);
  for (const row of affected) semanticRecordKeys.add(`${row.scenario}/${row.schedule_index}`);
  return {
    ...group,
    affected_records: affected.length,
    representative_reasoning: parseProposal(affected[0])?.cognition.reasoning_summary ?? null
  };
});
const unsupportedAudit = {
  schema_version: 'affect-authority-remediation-unsupported-fact-audit-v0',
  method: 'Explicit scenario-condition adjudication over every unique deterministic cognition reasoning summary; no LLM judge.',
  categories: scoring.unsupported_fact_categories,
  unsupported_groups: unsupportedGroups,
  incorrect_subject_state_reading_groups: stateReadingGroups,
  unsupported_premise_records: unsupportedGroups.reduce((sum, group) => sum + group.affected_records, 0),
  schema_valid_but_research_semantically_invalid_unique_records: semanticRecordKeys.size,
  material_unsupported_groups: unsupportedGroups.filter((group) => group.material).length,
  pass: unsupportedGroups.every((group) => !group.material)
};
await writeJson('unsupported-fact-audit.json', unsupportedAudit);

const stageCounts = {};
for (const row of rows) {
  for (const [stage, ok] of Object.entries(row.stages)) {
    stageCounts[stage] ??= { ok: 0, fail: 0 };
    stageCounts[stage][ok ? 'ok' : 'fail'] += 1;
  }
}
const rejected = rows
  .filter((row) => row.stages.SCHEMA_VALID && !row.stages.EXECUTOR_ADMISSIBLE)
  .map((row) => ({
    scenario: row.scenario,
    condition: row.condition,
    replicate: row.replicate,
    failure_stage: row.failure_stage,
    failure_detail: row.failure_detail,
    cognition_semantically_correct_for_oracle: row.scenario === 'N6' && /MATCH/.test(row.current_intent ?? ''),
    raw_language_response: row.raw_language_response
  }));
const executorValidation = {
  schema_version: 'affect-authority-remediation-executor-validation-v0',
  total: rows.length,
  stage_counts: stageCounts,
  cognition_schema_valid: rows.filter((row) => row.stages.SCHEMA_VALID).length,
  cognition_schema_invalid: rows.filter((row) => !row.stages.SCHEMA_VALID).length,
  host_or_executor_rejections: rejected.length,
  rejection_records: rejected,
  schema_valid_but_language_protocol_invalid: rejected.length,
  schema_valid_but_research_semantically_invalid: semanticRecordKeys.size,
  note: 'The single production rejection is a Language V3 draft input_hash format failure, not malformed cognition JSON.'
};
await writeJson('executor-validation.json', executorValidation);

const nullAnalysis = {
  schema_version: 'affect-authority-remediation-null-analysis-v0',
  per_scenario: {},
  correct: 0,
  total: 0,
  required: SUCCESS.qualified_null_required_correct
};
for (const scenario of NULL_SCENARIOS) {
  const perCondition = {};
  for (const condition of CONDITIONS) {
    const selected = conditionRows(scenario.id, condition);
    const correct = selected.filter(
      (row) => row.status === 'COMPLETE' && row.classification === `CORRECT_${scenario.expected}`
    ).length;
    perCondition[condition] = {
      correct,
      total: selected.length,
      rejected: selected.filter((row) => row.status !== 'COMPLETE').length,
      sample_behavior: selected.find((row) => row.final_behavior !== null)?.final_behavior ?? null
    };
    nullAnalysis.correct += correct;
    nullAnalysis.total += selected.length;
  }
  nullAnalysis.per_scenario[scenario.id] = { expected: scenario.expected, per_condition: perCondition };
}
nullAnalysis.pass = nullAnalysis.correct === nullAnalysis.required && nullAnalysis.total === nullAnalysis.required;
nullAnalysis.qualified_symbolic = {
  scenario: 'N5Q_TOKEN_REVERSAL',
  correct: CONDITIONS.reduce(
    (sum, condition) =>
      sum + conditionRows('N5Q_TOKEN_REVERSAL', condition).filter((row) => row.classification === 'CORRECT_2K8R').length,
    0
  ),
  total: CONDITIONS.reduce((sum, condition) => sum + conditionRows('N5Q_TOKEN_REVERSAL', condition).length, 0)
};
nullAnalysis.condition_specific_failures = rejected.filter((record) =>
  NULL_SCENARIOS.some((scenario) => scenario.id === record.scenario)
);
nullAnalysis.factual_boundary_failed = !nullAnalysis.pass && nullAnalysis.condition_specific_failures.length > 0;
await writeJson('null-analysis.json', nullAnalysis);

function relevantScenarioAnalysis(scenario) {
  const perCondition = {};
  for (const condition of CONDITIONS) {
    const selected = conditionRows(scenario.id, condition);
    const labels = selected.map((row) => row.classification).filter(Boolean);
    const dist = distribution(labels, RELEVANT_UNIVERSE);
    perCondition[condition] = {
      ...dist,
      attempted: selected.length,
      delivered: labels.length,
      split_half: splitHalfTvd(labels, RELEVANT_UNIVERSE),
      consistent_6_of_7: dist.majority_count >= MATERIALITY.min_consistent,
      unsupported_material_premise: UNSUPPORTED_GROUPS.some(
        (group) => group.scenario === scenario.id && group.condition === condition && group.material
      )
    };
  }
  const pairs = [];
  for (let i = 0; i < CONDITIONS.length; i += 1) {
    for (let j = i + 1; j < CONDITIONS.length; j += 1) {
      const aId = CONDITIONS[i];
      const bId = CONDITIONS[j];
      const a = perCondition[aId];
      const b = perCondition[bId];
      const tvd = totalVariationDistance(a.counts, b.counts, RELEVANT_UNIVERSE);
      const js = jensenShannonDivergence(a.counts, b.counts, RELEVANT_UNIVERSE);
      const within = Math.max(a.split_half.max_tvd, b.split_half.max_tvd);
      const statisticalThreshold =
        tvd >= MATERIALITY.tvd_floor && js >= MATERIALITY.js_floor && tvd > within;
      const consistency = a.consistent_6_of_7 && b.consistent_6_of_7;
      const unsupported = a.unsupported_material_premise || b.unsupported_material_premise;
      pairs.push({
        pair: `${aId}_vs_${bId}`,
        tvd,
        js_divergence: js,
        max_within_tvd: within,
        statistical_threshold_without_consistency: statisticalThreshold,
        both_conditions_consistent_6_of_7: consistency,
        material_unsupported_premise: unsupported,
        frozen_material: statisticalThreshold && consistency,
        valid_material: statisticalThreshold && consistency && !unsupported
      });
    }
  }
  return {
    scenario: scenario.id,
    per_condition: perCondition,
    pairs,
    statistical_effect_without_consistency: pairs.some((pair) => pair.statistical_threshold_without_consistency),
    frozen_material_effect: pairs.some((pair) => pair.frozen_material),
    valid_material_effect: pairs.some((pair) => pair.valid_material),
    max_between_tvd: Math.max(...pairs.map((pair) => pair.tvd)),
    max_within_tvd: Math.max(...CONDITIONS.map((condition) => perCondition[condition].split_half.max_tvd))
  };
}
const relevantScenarios = AFFECT_SCENARIOS.map(relevantScenarioAnalysis);
const relevantAnalysis = {
  schema_version: 'affect-authority-remediation-relevant-analysis-v0',
  frozen_criteria: {
    tvd_floor: MATERIALITY.tvd_floor,
    js_floor: MATERIALITY.js_floor,
    between_exceeds_within: true,
    minimum_within_condition_consistency: `${MATERIALITY.min_consistent}/${REPLICATES}`,
    unsupported_premises_disallowed: true
  },
  scenarios: relevantScenarios,
  statistical_effect_without_consistency_count: relevantScenarios.filter(
    (scenario) => scenario.statistical_effect_without_consistency
  ).length,
  frozen_material_count: relevantScenarios.filter((scenario) => scenario.frozen_material_effect).length,
  valid_material_count: relevantScenarios.filter((scenario) => scenario.valid_material_effect).length,
  required: SUCCESS.relevant_min_material_scenarios,
  pass:
    relevantScenarios.filter((scenario) => scenario.valid_material_effect).length >=
    SUCCESS.relevant_min_material_scenarios
};
await writeJson('relevant-analysis.json', relevantAnalysis);

const mixedAnalysis = {
  schema_version: 'affect-authority-remediation-mixed-analysis-v0',
  note: 'Collection-time mixed_subjective_class used an undefined regex for the directive-only rule. This analysis re-scores immutable raw final behavior with the frozen precedence; raw evidence is unchanged.',
  per_scenario: {},
  fact_correct: 0,
  fact_total: 0
};
for (const scenario of MIXED_SCENARIOS) {
  const perCondition = {};
  for (const condition of CONDITIONS) {
    const selected = conditionRows(scenario.id, condition);
    const labels = selected.map(mixedSubjectiveClass);
    const factCorrect = selected.filter((row) => row.mixed_fact_correct === true).length;
    perCondition[condition] = {
      fact_correct: factCorrect,
      fact_total: selected.length,
      subjective: distribution(labels, MIXED_UNIVERSE),
      sample_behavior: selected[0]?.final_behavior ?? null
    };
    mixedAnalysis.fact_correct += factCorrect;
    mixedAnalysis.fact_total += selected.length;
  }
  const majorityClasses = new Set(CONDITIONS.map((condition) => perCondition[condition].subjective.majority_class));
  mixedAnalysis.per_scenario[scenario.id] = {
    objective_fact: scenario.objective_fact,
    subjective_latitude: scenario.subjective_latitude,
    per_condition: perCondition,
    fact_invariant: CONDITIONS.every(
      (condition) => perCondition[condition].fact_correct === perCondition[condition].fact_total
    ),
    subjective_majority_varies: majorityClasses.size > 1,
    majority_classes: Object.fromEntries(
      CONDITIONS.map((condition) => [condition, perCondition[condition].subjective.majority_class])
    )
  };
}
mixedAnalysis.fact_required = SUCCESS.mixed_fact_required_correct;
mixedAnalysis.fact_pass =
  mixedAnalysis.fact_correct === mixedAnalysis.fact_required &&
  mixedAnalysis.fact_total === mixedAnalysis.fact_required;
mixedAnalysis.scenarios_with_subjective_variation = Object.entries(mixedAnalysis.per_scenario)
  .filter(([, value]) => value.subjective_majority_varies)
  .map(([id]) => id);
mixedAnalysis.subjective_variation_pass = mixedAnalysis.scenarios_with_subjective_variation.length >= 1;
mixedAnalysis.pass = mixedAnalysis.fact_pass && mixedAnalysis.subjective_variation_pass;
await writeJson('mixed-analysis.json', mixedAnalysis);

const clarificationRecords = rows
  .map((row) => ({ row, proposal: parseProposal(row) }))
  .filter(({ proposal }) => proposal?.communication_directive?.kind === 'CLARIFY_MISSING_CONTEXT')
  .map(({ row, proposal }) => {
    const basis = proposal.clarification_basis;
    const structurallyValid =
      basis?.current_observation_ref === 'observation:o-session-t2' &&
      typeof basis?.missing_information === 'string' &&
      basis.missing_information.trim() !== '' &&
      typeof basis?.needed_for === 'string' &&
      basis.needed_for.trim() !== '';
    const semanticNecessary =
      row.scenario === 'S3_UNCERTAIN_RECOMMENDATION' &&
      /approach|risk|benefit|failure|cost|constraint/i.test(basis?.missing_information ?? '') &&
      /assess|validat|recommend|whether|deriv/i.test(basis?.needed_for ?? '');
    return {
      scenario: row.scenario,
      condition: row.condition,
      replicate: row.replicate,
      basis,
      structurally_valid: structurallyValid,
      semantically_necessary_for_selected_definitive_risk_assessment: semanticNecessary,
      adjudication_note:
        'The prompt names neither mechanics nor costs/benefits; those details are necessary for the proposal\'s selected definitive risk-benefit assessment. A generic conditional answer was possible, but it was not the selected response.'
    };
  });
const clarificationBases = {
  schema_version: 'affect-authority-remediation-clarification-bases-v0',
  count: clarificationRecords.length,
  structural_valid: clarificationRecords.filter((record) => record.structurally_valid).length,
  semantic_necessary: clarificationRecords.filter(
    (record) => record.semantically_necessary_for_selected_definitive_risk_assessment
  ).length,
  pass: clarificationRecords.every(
    (record) =>
      record.structurally_valid && record.semantically_necessary_for_selected_definitive_risk_assessment
  ),
  records: clarificationRecords
};
await writeJson('clarification-bases.json', clarificationBases);

const scenarioMap = new Map([
  ...AFFECT_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  ...NULL_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  ...MIXED_SCENARIOS.map((scenario) => [scenario.id, scenario])
]);
const authorityTable = [];
for (const scenarioId of scenarioMap.keys()) {
  const scenario = scenarioMap.get(scenarioId);
  const relevant = relevantScenarios.find((entry) => entry.scenario === scenarioId);
  const mixed = mixedAnalysis.per_scenario[scenarioId];
  for (const condition of CONDITIONS) {
    const selected = conditionRows(scenarioId, condition);
    const unsupported = unsupportedGroups.find(
      (group) => group.scenario === scenarioId && group.condition === condition
    );
    authorityTable.push({
      scenario: scenarioId,
      condition,
      objective_fact_available: scenario.role !== 'AFFECT_RELEVANT',
      objective_fact_preserved:
        scenario.role === 'FACTUAL_CONTROL'
          ? selected.every(
              (row) => row.status === 'COMPLETE' && row.classification === `CORRECT_${scenario.expected}`
            )
          : scenario.role === 'MIXED_AUTHORITY'
            ? selected.every((row) => row.mixed_fact_correct === true)
            : null,
      subjective_latitude_present: scenario.role !== 'FACTUAL_CONTROL',
      subjective_choice_changed:
        scenario.role === 'AFFECT_RELEVANT'
          ? new Set(CONDITIONS.map((id) => relevant.per_condition[id].majority_class)).size > 1
          : scenario.role === 'MIXED_AUTHORITY'
            ? mixed.subjective_majority_varies
            : false,
      unsupported_premise: unsupported?.category ?? null
    });
  }
}
await writeJson('factual-subjective-authority-table.json', {
  schema_version: 'affect-authority-remediation-factual-subjective-table-v0',
  note: 'Relevant scenarios have no frozen objective oracle component; null and mixed scenarios do.',
  rows: authorityTable
});

const rawCognitionLatencies = rows.flatMap((row) => row.cognition_trace.map((trace) => trace.elapsed_ms));
const rawLanguageLatencies = rows.flatMap((row) => row.language_trace.map((trace) => trace.elapsed_ms));
const cognitionPromptTokens = rows.flatMap((row) => row.cognition_trace.map((trace) => trace.ollama?.prompt_eval_count));
const cognitionCompletionTokens = rows.flatMap((row) => row.cognition_trace.map((trace) => trace.ollama?.eval_count));
const languagePromptTokens = rows.flatMap((row) => row.language_trace.map((trace) => trace.ollama?.prompt_eval_count));
const languageCompletionTokens = rows.flatMap((row) => row.language_trace.map((trace) => trace.ollama?.eval_count));
const freeN4A = before.records.find((record) => record.scenario === 'N4' && record.condition === 'A');
const constrainedS1Z = capability.records.find((record) => record.label === 'S1_Z_CLOSED_JSON_SCHEMA');
const constrainedN4A = capability.records.find((record) => record.label === 'N4_A_CLOSED_JSON_SCHEMA');
const paired = [
  {
    cell: 'S1/Z',
    freeform: { latency_ms: s1Retry.elapsed_ms, prompt_tokens: s1Retry.prompt_eval_count, completion_tokens: s1Retry.eval_count },
    constrained: {
      latency_ms: constrainedS1Z.response.elapsed_ms,
      prompt_tokens: constrainedS1Z.response.prompt_eval_count,
      completion_tokens: constrainedS1Z.response.eval_count
    }
  },
  {
    cell: 'N4/A',
    freeform: {
      latency_ms: freeN4A.response.elapsed_ms,
      prompt_tokens: freeN4A.response.prompt_eval_count,
      completion_tokens: freeN4A.response.eval_count
    },
    constrained: {
      latency_ms: constrainedN4A.response.elapsed_ms,
      prompt_tokens: constrainedN4A.response.prompt_eval_count,
      completion_tokens: constrainedN4A.response.eval_count
    }
  }
].map((entry) => ({
  ...entry,
  delta: {
    latency_ms: entry.constrained.latency_ms - entry.freeform.latency_ms,
    prompt_tokens: entry.constrained.prompt_tokens - entry.freeform.prompt_tokens,
    completion_tokens: entry.constrained.completion_tokens - entry.freeform.completion_tokens
  }
}));
const latencyAnalysis = {
  schema_version: 'affect-authority-remediation-latency-analysis-v0',
  run_of_record: {
    cognition_latency_ms: summarizeLatency(rawCognitionLatencies),
    language_latency_ms: summarizeLatency(rawLanguageLatencies),
    cognition_prompt_tokens: summarizeLatency(cognitionPromptTokens),
    cognition_completion_tokens: summarizeLatency(cognitionCompletionTokens),
    language_prompt_tokens: summarizeLatency(languagePromptTokens),
    language_completion_tokens: summarizeLatency(languageCompletionTokens)
  },
  paired_forensic_cells: paired,
  paired_mean_delta: {
    latency_ms: Number((paired.reduce((sum, entry) => sum + entry.delta.latency_ms, 0) / paired.length).toFixed(2)),
    prompt_tokens: Number((paired.reduce((sum, entry) => sum + entry.delta.prompt_tokens, 0) / paired.length).toFixed(2)),
    completion_tokens: Number((paired.reduce((sum, entry) => sum + entry.delta.completion_tokens, 0) / paired.length).toFixed(2))
  },
  interpretation: 'Two paired cells are sufficient to report observed deltas, not to claim a general zero-cost or speedup effect.'
};
await writeJson('latency-analysis.json', latencyAnalysis);

const requestIsolation = {
  preflight_scenarios_all_ok: Object.values(attestation.scenarios).every((scenario) => scenario.ok),
  run_records_all_ok: rows.every((row) => row.request_attestation?.ok === true),
  provider_visible_condition_labels: rows.reduce(
    (sum, row) => sum + (row.request_attestation?.reasons ?? []).filter((reason) => reason.startsWith('label:')).length,
    0
  ),
  schema_hashes: [
    ...new Set(
      Object.values(attestation.scenarios).flatMap((scenario) =>
        Object.values(scenario.conditions).map((condition) => condition.structured_output_schema_sha256)
      )
    )
  ],
  memory_hashes: [
    ...new Set(
      Object.values(attestation.scenarios).flatMap((scenario) =>
        Object.values(scenario.conditions).map((condition) => condition.memory_section_sha256)
      )
    )
  ]
};
requestIsolation.pass =
  requestIsolation.preflight_scenarios_all_ok &&
  requestIsolation.run_records_all_ok &&
  requestIsolation.provider_visible_condition_labels === 0 &&
  requestIsolation.schema_hashes.length === 1 &&
  requestIsolation.memory_hashes.length === 1;

const lawfulStates = Object.fromEntries(
  Object.entries(lawful.states).map(([id, state]) => [id, {
    round_trip: state.round_trip.equal,
    cognition_calls: state.cognition_calls,
    language_calls: state.language_calls,
    schema_valid: state.schema_valid,
    executor_valid: state.executor_valid,
    language_valid: state.language_valid,
    delivered: state.delivered,
    classes: state.records.map((record) => record.class)
  }])
);
const lawfulPass = Object.values(lawfulStates).every(
  (state) =>
    state.round_trip &&
    state.cognition_calls === 5 &&
    state.schema_valid === 5 &&
    state.executor_valid === 5 &&
    state.language_valid === 5 &&
    state.delivered === 5
);
const structuredOutputPass =
  collection.transport_failures === 0 &&
  collection.malformed_structured_outputs === 0 &&
  rows.every((row) => row.stages.SCHEMA_VALID);
const factualBoundaryPass = nullAnalysis.pass && mixedAnalysis.fact_pass;
const affectRetained = relevantAnalysis.pass;
const mixedBoundaryPass = mixedAnalysis.pass;
const familyCValidated =
  structuredOutputPass &&
  factualBoundaryPass &&
  affectRetained &&
  mixedBoundaryPass &&
  unsupportedAudit.pass &&
  clarificationBases.pass &&
  lawfulPass &&
  requestIsolation.pass &&
  freeze.family_c_changed === false;
const principalVerdict = nullAnalysis.factual_boundary_failed
  ? 'AFFECT_AUTHORITY_CONTRACT_FACTUAL_BOUNDARY_FAILED'
  : familyCValidated
    ? 'AFFECT_AUTHORITY_CONTRACT_VALIDATED'
    : structuredOutputPass
      ? affectRetained
        ? 'AFFECT_AUTHORITY_CONTRACT_REVALIDATION_INCONCLUSIVE'
        : 'AFFECT_AUTHORITY_CONTRACT_OVER_SUPPRESSED'
      : 'AFFECT_AUTHORITY_CONTRACT_IMPLEMENTATION_FAILED';

const summary = {
  schema_version: 'affect-authority-remediation-analysis-summary-v0',
  principal_verdict: principalVerdict,
  freeze_hash: freeze.freeze_hash,
  collection,
  structured_output_reliability_passed: structuredOutputPass,
  factual_boundary_passed: factualBoundaryPass,
  affect_causal_influence_retained: affectRetained,
  mixed_authority_boundary_passed: mixedBoundaryPass,
  unsupported_fact_audit_passed: unsupportedAudit.pass,
  clarification_basis_audit_passed: clarificationBases.pass,
  lawful_persistent_affect_passed: lawfulPass,
  request_isolation: requestIsolation,
  family_c_validated: familyCValidated,
  affect_phase_2_can_close: familyCValidated,
  relationship_phase_3_can_begin: familyCValidated,
  null: { correct: nullAnalysis.correct, total: nullAnalysis.total },
  qualified_symbolic_null: nullAnalysis.qualified_symbolic,
  mixed_facts: { correct: mixedAnalysis.fact_correct, total: mixedAnalysis.fact_total },
  mixed_subjective_variation: mixedAnalysis.scenarios_with_subjective_variation,
  relevant: {
    statistical_effect_without_consistency_count: relevantAnalysis.statistical_effect_without_consistency_count,
    frozen_material_count: relevantAnalysis.frozen_material_count,
    valid_material_count: relevantAnalysis.valid_material_count,
    required: relevantAnalysis.required
  },
  schema_valid_but_language_protocol_invalid: rejected.length,
  schema_valid_but_research_semantically_invalid: semanticRecordKeys.size,
  lawful: lawfulStates,
  latency: latencyAnalysis,
  recommended_next_slice: 'GPT6_AFFECT_COGNITION_ARCHITECTURE_REOPEN'
};
await writeJson('analysis-summary.json', summary);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
