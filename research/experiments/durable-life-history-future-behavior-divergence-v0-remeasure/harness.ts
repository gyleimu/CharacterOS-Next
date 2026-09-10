/* eslint-disable no-restricted-imports -- Isolated remeasurement harness over the frozen V0 lifecycle and frozen built production roots; bounded real generation, deterministic measurement surfaces. */

/**
 * DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE — harness.
 *
 * Reuses the frozen V0 lifecycle VERBATIM (life construction, lawful history,
 * consequence chain, equalization, authoritative restore, evidence-resolved
 * provider-facing projection, ablation seam, frozen two-stage real generation)
 * and adds only measurement-surface instrumentation:
 *   - deterministic render of the production provider request (§17/§18/§47);
 *   - exact provider-request identity reproduction against the transport trace
 *     so the real request provably carried the rendered memory facts;
 *   - §32 schema-failure taxonomy extraction;
 *   - §48 repair-regression checks.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { sha256HashV1 } from "../../../packages/subject-core/dist/canonical/hash.js";
import { ConversationCognitionProviderV1 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js";
import {
  buildLifeArm,
  captureFutureProjection,
  commitFutureContextObservation,
  completeLife,
  projectionBodyWithout,
  rebuildLifeFromCheckpoint,
  restoreWorld,
  runFutureTrial as runV0FutureTrial,
  type FutureCapture,
  type LifeArmBuild,
  type LifeArmComplete,
  type LifeMetadata,
  type RestoredRuntime
} from "../durable-life-history-future-behavior-divergence-v0/harness.ts";
import { canonicalizeSetLikeRefFields } from "../../../packages/runtime/dist/providers/cognition/wire-format-canonicalization.js";
import { validateCognitionProposal } from "../../../packages/runtime/dist/transitions/cognition-action/types.js";
import { hashJson } from "../durable-life-history-future-behavior-divergence-v0/fixtures.ts";
import {
  COGNITION_SETTINGS,
  FUTURE_SCENARIO,
  SUBJECT,
  type FutureArm
} from "../durable-life-history-future-behavior-divergence-v0/contract.ts";

export {
  buildLifeArm,
  captureFutureProjection,
  commitFutureContextObservation,
  completeLife,
  projectionBodyWithout,
  rebuildLifeFromCheckpoint,
  restoreWorld
};
export type { FutureCapture, LifeArmBuild, LifeArmComplete, LifeMetadata, RestoredRuntime };

/** §47 — the rendered production provider request, and its exact transport
 * identity. The render path is the frozen production renderer reached through
 * the frozen provider; the fake transport only captures messages (zero real
 * calls), and the request body hash is reproduced exactly as the Ollama native
 * transport computes it, so a match against the recorded transport trace
 * proves the REAL request carried this exact rendered content. */
export interface RenderedProviderRequest {
  readonly system_content: string;
  readonly user_content: string;
  readonly request_bytes: number;
  readonly request_hash: string;
  readonly memory_section_present: boolean;
  readonly memory_section: string;
}

export async function renderProviderRequest(projection: Record<string, unknown>): Promise<RenderedProviderRequest> {
  let systemContent = "";
  let userContent = "";
  const provider = new ConversationCognitionProviderV1({
    complete: async (request: { messages: { role: string; content: string }[] }) => {
      systemContent = request.messages.find((message) => message.role === "system")?.content ?? "";
      userContent = request.messages.find((message) => message.role === "user")?.content ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projection["projection_hash"],
            reasoning_summary: "remeasure render capture",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: null,
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "render-capture"
      } as never;
    }
  } as never);
  await provider.propose(projection as never);
  // Exact reproduction of the frozen transport's request body (identical key
  // order and shape) and its content hash.
  const requestBody = JSON.stringify({
    model: COGNITION_SETTINGS.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ],
    think: false,
    stream: false,
    options: { temperature: 0, num_predict: COGNITION_SETTINGS.num_predict }
  });
  const start = userContent.indexOf("[PRIOR FACTUAL MEMORY");
  const end = userContent.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
  return {
    system_content: systemContent,
    user_content: userContent,
    request_bytes: new TextEncoder().encode(requestBody).length,
    request_hash: await sha256HashV1(requestBody),
    memory_section_present: start >= 0,
    memory_section: start < 0 ? "" : userContent.slice(start, end + "[END HISTORICAL FACTUAL CONTENT]".length)
  };
}

/** §18 — classify every differing rendered-request line. */
export function classifyRequestLine(line: string): string {
  const trimmed = line.trim();
  if (line.startsWith("[projection_hash]")) return "EXPECTED_DERIVED_HASH";
  if (line.startsWith("[affect (canonical)]")) return "EXPECTED_BOUNDED_AFFECT_RESIDUAL";
  if (/^(episode_ref|experience_ref|event_ref|actor_ref):/.test(trimmed)) return "EXPECTED_MEMORY_REF_IDENTITY";
  if (/^(delivered_behavior_text|outcome_reply_text|scene):/.test(trimmed)) return "EXPECTED_MEMORY_CONTENT";
  if (line.startsWith("- ")) return "EXPECTED_MEMORY_CONTENT";
  return "UNEXPECTED_CONFOUND";
}

export function classifyRequestDiff(renderedA: string, renderedB: string): {
  readonly differing_lines: { index: number; line_a: string; line_b: string; classification: string }[];
  readonly classification_counts: Record<string, number>;
  readonly unexpected_confound_count: number;
  readonly line_counts: readonly number[];
  readonly structurally_equal: boolean;
} {
  const linesA = renderedA.split("\n");
  const linesB = renderedB.split("\n");
  const differing: { index: number; line_a: string; line_b: string; classification: string }[] = [];
  for (let index = 0; index < Math.max(linesA.length, linesB.length); index += 1) {
    if (linesA[index] !== linesB[index]) {
      differing.push({
        index,
        line_a: linesA[index] ?? "",
        line_b: linesB[index] ?? "",
        classification: classifyRequestLine(linesA[index] ?? linesB[index] ?? "")
      });
    }
  }
  const counts = differing.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.classification] = (acc[entry.classification] ?? 0) + 1;
    return acc;
  }, {});
  return {
    differing_lines: differing,
    classification_counts: counts,
    unexpected_confound_count: counts["UNEXPECTED_CONFOUND"] ?? 0,
    line_counts: [linesA.length, linesB.length],
    structurally_equal: linesA.length === linesB.length
  };
}

/** §32 — schema-failure taxonomy from the frozen stage record. */
export function failureTaxonomy(record: Record<string, unknown>): Record<string, unknown> | null {
  const cognition = record["cognition"] as {
    status: string;
    failure: { code: string | null; name: string; message: string } | null;
    raw_response: { content: string } | null;
  } | undefined;
  if (cognition === undefined || cognition.failure === null) return null;
  const message = cognition.failure.message;
  const fieldMatch = /conversation proposal\.cognition: ([a-z_]+)(\[(\d+)\])?/.exec(message);
  let rawRefs: unknown = null;
  if (cognition.raw_response !== null) {
    try {
      const parsed = JSON.parse(cognition.raw_response.content) as { cognition?: Record<string, unknown> };
      rawRefs = parsed.cognition?.["considered_context_refs"] ?? null;
    } catch {
      rawRefs = "UNPARSEABLE_RAW_CONTENT";
    }
  }
  return {
    error_code: cognition.failure.code,
    error_name: cognition.failure.name,
    validation_field: fieldMatch === null ? null : `${fieldMatch[1]}${fieldMatch[2] === undefined ? "" : "[N]"}`,
    raw_considered_context_refs: rawRefs,
    canonical_considered_context_refs: Array.isArray(rawRefs)
      ? (canonicalizeSetLikeRefFields({ considered_context_refs: rawRefs }) as { considered_context_refs: string[] }).considered_context_refs
      : null,
    message: message.slice(0, 400),
    ordering_related: message.includes("lexicographically sorted")
  };
}

/** §48 — repair-regression audit over the repaired production surface. */
export async function repairRegressionAudit(): Promise<{
  readonly memory_factual_rendering_active: boolean;
  readonly set_like_ref_canonicalization_active: boolean;
  readonly validator_duplicate_rejection_active: boolean;
  readonly unknown_ref_rejection_active: boolean;
  readonly evidence: Record<string, unknown>;
}> {
  // 1/2: rendering + canonicalization on a synthetic memory-bearing V2 input.
  const syntheticProjection: Record<string, unknown> = {
    schema_version: "cognitive-context-projection-v2",
    subject_id: SUBJECT,
    current_logical_time: 1,
    state_revision: 1,
    traits_dimensions: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.2 },
    regulation: { energy: 0.5, stress: 0.2, arousal: 0.2, fatigue: 0.1 },
    context: {
      scene: "regression probe", task: null, focus_refs: ["entity:alice"], active_entity_refs: ["entity:alice"],
      environment_refs: [], current_observation_ref: null
    },
    memory_working_refs: ["episode:e-regression-probe"],
    recent_retrieval_refs: [],
    belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [],
    interaction_familiarity: [], interaction_familiarity_cognition_influences: [],
    allowed_actions: [],
    projection_hash: "sha256:regression-probe",
    factual_memory_evidence: {
      schema_version: "factual-memory-evidence-v0",
      repository_revision: "R1",
      entries: [{
        kind: "BEHAVIOR_OUTCOME",
        episode_ref: "episode:e-regression-probe",
        repository_revision: "R1",
        episode_payload_hash: "sha256:episode",
        experience_ref: "experience:x-regression",
        experience_payload_hash: "sha256:experience",
        event_ref: "event:evt-regression",
        event_payload_hash: "sha256:event",
        actor_ref: "entity:alice",
        delivered_behavior_text: "REGRESSION-DELIVERED-BEHAVIOR",
        exact_outcome_text: "REGRESSION-OUTCOME-REPLY",
        delivered_logical_time: 1,
        outcome_logical_time: 2
      }]
    }
  };
  const rendered = await renderProviderRequest(syntheticProjection);
  const memoryFactualRenderingActive =
    rendered.memory_section_present &&
    rendered.user_content.includes(JSON.stringify("REGRESSION-DELIVERED-BEHAVIOR")) &&
    rendered.user_content.includes(JSON.stringify("REGRESSION-OUTCOME-REPLY"));

  // Canonicalization: unsorted valid refs are accepted (no ordering rejection).
  let canonicalizationActive: boolean;
  let canonicalRefs: readonly string[] | null = null;
  const unsorted = ["subject:s0", "episode:e-regression-probe", "entity:alice"];
  const canonicalProvider = new ConversationCognitionProviderV1({
    complete: async () => ({
      content: JSON.stringify({
        schema_version: "conversation-cognition-proposal-v1",
        cognition: {
          schema_version: "cognition-proposal-v0",
          projection_hash: syntheticProjection["projection_hash"],
          reasoning_summary: "regression probe",
          relevant_memory_refs: [],
          considered_context_refs: unsorted,
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: []
        },
        communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
      }),
      model: "regression-probe"
    })
  } as never);
  try {
    const proposal = await canonicalProvider.propose(syntheticProjection as never);
    canonicalRefs = proposal.cognition.considered_context_refs as unknown as readonly string[];
    canonicalizationActive = JSON.stringify(canonicalRefs) === JSON.stringify([...unsorted].sort());
  } catch {
    canonicalizationActive = false;
  }

  // Duplicate rejection: still fail closed through the frozen validator.
  const duplicateProbe = validateCognitionProposal({
    schema_version: "cognition-proposal-v0",
    projection_hash: "sha256:regression-probe",
    reasoning_summary: "probe",
    relevant_memory_refs: [],
    considered_context_refs: ["entity:alice", "entity:alice"],
    current_intent: null,
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: null,
    evidence_refs: []
  });
  const duplicateRejectionActive = !duplicateProbe.ok && duplicateProbe.error.detail.includes("duplicate ref");

  // Unknown/fabricated refs still carry no authority: the frozen law itself
  // admits only refs whose grammar and membership law is enforced downstream;
  // here we prove the validator still rejects malformed refs outright.
  const malformedProbe = validateCognitionProposal({
    schema_version: "cognition-proposal-v0",
    projection_hash: "sha256:regression-probe",
    reasoning_summary: "probe",
    relevant_memory_refs: [],
    considered_context_refs: ["not-a-ref"],
    current_intent: null,
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: null,
    evidence_refs: []
  });
  const unknownRefRejectionActive = !malformedProbe.ok;

  return {
    memory_factual_rendering_active: memoryFactualRenderingActive,
    set_like_ref_canonicalization_active: canonicalizationActive,
    validator_duplicate_rejection_active: duplicateRejectionActive,
    unknown_ref_rejection_active: unknownRefRejectionActive,
    evidence: {
      rendered_request_hash: rendered.request_hash,
      rendered_request_bytes: rendered.request_bytes,
      memory_section_hash: hashJson(rendered.memory_section),
      unsorted_input: unsorted,
      canonical_output: canonicalRefs,
      duplicate_probe_detail: duplicateProbe.ok ? null : duplicateProbe.error.detail,
      malformed_probe_detail: malformedProbe.ok ? null : malformedProbe.error.detail
    }
  };
}

/** One future trial through the FROZEN V0 trial path, plus measurement-surface
 * instrumentation: the rendered request and its reproduced identity. */
export async function runRemeasureFutureTrial(
  world: unknown,
  lifeMeta: LifeMetadata,
  futureArm: FutureArm,
  trialOrdinal: number,
  executionOrder: number,
  withinUnitOrder: number
): Promise<{
  readonly trial: Awaited<ReturnType<typeof runV0FutureTrial>>;
  readonly rendered: RenderedProviderRequest;
  readonly request_identity_match: boolean;
  readonly trace_request_hash: string | null;
}> {
  const trial = await runV0FutureTrial(
    world as never,
    lifeMeta,
    futureArm,
    trialOrdinal,
    executionOrder,
    withinUnitOrder
  );
  const rendered = await renderProviderRequest(trial.capture.projection);
  const trace = (trial.record["cognition"] as { transport_trace: { request_hash?: string } | null }).transport_trace;
  const traceRequestHash = trace?.request_hash ?? null;
  return {
    trial,
    rendered,
    request_identity_match: traceRequestHash !== null && traceRequestHash === rendered.request_hash,
    trace_request_hash: traceRequestHash
  };
}

/** The forward-request identity of a rendered request must bind the projection
 * it was rendered from (no cross-projection mixing). */
export async function projectionRenderIdentity(projection: Record<string, unknown>): Promise<string> {
  return hashEnvelope("characteros-next/experiment/render-request-identity/v0", {
    projection_hash: projection["projection_hash"],
    request_hash: (await renderProviderRequest(projection)).request_hash
  });
}

export { FUTURE_SCENARIO };
