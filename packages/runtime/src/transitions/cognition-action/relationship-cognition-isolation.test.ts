/**
 * RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — Seal C.
 *
 * LEVEL_5_RELATIONSHIP_CAUSAL_CONTRIBUTION_ISOLATED: two lawful V4 states are
 * identical in EVERY cognition-relevant field (identity, current event, Memory,
 * affect, beliefs, Personality, traits_seed, regulation, context, allowed
 * actions, counterpart count and every other Relationship feature) and differ
 * ONLY in the canonical `relationship_core_interaction_familiarity_v0` value.
 *
 * The projections are built by the NORMAL trusted production builder
 * (buildCognitiveContextProjectionV2ForExplicitV4) and rendered by the NORMAL
 * production cognition provider (ConversationCognitionProviderV1). No renderer
 * text is injected and no projection field is edited after construction.
 *
 * Fully offline: fake transport — real-model calls = 0.
 */

import { describe, expect, it } from "vitest";

import { materializeSubjectStateV4V0, type SubjectStateV0 } from "@characteros-next/subject-core";

import { s0 } from "../observation/observation-fixtures.js";
import {
  buildCognitiveContextProjectionV2ForExplicitV4
} from "./cognition-action-transition-executor.js";
import { ConversationCognitionProviderV1 } from "../../providers/behavior/conversation-cognition-provider.js";
import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../../transports/model-transport.js";

const SUBJECT_ID = "subject-l5-rel";
const ALICE = "entity:alice-l5";
/** The one frozen governed Relationship feature (literal avoids a cross-folder import). */
const PROFILE = "relationship_core_interaction_familiarity_v0";

function v3Source(familiarity: number): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  return {
    ...base,
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: SUBJECT_ID },
    context: {
      ...(base["context"] as Record<string, unknown>),
      scene: "same current scene",
      task: "reply",
      focus_refs: [ALICE],
      active_entity_refs: [ALICE],
      environment_refs: []
    },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [{ dimension_id: PROFILE, value: familiarity }]
        }
      ]
    }
  } as unknown as SubjectStateV0;
}

async function v4State(familiarity: number) {
  const binding = {
    repository_revision: "R0",
    repository_revision_hash: `sha256:${"a".repeat(64)}`
  };
  const genesis = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0",
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
      v3_source: v3Source(familiarity),
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async () => true
  } as never);
  if (!genesis.ok) throw new Error(`v4 genesis failed: ${genesis.code} ${genesis.detail}`);
  return genesis.state;
}

function capturingTransport(sink: string[], projectionHash: string): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      sink.push(request.messages.find((message) => message.role === "user")?.content ?? "");
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond to the user",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

async function render(familiarity: number): Promise<{ readonly projection: Record<string, unknown>; readonly user: string }> {
  const projection = await buildCognitiveContextProjectionV2ForExplicitV4(await v4State(familiarity));
  const sink: string[] = [];
  const provider = new ConversationCognitionProviderV1(
    capturingTransport(sink, projection.projection_hash as string)
  );
  await provider.propose(projection);
  expect(sink).toHaveLength(1);
  return { projection: projection as unknown as Record<string, unknown>, user: sink[0] as string };
}

/** Familiarity-derived fields plus the content-derived projection hash. */
const RELATIONSHIP_DERIVED = [
  "interaction_familiarity",
  "interaction_familiarity_cognition_influences",
  "projection_hash"
] as const;

describe("RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — Level 5 isolation", () => {
  it("only canonical familiarity differs: identical projection material, different familiarity material", async () => {
    const one = await render(1 / 32);
    const two = await render(2 / 32);

    const withoutFamiliarity = (projection: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(projection).filter(
          ([key]) => !(RELATIONSHIP_DERIVED as readonly string[]).includes(key)
        )
      );
    // ALL non-Relationship cognition material is equivalent.
    expect(withoutFamiliarity(two.projection)).toEqual(withoutFamiliarity(one.projection));
    // The target familiarity material differs.
    expect(two.projection["interaction_familiarity"]).not.toEqual(one.projection["interaction_familiarity"]);
  });

  it("the rendered cognition request differs ONLY on the canonical familiarity line", async () => {
    const one = await render(1 / 32);
    const two = await render(2 / 32);
    const before = one.user.split("\n");
    const after = two.user.split("\n");
    expect(after).toHaveLength(before.length);
    const differing = before.filter((line, index) => line !== after[index]);
    // Exactly three lines differ, and every one is attributable to the canonical
    // familiarity value: the credited level, the familiarity-derived context
    // resolution strategy, and the content-derived projection hash.
    expect(differing).toHaveLength(3);
    expect(differing.filter((line) => line.includes("presence=PRESENT level="))).toHaveLength(1);
    expect(differing.filter((line) => line.includes("context_resolution_strategy="))).toHaveLength(1);
    expect(differing.filter((line) => line.startsWith("[projection_hash]"))).toHaveLength(1);
    expect(one.user).toContain(`${ALICE}: presence=PRESENT level=1/32`);
    expect(two.user).toContain(`${ALICE}: presence=PRESENT level=2/32`);

    // Everything else — including every non-familiarity Relationship line and
    // the immutable traits seed — is byte-identical.
    const lineOf = (text: string, prefix: string): string | undefined =>
      text.split("\n").find((entry) => entry.startsWith(prefix));
    for (const prefix of ["[relationships]", "[traits seed", "[affect (canonical)]", "[regulation]", "[context]"]) {
      expect(lineOf(two.user, prefix), prefix).toBe(lineOf(one.user, prefix));
    }
    expect(two.user).not.toContain(PROFILE);
  });
});
