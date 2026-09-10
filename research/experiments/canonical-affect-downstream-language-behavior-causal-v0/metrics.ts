import { createHash } from "node:crypto";
import { ARMS, SCENARIOS, VERDICT_RULE, type Arm } from "./contract.ts";
import type { TrialRecord, TrialStatus } from "./real-runner.ts";

export function exactContentHash(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

export interface LanguageMetricsV0 {
  readonly utf8_byte_length: number;
  readonly unicode_code_point_length: number;
  readonly sentence_count: number;
  readonly question_mark_count: number;
  readonly newline_count: number;
  readonly exact_content_hash: string;
}

export function languageMetrics(text: string): LanguageMetricsV0 {
  const sentenceMarks = text.match(/[.!?。！？]+/gu)?.length ?? 0;
  return {
    utf8_byte_length: new TextEncoder().encode(text).length,
    unicode_code_point_length: [...text].length,
    sentence_count: sentenceMarks,
    question_mark_count: text.match(/[?？]/gu)?.length ?? 0,
    newline_count: text.match(/\n/gu)?.length ?? 0,
    exact_content_hash: exactContentHash(text)
  };
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function unitKey(row: TrialRecord): string {
  return `${row.scenario_id}/${row.trial_ordinal}`;
}

interface Unit {
  readonly A?: TrialRecord;
  readonly B?: TrialRecord;
  readonly ABL_A?: TrialRecord;
  readonly ABL_B?: TrialRecord;
}

function unitsOf(rows: readonly TrialRecord[]): ReadonlyMap<string, Unit> {
  const units = new Map<string, Unit>();
  for (const row of rows) {
    const key = unitKey(row);
    const current = units.get(key) ?? {};
    units.set(key, { ...current, [row.arm]: row });
  }
  return units;
}

function allArms(unit: Unit): unit is Required<Unit> {
  return unit.A !== undefined && unit.B !== undefined && unit.ABL_A !== undefined && unit.ABL_B !== undefined;
}

function cognitionValid(row: TrialRecord): boolean {
  return row.cognition.status === "VALID";
}

function behaviorComplete(row: TrialRecord): boolean {
  return row.behavior !== null;
}

function textDiff(a: TrialRecord, b: TrialRecord): boolean {
  return a.behavior?.text !== b.behavior?.text;
}

function intentDiff(a: TrialRecord, b: TrialRecord): boolean {
  return a.cognition.current_intent !== b.cognition.current_intent;
}

function cognitionDiff(a: TrialRecord, b: TrialRecord): boolean {
  return JSON.stringify(a.cognition.validated_cognition_proposal) !==
    JSON.stringify(b.cognition.validated_cognition_proposal);
}

function languageInputDiff(a: TrialRecord, b: TrialRecord): boolean {
  return a.language.input_hash !== b.language.input_hash;
}

function directiveDiff(a: TrialRecord, b: TrialRecord): boolean {
  return a.cognition.communication_directive !== b.cognition.communication_directive;
}

type MediationCell =
  | "INTENT_SAME_BEHAVIOR_SAME"
  | "INTENT_SAME_BEHAVIOR_DIFFERENT"
  | "INTENT_DIFFERENT_BEHAVIOR_SAME"
  | "INTENT_DIFFERENT_BEHAVIOR_DIFFERENT";

function mediationCell(a: TrialRecord, b: TrialRecord): MediationCell {
  const intent = intentDiff(a, b) ? "INTENT_DIFFERENT" : "INTENT_SAME";
  const behavior = textDiff(a, b) ? "BEHAVIOR_DIFFERENT" : "BEHAVIOR_SAME";
  return `${intent}_${behavior}` as MediationCell;
}

function emptyMediation(): Record<MediationCell, number> {
  return {
    INTENT_SAME_BEHAVIOR_SAME: 0,
    INTENT_SAME_BEHAVIOR_DIFFERENT: 0,
    INTENT_DIFFERENT_BEHAVIOR_SAME: 0,
    INTENT_DIFFERENT_BEHAVIOR_DIFFERENT: 0
  };
}

function armValidity(rows: readonly TrialRecord[]): Record<Arm, Record<string, unknown>> {
  return Object.fromEntries(ARMS.map((arm) => {
    const armRows = rows.filter((row) => row.arm === arm);
    const cognitionFailures = armRows.filter((row) => row.cognition.status !== "VALID").length;
    const behaviorFailures = armRows.filter((row) => row.behavior === null).length;
    const byStatus = Object.fromEntries(
      [...new Set<TrialStatus>(armRows.map((row) => row.status))]
        .sort()
        .map((status) => [status, armRows.filter((row) => row.status === status).length])
    );
    return [arm, {
      attempted: armRows.length,
      cognition_valid: armRows.length - cognitionFailures,
      cognition_failed: cognitionFailures,
      behavior_complete: armRows.length - behaviorFailures,
      behavior_failed: behaviorFailures,
      behavior_failure_rate: rate(behaviorFailures, armRows.length),
      by_status: byStatus
    }];
  })) as unknown as Record<Arm, Record<string, unknown>>;
}

function metricMeans(rows: readonly TrialRecord[]): Record<Arm, Record<string, number | null>> {
  const keys: readonly (keyof Omit<LanguageMetricsV0, "exact_content_hash">)[] = [
    "utf8_byte_length",
    "unicode_code_point_length",
    "sentence_count",
    "question_mark_count",
    "newline_count"
  ];
  return Object.fromEntries(ARMS.map((arm) => {
    const values = rows.filter((row) => row.arm === arm && row.behavior_metrics !== null);
    return [arm, Object.fromEntries(keys.map((key) => [
      key,
      values.length === 0
        ? null
        : values.reduce((sum, row) => sum + (row.behavior_metrics?.[key] ?? 0), 0) / values.length
    ]))];
  })) as Record<Arm, Record<string, number | null>>;
}

export interface CollectionArtifacts {
  readonly summary: Record<string, unknown>;
  readonly scenario_summary: readonly Record<string, unknown>[];
  readonly cognition_summary: Record<string, unknown>;
  readonly language_summary: Record<string, unknown>;
  readonly failure_summary: Record<string, unknown>;
}

export function summarizeCollection(rows: readonly TrialRecord[]): CollectionArtifacts {
  const units = [...unitsOf(rows).values()];
  const cognitionFull = units.filter((unit) => allArms(unit) && ARMS.every((arm) => cognitionValid(unit[arm])) ) as Required<Unit>[];
  const complete = cognitionFull.filter((unit) => ARMS.every((arm) => behaviorComplete(unit[arm])));
  const treatmentBehaviorDisagreements = complete.filter((unit) => textDiff(unit.A, unit.B)).length;
  const ablationBehaviorDisagreements = complete.filter((unit) => textDiff(unit.ABL_A, unit.ABL_B)).length;
  const treatmentIntentDisagreements = cognitionFull.filter((unit) => intentDiff(unit.A, unit.B)).length;
  const ablationIntentDisagreements = cognitionFull.filter((unit) => intentDiff(unit.ABL_A, unit.ABL_B)).length;
  const treatmentCognitionDisagreements = cognitionFull.filter((unit) => cognitionDiff(unit.A, unit.B)).length;
  const ablationCognitionDisagreements = cognitionFull.filter((unit) => cognitionDiff(unit.ABL_A, unit.ABL_B)).length;
  const treatmentDirectiveDisagreements = cognitionFull.filter((unit) => directiveDiff(unit.A, unit.B)).length;
  const ablationDirectiveDisagreements = cognitionFull.filter((unit) => directiveDiff(unit.ABL_A, unit.ABL_B)).length;
  const treatmentBehaviorRate = rate(treatmentBehaviorDisagreements, complete.length);
  const ablationBehaviorRate = rate(ablationBehaviorDisagreements, complete.length);
  const behaviorDelta = treatmentBehaviorRate === null || ablationBehaviorRate === null
    ? null
    : treatmentBehaviorRate - ablationBehaviorRate;
  const treatmentIntentRate = rate(treatmentIntentDisagreements, cognitionFull.length);
  const ablationIntentRate = rate(ablationIntentDisagreements, cognitionFull.length);
  const intentDelta = treatmentIntentRate === null || ablationIntentRate === null
    ? null
    : treatmentIntentRate - ablationIntentRate;

  const scenarioSummary = SCENARIOS.map((scenario) => {
    const cognitionSubset = cognitionFull.filter((unit) => unit.A.scenario_id === scenario.scenario_id);
    const subset = complete.filter((unit) => unit.A.scenario_id === scenario.scenario_id);
    const treatment = subset.filter((unit) => textDiff(unit.A, unit.B)).length;
    const ablation = subset.filter((unit) => textDiff(unit.ABL_A, unit.ABL_B)).length;
    const treatmentRate = rate(treatment, subset.length);
    const ablationRate = rate(ablation, subset.length);
    return {
      scenario_id: scenario.scenario_id,
      complete_four_arm_units: subset.length,
      cognition_full_valid_units: cognitionSubset.length,
      treatment_intent_disagreements: cognitionSubset.filter((unit) => intentDiff(unit.A, unit.B)).length,
      treatment_intent_rate: rate(cognitionSubset.filter((unit) => intentDiff(unit.A, unit.B)).length, cognitionSubset.length),
      ablation_intent_disagreements: cognitionSubset.filter((unit) => intentDiff(unit.ABL_A, unit.ABL_B)).length,
      ablation_intent_rate: rate(cognitionSubset.filter((unit) => intentDiff(unit.ABL_A, unit.ABL_B)).length, cognitionSubset.length),
      treatment_behavior_disagreements: treatment,
      treatment_behavior_rate: treatmentRate,
      ablation_behavior_disagreements: ablation,
      ablation_behavior_rate: ablationRate,
      treatment_minus_ablation_delta:
        treatmentRate === null || ablationRate === null ? null : treatmentRate - ablationRate,
      treatment_rate_above_ablation:
        treatmentRate !== null && ablationRate !== null && treatmentRate > ablationRate
    };
  });
  const positiveScenarios = scenarioSummary.filter((row) => row.treatment_rate_above_ablation).length;

  const identicalCognitionInputUnits = cognitionFull.filter((unit) =>
    unit.ABL_A.cognition.provider_input_hash === unit.ABL_B.cognition.provider_input_hash
  );
  const identicalLanguageInputPairs = complete.filter((unit) =>
    unit.ABL_A.language.input_hash !== null &&
    unit.ABL_A.language.input_hash === unit.ABL_B.language.input_hash
  );
  const identicalLanguageOutputDisagreements = identicalLanguageInputPairs.filter((unit) =>
    textDiff(unit.ABL_A, unit.ABL_B)
  ).length;
  const treatmentLanguageInputDisagreements = complete.filter((unit) => languageInputDiff(unit.A, unit.B)).length;
  const ablationLanguageInputDisagreements = complete.filter((unit) => languageInputDiff(unit.ABL_A, unit.ABL_B)).length;

  const treatmentMediation = emptyMediation();
  const ablationMediation = emptyMediation();
  for (const unit of complete) {
    treatmentMediation[mediationCell(unit.A, unit.B)] += 1;
    ablationMediation[mediationCell(unit.ABL_A, unit.ABL_B)] += 1;
  }

  const validity = armValidity(rows);
  const failureRates = ARMS.map((arm) => Number(validity[arm]["behavior_failure_rate"] ?? 0));
  const failureRateRange = failureRates.length === 0 ? 0 : Math.max(...failureRates) - Math.min(...failureRates);
  const sufficient = complete.length >= VERDICT_RULE.minimum_common_complete_behavior_four_arm_units;
  const supported =
    sufficient &&
    behaviorDelta !== null &&
    behaviorDelta >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_delta &&
    positiveScenarios >= VERDICT_RULE.supported_minimum_scenarios_with_treatment_rate_above_ablation &&
    treatmentIntentRate !== null &&
    ablationIntentRate !== null &&
    treatmentIntentRate > ablationIntentRate &&
    failureRateRange <= VERDICT_RULE.maximum_arm_failure_rate_range;
  const confounded =
    failureRateRange > VERDICT_RULE.maximum_arm_failure_rate_range ||
    !sufficient;
  const inputEffectOnly =
    !supported &&
    !confounded &&
    intentDelta !== null &&
    intentDelta >= VERDICT_RULE.input_effect_only_minimum_intent_rate_delta;
  const verdict = confounded
    ? "EXPERIMENT_CONFOUND_DETECTED"
    : supported
      ? "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_CAUSAL_INFLUENCE_SUPPORTED"
      : inputEffectOnly
        ? "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY"
        : "NO_MEASURABLE_LANGUAGE_BEHAVIOR_INFLUENCE_UNDER_V0";

  const cognitionPromptTokens = rows.reduce((sum, row) => sum + (row.cognition.token_counts.prompt_tokens ?? 0), 0);
  const cognitionCompletionTokens = rows.reduce((sum, row) => sum + (row.cognition.token_counts.completion_tokens ?? 0), 0);
  const languageRows = rows.filter((row) => row.language.call_required);
  const languagePromptTokens = languageRows.reduce((sum, row) => sum + (row.language.token_counts.prompt_tokens ?? 0), 0);
  const languageCompletionTokens = languageRows.reduce((sum, row) => sum + (row.language.token_counts.completion_tokens ?? 0), 0);
  const cognitionLatency = rows.reduce((sum, row) => sum + row.cognition.latency_ms, 0);
  const languageLatency = rows.reduce((sum, row) => sum + row.language.latency_ms, 0);

  return {
    summary: {
      schema_version: "canonical-affect-downstream-language-behavior-summary-v0",
      verdict,
      sample_size: {
        planned_four_arm_units: SCENARIOS.length * 5,
        attempted_four_arm_units: units.filter(allArms).length,
        cognition_full_valid_units: cognitionFull.length,
        language_comparable_units: complete.length,
        complete_behavior_four_arm_units: complete.length,
        attempted_cognition_calls: rows.length,
        valid_cognition_calls: rows.filter(cognitionValid).length,
        attempted_language_calls: languageRows.length,
        valid_language_calls: languageRows.filter((row) => row.language.status === "VALID").length,
        clarification_behaviors: rows.filter((row) => row.status === "DIRECTIVE_CLARIFY").length
      },
      behavior_effect: {
        denominator: complete.length,
        treatment_disagreements: treatmentBehaviorDisagreements,
        treatment_rate: treatmentBehaviorRate,
        ablation_disagreements: ablationBehaviorDisagreements,
        ablation_rate: ablationBehaviorRate,
        treatment_minus_ablation_delta: behaviorDelta,
        scenarios_treatment_above_ablation: positiveScenarios
      },
      intent_effect: {
        denominator: cognitionFull.length,
        treatment_disagreements: treatmentIntentDisagreements,
        treatment_rate: treatmentIntentRate,
        ablation_disagreements: ablationIntentDisagreements,
        ablation_rate: ablationIntentRate,
        treatment_minus_ablation_delta: intentDelta
      },
      cognition_effect: {
        denominator: cognitionFull.length,
        treatment_disagreements: treatmentCognitionDisagreements,
        treatment_rate: rate(treatmentCognitionDisagreements, cognitionFull.length),
        ablation_disagreements: ablationCognitionDisagreements,
        ablation_rate: rate(ablationCognitionDisagreements, cognitionFull.length)
      },
      directive_effect: {
        denominator: cognitionFull.length,
        treatment_disagreements: treatmentDirectiveDisagreements,
        treatment_rate: rate(treatmentDirectiveDisagreements, cognitionFull.length),
        ablation_disagreements: ablationDirectiveDisagreements,
        ablation_rate: rate(ablationDirectiveDisagreements, cognitionFull.length)
      },
      mediation_consistency: {
        treatment: treatmentMediation,
        ablation: ablationMediation,
        formal_mediation_claim: false
      },
      causal_decomposition: {
        affect_to_cognition_current_intent: {
          treatment_intent_disagreement_rate: treatmentIntentRate,
          ablation_intent_disagreement_rate: ablationIntentRate
        },
        current_intent_binding_to_language_input: {
          treatment_language_input_disagreements: treatmentLanguageInputDisagreements,
          ablation_language_input_disagreements: ablationLanguageInputDisagreements,
          denominator: complete.length
        },
        language_input_to_behavior_output: {
          treatment_behavior_disagreement_rate: treatmentBehaviorRate,
          ablation_behavior_disagreement_rate: ablationBehaviorRate
        },
        formal_mediation_claim: false
      },
      token_runtime_cost: {
        cognition_prompt_tokens: cognitionPromptTokens,
        cognition_completion_tokens: cognitionCompletionTokens,
        language_prompt_tokens: languagePromptTokens,
        language_completion_tokens: languageCompletionTokens,
        total_tokens: cognitionPromptTokens + cognitionCompletionTokens + languagePromptTokens + languageCompletionTokens,
        cognition_latency_ms: cognitionLatency,
        language_latency_ms: languageLatency,
        total_generation_latency_ms: cognitionLatency + languageLatency,
        external_api_monetary_cost: 0,
        provider: "LOCAL_OLLAMA"
      },
      verdict_rule: VERDICT_RULE,
      arm_validity: validity,
      arm_failure_rate_range: failureRateRange
    },
    scenario_summary: scenarioSummary,
    cognition_summary: {
      schema_version: "canonical-affect-downstream-language-behavior-cognition-summary-v0",
      structured_cognition_treatment_disagreement: { count: treatmentCognitionDisagreements, denominator: cognitionFull.length, rate: rate(treatmentCognitionDisagreements, cognitionFull.length) },
      structured_cognition_ablation_disagreement: { count: ablationCognitionDisagreements, denominator: cognitionFull.length, rate: rate(ablationCognitionDisagreements, cognitionFull.length) },
      treatment_intent_disagreement: { count: treatmentIntentDisagreements, denominator: cognitionFull.length, rate: treatmentIntentRate },
      ablation_intent_disagreement: { count: ablationIntentDisagreements, denominator: cognitionFull.length, rate: ablationIntentRate },
      identical_cognition_input_to_intent_disagreement: {
        count: identicalCognitionInputUnits.filter((unit) => intentDiff(unit.ABL_A, unit.ABL_B)).length,
        denominator: identicalCognitionInputUnits.length,
        rate: rate(identicalCognitionInputUnits.filter((unit) => intentDiff(unit.ABL_A, unit.ABL_B)).length, identicalCognitionInputUnits.length)
      },
      identical_cognition_input_to_structured_cognition_disagreement: {
        count: identicalCognitionInputUnits.filter((unit) => cognitionDiff(unit.ABL_A, unit.ABL_B)).length,
        denominator: identicalCognitionInputUnits.length,
        rate: rate(identicalCognitionInputUnits.filter((unit) => cognitionDiff(unit.ABL_A, unit.ABL_B)).length, identicalCognitionInputUnits.length)
      },
      directive: {
        treatment_disagreement_count: treatmentDirectiveDisagreements,
        ablation_disagreement_count: ablationDirectiveDisagreements,
        denominator: cognitionFull.length
      }
    },
    language_summary: {
      schema_version: "canonical-affect-downstream-language-behavior-language-summary-v0",
      primary_behavior_effect: {
        denominator: complete.length,
        treatment_disagreements: treatmentBehaviorDisagreements,
        treatment_rate: treatmentBehaviorRate,
        ablation_disagreements: ablationBehaviorDisagreements,
        ablation_rate: ablationBehaviorRate,
        delta: behaviorDelta
      },
      identical_language_input_to_output_disagreement: {
        count: identicalLanguageOutputDisagreements,
        denominator: identicalLanguageInputPairs.length,
        rate: rate(identicalLanguageOutputDisagreements, identicalLanguageInputPairs.length)
      },
      language_input_disagreement: {
        denominator: complete.length,
        treatment_count: treatmentLanguageInputDisagreements,
        treatment_rate: rate(treatmentLanguageInputDisagreements, complete.length),
        ablation_count: ablationLanguageInputDisagreements,
        ablation_rate: rate(ablationLanguageInputDisagreements, complete.length)
      },
      deterministic_secondary_metric_means_by_arm: metricMeans(rows),
      exact_text_is_not_semantic_strategy: true
    },
    failure_summary: {
      schema_version: "canonical-affect-downstream-language-behavior-failure-summary-v0",
      by_arm: validity,
      total_rows: rows.length,
      cognition_failures: rows.filter((row) => row.cognition.status !== "VALID").length,
      language_failures: languageRows.filter((row) => row.language.status !== "VALID").length,
      behavior_incomplete: rows.filter((row) => row.behavior === null).length,
      arm_failure_rate_range: failureRateRange
    }
  };
}
