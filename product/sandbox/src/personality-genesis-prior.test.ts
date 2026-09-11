/**
 * PERSONALITY_GENESIS_PRIOR_ADMISSION_V0 — product creation-boundary acceptance.
 *
 * Proves at the real product host:
 * - LEVEL 4: an explicitly authored P0 persists and restores exactly, with no
 *   re-genesis;
 * - creation-only authority: a different prior supplied on a later open can
 *   never rewrite an existing subject's stored disposition;
 * - empty genesis (no prior) persists as empty.
 *
 * Offline: fake transports, deterministic providers, in-memory durable store.
 * Durable persistence happens on a completed turn (the existing durable law).
 */

import { describe, expect, it } from "vitest";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  PersonalityGenesisPriorV0
} from "@characteros-next/runtime";

import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";

const SUBJECT_ID = "alice";

/** TEST FIXTURE VALUES ONLY — never defaults. */
const P0_A = { agreeableness: 0.21, conscientiousness: 0.73, extraversion: 0.18, openness: 0.84 } as const;
const P0_B = { agreeableness: 0.66, conscientiousness: 0.34, extraversion: 0.77, openness: 0.29 } as const;

function prior(values: Record<string, number>): PersonalityGenesisPriorV0 {
  return {
    schema_version: "personality-genesis-prior-v0",
    dimensions: values as unknown as PersonalityGenesisPriorV0["dimensions"]
  };
}

function cognitionTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
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

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "GENESIS_PRIOR_TEST_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function hostDeps(snapshotStore: InMemoryInteractiveSnapshotStoreV0) {
  return {
    conversationCognitionTransport: cognitionTransport(),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z",
    snapshotStore
  };
}

function hostConfig(personalityGenesisPrior?: PersonalityGenesisPriorV0): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Alice",
    session_id: "sess-genesis-prior-test",
    storage_root: "unused",
    interval_ticks: 1,
    ...(personalityGenesisPrior === undefined ? {} : { personality_genesis_prior: personalityGenesisPrior })
  };
}

interface GenesisSnapshotView {
  readonly traits_seed: { readonly dimensions: Readonly<Record<string, number>> };
  readonly personality: { readonly dimensions: readonly { readonly dimension_id: string; readonly value: number }[] };
}

function genesisOf(snapshot: unknown): GenesisSnapshotView {
  const env = (snapshot as { durable: { genesis_envelope: { snapshot: unknown } } }).durable.genesis_envelope;
  return env.snapshot as GenesisSnapshotView;
}

function personalityMap(view: GenesisSnapshotView): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dimension of view.personality.dimensions) out[dimension.dimension_id] = dimension.value;
  return out;
}

/** One completed offline turn makes the genesis durable (existing durable law). */
async function openAndPersist(
  store: InMemoryInteractiveSnapshotStoreV0,
  personalityGenesisPrior?: PersonalityGenesisPriorV0
): Promise<"NEW_SUBJECT_CREATED" | "SUBJECT_RESTORED"> {
  const host = await InteractiveSubjectHostV0.open(hostConfig(personalityGenesisPrior), hostDeps(store));
  const resolution = host.resolution();
  const outcome = await host.send("Hello there.");
  expect(outcome.status).toBe("COMPLETE");
  return resolution;
}

describe("PERSONALITY_GENESIS_PRIOR_ADMISSION_V0 — product creation boundary", () => {
  it("LEVEL 4: authored P0 persists and restores exactly across a real reopen", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    expect(await openAndPersist(store, prior(P0_A))).toBe("NEW_SUBJECT_CREATED");
    const saved = await store.load();
    if (saved.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot after a completed turn");
    expect(genesisOf(saved.snapshot).traits_seed.dimensions).toEqual(P0_A);
    expect(personalityMap(genesisOf(saved.snapshot))).toEqual(P0_A);

    // Brand-new host object graph over the same durable store.
    expect(await openAndPersist(store, prior(P0_A))).toBe("SUBJECT_RESTORED");
    const reloaded = await store.load();
    if (reloaded.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot after reopen");
    expect(genesisOf(reloaded.snapshot).traits_seed.dimensions).toEqual(P0_A);
    expect(personalityMap(genesisOf(reloaded.snapshot))).toEqual(P0_A);
  });

  it("creation-only: a different prior on reopen never rewrites the stored disposition", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    expect(await openAndPersist(store, prior(P0_A))).toBe("NEW_SUBJECT_CREATED");

    // Restart caller supplies P0_B. Canonical stored state must win.
    expect(await openAndPersist(store, prior(P0_B))).toBe("SUBJECT_RESTORED");
    const reloaded = await store.load();
    if (reloaded.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot");
    const view = genesisOf(reloaded.snapshot);
    expect(view.traits_seed.dimensions).toEqual(P0_A);
    expect(personalityMap(view)).toEqual(P0_A);
    expect(view.traits_seed.dimensions).not.toEqual(P0_B);
  });

  it("no prior ⇒ honest empty genesis persists as empty", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    expect(await openAndPersist(store)).toBe("NEW_SUBJECT_CREATED");
    const saved = await store.load();
    if (saved.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot");
    expect(genesisOf(saved.snapshot).traits_seed.dimensions).toEqual({});
    expect(genesisOf(saved.snapshot).personality.dimensions).toEqual([]);
  });
});
