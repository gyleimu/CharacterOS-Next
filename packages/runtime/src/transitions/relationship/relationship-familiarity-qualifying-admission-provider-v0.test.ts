/**
 * RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_AUTHORITY_V0 — provider tests.
 *
 * Fully offline (fake transports; real provider calls = 0). Proves the least
 * authority contract: frozen classes pass through, ABSTAIN is real, and every
 * malformed / unknown / numeric / unclosed output fails closed.
 */

import { describe, expect, it } from "vitest";
import type { ModelTransportV0 } from "../../transports/model-transport.js";
import type { EpisodicMemoryRecordV0 } from "@characteros-next/memory";

import {
  RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0
} from "./relationship-interaction-familiarity-evidence-receipt.js";
import {
  ModelRelationshipFamiliarityQualifyingAdmissionProviderV0,
  RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION,
  RelationshipFamiliarityAdmissionProviderErrorV0,
  buildRelationshipFamiliarityQualifyingAdmissionPromptMessages
} from "./relationship-familiarity-qualifying-admission-provider-v0.js";
import type { RelationshipInteractionQualifyingAdmissionInputV0 } from "./relationship-interaction-familiarity-ingestion.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice";
const SCENE = "walked and talked with alice in the park";

function episode(): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: `episode:${"a".repeat(64)}`,
    occurrence_logical_time: 1,
    recorded_at_logical_time: 1,
    provenance: { transition_id: "t-encoding-1", producer: "memory", cause_refs: [] },
    references: [ALICE],
    context: { scene: SCENE, focus_refs: [ALICE], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5, source: "ENCODING_DECLARED" }
  } as unknown as EpisodicMemoryRecordV0;
}

function input(): RelationshipInteractionQualifyingAdmissionInputV0 {
  return { subject_id: SUBJECT_ID as never, counterpart_ref: ALICE as never, episode: episode() };
}

function transportReturning(content: string): ModelTransportV0 {
  return {
    complete: async () => ({ content, model: "fake" }) as never
  } as ModelTransportV0;
}

function providerReturning(payload: unknown): ModelRelationshipFamiliarityQualifyingAdmissionProviderV0 {
  return new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({
    transport: transportReturning(JSON.stringify(payload))
  });
}

function closedQualifying(qualifying_class: string) {
  return {
    schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION,
    kind: "QUALIFYING",
    qualifying_class
  };
}

describe("RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_AUTHORITY_V0", () => {
  it("passes through each frozen qualifying class exactly", async () => {
    for (const qualifyingClass of RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0) {
      const provider = providerReturning(closedQualifying(qualifyingClass));
      await expect(provider.admit(input())).resolves.toEqual({
        kind: "QUALIFYING",
        qualifying_class: qualifyingClass
      });
    }
  });

  it("has a real ABSTAIN path", async () => {
    const provider = providerReturning({
      schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION,
      kind: "ABSTAIN"
    });
    await expect(provider.admit(input())).resolves.toEqual({ kind: "ABSTAIN" });
  });

  it("fails closed on unknown class, extra, missing or numeric fields", async () => {
    const bad: unknown[] = [
      closedQualifying("TRUST"),
      closedQualifying("DIRECT_COMMUNICATION_EXTRA"),
      { ...closedQualifying("DIRECT_COMMUNICATION"), confidence: 0.9 },
      { ...closedQualifying("DIRECT_COMMUNICATION"), familiarity: 0.7 },
      {
        schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION,
        kind: "QUALIFYING"
      },
      { schema_version: "v9", kind: "ABSTAIN" },
      { schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION, kind: "MAYBE" },
      { schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION, kind: "ABSTAIN", reason: "x" }
    ];
    for (const payload of bad) {
      await expect(providerReturning(payload).admit(input())).rejects.toMatchObject({
        code: "PROVIDER_INVALID_OUTPUT"
      });
    }
  });

  it("fails closed on malformed JSON and on an empty response", async () => {
    await expect(
      new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({
        transport: transportReturning("{ not json")
      }).admit(input())
    ).rejects.toMatchObject({ code: "PROVIDER_MALFORMED_JSON" });
    await expect(
      new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({
        transport: transportReturning("")
      }).admit(input())
    ).rejects.toMatchObject({ code: "PROVIDER_MALFORMED_JSON" });
  });

  it("fails closed when the transport fails (no fallback, no retry)", async () => {
    let calls = 0;
    const failing: ModelTransportV0 = {
      complete: async () => {
        calls += 1;
        throw new Error("transport offline");
      }
    } as ModelTransportV0;
    await expect(
      new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({ transport: failing }).admit(input())
    ).rejects.toBeInstanceOf(RelationshipFamiliarityAdmissionProviderErrorV0);
    expect(calls).toBe(1);
  });

  it("prompt carries the frozen classes and rules, and no numeric familiarity material", () => {
    const messages = buildRelationshipFamiliarityQualifyingAdmissionPromptMessages(input());
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    const system = messages[0]?.content ?? "";
    const user = messages[1]?.content ?? "";
    for (const qualifyingClass of RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0) {
      expect(system).toContain(qualifyingClass);
    }
    expect(system).toContain("ABSTAIN");
    expect(system).toContain("Familiarity is NOT valence and NOT importance");
    expect(system).toContain("Do not output any number");
    // Only the exact scene text is shown, inside the untrusted-data delimiter.
    expect(user).toContain(JSON.stringify(SCENE));
    expect(user).toContain("untrusted data");
    // Provider can never choose identity or see values.
    expect(system).not.toContain(ALICE);
    expect(user).not.toContain(ALICE);
    expect(user).not.toContain("familiarity");
  });
});
