/**
 * SUBJECT_EXPLICIT_TIME_ADVANCE_PRODUCT_V0 — product acceptance.
 *
 * Offline (deterministic fake transports + deterministic appraisal): 0 real
 * provider calls, no wall clock consulted for ticks. Proves explicit canonical
 * tick advancement of ONE shared subject with firewalls, persistence, restart,
 * cross-context visibility and causal reach into later cognition.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  FactualEventAppraisalProviderV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { advanceSubjectTimeV0, type AdvanceSubjectTimeDepsV0 } from "./subject-time-advance.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
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

const SUBJECT_ID = "time-subject";
const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-time-"));
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
            reasoning_summary: "offline time cognition",
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

/** Deterministic strong appraisal so genesis affect moves away from baseline. */
function strongAppraisal(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.9,
          goal_congruence: 0.95,
          attribution: "other",
          controllability: 0.8,
          uncertainty: 0.1,
          intensity: 0.9
        },
        assessment_confidence: 0.9,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

function envConfig(dir: string): EnvironmentSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Time Subject",
    session_id: "environment-time",
    storage_root: dir,
    interaction_interval_ticks: 1
  };
}

function envDeps(dir: string, recorder: { requests: string[] }): EnvironmentSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: strongAppraisal(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

function humanConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Time Subject",
    session_id: "interactive-time",
    storage_root: dir,
    interval_ticks: 1
  };
}

function humanDeps(dir: string, recorder: { requests: string[] }): InteractiveSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: strongAppraisal(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

function timeDeps(dir: string): AdvanceSubjectTimeDepsV0 {
  return {
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    subject: { subject_id: SUBJECT_ID, display_name: "Time Subject", identity_anchors: [] },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

async function sharedDocument(dir: string) {
  const loaded = await new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID).load();
  if (loaded.kind !== "DOCUMENT") throw new Error("expected a shared canonical subject source");
  return loaded.document;
}

function valenceOf(request: string): number {
  const line = request.split("\n").find((entry) => entry.startsWith("[affect (canonical)]")) ?? "";
  const match = /valence=(-?[0-9.eE+-]+)/.exec(line);
  if (match === null) throw new Error("cognition request has no canonical affect valence");
  return Number(match[1]);
}

function lastSnapshot(document: Awaited<ReturnType<typeof sharedDocument>>): Record<string, unknown> {
  const bundles = document.store.committed_bundles as readonly { next_snapshot: Record<string, unknown> }[];
  const head = bundles[bundles.length - 1];
  if (head === undefined) throw new Error("shared canonical subject has no committed head");
  return head.next_snapshot;
}

/** Seeds S0 with non-baseline canonical affect via one environment interaction. */
async function seedAffect(dir: string): Promise<number> {
  const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, { requests: [] }));
  const outcome = await env.processNextInteraction();
  expect(outcome.status, outcome.failure ?? "no detail").toBe("COMPLETE");
  return outcome.affect_after;
}

describe("SUBJECT_EXPLICIT_TIME_ADVANCE_PRODUCT_V0 — explicit canonical ticks", () => {
  it("LEVEL 1/2: advances canonical Time with no input, and leaves Memory/slow-state/environment untouched", async () => {
    const dir = makeTempDir();
    const valence0 = await seedAffect(dir);
    expect(Math.abs(valence0)).toBeGreaterThan(0.01); // away from the Time attractor
    const before = await sharedDocument(dir);
    const snapBefore = lastSnapshot(before);
    const envSidecar = join(dir, `subject-${SUBJECT_ID}.environment-product-review-environment-v0.checkpoint.json`);
    const sidecarBefore = readFileSync(envSidecar, "utf8");

    const result = await advanceSubjectTimeV0(timeDeps(dir), 30);
    expect(result.no_op).toBe(false);
    expect(result.logical_time_after - result.logical_time_before).toBe(30);
    expect(Math.abs(result.valence_after)).toBeLessThan(Math.abs(result.valence_before));
    expect(result.base_revision).toBe(before.base_revision + 1);

    const after = await sharedDocument(dir);
    const snapAfter = lastSnapshot(after);
    // LEVEL 2 firewalls — Memory repository unchanged, no fabricated lived evidence.
    expect(after.store.revisions.map((r) => r.repository_revision)).toEqual(
      before.store.revisions.map((r) => r.repository_revision)
    );
    expect(snapAfter["memory_state"]).toEqual(snapBefore["memory_state"]);
    expect((snapAfter["beliefs"] as unknown[]).length).toBe((snapBefore["beliefs"] as unknown[]).length);
    expect(snapAfter["personality"]).toEqual(snapBefore["personality"]);
    expect(snapAfter["relationships"]).toEqual(snapBefore["relationships"]);
    expect(snapAfter["traits_seed"]).toEqual(snapBefore["traits_seed"]);
    // Environment lifecycle state untouched.
    expect(readFileSync(envSidecar, "utf8")).toBe(sidecarBefore);
    // Time changed exactly affect + logical_time (+ regulation last_update).
    expect((snapAfter["runtime_metadata"] as { logical_time: number }).logical_time).toBe(
      (snapBefore["runtime_metadata"] as { logical_time: number }).logical_time + 30
    );
    expect((snapAfter["affect"] as { valence: number }).valence).not.toBe(
      (snapBefore["affect"] as { valence: number }).valence
    );
  }, 60000);

  it("LEVEL 3/4/5: time-evolved state survives restart and reaches both contexts' cognition", async () => {
    const dir = makeTempDir();
    await seedAffect(dir);
    const result = await advanceSubjectTimeV0(timeDeps(dir), 60);
    expect(result.no_op).toBe(false);

    // Fresh environment context.
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, { requests: [] }));
    expect(env.resolution()).toBe("ENVIRONMENT_SUBJECT_RESTORED");
    const envStatus = await env.status();
    expect(envStatus.logical_time).toBe(result.logical_time_after);
    expect(envStatus.affect.valence).toBeCloseTo(result.valence_after, 10);

    // Human context: the SAME evolved state appears in the cognition input.
    const recorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, recorder));
    expect(human.resolution()).toBe("SUBJECT_RESTORED");
    const humanStatus = await human.status();
    expect(humanStatus.logical_time).toBe(result.logical_time_after);
    expect(humanStatus.affect.valence).toBeCloseTo(result.valence_after, 10);
    const turn = await human.send("Alice asks about the review.");
    expect(turn.status).toBe("COMPLETE");
    const request = recorder.requests.at(-1) as string;
    // The turn itself lawfully advances one canonical tick before cognition, so
    // the projected valence is the seam result decayed by exp(-1/150).
    expect(valenceOf(request)).toBeCloseTo(result.valence_after * Math.exp(-1 / 150), 8);
    expect(request).not.toContain("[time continuity]");
  }, 60000);

  it("LEVEL 6: elapsed canonical ticks causally change later cognition for the same event", async () => {
    const laterText = "Alice asks about the review.";
    // Two identical S0 runs.
    const dirA = makeTempDir();
    await seedAffect(dirA);
    const dirB = makeTempDir();
    await seedAffect(dirB);
    // Treatment: Run B advances canonical time; Run A does not.
    const advanced = await advanceSubjectTimeV0(timeDeps(dirB), 60);
    expect(advanced.no_op).toBe(false);

    const recorderA = { requests: [] as string[] };
    const humanA = await InteractiveSubjectHostV0.open(humanConfig(dirA), humanDeps(dirA, recorderA));
    expect((await humanA.send(laterText)).status).toBe("COMPLETE");
    const requestA = recorderA.requests.at(-1) as string;

    const recorderB = { requests: [] as string[] };
    const humanB = await InteractiveSubjectHostV0.open(humanConfig(dirB), humanDeps(dirB, recorderB));
    expect((await humanB.send(laterText)).status).toBe("COMPLETE");
    const requestB = recorderB.requests.at(-1) as string;

    // Same later event; the ONLY causal difference is elapsed canonical time.
    expect(requestA).not.toBe(requestB);
    expect(Math.abs(valenceOf(requestB))).toBeLessThan(Math.abs(valenceOf(requestA)));
    expect(valenceOf(requestB)).toBeCloseTo(advanced.valence_after * Math.exp(-1 / 150), 8);
    // Held-constant canonical material remains equal across the two runs.
    const lineOf = (text: string, prefix: string) => text.split("\n").find((line) => line.startsWith(prefix));
    expect(lineOf(requestB, "[regulation]")).toBe(lineOf(requestA, "[regulation]"));
  }, 60000);

  it("LEVEL 7: a stale writer cannot overwrite newer shared canonical state", async () => {
    const dir = makeTempDir();
    await seedAffect(dir);
    const stale = await sharedDocument(dir);
    // Another client advances the shared subject first.
    await advanceSubjectTimeV0(timeDeps(dir), 5);
    const head = await sharedDocument(dir);
    expect(head.base_revision).toBe(stale.base_revision + 1);

    await expect(
      advanceSubjectTimeV0(timeDeps(dir), 5, { expectedBaseRevision: stale.base_revision })
    ).rejects.toThrow(/CROSS_CONTEXT_STALE_WRITE/);
    expect((await sharedDocument(dir)).base_revision).toBe(head.base_revision);
  }, 60000);

  it("LEVEL 8: zero / invalid / large / overflow controls", async () => {
    const dir = makeTempDir();
    await seedAffect(dir);
    const before = await sharedDocument(dir);

    // Zero ticks → NO_OP: no commit, no base increment, no persistence write.
    const zero = await advanceSubjectTimeV0(timeDeps(dir), 0);
    expect(zero.no_op).toBe(true);
    expect(zero.logical_time_after).toBe(zero.logical_time_before);
    const afterZero = await sharedDocument(dir);
    expect(afterZero.base_revision).toBe(before.base_revision);
    expect(afterZero.updated_at).toBe(before.updated_at);

    // Invalid ticks → fail closed before persistence, no coercion.
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(advanceSubjectTimeV0(timeDeps(dir), bad as number)).rejects.toThrow(
        /SUBJECT_TIME_ADVANCE_INVALID_TICKS/
      );
    }
    expect((await sharedDocument(dir)).base_revision).toBe(before.base_revision);

    // Safe large N: bounded affect (saturates to baseline) + checked logical time.
    const large = await advanceSubjectTimeV0(timeDeps(dir), 100_000);
    expect(large.no_op).toBe(false);
    expect(Math.abs(large.valence_after)).toBeLessThan(1e-6);
    expect(large.activation_after).toBeCloseTo(0.2, 6);

    // Overflow of the logical-time safe-integer domain → fail closed.
    await expect(advanceSubjectTimeV0(timeDeps(dir), Number.MAX_SAFE_INTEGER)).rejects.toThrow(
      /logical_time advance overflows|INVALID_LOGICAL_TIME/
    );
  }, 60000);

  it("is deterministic and never derives ticks from a wall clock", async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    await seedAffect(dirA);
    await seedAffect(dirB);
    const a = await advanceSubjectTimeV0(timeDeps(dirA), 45);
    const b = await advanceSubjectTimeV0(timeDeps(dirB), 45);
    expect({ ...a, base_revision: 0, subject_head_commit_ref: "" }).toEqual({
      ...b,
      base_revision: 0,
      subject_head_commit_ref: ""
    });
  }, 60000);
});
