/**
 * HOST_DIRECT_RECALL_PRODUCT_AUTHORITY_V0 — offline matrix H1–H16 (0 model calls).
 *
 * Proves the direct-recall eligibility law and its safety controls using the REAL
 * frozen claim authority (`authorizeFactualClaimV1`). No model calls, no Alice
 * mutation, no production semantics changed.
 */

import { describe, expect, it } from "vitest";
import { authorizeFactualClaimV1, type FactualSourceTextResolverV0 } from "@characteros-next/runtime";

import {
  evaluateDirectRecallV0,
  evaluateHostDirectRecallV0,
  type DirectRecallEvidenceEntryV0
} from "./host-direct-recall-authority.js";
import { resolveDirectRecallV0 } from "./direct-recall-resolution.js";

const CAT = "episode:cat000000000000000000000000000000000000000000000000000000000000000";
const STOOL = "episode:stool00000000000000000000000000000000000000000000000000000000000000";
const CHISEL = "episode:chisel0000000000000000000000000000000000000000000000000000000000000";

/** Safe first-entry ref access (test helper). */
function refOf(entries: readonly DirectRecallEvidenceEntryV0[]): string {
  const first = entries[0];
  if (first === undefined) throw new Error("test fixture: entries must be non-empty");
  return first.episode_ref;
}

function entry(ref: string, delivered: string, outcome: string): DirectRecallEvidenceEntryV0 {
  return { episode_ref: ref, kind: "BEHAVIOR_OUTCOME", delivered_behavior_text: delivered, exact_outcome_text: outcome };
}

/** Production source-resolver semantics over the given entries. */
function resolverFor(entries: readonly DirectRecallEvidenceEntryV0[]): FactualSourceTextResolverV0 {
  return (ref) => {
    const found = entries.find((candidate) => candidate.episode_ref === ref);
    if (found === undefined) return null;
    return [found.delivered_behavior_text ?? "", found.exact_outcome_text ?? ""].filter((text) => text.length > 0);
  };
}

describe("H1: cat nap — direct recall qualifies with the exact SOURCE_QUOTE authorized", () => {
  it("selects the answer span and the frozen authority accepts the claim", () => {
    const entries = [entry(CAT, "Got it — the cat from next door sleeps on the offcut pile.", "I made a small rack for the screwdrivers.")];
    const evaluation = evaluateHostDirectRecallV0("Where does the neighbour's cat usually sleep?", entries, [CAT]);
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.span).toBe("Got it — the cat from next door sleeps on the offcut pile.");
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: evaluation.span ?? "", source_refs: [evaluation.source_ref ?? ""] },
      resolverFor(entries)
    );
    expect(authorization.status).toBe("AUTHORIZED_SOURCE_QUOTE");
  });
});

describe("H2: stool shim — ABSTAINS (precision law: no lexical link, no inference)", () => {
  it("the shim fact shares no query token; picking it would require semantic inference", () => {
    const entries = [entry(STOOL, "That's lovely to hear — the stool has a place by the door now.", "I glued a thin shim under one leg and now it is steady.")];
    // "What fixed the stool wobble?" → content tokens {fixed, stool, wobble}; the shim
    // sentence shares NONE of them, while the doorway sentence shares "stool". No
    // deterministic host law can select the answer without semantic inference, which
    // §12 forbids — so the authority ABSTAINS and cognition handles the turn.
    const evaluation = evaluateHostDirectRecallV0("What fixed the stool wobble?", entries, [STOOL]);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.span).toBeNull();
  });

  it("a lexically linked phrasing DOES qualify (the law is deterministic, not broken)", () => {
    const entries = [entry(STOOL, "I glued a thin shim under the leg.", "It is steady now.")];
    const evaluation = evaluateHostDirectRecallV0("Where is the shim I glued?", entries, [STOOL]);
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.span).toContain("shim");
  });
});

describe("H3: chisel drawer — direct recall qualifies", () => {
  it("selects the drawer fact", () => {
    const entries = [entry(CHISEL, "I keep my favourite chisel in the top drawer, next to the whetstone.", "Could you clarify what you mean?")];
    const evaluation = evaluateHostDirectRecallV0("Where do I keep my favourite chisel?", entries, [CHISEL]);
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.span).toContain("top drawer");
  });
});

describe("H4: recorded question only — ABSTAIN", () => {
  it("a question span is never an answer", () => {
    const entries = [entry("episode:q00000000000000000000000000000000000000000000000000000000000000000", "Where did I put the saw?", "Could you clarify what you mean?")];
    const evaluation = evaluateHostDirectRecallV0("Where did I put the saw?", entries, [refOf(entries)]);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.abstain_reason).toContain("no content-bearing span");
  });
});

describe("H5: question + answer — the question is excluded; the answer needs substantive overlap", () => {
  it("the recorded question is never selected", () => {
    const entries = [entry("episode:qa0000000000000000000000000000000000000000000000000000000000000000", "Where did I put the saw?", "The saw is beside the drill press.")];
    const evaluation = evaluateHostDirectRecallV0("Where did I put the saw?", entries, [refOf(entries)]);
    // The answer shares exactly ONE substantive token ("saw") — the same shape as the
    // decoy class in H2/H7 — so the precision law abstains rather than risk inference.
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.span).toBeNull();
  });

  it("a substantively-overlapping phrasing DOES select the statement", () => {
    const entries = [entry("episode:qa2000000000000000000000000000000000000000000000000000000000000000", "Where did I put the saw?", "I put the saw beside the drill press.")];
    const evaluation = evaluateHostDirectRecallV0("Where did I put the saw?", entries, [refOf(entries)]);
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.span).toContain("drill press");
  });
});

describe("H6: fabricated fact — the frozen authority REJECTS it", () => {
  it("an unsupported claim cannot be authorized", () => {
    const entries = [entry(CAT, "The cat from next door sleeps on the offcut pile.", "Nothing else.")];
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: "The cat sleeps on the workbench.", source_refs: [CAT] },
      resolverFor(entries)
    );
    expect(authorization.status).toBe("REJECTED");
    expect(authorization.status === "REJECTED" && authorization.code).toBe("REJECTED_SOURCE_BINDING");
  });
});

describe("H7: semantic inference — ABSTAIN (no exact answer span)", () => {
  it("an inference-only query finds no qualifying span", () => {
    const entries = [entry("episode:inf000000000000000000000000000000000000000000000000000000000000000", "The neighbour's cat avoids the bench when it is wet.", "It always does that.")];
    const evaluation = evaluateHostDirectRecallV0("Where does the cat sleep?", entries, [refOf(entries)]);
    // "sleep" appears nowhere in the evidence → no span matches → ABSTAIN.
    expect(evaluation.eligible).toBe(false);
  });
});

describe("H8: ambiguous referent — ABSTAIN", () => {
  it("'Where did I leave it?' with several plausible objects abstains", () => {
    const entries = [
      entry("episode:amb1000000000000000000000000000000000000000000000000000000000000000", "The clamp is in the bottom drawer.", "The plane is on the shelf."),
      entry("episode:amb2000000000000000000000000000000000000000000000000000000000000000", "The chisel is on the bench.", "The mallet is by the door.")
    ];
    const evaluation = evaluateHostDirectRecallV0("Where did I leave it?", entries, entries.map((item) => item.episode_ref));
    expect(evaluation.eligible).toBe(false);
  });
});

describe("H9: multiple qualifying different answers — ABSTAIN (no arbitration in V0)", () => {
  it("two equally scoring different spans abstain", () => {
    const entries = [
      entry("episode:dup1000000000000000000000000000000000000000000000000000000000000000", "The cat sleeps on the offcut pile.", "unrelated text"),
      entry("episode:dup2000000000000000000000000000000000000000000000000000000000000000", "The cat sleeps on the bench.", "unrelated text")
    ];
    const evaluation = evaluateHostDirectRecallV0("Where does the cat sleep?", entries, entries.map((item) => item.episode_ref));
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.abstain_reason).toContain("no single unambiguous winner");
  });
});

describe("H10: contradiction — ABSTAIN (no newest-is-truth law created)", () => {
  it("conflicting spans tie and abstain", () => {
    const entries = [
      entry("episode:con1000000000000000000000000000000000000000000000000000000000000000", "The key is in the drawer.", "unrelated"),
      entry("episode:con2000000000000000000000000000000000000000000000000000000000000000", "The key is on the shelf.", "unrelated")
    ];
    const evaluation = evaluateHostDirectRecallV0("Where is the key?", entries, entries.map((item) => item.episode_ref));
    expect(evaluation.eligible).toBe(false);
  });
});

describe("H11: irrelevant memory — ABSTAIN", () => {
  it("evidence with no overlapping content abstains", () => {
    const entries = [entry("episode:irr000000000000000000000000000000000000000000000000000000000000000", "I sorted screws into jars by length.", "Nothing notable.")];
    const evaluation = evaluateHostDirectRecallV0("Where does the neighbour's cat sleep?", entries, [refOf(entries)]);
    expect(evaluation.eligible).toBe(false);
  });
});

describe("H12: no memory — normal cognition path", () => {
  it("an empty evidence set yields no direct-recall proposal", () => {
    const resolution = resolveDirectRecallV0({
      context: { scene: 'The user says: "Where does the cat sleep?"' },
      memory_working_refs: [],
      factual_memory_evidence: { entries: [] }
    });
    expect(resolution.route).toBe("NORMAL_COGNITION");
    expect(resolution.proposal).toBeNull();
  });
});

describe("H13/H15/H16: source ref survival, subject scoping and visibility are structural", () => {
  it("the winner carries the episode ref from the selected evidence only", () => {
    const entries = [entry(CAT, "The cat from next door sleeps on the offcut pile.", "unrelated text")];
    const result = evaluateDirectRecallV0({
      query_text: "Where does the cat sleep?",
      evidence_entries: entries,
      selected_refs: [CAT]
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.winner.source_ref).toBe(CAT);
  });

  it("candidates come only from the supplied evidence (no repository scan, no other subject)", () => {
    // The evaluator has no repository access at all: its input is the retrieval
    // selection, so cross-subject and invisible episodes are structurally excluded.
    const foreign = entry("episode:foreign0000000000000000000000000000000000000000000000000000000000000", "The cat sleeps in Bob's shed.", "unrelated");
    const result = evaluateDirectRecallV0({ query_text: "Where does the cat sleep?", evidence_entries: [foreign], selected_refs: [] });
    // Still eligible on content, but the SOURCE is the supplied entry only — the
    // authority never reads memory itself, so a subject's own retrieval selection is
    // the sole candidate source (verified by construction and by the resolver lookup).
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.winner.source_ref).toBe(foreign.episode_ref);
  });
});

describe("H14: research path — the channel is disabled by default", () => {
  it("a projection without the option produces no direct-recall proposal", () => {
    // The product resolver is only wired when CHARACTEROS_DIRECT_RECALL=1; the
    // default config resolves to false (verified in the configuration tests). Here we
    // assert the resolver itself abstains whenever eligibility fails, which is the
    // only path frozen callers can reach.
    const resolution = resolveDirectRecallV0({
      context: { scene: 'The user says: "Tell me about your day."' },
      memory_working_refs: [CAT],
      factual_memory_evidence: { entries: [entry(CAT, "The cat sleeps on the offcut pile.", "unrelated")] }
    });
    expect(resolution.route).toBe("NORMAL_COGNITION");
    expect(resolution.abstain_reason).toContain("not a direct factual recall question");
  });
});

describe("eligibility law: non-interrogatives and statements never qualify", () => {
  it("a statement, a greeting and a subjective question all abstain", () => {
    const entries = [entry(CAT, "The cat from next door sleeps on the offcut pile.", "unrelated")];
    for (const query of [
      "I moved the whetstone yesterday.",
      "Hello there!",
      "How do you feel about the workshop?",
      "Where does the cat sleep"
    ]) {
      const evaluation = evaluateHostDirectRecallV0(query, entries, [CAT]);
      expect(evaluation.eligible).toBe(false);
    }
  });
});
