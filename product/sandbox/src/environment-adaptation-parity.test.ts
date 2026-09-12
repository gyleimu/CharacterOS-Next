/**
 * ENVIRONMENT_LIVED_EVIDENCE_ADAPTATION_V0 — product acceptance (ADAPTATION PARITY).
 *
 * Offline: deterministic fake transports/providers, 0 real calls. Proves the
 * environment/long-horizon interaction path offers its newly committed canonical
 * episode to the SAME frozen adaptation runners the human runtime uses, with the
 * same ordering, firewall, persistence, restart and cross-context continuity.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  RelationshipInteractionQualifyingAdmissionProviderV0
} from "@characteros-next/runtime";
import {
  InMemoryPersonalityAdaptationStoreV0,
  PersonalityAdaptationWiringV0,
  type PersonalitySemanticChannelProviderV0
} from "@characteros-next/personality";
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
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const SUBJECT_ID = "env-adapt-subject";
const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-envadapt-"));
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
            reasoning_summary: "offline parity cognition",
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
          text: "The review document is organized and the checklist item is closed.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

/** Deterministic admission provider: one environment interaction qualifies. */
const qualifyingAdmission: RelationshipInteractionQualifyingAdmissionProviderV0 = {
  async admit() {
    return { kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" };
  }
};

/** Deterministic belief provider: never bears (proves invocation, not mutation). */
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

class AbstainPersonalityProvider implements PersonalitySemanticChannelProviderV0 {
  async propose(input: Parameters<PersonalitySemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    return {
      kind: "ABSTAIN",
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

function envConfig(dir: string): EnvironmentSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Parity Subject",
    session_id: "environment-parity",
    storage_root: dir,
    interaction_interval_ticks: 1
  };
}

function envDeps(
  dir: string,
  recorder: { requests: string[] },
  extra: Partial<EnvironmentSubjectHostDepsV0> = {}
): EnvironmentSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID),
    relationshipFamiliarityAdmissionProvider: qualifyingAdmission,
    clock: () => "2026-01-01T00:00:00.000Z",
    ...extra
  };
}

function humanConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: SUBJECT_ID,
    display_name: "Parity Subject",
    session_id: "interactive-parity",
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

function adaptationOf(outcome: { readonly lived_evidence_adaptation?: unknown }) {
  return outcome.lived_evidence_adaptation as {
    readonly belief: { readonly status?: string } | null;
    readonly personality: { readonly status?: string } | null;
    readonly relationship_familiarity:
      | { readonly status?: string; readonly episodes?: readonly { readonly outcome?: string; readonly registration?: string; readonly familiarity_next?: number | null }[] }
      | null;
  } | null;
}

describe("ENVIRONMENT_LIVED_EVIDENCE_ADAPTATION_V0 — adaptation parity", () => {
  it("LEVEL 1/2/7: environment episode reaches the frozen runners and familiarity commits, without same-interaction leakage", async () => {
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const host = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, recorder));

    const first = await host.processNextInteraction();
    expect(first.status, first.failure ?? "no detail").toBe("COMPLETE");
    const report = adaptationOf(first);
    expect(report).not.toBeNull();
    // The frozen runners were reached (absence ⇒ DISABLED, not silent).
    expect(report?.belief).not.toBeNull();
    expect(report?.personality).not.toBeNull();
    // Relationship familiarity is the grounded mutating channel: the episode
    // lawfully references the session counterpart, so registration + one credit.
    expect(report?.relationship_familiarity?.status).toBe("APPLIED");
    const episode = report?.relationship_familiarity?.episodes?.[0];
    expect(episode?.registration).toBe("REGISTERED");
    expect(episode?.outcome).toBe("COMMITTED");
    expect(episode?.familiarity_next).toBeCloseTo(1 / 32, 6);

    // LEVEL 7 firewall: interaction 1's own cognition predates the adaptation.
    const request1 = recorder.requests[0] as string;
    expect(request1).not.toContain("entity:alice: context_resolution_strategy=");
    // Interaction 2's cognition MAY observe it.
    const second = await host.processNextInteraction();
    expect(second.status).toBe("COMPLETE");
    const request2 = recorder.requests[1] as string;
    expect(request2).toContain("entity:alice: context_resolution_strategy=");
  }, 60000);

  it("LEVEL 3/4/5: the environment adaptation survives restart and reaches human-context cognition", async () => {
    const dir = makeTempDir();
    const envRecorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, envRecorder));
    const outcome = await env.processNextInteraction();
    expect(outcome.status).toBe("COMPLETE");
    const revisionBefore = env.sharedRevision();

    // Fresh environment host from the shared source: the change persists.
    const reopened = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, { requests: [] }));
    expect(reopened.resolution()).toBe("ENVIRONMENT_SUBJECT_RESTORED");
    expect(reopened.sharedRevision()).toBe(revisionBefore);

    // Context switch to the human host: the SAME canonical changed state is visible.
    const humanRecorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, humanRecorder));
    expect(human.resolution()).toBe("SUBJECT_RESTORED");
    const turn = await human.send("Alice asks for the review status.");
    expect(turn.status).toBe("COMPLETE");
    const request = humanRecorder.requests.at(-1) as string;
    expect(request).toContain("entity:alice: presence=PRESENT level=1/32");
  }, 60000);

  it("LEVEL 8: replaying the same canonical episode adds no duplicate adaptation", async () => {
    const dir = makeTempDir();
    const envRecorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, envRecorder));
    const outcome = await env.processNextInteraction();
    expect(outcome.status).toBe("COMPLETE");
    const episodeRef = outcome.episode_ref as string;

    const replay1 = adaptationOf({ lived_evidence_adaptation: await env.offerLivedEvidenceAdaptation([episodeRef]) });
    const replay2 = adaptationOf({ lived_evidence_adaptation: await env.offerLivedEvidenceAdaptation([episodeRef]) });
    expect(replay1).not.toBeNull();
    expect(replay2).not.toBeNull();

    // Canonical familiarity is still 1/32 in a later human-context projection.
    const humanRecorder = { requests: [] as string[] };
    const human = await InteractiveSubjectHostV0.open(humanConfig(dir), humanDeps(dir, humanRecorder));
    const turn = await human.send("Alice asks for the review status.");
    expect(turn.status).toBe("COMPLETE");
    const request = humanRecorder.requests.at(-1) as string;
    expect(request).toContain("entity:alice: presence=PRESENT level=1/32");
    expect(request).not.toContain("level=2/32");
  }, 60000);

  it("LEVEL 6: environment-originated adaptation causally reaches later human cognition", async () => {
    const laterText = "Alice asks for the review status.";

    // Run A — environment history produced relationship familiarity R1.
    const dirA = makeTempDir();
    const envA = await EnvironmentSubjectHostV0.open(envConfig(dirA), envDeps(dirA, { requests: [] }));
    expect((await envA.processNextInteraction()).status).toBe("COMPLETE");
    const humanRecorderA = { requests: [] as string[] };
    const humanA = await InteractiveSubjectHostV0.open(humanConfig(dirA), humanDeps(dirA, humanRecorderA));
    expect((await humanA.send(laterText)).status).toBe("COMPLETE");
    const requestA = humanRecorderA.requests.at(-1) as string;

    // Run B — same later current event, no environment history.
    const dirB = makeTempDir();
    const humanRecorderB = { requests: [] as string[] };
    const humanB = await InteractiveSubjectHostV0.open(humanConfig(dirB), humanDeps(dirB, humanRecorderB));
    expect((await humanB.send(laterText)).status).toBe("COMPLETE");
    const requestB = humanRecorderB.requests.at(-1) as string;

    expect(requestA).not.toBe(requestB);
    expect(requestA).toContain("entity:alice: presence=PRESENT level=1/32");
    expect(requestB).not.toContain("entity:alice: presence=PRESENT");
  }, 60000);

  it("reaches Belief and Personality runners too, and reports lawful no-change when ineligible", async () => {
    const dir = makeTempDir();
    const env = await EnvironmentSubjectHostV0.open(
      envConfig(dir),
      envDeps(dir, { requests: [] }, {
        beliefSemanticProvider: noBearingBelief as never,
        personalityAdaptationFactory: (authorities) =>
          new PersonalityAdaptationWiringV0({
            subjectCore: authorities.subjectCore,
            memoryRepository: authorities.memoryRepository,
            producerAuthorizationIssuer: authorities.producerAuthorizationIssuer,
            readEpisodePayload: authorities.readEpisodePayload,
            semanticProvider: new AbstainPersonalityProvider(),
            store: new InMemoryPersonalityAdaptationStoreV0()
          })
      })
    );
    const outcome = await env.processNextInteraction();
    expect(outcome.status).toBe("COMPLETE");
    const report = adaptationOf(outcome);
    // Both providers were configured, so the runners were reached and returned
    // their own lawful status (empty belief/personality ⇒ no mutation).
    expect(report?.belief).not.toBeNull();
    expect((report?.belief as { status?: string }).status).not.toBe("DISABLED");
    expect(report?.personality).not.toBeNull();
    expect((report?.personality as { status?: string }).status).not.toBe("DISABLED");
  }, 60000);

  it("leaves the conversation product action-free", async () => {
    const dir = makeTempDir();
    const recorder = { requests: [] as string[] };
    const env = await EnvironmentSubjectHostV0.open(envConfig(dir), envDeps(dir, recorder));
    expect((await env.processNextInteraction()).status).toBe("COMPLETE");
    expect(recorder.requests[0]).toContain("(no external actions allowed this cycle");
  }, 60000);
});
