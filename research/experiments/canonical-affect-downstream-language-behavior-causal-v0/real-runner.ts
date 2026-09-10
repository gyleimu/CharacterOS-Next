/* eslint-disable no-restricted-imports -- Isolated experiment runner over frozen built production roots. */

import {
  hashEnvelope
} from "../../../packages/subject-core/dist/index.js";
import {
  buildCharacterLanguageBehaviorV0,
  buildClarificationBehaviorV0
} from "../../../packages/behavior/dist/index.js";
import {
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  ModelTransportErrorV0,
  OllamaNativeCognitionTransportV0,
  type ModelTransportResponseV0,
  type ModelTransportTraceV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";
import {
  ConversationCognitionProviderV1
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js";
import {
  LanguageRealizationProviderV0
} from "../../../packages/runtime/dist/providers/behavior/language-realization-provider.js";
import {
  buildLanguageRealizationInputV1,
  type LanguageRealizationInputV2
} from "../../../packages/runtime/dist/transitions/conversation/language-realization-input.js";
import {
  allowedEvidenceSet,
  type CognitiveContextProjectionV2
} from "../../../packages/runtime/dist/transitions/cognition-action/types.js";
import {
  probeProviderEnvironment as probeFrozenProvider
} from "../canonical-affect-action-selection-sensitivity-repair-v0/real-runner.ts";
import {
  check,
  hashJson
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";
import {
  BALANCED_ARM_ORDER,
  COGNITION_SETTINGS,
  EXPERIMENT_VERSION,
  LANGUAGE_SETTINGS,
  PLANNED_COGNITION_CALLS,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO,
  type Arm
} from "./contract.ts";
import type { PhaseAResult, PreparedCell } from "./harness.ts";
import { exactContentHash, languageMetrics, summarizeCollection, type LanguageMetricsV0 } from "./metrics.ts";

export type TrialStatus =
  | "VALID"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_SCHEMA"
  | "VALIDATION_REJECTED"
  | "STALE"
  | "DIRECTIVE_CLARIFY"
  | "LANGUAGE_PROVIDER_ERROR"
  | "LANGUAGE_VALIDATION_REJECTED"
  | "OTHER_RUNTIME_FAILURE";

export interface FailureRecord {
  readonly name: string;
  readonly code: string | null;
  readonly http_status: number | null;
  readonly message: string;
}

export interface RawProviderResponse {
  readonly content: string;
  readonly content_hash: string;
  readonly utf8_bytes: number;
  readonly response_model: string;
}

export interface TokenCounts {
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
}

export interface CognitionStageRecord {
  readonly status: TrialStatus;
  readonly provider: string;
  readonly model: string;
  readonly settings: Record<string, unknown>;
  readonly provider_input_hash: string;
  readonly projection_hash: string;
  readonly provider_input: CognitiveContextProjectionV2;
  readonly raw_response: RawProviderResponse | null;
  readonly validated_conversation_proposal: Record<string, unknown> | null;
  readonly validated_cognition_proposal: Record<string, unknown> | null;
  readonly current_intent: string | null;
  readonly communication_directive: string | null;
  readonly latency_ms: number;
  readonly token_counts: TokenCounts;
  readonly transport_trace: ModelTransportTraceV0 | null;
  readonly failure: FailureRecord | null;
}

export interface LanguageStageRecord {
  readonly call_required: boolean;
  readonly status: "VALID" | "NOT_REQUIRED_CLARIFY" | "NOT_REACHED" | "LANGUAGE_PROVIDER_ERROR" | "LANGUAGE_VALIDATION_REJECTED" | "TIMEOUT";
  readonly provider: string;
  readonly model: string;
  readonly settings: Record<string, unknown>;
  readonly input_schema_version: string | null;
  readonly input_hash: string | null;
  readonly input: LanguageRealizationInputV2 | null;
  readonly cognition_current_intent: string | null;
  readonly language_current_intent: string | null;
  readonly exact_intent_binding: boolean | null;
  readonly raw_response: RawProviderResponse | null;
  readonly validated_draft: Record<string, unknown> | null;
  readonly latency_ms: number;
  readonly token_counts: TokenCounts;
  readonly transport_trace: ModelTransportTraceV0 | null;
  readonly failure: FailureRecord | null;
}

export interface BehaviorRecord {
  readonly schema_version: string;
  readonly behavior_id: string;
  readonly text: string;
  readonly evidence_refs: readonly string[];
}

interface TrialIdentity {
  readonly experiment_version: typeof EXPERIMENT_VERSION;
  readonly scenario_id: string;
  readonly trial_id: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly arm: Arm;
  readonly response_request_id: string;
  readonly subject_history_id: string;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
  readonly current_event_ref: string;
  readonly current_event_hash: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: Record<string, unknown>;
  readonly subject_state_hash: string;
}

export interface InflightRecord extends TrialIdentity {
  readonly checkpoint_schema_version: "canonical-affect-downstream-language-behavior-inflight-v0";
  readonly stage: "COGNITION_COMPLETE";
  readonly cognition: CognitionStageRecord;
}

export interface TrialRecord extends TrialIdentity {
  readonly schema_version: "canonical-affect-downstream-language-behavior-trial-v0";
  readonly cognition: CognitionStageRecord;
  readonly language: LanguageStageRecord;
  readonly behavior: BehaviorRecord | null;
  readonly behavior_content_hash: string | null;
  readonly behavior_metrics: LanguageMetricsV0 | null;
  readonly status: TrialStatus;
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

export interface ProviderPreflight {
  readonly schema_version: "canonical-affect-downstream-language-behavior-provider-preflight-v0";
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
  readonly language_settings: Record<string, unknown>;
  readonly health_check_count: number;
  readonly provider_health_stable: boolean;
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

export async function probeProviderEnvironment(): Promise<ProviderPreflight> {
  const base = await probeFrozenProvider();
  return {
    schema_version: "canonical-affect-downstream-language-behavior-provider-preflight-v0",
    endpoint: base.endpoint,
    checked_at: base.checked_at,
    reachable: base.reachable,
    ollama_version: base.ollama_version,
    model: base.primary_model?.name ?? null,
    digest: base.primary_model?.digest ?? null,
    digest_matches_required: base.primary_model?.digest === COGNITION_SETTINGS.required_digest,
    parameter_size: base.primary_model?.parameter_size ?? null,
    quantization_level: base.primary_model?.quantization_level ?? null,
    cognition_settings: frozenSettings(COGNITION_SETTINGS),
    language_settings: frozenSettings(LANGUAGE_SETTINGS),
    health_check_count: base.health_check_count,
    provider_health_stable: base.provider_health_stable,
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
  check(plan.length === PLANNED_COGNITION_CALLS, "execution plan must contain 120 cognition calls");
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

function classifyLanguageFailure(error: unknown): TrialStatus {
  if (error instanceof ModelTransportErrorV0) {
    return error.code === "MODEL_TIMEOUT" ? "TIMEOUT" : "LANGUAGE_PROVIDER_ERROR";
  }
  const row = error as { name?: unknown };
  if (row.name === "LanguageRealizationRejectionErrorV0") {
    return "LANGUAGE_VALIDATION_REJECTED";
  }
  return "LANGUAGE_PROVIDER_ERROR";
}

function rawRecord(response: ModelTransportResponseV0 | null): RawProviderResponse | null {
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

function identity(item: PlannedTrial): TrialIdentity {
  const projection = item.cell.provider_inputs[item.arm];
  const sourceArm = item.arm === "ABL_A" ? "A" : item.arm === "ABL_B" ? "B" : item.arm;
  const metadata = item.cell.metadata[item.arm];
  return {
    experiment_version: EXPERIMENT_VERSION,
    scenario_id: item.cell.scenario.scenario_id,
    trial_id: item.trial_id,
    trial_ordinal: item.trial_ordinal,
    execution_order: item.execution_order,
    within_unit_order: item.within_unit_order,
    arm: item.arm,
    response_request_id: item.response_request_id,
    subject_history_id: `${item.cell.scenario.scenario_id}/history-${sourceArm}`,
    canonical_affect: { ...projection.canonical_affect },
    current_event_ref: metadata.current_event_ref,
    current_event_hash: hashJson(item.cell.scenario.current_factual_event),
    current_appraisal_ref: metadata.current_appraisal_ref,
    current_appraisal_dimensions: { ...metadata.current_appraisal_dimensions },
    subject_state_hash: metadata.subject_state_hash
  };
}

function makeTransport(stageSettings: typeof COGNITION_SETTINGS): {
  readonly transport: ModelTransportV0;
  trace: () => ModelTransportTraceV0 | null;
  raw: () => ModelTransportResponseV0 | null;
} {
  let terminalTrace: ModelTransportTraceV0 | null = null;
  let raw: ModelTransportResponseV0 | null = null;
  const native = new OllamaNativeCognitionTransportV0({
    base_url: stageSettings.base_url,
    model: stageSettings.model,
    timeout_ms: stageSettings.timeout_ms,
    num_predict: stageSettings.num_predict,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) {
        terminalTrace = structuredClone(event);
      }
    }
  });
  return {
    transport: {
      complete: async (request) => {
        const response = await native.complete(request);
        raw = { ...response };
        return response;
      }
    },
    trace: () => terminalTrace,
    raw: () => raw
  };
}

/** Exactly one real cognition call, then a durable in-flight checkpoint. */
export async function executeCognitionStage(item: PlannedTrial): Promise<InflightRecord> {
  const providerInput = item.cell.provider_inputs[item.arm];
  const recorder = makeTransport(COGNITION_SETTINGS);
  const provider = new ConversationCognitionProviderV1(recorder.transport);
  const started = performance.now();
  let validated: Record<string, unknown> | null = null;
  let cognition: Record<string, unknown> | null = null;
  let currentIntent: string | null = null;
  let directive: string | null = null;
  let status: TrialStatus = "VALID";
  let failure: FailureRecord | null = null;
  try {
    const proposal = await provider.propose(providerInput);
    validated = structuredClone(proposal) as unknown as Record<string, unknown>;
    cognition = structuredClone(proposal.cognition) as unknown as Record<string, unknown>;
    currentIntent = proposal.cognition.current_intent;
    directive = proposal.communication_directive.kind;
  } catch (error) {
    status = classifyCognitionFailure(error);
    failure = failureRecord(error);
  }
  const trace = recorder.trace();
  return {
    checkpoint_schema_version: "canonical-affect-downstream-language-behavior-inflight-v0",
    stage: "COGNITION_COMPLETE",
    ...identity(item),
    cognition: {
      status,
      provider: COGNITION_SETTINGS.provider,
      model: COGNITION_SETTINGS.model,
      settings: frozenSettings(COGNITION_SETTINGS),
      provider_input_hash: hashJson(providerInput),
      projection_hash: providerInput.projection_hash,
      provider_input: providerInput,
      raw_response: rawRecord(recorder.raw()),
      validated_conversation_proposal: validated,
      validated_cognition_proposal: cognition,
      current_intent: currentIntent,
      communication_directive: directive,
      latency_ms: trace?.elapsed_ms ?? Math.round(performance.now() - started),
      token_counts: tokenCounts(trace),
      transport_trace: trace,
      failure
    }
  };
}

function noLanguage(status: LanguageStageRecord["status"]): LanguageStageRecord {
  return {
    call_required: false,
    status,
    provider: LANGUAGE_SETTINGS.provider,
    model: LANGUAGE_SETTINGS.model,
    settings: frozenSettings(LANGUAGE_SETTINGS),
    input_schema_version: null,
    input_hash: null,
    input: null,
    cognition_current_intent: null,
    language_current_intent: null,
    exact_intent_binding: null,
    raw_response: null,
    validated_draft: null,
    latency_ms: 0,
    token_counts: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    transport_trace: null,
    failure: null
  };
}

function finalRecord(
  inflight: InflightRecord,
  language: LanguageStageRecord,
  behavior: BehaviorRecord | null,
  status: TrialStatus
): TrialRecord {
  return {
    schema_version: "canonical-affect-downstream-language-behavior-trial-v0",
    experiment_version: inflight.experiment_version,
    scenario_id: inflight.scenario_id,
    trial_id: inflight.trial_id,
    trial_ordinal: inflight.trial_ordinal,
    execution_order: inflight.execution_order,
    within_unit_order: inflight.within_unit_order,
    arm: inflight.arm,
    response_request_id: inflight.response_request_id,
    subject_history_id: inflight.subject_history_id,
    canonical_affect: inflight.canonical_affect,
    current_event_ref: inflight.current_event_ref,
    current_event_hash: inflight.current_event_hash,
    current_appraisal_ref: inflight.current_appraisal_ref,
    current_appraisal_dimensions: inflight.current_appraisal_dimensions,
    subject_state_hash: inflight.subject_state_hash,
    cognition: inflight.cognition,
    language,
    behavior,
    behavior_content_hash: behavior === null ? null : exactContentHash(behavior.text),
    behavior_metrics: behavior === null ? null : languageMetrics(behavior.text),
    status
  };
}

/** Resumes from a persisted cognition checkpoint; never repeats cognition. */
export async function executePostCognitionStage(
  item: PlannedTrial,
  inflight: InflightRecord
): Promise<TrialRecord> {
  check(inflight.trial_id === item.trial_id, "inflight checkpoint identity mismatch");
  if (inflight.cognition.status !== "VALID") {
    return finalRecord(inflight, noLanguage("NOT_REACHED"), null, inflight.cognition.status);
  }
  const conversation = inflight.cognition.validated_conversation_proposal;
  const cognition = inflight.cognition.validated_cognition_proposal;
  check(conversation !== null && cognition !== null, "validated cognition checkpoint missing");
  const directive = conversation["communication_directive"] as { readonly kind: string };
  const proposalHash = await hashEnvelope(
    "characteros-next/runtime/conversation-cognition-proposal/v1",
    conversation
  );
  const projection = item.cell.provider_inputs[item.arm];
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    const built = await buildClarificationBehaviorV0({
      subject_id: projection.subject_id,
      source_revision: projection.state_revision,
      response_request_id: item.response_request_id as never,
      cognition_projection_hash: projection.projection_hash,
      conversation_cognition_proposal_hash: proposalHash
    });
    if (!built.ok) {
      return finalRecord(inflight, noLanguage("NOT_REQUIRED_CLARIFY"), null, "VALIDATION_REJECTED");
    }
    return finalRecord(
      inflight,
      noLanguage("NOT_REQUIRED_CLARIFY"),
      {
        schema_version: built.behavior.schema_version,
        behavior_id: built.behavior.behavior_id,
        text: built.behavior.text,
        evidence_refs: [...built.behavior.evidence_refs]
      },
      "DIRECTIVE_CLARIFY"
    );
  }
  check(directive.kind === "REALIZE_CURRENT_INTENT", "unknown communication directive");
  const builtInput = await buildLanguageRealizationInputV1({
    subject_id: projection.subject_id,
    source_revision: projection.state_revision,
    response_request_id: item.response_request_id as never,
    projection,
    cognition,
    conversation_cognition_proposal_hash: proposalHash,
    communication_directive: directive,
    memory_episode_contents: []
  });
  if (!builtInput.ok || builtInput.input.schema_version !== "language-realization-input-v2") {
    const detail = builtInput.ok ? "V2 language input required" : builtInput.detail;
    return finalRecord(inflight, {
      ...noLanguage("NOT_REACHED"),
      call_required: true,
      status: "LANGUAGE_VALIDATION_REJECTED",
      cognition_current_intent: inflight.cognition.current_intent,
      failure: { name: "LanguageInputBuildFailure", code: null, http_status: null, message: detail }
    }, null, "LANGUAGE_VALIDATION_REJECTED");
  }
  const input = builtInput.input;
  const bindingIntent = input.cognition_proposal_binding.current_intent;
  check(bindingIntent === inflight.cognition.current_intent, "validated cognition intent was not preserved exactly");
  const forbiddenFields = ["canonical_affect", "valence", "activation", "affect_channels", "mood_baseline", "reasoning_summary"]
    .filter((field) => Object.prototype.hasOwnProperty.call(input, field));
  check(forbiddenFields.length === 0, `forbidden language input fields: ${forbiddenFields.join(",")}`);

  const recorder = makeTransport(LANGUAGE_SETTINGS);
  const provider = new LanguageRealizationProviderV0(recorder.transport);
  const started = performance.now();
  let draft: Record<string, unknown> | null = null;
  let behavior: BehaviorRecord | null = null;
  let status: LanguageStageRecord["status"] = "VALID";
  let failure: FailureRecord | null = null;
  try {
    const realized = await provider.realize({
      input,
      input_hash: builtInput.input_hash,
      lawful_evidence_refs: allowedEvidenceSet(projection)
    });
    draft = structuredClone(realized) as unknown as Record<string, unknown>;
    const builtBehavior = await buildCharacterLanguageBehaviorV0({
      subject_id: projection.subject_id,
      source_revision: projection.state_revision,
      response_request_id: item.response_request_id as never,
      draft: realized
    });
    if (!builtBehavior.ok) throw new Error(`LANGUAGE_BEHAVIOR_VALIDATION: ${builtBehavior.detail}`);
    behavior = {
      schema_version: builtBehavior.behavior.schema_version,
      behavior_id: builtBehavior.behavior.behavior_id,
      text: builtBehavior.behavior.text,
      evidence_refs: [...builtBehavior.behavior.evidence_refs]
    };
  } catch (error) {
    const classified = classifyLanguageFailure(error);
    status = classified === "TIMEOUT" ? "TIMEOUT" : classified === "LANGUAGE_VALIDATION_REJECTED"
      ? "LANGUAGE_VALIDATION_REJECTED"
      : "LANGUAGE_PROVIDER_ERROR";
    failure = failureRecord(error);
  }
  const trace = recorder.trace();
  const language: LanguageStageRecord = {
    call_required: true,
    status,
    provider: LANGUAGE_SETTINGS.provider,
    model: LANGUAGE_SETTINGS.model,
    settings: frozenSettings(LANGUAGE_SETTINGS),
    input_schema_version: input.schema_version,
    input_hash: builtInput.input_hash,
    input,
    cognition_current_intent: inflight.cognition.current_intent,
    language_current_intent: bindingIntent,
    exact_intent_binding: bindingIntent === inflight.cognition.current_intent,
    raw_response: rawRecord(recorder.raw()),
    validated_draft: draft,
    latency_ms: trace?.elapsed_ms ?? Math.round(performance.now() - started),
    token_counts: tokenCounts(trace),
    transport_trace: trace,
    failure
  };
  return finalRecord(
    inflight,
    language,
    behavior,
    behavior === null
      ? status === "TIMEOUT" ? "TIMEOUT" : status
      : "VALID"
  );
}

export function assertTrialMatchesPlan(record: TrialRecord | InflightRecord, planned: PlannedTrial): void {
  check(record.trial_id === planned.trial_id, "trial id differs from frozen plan");
  check(record.execution_order === planned.execution_order, "execution order differs from frozen plan");
  check(record.arm === planned.arm, "arm differs from frozen plan");
  check(record.response_request_id === planned.response_request_id, "response request differs from frozen plan");
  check(record.cognition.provider_input_hash === hashJson(planned.cell.provider_inputs[planned.arm]), "provider input differs from Phase A");
}

export { summarizeCollection };
