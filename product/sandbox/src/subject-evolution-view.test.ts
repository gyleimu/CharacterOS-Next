/**
 * SUBJECT_EVOLUTION_VIEW_V0 — product acceptance (O1–O10).
 *
 * Answers "why is this subject like this now?" from EXISTING durable sources, as a
 * READ-ONLY projection. 0 model calls: deterministic doubles, no network.
 *
 * The scenario is the one already proven by the two loop acceptances — a lived
 * event, an affect-changing event, and a belief-supporting/contradicting event —
 * read back after a REAL process restart.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0,
  type SubjectEvolutionViewV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0
} from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { ProductLifeOperationsV0 } from "./product-life-operations.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const SUBJECT_A = "alice-evolution";
const SUBJECT_B = "bob-evolution";
const PROPOSITION_LABEL = "The storage room is usually locked.";
const FIRST_EVENT = "The storage room is usually locked.";
const SECOND_EVENT = "I checked the storage room twice today and it was open both times.";
const OTHER_SUBJECT_EVENT = "My bicycle lives in the hallway.";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-evolution-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Classifies lived evidence content (the existing provider boundary) — no writes. */
class StorageRoomProvider implements BeliefSemanticTargetResolutionProviderV0 {
  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    const bindings = {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    const content = input.evidence.evidence.map((entry) => entry.scene).join("\n");
    if (!/storage room/i.test(content)) return { ...bindings, kind: "NO_BEARING" };
    const existing = input.catalog.propositions.find(
      (candidate) => candidate.proposition_label === PROPOSITION_LABEL
    );
    if (existing === undefined) {
      return { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: PROPOSITION_LABEL };
    }
    return {
      ...bindings,
      kind: "EXISTING_PROPOSITION",
      proposition_id: existing.proposition_id,
      relation: /(was open|open both times)/i.test(content) ? "CONTRADICTS" : "SUPPORTS"
    };
  }
}

function cognition(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      void user;
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

function language(): ModelTransportV0 {
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

function deps(root: string, subjectId: string) {
  return {
    conversationCognitionTransport: cognition(),
    languageTransport: language(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
    beliefSemanticProvider: new StorageRoomProvider() as never,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

async function open(root: string, subjectId: string) {
  return InteractiveSubjectHostV0.open(config(root, subjectId), deps(root, subjectId));
}

/** ONE fresh process: open, send one message, read the evolution projection. */
async function turnAndRead(root: string, subjectId: string, text: string) {
  const host = await open(root, subjectId);
  const outcome = await host.send(text);
  const view = await host.evolutionView({ limit: 5 });
  return { host, outcome, view };
}

function durableBytes(root: string, subjectId: string): string {
  return (
    readFileSync(join(root, `subject-${subjectId}.snapshot.json`), "utf8") +
    readFileSync(join(root, `subject-${subjectId}.shared-subject.json`), "utf8")
  );
}

describe("SUBJECT_EVOLUTION_VIEW_V0 — product acceptance", () => {
  it("O1: a brand-new subject reports empty sections and honest attribution", async () => {
    const root = makeTempDir();
    const host = await open(root, SUBJECT_A);
    const view = await host.evolutionView({ limit: 5 });
    expect(view.subject.subject_id).toBe(SUBJECT_A);
    expect(view.recent_lived_events).toEqual([]);
    expect(view.durable_effects.affect).toEqual([]);
    expect(view.durable_effects.belief).toEqual([]);
    expect(view.current.beliefs).toEqual([]);
    expect(view.attribution.affect.status).toBe("UNAVAILABLE");
    expect(view.attribution.belief.status).toBe("UNAVAILABLE");
    expect(view.attribution.relationship.status).toBe("UNAVAILABLE");
    expect(view.attribution.personality.status).toBe("UNAVAILABLE");
  }, 120_000);

  it("O2–O5: lived events, affect and belief transitions are source-bound, and current values are canonical", async () => {
    const root = makeTempDir();
    // ---- one ordinary lived event -------------------------------------------
    const first = await turnAndRead(root, SUBJECT_A, FIRST_EVENT);
    expect(first.outcome.status, first.outcome.failure ?? "").toBe("COMPLETE");
    expect(first.view.recent_lived_events).toHaveLength(1);
    expect(first.view.recent_lived_events[0]?.kind).toBe("OBSERVATION");
    expect(first.view.recent_lived_events[0]?.scene).toContain("storage room");
    expect(first.view.recent_lived_events[0]?.episode_ref).toBe(first.outcome.observational_experience_ref);

    // ---- O9: reading the projection changed NOTHING --------------------------
    const bytesBefore = durableBytes(root, SUBJECT_A);
    const statusBefore = await first.host.status();
    const again = await first.host.evolutionView({ limit: 5 });
    const statusAfter = await first.host.status();
    expect(statusAfter.state_revision).toBe(statusBefore.state_revision);
    expect(statusAfter.repository_revision).toBe(statusBefore.repository_revision);
    expect(durableBytes(root, SUBJECT_A)).toBe(bytesBefore);
    expect(JSON.stringify(again)).toBe(JSON.stringify(first.view));

    // ---- a second lived event that moves affect and belief -------------------
    const second = await turnAndRead(root, SUBJECT_A, SECOND_EVENT);
    expect(second.outcome.status, second.outcome.failure ?? "").toBe("COMPLETE");
    const view = second.view;

    // O2: both lived events, newest first, with exact refs.
    expect(view.recent_lived_events.length).toBeGreaterThanOrEqual(2);
    const refs = view.recent_lived_events.map((event) => event.episode_ref);
    expect(refs).toContain(second.outcome.completed_prior_outcome?.episode_ref as string);

    // O3: the affect transition is attributed to its OWN recorded cause chain.
    expect(view.attribution.affect.status).toBe("UPDATED_FROM");
    expect(view.durable_effects.affect.length).toBeGreaterThanOrEqual(2);
    for (const transition of view.durable_effects.affect) {
      expect(transition.observation_ref.startsWith("observation:")).toBe(true);
      expect(transition.event_ref.startsWith("event:")).toBe(true);
      expect(transition.appraisal_ref.startsWith("appraisal:")).toBe(true);
    }
    const newestAffect = view.durable_effects.affect[0];
    expect(newestAffect?.valence_after).toBe(view.current.affect.valence);
    expect(newestAffect?.valence_before).not.toBeNull();

    // O4: belief transitions — the admission AND the later plasticity, both bound
    // to their own evidence episode with the durable credences.
    expect(view.attribution.belief.status).toBe("UPDATED_FROM");
    const belief = view.durable_effects.belief;
    expect(belief.length).toBeGreaterThanOrEqual(2);
    const admission = belief.find((transition) => transition.prior_credence === null);
    const plasticity = belief.find((transition) => transition.prior_credence === 0.55);
    expect(admission?.next_credence).toBe(0.55);
    expect(admission?.proposition_label).toBe(PROPOSITION_LABEL);
    expect(admission?.evidence_episode_refs).toHaveLength(1);
    expect(plasticity?.relation).toBe("CONTRADICTS");
    expect(plasticity?.next_credence).toBe(0.5);
    expect(plasticity?.proposition_id).toBe(admission?.proposition_id);
    expect(plasticity?.evidence_episode_refs).toEqual([second.outcome.completed_prior_outcome?.episode_ref]);

    // O5: current values come from the SAME canonical authority the state view uses.
    const state = await second.host.subjectStateView();
    expect(view.current.affect).toEqual(state.affect);
    expect(view.current.beliefs).toEqual(
      state.beliefs.map((item) => ({
        proposition_id: item.proposition_id,
        proposition_label: item.proposition_label,
        credence: item.credence
      }))
    );
    expect(view.current.relationships).toEqual(state.relationships);
    expect(view.current.personality).toEqual(state.personality);
    expect(view.current.memory.total_episode_count).toBe((await second.host.livedMemory({ limit: 100 })).total_episode_count);

    // The cognition-visible section names the durable sources, never reasoning.
    expect(view.cognition_visible.policy).toBe("AVAILABLE_TO_COGNITION");
    expect(JSON.stringify(view)).not.toContain("reasoning_summary");
  }, 120_000);

  it("O6: a RESTART produces an equivalent projection", async () => {
    const root = makeTempDir();
    await turnAndRead(root, SUBJECT_A, FIRST_EVENT);
    const second = await turnAndRead(root, SUBJECT_A, SECOND_EVENT);
    const before = second.view;

    // Fresh process over the same durable artifacts.
    const restored = await open(root, SUBJECT_A);
    expect(restored.resolution()).toBe("SUBJECT_RESTORED");
    const after = await restored.evolutionView({ limit: 5 });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(after.current.beliefs[0]?.credence).toBe(0.5);
  }, 120_000);

  it("O7+O8: cross-subject isolation holds and untraceable domains stay honest", async () => {
    const rootA = makeTempDir();
    const rootB = makeTempDir();
    const a = await turnAndRead(rootA, SUBJECT_A, FIRST_EVENT);
    const b = await turnAndRead(rootB, SUBJECT_B, OTHER_SUBJECT_EVENT);
    expect(a.view.subject.subject_id).toBe(SUBJECT_A);
    expect(b.view.subject.subject_id).toBe(SUBJECT_B);
    const serializedA = JSON.stringify(a.view);
    const serializedB = JSON.stringify(b.view);
    expect(serializedA).not.toContain(SUBJECT_B);
    expect(serializedA).not.toContain("bicycle");
    expect(serializedB).not.toContain(SUBJECT_A);
    expect(serializedB).not.toContain("storage room");
    // B's evidence had no bearing: its belief section is honestly empty.
    expect(b.view.durable_effects.belief).toEqual([]);
    expect(b.view.attribution.belief.status).toBe("UNAVAILABLE");
    // Both report the domains the architecture cannot trace.
    expect(b.view.attribution.relationship).toEqual({
      status: "UNAVAILABLE",
      reason: expect.stringContaining("no provenance field")
    });
    expect(b.view.attribution.personality.status).toBe("UNAVAILABLE");
  }, 120_000);

  it("O10 + surface: /life still works and now shows the durable-source sections", async () => {
    const root = makeTempDir();
    await turnAndRead(root, SUBJECT_A, FIRST_EVENT);
    const host = await open(root, SUBJECT_A);
    // Existing read surfaces are unchanged in behaviour.
    const state = await host.subjectStateView();
    expect(state.identity.subject_id).toBe(SUBJECT_A);
    const memory = await host.livedMemory({ limit: 5 });
    expect(memory.total_episode_count).toBe(1);
    // The product surface renders the projection on the ONE existing command.
    const lines: string[] = [];
    const store = new FileSharedSubjectSourceStoreV0(root, SUBJECT_A);
    const life = new ProductLifeOperationsV0(
      {
        storage_root: root,
        subject: { subject_id: SUBJECT_A, display_name: SUBJECT_A, identity_anchors: [] },
        interaction_interval_ticks: 1
      },
      {
        host,
        sharedSourceStore: store,
        conversationCognitionTransport: cognition(),
        languageTransport: language(),
        factualEventAppraisalProvider: createConstantAppraisalProviderV0(),
        provider_identity: { model: "fake", num_predict: 2048 },
        clock: () => "2026-01-01T00:00:00.000Z"
      } as never
    );
    const session = new ProductCliSessionV0({
      host,
      life,
      subjectLabel: SUBJECT_A,
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: false,
      write: (line) => lines.push(line)
    });
    await session.handleLine("/life");
    const text = lines.join("\n");
    expect(text).toContain("one life");
    expect(text).toContain("Durable changes (source-bound)");
    expect(text).toContain("affect valence");
    expect(text).toContain("from observation=");
    expect(text).toContain(`belief "${PROPOSITION_LABEL}"`);
    expect(text).toContain("Currently available to cognition (source identity only)");
    expect(text).toContain("source attribution: UNAVAILABLE");
    // Read-only: the /life render left the subject state untouched.
    const afterState = await host.subjectStateView();
    expect(afterState.state_revision).toBe(state.state_revision);
  }, 120_000);

  it("the projection carries no process-local handles and survives JSON round trip", async () => {
    const root = makeTempDir();
    const { view } = await turnAndRead(root, SUBJECT_A, FIRST_EVENT);
    const parsed = JSON.parse(JSON.stringify(view)) as SubjectEvolutionViewV0;
    expect(parsed.subject.subject_id).toBe(SUBJECT_A);
    expect(parsed.attribution.affect.status).toBe("UPDATED_FROM");
  }, 120_000);
});
