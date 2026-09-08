/* eslint-disable no-restricted-imports -- Isolated experiment host over frozen built provider/runtime roots. */
/** Real-provider execution and machine-only structured analysis for V1. */

import {
  LlmCognitionProviderV0,
  LlmCognitionRejectionErrorV0,
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  ModelTransportErrorV0,
  OllamaNativeCognitionTransportV0,
  type ModelTransportResponseV0,
  type ModelTransportTraceV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";
import {
  ARMS,
  BALANCED_ORDER,
  EXPERIMENT_VERSION,
  MAGNITUDES,
  PLANNED_PRIMARY_CALLS,
  PRIMARY_PROVIDER,
  SCENARIOS,
  TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE,
  VERDICT_RULE,
  type Arm
} from "./contract.ts";
import {
  actionIntentDistance,
  actionLabel,
  cognitionContentDistance,
  cognitionEndpoints,
  distribution,
  endpointDisagreements,
  fullOutputDistance,
  providerInputHash,
  type CognitionEndpoints
} from "./metrics.ts";
import { check, hashJson } from "./fixtures.ts";
import type { PhaseAResult, PreparedCell } from "./phase-a.ts";

export type TrialStatus =
  | "VALID"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_SCHEMA"
  | "VALIDATION_REJECTED"
  | "STALE"
  | "OTHER_RUNTIME_FAILURE";

export interface LocalModelProbe {
  readonly name: string;
  readonly model: string;
  readonly digest: string;
  readonly size: number | null;
  readonly parameter_size: string | null;
  readonly quantization_level: string | null;
  readonly context_length: number | null;
  readonly family: string | null;
  readonly capabilities: readonly string[];
}

export interface ProviderPreflight {
  readonly schema_version: "canonical-affect-behavior-influence-replication-provider-preflight-v1";
  readonly endpoint: string;
  readonly checked_at: string;
  readonly reachable: boolean;
  readonly server_version: string | null;
  readonly primary_model: LocalModelProbe | null;
  readonly primary_model_available: boolean;
  readonly primary_digest_matches_v0: boolean;
  readonly secondary_status: "AVAILABLE" | "SECOND_MODEL_UNAVAILABLE";
  readonly secondary_model: LocalModelProbe | null;
  readonly selected_models: readonly string[];
  readonly local_models: readonly LocalModelProbe[];
  readonly failure: string | null;
}

export interface TrialFailure {
  readonly name: string;
  readonly code: string | null;
  readonly http_status: number | null;
  readonly detail_ref: string | null;
  readonly message: string;
}

export interface TrialRecord {
  readonly experiment_version: typeof EXPERIMENT_VERSION;
  readonly scenario_id: string;
  readonly magnitude_id: string;
  readonly model_id: string;
  readonly arm: Arm;
  readonly trial_id: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
  readonly projection_hash: string;
  readonly provider_input_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly subject_state_hash: string;
  readonly provider_settings: Record<string, unknown>;
  readonly raw_final_response: {
    readonly content: string;
    readonly content_hash: string;
    readonly bytes: number;
    readonly response_model: string;
  } | null;
  readonly validated_cognition_proposal: Record<string, unknown> | null;
  readonly endpoints: CognitionEndpoints | null;
  readonly status: TrialStatus;
  readonly failure_classification: TrialStatus | null;
  readonly validation_subreason: string | null;
  readonly provider_response_obtained: boolean;
  readonly failure: TrialFailure | null;
  readonly latency_ms: number;
  readonly token_counts: {
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
  };
  readonly transport_trace: ModelTransportTraceV0 | null;
}

export interface PlannedTrial {
  readonly cell: PreparedCell;
  readonly model_id: string;
  readonly arm: Arm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
}

interface OllamaTagsResponse {
  readonly models?: readonly Record<string, unknown>[];
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

function parseModel(row: Record<string, unknown>): LocalModelProbe {
  const details = row["details"] as Record<string, unknown> | undefined;
  const capabilities = Array.isArray(row["capabilities"])
    ? row["capabilities"].filter((value): value is string => typeof value === "string")
    : [];
  return {
    name: String(row["name"] ?? row["model"] ?? ""),
    model: String(row["model"] ?? row["name"] ?? ""),
    digest: String(row["digest"] ?? ""),
    size: typeof row["size"] === "number" ? row["size"] : null,
    parameter_size: typeof details?.["parameter_size"] === "string" ? details["parameter_size"] : null,
    quantization_level: typeof details?.["quantization_level"] === "string" ? details["quantization_level"] : null,
    context_length: typeof details?.["context_length"] === "number" ? details["context_length"] : null,
    family: typeof details?.["family"] === "string" ? details["family"] : null,
    capabilities
  };
}

function suitableSecondary(model: LocalModelProbe): boolean {
  if (model.name === PRIMARY_PROVIDER.model || model.model === PRIMARY_PROVIDER.model) return false;
  if (!model.capabilities.includes("completion")) return false;
  const identity = `${model.name} ${model.family ?? ""}`.toLowerCase();
  return !identity.includes("embed");
}

/** Read-only local inventory. No model is downloaded or mutated. */
export async function probeProviderEnvironment(): Promise<ProviderPreflight> {
  const checkedAt = new Date().toISOString();
  const base = PRIMARY_PROVIDER.base_url.replace(/\/$/, "");
  try {
    const [versionBody, tagsBody] = await Promise.all([
      readJson(`${base}/api/version`),
      readJson(`${base}/api/tags`)
    ]);
    const version = (versionBody as { version?: unknown }).version;
    const rawModels = (tagsBody as OllamaTagsResponse).models ?? [];
    const models = rawModels.map(parseModel).sort((a, b) => a.name.localeCompare(b.name));
    const primary = models.find((model) => model.name === PRIMARY_PROVIDER.model || model.model === PRIMARY_PROVIDER.model) ?? null;
    const secondary = models.find(suitableSecondary) ?? null;
    return {
      schema_version: "canonical-affect-behavior-influence-replication-provider-preflight-v1",
      endpoint: base,
      checked_at: checkedAt,
      reachable: true,
      server_version: typeof version === "string" ? version : null,
      primary_model: primary,
      primary_model_available: primary !== null,
      primary_digest_matches_v0: primary?.digest === PRIMARY_PROVIDER.v0_digest,
      secondary_status: secondary === null ? "SECOND_MODEL_UNAVAILABLE" : "AVAILABLE",
      secondary_model: secondary,
      selected_models: primary === null ? [] : [primary.name, ...(secondary === null ? [] : [secondary.name])],
      local_models: models,
      failure: primary === null ? `required primary model ${PRIMARY_PROVIDER.model} is absent` : null
    };
  } catch (error) {
    return {
      schema_version: "canonical-affect-behavior-influence-replication-provider-preflight-v1",
      endpoint: base,
      checked_at: checkedAt,
      reachable: false,
      server_version: null,
      primary_model: null,
      primary_model_available: false,
      primary_digest_matches_v0: false,
      secondary_status: "SECOND_MODEL_UNAVAILABLE",
      secondary_model: null,
      selected_models: [],
      local_models: [],
      failure: error instanceof Error ? error.message : String(error)
    };
  }
}

function classifyFailure(error: unknown): TrialStatus {
  if (error instanceof ModelTransportErrorV0) return error.code === "MODEL_TIMEOUT" ? "TIMEOUT" : "PROVIDER_ERROR";
  if (error instanceof LlmCognitionRejectionErrorV0) {
    if (error.code === "MODEL_MALFORMED_JSON" || error.code === "MODEL_SCHEMA_INVALID") return "INVALID_SCHEMA";
    if (error.code === "MODEL_PROJECTION_MISMATCH") return "STALE";
    return "VALIDATION_REJECTED";
  }
  return "OTHER_RUNTIME_FAILURE";
}

function failureRecord(error: unknown): TrialFailure {
  const row = error as { name?: unknown; code?: unknown; http_status?: unknown; detail_ref?: unknown; message?: unknown };
  return {
    name: typeof row.name === "string" ? row.name : "UnknownError",
    code: typeof row.code === "string" ? row.code : null,
    http_status: typeof row.http_status === "number" ? row.http_status : null,
    detail_ref: typeof row.detail_ref === "string" ? row.detail_ref : null,
    message: (typeof row.message === "string" ? row.message : String(error)).slice(0, 2048)
  };
}

function settings(modelId: string): Record<string, unknown> {
  return {
    provider: PRIMARY_PROVIDER.provider,
    model: modelId,
    temperature: PRIMARY_PROVIDER.temperature,
    seed: PRIMARY_PROVIDER.seed,
    seed_policy: PRIMARY_PROVIDER.seed_policy,
    think: PRIMARY_PROVIDER.think,
    stream: PRIMARY_PROVIDER.stream,
    format: PRIMARY_PROVIDER.format,
    num_predict: PRIMARY_PROVIDER.num_predict,
    timeout_ms: PRIMARY_PROVIDER.timeout_ms,
    retries: PRIMARY_PROVIDER.retries
  };
}

export function buildExecutionPlan(phaseA: PhaseAResult, modelIds: readonly string[]): readonly PlannedTrial[] {
  const plan: PlannedTrial[] = [];
  let order = 0;
  for (const modelId of modelIds) {
    for (const scenario of SCENARIOS) {
      for (const magnitude of MAGNITUDES) {
        const cell = phaseA.prepared.find((item) =>
          item.scenario.scenario_id === scenario.scenario_id && item.magnitude.magnitude_id === magnitude.magnitude_id
        );
        check(cell !== undefined, `${scenario.scenario_id}/${magnitude.magnitude_id}: prepared cell missing`);
        for (let ordinal = 1; ordinal <= TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE; ordinal += 1) {
          const armOrder = BALANCED_ORDER[(ordinal - 1) % BALANCED_ORDER.length];
          check(armOrder !== undefined, `trial ${ordinal}: balanced order missing`);
          for (let within = 0; within < armOrder.length; within += 1) {
            const arm = armOrder[within];
            check(arm !== undefined, "balanced arm missing");
            order += 1;
            plan.push({
              cell,
              model_id: modelId,
              arm,
              trial_ordinal: ordinal,
              execution_order: order,
              within_unit_order: within + 1,
              trial_id: `${modelId}/${scenario.scenario_id}/${magnitude.magnitude_id}/${ordinal}/${arm}`
            });
          }
        }
      }
    }
  }
  return plan;
}

export async function executeOneRealTrial(item: PlannedTrial): Promise<TrialRecord> {
  let terminalTrace: ModelTransportTraceV0 | null = null;
  let raw: ModelTransportResponseV0 | null = null;
  const transport = new OllamaNativeCognitionTransportV0({
    base_url: PRIMARY_PROVIDER.base_url,
    model: item.model_id,
    timeout_ms: PRIMARY_PROVIDER.timeout_ms,
    num_predict: PRIMARY_PROVIDER.num_predict,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) terminalTrace = structuredClone(event);
    }
  });
  const recordingTransport: ModelTransportV0 = {
    complete: async (request) => {
      const response = await transport.complete(request);
      raw = { ...response };
      return response;
    }
  };
  const provider = new LlmCognitionProviderV0(recordingTransport, { temperature: PRIMARY_PROVIDER.temperature });
  const providerInput = item.cell.provider_inputs[item.arm];
  const sourceArm = item.arm === "ABL_A" ? "A" : item.arm === "ABL_B" ? "B" : item.arm;
  const metadata = item.cell.metadata[item.arm];
  const canonicalAffect = (providerInput as {
    canonical_affect: TrialRecord["canonical_affect"];
    projection_hash: string;
  }).canonical_affect;
  const started = performance.now();
  let proposal: Record<string, unknown> | null = null;
  let status: TrialStatus = "VALID";
  let failure: TrialFailure | null = null;
  let subreason: string | null = null;
  try {
    proposal = structuredClone(await provider.propose(providerInput as never)) as unknown as Record<string, unknown>;
  } catch (error) {
    status = classifyFailure(error);
    failure = failureRecord(error);
    subreason = failure.code;
  }
  const elapsed = Math.round(performance.now() - started);
  const trace = terminalTrace as ModelTransportTraceV0 | null;
  const response = raw as ModelTransportResponseV0 | null;
  const promptTokens = trace?.ollama.prompt_eval_count ?? null;
  const completionTokens = trace?.ollama.eval_count ?? null;
  check(sourceArm === "A" || sourceArm === "B", "source treatment arm resolution failed");
  return {
    experiment_version: EXPERIMENT_VERSION,
    scenario_id: item.cell.scenario.scenario_id,
    magnitude_id: item.cell.magnitude.magnitude_id,
    model_id: item.model_id,
    arm: item.arm,
    trial_id: item.trial_id,
    trial_ordinal: item.trial_ordinal,
    execution_order: item.execution_order,
    within_unit_order: item.within_unit_order,
    canonical_affect: { ...canonicalAffect },
    projection_hash: (providerInput as { projection_hash: string }).projection_hash,
    provider_input_hash: providerInputHash(providerInput),
    current_event_ref: metadata.current_event_ref,
    current_appraisal_ref: metadata.current_appraisal_ref,
    subject_state_hash: metadata.subject_state_hash,
    provider_settings: settings(item.model_id),
    raw_final_response: response === null ? null : {
      content: response.content,
      content_hash: hashJson(response.content),
      bytes: new TextEncoder().encode(response.content).length,
      response_model: response.model
    },
    validated_cognition_proposal: proposal,
    endpoints: proposal === null ? null : cognitionEndpoints(proposal),
    status,
    failure_classification: status === "VALID" ? null : status,
    validation_subreason: subreason,
    provider_response_obtained: response !== null,
    failure,
    latency_ms: trace?.elapsed_ms ?? elapsed,
    token_counts: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens === null || completionTokens === null ? null : promptTokens + completionTokens
    },
    transport_trace: trace
  };
}

type EndpointCounts = Record<keyof CognitionEndpoints, number>;

interface ArmValidity {
  readonly attempted: number;
  readonly provider_responses: number;
  readonly valid: number;
  readonly failed: number;
  readonly model_action_not_allowed: number;
  readonly model_action_not_allowed_rate: number | null;
  readonly other_validation_rejections: number;
  readonly other_validation_rejection_rate: number | null;
  readonly by_status: Readonly<Record<TrialStatus, number>>;
  readonly by_subreason: Readonly<Record<string, number>>;
}

export interface SubsetAnalysis {
  readonly planned_units: number;
  readonly attempted_calls: number;
  readonly valid_calls: number;
  readonly failed_calls: number;
  readonly treatment_valid_pairs: number;
  readonly ablation_valid_pairs: number;
  readonly full_four_arm_valid_units: number;
  readonly primary: {
    readonly treatment_disagreements_all_valid_pairs: number;
    readonly treatment_rate_all_valid_pairs: number | null;
    readonly ablation_disagreements_all_valid_pairs: number;
    readonly ablation_rate_all_valid_pairs: number | null;
    readonly common_full_units: number;
    readonly treatment_disagreements_on_common_units: number;
    readonly treatment_rate_on_common_units: number | null;
    readonly ablation_disagreements_on_common_units: number;
    readonly ablation_rate_on_common_units: number | null;
    readonly treatment_minus_ablation_rate_delta: number | null;
  };
  readonly cognition_content: {
    readonly treatment_disagreements_on_common_units: number;
    readonly treatment_rate_on_common_units: number | null;
    readonly ablation_disagreements_on_common_units: number;
    readonly ablation_rate_on_common_units: number | null;
    readonly treatment_minus_ablation_rate_delta: number | null;
  };
  readonly action_intent: {
    readonly treatment_disagreements_on_common_units: number;
    readonly treatment_rate_on_common_units: number | null;
    readonly ablation_disagreements_on_common_units: number;
    readonly ablation_rate_on_common_units: number | null;
    readonly treatment_minus_ablation_rate_delta: number | null;
    readonly valid_action_distribution_by_arm: Readonly<Record<Arm, Readonly<Record<string, number>>>>;
  };
  readonly endpoint_disagreement_counts: {
    readonly treatment: EndpointCounts;
    readonly ablation: EndpointCounts;
  };
  readonly numeric_pair_differences: {
    readonly treatment: {
      readonly confidence_a_minus_b: ReturnType<typeof distribution>;
      readonly uncertainty_a_minus_b: ReturnType<typeof distribution>;
      readonly reasoning_summary_length_a_minus_b: ReturnType<typeof distribution>;
    };
    readonly ablation: {
      readonly confidence_a_minus_b: ReturnType<typeof distribution>;
      readonly uncertainty_a_minus_b: ReturnType<typeof distribution>;
      readonly reasoning_summary_length_a_minus_b: ReturnType<typeof distribution>;
    };
  };
  readonly action_validity_by_arm: Readonly<Record<Arm, ArmValidity>>;
}

export interface CollectionArtifacts {
  readonly summary: Record<string, unknown>;
  readonly scenario_summary: readonly Record<string, unknown>[];
  readonly magnitude_summary: readonly Record<string, unknown>[];
  readonly failure_summary: Record<string, unknown>;
}

function blankEndpointCounts(): EndpointCounts {
  return { current_intent: 0, confidence: 0, uncertainty: 0, action_intent: 0, reasoning_summary_length: 0 };
}

function addEndpointCounts(target: EndpointCounts, a: CognitionEndpoints, b: CognitionEndpoints): void {
  for (const field of endpointDisagreements(a, b)) target[field] += 1;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function unitKey(trial: TrialRecord): string {
  return `${trial.model_id}\u0000${trial.scenario_id}\u0000${trial.magnitude_id}\u0000${trial.trial_ordinal}`;
}

function pairEndpoints(
  unit: Partial<Record<Arm, TrialRecord>>,
  first: Arm,
  second: Arm
): readonly [CognitionEndpoints, CognitionEndpoints] | null {
  const a = unit[first];
  const b = unit[second];
  if (a?.status !== "VALID" || b?.status !== "VALID" || a.endpoints === null || b.endpoints === null) return null;
  return [a.endpoints, b.endpoints];
}

function actionDistributions(trials: readonly TrialRecord[]): Record<Arm, Record<string, number>> {
  const out = Object.fromEntries(ARMS.map((arm) => [arm, {}])) as Record<Arm, Record<string, number>>;
  for (const trial of trials) {
    if (trial.status !== "VALID" || trial.validated_cognition_proposal === null) continue;
    const label = actionLabel(trial.validated_cognition_proposal);
    out[trial.arm][label] = (out[trial.arm][label] ?? 0) + 1;
  }
  return out;
}

const ALL_STATUSES: readonly TrialStatus[] = [
  "VALID",
  "PROVIDER_ERROR",
  "TIMEOUT",
  "INVALID_SCHEMA",
  "VALIDATION_REJECTED",
  "STALE",
  "OTHER_RUNTIME_FAILURE"
];

function armValidity(trials: readonly TrialRecord[], arm: Arm): ArmValidity {
  const selected = trials.filter((trial) => trial.arm === arm);
  const responses = selected.filter((trial) => trial.provider_response_obtained);
  const actionInvalid = responses.filter((trial) => trial.validation_subreason === "MODEL_ACTION_NOT_ALLOWED").length;
  const otherValidation = responses.filter((trial) =>
    trial.status !== "VALID" &&
    trial.validation_subreason !== "MODEL_ACTION_NOT_ALLOWED" &&
    (trial.status === "INVALID_SCHEMA" || trial.status === "VALIDATION_REJECTED" || trial.status === "STALE")
  ).length;
  const byStatus = Object.fromEntries(ALL_STATUSES.map((status) => [status, selected.filter((trial) => trial.status === status).length])) as Record<TrialStatus, number>;
  const bySubreason: Record<string, number> = {};
  for (const trial of selected) {
    if (trial.validation_subreason !== null) bySubreason[trial.validation_subreason] = (bySubreason[trial.validation_subreason] ?? 0) + 1;
  }
  return {
    attempted: selected.length,
    provider_responses: responses.length,
    valid: byStatus.VALID,
    failed: selected.length - byStatus.VALID,
    model_action_not_allowed: actionInvalid,
    model_action_not_allowed_rate: rate(actionInvalid, responses.length),
    other_validation_rejections: otherValidation,
    other_validation_rejection_rate: rate(otherValidation, responses.length),
    by_status: byStatus,
    by_subreason: bySubreason
  };
}

export function analyzeSubset(trials: readonly TrialRecord[], plannedUnits: number): SubsetAnalysis {
  const units = new Map<string, Partial<Record<Arm, TrialRecord>>>();
  for (const trial of trials) {
    const key = unitKey(trial);
    const unit = units.get(key) ?? {};
    check(unit[trial.arm] === undefined, `${trial.trial_id}: duplicate arm`);
    unit[trial.arm] = trial;
    units.set(key, unit);
  }
  const treatmentEndpointCounts = blankEndpointCounts();
  const ablationEndpointCounts = blankEndpointCounts();
  const treatmentNumeric = { confidence: [] as number[], uncertainty: [] as number[], reasoning: [] as number[] };
  const ablationNumeric = { confidence: [] as number[], uncertainty: [] as number[], reasoning: [] as number[] };
  let treatmentPairs = 0;
  let ablationPairs = 0;
  let fullUnits = 0;
  let treatmentAllDisagreements = 0;
  let ablationAllDisagreements = 0;
  let commonTreatment = 0;
  let commonAblation = 0;
  let cognitionTreatment = 0;
  let cognitionAblation = 0;
  let actionTreatment = 0;
  let actionAblation = 0;
  for (const unit of units.values()) {
    const treatment = pairEndpoints(unit, "A", "B");
    const ablation = pairEndpoints(unit, "ABL_A", "ABL_B");
    if (treatment !== null) {
      treatmentPairs += 1;
      treatmentAllDisagreements += fullOutputDistance(treatment[0], treatment[1]);
      addEndpointCounts(treatmentEndpointCounts, treatment[0], treatment[1]);
      treatmentNumeric.confidence.push(treatment[0].confidence - treatment[1].confidence);
      treatmentNumeric.uncertainty.push(treatment[0].uncertainty - treatment[1].uncertainty);
      treatmentNumeric.reasoning.push(treatment[0].reasoning_summary_length - treatment[1].reasoning_summary_length);
    }
    if (ablation !== null) {
      ablationPairs += 1;
      ablationAllDisagreements += fullOutputDistance(ablation[0], ablation[1]);
      addEndpointCounts(ablationEndpointCounts, ablation[0], ablation[1]);
      ablationNumeric.confidence.push(ablation[0].confidence - ablation[1].confidence);
      ablationNumeric.uncertainty.push(ablation[0].uncertainty - ablation[1].uncertainty);
      ablationNumeric.reasoning.push(ablation[0].reasoning_summary_length - ablation[1].reasoning_summary_length);
    }
    if (treatment !== null && ablation !== null) {
      fullUnits += 1;
      commonTreatment += fullOutputDistance(treatment[0], treatment[1]);
      commonAblation += fullOutputDistance(ablation[0], ablation[1]);
      cognitionTreatment += cognitionContentDistance(treatment[0], treatment[1]);
      cognitionAblation += cognitionContentDistance(ablation[0], ablation[1]);
      actionTreatment += actionIntentDistance(treatment[0], treatment[1]);
      actionAblation += actionIntentDistance(ablation[0], ablation[1]);
    }
  }
  const treatmentCommonRate = rate(commonTreatment, fullUnits);
  const ablationCommonRate = rate(commonAblation, fullUnits);
  const cognitionTreatmentRate = rate(cognitionTreatment, fullUnits);
  const cognitionAblationRate = rate(cognitionAblation, fullUnits);
  const actionTreatmentRate = rate(actionTreatment, fullUnits);
  const actionAblationRate = rate(actionAblation, fullUnits);
  return {
    planned_units: plannedUnits,
    attempted_calls: trials.length,
    valid_calls: trials.filter((trial) => trial.status === "VALID").length,
    failed_calls: trials.filter((trial) => trial.status !== "VALID").length,
    treatment_valid_pairs: treatmentPairs,
    ablation_valid_pairs: ablationPairs,
    full_four_arm_valid_units: fullUnits,
    primary: {
      treatment_disagreements_all_valid_pairs: treatmentAllDisagreements,
      treatment_rate_all_valid_pairs: rate(treatmentAllDisagreements, treatmentPairs),
      ablation_disagreements_all_valid_pairs: ablationAllDisagreements,
      ablation_rate_all_valid_pairs: rate(ablationAllDisagreements, ablationPairs),
      common_full_units: fullUnits,
      treatment_disagreements_on_common_units: commonTreatment,
      treatment_rate_on_common_units: treatmentCommonRate,
      ablation_disagreements_on_common_units: commonAblation,
      ablation_rate_on_common_units: ablationCommonRate,
      treatment_minus_ablation_rate_delta: treatmentCommonRate === null || ablationCommonRate === null ? null : treatmentCommonRate - ablationCommonRate
    },
    cognition_content: {
      treatment_disagreements_on_common_units: cognitionTreatment,
      treatment_rate_on_common_units: cognitionTreatmentRate,
      ablation_disagreements_on_common_units: cognitionAblation,
      ablation_rate_on_common_units: cognitionAblationRate,
      treatment_minus_ablation_rate_delta: cognitionTreatmentRate === null || cognitionAblationRate === null ? null : cognitionTreatmentRate - cognitionAblationRate
    },
    action_intent: {
      treatment_disagreements_on_common_units: actionTreatment,
      treatment_rate_on_common_units: actionTreatmentRate,
      ablation_disagreements_on_common_units: actionAblation,
      ablation_rate_on_common_units: actionAblationRate,
      treatment_minus_ablation_rate_delta: actionTreatmentRate === null || actionAblationRate === null ? null : actionTreatmentRate - actionAblationRate,
      valid_action_distribution_by_arm: actionDistributions(trials)
    },
    endpoint_disagreement_counts: { treatment: treatmentEndpointCounts, ablation: ablationEndpointCounts },
    numeric_pair_differences: {
      treatment: {
        confidence_a_minus_b: distribution(treatmentNumeric.confidence),
        uncertainty_a_minus_b: distribution(treatmentNumeric.uncertainty),
        reasoning_summary_length_a_minus_b: distribution(treatmentNumeric.reasoning)
      },
      ablation: {
        confidence_a_minus_b: distribution(ablationNumeric.confidence),
        uncertainty_a_minus_b: distribution(ablationNumeric.uncertainty),
        reasoning_summary_length_a_minus_b: distribution(ablationNumeric.reasoning)
      }
    },
    action_validity_by_arm: Object.fromEntries(ARMS.map((arm) => [arm, armValidity(trials, arm)])) as Record<Arm, ArmValidity>
  };
}

function scenarioClassification(analysis: SubsetAnalysis): "strong replication" | "weak replication" | "no effect" | "invalid-action dominated" {
  const invalidB = analysis.action_validity_by_arm.B.model_action_not_allowed_rate ?? 0;
  if (invalidB >= 0.5 && analysis.full_four_arm_valid_units < analysis.planned_units / 2) return "invalid-action dominated";
  const delta = analysis.primary.treatment_minus_ablation_rate_delta ?? 0;
  if (delta >= 0.5) return "strong replication";
  if (delta > 0) return "weak replication";
  return "no effect";
}

function actionSpaceShift(primary: SubsetAnalysis, cellRows: readonly Record<string, unknown>[]): Record<string, unknown> {
  const aRate = primary.action_validity_by_arm.A.model_action_not_allowed_rate;
  const bRate = primary.action_validity_by_arm.B.model_action_not_allowed_rate;
  const ablARate = primary.action_validity_by_arm.ABL_A.model_action_not_allowed_rate;
  const ablBRate = primary.action_validity_by_arm.ABL_B.model_action_not_allowed_rate;
  const background = ablARate === null || ablBRate === null ? null : (ablARate + ablBRate) / 2;
  const supportingCells = cellRows.filter((row) => row["s1_like_pattern"] === true).length;
  const sufficient = aRate !== null && bRate !== null && background !== null;
  const supported = sufficient &&
    bRate - aRate >= VERDICT_RULE.action_space_shift_minimum_rate_delta &&
    bRate - background >= VERDICT_RULE.action_space_shift_minimum_rate_delta &&
    supportingCells >= 2;
  return {
    status: sufficient ? (supported ? "SUPPORTED" : "NOT_SUPPORTED") : "INCONCLUSIVE",
    positive_arm_rate: aRate,
    negative_arm_rate: bRate,
    ablated_background_rate: background,
    negative_minus_positive: sufficient ? bRate - aRate : null,
    negative_minus_ablated_background: sufficient ? bRate - background : null,
    supporting_scenario_magnitude_cells: supportingCells,
    secondary_finding: supported ? "VALENCE_ASSOCIATED_ACTION_SPACE_SHIFT" : null
  };
}

function chooseVerdict(
  primary: SubsetAnalysis,
  scenarioRows: readonly Record<string, unknown>[],
  magnitudeRows: readonly Record<string, unknown>[]
): string {
  if (primary.valid_calls === 0 || primary.full_four_arm_valid_units === 0) return "REAL_PROVIDER_UNAVAILABLE";
  const sufficient = primary.full_four_arm_valid_units / primary.planned_units >= VERDICT_RULE.minimum_full_unit_fraction_for_sufficient_trials;
  const delta = primary.primary.treatment_minus_ablation_rate_delta ?? 0;
  const positiveScenarios = scenarioRows.filter((row) => Number(row["primary_rate_delta"] ?? 0) > 0).length;
  const allMagnitudesPositive = magnitudeRows.length > 0 && magnitudeRows.every((row) => Number(row["primary_rate_delta"] ?? 0) > 0);
  if (sufficient &&
      delta >= VERDICT_RULE.full_replication_minimum_rate_delta &&
      positiveScenarios >= VERDICT_RULE.full_replication_minimum_positive_scenarios &&
      allMagnitudesPositive) {
    return "CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED";
  }
  const anyMagnitudeMaterial = magnitudeRows.some((row) => Number(row["primary_rate_delta"] ?? 0) >= VERDICT_RULE.full_replication_minimum_rate_delta);
  if ((delta > 0 && positiveScenarios >= VERDICT_RULE.partial_replication_minimum_positive_scenarios) || anyMagnitudeMaterial) {
    return "CANONICAL_AFFECT_CAUSAL_INFLUENCE_PARTIALLY_REPLICATED";
  }
  return "CANONICAL_AFFECT_CAUSAL_INFLUENCE_NOT_REPLICATED";
}

function numericTokenTotal(trials: readonly TrialRecord[], field: "prompt_tokens" | "completion_tokens" | "total_tokens"): number | null {
  const values = trials.map((trial) => trial.token_counts[field]);
  return values.every((value) => value !== null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
}

/** Produces every required machine-readable aggregate without an LLM judge. */
export function summarizeCollection(
  trials: readonly TrialRecord[],
  phaseA: PhaseAResult,
  preflight: ProviderPreflight
): CollectionArtifacts {
  const modelIds = preflight.selected_models;
  check(modelIds.length > 0, "cannot summarize without a selected primary model");
  const primaryModel = modelIds[0];
  check(primaryModel !== undefined, "primary model selection missing");
  const expectedCalls = PLANNED_PRIMARY_CALLS * modelIds.length;
  check(trials.length === expectedCalls, `expected ${expectedCalls} completed trial records, got ${trials.length}`);
  const modelSummaries = modelIds.map((modelId) => ({
    model_id: modelId,
    analysis: analyzeSubset(
      trials.filter((trial) => trial.model_id === modelId),
      SCENARIOS.length * MAGNITUDES.length * TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE
    )
  }));
  const primarySummary = modelSummaries.find((row) => row.model_id === primaryModel);
  check(primarySummary !== undefined, "primary model summary missing");
  const primary = primarySummary.analysis;
  const scenarioRows = modelIds.flatMap((modelId) => SCENARIOS.map((scenario) => {
    const analysis = analyzeSubset(
      trials.filter((trial) => trial.model_id === modelId && trial.scenario_id === scenario.scenario_id),
      MAGNITUDES.length * TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE
    );
    return {
      model_id: modelId,
      scenario_id: scenario.scenario_id,
      classification: scenarioClassification(analysis),
      primary_rate_delta: analysis.primary.treatment_minus_ablation_rate_delta,
      analysis
    };
  }));
  const magnitudeRows = modelIds.flatMap((modelId) => MAGNITUDES.map((magnitude) => {
    const analysis = analyzeSubset(
      trials.filter((trial) => trial.model_id === modelId && trial.magnitude_id === magnitude.magnitude_id),
      SCENARIOS.length * TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE
    );
    return {
      model_id: modelId,
      magnitude_id: magnitude.magnitude_id,
      target_absolute_valence: magnitude.target_absolute_valence,
      expected_activation: magnitude.expected_final_activation,
      primary_rate_delta: analysis.primary.treatment_minus_ablation_rate_delta,
      analysis
    };
  }));
  const cellRows = modelIds.flatMap((modelId) => SCENARIOS.flatMap((scenario) => MAGNITUDES.map((magnitude) => {
    const selected = trials.filter((trial) =>
      trial.model_id === modelId && trial.scenario_id === scenario.scenario_id && trial.magnitude_id === magnitude.magnitude_id
    );
    const analysis = analyzeSubset(selected, TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE);
    const a = analysis.action_validity_by_arm.A.model_action_not_allowed_rate;
    const b = analysis.action_validity_by_arm.B.model_action_not_allowed_rate;
    const aa = analysis.action_validity_by_arm.ABL_A.model_action_not_allowed_rate;
    const ab = analysis.action_validity_by_arm.ABL_B.model_action_not_allowed_rate;
    const background = aa === null || ab === null ? null : (aa + ab) / 2;
    return {
      model_id: modelId,
      scenario_id: scenario.scenario_id,
      magnitude_id: magnitude.magnitude_id,
      s1_like_pattern: a !== null && b !== null && background !== null && b > a && b > background,
      analysis
    };
  })));
  const primaryScenarioRows = scenarioRows.filter((row) => row.model_id === primaryModel);
  const primaryMagnitudeRows = magnitudeRows.filter((row) => row.model_id === primaryModel);
  const shift = actionSpaceShift(primary, cellRows.filter((row) => row.model_id === primaryModel));
  const verdict = chooseVerdict(primary, primaryScenarioRows, primaryMagnitudeRows);
  const secondModel = modelSummaries[1] ?? null;
  const primaryDelta = primary.primary.treatment_minus_ablation_rate_delta;
  const secondDelta = secondModel?.analysis.primary.treatment_minus_ablation_rate_delta ?? null;
  const modelContradiction = secondModel !== null && primaryDelta !== null && secondDelta !== null && primaryDelta > 0 && secondDelta <= 0;
  const scientificAdjudication = verdict === "CANONICAL_AFFECT_CAUSAL_INFLUENCE_NOT_REPLICATED" || modelContradiction
    ? "GPT6_SCIENTIFIC_ADJUDICATION_RECOMMENDED"
    : "NOT_NEEDED";
  const nextSlice = modelContradiction
    ? "GPT6_READ_ONLY_SCIENTIFIC_ADJUDICATION"
    : verdict === "CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED"
      ? "CANONICAL_AFFECT_ACTION_TENDENCY_MECHANISM_EXPERIMENT_V0"
      : verdict === "CANONICAL_AFFECT_CAUSAL_INFLUENCE_PARTIALLY_REPLICATED"
        ? "CANONICAL_AFFECT_MAGNITUDE_SCENARIO_DEPENDENCE_DIAGNOSIS_V0"
        : "CANONICAL_AFFECT_REPLICATION_CAUSAL_DIAGNOSIS_V0";
  const failureSummary = {
    schema_version: "canonical-affect-behavior-influence-replication-failure-summary-v1",
    experiment_version: EXPERIMENT_VERSION,
    all_models: Object.fromEntries(modelSummaries.map((row) => [row.model_id, row.analysis.action_validity_by_arm])),
    by_scenario_magnitude_model: cellRows,
    s1_anomaly_replication: shift
  };
  const summary: Record<string, unknown> = {
    schema_version: "canonical-affect-behavior-influence-replication-summary-v1",
    experiment_version: EXPERIMENT_VERSION,
    verdict,
    baseline_commit: phaseA.artifacts.phase_a["baseline_commit"],
    v0_reference: {
      verdict: "CANONICAL_AFFECT_CAUSAL_INFLUENCE_SUPPORTED",
      model: "qwen3.5:9b",
      digest: PRIMARY_PROVIDER.v0_digest,
      contrast: "+0.25 vs -0.25; activation 0.348; neutral ablation (0, 0.2)",
      sample: "200 attempted; 190 valid; 10 failed; 40 common four-arm valid",
      primary_result: "treatment 40/40 disagreements vs ablation 0/40",
      action_intent_result: "0/40 treatment action_intent disagreements",
      anomaly: "S1 arm B 10/10 MODEL_ACTION_NOT_ALLOWED; A and ablations 0"
    },
    questions: {
      q1_scenario_replication: verdict === "CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED" ? "SUPPORTED" : verdict === "CANONICAL_AFFECT_CAUSAL_INFLUENCE_PARTIALLY_REPLICATED" ? "PARTIAL" : "NOT_SUPPORTED",
      q2_magnitude_robustness: primaryMagnitudeRows.every((row) => Number(row.primary_rate_delta ?? 0) > 0) ? "SUPPORTED_AT_BOTH_MAGNITUDES" : "MAGNITUDE_DEPENDENT_OR_NOT_SUPPORTED",
      q3_action_propagation: (primary.action_intent.treatment_minus_ablation_rate_delta ?? 0) > 0 || shift["status"] === "SUPPORTED" ? "SUPPORTED_IN_ACTION_SELECTION_OR_VALIDITY" : "NOT_DETECTED_BEYOND_COGNITION_CONTENT",
      q4_model_robustness: secondModel === null ? "SECOND_MODEL_UNAVAILABLE" : modelContradiction ? "MODEL_DEPENDENT" : "SAME_DIRECTION"
    },
    provider_preflight: preflight,
    design: {
      scenarios: SCENARIOS.length,
      magnitudes: MAGNITUDES.length,
      arms: ARMS.length,
      trials_per_arm_scenario_magnitude: TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE,
      selected_models: modelIds,
      planned_calls: expectedCalls,
      order: BALANCED_ORDER
    },
    phase_a: phaseA.artifacts.phase_a,
    sample_size: {
      attempted_calls: trials.length,
      valid_calls: trials.filter((trial) => trial.status === "VALID").length,
      failed_calls: trials.filter((trial) => trial.status !== "VALID").length,
      provider_responses: trials.filter((trial) => trial.provider_response_obtained).length,
      primary_model: {
        planned_units: primary.planned_units,
        treatment_valid_pairs: primary.treatment_valid_pairs,
        ablation_valid_pairs: primary.ablation_valid_pairs,
        full_four_arm_valid_units: primary.full_four_arm_valid_units
      }
    },
    primary_model_id: primaryModel,
    primary_model_analysis: primary,
    model_summaries: modelSummaries,
    s1_anomaly_replication: shift,
    cross_scenario: {
      strong_replication: primaryScenarioRows.filter((row) => row.classification === "strong replication").length,
      weak_replication: primaryScenarioRows.filter((row) => row.classification === "weak replication").length,
      no_effect: primaryScenarioRows.filter((row) => row.classification === "no effect").length,
      invalid_action_dominated: primaryScenarioRows.filter((row) => row.classification === "invalid-action dominated").length
    },
    cross_model: secondModel === null ? { status: "SECOND_MODEL_UNAVAILABLE" } : {
      status: modelContradiction ? "DIRECTION_CONTRADICTION" : "COMPARABLE",
      primary_delta: primaryDelta,
      secondary_model: secondModel.model_id,
      secondary_delta: secondDelta
    },
    restore_controls: phaseA.artifacts.restore_controls,
    v0_anchor: { status: "NOT_RUN", reason: "optional anchor omitted to keep the preregistered replication bounded; primary model digest exactly matches V0" },
    confound_audit: {
      input_isolation: "PASS",
      ablation_identity: "PASS",
      activation_matching: "PASS",
      current_event_and_appraisal_dimensions_matching: "PASS",
      appraisal_provenance_refs: "ARM_SPECIFIC_AS_IN_FROZEN_V0; NOT_PROVIDER_FACING",
      action_space_matching: "PASS",
      prompt_and_settings_matching: "PASS",
      async_hash_regression: "PASS",
      hidden_arm_labels: "PASS",
      condition_specific_retries: "PASS_ZERO_RETRIES"
    },
    production_isolation: "PENDING_FINAL_GIT_AUDIT",
    token_runtime_cost: {
      prompt_tokens: numericTokenTotal(trials, "prompt_tokens"),
      completion_tokens: numericTokenTotal(trials, "completion_tokens"),
      total_tokens: numericTokenTotal(trials, "total_tokens"),
      calls_with_token_metadata: trials.filter((trial) => trial.token_counts.total_tokens !== null).length,
      external_api_cost: 0,
      latency_ms: distribution(trials.map((trial) => trial.latency_ms))
    },
    scientific_adjudication: scientificAdjudication,
    claim_boundary: {
      cognition_causal_influence: primary.cognition_content,
      action_intent_influence: primary.action_intent,
      action_validity_influence: shift,
      scenario_generalization: "bounded to the eight preregistered new scenarios",
      magnitude_robustness: "bounded to lawful final valence magnitudes 0.125 and 0.25",
      model_generalization: secondModel === null ? "not tested; SECOND_MODEL_UNAVAILABLE" : "bounded to independently reported selected local models"
    },
    recommended_next_slice: nextSlice,
    scoring: { llm_as_judge: false, verdict_rule: VERDICT_RULE }
  };
  return {
    summary,
    scenario_summary: scenarioRows,
    magnitude_summary: magnitudeRows,
    failure_summary: failureSummary
  };
}
