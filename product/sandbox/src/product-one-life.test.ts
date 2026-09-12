/**
 * CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0 — product acceptance.
 *
 * Offline (deterministic fakes, 0 real provider calls): ONE product session
 * composes talk / observe / environment / time / state / life / memory over one
 * persistent subject, one shared canonical source, visible canonical change and
 * real restart continuity.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { ProductLifeOperationsV0 } from "./product-life-operations.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";

const SUBJECT_ID = "product-life-subject";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-life-"));
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
            reasoning_summary: "offline product cognition",
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

function hostConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Mira",
    session_id: "interactive-life",
    storage_root: dir,
    interval_ticks: 1
  };
}

interface ProductFixture {
  readonly host: InteractiveSubjectHostV0;
  readonly life: ProductLifeOperationsV0;
  readonly session: ProductCliSessionV0;
  readonly lines: string[];
  readonly recorder: { requests: string[] };
}

async function buildProduct(dir: string): Promise<ProductFixture> {
  const recorder = { requests: [] as string[] };
  const sharedSourceStore = new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID);
  const deps = {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore,
    snapshotStore: new InMemoryInteractiveSnapshotStoreV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
  const host = await InteractiveSubjectHostV0.open(hostConfig(dir), deps);
  const life = new ProductLifeOperationsV0(
    {
      storage_root: dir,
      subject: { subject_id: SUBJECT_ID, display_name: "Mira", identity_anchors: [] },
      interaction_interval_ticks: 1
    },
    {
      host,
      sharedSourceStore,
      conversationCognitionTransport: deps.conversationCognitionTransport,
      languageTransport: deps.languageTransport,
      factualEventAppraisalProvider: deps.appraisalProvider,
      provider_identity: deps.provider_identity,
      clock: deps.clock
    }
  );
  const lines: string[] = [];
  const session = new ProductCliSessionV0({
    host,
    life,
    subjectLabel: "Mira",
    model: "fake",
    providerLabel: "FAKE",
    contextWindowTokens: 8192,
    maxOutputTokens: 2048,
    debug: false,
    write: (line) => lines.push(line)
  });
  return { host, life, session, lines, recorder };
}

function output(lines: readonly string[]): string {
  return lines.join("\n");
}

describe("CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0 — one-life acceptance", () => {
  it("P1+P2: one usable subject with unified life operations in one session", async () => {
    const dir = makeTempDir();
    const product = await buildProduct(dir);
    expect(product.host.resolution()).toBe("NEW_SUBJECT_CREATED");

    await product.session.handleLine("/help");
    expect(output(product.lines)).toContain("/observe");
    expect(output(product.lines)).toContain("/environment");
    expect(output(product.lines)).toContain("/time");
    expect(output(product.lines)).toContain("/state");
    expect(output(product.lines)).toContain("/life");

    product.lines.length = 0;
    await product.session.handleLine("/status");
    expect(output(product.lines)).toContain(`Subject ID: ${SUBJECT_ID}`);

    product.lines.length = 0;
    await product.session.handleLine("/state");
    expect(output(product.lines)).toContain("State (canonical, read-only)");
    expect(output(product.lines)).toContain("ABSENT"); // honest empty domains

    product.lines.length = 0;
    await product.session.handleLine("Hello, this is a human experience.");
    expect(output(product.lines)).toContain("Mira > Noted.");

    product.lines.length = 0;
    await product.session.handleLine('/observe source=front-door event=entered-001 entities=alice scene="Alice entered the room." task="observe current situation"');
    expect(output(product.lines)).toContain("observation FIRST");

    product.lines.length = 0;
    await product.session.handleLine("/environment 1");
    expect(output(product.lines)).toContain("environment:");

    product.lines.length = 0;
    await product.session.handleLine("/time 30");
    expect(output(product.lines)).toContain("advanced 30 canonical tick(s)");

    product.lines.length = 0;
    await product.session.handleLine("/memory");
    expect(output(product.lines)).toContain("Mira remembers");

    product.lines.length = 0;
    await product.session.handleLine("/life");
    expect(output(product.lines)).toContain("Mira — one life");
  });

  it("P3+P6: observe and time visibly change canonical state and temporal continuity", async () => {
    const dir = makeTempDir();
    const product = await buildProduct(dir);
    // A brand-new subject's FIRST lived event establishes the one shared
    // canonical source that every other product context then joins.
    await product.session.handleLine("First lived event.");
    const before = await product.host.status();

    await product.session.handleLine('/observe source=sensor event=evt-1 entities=alice scene="A quiet room." task="observe"');
    const afterObserve = await product.host.status();
    expect(output(product.lines)).toContain("observation FIRST");
    expect(afterObserve.repository_revision).not.toBe(before.repository_revision);

    product.lines.length = 0;
    await product.session.handleLine("/time 30");
    const afterTime = await product.host.status();
    expect(afterTime.logical_time).toBe(afterObserve.logical_time + 30);
    expect(output(product.lines)).toContain(`logical_time ${afterObserve.logical_time} -> ${afterTime.logical_time}`);

    // /time 0 is a lawful NO_OP (no write).
    const physicsBefore = await product.host.status();
    product.lines.length = 0;
    await product.session.handleLine("/time 0");
    const physicsAfter = await product.host.status();
    expect(physicsAfter.logical_time).toBe(physicsBefore.logical_time);
    expect(output(product.lines)).toContain("NO_OP");
  });

  it("P5: one life accumulates human, external-observation and environment history", async () => {
    const dir = makeTempDir();
    const product = await buildProduct(dir);

    await product.session.handleLine("A human message becomes lived history.");
    const turn = (product.session as unknown as { lastTurnOutcome: { observational_experience_ref: string | null } }).lastTurnOutcome;
    const humanEpisode = turn.observational_experience_ref;
    expect(humanEpisode).not.toBeNull();

    product.lines.length = 0;
    await product.session.handleLine('/observe source=camera event=evt-42 entities=alice scene="Alice entered." task="observe"');
    const observeLine = output(product.lines);
    const externalEpisode = /episode_ref=(\S+)/.exec(observeLine)?.[1];
    expect(externalEpisode).toBeDefined();

    const environmentRun = await product.life.environment(1);
    const environmentEpisode = environmentRun.outcomes[0]?.episode_ref ?? null;
    expect(environmentEpisode).not.toBeNull();

    const memory = await product.host.livedMemory({ limit: 100 });
    const refs = new Set(memory.entries.map((entry) => entry.episode_ref));
    expect(refs.has(humanEpisode as string)).toBe(true);
    expect(refs.has(externalEpisode as string)).toBe(true);
    expect(refs.has(environmentEpisode as string)).toBe(true);
    expect(memory.total_episode_count).toBeGreaterThanOrEqual(3);
  });

  it("P4: real restart (fresh objects, same store) restores the SAME subject life", async () => {
    const dir = makeTempDir();
    const first = await buildProduct(dir);
    await first.session.handleLine("Before restart.");
    await first.session.handleLine('/observe source=sensor event=pre-restart entities=alice scene="Before restart event." task="observe"');
    await first.session.handleLine("/time 30");
    const beforeRestart = await first.host.status();
    const beforeMemory = await first.host.livedMemory({ limit: 100 });

    // Destroy every runtime object; build a completely fresh product over the same store.
    const second = await buildProduct(dir);
    expect(second.host.resolution()).toBe("SUBJECT_RESTORED");
    expect(second.host.subjectId()).toBe(SUBJECT_ID);

    const status = await second.host.status();
    expect(status.logical_time).toBe(beforeRestart.logical_time);
    expect(status.repository_revision).toBe(beforeRestart.repository_revision);
    const memory = await second.host.livedMemory({ limit: 100 });
    expect(memory.total_episode_count).toBe(beforeMemory.total_episode_count);

    second.lines.length = 0;
    await second.session.handleLine("/life");
    expect(output(second.lines)).toContain("RESTORED (same subject)");
    expect(output(second.lines)).toContain("Before restart event.");
  });

  it("P7: accumulated life reaches later cognition input", async () => {
    const dir = makeTempDir();
    const product = await buildProduct(dir);
    await product.session.handleLine("I usually keep my notes in a teal notebook.");
    await product.session.handleLine('/observe source=sensor event=note-fact entities=alice scene="The teal notebook is on the desk." task="observe"');

    const before = product.recorder.requests.length;
    const last = await product.host.send("What should I keep in mind about my notebook?");
    expect(last.status).toBe("COMPLETE");
    const prompt = product.recorder.requests.at(-1) ?? "";
    expect(product.recorder.requests.length).toBe(before + 1);
    expect(prompt).toContain("[PRIOR FACTUAL MEMORY");
    expect(last.provider_request_hash).toMatch(/^sha256:/);
  });

  it("P8: product composition performs zero real provider calls (deterministic fakes only)", async () => {
    const dir = makeTempDir();
    const product = await buildProduct(dir);
    // No network provider is constructed anywhere in this fixture; the only
    // calls are the local fakes. A full scenario must still complete.
    await product.session.handleLine("Talk.");
    await product.session.handleLine('/observe source=s event=e entities=alice scene="S." task="t"');
    await product.session.handleLine("/environment 1");
    await product.session.handleLine("/time 5");
    await product.session.handleLine("/life");
    expect(output(product.lines)).toContain("one life");
    expect(product.recorder.requests.length).toBeGreaterThan(0);
  });
});
