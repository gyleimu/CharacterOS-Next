/**
 * EXTERNAL_STRUCTURED_OBSERVATION_PRODUCT_INGRESS_V0 — product acceptance.
 *
 * Offline (deterministic fakes, 0 real provider calls): one bounded shared-subject
 * ingress turns a source-attributed structured external observation into exactly
 * one lawful canonical Observation → Experience → Memory path, with canonical
 * idempotency (FIRST/REPLAY/CONFLICT), provenance, firewalls, restart and
 * cross-context reach into future cognition.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import {
  EXTERNAL_OBSERVATION_ID_PROJECTION,
  submitExternalObservationV0,
  type ExternalObservationIngressDepsV0,
  type ExternalStructuredObservationRequestV0
} from "./external-observation-ingress.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0,
  type InteractiveSubjectHostDepsV0
} from "./interactive-subject-host.js";
import {
  EnvironmentSubjectHostV0,
  type EnvironmentSubjectHostConfigV0
} from "./environment-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import type { RelationshipInteractionQualifyingAdmissionProviderV0 } from "@characteros-next/runtime";

const SUBJECT_ID = "ext-obs-subject";
const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-extobs-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

function cognitionTransport(recorder: { requests: string[] }): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      recorder.requests.push(user);
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline external-observation cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond",
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
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "Noted.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function humanConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "External Observer",
    session_id: "interactive-ext",
    storage_root: dir,
    interval_ticks: 1
  };
}

function humanDeps(dir: string, recorder: { requests: string[] }): InteractiveSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

function ingressDeps(dir: string, extra: Partial<ExternalObservationIngressDepsV0> = {}): ExternalObservationIngressDepsV0 {
  return {
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    subject: { subject_id: SUBJECT_ID, display_name: "External Observer", identity_anchors: [] },
    clock: () => "2026-01-01T00:00:00.000Z",
    ...extra
  };
}

async function sharedDocument(dir: string) {
  const loaded = await new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID).load();
  if (loaded.kind !== "DOCUMENT") throw new Error("expected a shared canonical subject source");
  return loaded.document;
}

interface BundleView {
  readonly canonical_proposal?: {
    readonly transition_type?: string;
    readonly cause_refs?: readonly string[];
    readonly external_refs?: readonly string[];
    readonly domain_deltas?: readonly { readonly operations?: readonly { readonly value?: Record<string, unknown> }[] }[];
  };
  readonly next_snapshot?: {
    readonly context: {
      readonly scene: string;
      readonly task: string | null;
      readonly active_entity_refs: readonly string[];
      readonly focus_refs: readonly string[];
      readonly environment_refs: readonly string[];
    };
  };
}

function bundlesOf(document: Awaited<ReturnType<typeof sharedDocument>>): BundleView[] {
  return document.store.committed_bundles as unknown as BundleView[];
}

function externalObservationBundle(
  document: Awaited<ReturnType<typeof sharedDocument>>,
  sourceRef: string,
  eventRef: string
): BundleView | undefined {
  return bundlesOf(document).find((bundle) => {
    const proposal = bundle.canonical_proposal;
    if (proposal?.transition_type !== "Observation") return false;
    const cause = proposal.cause_refs ?? [];
    const external = proposal.external_refs ?? [];
    return cause.includes(sourceRef) && external.includes(eventRef);
  });
}

/** Seeds a persistent shared subject (with a prior human turn). */
async function seedSubject(dir: string): Promise<void> {
  const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, { requests: [] }));
  const turn = await human.send("Alice says hello.");
  expect(turn.status).toBe("COMPLETE");
}

const observationRequest = (overrides: Partial<ExternalStructuredObservationRequestV0> = {}): ExternalStructuredObservationRequestV0 => ({
  source_ref: "source:camera-front-door",
  event_ref: "event:door-open-1",
  entity_refs: ["entity:alice"],
  scene: "The front-door camera reported: a person entered the room.",
  task: null,
  ...overrides
});

describe("EXTERNAL_STRUCTURED_OBSERVATION_PRODUCT_INGRESS_V0 — structured external observation", () => {
  it("LEVEL 1/2/3/8: FIRST commits generic Observation → Experience → Memory with provenance and firewalls", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const before = await sharedDocument(dir);
    const snapBefore = bundlesOf(before).at(-1)?.next_snapshot;

    const result = await submitExternalObservationV0(ingressDeps(dir), observationRequest());
    expect(result.kind).toBe("FIRST");
    if (result.kind !== "FIRST") return;
    expect(result.observation_ref.startsWith("observation:")).toBe(true);
    expect(result.episode_ref.startsWith("episode:")).toBe(true);

    const after = await sharedDocument(dir);
    // LEVEL 1 — generic canonical Observation, no human/environment impersonation.
    const observationBundle = externalObservationBundle(after, "source:camera-front-door", "event:door-open-1");
    expect(observationBundle).toBeDefined();
    expect(observationBundle?.canonical_proposal?.transition_type).toBe("Observation");
    // LEVEL 3 — provenance recoverable from canonical artifacts: the reporting
    // source in the cause lineage, the external event identity as external
    // provenance (never an admitted conversation event cause ref).
    expect(observationBundle?.canonical_proposal?.cause_refs).toContain("source:camera-front-door");
    expect(observationBundle?.canonical_proposal?.external_refs).toContain("event:door-open-1");
    expect(observationBundle?.canonical_proposal?.cause_refs).not.toContain("event:door-open-1");
    expect(observationBundle?.canonical_proposal?.cause_refs).not.toContain("entity:alice");
    // Observed entity survives into the committed context, separate from the source.
    expect(observationBundle?.next_snapshot?.context.active_entity_refs).toContain("entity:alice");
    expect(observationBundle?.next_snapshot?.context.scene).toContain("front-door camera reported");
    expect(observationBundle?.next_snapshot?.context.scene).not.toContain("Alice says");
    // LEVEL 2 — the episode is canonical persistent Memory.
    const persistedRefs = after.store.revisions.flatMap((revision) => revision.payloads.map((entry) => entry.ref));
    expect(persistedRefs).toContain(result.episode_ref);
    expect(result.base_revision).toBe(before.base_revision + 1);

    // LEVEL 8 firewalls.
    const snapAfter = bundlesOf(after).at(-1)?.next_snapshot as Record<string, unknown>;
    const snapBeforeRecord = snapBefore as unknown as Record<string, unknown>;
    expect((snapAfter["runtime_metadata"] as { logical_time: number }).logical_time).toBe(
      (snapBeforeRecord["runtime_metadata"] as { logical_time: number }).logical_time
    );
    expect(snapAfter["beliefs"]).toEqual(snapBeforeRecord["beliefs"]);
    expect(snapAfter["personality"]).toEqual(snapBeforeRecord["personality"]);
    expect(snapAfter["relationships"]).toEqual(snapBeforeRecord["relationships"]);
    // No fake environment was created.
    expect(existsSync(join(dir, `subject-${SUBJECT_ID}.environment-product-review-environment-v0.checkpoint.json`))).toBe(false);
  }, 60000);

  it("LEVEL 4: FIRST/REPLAY/CONFLICT idempotency from canonical history, across revisions", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const first = await submitExternalObservationV0(ingressDeps(dir), observationRequest());
    expect(first.kind).toBe("FIRST");
    if (first.kind !== "FIRST") return;

    // Advance the subject so the retry happens at a later revision.
    await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest({ event_ref: "event:door-open-2", scene: "The camera reported: the door closed." })
    );
    const beforeReplay = await sharedDocument(dir);
    const bundleCountBefore = bundlesOf(beforeReplay).length;

    const replay = await submitExternalObservationV0(ingressDeps(dir), observationRequest());
    expect(replay.kind).toBe("REPLAY");
    const afterReplay = await sharedDocument(dir);
    expect(afterReplay.base_revision).toBe(beforeReplay.base_revision);
    expect(bundlesOf(afterReplay).length).toBe(bundleCountBefore);
    const episodeCount = afterReplay.store.revisions.flatMap((r) => r.payloads.map((p) => p.ref)).filter((ref) => ref.startsWith("episode:")).length;
    const episodeCountBefore = beforeReplay.store.revisions.flatMap((r) => r.payloads.map((p) => p.ref)).filter((ref) => ref.startsWith("episode:")).length;
    expect(episodeCount).toBe(episodeCountBefore);

    // Same identity, different semantic payload → CONFLICT, history unchanged.
    const conflict = await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest({ scene: "The front-door camera reported: nobody was there." })
    );
    expect(conflict.kind).toBe("CONFLICT");
    expect((await sharedDocument(dir)).base_revision).toBe(afterReplay.base_revision);

    // Different events / different sources are distinct identities.
    const differentEvent = await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest({ event_ref: "event:door-open-3" })
    );
    expect(differentEvent.kind).toBe("FIRST");
    const differentSource = await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest({ source_ref: "source:camera-back-door" })
    );
    expect(differentSource.kind).toBe("FIRST");
  }, 60000);

  it("LEVEL 5/6/7: external history survives restart and reaches both contexts' cognition", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const first = await submitExternalObservationV0(ingressDeps(dir), observationRequest());
    expect(first.kind).toBe("FIRST");
    if (first.kind !== "FIRST") return;

    // Fresh-process equivalent: canonical history + dedup both still hold.
    const replayAfterRestart = await submitExternalObservationV0(ingressDeps(dir), observationRequest());
    expect(replayAfterRestart.kind).toBe("REPLAY");

    // Environment context restores the same canonical history.
    const envRecorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(
      envConfig(dir),
      {
        conversationCognitionTransport: cognitionTransport(envRecorder),
        languageTransport: languageTransport(),
        factualEventAppraisalProvider: createConstantAppraisalProviderV0(),
        sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
        clock: () => "2026-01-01T00:00:00.000Z"
      }
    );
    expect(env.resolution()).toBe("ENVIRONMENT_SUBJECT_RESTORED");
    expect(env.sharedRevision()).toBe((await sharedDocument(dir)).base_revision);

    // Human context: the external-originated episode is available through normal Memory.
    const recorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorder));
    const turn = await human.send("Alice asks what happened at the front door.");
    expect(turn.status, turn.failure ?? "no detail").toBe("COMPLETE");
    const request = recorder.requests.at(-1) as string;
    expect(turn.provider_memory_section_present).toBe(true);
    expect(request).not.toContain("[external observation]");
    const surfaced = request.includes(first.episode_ref) || turn.working_episode_refs.includes(first.episode_ref);
    expect(surfaced).toBe(true);
  }, 60000);

  it("LEVEL 8 + concurrent controls: stale writer resolves to REPLAY, not a second experience", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const head = await sharedDocument(dir);

    // Client A commits the event.
    expect((await submitExternalObservationV0(ingressDeps(dir), observationRequest())).kind).toBe("FIRST");
    const afterA = await sharedDocument(dir);
    const bundleCount = bundlesOf(afterA).length;

    // Client B, stale at R, submits the SAME event → must resolve to REPLAY.
    const staleReplay = await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest(),
      { expectedBaseRevision: head.base_revision }
    );
    expect(staleReplay.kind).toBe("REPLAY");
    expect((await sharedDocument(dir)).base_revision).toBe(afterA.base_revision);
    expect(bundlesOf(await sharedDocument(dir)).length).toBe(bundleCount);

    // Client B, stale at R, submits a DIFFERENT payload for the same identity.
    const staleConflict = await submitExternalObservationV0(
      ingressDeps(dir),
      observationRequest({ scene: "Different report from the same event." }),
      { expectedBaseRevision: head.base_revision }
    );
    expect(staleConflict.kind).toBe("CONFLICT");

    // Client B, stale at R, submits a genuinely new event → fail closed (no overwrite).
    await expect(
      submitExternalObservationV0(
        ingressDeps(dir),
        observationRequest({ event_ref: "event:door-open-9" }),
        { expectedBaseRevision: head.base_revision }
      )
    ).rejects.toThrow(/CROSS_CONTEXT_STALE_WRITE/);
    expect((await sharedDocument(dir)).base_revision).toBe(afterA.base_revision);
  }, 60000);

  it("LEVEL 9: the completed episode is offered to the existing adaptation runners (no forced mutation)", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const before = await sharedDocument(dir);
    const snapBefore = bundlesOf(before).at(-1)?.next_snapshot as unknown as Record<string, unknown>;

    const abstain: RelationshipInteractionQualifyingAdmissionProviderV0 = {
      async admit() {
        return { kind: "ABSTAIN" };
      }
    };
    const noBearingBelief = {
      async propose(input: { readonly semantic_context_fingerprint: string; readonly candidate_catalog_fingerprint: string }) {
        return {
          schema_version: "belief-semantic-provider-output-v0",
          kind: "NO_BEARING",
          semantic_context_fingerprint: input.semantic_context_fingerprint,
          candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
        } as never;
      }
    };
    const result = await submitExternalObservationV0(
      ingressDeps(dir, {
        relationshipFamiliarityAdmissionProvider: abstain,
        beliefSemanticProvider: noBearingBelief as never
      }),
      observationRequest({ entity_refs: ["entity:carol"], scene: "The camera reported: carol entered the lobby." })
    );
    expect(result.kind).toBe("FIRST");

    const after = await sharedDocument(dir);
    const snapAfter = bundlesOf(after).at(-1)?.next_snapshot as unknown as Record<string, unknown>;
    // Domain-local authority decided no change; nothing was forced.
    expect(snapAfter["relationships"]).toEqual(snapBefore["relationships"]);
    expect(snapAfter["personality"]).toEqual(snapBefore["personality"]);
    expect(snapAfter["beliefs"]).toEqual(snapBefore["beliefs"]);
  }, 60000);

  it("rejects invalid requests before any canonical effect", async () => {
    const dir = makeTempDir();
    await seedSubject(dir);
    const head = await sharedDocument(dir);
    for (const bad of [
      observationRequest({ source_ref: "entity:not-a-source" }),
      observationRequest({ event_ref: "source:not-an-event" }),
      observationRequest({ entity_refs: ["source:nope"] }),
      observationRequest({ scene: "" })
    ]) {
      await expect(submitExternalObservationV0(ingressDeps(dir), bad)).rejects.toThrow(
        /EXTERNAL_OBSERVATION_INVALID_REQUEST/
      );
    }
    expect((await sharedDocument(dir)).base_revision).toBe(head.base_revision);
    expect(EXTERNAL_OBSERVATION_ID_PROJECTION.length).toBeGreaterThan(0);
  }, 60000);
});

function envConfig(dir: string): EnvironmentSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "External Observer",
    session_id: "environment-ext",
    storage_root: dir,
    interaction_interval_ticks: 1
  };
}
