/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production acceptance.
 *
 * End-to-end through the real product creation/session path (offline fake
 * transports): explicit authored P0 → lived turns → canonical Memory →
 * revision-bounded historical evidence → personality semantic selection →
 * frozen plasticity producer → PersonalityTransitionExecutor → V4 commit →
 * canonical P1 → restart → future cognition.
 *
 * P0 values below are EXPERIMENT FIXTURE ONLY and are never defaults.
 */

import { describe, expect, it } from "vitest";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  PersonalityGenesisPriorV0
} from "@characteros-next/runtime";
import type {
  PersonalityAdaptationReportV0,
  PersonalitySemanticChannelProviderV0
} from "@characteros-next/personality";

import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";

const SUBJECT_ID = "alice";
const CH_OPENNESS_UP = "personality.openness.increase";
const CH_OPENNESS_DOWN = "personality.openness.decrease";

/** EXPERIMENT FIXTURE ONLY — never defaults. */
const P0 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.4 } as const;
const P0_B = { agreeableness: 0.2, conscientiousness: 0.2, extraversion: 0.2, openness: 0.95 } as const;
const COHERENT_TURNS = [
  "I chose to try an unfamiliar approach today.",
  "I compared several unfamiliar options before deciding.",
  "I explored a new route I had never taken.",
  "I engaged with a novel perspective I had not considered.",
  "I picked the unfamiliar option despite the uncertainty.",
  "I investigated something I did not understand yet."
] as const;

function prior(values: Record<string, number>): PersonalityGenesisPriorV0 {
  return {
    schema_version: "personality-genesis-prior-v0",
    dimensions: values as unknown as PersonalityGenesisPriorV0["dimensions"]
  };
}

/** Deterministic provider: fixed allowlisted channel, ABSTAIN, or throws. */
class TestPersonalityProvider implements PersonalitySemanticChannelProviderV0 {
  calls = 0;
  constructor(
    private readonly mode: { kind: "CHANNEL"; channel_id: string } | { kind: "ABSTAIN" } | { kind: "THROW" }
  ) {}
  async propose(input: Parameters<PersonalitySemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    if (this.mode.kind === "THROW") throw new Error("personality provider offline");
    if (this.mode.kind === "ABSTAIN") {
      return {
        kind: "ABSTAIN",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        catalog_fingerprint: input.catalog_fingerprint
      };
    }
    return {
      kind: "CHANNEL",
      channel_id: this.mode.channel_id,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

interface Recorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function cognitionTransport(recorder: Recorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
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
          text: "PERSONALITY_LIVED_EVIDENCE_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function deps(
  recorder: Recorder,
  store: InMemoryInteractiveSnapshotStoreV0,
  provider?: PersonalitySemanticChannelProviderV0
) {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z",
    snapshotStore: store,
    ...(provider === undefined ? {} : { personalitySemanticProvider: provider })
  };
}

function config(personalityGenesisPrior?: PersonalityGenesisPriorV0): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Alice",
    session_id: "sess-personality-lived",
    storage_root: "unused",
    interval_ticks: 1,
    ...(personalityGenesisPrior === undefined ? {} : { personality_genesis_prior: personalityGenesisPrior })
  };
}

function reportOf(outcome: { readonly personality_adaptation: unknown }): PersonalityAdaptationReportV0 | null {
  const value = outcome.personality_adaptation as PersonalityAdaptationReportV0 | null;
  return value !== null && typeof value === "object" && "status" in value ? value : null;
}

function requestUserText(recorder: Recorder, turnIndex: number): string {
  const request = recorder.requests[turnIndex];
  if (request === undefined) throw new Error(`no cognition request at index ${turnIndex}`);
  return request.messages.find((m) => m.role === "user")?.content ?? "";
}

function personalityLine(recorder: Recorder, turnIndex: number): string {
  const line = requestUserText(recorder, turnIndex)
    .split("\n")
    .find((entry) => entry.startsWith("[current acquired personality"));
  if (line === undefined) throw new Error("current acquired personality line missing from cognition request");
  return line;
}

function personalityMap(recorder: Recorder, turnIndex: number): Record<string, number> {
  const line = personalityLine(recorder, turnIndex);
  return JSON.parse(line.slice(line.indexOf("] ") + 2)) as Record<string, number>;
}

function genesis(store: unknown): { traits_seed: unknown; personality: unknown } {
  const env = (store as { durable: { genesis_envelope: { snapshot: { traits_seed: unknown; personality: unknown } } } })
    .durable.genesis_envelope;
  return { traits_seed: env.snapshot.traits_seed, personality: env.snapshot.personality };
}

interface RunResult {
  readonly committedAt: number;
  readonly p1: number;
  readonly reports: readonly (PersonalityAdaptationReportV0 | null)[];
}

/** Send coherent turns until the first lawful COMMITTED adaptation. */
async function runUntilCommitted(host: InteractiveSubjectHostV0): Promise<RunResult> {
  const reports: (PersonalityAdaptationReportV0 | null)[] = [];
  for (let index = 0; index < COHERENT_TURNS.length; index++) {
    const outcome = await host.send(COHERENT_TURNS[index] as string);
    expect(outcome.status).toBe("COMPLETE");
    const report = reportOf(outcome);
    reports.push(report);
    if (report?.terminal === "COMMITTED") {
      return { committedAt: index, p1: report.next_value as number, reports };
    }
  }
  throw new Error(`no lawful Personality commit within ${COHERENT_TURNS.length} coherent turns`);
}

describe("PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production lived-evidence chain", () => {
  it("LEVEL 1+2: coherent lived evidence moves P0 → P1 through the frozen chain and v4 commit", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP });
    const host = await InteractiveSubjectHostV0.open(config(prior(P0)), deps(recorder, store, provider));
    expect(host.resolution()).toBe("NEW_SUBJECT_CREATED");

    const { committedAt, p1, reports } = await runUntilCommitted(host);
    for (let index = 0; index < committedAt; index++) {
      expect(reports[index]?.terminal).toBe("NOT_ELIGIBLE");
    }
    expect(committedAt).toBeGreaterThanOrEqual(2);
    const committed = reports[committedAt];
    expect(committed?.channel_id).toBe(CH_OPENNESS_UP);
    expect(committed?.dimension_id).toBe("openness");
    expect(committed?.direction).toBe("INCREASE");
    expect(committed?.prior_value).toBe(P0.openness);
    expect(p1).toBeCloseTo(P0.openness + 0.05, 4);
    expect(committed?.evidence_member_count ?? 0).toBeGreaterThanOrEqual(3);
    expect(committed?.transition_ref).toBeTruthy();
    expect(provider.calls).toBeGreaterThanOrEqual(3);

    const saved = await store.load();
    if (saved.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot");
    const g = genesis(saved.snapshot);
    expect(g.traits_seed).toEqual({ dimensions: P0 });
    const genesisOpenness = (g.personality as { dimensions: readonly { dimension_id: string; value: number }[] }).dimensions.find(
      (d) => d.dimension_id === "openness"
    )?.value;
    expect(genesisOpenness).toBe(P0.openness);
  }, 20000);

  it("LEVEL 4: acquired P1 reaches future cognition, and not the same turn", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP });
    const host = await InteractiveSubjectHostV0.open(config(prior(P0)), deps(recorder, store, provider));

    const { committedAt, p1 } = await runUntilCommitted(host);
    expect(personalityMap(recorder, committedAt)["openness"]).toBe(P0.openness);
    const next = await host.send("Another unfamiliar option appeared.");
    expect(next.status).toBe("COMPLETE");
    expect(personalityMap(recorder, committedAt + 1)["openness"]).toBeCloseTo(p1, 4);
  }, 20000);

  it("LEVEL 3 + P0_B ignored: P1 persists across restart; traits_seed stays P0_A", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorderA: Recorder = { requests: [] };
    const providerA = new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP });
    const hostA = await InteractiveSubjectHostV0.open(config(prior(P0)), deps(recorderA, store, providerA));
    const { p1 } = await runUntilCommitted(hostA);

    const recorderB: Recorder = { requests: [] };
    const providerB = new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP });
    const reopened = await InteractiveSubjectHostV0.open(config(prior(P0_B)), deps(recorderB, store, providerB));
    expect(reopened.resolution()).toBe("SUBJECT_RESTORED");
    const next = await reopened.send("I tried yet another unfamiliar option.");
    const report = reportOf(next);
    expect(report?.prior_value).toBeCloseTo(p1, 4);
    expect(report?.prior_value).not.toBe(P0_B.openness);
    const saved = await store.load();
    if (saved.kind !== "SNAPSHOT") throw new Error("expected a durable snapshot");
    expect(genesis(saved.snapshot).traits_seed).toEqual({ dimensions: P0 });
  }, 20000);

  it("empty Personality fails closed and never acquires dimensions", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));
    const report = reportOf(await host.send(COHERENT_TURNS[0] as string));
    expect(report?.status).toBe("SKIPPED_EMPTY_PERSONALITY");
    expect(provider.calls).toBe(0);
  });

  it("irrelevant evidence ABSTAINS (no Personality mutation)", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestPersonalityProvider({ kind: "ABSTAIN" });
    const host = await InteractiveSubjectHostV0.open(config(prior(P0)), deps(recorder, store, provider));
    await host.send("The weather is unremarkable.");
    const report = reportOf(await host.send("Nothing of note happened."));
    expect(report?.terminal).toBe("ABSTAIN");
    expect(report?.next_value).toBeNull();
  });

  it("provider failure leaves Personality unchanged and the turn completed (fail closed)", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestPersonalityProvider({ kind: "THROW" });
    const host = await InteractiveSubjectHostV0.open(config(prior(P0)), deps(recorder, store, provider));
    const outcome = await host.send("Something happened.");
    expect(outcome.status).toBe("COMPLETE");
    const report = reportOf(outcome);
    expect(report?.terminal).toBe("REJECTED");
    expect(report?.rejection_code).toBe("INVALID_PROVIDER_OUTPUT");
    expect(report?.next_value).toBeNull();
  });

  it("LEVEL 5: personality-only difference changes the cognition projection (isolated)", async () => {
    const recorderUp: Recorder = { requests: [] };
    const recorderDown: Recorder = { requests: [] };
    const storeUp = new InMemoryInteractiveSnapshotStoreV0();
    const storeDown = new InMemoryInteractiveSnapshotStoreV0();
    const up = await InteractiveSubjectHostV0.open(
      config(prior(P0)),
      deps(recorderUp, storeUp, new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_UP }))
    );
    const down = await InteractiveSubjectHostV0.open(
      config(prior(P0)),
      deps(recorderDown, storeDown, new TestPersonalityProvider({ kind: "CHANNEL", channel_id: CH_OPENNESS_DOWN }))
    );
    // Identical turns/transports/appraisal/model/identity — only the lawful
    // personality channel (and thus acquired Personality) differs.
    for (const text of COHERENT_TURNS) {
      expect((await up.send(text)).status).toBe("COMPLETE");
      expect((await down.send(text)).status).toBe("COMPLETE");
    }
    const last = COHERENT_TURNS.length - 1;
    const mapUp = personalityMap(recorderUp, last);
    const mapDown = personalityMap(recorderDown, last);
    // Different lawful channel → different acquired Personality.
    expect(mapUp["openness"]).toBeGreaterThan(mapDown["openness"] as number);
    const requestUp = requestUserText(recorderUp, last);
    const requestDown = requestUserText(recorderDown, last);
    // Held-constant state is identical in both cognition inputs.
    const lineOf = (text: string, prefix: string): string | undefined =>
      text.split("\n").find((line) => line.startsWith(prefix));
    for (const prefix of ["[traits seed", "[affect (canonical)]", "[regulation]"]) {
      expect(lineOf(requestUp, prefix)).toBe(lineOf(requestDown, prefix));
    }
    // The acquired-personality line differs exactly as the lawful channel dictates.
    expect(personalityLine(recorderUp, last)).not.toEqual(personalityLine(recorderDown, last));
  }, 30000);
});
