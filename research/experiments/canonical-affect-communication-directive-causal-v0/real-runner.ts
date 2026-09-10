/* eslint-disable no-restricted-imports -- Isolated experiment runner over frozen built production roots; cognition-only, no language calls. */

import { MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0, ModelTransportErrorV0, OllamaNativeCognitionTransportV0, type ModelTransportResponseV0, type ModelTransportTraceV0, type ModelTransportV0 } from "../../../packages/runtime/dist/index.js";
import { ConversationCognitionProviderV1 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js";
import {
  probeProviderEnvironment as probeV1Root
} from "../canonical-affect-behavior-influence-v1/real-runner.ts";
import {
  check,
  hashJson
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";
import {
  BALANCED_ARM_ORDER,
  COGNITION_SETTINGS,
  EXPERIMENT_VERSION,
  PLANNED_COGNITION_CALLS,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO,
  type Arm
} from "./contract.ts";
import type { PhaseAResult, PreparedCell } from "./harness.ts";

export type TrialStatus =
  | "VALID"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_SCHEMA"
  | "VALIDATION_REJECTED"
  | "STALE"
  | "OTHER_RUNTIME_FAILURE";

export interface FailureRecord {
  readonly name: string;
  readonly code: string | null;
  readonly http_status: number | null;
  readonly message: string;
}

export interface TokenCounts {
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
}

export interface PlannedTrial {
  readonly cell: PreparedCell;
  readonly arm: Arm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly response_request_id: string;
}

export interface TrialRecord {
  readonly schema_version: "canonical-affect-communication-directive-trial-v0";
  readonly experiment_version: typeof EXPERIMENT_VERSION;
  readonly scenario_id: string;
  readonly scenario_class: string;
  readonly trial_id: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly arm: Arm;
  readonly response_request_id: string;
  readonly subject_history_id: string;
  readonly canonical_affect: { readonly valence: number; readonly activation: number };
  readonly current_event_hash: string;
  readonly current_appraisal_dimensions: unknown;
  readonly subject_state_hash: string;
  readonly scenario_ingress_proof: { readonly scene_present: boolean; readonly task_present: boolean };
  readonly cognition: {
    readonly status: TrialStatus;
    readonly provider: string;
    readonly model: string;
    readonly settings: Record<string, unknown>;
    readonly provider_input_hash: string;
    readonly projection_hash: string;
    readonly provider_input: unknown;
    readonly raw_response: {
      readonly content: string;
      readonly content_hash: string;
      readonly utf8_bytes: number;
      readonly response_model: string;
    } | null;
    readonly validated_conversation_proposal: Record<string, unknown> | null;
    readonly current_intent: string | null;
    readonly communication_directive: string | null;
    readonly latency_ms: number;
    readonly token_counts: TokenCounts;
    readonly transport_trace: unknown;
    readonly failure: FailureRecord | null;
  };
}

export interface ProviderPreflight {
  readonly schema_version: "canonical-affect-communication-directive-provider-preflight-v0";
  readonly endpoint: string;
  readonly checked_at: string;
  readonly reachable: boolean;
  readonly ollama_version: string | null;
  readonly model: string | null;
  readonly digest: string | null;
  readonly digest_matches_required: boolean;
  readonly parameter_size: string | null;
  readonly quantization_level: string | null;
  readonly cognition_settings: Record<string, unknown>;
  readonly health_check_count: number | null;
  readonly provider_health_stable: boolean | null;
  readonly generation_calls: 0;
  readonly failure: string | null;
}

function frozenSettings(settings: typeof COGNITION_SETTINGS): Record<string, unknown> {
  return {
    provider: settings.provider,
    model: settings.model,
    temperature: settings.temperature,
    think: settings.think,
    stream: settings.stream,
    retries: settings.retries,
    seed: settings.seed,
    num_predict: settings.num_predict,
    timeout_ms: settings.timeout_ms
  };
}

/** §7/§8 — provider environment probe over the frozen transport seam. */
export async function probeProviderEnvironment(): Promise<ProviderPreflight> {
  // The v1 root probe is the single source of truth for server/model truth;
  // intermediate experiment wrappers re-wrap stale contract digests.
  const base = await probeV1Root();
  const upstream = base as unknown as Record<string, unknown>;
  const healthCheckCount = upstream["health_check_count"];
  const providerHealthStable = upstream["provider_health_stable"];
  return {
    schema_version: "canonical-affect-communication-directive-provider-preflight-v0",
    endpoint: base.endpoint,
    checked_at: base.checked_at,
    reachable: base.reachable,
    ollama_version: base.server_version,
    model: base.primary_model?.name ?? null,
    digest: base.primary_model?.digest ?? null,
    digest_matches_required: base.primary_model?.digest === COGNITION_SETTINGS.required_digest,
    parameter_size: base.primary_model?.parameter_size ?? null,
    quantization_level: base.primary_model?.quantization_level ?? null,
    cognition_settings: frozenSettings(COGNITION_SETTINGS),
    health_check_count: typeof healthCheckCount === "number" ? healthCheckCount : null,
    provider_health_stable: typeof providerHealthStable === "boolean" ? providerHealthStable : null,
    generation_calls: 0,
    failure: base.failure
  };
}

export function buildExecutionPlan(phaseA: PhaseAResult): readonly PlannedTrial[] {
  const plan: PlannedTrial[] = [];
  let executionOrder = 0;
  for (let scenarioIndex = 0; scenarioIndex < SCENARIOS.length; scenarioIndex += 1) {
    const scenario = SCENARIOS[scenarioIndex];
    check(scenario !== undefined, "scenario missing");
    const cell = phaseA.prepared.find((candidate) => candidate.scenario.scenario_id === scenario.scenario_id);
    check(cell !== undefined, `${scenario.scenario_id}: prepared cell missing`);
    for (let ordinal = 1; ordinal <= TRIALS_PER_ARM_SCENARIO; ordinal += 1) {
      const order = BALANCED_ARM_ORDER[(ordinal - 1) % BALANCED_ARM_ORDER.length];
      check(order !== undefined, `${scenario.scenario_id}/${ordinal}: arm order missing`);
      for (let within = 0; within < order.length; within += 1) {
        const arm = order[within];
        check(arm !== undefined, "arm missing");
        executionOrder += 1;
        plan.push({
          cell,
          arm,
          trial_ordinal: ordinal,
          execution_order: executionOrder,
          within_unit_order: within + 1,
          trial_id: `${EXPERIMENT_VERSION}/${scenario.scenario_id}/${ordinal}/${arm}`,
          response_request_id: `response-s${scenarioIndex + 1}-t${ordinal}`
        });
      }
    }
  }
  check(plan.length === PLANNED_COGNITION_CALLS, `execution plan must contain ${PLANNED_COGNITION_CALLS} cognition calls`);
  return plan;
}

function failureRecord(error: unknown): FailureRecord {
  const row = error as { name?: unknown; code?: unknown; http_status?: unknown; message?: unknown };
  return {
    name: typeof row.name === "string" ? row.name : "UnknownError",
    code: typeof row.code === "string" ? row.code : null,
    http_status: typeof row.http_status === "number" ? row.http_status : null,
    message: (typeof row.message === "string" ? row.message : String(error)).slice(0, 2048)
  };
}

function classifyCognitionFailure(error: unknown): TrialStatus {
  if (error instanceof ModelTransportErrorV0) {
    return error.code === "MODEL_TIMEOUT" ? "TIMEOUT" : "PROVIDER_ERROR";
  }
  const row = error as { code?: unknown };
  if (row.code === "MODEL_SCHEMA_INVALID") return "INVALID_SCHEMA";
  if (row.code === "PROJECTION_HASH_MISMATCH") return "STALE";
  if (typeof row.code === "string") return "VALIDATION_REJECTED";
  return "OTHER_RUNTIME_FAILURE";
}

function rawRecord(response: ModelTransportResponseV0 | null) {
  return response === null ? null : {
    content: response.content,
    content_hash: hashJson(response.content),
    utf8_bytes: new TextEncoder().encode(response.content).length,
    response_model: response.model
  };
}

function tokenCounts(trace: ModelTransportTraceV0 | null): TokenCounts {
  const prompt = trace?.ollama.prompt_eval_count ?? null;
  const completion = trace?.ollama.eval_count ?? null;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt === null || completion === null ? null : prompt + completion
  };
}

/** Exactly one real cognition call; the directive is the terminal endpoint. */
export async function executeCognitionDirectiveTrial(
  item: PlannedTrial,
  providerInput: unknown
): Promise<TrialRecord> {
  const projection = providerInput as { projection_hash: string; context: { scene: string; task: string } };
  let terminalTrace: ModelTransportTraceV0 | null = null;
  let raw: ModelTransportResponseV0 | null = null;
  const native = new OllamaNativeCognitionTransportV0({
    base_url: COGNITION_SETTINGS.base_url,
    model: COGNITION_SETTINGS.model,
    timeout_ms: COGNITION_SETTINGS.timeout_ms,
    num_predict: COGNITION_SETTINGS.num_predict,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) {
        terminalTrace = structuredClone(event);
      }
    }
  });
  const transport: ModelTransportV0 = {
    complete: async (request) => {
      const response = await native.complete(request);
      raw = { ...response };
      return response;
    }
  };
  const provider = new ConversationCognitionProviderV1(transport);
  const started = performance.now();
  let validated: Record<string, unknown> | null = null;
  let currentIntent: string | null = null;
  let directive: string | null = null;
  let status: TrialStatus = "VALID";
  let failure: FailureRecord | null = null;
  try {
    const proposal = await provider.propose(projection as never);
    validated = structuredClone(proposal) as unknown as Record<string, unknown>;
    currentIntent = proposal.cognition.current_intent;
    directive = proposal.communication_directive.kind;
  } catch (error) {
    status = classifyCognitionFailure(error);
    failure = failureRecord(error);
  }
  // The observer mutates this captured binding during native.complete(); the
  // assertion widens TypeScript's pre-callback null narrowing to its declared type.
  const trace = terminalTrace as ModelTransportTraceV0 | null;
  return {
    schema_version: "canonical-affect-communication-directive-trial-v0",
    experiment_version: EXPERIMENT_VERSION,
    scenario_id: item.cell.scenario.scenario_id,
    scenario_class: item.cell.scenario.scenario_class,
    trial_id: item.trial_id,
    trial_ordinal: item.trial_ordinal,
    execution_order: item.execution_order,
    within_unit_order: item.within_unit_order,
    arm: item.arm,
    response_request_id: item.response_request_id,
    subject_history_id: `${item.cell.scenario.scenario_id}/history-${item.arm === "ABL_A" ? "A" : item.arm === "ABL_B" ? "B" : item.arm}`,
    canonical_affect: { ...(item.cell.provider_inputs[item.arm] as { canonical_affect: { valence: number; activation: number } }).canonical_affect },
    current_event_hash: hashJson(item.cell.scenario.current_factual_event),
    current_appraisal_dimensions: { ...item.cell.metadata[item.arm].current_appraisal_dimensions },
    subject_state_hash: item.cell.metadata[item.arm].subject_state_hash,
    scenario_ingress_proof: {
      scene_present: projection.context.scene === item.cell.scenario.current_factual_event,
      task_present: projection.context.task === item.cell.scenario.current_task
    },
    cognition: {
      status,
      provider: COGNITION_SETTINGS.provider,
      model: COGNITION_SETTINGS.model,
      settings: frozenSettings(COGNITION_SETTINGS),
      provider_input_hash: hashJson(providerInput),
      projection_hash: projection.projection_hash,
      provider_input: providerInput,
      raw_response: rawRecord(raw),
      validated_conversation_proposal: validated,
      current_intent: currentIntent,
      communication_directive: directive,
      latency_ms: trace?.elapsed_ms ?? Math.round(performance.now() - started),
      token_counts: tokenCounts(trace),
      transport_trace: trace,
      failure
    }
  };
}
