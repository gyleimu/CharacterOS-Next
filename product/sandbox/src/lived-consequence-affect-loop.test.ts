/**
 * CLOSED_LOOP_LIVED_INTERACTION_V0 — product acceptance for the north-star back half:
 *
 *   past experience → governed durable state → current cognition → observable
 *   behavior → CONSEQUENCE / new experience → internal state update → later
 *   cognition → restart still holds it.
 *
 * Recon result behind this file (see the slice report): the product ALREADY wires
 * every hop — a counterpart reply to a delivered behavior is admitted through the
 * real path (ingress → observation → appraisal → canonical commit), closes the
 * delivered behavior as a durable BEHAVIOR_OUTCOME record, and the content-driven
 * Appraisal moves canonical Affect. What did not exist is a product-level
 * acceptance that proves the loop for a CONSEQUENCE to the subject's OWN behavior,
 * with attribution to exact durable refs and a CONTROL subject. That is the one
 * missing link this slice closes. NO production code was changed.
 *
 * SELECTED STATE CHANNEL: **Affect** (canonical affect committed by the
 * consequence event). Memory/lived experience is asserted too, as the durable
 * EVENT side of the same loop — its closed loop was already proven elsewhere.
 *
 * NO FORCING: the main test's T3 uses a FIXED acknowledgement double, so the two
 * subjects deliver the SAME reply; the difference that must be shown is in the
 * durable state and in the cognition INPUT. The delivered-behavior channel is
 * exercised separately, in a second test whose double ANSWERS FROM WHAT IT WAS
 * GIVEN — labelled there as a deterministic integration property, never as
 * evidence about a model.
 *
 * NO DIRECT STATE MUTATION: the harness only calls `host.send(...)` and reads
 * files. It never sets affect, memory, belief or relationship directly.
 *
 * 0 model calls, 0 network calls.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  FactualEventAppraisalProviderV0,
  InteractiveTurnOutcomeV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0
} from "./interactive-subject-host.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const SUBJECT_A = "alice-consequence";
const SUBJECT_B = "bob-control";

const HISTORY_FACT = "I keep a red notebook on the desk.";
const MEMORY_SCENE = "Where do I keep my notebook?";
/** The consequence: same shape, opposite content. A is contradicted, B is confirmed. */
const CONSEQUENCE_A = "I checked the desk just now - the notebook is not there.";
const CONSEQUENCE_B = "I checked the desk again and the notebook is still there.";
/** The identical later scene both restored subjects face. */
const LATER_SCENE = "What do you know about my notebook?";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-loop-"));
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
/* deterministic doubles — content-keyed, no model                             */
/* -------------------------------------------------------------------------- */

/**
 * Content-SENSITIVE appraisal: the consequence's content decides how the event
 * appraises, so canonical Affect is driven by what actually happened. All other
 * scenes appraise neutrally-positive. Unit-interval dimensions only (the host
 * rejects anything else).
 */
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
      const contradicted = /not there|no notebook|missing/i.test(scene);
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.9,
          // Low goal-congruence = the event does not fit what the subject wanted.
          goal_congruence: contradicted ? 0.02 : 0.85,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.1,
          intensity: 0.9
        },
        assessment_confidence: 0.9,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

/* -------------------------------------------------------------------------- */
/* request parsing (exact, from the rendered prompt)                           */
/* -------------------------------------------------------------------------- */

function requestsOf(recorder: string[]): readonly string[] {
  return recorder;
}

/** The balanced JSON object starting at the first `{` at or after `from`. */
function jsonObjectAt(text: string, from: number): string | null {
  const start = text.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index] as string;
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
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

/** The exact JSON string literal starting at `index` (a leading double quote). */
function jsonStringAt(text: string, index: number): string | null {
  let scan = index;
  for (;;) {
    scan = text.indexOf('"', scan + 1);
    if (scan < 0) return null;
    let backslashes = 0;
    let probe = scan - 1;
    while (probe >= index && text[probe] === "\\") {
      backslashes += 1;
      probe -= 1;
    }
    if (backslashes % 2 === 0) break;
  }
  try {
    return JSON.parse(text.slice(index, scan + 1)) as string;
  } catch {
    return null;
  }
}

/** The `[context] scene=...` line — the current scene every turn faces. */
function sceneOf(request: string): string {
  const line = request.split("\n").find((entry) => entry.startsWith("[context] scene=")) ?? "";
  const at = line.indexOf("scene=") + "scene=".length;
  if (at <= 0 || line[at] !== '"') return "(no scene)";
  const parsed = jsonStringAt(line, at);
  return parsed ?? "(unparsable scene)";
}

/** The canonical affect line the cognition request actually carries. */
function affectLine(request: string): string {
  return request.split("\n").find((entry) => entry.startsWith("[affect (canonical)]")) ?? "(none)";
}

function affectValence(request: string): number {
  const match = /valence=(-?[0-9.eE+-]+)/.exec(affectLine(request));
  return match === null ? Number.NaN : Number(match[1]);
}

/** The host-advertised factual handle for a canonical ref, from the same request. */
function handleForRef(request: string, ref: string): string | null {
  const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`- (F\\d+): ${escaped}`).exec(request);
  return match === null ? null : (match[1] as string);
}

/** The newest BEHAVIOR_OUTCOME record in the prompt: delivered behavior + reply. */
function latestOutcomeEvidence(
  request: string
): { readonly delivered: string; readonly outcome: string; readonly episode_ref: string } | null {
  const start = request.indexOf("[BEGIN HISTORICAL FACTUAL CONTENT");
  if (start < 0) return null;
  const end = request.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
  const block = request.slice(start, end < 0 ? request.length : end);
  const marker = "- A delivered behavior was followed by this actor's exact reply:";
  const at = block.lastIndexOf(marker);
  if (at < 0) return null;
  const record = block.slice(at);
  const valueOf = (key: string): string | null => {
    const keyAt = record.indexOf(`${key}: `);
    if (keyAt < 0) return null;
    const quoteAt = record.indexOf('"', keyAt + key.length);
    if (quoteAt < 0) return null;
    return jsonStringAt(record, quoteAt);
  };
  const delivered = valueOf("delivered_behavior_text");
  const outcome = valueOf("outcome_reply_text");
  const episode = valueOf("episode_ref");
  if (delivered === null || outcome === null || episode === null) return null;
  return { delivered, outcome, episode_ref: episode };
}

/* -------------------------------------------------------------------------- */
/* cognition / language doubles                                                */
/* -------------------------------------------------------------------------- */

/**
 * CONTEXT FOLLOWER: when the prompt carries a delivered-behavior outcome, it
 * cites that exact outcome sentence as a host-authorizable SOURCE_QUOTE and lets
 * Language carry it. It answers FROM WHAT IT WAS GIVEN and authors nothing.
 */
function contextFollowerCognition(requests: string[]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
      const evidence = latestOutcomeEvidence(user);
      if (evidence === null) {
        return {
          content: JSON.stringify({
            response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
            schema_version: "conversation-cognition-proposal-v8",
            subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
            factual_assessment: { claims: [] },
            cognition: {
              schema_version: "cognition-proposal-v0",
              reasoning_summary: "nothing lived yet",
              relevant_memory_handles: [],
              considered_handles: [],
              current_intent: "acknowledge",
              confidence: 0.6,
              uncertainty: 0.4,
              action_intent: null,
              evidence_handles: []
            },
            communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
            clarification_basis: null
          }),
          model: "context-follower"
        };
      }
      const handle = handleForRef(user, evidence.episode_ref);
      if (handle === null) throw new Error(`no advertised factual handle for ${evidence.episode_ref}`);
      return {
        content: JSON.stringify({
          response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GENERATIVE" },
          schema_version: "conversation-cognition-proposal-v8",
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
          factual_assessment: {
            claims: [{ kind: "SOURCE_QUOTE", text: evidence.outcome, source_handles: [handle] }]
          },
          cognition: {
            schema_version: "cognition-proposal-v0",
            reasoning_summary: "answer from what happened last time",
            relevant_memory_handles: [handle],
            considered_handles: [handle],
            current_intent: `answer with what happened: ${evidence.outcome}`,
            confidence: 0.8,
            uncertainty: 0.2,
            action_intent: null,
            evidence_handles: [handle]
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
          clarification_basis: null
        }),
        model: "context-follower"
      };
    }
  };
}

/**
 * FIXED acknowledgement double: for the main test, so the delivered reply can NOT
 * differ and any difference must be shown in durable state and cognition input.
 */
function fixedAcknowledgementCognition(requests: string[]): ModelTransportV0 {
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
            reasoning_summary: "fixed acknowledgement",
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
        model: "fixed-acknowledgement"
      };
    }
  };
}

/** Contract-faithful language double: renders the authorized claim, authors nothing. */
function claimRenderingLanguage(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const object = jsonObjectAt(user, 0);
      const parsed =
        object === null
          ? null
          : (JSON.parse(object) as {
              factual_assessment?: { claims?: { text?: string }[] };
              realization_plan?: { primary?: { kind?: string; act?: string } };
            });
      const claim = parsed?.factual_assessment?.claims?.[0]?.text;
      const primary = parsed?.realization_plan?.primary;
      let text = "Understood, noted.";
      if (primary?.kind === "PRIMARY_FACT" && claim !== undefined) text = claim;
      else if (primary?.kind === "PRIMARY_CONVERSATIONAL_ACT" && primary.act === "GENERATIVE" && claim !== undefined) {
        text = `I remember: "${claim}"`;
      }
      return {
        content: JSON.stringify({
          schema_version: "language-realization-semantic-draft-v1",
          text,
          evidence_refs: []
        }),
        model: "claim-renderer"
      };
    }
  };
}

/* -------------------------------------------------------------------------- */
/* harness                                                                     */
/* -------------------------------------------------------------------------- */

interface Recorder {
  readonly cognition: string[];
}

function deps(
  root: string,
  subjectId: string,
  recorder: Recorder,
  cognition: ModelTransportV0
): Parameters<typeof InteractiveSubjectHostV0.open>[1] {
  return {
    conversationCognitionTransport: cognition,
    languageTransport: claimRenderingLanguage(),
    appraisalProvider: contentSensitiveAppraisal(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
    provider_identity: { model: "deterministic", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
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

/** ONE fresh process: open the subject from its durable artifacts, send one message. */
async function turn(
  root: string,
  subjectId: string,
  recorder: Recorder,
  cognition: ModelTransportV0,
  text: string
): Promise<{ readonly resolution: string; readonly outcome: InteractiveTurnOutcomeV0 }> {
  const host = await InteractiveSubjectHostV0.open(config(root, subjectId), deps(root, subjectId, recorder, cognition));
  const resolution = host.resolution();
  const outcome = await host.send(text);
  return { resolution, outcome };
}

/**
 * The DURABLE holder of the canonical subject state (cross-context authority):
 * `subject-<id>.shared-subject.json`. The committed affect value is asserted to be
 * present in those persisted bytes, so the change is proven to be durable state
 * and not merely a value the runtime kept in memory.
 */
function durableSharedSubjectBytes(root: string, subjectId: string): string {
  return readFileSync(join(root, `subject-${subjectId}.shared-subject.json`), "utf8");
}

describe("CLOSED_LOOP_LIVED_INTERACTION_V0 — a consequence to the subject's own behavior", () => {
  it("C1–C8: consequence → durable lived state (affect + outcome record) → restart → later cognition, with a control subject", async () => {
    const rootA = makeTempDir();
    const rootB = makeTempDir();
    const recA: Recorder = { cognition: [] };
    const recB: Recorder = { cognition: [] };

    // ---- shared initial history: one lived fact each (same content) ----------
    const seedA = await turn(rootA, SUBJECT_A, recA, fixedAcknowledgementCognition(recA.cognition), HISTORY_FACT);
    const seedB = await turn(rootB, SUBJECT_B, recB, fixedAcknowledgementCognition(recB.cognition), HISTORY_FACT);
    expect(seedA.outcome.status, seedA.outcome.failure ?? "").toBe("COMPLETE");
    expect(seedB.outcome.status, seedB.outcome.failure ?? "").toBe("COMPLETE");
    const factEpisodeA = seedA.outcome.observational_experience_ref as string;
    const factEpisodeB = seedB.outcome.observational_experience_ref as string;
    expect(factEpisodeA).toMatch(/^episode:/);
    expect(factEpisodeB).toMatch(/^episode:/);

    // ---- TURN 1: the subject acts from its own memory, same scene for both ---
    const t1RecA: Recorder = { cognition: [] };
    const t1RecB: Recorder = { cognition: [] };
    const t1A = await turn(rootA, SUBJECT_A, t1RecA, contextFollowerCognition(t1RecA.cognition), MEMORY_SCENE);
    const t1B = await turn(rootB, SUBJECT_B, t1RecB, contextFollowerCognition(t1RecB.cognition), MEMORY_SCENE);
    expect(t1A.outcome.status, t1A.outcome.failure ?? "").toBe("COMPLETE");
    expect(t1B.outcome.status, t1B.outcome.failure ?? "").toBe("COMPLETE");
    // The behavior was produced from READ durable history, not from the scene.
    expect(t1RecA.cognition[0]).toContain("[BEGIN HISTORICAL FACTUAL CONTENT");
    expect(sceneOf(t1RecA.cognition[0] as string)).toBe(sceneOf(t1RecB.cognition[0] as string));
    const behaviorA = t1A.outcome.subject_text as string;
    expect(t1B.outcome.subject_text.length).toBeGreaterThan(0);
    expect(t1A.outcome.delivery_id).not.toBeNull();
    expect(t1B.outcome.delivery_id).not.toBeNull();

    // ---- C1: the CONSEQUENCE is admitted through the real path ---------------
    const t2RecA: Recorder = { cognition: [] };
    const t2RecB: Recorder = { cognition: [] };
    const t2A = await turn(rootA, SUBJECT_A, t2RecA, fixedAcknowledgementCognition(t2RecA.cognition), CONSEQUENCE_A);
    const t2B = await turn(rootB, SUBJECT_B, t2RecB, fixedAcknowledgementCognition(t2RecB.cognition), CONSEQUENCE_B);
    expect(t2A.outcome.status, t2A.outcome.failure ?? "").toBe("COMPLETE");
    expect(t2B.outcome.status, t2B.outcome.failure ?? "").toBe("COMPLETE");
    // The consequence closed the delivered behavior into a durable outcome record.
    expect(t2A.outcome.completed_prior_outcome, "A's delivered behavior must close durably").not.toBeNull();
    expect(t2B.outcome.completed_prior_outcome).not.toBeNull();
    const outcomeEpisodeA = t2A.outcome.completed_prior_outcome?.episode_ref as string;
    const outcomeEpisodeB = t2B.outcome.completed_prior_outcome?.episode_ref as string;
    expect(outcomeEpisodeA).not.toBe(behaviorA);
    expect(outcomeEpisodeA).not.toBe(outcomeEpisodeB);
    // C2 + selected channel AFFECT: the consequence content moved canonical affect,
    // and it moved the two subjects DIFFERENTLY (contradiction vs confirmation).
    expect(t2A.outcome.affect_after).not.toBe(t2A.outcome.affect_before);
    expect(t2B.outcome.affect_after).not.toBe(t2B.outcome.affect_before);
    expect(t2A.outcome.affect_after, "a contradiction must land below a confirmation").toBeLessThan(
      t2B.outcome.affect_after
    );

    // ---- C3: the change is DURABLE (it is in the persisted subject state) ----
    // The canonical affect committed by the consequence is present in the persisted
    // shared subject source, and it is the value a restored process reads back.
    const durableA = durableSharedSubjectBytes(rootA, SUBJECT_A);
    const durableB = durableSharedSubjectBytes(rootB, SUBJECT_B);
    expect(durableA, "A's consequence affect must be in the durable subject state").toContain(
      String(t2A.outcome.affect_after)
    );
    expect(durableB).toContain(String(t2B.outcome.affect_after));

    // ---- restart: a fresh process restores the SAME lineage -------------------
    const t3RecA: Recorder = { cognition: [] };
    const t3RecB: Recorder = { cognition: [] };
    const t3A = await turn(rootA, SUBJECT_A, t3RecA, fixedAcknowledgementCognition(t3RecA.cognition), LATER_SCENE);
    const t3B = await turn(rootB, SUBJECT_B, t3RecB, fixedAcknowledgementCognition(t3RecB.cognition), LATER_SCENE);
    expect(t3A.resolution).toBe("SUBJECT_RESTORED");
    expect(t3B.resolution).toBe("SUBJECT_RESTORED");
    expect(t3A.outcome.status, t3A.outcome.failure ?? "").toBe("COMPLETE");
    expect(t3B.outcome.status, t3B.outcome.failure ?? "").toBe("COMPLETE");
    expect(t3A.outcome.affect_before, "restored affect is the consequence's affect").toBeCloseTo(
      t2A.outcome.affect_after,
      12
    );
    expect(t3B.outcome.affect_before).toBeCloseTo(t2B.outcome.affect_after, 12);

    // ---- C4 + C7: same current scene, different durable-derived cognition input
    const aRequest = t3RecA.cognition[0] as string;
    const bRequest = t3RecB.cognition[0] as string;
    expect(sceneOf(aRequest), "C7: the current scene is identical for both subjects").toBe(
      `The user says: "${LATER_SCENE}"`
    );
    expect(sceneOf(bRequest)).toBe(sceneOf(aRequest));
    // The scene lines are byte-identical: nothing in the CURRENT event differs, so
    // every remaining difference below is durable-state-derived.
    expect(aRequest.split("\n").find((line) => line.startsWith("[context] scene="))).toBe(
      bRequest.split("\n").find((line) => line.startsWith("[context] scene="))
    );
    expect(aRequest).not.toBe(bRequest);
    // The durable causal sources: each subject's OWN outcome record and its OWN affect.
    const aOutcome = latestOutcomeEvidence(aRequest);
    const bOutcome = latestOutcomeEvidence(bRequest);
    expect(aOutcome, "A's cognition input must carry A's lived outcome").not.toBeNull();
    expect(bOutcome).not.toBeNull();
    expect(aOutcome?.episode_ref).toBe(outcomeEpisodeA);
    expect(bOutcome?.episode_ref).toBe(outcomeEpisodeB);
    expect(aOutcome?.outcome).toBe(CONSEQUENCE_A);
    expect(bOutcome?.outcome).toBe(CONSEQUENCE_B);
    expect(aOutcome?.delivered).toBe(behaviorA);
    // The request's canonital-affect line is the durable affect PLUS whatever this
    // turn's own event appraisal contributed (the same scene for both subjects), so
    // the two lines must differ and keep the durable ordering.
    expect(affectValence(aRequest)).not.toBe(affectValence(bRequest));
    expect(affectValence(aRequest)).toBeLessThan(affectValence(bRequest));

    // ---- C5 + C6: the control subject does NOT receive A's consequence, and
    //               nothing crosses between the two life lineages.
    expect(aRequest).not.toContain(CONSEQUENCE_B);
    expect(bRequest).not.toContain(CONSEQUENCE_A);
    expect(aRequest).not.toContain(SUBJECT_B);
    expect(bRequest).not.toContain(SUBJECT_A);
    expect(aRequest).not.toContain(outcomeEpisodeB);
    expect(bRequest).not.toContain(outcomeEpisodeA);
    expect(aRequest).not.toContain(factEpisodeB);
    expect(bRequest).not.toContain(factEpisodeA);
    expect(aRequest).toContain(factEpisodeA);
    expect(bRequest).toContain(factEpisodeB);

    // ---- no forcing: with a FIXED double the delivered reply is IDENTICAL -----
    expect(t3A.outcome.subject_text).toBe(t3B.outcome.subject_text);
  }, 120_000);
});

describe("CLOSED_LOOP_LIVED_INTERACTION_V0 — the behavior channel can carry the consequence", () => {
  it("deterministic integration property: a follower answers from the lived outcome, so replies differ", async () => {
    // THIS IS A DETERMINISTIC DOUBLE, NOT EVIDENCE ABOUT ANY MODEL. It exists to
    // show that the delivered-behavior CHANNEL is open to the consequence; whether
    // a real model uses it is a separate measurement.
    const rootA = makeTempDir();
    const rootB = makeTempDir();
    const seedA = await turn(rootA, SUBJECT_A, { cognition: [] }, fixedAcknowledgementCognition([]), HISTORY_FACT);
    const seedB = await turn(rootB, SUBJECT_B, { cognition: [] }, fixedAcknowledgementCognition([]), HISTORY_FACT);
    expect(seedA.outcome.status).toBe("COMPLETE");
    expect(seedB.outcome.status).toBe("COMPLETE");
    await turn(rootA, SUBJECT_A, { cognition: [] }, contextFollowerCognition([]), MEMORY_SCENE);
    await turn(rootB, SUBJECT_B, { cognition: [] }, contextFollowerCognition([]), MEMORY_SCENE);
    const consequenceA = await turn(rootA, SUBJECT_A, { cognition: [] }, fixedAcknowledgementCognition([]), CONSEQUENCE_A);
    const consequenceB = await turn(rootB, SUBJECT_B, { cognition: [] }, fixedAcknowledgementCognition([]), CONSEQUENCE_B);
    expect(consequenceA.outcome.status, consequenceA.outcome.failure ?? "").toBe("COMPLETE");
    expect(consequenceB.outcome.status, consequenceB.outcome.failure ?? "").toBe("COMPLETE");

    // Fresh process, identical scene, follower answers from the lived outcome.
    const recA: Recorder = { cognition: [] };
    const recB: Recorder = { cognition: [] };
    const laterA = await turn(rootA, SUBJECT_A, recA, contextFollowerCognition(recA.cognition), LATER_SCENE);
    const laterB = await turn(rootB, SUBJECT_B, recB, contextFollowerCognition(recB.cognition), LATER_SCENE);
    expect(laterA.outcome.status, laterA.outcome.failure ?? "").toBe("COMPLETE");
    expect(laterB.outcome.status, laterB.outcome.failure ?? "").toBe("COMPLETE");
    expect(laterA.outcome.subject_text).toContain(CONSEQUENCE_A);
    expect(laterB.outcome.subject_text).toContain(CONSEQUENCE_B);
    expect(laterA.outcome.subject_text).not.toBe(laterB.outcome.subject_text);
    // The earlier behavior (T1) is durably paired with its consequence.
    expect(laterA.outcome.provider_memory_section_present).toBe(true);
    expect(requestsOf(recA.cognition)[0]).toContain(consequenceA.outcome.completed_prior_outcome?.episode_ref as string);
  }, 120_000);
});
