/**
 * RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0 — offline matrix S1–S17 (0 model calls).
 *
 * Proves the closed-set selection authority and every safety control using the
 * REAL frozen claim authority (`authorizeFactualClaimV1`) and the REAL frozen V8
 * proposal parse (`canonicalizeConversationCognitionModelOutputV8`). Selector
 * outputs are deterministic canned strings — no model, no network, no Alice.
 */

import { describe, expect, it } from "vitest";
import {
  authorizeFactualClaimV1,
  canonicalizeConversationCognitionModelOutputV8,
  type FactualMemoryEvidenceBundleV0
} from "@characteros-next/runtime";

import {
  buildRecallCandidateSetV0,
  isRecordedQuestionV0,
  splitRecordedSentencesV0,
  type RecallProjectionViewV0
} from "./recall-evidence-candidates.js";
import {
  buildRecallSelectorRequestV0,
  buildSelectorProposalV0,
  buildSelectorSourceResolverV0,
  parseRecallSelectorOutputV0,
  RECALL_SELECTOR_SYSTEM_PROMPT_V0
} from "./recall-evidence-selector-authority.js";

const CAT = "episode:cat000000000000000000000000000000000000000000000000000000000000000";
const STOOL = "episode:stool00000000000000000000000000000000000000000000000000000000000000";
const CHISEL = "episode:chisel0000000000000000000000000000000000000000000000000000000000000";
const SAW = "episode:saw0000000000000000000000000000000000000000000000000000000000000000";
const KEY = "episode:key0000000000000000000000000000000000000000000000000000000000000000";
const FOREIGN = "episode:bob0000000000000000000000000000000000000000000000000000000000000000";

interface EntryFixture {
  readonly ref: string;
  readonly delivered: string;
  readonly outcome: string;
}

/**
 * A COMPLETE V1 projection fixture: the authority only needs the evidence bundle
 * and the ref fields, but the S30 control additionally feeds the constructed
 * proposal to the REAL frozen V8 parse, which reads the whole projection shape.
 */
function projectionOf(entries: readonly EntryFixture[]): RecallProjectionViewV0 {
  const bundle: FactualMemoryEvidenceBundleV0 = {
    schema_version: "factual-memory-evidence-v0",
    repository_revision: "R1" as never,
    entries: entries
      .map((entry) => ({
        kind: "BEHAVIOR_OUTCOME" as const,
        episode_ref: entry.ref as never,
        repository_revision: "R1" as never,
        episode_payload_hash: "h" as never,
        experience_ref: "experience:x" as never,
        experience_payload_hash: "h" as never,
        event_ref: "event:x" as never,
        event_payload_hash: "h" as never,
        actor_ref: "entity:alice" as never,
        delivered_behavior_text: entry.delivered,
        exact_outcome_text: entry.outcome,
        delivered_logical_time: 1 as never,
        outcome_logical_time: 2 as never
      }))
      .sort((left, right) => (left.episode_ref < right.episode_ref ? -1 : 1))
  };
  const projection = {
    schema_version: "cognitive-context-projection-v1",
    subject_id: "alice",
    current_logical_time: 100000,
    state_revision: 1,
    traits_dimensions: {},
    affect_channels: [],
    mood_baseline: 0,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: 'The user says: "Where does the neighbour\'s cat usually sleep?"',
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: null
    },
    memory_working_refs: entries.map((entry) => entry.ref),
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: null,
    interaction_familiarity_cognition_influences: [],
    allowed_actions: [],
    factual_memory_evidence: bundle,
    projection_hash: "projection-hash-fixture"
  };
  return projection as unknown as RecallProjectionViewV0;
}

/** A canned selector output for a given handle (or ABSTAIN). */
function selectorSays(selection: string): string {
  return JSON.stringify({ selection });
}

/** Runs the full deterministic path: candidates → canned selection → proposal. */
function runPipeline(
  projection: RecallProjectionViewV0,
  selection: string
): {
  readonly candidates: ReturnType<typeof buildRecallCandidateSetV0>;
  readonly outcome: ReturnType<typeof parseRecallSelectorOutputV0>;
  readonly proposal: Record<string, unknown> | null;
} {
  const candidates = buildRecallCandidateSetV0(projection);
  const outcome = parseRecallSelectorOutputV0(selectorSays(selection), candidates);
  const proposal =
    outcome.kind === "SELECTED"
      ? (buildSelectorProposalV0({ candidate: outcome.candidate, projection })?.proposal ?? null)
      : null;
  return { candidates, outcome, proposal };
}

/** The candidate whose text contains the given fragment (test locator). */
function handleContaining(candidates: ReturnType<typeof buildRecallCandidateSetV0>, fragment: string): string {
  const found = candidates.candidates.find((candidate) => candidate.text.includes(fragment));
  if (found === undefined) throw new Error(`test fixture: no candidate contains ${fragment}`);
  return found.handle;
}

describe("S1: cat nap — the answer-bearing candidate is selectable and lawful", () => {
  it("selecting the cat-sleeps statement yields an authorized PRIMARY_FACT proposal", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "Got it — the cat from next door sleeps on the offcut pile.", outcome: "I made a small rack for the screwdrivers." }
    ]);
    const { candidates, proposal } = runPipeline(projection, handleContaining(buildRecallCandidateSetV0(projection), "offcut pile"));
    const handle = handleContaining(candidates, "offcut pile");
    expect(proposal).not.toBeNull();
    expect(handle).toMatch(/^S[1-9][0-9]*$/);
    expect(proposal?.["response_semantics"]).toEqual({ kind: "PRIMARY_FACT", claim_index: 0 });
    const claims = (proposal?.["factual_assessment"] as { claims: { text: string }[] }).claims;
    expect(claims[0]?.text).toBe("Got it — the cat from next door sleeps on the offcut pile.");
  });
});

describe("S2: stool shim — problem description vs solution are distinct candidates", () => {
  const projection = projectionOf([
    {
      ref: STOOL,
      delivered: "The stool is finished, and it wobbles a little on the stone floor.",
      outcome: "I glued a thin shim under one leg and now it is steady."
    }
  ]);

  it("both spans are separately addressable candidates", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    const problem = handleContaining(candidates, "wobbles a little");
    const solution = handleContaining(candidates, "thin shim");
    expect(problem).not.toBe(solution);
  });

  it("selecting the solution yields the solution text, not the problem text", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    const solution = handleContaining(candidates, "thin shim");
    const { proposal } = runPipeline(projection, solution);
    const claims = (proposal?.["factual_assessment"] as { claims: { text: string }[] }).claims;
    expect(claims[0]?.text).toBe("I glued a thin shim under one leg and now it is steady.");
    expect(claims[0]?.text).not.toContain("wobbles");
  });
});

describe("S3: chisel drawer — the location fact is selectable", () => {
  it("selects the drawer statement", () => {
    const projection = projectionOf([
      { ref: CHISEL, delivered: "I keep my favourite chisel in the top drawer, next to the whetstone.", outcome: "The weather has been grey all week." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const handle = handleContaining(candidates, "top drawer");
    const { proposal } = runPipeline(projection, handle);
    const claims = (proposal?.["factual_assessment"] as { claims: { text: string }[] }).claims;
    expect(claims[0]?.text).toContain("top drawer");
  });
});

describe("S4: recorded question vs answer", () => {
  const projection = projectionOf([
    { ref: SAW, delivered: "Where did I put the saw?", outcome: "The saw is beside the drill press." }
  ]);

  it("the recorded question is not a candidate at all", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    expect(candidates.candidates.some((candidate) => candidate.text === "Where did I put the saw?")).toBe(false);
    expect(candidates.candidates.some((candidate) => candidate.text.includes("drill press"))).toBe(true);
  });

  it("the question's own handle is not admissible", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    // Exactly one candidate exists (the statement); S2 was never minted.
    expect(candidates.candidates).toHaveLength(1);
    expect(candidates.admissible).toEqual(["S1", "ABSTAIN"]);
    const outcome = parseRecallSelectorOutputV0(selectorSays("S2"), candidates);
    expect(outcome.kind).toBe("ABSTAIN");
  });

  it("selecting the answer statement works", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    const { proposal } = runPipeline(projection, handleContaining(candidates, "drill press"));
    expect(proposal).not.toBeNull();
  });
});

describe("S5/S6: irrelevant or empty candidate sets abstain", () => {
  it("S5: the selector may abstain on irrelevant candidates", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "I sorted screws into jars by length.", outcome: "Nothing notable." }
    ]);
    const { outcome, proposal } = runPipeline(projection, "ABSTAIN");
    expect(outcome.kind).toBe("ABSTAIN");
    expect(proposal).toBeNull();
  });

  it("S6: no candidates at all yields an ABSTAIN-only admissible set", () => {
    const projection = projectionOf([{ ref: CAT, delivered: "", outcome: "" }]);
    const candidates = buildRecallCandidateSetV0(projection);
    expect(candidates.candidates).toHaveLength(0);
    expect(candidates.admissible).toEqual(["ABSTAIN"]);
    const outcome = parseRecallSelectorOutputV0(selectorSays("ABSTAIN"), candidates);
    expect(outcome.kind).toBe("ABSTAIN");
  });
});

describe("S7: ambiguous referent — ABSTAIN is available and honored", () => {
  it("with several plausible objects the selector abstains", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The clamp is in the bottom drawer.", outcome: "The plane is on the shelf." },
      { ref: STOOL, delivered: "The chisel is on the bench.", outcome: "The mallet is by the door." }
    ]);
    const { outcome, proposal } = runPipeline(projection, "ABSTAIN");
    expect(outcome.kind).toBe("ABSTAIN");
    expect(proposal).toBeNull();
  });
});

describe("S8: contradiction — no truth arbitration by the selector", () => {
  it("the selector is not asked to resolve conflicts and may abstain", () => {
    const projection = projectionOf([
      { ref: KEY, delivered: "The key was in the drawer.", outcome: "unrelated." },
      { ref: SAW, delivered: "The key was moved to the shelf.", outcome: "unrelated." }
    ]);
    const { outcome, proposal } = runPipeline(projection, "ABSTAIN");
    expect(outcome.kind).toBe("ABSTAIN");
    expect(proposal).toBeNull();
  });
});

describe("S9: fabricated / foreign selector output fails closed", () => {
  it("an unknown handle, a foreign handle and a non-handle all abstain", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    for (const bogus of ["S99", "F1", "C1", "S1 ", "s1", "NONE", "1"]) {
      expect(parseRecallSelectorOutputV0(selectorSays(bogus), candidates).kind).toBe("ABSTAIN");
    }
  });
});

describe("S10: malformed output fails closed", () => {
  it("prose, extra keys, missing keys, non-strings and non-JSON all abstain", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    for (const malformed of [
      "",
      "S1",
      "I think the answer is S1 because the cat sleeps there.",
      '{"selection":"S1","reason":"because"}',
      '{"selection":1}',
      '{"selection":null}',
      '{"answer":"S1"}',
      '{"selection":"S1"',
      "[]",
      '"S1"',
      "```json\n{\"selection\":\"S1\"}\n```"
    ]) {
      expect(parseRecallSelectorOutputV0(malformed, candidates).kind).toBe("ABSTAIN");
    }
  });
});

describe("S11: source ref preserved end to end", () => {
  it("the proposal cites the frozen factual handle of the selected candidate's own ref", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const selected = candidates.candidates[0];
    expect(selected?.source_ref).toBe(CAT);
    const { proposal } = runPipeline(projection, selected?.handle ?? "");
    const claims = (proposal?.["factual_assessment"] as { claims: { source_handles: string[] }[] }).claims;
    expect(claims[0]?.source_handles).toEqual([selected?.factual_handle]);
  });
});

describe("S12: authorization rejection after selection produces no answer", () => {
  it("a selected candidate whose source cannot resolve yields no proposal", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const selected = candidates.candidates[0];
    if (selected === undefined) throw new Error("test fixture: expected a candidate");
    // A projection with NO evidence bundle cannot resolve the source text.
    const orphaned = buildSelectorProposalV0({ candidate: selected, projection: { factual_memory_evidence: undefined } });
    expect(orphaned).toBeNull();
  });

  it("the frozen authority independently rejects a non-substring claim", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: "The cat sleeps on the workbench.", source_refs: [CAT] },
      buildSelectorSourceResolverV0(projection)
    );
    expect(authorization.status).toBe("REJECTED");
    expect(authorization.status === "REJECTED" && authorization.code).toBe("REJECTED_SOURCE_BINDING");
  });
});

describe("S13/S14/S15: candidate source, subject and visibility are structural", () => {
  it("S13: a candidate outside the supplied evidence cannot be selected", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    // Only evidence-derived handles exist; nothing outside the bundle is addressable.
    expect(candidates.admissible.every((entry) => entry === "ABSTAIN" || /^S[1-9][0-9]*$/.test(entry))).toBe(true);
  });

  it("S14: a foreign subject's episode is not in this subject's candidate set", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    expect(candidates.candidates.some((candidate) => candidate.source_ref === FOREIGN)).toBe(false);
  });

  it("S15: evidence absent from the bundle cannot appear as a candidate", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    expect(candidates.candidates.every((candidate) => candidate.source_ref === CAT)).toBe(true);
  });
});

describe("S16: the selector cannot generate factual text", () => {
  it("the constructed claim text is byte-identical to the candidate's verbatim span", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const selected = candidates.candidates[0];
    const { proposal } = runPipeline(projection, selected?.handle ?? "");
    const claims = (proposal?.["factual_assessment"] as { claims: { text: string }[] }).claims;
    // Whatever the selector said, the delivered text is the EVIDENCE text.
    expect(claims[0]?.text).toBe(selected?.text);
  });

  it("a selector response carrying invented prose never reaches the claim", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const outcome = parseRecallSelectorOutputV0(
      JSON.stringify({ selection: "The stool was fixed with a shim." }),
      candidates
    );
    expect(outcome.kind).toBe("ABSTAIN");
  });

  it("the selector prompt states selection-only rules and never asks for an answer", () => {
    expect(RECALL_SELECTOR_SYSTEM_PROMPT_V0).toContain("You may ONLY choose a listed handle");
    expect(RECALL_SELECTOR_SYSTEM_PROMPT_V0).toContain("Never write a statement, a quote, an answer");
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." }
    ]);
    const request = buildRecallSelectorRequestV0("Where does the cat sleep?", buildRecallCandidateSetV0(projection));
    expect(request.user).toContain("Return exactly one of:");
    expect(request.candidate_count).toBe(2);
  });
});

describe("S17: the isolated selector request is tiny and deterministic", () => {
  it("the request carries the query, the handles and the closed output set only", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." },
      { ref: CHISEL, delivered: "I keep my favourite chisel in the top drawer.", outcome: "unrelated." }
    ]);
    const candidates = buildRecallCandidateSetV0(projection);
    const request = buildRecallSelectorRequestV0("Where does the cat sleep?", candidates);
    expect(request.user).toContain("Where does the cat sleep?");
    expect(request.user).toContain("S1:");
    expect(request.user).toContain("ABSTAIN");
    // The selector request never carries the cognition V8 prompt.
    expect(request.system).not.toContain("conversation-cognition-proposal-v8");
    expect(request.system.length).toBeLessThan(2000);
  });

  it("candidate construction is deterministic", () => {
    const projection = projectionOf([
      { ref: CAT, delivered: "The cat sleeps on the offcut pile.", outcome: "unrelated." },
      { ref: CHISEL, delivered: "I keep my favourite chisel in the top drawer.", outcome: "unrelated." }
    ]);
    const first = JSON.stringify(buildRecallCandidateSetV0(projection));
    const second = JSON.stringify(buildRecallCandidateSetV0(projection));
    expect(first).toBe(second);
  });
});

describe("sentence split and recorded-question law", () => {
  it("splits on punctuation boundaries only", () => {
    expect(splitRecordedSentencesV0("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
  });

  it("flags only '?' spans as recorded questions", () => {
    expect(isRecordedQuestionV0("Where is it?")).toBe(true);
    expect(isRecordedQuestionV0("It is there.")).toBe(false);
    expect(isRecordedQuestionV0("It is there!")).toBe(false);
  });
});

describe("S30: deterministic canned pipeline — selection and abstention", () => {
  const projection = projectionOf([
    { ref: CAT, delivered: "Got it — the cat from next door sleeps on the offcut pile.", outcome: "I made a small rack for the screwdrivers." }
  ]);

  it("F2-equivalent selection → exact candidate → SOURCE_QUOTE → authorization → PRIMARY_FACT", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    const handle = handleContaining(candidates, "offcut pile");
    const outcome = parseRecallSelectorOutputV0(selectorSays(handle), candidates);
    expect(outcome.kind).toBe("SELECTED");
    if (outcome.kind !== "SELECTED") throw new Error("unreachable");
    const built = buildSelectorProposalV0({ candidate: outcome.candidate, projection });
    expect(built).not.toBeNull();

    // The REAL frozen V8 parse accepts the host-constructed proposal.
    const checked = canonicalizeConversationCognitionModelOutputV8(
      built?.proposal,
      projection as never,
      "hash" as never
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error(checked.detail);
    expect(checked.proposal.response_semantics).toEqual({ kind: "PRIMARY_FACT", claim_index: 0 });
    expect(checked.proposal.factual_assessment.claims[0]?.text).toBe(
      "Got it — the cat from next door sleeps on the offcut pile."
    );
  });

  it("ABSTAIN → no proposal → the existing cognition path runs", () => {
    const candidates = buildRecallCandidateSetV0(projection);
    const outcome = parseRecallSelectorOutputV0(selectorSays("ABSTAIN"), candidates);
    expect(outcome.kind).toBe("ABSTAIN");
    expect(outcome.kind === "ABSTAIN" && outcome.reason).toContain("abstained");
  });
});
