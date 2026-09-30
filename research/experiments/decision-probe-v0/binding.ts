/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — PROJECTION BINDING. RESEARCH-ONLY.
 *
 * This is the one binding the instrument deliberately does not own: turning a fixture
 * observation into the `ModelTransportRequestV0` the PRODUCTION path would actually send.
 *
 * Provenance chain (nothing here is hand-written subject data):
 *
 *   fixture.observation_text
 *     → `buildWorld(task)`                    production genesis: the observation becomes the
 *                                             genesis seed's lawful `context.task` through
 *                                             `materializeSubjectStateV4V0`
 *     → `runCognitionCapture(world, [])`      the production `CognitionActionTransitionExecutor`
 *                                             builds the real projection and hands it to a
 *                                             capturing provider
 *     → `cognitionSystemPromptForV8(projection)` + `cognitionUserContentForV8(projection, {})`
 *                                             the EXACT two expressions the production
 *                                             `ConversationCognitionProviderV8.propose()` uses
 *     → `{ messages, structured_output: { JSON_SCHEMA, V8 schema } }`
 *                                             the exact request object V8 hands its transport
 *
 * Equivalence with the real provider is not asserted here; it is PROVED by the B2 test, which
 * instantiates `ConversationCognitionProviderV8` over a capturing transport and compares the
 * request it emits for the same projection byte-for-byte against this binding's output.
 *
 * FORBIDDEN here and enforced by tests: rendering subject data by hand, simplifying the
 * projection, adding episodic history / retrieval snippets / summaries / training text /
 * debug history / provenance.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { runCognitionCapture } from "../canonical-affect-behavior-influence-v1/harness.ts";
import type { DecisionProbeD0FixtureV0 } from "./fixtures.ts";
import { buildFixtureWorldWithObservationV0 } from "./observation-binding.ts";

export const DECISION_PROBE_BINDING_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe/binding/v0" as const;

export interface DecisionProbeBoundRequestV0 {
  readonly fixture_id: string;
  readonly subject_id: string;
  readonly state_revision: number;
  /** The production request, captured — never re-authored. */
  readonly production_request: ModelTransportRequestV0;
  readonly provenance: {
    readonly genesis: "materializeSubjectStateV4V0+EXPLICIT_V4_FOUNDATION_V0";
    readonly projection_builder: "CognitionActionTransitionExecutor";
    readonly renderer_system: "cognitionSystemPromptForV8";
    readonly renderer_user: "cognitionUserContentForV8";
    readonly output_schema: "CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA";
    readonly observation_channel: "production Observation commit (buildContextDelta → buildObservationProposal → commitReserved); scene carries the fixture text, task is null";
  };
  /** The committed current-observation ref and scene, for O1–O3 verification. */
  readonly observation: {
    readonly observation_ref: string;
    readonly scene: string;
    readonly task: string | null;
  };
  readonly hashes: {
    readonly projection_hash: string;
    readonly production_request_hash: HashV1;
    readonly system_content_hash: HashV1;
    readonly user_content_hash: HashV1;
    readonly production_schema_hash: HashV1;
    readonly binding_hash: HashV1;
  };
}

function messageContent(request: ModelTransportRequestV0, role: string): string {
  return request.messages.find((message) => message.role === role)?.content ?? "";
}

/**
 * Builds the production request for one D0 fixture. Deterministic: the same fixture yields
 * the same `production_request_hash` (B7).
 */
export async function captureProductionRequestForFixtureV0(
  fixture: DecisionProbeD0FixtureV0
): Promise<DecisionProbeBoundRequestV0> {
  // D0Q_RUN_002 REPAIR: the observation is committed through the production observation path
  // so `[current observation]` is a real ref and `[context] scene=` carries the fixture text.
  // This is the ONLY request-path change relative to RUN_001.
  const fixtureWorld = await buildFixtureWorldWithObservationV0(fixture);
  const capture = await runCognitionCapture(fixtureWorld.world, []);
  const projection = capture.provider_input as {
    readonly subject_id: string;
    readonly state_revision: number;
    readonly projection_hash: string;
  };

  const messages = Object.freeze([
    Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
    Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
  ]);
  const productionRequest: ModelTransportRequestV0 = Object.freeze({
    messages,
    structured_output: Object.freeze({
      kind: "JSON_SCHEMA" as const,
      schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
    })
  });

  const systemContent = messageContent(productionRequest, "system");
  const userContent = messageContent(productionRequest, "user");
  const body = Object.freeze({
    fixture_id: fixture.fixture_id,
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    projection_hash: projection.projection_hash,
    system_content_hash: await hashEnvelope(DECISION_PROBE_BINDING_HASH_PROJECTION_V0, {
      system_content: systemContent
    }),
    user_content_hash: await hashEnvelope(DECISION_PROBE_BINDING_HASH_PROJECTION_V0, {
      user_content: userContent
    }),
    production_schema_hash: await hashEnvelope(DECISION_PROBE_BINDING_HASH_PROJECTION_V0, {
      production_schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
    }),
    production_request_hash: await hashEnvelope(
      "characteros-next/research/decision-probe/request/v0",
      productionRequest as unknown
    )
  });

  return Object.freeze({
    fixture_id: fixture.fixture_id,
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    production_request: productionRequest,
    provenance: Object.freeze({
      genesis: "materializeSubjectStateV4V0+EXPLICIT_V4_FOUNDATION_V0" as const,
      projection_builder: "CognitionActionTransitionExecutor" as const,
      renderer_system: "cognitionSystemPromptForV8" as const,
      renderer_user: "cognitionUserContentForV8" as const,
      output_schema: "CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA" as const,
      observation_channel:
        "production Observation commit (buildContextDelta → buildObservationProposal → commitReserved); scene carries the fixture text, task is null" as const
    }),
    observation: Object.freeze({
      observation_ref: fixtureWorld.observation_ref,
      scene: fixtureWorld.scene,
      task: fixtureWorld.task
    }),
    hashes: Object.freeze({
      ...body,
      projection_hash: projection.projection_hash,
      binding_hash: await hashEnvelope(DECISION_PROBE_BINDING_HASH_PROJECTION_V0, body)
    })
  });
}

/** Exported for the B5 test: the instrument's own renderer must never be used by the probe. */
export { messageContent as decisionProbeMessageContentV0 };
