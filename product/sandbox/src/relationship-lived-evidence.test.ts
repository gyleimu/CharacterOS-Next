/**
 * RELATIONSHIP_LIVED_DEVELOPMENT_V0 — production acceptance.
 *
 * End-to-end through the real product creation/session path (offline fake
 * transports + a deterministic admission provider):
 *
 *   fresh subject → real canonical lived interaction → canonical Episode
 *   → evidence-bound counterpart registration (creation only)
 *   → frozen qualifying admission → frozen familiarity ingestion/accrual
 *   → governed Relationship write → canonical familiarity (k/32)
 *   → durable persist → REAL restart → future cognition.
 *
 * The provider is DETERMINISTIC and offline; the frozen ingestion module itself
 * makes zero model calls. Its closed-vocabulary / replay / saturation /
 * counterpart-isolation laws are proven separately in
 * relationship-interaction-familiarity-ingestion.test.ts.
 */

import { describe, expect, it } from "vitest";
import type {
  InteractiveTurnOutcomeV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  RelationshipFamiliarityTurnReportV0,
  RelationshipInteractionQualifyingAdmissionProviderV0,
  RelationshipInteractionQualifyingAdmissionV0
} from "@characteros-next/runtime";

import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";

const SUBJECT_ID = "alice";
const ONE_CREDIT = 1 / 32;

type ProviderMode =
  | { readonly kind: "QUALIFYING"; readonly qualifying_class: string }
  | { readonly kind: "ABSTAIN" }
  | { readonly kind: "THROW" }
  | { readonly kind: "INVALID" };

/** Deterministic, offline admission provider (never a model call). */
class TestFamiliarityProvider implements RelationshipInteractionQualifyingAdmissionProviderV0 {
  calls = 0;
  constructor(public mode: ProviderMode) {}
  async admit(): Promise<RelationshipInteractionQualifyingAdmissionV0> {
    this.calls += 1;
    const mode = this.mode;
    if (mode.kind === "THROW") throw new Error("familiarity provider offline");
    if (mode.kind === "ABSTAIN") return { kind: "ABSTAIN" };
    if (mode.kind === "INVALID") {
      return { kind: "QUALIFYING", qualifying_class: "NOT_A_QUALIFYING_CLASS" } as never;
    }
    return { kind: "QUALIFYING", qualifying_class: mode.qualifying_class as never };
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
          text: "RELATIONSHIP_LIVED_EVIDENCE_REPLY",
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
  provider?: RelationshipInteractionQualifyingAdmissionProviderV0
) {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z",
    snapshotStore: store,
    ...(provider === undefined ? {} : { relationshipFamiliarityAdmissionProvider: provider })
  };
}

function config(): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Alice",
    session_id: "sess-relationship-lived",
    storage_root: "unused",
    interval_ticks: 1
  };
}

function reportOf(outcome: InteractiveTurnOutcomeV0): RelationshipFamiliarityTurnReportV0 | null {
  return outcome.relationship_familiarity;
}

function firstEpisode(outcome: InteractiveTurnOutcomeV0) {
  const report = reportOf(outcome);
  expect(report).not.toBeNull();
  expect(report?.episodes.length).toBe(1);
  return report?.episodes[0] ?? null;
}

function requestUserText(recorder: Recorder, turnIndex: number): string {
  const request = recorder.requests[turnIndex];
  if (request === undefined) throw new Error(`no cognition request at index ${turnIndex}`);
  return request.messages.find((m) => m.role === "user")?.content ?? "";
}

const COUNTERPART = "entity:alice";

/**
 * The production cognition request's familiarity entry for the session
 * counterpart: `presence=PRESENT level=k/32`, `presence=ABSENT`, or null when
 * no counterpart is registered yet (no entry is rendered).
 */
function familiarityEntry(
  recorder: Recorder,
  turnIndex: number
): { readonly presence: string; readonly level: number | null } | null {
  const match = new RegExp(
    `- ${COUNTERPART}: presence=(\\w+)(?: level=(\\d+)/(\\d+))?`
  ).exec(requestUserText(recorder, turnIndex));
  if (match === null) return null;
  return { presence: match[1] as string, level: match[2] === undefined ? null : Number(match[2]) };
}

describe("RELATIONSHIP_LIVED_DEVELOPMENT_V0 — production familiarity chain", () => {
  it("LEVEL 1+2: a real lived interaction registers the counterpart and accrues 1/32; a second adds one credit", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestFamiliarityProvider({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));
    expect(host.resolution()).toBe("NEW_SUBJECT_CREATED");

    const first = await host.send("Hello, it is good to talk with you.");
    expect(first.status).toBe("COMPLETE");
    const episodeOne = firstEpisode(first);
    expect(episodeOne?.registration).toBe("REGISTERED");
    expect(episodeOne?.detail).toBeNull();
    expect(episodeOne?.outcome).toBe("COMMITTED");
    expect(episodeOne?.qualifying_class).toBe("DIRECT_COMMUNICATION");
    expect(episodeOne?.familiarity_next).toBeCloseTo(ONE_CREDIT, 6);

    const second = await host.send("I enjoyed that conversation.");
    expect(second.status).toBe("COMPLETE");
    const episodeTwo = firstEpisode(second);
    // Registration is creation-only: the second episode accrues without re-registering.
    expect(episodeTwo?.registration).toBe("ALREADY_REGISTERED");
    expect(episodeTwo?.outcome).toBe("COMMITTED");
    expect(episodeTwo?.familiarity_next).toBeCloseTo(2 * ONE_CREDIT, 6);
    expect(provider.calls).toBe(2);
  }, 30000);

  it("turn-N firewall: familiarity is absent from the cognition that produced it and present in the next turn", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestFamiliarityProvider({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));

    await host.send("First message.");
    // Turn 1's own cognition ran BEFORE the familiarity commit.
    expect(familiarityEntry(recorder, 0)).toBeNull();
    expect(requestUserText(recorder, 0)).toContain("(no registered counterparts)");

    await host.send("Second message.");
    // Turn 2 sees turn 1's committed familiarity (1/32) but not its own.
    expect(familiarityEntry(recorder, 1)?.presence).toBe("PRESENT");
    expect(familiarityEntry(recorder, 1)?.level).toBe(1);
    expect(requestUserText(recorder, 1)).toContain(
      `- ${COUNTERPART}: context_resolution_strategy=`
    );
  }, 30000);

  it("LEVEL 3+4: familiarity persists across a REAL restart and reaches future cognition", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorderA: Recorder = { requests: [] };
    const providerA = new TestFamiliarityProvider({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" });
    const hostA = await InteractiveSubjectHostV0.open(config(), deps(recorderA, store, providerA));
    const first = await hostA.send("We have talked before.");
    expect(firstEpisode(first)?.familiarity_next).toBeCloseTo(ONE_CREDIT, 6);

    const recorderB: Recorder = { requests: [] };
    const providerB = new TestFamiliarityProvider({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" });
    const reopened = await InteractiveSubjectHostV0.open(config(), deps(recorderB, store, providerB));
    expect(reopened.resolution()).toBe("SUBJECT_RESTORED");

    const next = await reopened.send("We meet again.");
    expect(next.status).toBe("COMPLETE");
    // The persisted 1/32 reached this turn's cognition...
    expect(familiarityEntry(recorderB, 0)?.presence).toBe("PRESENT");
    expect(familiarityEntry(recorderB, 0)?.level).toBe(1);
    // ...and the new episode added exactly one credit to the restored state.
    const episode = firstEpisode(next);
    expect(episode?.registration).toBe("ALREADY_REGISTERED");
    expect(episode?.familiarity_next).toBeCloseTo(2 * ONE_CREDIT, 6);
  }, 30000);

  it("DISABLED chain: no provider means no registration, no familiarity, no provider calls", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store));
    const outcome = await host.send("First message.");
    expect(outcome.status).toBe("COMPLETE");
    expect(outcome.relationship_familiarity?.status).toBe("DISABLED");
    expect(outcome.relationship_familiarity?.episodes).toEqual([]);
    expect(familiarityEntry(recorder, 0)).toBeNull();
  }, 30000);

  it("ABSTAIN leaves Relationship unchanged and the turn completed", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestFamiliarityProvider({ kind: "ABSTAIN" });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));

    const first = await host.send("Unremarkable.");
    const episode = firstEpisode(first);
    // The counterpart registers (evidence exists) but no familiarity is credited.
    expect(episode?.registration).toBe("REGISTERED");
    expect(episode?.outcome).toBe("ABSTAINED");
    expect(episode?.familiarity_next).toBeNull();

    await host.send("Still unremarkable.");
    // The counterpart exists canonically, but no familiarity was credited.
    expect(familiarityEntry(recorder, 1)?.presence).toBe("ABSENT");
    expect(familiarityEntry(recorder, 1)?.level).toBeNull();
  }, 30000);

  it("provider failure leaves Relationship unchanged and the turn completed (fail closed)", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestFamiliarityProvider({ kind: "THROW" });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));
    const outcome = await host.send("Something happened.");
    expect(outcome.status).toBe("COMPLETE");
    const episode = firstEpisode(outcome);
    expect(episode?.outcome).toBe("REJECTED");
    expect(episode?.detail).toContain("ADMISSION_PROVIDER_INVALID_OUTPUT");
    expect(episode?.familiarity_next).toBeNull();
  }, 30000);

  it("provider output outside the closed vocabulary is refused (fail closed)", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const recorder: Recorder = { requests: [] };
    const provider = new TestFamiliarityProvider({ kind: "INVALID" });
    const host = await InteractiveSubjectHostV0.open(config(), deps(recorder, store, provider));
    const outcome = await host.send("Something happened.");
    expect(outcome.status).toBe("COMPLETE");
    const episode = firstEpisode(outcome);
    expect(episode?.outcome).toBe("REJECTED");
    expect(episode?.detail).toContain("ADMISSION_PROVIDER_INVALID_OUTPUT");
  }, 30000);
});
