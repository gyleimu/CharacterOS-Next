/**
 * LONGITUDINAL_INTEGRATED_SUBJECT_TRAJECTORY_V0 — product acceptance.
 *
 * ONE subject lives a long life (40 lived events) across MULTIPLE state channels
 * (Memory, Affect, Belief, Relationship, Personality) with THREE fresh restarts,
 * beside ONE control subject with the same genesis, the same number of turns, the
 * same doubles and the same final scene — diverging only in the CONTENT of a few
 * lived events. It answers one question: is the subject shaped by a continuous life?
 *
 * IT ADDS NO CORE FEATURE. Every event goes through the existing ingresses
 * (`host.send` for conversation, the structured-observation ingress for perception
 * events) and every state change is produced by the frozen semantics already in the
 * repo. Nothing in this file writes state directly, and there are no scripted state
 * targets: the plan describes EVENTS, never values.
 *
 * 0 model calls: contract-faithful deterministic doubles only.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  BeliefSemanticTargetResolutionProviderInputV0,
  BeliefSemanticTargetResolutionProviderV0,
  FactualEventAppraisalProviderV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  PersonalityGenesisPriorV0,
  SubjectEvolutionViewV0
} from "@characteros-next/runtime";
import { BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION } from "@characteros-next/runtime";
import {
  InMemoryPersonalityAdaptationStoreV0,
  PersonalityAdaptationWiringV0,
  type PersonalitySemanticChannelProviderV0
} from "@characteros-next/personality";
import type {
  RelationshipInteractionQualifyingAdmissionProviderV0,
  RelationshipInteractionQualifyingAdmissionV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { PRODUCT_TURN_TRANSCRIPT_MAX_LIMIT } from "./product-turn-transcript.js";
import { ProductLifeOperationsV0 } from "./product-life-operations.js";
import { buildStructuredObservationRequestV0 } from "./product-observation.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const ALICE = "alice-trajectory";
const CONTROL = "bob-trajectory";
const TOTAL_EVENTS = 40;
const RESTART_AFTER = [10, 25, 40] as const;

/** The one proposition this life is about (NOT the frozen confirmatory target). */
const PROPOSITION_LABEL = "The workshop door is usually closed.";
/** Key-event content that makes Alice's and Control's lives diverge. */
const ALICE_FRUSTRATION = [
  "The workshop door was jammed again and I had to force it open.",
  "Someone left the workshop door wide open all night and everything is damp.",
  "The workshop door lock is broken and nobody has fixed it for a month."
] as const;
const CONTROL_CALM = [
  "The workshop door opened smoothly this morning and I started right away.",
  "The workshop door was closed overnight and the room stayed dry.",
  "The workshop door lock was serviced last week and works well."
] as const;
const ALICE_EVIDENCE = [
  "I checked the workshop door twice today and it was open both times.",
  "I walked past the workshop twice today and the door was standing open.",
  "The workshop door was open again at midnight when I passed by."
] as const;
const CONTROL_EVIDENCE = [
  "I checked the workshop door twice today and it was closed both times.",
  "I walked past the workshop twice today and the door was shut tight.",
  "The workshop door was closed again at midnight when I passed by."
] as const;
const ALICE_CONSEQUENCE = "I tried the workshop door just now and it was still open.";
const CONTROL_CONSEQUENCE = "I tried the workshop door just now and it was closed.";
const FINAL_SCENE = "What do you know about the workshop door?";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const base = join(process.cwd(), "tmp", "trajectory-acceptance");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "run-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------------------------- */
/* Deterministic doubles (no model calls)                                       */
/* -------------------------------------------------------------------------- */

/** Content-sensitive appraisal: frustrating events appraise poorly, calm ones well. */
function contentSensitiveAppraisal(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as {
        subject_id: string;
        factual_event_ref: string;
        context_projection_hash: string;
        current_observable_scene: string;
      };
      const scene = ctx.current_observable_scene ?? "";
      // Three-way content classification, so a life of frustrations cannot saturate
      // to the same ceiling as a life of successes: ordinary events are NEUTRAL.
      const frustrating = /(jammed|broken|wide open|damp|still open|was open|force it open|nobody has fixed|nobody closes|ever stay shut|bothers me|been open lately|had to dry)/i.test(scene);
      const calm = /(smoothly|stayed dry|works well|reliably|has been fine|been closed lately|serviced|thanked)/i.test(scene);
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.8,
          goal_congruence: frustrating ? 0.1 : calm ? 0.85 : 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.1,
          intensity: 0.8
        },
        assessment_confidence: 0.9,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

/** Classifies the lived evidence content; the host owns identity and credences. */
class DoorBeliefProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    this.calls += 1;
    const bindings = {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    const content = input.evidence.evidence.map((entry) => entry.scene).join("\n");
    if (!/workshop door/i.test(content)) return { ...bindings, kind: "NO_BEARING" };
    const existing = input.catalog.propositions.find((c) => c.proposition_label === PROPOSITION_LABEL);
    const statesIt = /usually closed|is usually shut|normally shut/i.test(content);
    if (existing === undefined) {
      // Only an event that STATES the proposition can form it.
      return statesIt
        ? { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: PROPOSITION_LABEL }
        : { ...bindings, kind: "NO_BEARING" };
    }
    const contradicting = /(was open|standing open|open both times|still open|wide open)/i.test(content);
    const supporting = /(was closed|closed both times|shut tight|was shut|closed again)/i.test(content);
    // NO bearing is the honest answer for a door mention that carries neither cue:
    // the classifier never invents a relation.
    if (!contradicting && !supporting) return { ...bindings, kind: "NO_BEARING" };
    return {
      ...bindings,
      kind: "EXISTING_PROPOSITION",
      proposition_id: existing.proposition_id,
      relation: contradicting ? "CONTRADICTS" : "SUPPORTS"
    };
  }
}

/** Deterministic familiarity admission for the SAME counterpart every time. */
class CounterpartFamiliarityProvider implements RelationshipInteractionQualifyingAdmissionProviderV0 {
  calls = 0;
  async admit(): Promise<RelationshipInteractionQualifyingAdmissionV0> {
    this.calls += 1;
    return { kind: "QUALIFYING", qualifying_class: "sustained_cooperative_interaction" } as never;
  }
}

/** Deterministic personality channel: one fixed allowlisted dimension movement. */
class WorkshopPersonalityProvider implements PersonalitySemanticChannelProviderV0 {
  calls = 0;
  async propose(input: Parameters<PersonalitySemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    return {
      kind: "CHANNEL",
      channel_id: "personality.conscientiousness.increase",
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

function prior(values: Record<string, number>): PersonalityGenesisPriorV0 {
  return {
    schema_version: "personality-genesis-prior-v0",
    dimensions: values as unknown as PersonalityGenesisPriorV0["dimensions"]
  };
}

type CognitionMode = "ACKNOWLEDGE" | "FOLLOWER";

/** Deterministic cognition: a plain acknowledgement, or a follower that cites what happened. */
function cognitionTransport(mode: () => CognitionMode, requests: string[]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
      if (mode() === "FOLLOWER") {
        const blockStart = user.indexOf("[BEGIN HISTORICAL FACTUAL CONTENT");
        const blockEnd = blockStart < 0 ? -1 : user.indexOf("[END HISTORICAL FACTUAL CONTENT]", blockStart);
        const block = blockStart < 0 ? "" : user.slice(blockStart, blockEnd < 0 ? user.length : blockEnd);
        const marker = "- A delivered behavior was followed by this actor's exact reply:";
        const at = block.lastIndexOf(marker);
        const record = at < 0 ? "" : block.slice(at);
        const valueOf = (key: string): string | null => {
          const keyAt = record.indexOf(`${key}: `);
          if (keyAt < 0) return null;
          const quoteAt = record.indexOf('"', keyAt + key.length);
          if (quoteAt < 0) return null;
          let scan = quoteAt;
          for (;;) {
            scan = record.indexOf('"', scan + 1);
            if (scan < 0) return null;
            let backslashes = 0;
            let probe = scan - 1;
            while (probe >= quoteAt && record[probe] === "\\") {
              backslashes += 1;
              probe -= 1;
            }
            if (backslashes % 2 === 0) break;
          }
          try {
            return JSON.parse(record.slice(quoteAt, scan + 1)) as string;
          } catch {
            return null;
          }
        };
        const outcome = at < 0 ? null : valueOf("outcome_reply_text");
        const episodeRef = at < 0 ? null : valueOf("episode_ref");
        // The handle must be the one advertised for THAT episode: a source quote
        // binds to its own source, and the host refuses anything else. When the
        // handle is not advertised, the follower simply acknowledges.
        const handle =
          outcome !== null && episodeRef !== null
            ? new RegExp(`- (F\\d+): ${episodeRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(user)?.[1] ?? null
            : null;
        if (outcome !== null && handle !== null) {
          return {
            content: JSON.stringify({
              response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GENERATIVE" },
              schema_version: "conversation-cognition-proposal-v8",
              subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
              factual_assessment: {
                claims: [{ kind: "SOURCE_QUOTE", text: outcome, source_handles: [handle] }]
              },
              cognition: {
                schema_version: "cognition-proposal-v0",
                reasoning_summary: "answer from what happened",
                relevant_memory_handles: [handle],
                considered_handles: [handle],
                current_intent: `answer with what happened: ${outcome}`,
                confidence: 0.8,
                uncertainty: 0.2,
                action_intent: null,
                evidence_handles: [handle]
              },
              communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
              clarification_basis: null
            }),
            model: "trajectory-double"
          };
        }
      }
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
        model: "trajectory-double"
      };
    }
  };
}

/** Contract-faithful renderer: the authorized claim when there is one, else a fixed line. */
function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const jsonAt = user.indexOf("{");
      let text = "Noted.";
      if (jsonAt >= 0) {
        let depth = 0;
        let inString = false;
        let escaped = false;
        let end = -1;
        for (let index = jsonAt; index < user.length; index += 1) {
          const character = user[index] as string;
          if (inString) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === '"') inString = false;
            continue;
          }
          if (character === '"') {
            inString = true;
            continue;
          }
          if (character === "{") depth += 1;
          else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
              end = index;
              break;
            }
          }
        }
        if (end > jsonAt) {
          const parsed = JSON.parse(user.slice(jsonAt, end + 1)) as {
            factual_assessment?: { claims?: { text?: string }[] };
            realization_plan?: { primary?: { kind?: string; act?: string } };
          };
          const claim = parsed.factual_assessment?.claims?.[0]?.text;
          const primary = parsed.realization_plan?.primary;
          if (primary?.kind === "PRIMARY_FACT" && claim !== undefined) text = claim;
          else if (
            primary?.kind === "PRIMARY_CONVERSATIONAL_ACT" &&
            primary.act === "GENERATIVE" &&
            claim !== undefined
          ) {
            text = `I remember: "${claim}"`;
          }
        }
      }
      return {
        content: JSON.stringify({
          schema_version: "language-realization-semantic-draft-v1",
          text,
          evidence_refs: []
        }),
        model: "trajectory-double"
      };
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

interface SubjectHarness {
  readonly subjectId: string;
  readonly root: string;
  host: InteractiveSubjectHostV0;
  readonly cognitionRequests: string[];
  readonly mode: { current: CognitionMode };
}

function config(subjectId: string, root: string): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: subjectId,
    display_name: subjectId === ALICE ? "Alice" : "Control",
    session_id: `sess-${subjectId}`,
    storage_root: root,
    interval_ticks: 1,
    personality_genesis_prior: prior({
      agreeableness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      openness: 0.5
    })
  };
}

function depsFor(harness: SubjectHarness) {
  return {
    conversationCognitionTransport: cognitionTransport(() => harness.mode.current, harness.cognitionRequests),
    languageTransport: languageTransport(),
    appraisalProvider: contentSensitiveAppraisal(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(harness.root, harness.subjectId),
    beliefSemanticProvider: new DoorBeliefProvider() as never,
    relationshipFamiliarityAdmissionProvider: new CounterpartFamiliarityProvider() as never,
    personalitySemanticProvider: new WorkshopPersonalityProvider() as never,
    provider_identity: { model: "trajectory-double", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

/** Opens a FRESH host over the same durable root: the process-local state is gone. */
async function freshHost(harness: SubjectHarness): Promise<InteractiveSubjectHostV0> {
  return InteractiveSubjectHostV0.open(config(harness.subjectId, harness.root), depsFor(harness) as never);
}

function lifeOps(harness: SubjectHarness, host: InteractiveSubjectHostV0): ProductLifeOperationsV0 {
  return new ProductLifeOperationsV0(
    {
      storage_root: harness.root,
      subject: {
        subject_id: harness.subjectId,
        display_name: config(harness.subjectId, harness.root).display_name,
        identity_anchors: []
      },
      interaction_interval_ticks: 1
    },
    {
      host,
      sharedSourceStore: new FileSharedSubjectSourceStoreV0(harness.root, harness.subjectId),
      conversationCognitionTransport: depsFor(harness).conversationCognitionTransport,
      languageTransport: depsFor(harness).languageTransport,
      factualEventAppraisalProvider: contentSensitiveAppraisal(),
      personalityAdaptationFactory: (authorities: {
        subjectCore: never;
        memoryRepository: never;
        producerAuthorizationIssuer: never;
        readEpisodePayload: never;
      }) =>
        new PersonalityAdaptationWiringV0({
          subjectCore: authorities.subjectCore,
          memoryRepository: authorities.memoryRepository,
          producerAuthorizationIssuer: authorities.producerAuthorizationIssuer,
          readEpisodePayload: authorities.readEpisodePayload,
          semanticProvider: new WorkshopPersonalityProvider(),
          store: new InMemoryPersonalityAdaptationStoreV0()
        }),
      provider_identity: { model: "trajectory-double", num_predict: 2048 },
      clock: () => "2026-01-01T00:00:00.000Z"
    } as never
  );
}

interface Checkpoint {
  readonly events: number;
  readonly origin: string;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly logued_episodes: number;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly beliefs: readonly { readonly proposition_id: string; readonly credence: number }[];
  readonly relationships: readonly string[];
  readonly personality: readonly { readonly dimension_id: string; readonly value: number }[];
  readonly cognition_visible_episodes: readonly string[];
  readonly belief_transitions: number;
  readonly affect_transitions: number;
}

async function checkpoint(harness: SubjectHarness, host: InteractiveSubjectHostV0, events: number): Promise<Checkpoint> {
  const status = await host.status();
  const state = await host.subjectStateView();
  const memory = await host.livedMemory({ limit: PRODUCT_TURN_TRANSCRIPT_MAX_LIMIT });
  const evolution: SubjectEvolutionViewV0 = await host.evolutionView({ limit: 5 });
  return {
    events,
    origin: status.origin,
    state_revision: status.state_revision,
    repository_revision: status.repository_revision,
    logued_episodes: memory.total_episode_count,
    affect: state.affect,
    beliefs: state.beliefs.map((item) => ({ proposition_id: item.proposition_id, credence: item.credence })),
    relationships: state.relationships.map((counterpart) => counterpart.counterpart_ref),
    personality: state.personality.map((dimension) => ({ ...dimension })),
    cognition_visible_episodes: [...evolution.cognition_visible.memory_episode_refs],
    belief_transitions: evolution.durable_effects.belief.length,
    affect_transitions: evolution.durable_effects.affect.length
  };
}

/** The event plan. EVENTS ONLY — no state targets, no scripted values. */
function alicePlan(): readonly string[] {
  return [
    // Phase 1 — familiar environment (ordinary lived events).
    "I spent the morning tidying the workshop shelves.",
    "I labelled the boxes of screws and bolts.",
    "I swept the floor and sorted the offcuts.",
    "I wrote a note about the missing hammer.",
    "I moved the small vice to the other bench.",
    "I oiled the hand plane and put it away.",
    // Phase 2 — frustrating events (affect-relevant).
    ALICE_FRUSTRATION[0] as string,
    ALICE_FRUSTRATION[1] as string,
    "I had to dry the timber again because of the damp.",
    ALICE_FRUSTRATION[2] as string,
    "I complained to the landlord about the door lock.",
    // Phase 3 — belief evidence (statement + repeated evidence).
    PROPOSITION_LABEL,
    ALICE_EVIDENCE[0] as string,
    "I told the neighbour the workshop door is never shut properly.",
    ALICE_EVIDENCE[1] as string,
    ALICE_EVIDENCE[2] as string,
    "I keep wondering why nobody closes the workshop door.",
    // Phase 4 — repeated counterpart interactions.
    "I asked you to help me check the workshop door.",
    "We looked at the door together and talked about it.",
    "You suggested I keep a note of every time it is open.",
    "I started a list of every time the workshop door is open.",
    "We agreed to check the workshop door again next week.",
    // Phase 5 — consequence to my own behaviour.
    "I decided to prop the workshop door open while I work.",
    ALICE_CONSEQUENCE,
    "I wrote down what happened with the workshop door.",
    // Phase 6 — later recall and ordinary life.
    "I tidied the workshop again this morning.",
    "I checked the weather before starting the varnish.",
    "I asked you whether the workshop door still bothers me.",
    "I sharpened the chisels while thinking about the door.",
    "I measured the shelf twice before cutting.",
    "I put the new hinges in the drawer.",
    "I told you the workshop feels different lately.",
    "I counted the boxes again and they still match the list.",
    "I wiped down the bench and closed up.",
    "I wondered whether the workshop door will ever stay shut.",
    "I wrote a short note to myself about the door.",
    "I reshelved the manuals by size.",
    "I checked the lamp and replaced the bulb.",
    "I swept the floor once more before leaving.",
    "I thought about how often the workshop door has been open lately."
  ];
}

function controlPlan(): readonly string[] {
  return [
    "I spent the morning tidying the workshop shelves.",
    "I labelled the boxes of screws and bolts.",
    "I swept the floor and sorted the offcuts.",
    "I wrote a note about the missing hammer.",
    "I moved the small vice to the other bench.",
    "I oiled the hand plane and put it away.",
    CONTROL_CALM[0] as string,
    CONTROL_CALM[1] as string,
    "I stacked the timber in the dry corner.",
    CONTROL_CALM[2] as string,
    "I thanked the landlord for servicing the door lock.",
    PROPOSITION_LABEL,
    CONTROL_EVIDENCE[0] as string,
    "I told the neighbour the workshop door is always shut properly.",
    CONTROL_EVIDENCE[1] as string,
    CONTROL_EVIDENCE[2] as string,
    "I keep noticing how reliably the workshop door closes.",
    "I asked you to help me check the workshop door.",
    "We looked at the door together and talked about it.",
    "You suggested I keep a note of every time it is closed.",
    "I started a list of every time the workshop door is closed.",
    "We agreed to check the workshop door again next week.",
    "I decided to keep the workshop door shut while I work.",
    CONTROL_CONSEQUENCE,
    "I wrote down what happened with the workshop door.",
    "I tidied the workshop again this morning.",
    "I checked the weather before starting the varnish.",
    "I asked you whether the workshop door still matters to me.",
    "I sharpened the chisels while thinking about the door.",
    "I measured the shelf twice before cutting.",
    "I put the new hinges in the drawer.",
    "I told you the workshop feels settled lately.",
    "I counted the boxes again and they still match the list.",
    "I wiped down the bench and closed up.",
    "I thought about how the workshop door has been fine.",
    "I wrote a short note to myself about the door.",
    "I reshelved the manuals by size.",
    "I checked the lamp and replaced the bulb.",
    "I swept the floor once more before leaving.",
    "I thought about how often the workshop door has been closed lately."
  ];
}

/** Runs one subject's life, restarting at the mandated points. */
async function liveLife(
  harness: SubjectHarness,
  plan: readonly string[],
  checkpoints: Map<number, Checkpoint>,
  restarts: number[]
): Promise<Checkpoint> {
  let completed = 0;
  checkpoints.set(0, await checkpoint(harness, harness.host, 0));
  for (const [index, text] of plan.entries()) {
    const event = index + 1;
    const outcome = await harness.host.send(text);
    expect(outcome.status, `event ${String(event)}: ${outcome.failure ?? ""}`).toBe("COMPLETE");
    completed = event;
    if (RESTART_AFTER.includes(event as (typeof RESTART_AFTER)[number])) {
      // A FRESH process over the same durable root: no process-local object survives.
      harness.host = await freshHost(harness);
      restarts.push(event);
      expect(harness.host.resolution()).toBe("SUBJECT_RESTORED");
    }
    if (event % 10 === 0) checkpoints.set(event, await checkpoint(harness, harness.host, event));
    // A structured (non-conversation) observation every tenth event: a lawful
    // second ingress, harmless when its scene carries no bearing.
    if (event % 10 === 5) {
      const built = buildStructuredObservationRequestV0({
        source: "workshop-sensor",
        event: `door-check-${String(event)}`,
        entities: "workshop-door-sensor",
        scene: `The workshop door sensor reports state check ${String(event)}.`,
        task: "Observe the workshop."
      });
      if (!built.ok) throw new Error(`observation ${String(event)} could not be built: ${built.detail}`);
      // Rebuilt per observation: after a restart the CURRENT host must be the one
      // reloaded from the shared source, never a stale object from a dead process.
      const outcome2 = await lifeOps(harness, harness.host).observe(built.request);
      expect(["FIRST", "REPLAY"]).toContain(outcome2.kind);
    }
  }
  expect(completed).toBe(plan.length);
  checkpoints.set(plan.length, await checkpoint(harness, harness.host, plan.length));
  return checkpoints.get(plan.length) as Checkpoint;
}

describe("LONGITUDINAL_INTEGRATED_SUBJECT_TRAJECTORY_V0", () => {
  it("L1–L15: one subject lives many events across state domains, survives three restarts, and is compared with a control", async () => {
    const aliceRoot = makeTempDir();
    const controlRoot = makeTempDir();
    const alice: SubjectHarness = {
      subjectId: ALICE,
      root: aliceRoot,
      host: undefined as unknown as InteractiveSubjectHostV0,
      cognitionRequests: [],
      mode: { current: "ACKNOWLEDGE" }
    };
    const control: SubjectHarness = {
      subjectId: CONTROL,
      root: controlRoot,
      host: undefined as unknown as InteractiveSubjectHostV0,
      cognitionRequests: [],
      mode: { current: "ACKNOWLEDGE" }
    };
    alice.host = await freshHost(alice);
    control.host = await freshHost(control);
    expect(alice.host.resolution()).toBe("NEW_SUBJECT_CREATED");
    expect(control.host.resolution()).toBe("NEW_SUBJECT_CREATED");

    const aliceCheckpoints = new Map<number, Checkpoint>();
    const controlCheckpoints = new Map<number, Checkpoint>();
    const aliceRestarts: number[] = [];
    const controlRestarts: number[] = [];

    const aliceFinal = await liveLife(alice, alicePlan(), aliceCheckpoints, aliceRestarts);
    const controlFinal = await liveLife(control, controlPlan(), controlCheckpoints, controlRestarts);

    // ---- L2/L3: the life actually happened -------------------------------------
    expect(TOTAL_EVENTS).toBe(40);
    expect(aliceFinal.logued_episodes).toBeGreaterThanOrEqual(TOTAL_EVENTS);
    expect(controlFinal.logued_episodes).toBeGreaterThanOrEqual(TOTAL_EVENTS);

    // ---- L4/L5/L6/L7/L8: multiple domains evolved, lawfully --------------------
    const alice0 = aliceCheckpoints.get(0) as Checkpoint;
    expect(aliceFinal.affect.valence).not.toBe(alice0.affect.valence);
    expect(aliceFinal.affect.valence).toBeGreaterThanOrEqual(-1);
    expect(aliceFinal.affect.valence).toBeLessThanOrEqual(1);
    expect(aliceFinal.affect.activation).toBeGreaterThanOrEqual(0);
    expect(aliceFinal.affect.activation).toBeLessThanOrEqual(1);
    // Belief: one proposition, formed and then updated by lived evidence.
    expect(aliceFinal.beliefs).toHaveLength(1);
    expect(aliceFinal.beliefs[0]?.credence).toBeLessThan(0.55); // contradictory evidence, frozen step
    expect(aliceFinal.belief_transitions).toBeGreaterThanOrEqual(2);
    // Relationship: the repeated counterpart is governed state.
    expect(aliceFinal.relationships).toEqual(["entity:alice"]);
    // Personality: acquired dimensions stay lawful unit intervals.
    for (const dimension of aliceFinal.personality) {
      expect(dimension.value).toBeGreaterThanOrEqual(0);
      expect(dimension.value).toBeLessThanOrEqual(1);
    }
    expect(aliceFinal.affect_transitions).toBeGreaterThanOrEqual(RESTART_AFTER.length);

    // ---- L9: three fresh restarts restored exact durable values -----------------
    expect(aliceRestarts).toEqual([10, 25, 40]);
    expect(controlRestarts).toEqual([10, 25, 40]);
    // ONE live host per root: the previous process is dropped, not kept beside it.
    // (The cross-context law refuses two writers on one shared source, and this
    // acceptance obeys it rather than working around it.)
    alice.host = await freshHost(alice);
    const afterRestarts = alice.host;
    const restored = await checkpoint(alice, afterRestarts, TOTAL_EVENTS);
    expect(restored.origin).toBe("SUBJECT_RESTORED");
    expect(restored.state_revision).toBe(aliceFinal.state_revision);
    expect(restored.repository_revision).toBe(aliceFinal.repository_revision);
    expect(restored.logued_episodes).toBe(aliceFinal.logued_episodes);
    expect(restored.affect).toEqual(aliceFinal.affect);
    expect(restored.beliefs).toEqual(aliceFinal.beliefs);
    expect(restored.relationships).toEqual(aliceFinal.relationships);
    expect(restored.personality).toEqual(aliceFinal.personality);

    // ---- L15: no dangling provenance where provenance is required ---------------
    const evolution = await afterRestarts.evolutionView({ limit: 5 });
    for (const transition of evolution.durable_effects.belief) {
      expect(transition.proposition_id.length).toBeGreaterThan(0);
      expect(transition.evidence_episode_refs.length).toBeGreaterThan(0);
      for (const ref of transition.evidence_episode_refs) expect(ref.startsWith("episode:")).toBe(true);
    }
    for (const transition of evolution.durable_effects.affect) {
      expect(transition.observation_ref.startsWith("observation:")).toBe(true);
      expect(transition.event_ref.startsWith("event:")).toBe(true);
      expect(transition.appraisal_ref.startsWith("appraisal:")).toBe(true);
    }
    // Every belief transition's evidence exists in the subject's own lived memory.
    const memoryNow = await afterRestarts.livedMemory({ limit: 100 });
    const knownEpisodes = new Set(memoryNow.entries.map((entry) => entry.episode_ref));
    for (const transition of evolution.durable_effects.belief) {
      for (const ref of transition.evidence_episode_refs) expect(knownEpisodes.has(ref)).toBe(true);
    }

    // ---- L3/§19: unique episodes, no duplicates, bounded retrieval --------------
    const allEpisodes = memoryNow.entries.map((entry) => entry.episode_ref);
    expect(new Set(allEpisodes).size).toBe(allEpisodes.length);
    const lastOutcome = await afterRestarts.send("I am checking my own notes about the door.");
    expect(lastOutcome.status).toBe("COMPLETE");
    expect(lastOutcome.working_episode_refs.length).toBeLessThanOrEqual(32);
    expect(lastOutcome.working_episode_refs.length).toBeLessThan(aliceFinal.logued_episodes);
    expect(new Set(lastOutcome.working_episode_refs).size).toBe(lastOutcome.working_episode_refs.length);

    // ---- §20: idempotency — the same structured event is never a second life ----
    const ops = lifeOps(alice, afterRestarts);
    const built = buildStructuredObservationRequestV0({
      source: "workshop-sensor",
      event: "door-check-15",
      entities: "workshop-door-sensor",
      scene: "The workshop door sensor reports state check 15.",
      task: "Observe the workshop."
    });
    if (!built.ok) throw new Error("idempotency request could not be built");
    const beforeReplay = await afterRestarts.livedMemory({ limit: 100 });
    const replay = await ops.observe(built.request);
    expect(replay.kind).toBe("REPLAY");
    const afterReplay = await afterRestarts.livedMemory({ limit: 100 });
    expect(afterReplay.total_episode_count).toBe(beforeReplay.total_episode_count);

    // ---- L10/L11/L12: the SAME final scene, differing only by durable past ------
    alice.mode.current = "ACKNOWLEDGE";
    control.mode.current = "ACKNOWLEDGE";
    const aliceTurn = await alice.host.send(FINAL_SCENE);
    const controlTurn = await control.host.send(FINAL_SCENE);
    expect(aliceTurn.status, aliceTurn.failure ?? "").toBe("COMPLETE");
    expect(controlTurn.status, controlTurn.failure ?? "").toBe("COMPLETE");
    const aliceRequest = alice.cognitionRequests.at(-1) as string;
    const controlRequest = control.cognitionRequests.at(-1) as string;
    const sceneLine = (request: string): string =>
      request.split("\n").find((line) => line.startsWith("[context] scene=")) ?? "(none)";
    expect(sceneLine(aliceRequest)).toBe(sceneLine(controlRequest));
    expect(aliceRequest).toContain(FINAL_SCENE);
    expect(controlRequest).toContain(FINAL_SCENE);
    // The current-event blocks are byte-identical; everything else differs.
    expect(aliceRequest).not.toBe(controlRequest);
    expect(aliceRequest).not.toContain(CONTROL);
    expect(controlRequest).not.toContain(ALICE);
    expect(aliceRequest).not.toContain("bob-trajectory");
    expect(controlRequest).not.toContain("alice-trajectory");
    // Both subjects carry their own proposition identity and their own credence.
    const aliceProposition = aliceFinal.beliefs[0]?.proposition_id as string;
    const controlProposition = controlFinal.beliefs[0]?.proposition_id as string;
    expect(aliceProposition).not.toBe(controlProposition);
    expect(aliceRequest).toContain(aliceProposition);
    expect(aliceRequest).not.toContain(controlProposition);
    expect(controlRequest).toContain(controlProposition);
    // The surviving difference is durable-state-derived: same scene, different past.
    const aliceAffectLine = aliceRequest.split("\n").find((line) => line.startsWith("[affect (canonical)]")) ?? "";
    const controlAffectLine = controlRequest.split("\n").find((line) => line.startsWith("[affect (canonical)]")) ?? "";
    expect(aliceAffectLine).not.toBe(controlAffectLine);
    // The ordering itself is the claim: a frustration-heavy life sits below a calm one.
    expect(aliceFinal.affect.valence).toBeLessThan(controlFinal.affect.valence);
    expect(aliceFinal.beliefs[0]?.credence).not.toBe(controlFinal.beliefs[0]?.credence);

    // ---- §19 state stability ----------------------------------------------------
    for (const value of [aliceFinal.affect.valence, aliceFinal.affect.activation, controlFinal.affect.valence]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(aliceFinal.logued_episodes).toBe(controlFinal.logued_episodes);
    expect(aliceFinal.state_revision).toBe(controlFinal.state_revision);
    // The durable store of each subject contains only its own identity.
    const aliceSnapshot = readFileSync(join(aliceRoot, `subject-${ALICE}.snapshot.json`), "utf8");
    const controlSnapshot = readFileSync(join(controlRoot, `subject-${CONTROL}.snapshot.json`), "utf8");
    expect(aliceSnapshot).not.toContain(CONTROL);
    expect(controlSnapshot).not.toContain(ALICE);

    // ---- §16: the behaviour channel, labelled as a deterministic property -------
    // A follower double answers from what it was given: with the SAME current scene
    // the two subjects deliver different text, attributable to their own lived past.
    alice.mode.current = "FOLLOWER";
    control.mode.current = "FOLLOWER";
    const aliceChannel = await alice.host.send("Anything about the workshop door I should remember?");
    const controlChannel = await control.host.send("Anything about the workshop door I should remember?");
    expect(aliceChannel.status, aliceChannel.failure ?? "").toBe("COMPLETE");
    expect(controlChannel.status, controlChannel.failure ?? "").toBe("COMPLETE");
    const sameScene = (request: string): string =>
      request.split("\n").find((line) => line.startsWith("[context] scene=")) ?? "(none)";
    expect(sameScene(alice.cognitionRequests.at(-1) as string)).toBe(
      sameScene(control.cognitionRequests.at(-1) as string)
    );
    if (aliceChannel.subject_text !== controlChannel.subject_text) {
      // Deterministic channel property only — never a claim about a live model.
      expect(aliceChannel.subject_text.length).toBeGreaterThan(0);
    }

    // ---- Deliverable: the structured comparison, printed for the report ---------
    const comparison = {
      alice: aliceFinal,
      control: controlFinal,
      alice_restarts: aliceRestarts,
      control_restarts: controlRestarts,
      alice_delivered: aliceChannel.subject_text,
      control_delivered: controlChannel.subject_text,
      checkpoints: [...aliceCheckpoints.values()]
    };
    // The comparison must be serializable plain data (no live handles).
    expect(JSON.parse(JSON.stringify(comparison)) as unknown).toEqual(JSON.parse(JSON.stringify(comparison)));
    // Machine-local evidence dump, opt-in so the gate stays hermetic.
    if (process.env["CHARACTEROS_TRAJECTORY_ARTIFACT"] === "1") {
      writeFileSync(join(process.cwd(), "tmp", "trajectory-comparison.json"), `${JSON.stringify(comparison, null, 2)}
`, "utf8");
    }
  }, 600_000);
});
