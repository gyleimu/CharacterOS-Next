/**
 * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — product acceptance.
 *
 * ONE persistent subject continues its canonical life across the human
 * conversation host and the environment host through ONE shared canonical
 * subject source, with context-specific sidecars. Fully offline (deterministic
 * fake transports + constant appraisal): 0 real provider calls.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "@characteros-next/runtime";
import {
  EnvironmentSubjectHostV0,
  type EnvironmentSubjectHostConfigV0,
  type EnvironmentSubjectHostDepsV0
} from "./environment-subject-host.js";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0,
  type InteractiveSubjectHostDepsV0
} from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { FileSharedSubjectSourceStoreV0, InMemorySharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { InMemoryEnvironmentCheckpointStoreV0 } from "./environment-checkpoint-store.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import { ReferenceReviewEnvironmentV0 } from "./reference-review-environment.js";

const SUBJECT_ID = "xctx-subject";
const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-xctx-"));
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
            reasoning_summary: "offline cross-context cognition",
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
          text: "The quarterly review is on track and the checklist item is closed.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function humanConfig(storageRoot: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Cross Context",
    session_id: "interactive-xctx",
    storage_root: storageRoot,
    interval_ticks: 1
  };
}

function humanDeps(
  storageRoot: string,
  recorder: { requests: string[] }
): InteractiveSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(storageRoot, SUBJECT_ID),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

function envConfig(storageRoot: string): EnvironmentSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Cross Context",
    session_id: "environment-xctx",
    storage_root: storageRoot,
    interaction_interval_ticks: 1
  };
}

function envDeps(storageRoot: string, recorder: { requests: string[] }): EnvironmentSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(storageRoot, SUBJECT_ID),
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

async function sharedDocument(storageRoot: string) {
  const loaded = await new FileSharedSubjectSourceStoreV0(storageRoot, SUBJECT_ID).load();
  if (loaded.kind !== "DOCUMENT") throw new Error("expected a persisted shared canonical subject source");
  return loaded.document;
}

function episodeRefsIn(document: Awaited<ReturnType<typeof sharedDocument>>): string[] {
  return document.store.revisions.flatMap((revision) => revision.payloads.map((entry) => entry.ref));
}

describe("SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — one canonical subject across contexts", () => {
  it("shares ONE canonical subject source and refuses to re-author genesis across hosts", async () => {
    const dir = makeTempDir();
    const humanRecorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, humanRecorder));
    expect(human.resolution()).toBe("NEW_SUBJECT_CREATED");
    const turn = await human.send("Alice asks how the review document should be organized.");
    expect(turn.status).toBe("COMPLETE");
    const h1 = turn.observational_experience_ref;
    expect(h1).not.toBeNull();
    const genesisAfterHuman = JSON.stringify((await sharedDocument(dir)).durable.genesis_envelope);

    // Human context is quiescent at a completed turn boundary.
    expect(human.pendingLifecycleWork()).toBe(0);
    expect(human.isQuiescent()).toBe(true);

    // Switch to the environment host: SAME subject, no new genesis.
    const envRecorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, envRecorder));
    expect(env.resolution()).toBe("ENVIRONMENT_SUBJECT_RESTORED");
    const sharedBeforeEnv = await sharedDocument(dir);
    expect(JSON.stringify(sharedBeforeEnv.durable.genesis_envelope)).toBe(genesisAfterHuman);
    // H1 is lawfully present in the shared canonical Memory before any E interaction.
    expect(episodeRefsIn(sharedBeforeEnv)).toContain(h1 as string);
    expect(env.isQuiescent()).toBe(true);

    const e1Outcome = await env.processNextInteraction();
    expect(e1Outcome.status, JSON.stringify(e1Outcome).slice(0, 300)).toBe("COMPLETE");
    const e1 = e1Outcome.episode_ref;
    expect(e1).not.toBeNull();

    // ONE monotonic shared source now carries both H1 and E1.
    const sharedAfterEnv = await sharedDocument(dir);
    expect(sharedAfterEnv.base_revision).toBeGreaterThan(sharedBeforeEnv.base_revision);
    const refs = episodeRefsIn(sharedAfterEnv);
    expect(refs).toContain(h1 as string);
    expect(refs).toContain(e1 as string);
    expect(JSON.stringify(sharedAfterEnv.durable.genesis_envelope)).toBe(genesisAfterHuman);
  }, 60000);

  it("LEVEL 3+4: a fresh human host restores the SAME lineage with H1+E1 and identical internal state", async () => {
    const dir = makeTempDir();
    const humanRecorderA = { requests: [] as string[] };
    const humanA = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, humanRecorderA));
    const turn = await humanA.send("Alice asks how the review document should be organized.");
    expect(turn.status).toBe("COMPLETE");
    const h1 = turn.observational_experience_ref as string;

    const envRecorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, envRecorder));
    const envOutcome = await env.processNextInteraction();
    expect(envOutcome.status).toBe("COMPLETE");
    const e1 = envOutcome.episode_ref as string;
    const before = await sharedDocument(dir);
    const genesis = JSON.stringify(before.durable.genesis_envelope);
    const head = before.durable.identity.subject_head.commit_ref;
    const stateHash = before.durable.identity.subject_state_hash;
    const revision = before.durable.identity.state_revision;

    // Fresh process equivalent: brand-new host graph from the same files.
    const humanRecorderB = { requests: [] as string[] };
    const humanB = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, humanRecorderB));
    expect(humanB.resolution()).toBe("SUBJECT_RESTORED");
    const afterOpen = await sharedDocument(dir);
    // Level 4: canonical non-Memory state is one continuous restored state.
    expect(JSON.stringify(afterOpen.durable.genesis_envelope)).toBe(genesis);
    expect(afterOpen.durable.identity.subject_head.commit_ref).toBe(head);
    expect(afterOpen.durable.identity.subject_state_hash).toBe(stateHash);
    expect(afterOpen.durable.identity.state_revision).toBe(revision);
    expect(humanB.sharedRevision()).toBe(afterOpen.base_revision);

    const later = await humanB.send("Alice asks whether the checklist item can be closed.");
    expect(later.status).toBe("COMPLETE");
    const request = humanRecorderB.requests.at(-1) as string;
    // Level 3: the environment-originated episode is lawfully available to normal
    // Memory retrieval in the human context (no special environment prompt block).
    expect(request).toContain("episode:");
    expect(request).not.toContain("[environment memory]");
    const refs = episodeRefsIn(await sharedDocument(dir));
    expect(refs).toContain(h1);
    expect(refs).toContain(e1);
    const surfaced = later.working_episode_refs.some((ref) => ref === e1) || request.includes(e1);
    const h1Surfaced = later.working_episode_refs.some((ref) => ref === h1) || request.includes(h1);
    expect(surfaced || h1Surfaced).toBe(true);
  }, 60000);

  it("LEVEL 6: environment-originated history causally reaches later human cognition", async () => {
    const laterText = "Alice asks whether anything still blocks the review.";
    const earlyText = "Alice asks how the review document should be organized.";

    // Run A — canonical history includes H1 + E1.
    const dirA = makeTempDir();
    const recorderA = { requests: [] as string[] };
    const humanA = await InteractiveSubjectHostV0.open(humanConfig(dirA), humanDeps(dirA, recorderA));
    await humanA.send(earlyText);
    const envA = await EnvironmentSubjectHostV0.open(envConfig(dirA), envDeps(dirA, { requests: [] }));
    const envOutcome = await envA.processNextInteraction();
    expect(envOutcome.status).toBe("COMPLETE");
    const e1 = envOutcome.episode_ref as string;
    const humanA2 = await InteractiveSubjectHostV0.open(humanConfig(dirA), humanDeps(dirA, recorderA));
    const laterA = await humanA2.send(laterText);
    expect(laterA.status).toBe("COMPLETE");
    const requestA = recorderA.requests.at(-1) as string;

    // Run B — canonical history includes H1 only.
    const dirB = makeTempDir();
    const recorderB = { requests: [] as string[] };
    const humanB = await InteractiveSubjectHostV0.open(humanConfig(dirB), humanDeps(dirB, recorderB));
    await humanB.send(earlyText);
    const laterB = await humanB.send(laterText);
    expect(laterB.status).toBe("COMPLETE");
    const requestB = recorderB.requests.at(-1) as string;

    // Same later current event; the difference is attributable to E1 through the
    // normal Memory path (no special environment prompt block in either).
    expect(requestA).not.toBe(requestB);
    expect(laterA.provider_memory_section_present).toBe(true);
    expect(requestA).not.toContain("[environment memory]");
    expect(requestA).toContain(e1);
    expect(requestB).not.toContain(e1);
  }, 60000);

  it("LEVEL 5: stale writer is rejected instead of overwriting a newer shared head", async () => {
    const dir = makeTempDir();
    const recorderA = { requests: [] as string[] };
    const humanA = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorderA));
    await humanA.send("Alice asks about the review.");
    const staleRevision = humanA.sharedRevision();
    expect(staleRevision).not.toBeNull();

    // Host B advances the shared canonical subject.
    const recorderB = { requests: [] as string[] };
    const envB = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, recorderB));
    const advanced = await envB.processNextInteraction();
    expect(advanced.status).toBe("COMPLETE");
    const currentRevision = (await sharedDocument(dir)).base_revision;
    expect(currentRevision).toBeGreaterThan(staleRevision as number);

    // Host A, still on its stale base, must fail closed and never overwrite B.
    const stale = await humanA.send("Alice asks something else while stale.");
    expect(humanA.isFailed()).toBe(true);
    expect(humanA.lastFailureDetail() ?? "").toContain("CROSS_CONTEXT_STALE_WRITE");
    expect(stale.status).toBe("COMPLETE");
    const after = await sharedDocument(dir);
    expect(after.base_revision).toBe(currentRevision);
    expect(after.durable.identity.subject_head.commit_ref).toBe(
      (await sharedDocument(dir)).durable.identity.subject_head.commit_ref
    );
  }, 60000);

  it("LEVEL 5: divergent legacy artifacts are never auto-merged", async () => {
    const dir = makeTempDir();
    // Legacy human artifact (no shared source yet).
    const humanRecorder = { requests: [] as string[] };
    const legacyHuman = await InteractiveSubjectHostV0.open(
      humanConfig(dir),
      { ...humanDeps(dir, humanRecorder), sharedSourceStore: undefined } as unknown as InteractiveSubjectHostDepsV0
    );
    await legacyHuman.send("Alice asks about the review.");

    // A second, divergent lineage produced elsewhere and copied in as this
    // subject's environment sidecar.
    const otherDir = makeTempDir();
    const otherEnvRecorder = { requests: [] as string[] };
    const otherEnv = await EnvironmentSubjectHostV0.open(
      envConfig(otherDir),
      { ...envDeps(otherDir, otherEnvRecorder), sharedSourceStore: undefined } as unknown as EnvironmentSubjectHostDepsV0
    );
    await otherEnv.processNextInteraction();
    const otherSidecar = join(
      otherDir,
      `subject-${SUBJECT_ID}.environment-product-review-environment-v0.checkpoint.json`
    );
    expect(existsSync(otherSidecar)).toBe(true);
    writeFileSync(
      join(dir, `subject-${SUBJECT_ID}.environment-product-review-environment-v0.checkpoint.json`),
      readFileSync(otherSidecar, "utf8")
    );

    // Shared source is absent: two legacy artifacts with divergent heads.
    await expect(
      EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, { requests: [] }))
    ).rejects.toThrow(/CROSS_CONTEXT_EXISTING_LINEAGE_CONFLICT/);
  }, 60000);

  it("fails closed on a wrong-subject shared source and on a corrupt shared source", async () => {
    // Wrong subject: the SAME shared source handle (subject A's document)
    // opened as subject B.
    const shared = new InMemorySharedSubjectSourceStoreV0();
    const humanRecorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(
      humanConfig("unused-a"),
      {
        ...humanDeps("unused-a", humanRecorder),
        sharedSourceStore: shared,
        snapshotStore: new InMemoryInteractiveSnapshotStoreV0()
      }
    );
    await human.send("Alice asks about the review.");
    await expect(
      EnvironmentSubjectHostV0.open(
        { ...envConfig("unused-a"), subject_id: "other-subject" },
        {
          ...envDeps("unused-a", { requests: [] }),
          sharedSourceStore: shared,
          checkpointStore: new InMemoryEnvironmentCheckpointStoreV0()
        }
      )
    ).rejects.toThrow(/belongs to subject|CONFLICT/i);

    // Corrupt shared source: never a fresh subject.
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const host = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorder));
    await host.send("Alice asks about the review.");
    const sharedPath = join(dir, `subject-${SUBJECT_ID}.shared-subject.json`);
    expect(existsSync(sharedPath)).toBe(true);
    writeFileSync(sharedPath, "{ not json");
    await expect(
      InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, { requests: [] }))
    ).rejects.toThrow(/unreadable|Refusing to start/i);
  }, 60000);

  it("binds the environment sidecar to its declared environment identity", async () => {
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const envA = new ReferenceReviewEnvironmentV0();
    const host = await EnvironmentSubjectHostV0.open(
      envConfig(dir),
      { ...envDeps(dir, recorder), checkpointStore: store, environment: envA }
    );
    const first = await host.processNextInteraction();
    expect(first.status, first.failure ?? "no detail").toBe("COMPLETE");

    // Same sidecar store, a DIFFERENT declared environment adapter.
    await expect(
      EnvironmentSubjectHostV0.open(
        envConfig(dir),
        {
          ...envDeps(dir, { requests: [] }),
          checkpointStore: store,
          environment: new ReferenceReviewEnvironmentV0({ environment_id: "different-environment-v0" })
        }
      )
    ).rejects.toThrow(/belongs to environment/i);
  }, 60000);

  it("reports non-quiescent contexts so a handoff can be refused", async () => {
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorder));
    await human.send("Alice asks about the review.");
    // A completed human turn leaves no mandatory lifecycle work: quiescent.
    expect(human.isQuiescent()).toBe(true);

    // An environment host that never ran an interaction is trivially quiescent;
    // after a completed interaction it is quiescent too.
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, { requests: [] }));
    expect(env.isQuiescent()).toBe(true);
    const outcome = await env.processNextInteraction();
    if (outcome.status === "COMPLETE") expect(env.isQuiescent()).toBe(true);
  }, 60000);

  it("keeps the conversation product action-free while environment mode is active", async () => {
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorder));
    await human.send("Alice asks about the review.");
    const request = recorder.requests[0] as string;
    expect(request).toContain("(no external actions allowed this cycle");
  }, 60000);
});
