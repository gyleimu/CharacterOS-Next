/**
 * BELIEF_ADAPTATION_SESSION_WIRING_V0 — deterministic offline acceptance
 * through the REAL interactive runtime.
 *
 * Proves the ONE bounded slice: canonical lived evidence committed by an
 * interactive turn is lawfully offered to the FROZEN belief plasticity chain
 * (semantic resolution → plasticity producer → BeliefTransitionExecutor →
 * SubjectCore canonical commit), the changed Belief survives authoritative
 * restore, and later cognition sees it. Zero real model calls: fake cognition/
 * language transports, fake appraisal, deterministic test-local belief
 * semantic provider (the provider — not the host — classifies evidence
 * bearing from episode scene content; no host SUPPORTIVE/CONTRADICTORY labels
 * are ever passed, §29).
 *
 * Proposition source (§23/§24): the canonical proposition exists through the
 * LAWFUL genesis-foundation path — a test/research-level v3_source fixture
 * with one seeded belief (same convention as belief-adaptation-e2e-proof).
 * The production host seed remains empty/unchanged; no product proposition
 * admission is claimed.
 */

import { describe, expect, it } from "vitest";

import {
  BELIEF_STATE_SCHEMA_VERSION,
  validateSubjectState,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../transports/model-transport.js";
import type {
  BeliefSemanticTargetResolutionProviderInputV0,
  BeliefSemanticTargetResolutionProviderV0
} from "../transitions/belief/belief-semantic-target-resolution.js";
import { BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION } from "../transitions/belief/belief-semantic-target-resolution.js";
import {
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0,
  type InteractiveSubjectRuntimeOptionsV0,
  type InteractiveSubjectSnapshotV0
} from "./interactive-subject-runtime-v0.js";

const SUBJECT_ID = "alice";
const TARGET_PROP = "prop.alice-keeps-promises";
const TARGET_LABEL = "Alice keeps promises";
const INITIAL_CREDENCE = 0.6;
type Mode = "CLARIFY" | "REALIZE";

/** Lawful genesis-foundation fixture: s0 identity seed + ONE canonical proposition. */
function seededV3Source(): SubjectStateV0 {
  const base = createInteractiveSubjectSeedV0(SUBJECT_ID, "", []) as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [
        {
          proposition_id: TARGET_PROP,
          proposition_label: TARGET_LABEL,
          credence: INITIAL_CREDENCE
        }
      ]
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`fixture invalid: ${checked.error.detail}`);
  return checked.value;
}

function fakeAppraisalProvider(): FactualEventAppraisalProviderV0 {
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
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4
        },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function fakeCognitionTransport(mode: () => Mode, recorder: TransportRecorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      const selected = mode();
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline test cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond to the user",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: {
            kind: selected === "CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT"
          }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function fakeLanguageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "LANGUAGE_REALIZATION_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

/**
 * Deterministic TEST-LOCAL stand-in for the belief semantic provider: it
 * classifies evidence bearing from the EPISODE SCENE CONTENT alone (the same
 * authority position the real Ollama provider occupies). The host passes no
 * labels and no numeric authority.
 */
class ScriptedBeliefSemanticProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  inputs: BeliefSemanticTargetResolutionProviderInputV0[] = [];
  private readonly failFirstCall: boolean;

  constructor(options: { readonly failFirstCall?: boolean } = {}) {
    this.failFirstCall = options.failFirstCall ?? false;
  }

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    this.calls += 1;
    this.inputs.push(input);
    if (this.failFirstCall && this.calls === 1) {
      throw new Error("SIMULATED_PROVIDER_FAILURE");
    }
    const scenes = input.evidence.evidence.map((entry) => entry.scene).join(" ");
    let relation: "SUPPORTS" | "CONTRADICTS" | null = null;
    if (/kept her promise|delivered on time/i.test(scenes)) relation = "SUPPORTS";
    else if (/broke her promise|broke that promise/i.test(scenes)) relation = "CONTRADICTS";
    if (relation === null || !input.catalog.propositions.some((p) => p.proposition_id === TARGET_PROP)) {
      return {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        kind: "NO_BEARING",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
      };
    }
    return {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      kind: "EXISTING_PROPOSITION",
      proposition_id: TARGET_PROP,
      relation,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
  }
}

function options(input: {
  mode?: () => Mode;
  recorder?: TransportRecorder;
  beliefProvider?: BeliefSemanticTargetResolutionProviderV0;
  seededBeliefs?: boolean;
} = {}): InteractiveSubjectRuntimeOptionsV0 {
  const recorder = input.recorder ?? { requests: [] };
  return {
    session_id: "sess-belief-wiring-test",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source:
      input.seededBeliefs === false
        ? createInteractiveSubjectSeedV0(SUBJECT_ID)
        : seededV3Source(),
    conversationCognitionTransport: fakeCognitionTransport(input.mode ?? (() => "CLARIFY"), recorder),
    languageTransport: fakeLanguageTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    ...(input.beliefProvider === undefined ? {} : { beliefSemanticProvider: input.beliefProvider }),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

/** The cognition prompt's exact belief section for the target proposition. */
function cognitionBeliefLine(recorder: TransportRecorder, index: number): string | null {
  const request = recorder.requests[index];
  if (request === undefined) return null;
  const user = request.messages.find((m) => m.role === "user")?.content ?? "";
  const match = new RegExp(`\\{\\"proposition_id\\":\\"${TARGET_PROP}\\"[^}]*\\}`).exec(user);
  return match?.[0] ?? null;
}

describe("BELIEF_ADAPTATION_SESSION_WIRING_V0 — offline acceptance", () => {
  it("LEVEL_1+LEVEL_2: lived evidence reaches the frozen plasticity chain and changes canonical belief through authority", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider }));
    const turn = await runtime.submitUserText("Alice said she would review my draft and she delivered on time, she kept her promise.");
    expect(turn.status).toBe("COMPLETE");
    const report = turn.belief_adaptation;
    if (report === null) throw new Error("unreachable: belief adaptation report missing");
    expect(report.status).toBe("COMPLETED");
    expect(report.failure).toBeNull();
    const current = report.current;
    if (current === null) throw new Error("unreachable: current workflow outcome missing");
    // LEVEL_1: the canonical episode reached the lawful chain as evidence.
    expect(current.evidence_episode_refs).toHaveLength(1);
    expect(current.evidence_episode_refs[0]).toBe(turn.completed_prior_outcome === null ? turn.observational_experience_ref : turn.completed_prior_outcome.episode_ref);
    expect(current.evidence_episode_refs[0]?.startsWith("episode:")).toBe(true);
    expect(current.provider_calls).toBe(1);
    // LEVEL_2: the canonical BeliefState changed THROUGH AUTHORITY (frozen
    // plasticity step law: SUPPORTS ⇒ current + 0.05, IEEE-754, no rounding).
    expect(current.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(current.proposition_id).toBe(TARGET_PROP);
    expect(current.prior_credence).toBe(INITIAL_CREDENCE);
    expect(current.next_credence).toBe(INITIAL_CREDENCE + 0.05);
  });

  it("§31 same-turn isolation: the turn's own cognition saw the pre-change belief; the next turn sees the change", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const recorder: TransportRecorder = { requests: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider, recorder }));
    const first = await runtime.submitUserText("Alice kept her promise again, she delivered on time.");
    expect(first.status).toBe("COMPLETE");
    expect(first.belief_adaptation?.current?.terminal_kind).toBe("COMPLETE_COMMITTED");
    // The ONLY cognition request so far still carries the pre-change credence.
    const beforeLine = cognitionBeliefLine(recorder, 0);
    expect(beforeLine).toContain(`"credence":${INITIAL_CREDENCE}`);
    // Second turn: its cognition request carries the POST-change credence.
    await runtime.submitUserText("How is the weather task going?");
    const afterLine = cognitionBeliefLine(recorder, 1);
    expect(afterLine).toContain(`"credence":${INITIAL_CREDENCE + 0.05}`);
    // Exactly ONE belief semantic provider call per turn's evidence workflow
    // (turn 1: SUPPORTS commit; turn 2: its own unrelated evidence → NO_BEARING).
    expect(provider.calls).toBe(2);
  });

  it("LEVEL_3+LEVEL_4: the changed belief survives a real restart and reaches later cognition", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const recorderA: TransportRecorder = { requests: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider, recorder: recorderA }));
    await runtime.submitUserText("Alice kept her promise, she delivered on time.");
    const snapshot = await runtime.snapshot();
    const parsed = JSON.parse(JSON.stringify(snapshot)) as InteractiveSubjectSnapshotV0;
    // Real restart: fresh runtime from the parsed image only.
    const recorderB: TransportRecorder = { requests: [] };
    const restoredProvider = new ScriptedBeliefSemanticProvider();
    const restored = await InteractiveSubjectRuntimeV0.restore(
      options({ beliefProvider: restoredProvider, recorder: recorderB }),
      parsed
    );
    const turn = await restored.submitUserText("A neutral unrelated message about coffee.");
    expect(turn.status).toBe("COMPLETE");
    // LEVEL_4: the restored canonical belief (changed credence) is projected
    // into later cognition's request.
    const line = cognitionBeliefLine(recorderB, 0);
    expect(line).toContain(`"credence":${INITIAL_CREDENCE + 0.05}`);
    // The unrelated new evidence is lawfully classified NO_BEARING: no change.
    expect(turn.belief_adaptation?.status).toBe("COMPLETED");
    expect(turn.belief_adaptation?.current?.terminal_kind, JSON.stringify(turn.belief_adaptation)).toBe(
      "COMPLETE_NO_BEARING"
    );
    expect(turn.belief_adaptation?.current?.provider_calls).toBe(1);
    expect(restoredProvider.calls).toBe(1);
  });

  it("§55 no-change disposition: irrelevant evidence never changes the target belief", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider }));
    const turn = await runtime.submitUserText("I am thinking about reorganizing my bookshelf this weekend.");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.belief_adaptation?.current?.terminal_kind).toBe("COMPLETE_NO_BEARING");
    expect(turn.belief_adaptation?.current?.proposition_id).toBeNull();
    expect(turn.belief_adaptation?.current?.next_credence).toBeNull();
    expect(provider.calls).toBe(1);
  });

  it("§62 contrary evidence decreases credence through the same frozen law", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider }));
    const turn = await runtime.submitUserText("Alice broke that promise she made about the review, she never delivered.");
    expect(turn.status).toBe("COMPLETE");
    const current = turn.belief_adaptation?.current;
    expect(current?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(current?.prior_credence).toBe(INITIAL_CREDENCE);
    expect(current?.next_credence).toBe(INITIAL_CREDENCE - 0.05);
  });

  it("§65 provider failure: belief remains unchanged, turn still completes, no neutral update", async () => {
    const provider = new ScriptedBeliefSemanticProvider({ failFirstCall: true });
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ beliefProvider: provider }));
    const turn = await runtime.submitUserText("Alice kept her promise, she delivered on time.");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.subject_text.length).toBeGreaterThan(0);
    const current = turn.belief_adaptation?.current;
    expect(current?.terminal_kind).toBe("REJECTED_SEMANTIC");
    expect(current?.proposition_id).toBeNull();
    expect(current?.next_credence).toBeNull();
    // The rejection is durable: replaying the SAME evidence workflow never
    // retries the provider (one proposal per evidence transition, §77).
    expect(provider.calls).toBe(1);
  });

  it("§23 production truthfulness: a subject with no canonical proposition skips adaptively with zero provider calls", async () => {
    const provider = new ScriptedBeliefSemanticProvider();
    const runtime = await InteractiveSubjectRuntimeV0.create(
      options({ beliefProvider: provider, seededBeliefs: false })
    );
    const turn = await runtime.submitUserText("Alice kept her promise, she delivered on time.");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.belief_adaptation?.status).toBe("SKIPPED_NO_CANDIDATE_PROPOSITIONS");
    expect(turn.belief_adaptation?.current).toBeNull();
    expect(provider.calls).toBe(0);
  });

  it("belief adaptation stays DISABLED without a provider: no store, no calls, legacy behavior intact", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    const turn = await runtime.submitUserText("Alice kept her promise, she delivered on time.");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.belief_adaptation?.status).toBe("DISABLED");
    expect(turn.belief_adaptation?.current).toBeNull();
    expect(turn.belief_adaptation?.resumed).toEqual([]);
  });
});
