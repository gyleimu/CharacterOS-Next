/* eslint-disable no-restricted-imports -- Manual diagnostic uses the built public production seams. */

import { createHash } from "node:crypto";

import {
  LlmCognitionProviderV0,
  cognitiveProjectionHash,
  type CognitiveContextProjectionV0,
  type CognitionProposalV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportTraceEventV0,
  type ModelTransportTraceObserverV0,
  type ModelTransportTraceV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";

export const DIAGNOSTIC_PROTOCOL_V1 = Object.freeze({
  schema_version: "ollama-cognition-representative-load-diagnostic-v1",
  diagnostic_id: "OLLAMA_COGNITION_REPRESENTATIVE_LOAD_DIAGNOSTIC_V1",
  call_count: 4,
  authority_boundary:
    "diagnostic observation only; never canonical state, behavior evidence, or scientific evidence"
});

export const PROVIDER_LOCK_V1 = Object.freeze({
  base_url: "http://127.0.0.1:11434",
  version: "0.33.2",
  model: "qwen3.5:9b",
  digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  temperature: 0,
  think: false,
  stream: false,
  num_predict: 2048,
  timeout_ms: 120000,
  retries: 0,
  seed_field_sent: false,
  keep_alive_field_sent: false
});

/**
 * A neutral production-shaped projection. Its size comes from lawful cognition
 * fields and the production renderer, never padding or repeated filler.
 */
export async function representativeProjectionV1(): Promise<CognitiveContextProjectionV0> {
  const body = {
    schema_version: "cognitive-context-projection-v0" as const,
    subject_id: "diagnostic-subject-v1",
    current_logical_time: 42,
    state_revision: 0,
    traits_dimensions: {
      conscientiousness: 0.62,
      curiosity: 0.58,
      deliberation: 0.71,
      adaptability: 0.55
    },
    affect_channels: [
      { channel: "attentional_engagement", strength: 0.56 },
      { channel: "informational_uncertainty", strength: 0.31 }
    ],
    mood_baseline: 0.08,
    regulation: { energy: 0.72, stress: 0.19, arousal: 0.37, fatigue: 0.16 },
    context: {
      scene:
        "The subject is reviewing a routine request about organizing a shared reference document.",
      task:
        "Distinguish confirmed requirements from missing context and form a concise interpretation.",
      focus_refs: ["event:diagnostic-information-request-001"],
      active_entity_refs: [],
      environment_refs: ["entity:diagnostic-reference-document-001"],
      current_observation_ref: "event:diagnostic-information-request-001"
    },
    memory_working_refs: [],
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [],
    allowed_actions: []
  };
  const projection_hash = await cognitiveProjectionHash({ ...body });
  return Object.freeze({ ...body, projection_hash }) as unknown as CognitiveContextProjectionV0;
}

class OfflineCaptureTransportV1 implements ModelTransportV0 {
  request: ModelTransportRequestV0 | null = null;
  calls = 0;
  private readonly projectionHash: string;

  constructor(projectionHash: string) {
    this.projectionHash = projectionHash;
  }

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    this.calls += 1;
    this.request = structuredClone(request);
    const proposal: CognitionProposalV0 = {
      schema_version: "cognition-proposal-v0",
      projection_hash: this.projectionHash as CognitionProposalV0["projection_hash"],
      reasoning_summary: "The routine informational request can be interpreted without external action.",
      relevant_memory_refs: [],
      considered_context_refs: [],
      current_intent: "Prepare a concise interpretation of the informational request.",
      confidence: 0.84,
      uncertainty: 0.16,
      action_intent: null,
      evidence_refs: []
    };
    return { content: JSON.stringify(proposal), model: PROVIDER_LOCK_V1.model };
  }
}

/** Invoke the real provider and prompt builder offline, without any model call. */
export async function captureRepresentativeRequestV1(
  projection: CognitiveContextProjectionV0
): Promise<ModelTransportRequestV0> {
  const capture = new OfflineCaptureTransportV1(projection.projection_hash);
  await new LlmCognitionProviderV0(capture, { temperature: 0 }).propose(projection);
  if (capture.calls !== 1 || capture.request === null) {
    throw new Error("offline production-provider capture did not produce exactly one request");
  }
  return capture.request;
}

export function serializeProductionRequestV1(request: ModelTransportRequestV0): string {
  return JSON.stringify({
    model: PROVIDER_LOCK_V1.model,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    think: false,
    stream: false,
    options: { temperature: 0, num_predict: 2048 }
  });
}

export interface RepresentativeRequestShapeV1 {
  readonly request_hash: string;
  readonly post_bytes: number;
  readonly message_count: number;
  readonly system_content_bytes: number;
  readonly user_content_bytes: number;
  readonly projection_json_bytes: number;
  readonly approximate_prompt_tokens: number;
  readonly token_estimate_method: "utf8-content-bytes-divided-by-4";
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function measureRepresentativeRequestV1(
  projection: CognitiveContextProjectionV0,
  request: ModelTransportRequestV0
): RepresentativeRequestShapeV1 {
  const wire = serializeProductionRequestV1(request);
  const system = request.messages.find((message) => message.role === "system")?.content ?? "";
  const user = request.messages.find((message) => message.role === "user")?.content ?? "";
  const contentBytes = bytes(system) + bytes(user);
  return Object.freeze({
    request_hash: `sha256:${createHash("sha256").update(wire, "utf8").digest("hex")}`,
    post_bytes: bytes(wire),
    message_count: request.messages.length,
    system_content_bytes: bytes(system),
    user_content_bytes: bytes(user),
    projection_json_bytes: bytes(JSON.stringify(projection)),
    approximate_prompt_tokens: Math.round(contentBytes / 4),
    token_estimate_method: "utf8-content-bytes-divided-by-4"
  });
}

export function representativeFixtureAchievedV1(shape: RepresentativeRequestShapeV1): boolean {
  return shape.post_bytes >= 3_500 && shape.approximate_prompt_tokens >= 700;
}

export interface RepresentativeCallRecordingV1 {
  readonly call_index: number;
  readonly started_at: string;
  finished_at: string | null;
  events: ModelTransportTraceEventV0[];
  trace: ModelTransportTraceV0 | null;
  provider_result: CognitionProposalV0 | null;
  error: { readonly name: string; readonly message: string; readonly code: string | null } | null;
}

export function collectRepresentativeCallV1(callIndex: number): {
  recording: RepresentativeCallRecordingV1;
  observer: ModelTransportTraceObserverV0;
} {
  const recording: RepresentativeCallRecordingV1 = {
    call_index: callIndex,
    started_at: new Date().toISOString(),
    finished_at: null,
    events: [],
    trace: null,
    provider_result: null,
    error: null
  };
  return {
    recording,
    observer: (event) => {
      if ("stage" in event) recording.events.push(event);
      else recording.trace = event;
    }
  };
}
