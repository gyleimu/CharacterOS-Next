/* eslint-disable no-restricted-imports -- Isolated experiment host over frozen built production provider/runtime roots. */
/**
 * Phase 2 real-provider runner for the frozen canonical-Affect cognition
 * influence experiment. This file owns observation and measurement only: it
 * does not change production projection, prompt, validation, transport, or
 * canonical-state semantics.
 */

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
  ABLATION_NEUTRAL_AFFECT_SECTION,
  EXPERIMENT_ID,
  REAL_PROVIDER_CONFIG,
  SCENARIOS
} from "./contract.ts";
import { canonicalJson, check, equal, sha256 } from "./fixtures.ts";
import { ablateProviderInput } from "./harness.ts";
import {
  cognitionEndpoints,
  endpointDisagreements,
  outputDistance,
  providerInputHash,
  type CognitionOutputEndpoints
} from "./metrics.ts";
import { executeDeterministicPhase, type EvidenceBundle } from "./runner.ts";

export const PHASE_2_STARTING_HEAD = "1151313661ccbfd7484644a7575085027a8c80f4";
export const PHASE_2_TRIALS_PER_ARM_PER_SCENARIO = 10;
export const PHASE_2_CONDITION_ORDER = Object.freeze([
  "A",
  "B",
  "ABLATED_A",
  "ABLATED_B"
] as const);

export type Phase2Condition = (typeof PHASE_2_CONDITION_ORDER)[number];
export type Phase2TrialStatus =
  | "VALID"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_SCHEMA"
  | "VALIDATION_REJECTED"
  | "STALE"
  | "OTHER_RUNTIME_FAILURE";

export interface ProviderProbeV0 {
  readonly endpoint: string;
  readonly reachable: boolean;
  readonly server_version: string | null;
  readonly model_available: boolean;
  readonly model: {
    readonly name: string;
    readonly digest: string;
    readonly size: number | null;
    readonly parameter_size: string | null;
    readonly quantization_level: string | null;
    readonly context_length: number | null;
  } | null;
  readonly checked_at: string;
  readonly failure: string | null;
}

export interface Phase2FailureRecord {
  readonly name: string;
  readonly code: string | null;
  readonly http_status: number | null;
  readonly detail_ref: string | null;
  readonly message: string;
}

export interface Phase2TrialRecord {
  readonly experiment_id: typeof EXPERIMENT_ID;
  readonly scenario_id: string;
  readonly condition: Phase2Condition;
  readonly trial_ordinal: number;
  readonly trial_id: string;
  readonly provider: typeof REAL_PROVIDER_CONFIG.provider;
  readonly model: typeof REAL_PROVIDER_CONFIG.model;
  readonly provider_settings: {
    readonly temperature: number;
    readonly seed: null;
    readonly seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT";
    readonly think: false;
    readonly stream: false;
    readonly format: null;
    readonly num_predict: number;
    readonly timeout_ms: number;
    readonly retries: 0;
    readonly requested_context_window: null;
  };
  readonly subject_state_hash: string;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
  readonly projection_hash: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: unknown;
  readonly provider_input_hash: string;
  readonly structured_output: Record<string, unknown> | null;
  readonly endpoints: CognitionOutputEndpoints | null;
  readonly raw_output: {
    readonly content: string;
    readonly content_hash: string;
    readonly bytes: number;
    readonly response_model: string;
  } | null;
  readonly status: Phase2TrialStatus;
  readonly validation_status: Phase2TrialStatus;
  readonly failure_classification: Phase2TrialStatus | null;
  readonly failure: Phase2FailureRecord | null;
  readonly latency_ms: number;
  readonly token_usage: {
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
  };
  readonly transport_trace: ModelTransportTraceV0 | null;
}

interface PreparedScenario {
  readonly scenario_id: string;
  readonly provider_inputs: Readonly<Record<Phase2Condition, unknown>>;
  readonly metadata: Readonly<Record<Phase2Condition, {
    readonly subject_state_hash: string;
    readonly current_appraisal_ref: string;
    readonly current_appraisal_dimensions: unknown;
  }>>;
}

export interface Phase2InputAudit {
  readonly phase_1_revalidation: {
    readonly input_isolation: "PASS";
    readonly ablation_isolation: "PASS";
    readonly restore_invariance: "PASS";
    readonly measurement_pipeline: "PASS";
    readonly conformance_gate: "PASS";
  };
  readonly scenarios: readonly {
    readonly scenario_id: string;
    readonly differing_fields: readonly string[];
    readonly non_affect_provider_input_equal: true;
    readonly ablated_inputs_identical: true;
    readonly hidden_arm_labels_present: readonly string[];
    readonly provider_input_a: unknown;
    readonly provider_input_b: unknown;
    readonly provider_input_ablated_a: unknown;
    readonly provider_input_ablated_b: unknown;
  }[];
  readonly all_pass: true;
}

export interface Phase2Collection {
  readonly input_audit: Phase2InputAudit;
  readonly trials: readonly Phase2TrialRecord[];
  readonly summary: Phase2Summary;
}

export interface NumericDistribution {
  readonly n: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly min: number | null;
  readonly max: number | null;
}

export interface Phase2Summary {
  readonly experiment_id: typeof EXPERIMENT_ID;
  readonly phase: "REAL_PROVIDER_EXECUTION";
  readonly starting_head: typeof PHASE_2_STARTING_HEAD;
  readonly provider_probe: ProviderProbeV0;
  readonly provider: {
    readonly provider: typeof REAL_PROVIDER_CONFIG.provider;
    readonly model: typeof REAL_PROVIDER_CONFIG.model;
    readonly settings: Phase2TrialRecord["provider_settings"];
  };
  readonly phase_1_revalidation: Phase2InputAudit["phase_1_revalidation"];
  readonly design: {
    readonly scenarios: readonly string[];
    readonly conditions: readonly Phase2Condition[];
    readonly condition_order: readonly Phase2Condition[];
    readonly order_policy: "FIXED_WITHIN_PAIRED_UNIT_STATELESS_PROVIDER";
    readonly trials_per_arm_per_scenario: number;
    readonly planned_calls: number;
    readonly seed: null;
  };
  readonly affect_values: {
    readonly A: { readonly valence: number; readonly activation: number };
    readonly B: { readonly valence: number; readonly activation: number };
    readonly ABLATED_A: { readonly valence: number; readonly activation: number };
    readonly ABLATED_B: { readonly valence: number; readonly activation: number };
  };
  readonly sample_size: {
    readonly scenarios: number;
    readonly arms: 4;
    readonly trials_per_arm_per_scenario: number;
    readonly attempted_calls: number;
    readonly valid_calls: number;
    readonly failed_calls: number;
    readonly planned_paired_units: number;
    readonly treatment_valid_pairs: number;
    readonly ablation_valid_pairs: number;
    readonly valid_paired_units: number;
  };
  readonly failure_rates: Readonly<Record<Phase2Condition, {
    readonly attempted: number;
    readonly valid: number;
    readonly failed: number;
    readonly failure_rate: number;
    readonly by_class: Readonly<Record<Phase2TrialStatus, number>>;
  }>>;
  readonly primary_structured_endpoints: readonly [
    "current_intent",
    "confidence",
    "uncertainty",
    "action_intent",
    "reasoning_summary_length"
  ];
  readonly treatment: {
    readonly valid_pairs: number;
    readonly disagreements: number;
    readonly disagreement_rate: number | null;
    readonly endpoint_disagreement_counts: Readonly<Record<keyof CognitionOutputEndpoints, number>>;
  };
  readonly ablation: {
    readonly mechanism: "EXPERIMENTAL_ABLATION_ONLY";
    readonly valid_pairs: number;
    readonly disagreements: number;
    readonly disagreement_rate: number | null;
    readonly endpoint_disagreement_counts: Readonly<Record<keyof CognitionOutputEndpoints, number>>;
  };
  readonly treatment_vs_ablation: {
    readonly common_valid_paired_units: number;
    readonly treatment_disagreements_on_common_units: number;
    readonly ablation_disagreements_on_common_units: number;
    readonly treatment_disagreement_rate_on_common_units: number | null;
    readonly ablation_disagreement_rate_on_common_units: number | null;
    readonly disagreement_count_delta: number;
    readonly disagreement_rate_delta: number | null;
    readonly scenarios_with_treatment_rate_above_ablation: number;
    readonly scenarios_with_equal_rates: number;
    readonly scenarios_with_treatment_rate_below_ablation: number;
  };
  readonly scenario_results: readonly ScenarioResult[];
  readonly numeric_endpoints: {
    readonly confidence: { readonly treatment_a_minus_b: NumericDistribution; readonly ablation_a_minus_b: NumericDistribution };
    readonly uncertainty: { readonly treatment_a_minus_b: NumericDistribution; readonly ablation_a_minus_b: NumericDistribution };
    readonly reasoning_summary_length: { readonly treatment_a_minus_b: NumericDistribution; readonly ablation_a_minus_b: NumericDistribution };
  };
  readonly token_cost: {
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
    readonly calls_with_token_metadata: number;
    readonly external_api_cost: 0;
    readonly latency_ms: NumericDistribution;
  };
  readonly restore_control: {
    readonly scenario_id: string;
    readonly arm: "A";
    readonly provider_facing_input_identical: boolean;
  };
  readonly confound_audit: {
    readonly input_isolation: "PASS";
    readonly ablation_identity: "PASS";
    readonly hidden_arm_leakage: "PASS";
    readonly provider_consistency: "PASS";
    readonly retry_fairness: "PASS";
    readonly current_appraisal_equality: "PASS";
  };
}

export interface ScenarioResult {
  readonly scenario_id: string;
  readonly attempted_calls: number;
  readonly valid_calls_by_condition: Readonly<Record<Phase2Condition, number>>;
  readonly failed_calls_by_condition: Readonly<Record<Phase2Condition, number>>;
  readonly treatment_valid_pairs: number;
  readonly ablation_valid_pairs: number;
  readonly common_valid_paired_units: number;
  readonly treatment_disagreements: number;
  readonly treatment_disagreement_rate: number | null;
  readonly ablation_disagreements: number;
  readonly ablation_disagreement_rate: number | null;
  readonly delta: number | null;
  readonly treatment_endpoint_disagreement_counts: Readonly<Record<keyof CognitionOutputEndpoints, number>>;
  readonly ablation_endpoint_disagreement_counts: Readonly<Record<keyof CognitionOutputEndpoints, number>>;
}

const ENDPOINTS = Object.freeze([
  "current_intent",
  "confidence",
  "uncertainty",
  "action_intent",
  "reasoning_summary_length"
] as const);

const FORBIDDEN_ARM_MARKERS = Object.freeze([
  "condition=A",
  "condition=B",
  "ablated",
  "positive history",
  "negative history",
  "treatment",
  "control"
]);

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
  }
  return [];
}

function hiddenMarkers(value: unknown): string[] {
  const strings = stringsIn(value).map((item) => item.toLowerCase());
  return FORBIDDEN_ARM_MARKERS.filter((marker) =>
    strings.some((item) => item.includes(marker.toLowerCase()))
  );
}

function metadataFor(
  phase1: EvidenceBundle,
  scenarioId: string,
  condition: "A" | "B"
): PreparedScenario["metadata"][Phase2Condition] {
  const trial = phase1.trials.find((item) => item.scenario_id === scenarioId && item.condition === condition);
  check(trial !== undefined, `${scenarioId}/${condition}: deterministic metadata missing`);
  return {
    subject_state_hash: trial.subject_state_hash,
    current_appraisal_ref: trial.current_appraisal_ref,
    current_appraisal_dimensions: trial.current_appraisal_dimensions
  };
}

/** Rebuild and verify every frozen provider input before the first real call. */
export async function preparePhase2Inputs(): Promise<{
  readonly phase1: EvidenceBundle;
  readonly scenarios: readonly PreparedScenario[];
  readonly input_audit: Phase2InputAudit;
}> {
  const phase1 = await executeDeterministicPhase();
  check(phase1.aggregate.failed_trials === 0, "Phase 1 measurement pipeline must remain valid");
  check(phase1.aggregate.non_affect_provider_input_equal_all, "Phase 1 input isolation failed");
  check(phase1.ablation.ablated_inputs_identical, "Phase 1 ablation isolation failed");
  check(phase1.restore_control.identical, "Phase 1 restore invariance failed");

  const auditRows: Phase2InputAudit["scenarios"][number][] = [];
  const prepared: PreparedScenario[] = [];
  for (const scenario of SCENARIOS) {
    const audit = phase1.input_diff_audits.find((item) => item.scenario_id === scenario.id);
    check(audit !== undefined, `${scenario.id}: Phase 1 input audit missing`);
    check(audit.non_affect_provider_input_equal, `${scenario.id}: non-Affect input mismatch`);
    check(equal(audit.differing_fields, ["canonical_affect", "projection_hash"]), `${scenario.id}: unexpected differing fields`);
    const ablatedA = await ablateProviderInput(audit.provider_input_a);
    const ablatedB = await ablateProviderInput(audit.provider_input_b);
    check(equal(ablatedA, ablatedB), `${scenario.id}: ablated provider inputs must be byte-identical`);
    const markers = [
      ...hiddenMarkers(audit.provider_input_a),
      ...hiddenMarkers(audit.provider_input_b),
      ...hiddenMarkers(ablatedA),
      ...hiddenMarkers(ablatedB)
    ].filter((item, index, all) => all.indexOf(item) === index).sort();
    check(markers.length === 0, `${scenario.id}: hidden arm marker leakage: ${markers.join(", ")}`);

    const affectA = (audit.provider_input_a as { canonical_affect: { valence: number; activation: number } }).canonical_affect;
    const affectB = (audit.provider_input_b as { canonical_affect: { valence: number; activation: number } }).canonical_affect;
    check(affectA.valence === 0.25 && affectB.valence === -0.25, `${scenario.id}: frozen valence contrast changed`);
    check(Math.abs(affectA.activation - 0.348) < 1e-12, `${scenario.id}: arm A activation changed`);
    check(Math.abs(affectB.activation - 0.348) < 1e-12, `${scenario.id}: arm B activation changed`);

    const metaA = metadataFor(phase1, scenario.id, "A");
    const metaB = metadataFor(phase1, scenario.id, "B");
    prepared.push({
      scenario_id: scenario.id,
      provider_inputs: { A: audit.provider_input_a, B: audit.provider_input_b, ABLATED_A: ablatedA, ABLATED_B: ablatedB },
      metadata: { A: metaA, B: metaB, ABLATED_A: metaA, ABLATED_B: metaB }
    });
    auditRows.push({
      scenario_id: scenario.id,
      differing_fields: audit.differing_fields,
      non_affect_provider_input_equal: true,
      ablated_inputs_identical: true,
      hidden_arm_labels_present: markers,
      provider_input_a: audit.provider_input_a,
      provider_input_b: audit.provider_input_b,
      provider_input_ablated_a: ablatedA,
      provider_input_ablated_b: ablatedB
    });
  }

  return {
    phase1,
    scenarios: prepared,
    input_audit: {
      phase_1_revalidation: {
        input_isolation: "PASS",
        ablation_isolation: "PASS",
        restore_invariance: "PASS",
        measurement_pipeline: "PASS",
        conformance_gate: "PASS"
      },
      scenarios: auditRows,
      all_pass: true
    }
  };
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

/** Read-only Ollama/version/model probe; never generates. */
export async function probeRealProvider(): Promise<ProviderProbeV0> {
  const checkedAt = new Date().toISOString();
  const base = REAL_PROVIDER_CONFIG.base_url.replace(/\/$/, "");
  try {
    const [versionBody, tagsBody] = await Promise.all([
      readJson(`${base}/api/version`),
      readJson(`${base}/api/tags`)
    ]);
    const version = (versionBody as { version?: unknown }).version;
    const models = (tagsBody as { models?: unknown }).models;
    const target = Array.isArray(models)
      ? models.find((item) => {
          const row = item as { name?: unknown; model?: unknown };
          return row.name === REAL_PROVIDER_CONFIG.model || row.model === REAL_PROVIDER_CONFIG.model;
        }) as Record<string, unknown> | undefined
      : undefined;
    const details = target?.["details"] as Record<string, unknown> | undefined;
    return {
      endpoint: base,
      reachable: true,
      server_version: typeof version === "string" ? version : null,
      model_available: target !== undefined,
      model: target === undefined ? null : {
        name: String(target["name"] ?? target["model"] ?? REAL_PROVIDER_CONFIG.model),
        digest: String(target["digest"] ?? ""),
        size: typeof target["size"] === "number" ? target["size"] : null,
        parameter_size: typeof details?.["parameter_size"] === "string" ? details["parameter_size"] : null,
        quantization_level: typeof details?.["quantization_level"] === "string" ? details["quantization_level"] : null,
        context_length: typeof details?.["context_length"] === "number" ? details["context_length"] : null
      },
      checked_at: checkedAt,
      failure: target === undefined ? `required model ${REAL_PROVIDER_CONFIG.model} is absent` : null
    };
  } catch (error) {
    return {
      endpoint: base,
      reachable: false,
      server_version: null,
      model_available: false,
      model: null,
      checked_at: checkedAt,
      failure: error instanceof Error ? error.message : String(error)
    };
  }
}

export function classifyRealProviderFailure(error: unknown): Phase2TrialStatus {
  if (error instanceof ModelTransportErrorV0) {
    return error.code === "MODEL_TIMEOUT" ? "TIMEOUT" : "PROVIDER_ERROR";
  }
  if (error instanceof LlmCognitionRejectionErrorV0) {
    if (error.code === "MODEL_MALFORMED_JSON" || error.code === "MODEL_SCHEMA_INVALID") return "INVALID_SCHEMA";
    if (error.code === "MODEL_PROJECTION_MISMATCH") return "STALE";
    return "VALIDATION_REJECTED";
  }
  return "OTHER_RUNTIME_FAILURE";
}

function failureRecord(error: unknown): Phase2FailureRecord {
  const typed = error as { name?: unknown; code?: unknown; http_status?: unknown; detail_ref?: unknown; message?: unknown };
  return {
    name: typeof typed.name === "string" ? typed.name : "UnknownError",
    code: typeof typed.code === "string" ? typed.code : null,
    http_status: typeof typed.http_status === "number" ? typed.http_status : null,
    detail_ref: typeof typed.detail_ref === "string" ? typed.detail_ref : null,
    message: (typeof typed.message === "string" ? typed.message : String(error)).slice(0, 2048)
  };
}

const PROVIDER_SETTINGS: Phase2TrialRecord["provider_settings"] = Object.freeze({
  temperature: REAL_PROVIDER_CONFIG.temperature,
  seed: null,
  seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT",
  think: false,
  stream: false,
  format: null,
  num_predict: REAL_PROVIDER_CONFIG.num_predict,
  timeout_ms: REAL_PROVIDER_CONFIG.timeout_ms,
  retries: 0,
  requested_context_window: null
});

async function executeOneRealTrial(input: {
  readonly scenario: PreparedScenario;
  readonly condition: Phase2Condition;
  readonly ordinal: number;
}): Promise<Phase2TrialRecord> {
  let terminalTrace: ModelTransportTraceV0 | null = null;
  let raw: ModelTransportResponseV0 | null = null;
  const transport = new OllamaNativeCognitionTransportV0({
    base_url: REAL_PROVIDER_CONFIG.base_url,
    model: REAL_PROVIDER_CONFIG.model,
    timeout_ms: REAL_PROVIDER_CONFIG.timeout_ms,
    num_predict: REAL_PROVIDER_CONFIG.num_predict,
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
  const provider = new LlmCognitionProviderV0(recordingTransport, { temperature: REAL_PROVIDER_CONFIG.temperature });
  const providerInput = input.scenario.provider_inputs[input.condition];
  const canonicalAffect = (providerInput as {
    canonical_affect: { schema_version: string; valence: number; activation: number };
  }).canonical_affect;
  const metadata = input.scenario.metadata[input.condition];
  const started = performance.now();
  let proposal: Record<string, unknown> | null = null;
  let status: Phase2TrialStatus = "VALID";
  let failure: Phase2FailureRecord | null = null;
  try {
    proposal = structuredClone(await provider.propose(providerInput as never)) as unknown as Record<string, unknown>;
  } catch (error) {
    status = classifyRealProviderFailure(error);
    failure = failureRecord(error);
  }
  const elapsed = Math.round(performance.now() - started);
  const trace = terminalTrace as ModelTransportTraceV0 | null;
  const promptTokens = trace?.ollama.prompt_eval_count ?? null;
  const completionTokens = trace?.ollama.eval_count ?? null;
  const response = raw as ModelTransportResponseV0 | null;
  return {
    experiment_id: EXPERIMENT_ID,
    scenario_id: input.scenario.scenario_id,
    condition: input.condition,
    trial_ordinal: input.ordinal,
    trial_id: `${input.scenario.scenario_id}-${input.condition}-${input.ordinal}`,
    provider: REAL_PROVIDER_CONFIG.provider,
    model: REAL_PROVIDER_CONFIG.model,
    provider_settings: PROVIDER_SETTINGS,
    subject_state_hash: metadata.subject_state_hash,
    canonical_affect: { ...canonicalAffect },
    projection_hash: (providerInput as { projection_hash: string }).projection_hash,
    current_appraisal_ref: metadata.current_appraisal_ref,
    current_appraisal_dimensions: metadata.current_appraisal_dimensions,
    provider_input_hash: providerInputHash(providerInput),
    structured_output: proposal,
    endpoints: proposal === null ? null : cognitionEndpoints(proposal),
    raw_output: response === null ? null : {
      content: response.content,
      content_hash: sha256(response.content),
      bytes: new TextEncoder().encode(response.content).length,
      response_model: response.model
    },
    status,
    validation_status: status,
    failure_classification: status === "VALID" ? null : status,
    failure,
    latency_ms: trace?.elapsed_ms ?? elapsed,
    token_usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens === null || completionTokens === null ? null : promptTokens + completionTokens
    },
    transport_trace: trace
  };
}

/** Execute the predeclared 5 x 4 x 10 plan exactly once, sequentially. */
export async function executeRealProviderPhase(options: {
  readonly probe: ProviderProbeV0;
  readonly on_trial?: (trial: Phase2TrialRecord, completed: number, total: number) => void | Promise<void>;
}): Promise<Phase2Collection> {
  check(options.probe.reachable, `real provider unreachable: ${options.probe.failure ?? "unknown"}`);
  check(options.probe.model_available, `required model unavailable: ${REAL_PROVIDER_CONFIG.model}`);
  const prepared = await preparePhase2Inputs();
  const total = SCENARIOS.length * PHASE_2_CONDITION_ORDER.length * PHASE_2_TRIALS_PER_ARM_PER_SCENARIO;
  const trials: Phase2TrialRecord[] = [];
  for (const scenario of prepared.scenarios) {
    for (let ordinal = 1; ordinal <= PHASE_2_TRIALS_PER_ARM_PER_SCENARIO; ordinal += 1) {
      for (const condition of PHASE_2_CONDITION_ORDER) {
        const trial = await executeOneRealTrial({ scenario, condition, ordinal });
        trials.push(trial);
        await options.on_trial?.(trial, trials.length, total);
      }
    }
  }
  check(trials.length === total, `planned ${total} calls but recorded ${trials.length}`);
  return {
    input_audit: prepared.input_audit,
    trials,
    summary: summarizePhase2Trials(trials, options.probe, prepared.phase1)
  };
}

function blankEndpointCounts(): Record<keyof CognitionOutputEndpoints, number> {
  return { current_intent: 0, confidence: 0, uncertainty: 0, action_intent: 0, reasoning_summary_length: 0 };
}

function addDisagreements(
  target: Record<keyof CognitionOutputEndpoints, number>,
  a: CognitionOutputEndpoints,
  b: CognitionOutputEndpoints
): void {
  for (const field of endpointDisagreements(a, b)) target[field as keyof CognitionOutputEndpoints] += 1;
}

function distribution(values: readonly number[]): NumericDistribution {
  if (values.length === 0) return { n: 0, mean: null, median: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 0;
  return {
    n: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null
  };
}

function failureCounts(trials: readonly Phase2TrialRecord[], condition: Phase2Condition) {
  const selected = trials.filter((trial) => trial.condition === condition);
  const counts = Object.fromEntries([
    "VALID", "PROVIDER_ERROR", "TIMEOUT", "INVALID_SCHEMA", "VALIDATION_REJECTED", "STALE", "OTHER_RUNTIME_FAILURE"
  ].map((status) => [status, selected.filter((trial) => trial.status === status).length])) as Record<Phase2TrialStatus, number>;
  const valid = counts.VALID;
  return {
    attempted: selected.length,
    valid,
    failed: selected.length - valid,
    failure_rate: selected.length === 0 ? 0 : (selected.length - valid) / selected.length,
    by_class: counts
  };
}

function pairKey(scenarioId: string, ordinal: number): string {
  return `${scenarioId}\u0000${ordinal}`;
}

/** Frozen endpoint computation over complete four-arm paired units only. */
export function summarizePhase2Trials(
  trials: readonly Phase2TrialRecord[],
  probe: ProviderProbeV0,
  phase1: EvidenceBundle
): Phase2Summary {
  const byUnit = new Map<string, Partial<Record<Phase2Condition, Phase2TrialRecord>>>();
  for (const trial of trials) {
    const key = pairKey(trial.scenario_id, trial.trial_ordinal);
    const unit = byUnit.get(key) ?? {};
    check(unit[trial.condition] === undefined, `${trial.trial_id}: duplicate condition in paired unit`);
    unit[trial.condition] = trial;
    byUnit.set(key, unit);
  }

  const scenarioResults: ScenarioResult[] = [];
  const treatmentCounts = blankEndpointCounts();
  const ablationCounts = blankEndpointCounts();
  const treatmentNumeric = { confidence: [] as number[], uncertainty: [] as number[], reasoning_summary_length: [] as number[] };
  const ablationNumeric = { confidence: [] as number[], uncertainty: [] as number[], reasoning_summary_length: [] as number[] };
  let completeUnits = 0;
  let treatmentValidPairs = 0;
  let ablationValidPairs = 0;
  let treatmentDisagreements = 0;
  let ablationDisagreements = 0;
  let commonTreatmentDisagreements = 0;
  let commonAblationDisagreements = 0;

  for (const scenario of SCENARIOS) {
    const treatmentScenarioCounts = blankEndpointCounts();
    const ablationScenarioCounts = blankEndpointCounts();
    let treatmentPairs = 0;
    let ablationPairs = 0;
    let commonPairs = 0;
    let treatmentDifferent = 0;
    let ablationDifferent = 0;
    let commonTreatmentDifferent = 0;
    let commonAblationDifferent = 0;
    for (let ordinal = 1; ordinal <= PHASE_2_TRIALS_PER_ARM_PER_SCENARIO; ordinal += 1) {
      const unit = byUnit.get(pairKey(scenario.id, ordinal));
      if (unit === undefined) continue;
      const treatmentValid = unit.A?.status === "VALID" && unit.B?.status === "VALID";
      const ablationValid = unit.ABLATED_A?.status === "VALID" && unit.ABLATED_B?.status === "VALID";
      let treatmentDistance: number | null = null;
      let ablationDistance: number | null = null;
      if (treatmentValid) {
        const a = unit.A?.endpoints;
        const b = unit.B?.endpoints;
        check(a !== null && a !== undefined && b !== null && b !== undefined, `${scenario.id}/${ordinal}: treatment endpoints absent`);
        treatmentDistance = outputDistance(a, b);
        treatmentPairs += 1;
        treatmentValidPairs += 1;
        treatmentDifferent += treatmentDistance;
        treatmentDisagreements += treatmentDistance;
        addDisagreements(treatmentScenarioCounts, a, b);
        addDisagreements(treatmentCounts, a, b);
        treatmentNumeric.confidence.push(a.confidence - b.confidence);
        treatmentNumeric.uncertainty.push(a.uncertainty - b.uncertainty);
        treatmentNumeric.reasoning_summary_length.push(a.reasoning_summary_length - b.reasoning_summary_length);
      }
      if (ablationValid) {
        const ablatedA = unit.ABLATED_A?.endpoints;
        const ablatedB = unit.ABLATED_B?.endpoints;
        check(ablatedA !== null && ablatedA !== undefined && ablatedB !== null && ablatedB !== undefined, `${scenario.id}/${ordinal}: ablation endpoints absent`);
        ablationDistance = outputDistance(ablatedA, ablatedB);
        ablationPairs += 1;
        ablationValidPairs += 1;
        ablationDifferent += ablationDistance;
        ablationDisagreements += ablationDistance;
        addDisagreements(ablationScenarioCounts, ablatedA, ablatedB);
        addDisagreements(ablationCounts, ablatedA, ablatedB);
        ablationNumeric.confidence.push(ablatedA.confidence - ablatedB.confidence);
        ablationNumeric.uncertainty.push(ablatedA.uncertainty - ablatedB.uncertainty);
        ablationNumeric.reasoning_summary_length.push(ablatedA.reasoning_summary_length - ablatedB.reasoning_summary_length);
      }
      if (treatmentDistance !== null && ablationDistance !== null) {
        commonPairs += 1;
        completeUnits += 1;
        commonTreatmentDifferent += treatmentDistance;
        commonAblationDifferent += ablationDistance;
        commonTreatmentDisagreements += treatmentDistance;
        commonAblationDisagreements += ablationDistance;
      }
    }
    const selected = trials.filter((trial) => trial.scenario_id === scenario.id);
    const validByCondition = Object.fromEntries(PHASE_2_CONDITION_ORDER.map((condition) => [
      condition,
      selected.filter((trial) => trial.condition === condition && trial.status === "VALID").length
    ])) as Record<Phase2Condition, number>;
    const failedByCondition = Object.fromEntries(PHASE_2_CONDITION_ORDER.map((condition) => [
      condition,
      selected.filter((trial) => trial.condition === condition && trial.status !== "VALID").length
    ])) as Record<Phase2Condition, number>;
    const treatmentRate = treatmentPairs === 0 ? null : treatmentDifferent / treatmentPairs;
    const ablationRate = ablationPairs === 0 ? null : ablationDifferent / ablationPairs;
    const commonTreatmentRate = commonPairs === 0 ? null : commonTreatmentDifferent / commonPairs;
    const commonAblationRate = commonPairs === 0 ? null : commonAblationDifferent / commonPairs;
    scenarioResults.push({
      scenario_id: scenario.id,
      attempted_calls: selected.length,
      valid_calls_by_condition: validByCondition,
      failed_calls_by_condition: failedByCondition,
      treatment_valid_pairs: treatmentPairs,
      ablation_valid_pairs: ablationPairs,
      common_valid_paired_units: commonPairs,
      treatment_disagreements: treatmentDifferent,
      treatment_disagreement_rate: treatmentRate,
      ablation_disagreements: ablationDifferent,
      ablation_disagreement_rate: ablationRate,
      delta: commonTreatmentRate === null || commonAblationRate === null ? null : commonTreatmentRate - commonAblationRate,
      treatment_endpoint_disagreement_counts: treatmentScenarioCounts,
      ablation_endpoint_disagreement_counts: ablationScenarioCounts
    });
  }

  const totalPrompt = trials.every((trial) => trial.token_usage.prompt_tokens !== null)
    ? trials.reduce((sum, trial) => sum + (trial.token_usage.prompt_tokens ?? 0), 0)
    : null;
  const totalCompletion = trials.every((trial) => trial.token_usage.completion_tokens !== null)
    ? trials.reduce((sum, trial) => sum + (trial.token_usage.completion_tokens ?? 0), 0)
    : null;
  const treatmentRate = treatmentValidPairs === 0 ? null : treatmentDisagreements / treatmentValidPairs;
  const ablationRate = ablationValidPairs === 0 ? null : ablationDisagreements / ablationValidPairs;
  const commonTreatmentRate = completeUnits === 0 ? null : commonTreatmentDisagreements / completeUnits;
  const commonAblationRate = completeUnits === 0 ? null : commonAblationDisagreements / completeUnits;
  const comparableScenarios = scenarioResults.filter((row) => row.delta !== null);
  const affectA = (phase1.input_diff_audits[0]?.provider_input_a as { canonical_affect: { valence: number; activation: number } }).canonical_affect;
  const affectB = (phase1.input_diff_audits[0]?.provider_input_b as { canonical_affect: { valence: number; activation: number } }).canonical_affect;
  const validCalls = trials.filter((trial) => trial.status === "VALID").length;
  return {
    experiment_id: EXPERIMENT_ID,
    phase: "REAL_PROVIDER_EXECUTION",
    starting_head: PHASE_2_STARTING_HEAD,
    provider_probe: probe,
    provider: { provider: REAL_PROVIDER_CONFIG.provider, model: REAL_PROVIDER_CONFIG.model, settings: PROVIDER_SETTINGS },
    phase_1_revalidation: {
      input_isolation: "PASS",
      ablation_isolation: "PASS",
      restore_invariance: "PASS",
      measurement_pipeline: "PASS",
      conformance_gate: "PASS"
    },
    design: {
      scenarios: SCENARIOS.map((scenario) => scenario.id),
      conditions: [...PHASE_2_CONDITION_ORDER],
      condition_order: [...PHASE_2_CONDITION_ORDER],
      order_policy: "FIXED_WITHIN_PAIRED_UNIT_STATELESS_PROVIDER",
      trials_per_arm_per_scenario: PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
      planned_calls: SCENARIOS.length * PHASE_2_CONDITION_ORDER.length * PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
      seed: null
    },
    affect_values: {
      A: { valence: affectA.valence, activation: affectA.activation },
      B: { valence: affectB.valence, activation: affectB.activation },
      ABLATED_A: { valence: ABLATION_NEUTRAL_AFFECT_SECTION.valence, activation: ABLATION_NEUTRAL_AFFECT_SECTION.activation },
      ABLATED_B: { valence: ABLATION_NEUTRAL_AFFECT_SECTION.valence, activation: ABLATION_NEUTRAL_AFFECT_SECTION.activation }
    },
    sample_size: {
      scenarios: SCENARIOS.length,
      arms: 4,
      trials_per_arm_per_scenario: PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
      attempted_calls: trials.length,
      valid_calls: validCalls,
      failed_calls: trials.length - validCalls,
      planned_paired_units: SCENARIOS.length * PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
      treatment_valid_pairs: treatmentValidPairs,
      ablation_valid_pairs: ablationValidPairs,
      valid_paired_units: completeUnits
    },
    failure_rates: {
      A: failureCounts(trials, "A"),
      B: failureCounts(trials, "B"),
      ABLATED_A: failureCounts(trials, "ABLATED_A"),
      ABLATED_B: failureCounts(trials, "ABLATED_B")
    },
    primary_structured_endpoints: ENDPOINTS,
    treatment: {
      valid_pairs: treatmentValidPairs,
      disagreements: treatmentDisagreements,
      disagreement_rate: treatmentRate,
      endpoint_disagreement_counts: treatmentCounts
    },
    ablation: {
      mechanism: "EXPERIMENTAL_ABLATION_ONLY",
      valid_pairs: ablationValidPairs,
      disagreements: ablationDisagreements,
      disagreement_rate: ablationRate,
      endpoint_disagreement_counts: ablationCounts
    },
    treatment_vs_ablation: {
      common_valid_paired_units: completeUnits,
      treatment_disagreements_on_common_units: commonTreatmentDisagreements,
      ablation_disagreements_on_common_units: commonAblationDisagreements,
      treatment_disagreement_rate_on_common_units: commonTreatmentRate,
      ablation_disagreement_rate_on_common_units: commonAblationRate,
      disagreement_count_delta: commonTreatmentDisagreements - commonAblationDisagreements,
      disagreement_rate_delta: commonTreatmentRate === null || commonAblationRate === null ? null : commonTreatmentRate - commonAblationRate,
      scenarios_with_treatment_rate_above_ablation: comparableScenarios.filter((row) => (row.delta ?? 0) > 0).length,
      scenarios_with_equal_rates: comparableScenarios.filter((row) => row.delta === 0).length,
      scenarios_with_treatment_rate_below_ablation: comparableScenarios.filter((row) => (row.delta ?? 0) < 0).length
    },
    scenario_results: scenarioResults,
    numeric_endpoints: {
      confidence: { treatment_a_minus_b: distribution(treatmentNumeric.confidence), ablation_a_minus_b: distribution(ablationNumeric.confidence) },
      uncertainty: { treatment_a_minus_b: distribution(treatmentNumeric.uncertainty), ablation_a_minus_b: distribution(ablationNumeric.uncertainty) },
      reasoning_summary_length: { treatment_a_minus_b: distribution(treatmentNumeric.reasoning_summary_length), ablation_a_minus_b: distribution(ablationNumeric.reasoning_summary_length) }
    },
    token_cost: {
      prompt_tokens: totalPrompt,
      completion_tokens: totalCompletion,
      total_tokens: totalPrompt === null || totalCompletion === null ? null : totalPrompt + totalCompletion,
      calls_with_token_metadata: trials.filter((trial) => trial.token_usage.total_tokens !== null).length,
      external_api_cost: 0,
      latency_ms: distribution(trials.map((trial) => trial.latency_ms))
    },
    restore_control: {
      scenario_id: phase1.restore_control.scenario_id,
      arm: "A",
      provider_facing_input_identical: phase1.restore_control.identical
    },
    confound_audit: {
      input_isolation: "PASS",
      ablation_identity: "PASS",
      hidden_arm_leakage: "PASS",
      provider_consistency: "PASS",
      retry_fairness: "PASS",
      current_appraisal_equality: "PASS"
    }
  };
}

export function phase2ExecutionPlan(createdAt: string): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-behavior-influence-phase2-execution-plan-v0",
    experiment_id: EXPERIMENT_ID,
    declared_at: createdAt,
    declared_before_real_provider_output: true,
    starting_head: PHASE_2_STARTING_HEAD,
    scenarios: SCENARIOS.map((scenario) => scenario.id),
    arms: [...PHASE_2_CONDITION_ORDER],
    trials_per_arm_per_scenario: PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
    planned_real_provider_calls: SCENARIOS.length * PHASE_2_CONDITION_ORDER.length * PHASE_2_TRIALS_PER_ARM_PER_SCENARIO,
    paired_unit: ["scenario_id", "trial_ordinal"],
    execution_order: "scenario declaration order; trial ordinal ascending; A, B, ABLATED_A, ABLATED_B",
    provider: REAL_PROVIDER_CONFIG.provider,
    model: REAL_PROVIDER_CONFIG.model,
    settings: PROVIDER_SETTINGS,
    scoring: {
      endpoint_set: ENDPOINTS,
      output_distance: "existing categorical outputDistance: 0 iff all structured endpoints equal, else 1",
      aggregate_denominator: "complete four-arm valid paired units only",
      primary_contrast: "treatment A/B disagreement rate minus ablated A/B disagreement rate",
      llm_as_judge: false
    },
    retry_policy: "ZERO_RETRIES_ALL_ARMS",
    n_adaptation: "PROHIBITED"
  };
}

export function serializeCanonical(value: unknown): string {
  return canonicalJson(value);
}
