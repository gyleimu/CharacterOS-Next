/**
 * PERSISTENT_SUBJECT_LONGITUDINAL_HISTORY_AB_RESTART_V0 — product acceptance.
 *
 * CONCLUSION SCOPE: `PRODUCT_LONGITUDINAL_INTEGRATION_CHAIN_PROVEN` — the
 * DETERMINISTIC INTEGRATION CAUSAL PLUMBING of the chain below. It is NOT a
 * claim that a real LLM's cognition causally produces history-dependent
 * behavior; that requires a real-executor behavior measurement and is recorded
 * separately (and was NOT proven: see the real smoke's delivered-text result).
 *
 * THE CHAIN, closed end to end at the PRODUCT level for two subjects:
 *   past experience → governed durable state → current cognition context →
 *   observable behavior → subsequent state update → restart → history-dependent
 *   difference.
 *
 * WHAT IS DETERMINISTIC AND WHAT IS NOT (stated, never blurred):
 *   - The transports here are deterministic doubles, NOT model behaviour. The
 *     cognition double is a CONTEXT FOLLOWER: on a GENERATIVE turn it cites, as an
 *     exact SOURCE_QUOTE with the advertised factual handle, the remembered
 *     sentence the host placed in the prompt. The language double is
 *     CONTRACT-FAITHFUL under AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0: it renders
 *     that exact authorized claim (wrapped, never paraphrased) for GENERATIVE and a
 *     non-factual surface otherwise, authoring nothing itself. So the reply
 *     differences below prove the CHANNEL is open and history-dependent — they do
 *     NOT prove that any real model uses its memory. That measurement is separate
 *     (real-language smoke).
 *   - Everything else is real production machinery: the same product host, the
 *     same session authority, the same V8 cognition contract and factual
 *     authorization, the same promotion of cited claims into delivered behavior,
 *     the same durable commit/restore and retrieval paths the CLI uses.
 *
 * 0 real model calls, 0 network calls.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "@characteros-next/runtime";
import {
  InteractiveSubjectHostV0,
  type InteractiveSubjectHostConfigV0,
  type InteractiveSubjectHostDepsV0
} from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";

const SUBJECT_A = "alice-notebook";
const SUBJECT_B = "bob-notebook";
/** Different lived history: same shape, one decisive difference. */
const FACT_A = "I keep a red notebook on the desk.";
const FACT_B = "I keep a blue notebook on the desk.";
/** The IDENTICAL current event both subjects face after their restarts. */
const SAME_SCENE = "Where do I keep my notebook?";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-longitudinal-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

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

interface RememberedEvidence {
  readonly scene: string;
  /** The factual sentence the scene carries: the substring a quote can be bound to. */
  readonly fact: string;
  readonly episode_ref: string;
  readonly handle: string;
}

/** `The user says: "X"` → `X`; any other scene is its own factual sentence. */
function factWithinScene(scene: string): string {
  const match = /^The user says: "([\s\S]*)"$/.exec(scene);
  return match === null ? scene : (match[1] as string);
}

/**
 * The memory a context-following executor can see in ITS OWN prompt: the first
 * remembered episode scene and the factual handle the host advertised for it.
 */
function rememberedEvidenceIn(request: string): RememberedEvidence | null {
  const blockStart = request.indexOf("[BEGIN HISTORICAL FACTUAL CONTENT");
  if (blockStart < 0) return null;
  const blockEnd = request.indexOf("[END HISTORICAL FACTUAL CONTENT]", blockStart);
  const block = request.slice(blockStart, blockEnd < 0 ? request.length : blockEnd);
  const marker = "- Past episode record (scene: ";
  const at = block.indexOf(marker);
  if (at < 0) return null;
  const quoteAt = block.indexOf('"', at + marker.length);
  if (quoteAt < 0) return null;
  const scene = jsonStringAt(block, quoteAt);
  if (scene === null) return null;
  const refMatch = /episode_ref: "([^"]+)"/.exec(block.slice(quoteAt));
  if (refMatch === null) return null;
  const episodeRef = refMatch[1] as string;
  const escapedRef = episodeRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const handleMatch = new RegExp(`- (F\\d+): ${escapedRef}`).exec(request);
  if (handleMatch === null) return null;
  return { scene, fact: factWithinScene(scene), episode_ref: episodeRef, handle: handleMatch[1] as string };
}

function proposalWithoutMemory(): string {
  return JSON.stringify({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "nothing remembered yet",
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
  });
}

/**
 * The context follower's proposal, shaped like the real executor's observed
 * behaviour: a GENERATIVE primary (a conversational response is primary) that
 * ALSO carries the remembered sentence as a host-authorizable SOURCE_QUOTE.
 * Under AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0 that combination is precisely
 * the one the language stage may use.
 */
function proposalCitingMemory(remembered: RememberedEvidence): string {
  return JSON.stringify({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GENERATIVE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: {
      claims: [{ kind: "SOURCE_QUOTE", text: remembered.fact, source_handles: [remembered.handle] }]
    },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "answer from the remembered episode",
      // A cited factual source must be BOUND in both the considered and the
      // evidence refs (host law), so the context follower declares the same
      // remembered handle in all three arrays.
      relevant_memory_handles: [remembered.handle],
      considered_handles: [remembered.handle],
      current_intent: `answer with the remembered fact: ${remembered.fact}`,
      confidence: 0.8,
      uncertainty: 0.2,
      action_intent: null,
      evidence_handles: [remembered.handle]
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  });
}

/** Deterministic CONTEXT FOLLOWER: cites what the host put in front of it, or nothing. */
function contextFollowingCognition(requests: string[]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
      const remembered = rememberedEvidenceIn(user);
      return {
        content: remembered === null ? proposalWithoutMemory() : proposalCitingMemory(remembered),
        model: "context-follower"
      };
    }
  };
}

/**
 * Deterministic, CONTRACT-FAITHFUL renderer (AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0).
 * It authors no factual content of its own:
 *   PRIMARY_FACT              → the designated authorized claim text, verbatim;
 *   GENERATIVE + a claim      → a fixed natural wrapper around that exact text;
 *   any other act / no claim  → a fixed non-factual surface.
 * So the delivered difference below is attributable to the authorized payload the
 * host supplied, never to this double's invention.
 */
function claimRenderingLanguage(requests: string[]): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
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
      if (primary?.kind === "PRIMARY_FACT" && claim !== undefined) {
        text = claim;
      } else if (primary?.kind === "PRIMARY_CONVERSATIONAL_ACT" && primary.act === "GENERATIVE" && claim !== undefined) {
        text = `You mentioned before that "${claim}"`;
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

interface Recorders {
  readonly cognition: string[];
  readonly language: string[];
}

function deps(root: string, subjectId: string, recorder: Recorders): InteractiveSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: contextFollowingCognition(recorder.cognition),
    languageTransport: claimRenderingLanguage(recorder.language),
    appraisalProvider: createConstantAppraisalProviderV0(),
    sharedSourceStore: new FileSharedSubjectSourceStoreV0(root, subjectId),
    provider_identity: { model: "context-follower", num_predict: 2048 },
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

/** ONE process: opens the subject from its durable artifacts and sends one message. */
async function turn(root: string, subjectId: string, recorder: Recorders, text: string) {
  const host = await InteractiveSubjectHostV0.open(config(root, subjectId), deps(root, subjectId, recorder));
  const resolution = host.resolution();
  const outcome = await host.send(text);
  return { host, resolution, outcome };
}

describe("PERSISTENT_SUBJECT_LONGITUDINAL_HISTORY_AB_RESTART_V0", () => {
  it("same scene, two histories: each subject's own durable state reaches its own behavior, and survives two restarts", async () => {
    const rootA = makeTempDir();
    const rootB = makeTempDir();
    const recorderA: Recorders = { cognition: [], language: [] };
    const recorderB: Recorders = { cognition: [], language: [] };

    // --- 1. past experience → governed durable state (one lived event each) ----
    const a1 = await turn(rootA, SUBJECT_A, recorderA, FACT_A);
    const b1 = await turn(rootB, SUBJECT_B, recorderB, FACT_B);
    expect(a1.outcome.status, a1.outcome.failure ?? "").toBe("COMPLETE");
    expect(b1.outcome.status, b1.outcome.failure ?? "").toBe("COMPLETE");
    expect(a1.outcome.observational_experience_ref, "A's first lived event must be durable").not.toBeNull();
    expect(b1.outcome.observational_experience_ref, "B's first lived event must be durable").not.toBeNull();
    const aEpisode = a1.outcome.observational_experience_ref as string;
    const bEpisode = b1.outcome.observational_experience_ref as string;
    expect(aEpisode).not.toBe(bEpisode);

    // --- 2/3/4. restart → cognition context → observable behavior, same scene ---
    const recorderA2: Recorders = { cognition: [], language: [] };
    const recorderB2: Recorders = { cognition: [], language: [] };
    const a2 = await turn(rootA, SUBJECT_A, recorderA2, SAME_SCENE);
    const b2 = await turn(rootB, SUBJECT_B, recorderB2, SAME_SCENE);
    expect(a2.resolution, "A must CONTINUE its own lineage, not create a new subject").toBe("SUBJECT_RESTORED");
    expect(b2.resolution).toBe("SUBJECT_RESTORED");
    expect(a2.outcome.status, a2.outcome.failure ?? "").toBe("COMPLETE");
    expect(b2.outcome.status, b2.outcome.failure ?? "").toBe("COMPLETE");

    const aRequest = recorderA2.cognition[0] as string;
    const bRequest = recorderB2.cognition[0] as string;
    // Each subject reads ITS OWN durable state, and only its own.
    expect(aRequest, "A's context must carry A's lived fact").toContain(FACT_A);
    expect(aRequest).not.toContain(FACT_B);
    expect(bRequest, "B's context must carry B's lived fact").toContain(FACT_B);
    expect(bRequest).not.toContain(FACT_A);
    expect(aRequest).toContain(aEpisode);
    expect(bRequest).toContain(bEpisode);
    expect(aRequest).not.toContain(bEpisode);
    expect(bRequest).not.toContain(aEpisode);
    // The two cognition contexts are different for the SAME current event.
    expect(aRequest).not.toBe(bRequest);
    expect(a2.outcome.provider_memory_section_present).toBe(true);
    expect(b2.outcome.provider_memory_section_present).toBe(true);

    // Observable behavior: the delivered reply carries the subject's OWN remembered
    // fact as the EXACT authorized claim text, wrapped by the contract-faithful
    // renderer under the AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0 law.
    expect(a2.outcome.subject_text).toBe(`You mentioned before that "${FACT_A}"`);
    expect(b2.outcome.subject_text).toBe(`You mentioned before that "${FACT_B}"`);
    expect(a2.outcome.subject_text).toContain(FACT_A);
    expect(a2.outcome.subject_text).not.toContain(FACT_B);
    expect(b2.outcome.subject_text).not.toContain(FACT_A);
    expect(a2.outcome.subject_text).not.toBe(b2.outcome.subject_text);
    expect(a2.outcome.current_intent).not.toBe(b2.outcome.current_intent);
    expect(recorderA2.language).toHaveLength(1);
    expect(recorderB2.language).toHaveLength(1);

    // --- 5. subsequent state update: the delivered behavior enters durable state
    const a3 = await turn(rootA, SUBJECT_A, { cognition: [], language: [] }, "Thanks for telling me.");
    expect(a3.outcome.status, a3.outcome.failure ?? "").toBe("COMPLETE");
    expect(a3.outcome.completed_prior_outcome, "A's delivered reply must close into durable state").not.toBeNull();
    expect(a3.outcome.completed_prior_outcome?.turn_index).toBe(a2.outcome.turn_index);
    const behaviorEpisode = a3.outcome.completed_prior_outcome?.episode_ref as string;
    expect(behaviorEpisode).not.toBe(aEpisode);

    // --- 6/7. restart again, then the difference is still history-dependent ----
    const recorderA4: Recorders = { cognition: [], language: [] };
    const a4 = await turn(rootA, SUBJECT_A, recorderA4, "What do you know about my desk?");
    expect(a4.resolution).toBe("SUBJECT_RESTORED");
    expect(a4.outcome.status, a4.outcome.failure ?? "").toBe("COMPLETE");
    const aRequest4 = recorderA4.cognition[0] as string;
    const delivered = a2.outcome.subject_text as string;
    const memory4 = aRequest4.slice(aRequest4.indexOf("[BEGIN HISTORICAL FACTUAL CONTENT"));
    // The subject's OWN delivered behavior is durable and reaches later cognition,
    // alongside the counterpart reply that followed it. Rendered memory is JSON
    // escaping, so the comparison uses the escaped form.
    expect(memory4).toContain(behaviorEpisode);
    const escapedDelivered = JSON.stringify(delivered).slice(1, -1);
    expect(memory4).toContain("delivered_behavior_text");
    expect(memory4).toContain(escapedDelivered);
    expect(memory4).toContain("outcome_reply_text");
    // B's lineage never sees any of it.
    const recorderB4: Recorders = { cognition: [], language: [] };
    const b4 = await turn(rootB, SUBJECT_B, recorderB4, "What do you know about my desk?");
    expect(b4.outcome.status, b4.outcome.failure ?? "").toBe("COMPLETE");
    const bRequest4 = recorderB4.cognition[0] as string;
    expect(bRequest4).not.toContain(aEpisode);
    expect(bRequest4).not.toContain(behaviorEpisode);
    expect(bRequest4).not.toContain(delivered);
    expect(bRequest4).toContain(FACT_B);
  }, 120000);
});
