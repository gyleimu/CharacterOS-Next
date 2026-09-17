/**
 * BELIEF_LIVED_EXPERIENCE_CLOSED_LOOP_V0 — product acceptance.
 *
 * THE LOOP, through the REAL product host (`InteractiveSubjectHostV0`), 0 model calls:
 *
 *   LIVED EVENT 1 → canonical proposition admission (the subject's OWN belief forms)
 *   LIVED EVENT 2 → additional lived evidence → the EXISTING frozen plasticity path
 *   RESTART       → the changed belief is restored
 *   LATER TURN    → the model-facing cognition context carries each subject's OWN belief
 *
 * SUBJECTIVE, NOT TRUTH: this proves that different lived evidence produces different
 * canonical subjective endorsement (credence). It makes NO claim about the world —
 * a contradiction lowers endorsement through the frozen ±0.05 law; it does not
 * establish or refute anything.
 *
 * BELIEF_LIVED_EXPERIENCE_CONTENT_VISIBILITY_V0 (production fix in this slice): a
 * conversation-feedback episode records a host scene LABEL, so before this slice the
 * semantic provider could only ever see that label after the subject's first turn —
 * which made later lived evidence unclassifiable in an ordinary conversation. The
 * host now renders the episode's RESOLVED FACTUAL content (exact delivered behavior
 * text + exact outcome reply text) through the SAME verified resolver the cognition
 * path uses; both subjects therefore differ in what their provider can read.
 *
 * NO DIRECT STATE MUTATION: the harness only calls host.send(...) and reads files.
 * The semantic provider double only CLASSIFIES the lived evidence it is shown; it
 * cannot write state, propose identity, or name a credence.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0
} from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const SUBJECT_A = "alice-belief";
const SUBJECT_B = "bob-belief";

/** Ordinary product-world proposition — NOT the frozen confirmatory target. */
const PROPOSITION_LABEL = "The storage room is usually locked.";
const FIRST_EVENT = "The storage room is usually locked.";
/** A's second lived event contradicts the proposition; B's corroborates it. */
const SECOND_EVENT_A = "I checked the storage room twice today and it was open both times.";
const SECOND_EVENT_B = "I checked the storage room this morning and it was locked as usual.";
const LATER_SCENE = "Is there anything I should know before I go down to the storage room?";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-belief-loop-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Deterministic CLASSIFIER of lived evidence (the existing provider boundary):
 * it reads the provider-visible evidence content and proposes either a NEW
 * proposition label — the host canonicalizes the label, derives the identity and
 * sets the initial credence — or, once that proposition exists, the EXISTING
 * target with the relation the CONTENT carries. It never supplies a key, an
 * identity, a relation for a new candidate, or any number.
 */
class StorageRoomSemanticProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  readonly inputs: BeliefSemanticTargetResolutionProviderInputV0[] = [];

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    this.calls += 1;
    this.inputs.push(input);
    const bindings = {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    const content = input.evidence.evidence.map((entry) => entry.scene).join("\n");
    if (!/storage room/i.test(content)) {
      return { ...bindings, kind: "NO_BEARING" };
    }
    const existing = input.catalog.propositions.find(
      (candidate) => candidate.proposition_label === PROPOSITION_LABEL
    );
    if (existing === undefined) {
      return { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: PROPOSITION_LABEL };
    }
    // The CONTENT decides the bearing: an observed unlocked room contradicts the
    // proposition; an observed locked room supports it.
    const contradicts = /(was open|open both times|not locked|unlocked)/i.test(content);
    return {
      ...bindings,
      kind: "EXISTING_PROPOSITION",
      proposition_id: existing.proposition_id,
      relation: contradicts ? "CONTRADICTS" : "SUPPORTS"
    };
  }
}

/** Records every cognition request so the model-facing belief context is inspectable. */
function cognitiveTransport(requests: string[]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
      return {
        content: JSON.stringify({
          response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
          schema_version: "conversation-cognition-proposal-v8",
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
          factual_assessment: { claims: [] },
          cognition: {
            schema_version: "cognition-proposal-v0",
            reasoning_summary: "deterministic acknowledgement",
            relevant_memory_handles: [],
            considered_handles: [],
            current_intent: "acknowledge",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_handles: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
          clarification_basis: null
        }),
        model: "fake"
      };
    }
  };
}

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => ({
      content: JSON.stringify({
        schema_version: "language-realization-semantic-draft-v1",
        text: "Noted.",
        evidence_refs: []
      }),
      model: "fake"
    })
  };
}

function config(root: string, subjectId: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: subjectId,
    display_name: subjectId,
    session_id: `sess-${subjectId}`,
    storage_root: root,
    interval_ticks: 1
  };
}

function deps(root: string, subjectId: string, provider: StorageRoomSemanticProvider, requests: string[]) {
  return {
    conversationCognitionTransport: cognitiveTransport(requests),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
    beliefSemanticProvider: provider as never,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

/** ONE fresh process: open the subject from its durable artifacts and send one message. */
async function turn(
  root: string,
  subjectId: string,
  provider: StorageRoomSemanticProvider,
  requests: string[],
  text: string
) {
  const host = await InteractiveSubjectHostV0.open(config(root, subjectId), deps(root, subjectId, provider, requests));
  const resolution = host.resolution();
  const outcome = await host.send(text);
  return { resolution, outcome };
}

function beliefOf(request: string): string {
  const start = request.indexOf("[SUBJECTIVE BELIEF STANCES");
  if (start < 0) return "(no belief section)";
  return request.slice(start, request.indexOf("[relationships]", start) < 0 ? undefined : request.indexOf("[relationships]", start));
}

describe("BELIEF_LIVED_EXPERIENCE_CLOSED_LOOP_V0 — product acceptance", () => {
  it("B1–B10: first evidence admits a proposition; later evidence moves it; restart restores it; later cognition carries it", async () => {
    const rootA = makeTempDir();
    const rootB = makeTempDir();
    const providerA = new StorageRoomSemanticProvider();
    const providerB = new StorageRoomSemanticProvider();
    const requestsA: string[] = [];
    const requestsB: string[] = [];

    // ---- B1/B2/B3: LIVED EVENT 1 → canonical proposition admission -----------
    const firstA = await turn(rootA, SUBJECT_A, providerA, requestsA, FIRST_EVENT);
    const firstB = await turn(rootB, SUBJECT_B, providerB, requestsB, FIRST_EVENT);
    expect(firstA.outcome.status, firstA.outcome.failure ?? "").toBe("COMPLETE");
    expect(firstB.outcome.status, firstB.outcome.failure ?? "").toBe("COMPLETE");
    const formedA = firstA.outcome.belief_adaptation?.current;
    const formedB = firstB.outcome.belief_adaptation?.current;
    expect(formedA?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(formedB?.terminal_kind).toBe("COMPLETE_COMMITTED");
    // Host-derived identity: the label is the canonical label, and the identity is
    // content-addressed + SUBJECT-SCOPED (same law for both subjects, distinct ids).
    expect(formedA?.canonical_label).toBe(PROPOSITION_LABEL);
    expect(formedB?.canonical_label).toBe(PROPOSITION_LABEL);
    expect(formedA?.proposition_id).toBeDefined();
    expect(formedA?.proposition_id).not.toBe(formedB?.proposition_id);
    // B5 (first step): the initial credence is the host's, and identical for both —
    // the difference below can only come from the SECOND lived event.
    expect(formedA?.prior_credence).toBeNull();
    expect(formedA?.next_credence).toBe(0.55);
    expect(formedB?.next_credence).toBe(0.55);
    // B3: the evidence binding is the turn's OWN committed episode.
    expect(formedA?.evidence_episode_refs).toEqual([firstA.outcome.observational_experience_ref]);
    expect(formedB?.evidence_episode_refs).toEqual([firstB.outcome.observational_experience_ref]);
    // Each subject's evidence is its OWN episode record (distinct identities).
    expect(formedA?.evidence_episode_refs).not.toEqual(formedB?.evidence_episode_refs);

    // ---- B4/B5: LIVED EVENT 2 → EXISTING plasticity, opposite directions -----
    const secondA = await turn(rootA, SUBJECT_A, providerA, requestsA, SECOND_EVENT_A);
    const secondB = await turn(rootB, SUBJECT_B, providerB, requestsB, SECOND_EVENT_B);
    expect(secondA.outcome.status, secondA.outcome.failure ?? "").toBe("COMPLETE");
    expect(secondB.outcome.status, secondB.outcome.failure ?? "").toBe("COMPLETE");
    const movedA = secondA.outcome.belief_adaptation?.current;
    const movedB = secondB.outcome.belief_adaptation?.current;
    expect(movedA?.terminal_kind, JSON.stringify(secondA.outcome.belief_adaptation)).toBe("COMPLETE_COMMITTED");
    expect(movedB?.terminal_kind).toBe("COMPLETE_COMMITTED");
    // Same canonical proposition identity on both sides — the label routes to it.
    expect(movedA?.proposition_id).toBe(formedA?.proposition_id);
    expect(movedB?.proposition_id).toBe(formedB?.proposition_id);
    // The frozen ±0.05 law, one raw IEEE-754 step, and the content decided the sign.
    expect(movedA?.prior_credence).toBe(0.55);
    expect(movedB?.prior_credence).toBe(0.55);
    expect(movedA?.next_credence).toBe(0.55 - 0.05);
    expect(movedB?.next_credence).toBe(0.55 + 0.05);
    // B4: the evidence offered is THIS turn's lived record (the delivered behavior
    // paired with its counterpart reply) — the feedback episode, not the first one.
    const secondEpisodeA = secondA.outcome.completed_prior_outcome?.episode_ref;
    expect(secondEpisodeA).toBeDefined();
    expect(movedA?.evidence_episode_refs).toEqual([secondEpisodeA]);
    expect(movedA?.evidence_episode_refs).not.toEqual(formedA?.evidence_episode_refs);
    // B8: the provider saw each subject's OWN lived content, and the contradiction
    // was visible as CONTENT (this is the slice's production fix).
    const contentA = providerA.inputs.at(1)?.evidence.evidence.map((entry) => entry.scene).join("\n") ?? "";
    const contentB = providerB.inputs.at(1)?.evidence.evidence.map((entry) => entry.scene).join("\n") ?? "";
    expect(contentA).toContain(SECOND_EVENT_A);
    expect(contentB).toContain(SECOND_EVENT_B);
    expect(contentA).not.toBe(contentB);
    expect(contentA).not.toContain(SECOND_EVENT_B);

    // ---- B6: RESTART restores the changed belief exactly ---------------------
    const laterA = await turn(rootA, SUBJECT_A, providerA, requestsA, LATER_SCENE);
    const laterB = await turn(rootB, SUBJECT_B, providerB, requestsB, LATER_SCENE);
    expect(laterA.resolution).toBe("SUBJECT_RESTORED");
    expect(laterB.resolution).toBe("SUBJECT_RESTORED");
    expect(laterA.outcome.status, laterA.outcome.failure ?? "").toBe("COMPLETE");
    expect(laterB.outcome.status, laterB.outcome.failure ?? "").toBe("COMPLETE");

    // ---- B7: later cognition carries each subject's OWN restored belief -------
    const laterRequestA = requestsA.at(-1) as string;
    const laterRequestB = requestsB.at(-1) as string;
    const contextA = beliefOf(laterRequestA);
    const contextB = beliefOf(laterRequestB);
    expect(contextA).not.toContain("showing 0 of 0");
    expect(contextB).not.toContain("showing 0 of 0");
    expect(contextA).toContain(PROPOSITION_LABEL);
    expect(contextB).toContain(PROPOSITION_LABEL);
    expect(contextA).toContain(String(0.55 - 0.05));
    expect(contextB).toContain(String(0.55 + 0.05));
    expect(contextA).not.toBe(contextB);
    // The current scene is identical, so the difference is durable-belief-derived.
    const sceneLine = (request: string): string =>
      request.split("\n").find((line) => line.startsWith("[context] scene=")) ?? "(none)";
    expect(sceneLine(laterRequestA)).toBe(sceneLine(laterRequestB));

    // ---- B9: no cross-subject leak -------------------------------------------
    expect(laterRequestA).not.toContain(SUBJECT_B);
    expect(laterRequestB).not.toContain(SUBJECT_A);
    expect(laterRequestA).not.toContain(SECOND_EVENT_B);
    expect(laterRequestB).not.toContain(SECOND_EVENT_A);
    expect(providerB.inputs.some((input) => input.subject_id === SUBJECT_A)).toBe(false);
    expect(providerA.inputs.some((input) => input.subject_id === SUBJECT_B)).toBe(false);
  }, 120_000);

  it("B10: the harness performs no direct state mutation — only host turns and provider classification", async () => {
    // Every canonical effect above came from `host.send` plus the provider's
    // classification. This test pins the shape: the double has NO write API and the
    // harness holds no belief handle at all.
    const root = makeTempDir();
    const provider = new StorageRoomSemanticProvider();
    const first = await turn(root, SUBJECT_A, provider, [], FIRST_EVENT);
    expect(first.outcome.status).toBe("COMPLETE");
    expect(Object.keys(provider).sort()).toEqual(["calls", "inputs"]);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).sort()).toEqual(["constructor", "propose"]);
    // The provider was called exactly once, after the turn's own cognition (§31).
    expect(provider.calls).toBe(1);
  }, 120_000);
});
