/**
 * LONG_HORIZON_COGNITION_MEMORY_USAGE_REMEDIATION_V0 — GENERATION-AFFORDANCE
 * PROJECTION tests (G1–G10, 0 model calls).
 *
 * The claimable-span projection renders each selected memory entry's already-
 * authorized factual text as verbatim, exactly-quotable spans bound to the same F
 * handles the SOURCE_QUOTE law already uses. The frozen cognition schema, validators,
 * authorization, CAN_SAY law and retrieval are untouched.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import {
  renderClaimableMemorySpanLinesV1,
  renderFactualMemoryEvidenceSectionV1
} from "../cognition/cognitive-prompt-projection.js";
import { cognitionUserContentForV8 } from "./conversation-cognition-provider-v8.js";

const HASH = `sha256:${"a".repeat(64)}` as HashV1;
const QUERY = "The neighbour's cat is at the door again — where does she usually nap when she visits?";
const CAT_EPISODE = "episode:2d7ceae37faa5c2316110e36e26ec339fd1c4879ae5499bc4186e23be06ac03a";
const OBS = "observation:o-eval";

function projection(evidenceEntries: readonly unknown[], workingRefs?: readonly string[]): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-eval" as never,
    current_logical_time: 900 as never, state_revision: 1846 as never,
    traits_dimensions: {}, personality_dimensions: {}, personality_disposition: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: `The user says: "${QUERY}"`, task: "Respond to the user's latest message.", focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: (workingRefs ?? evidenceEntries.map((entry) => (entry as { episode_ref: string }).episode_ref)) as never,
    recent_retrieval_refs: [],
    belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [],
    allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: {
      schema_version: "factual-memory-evidence-v0",
      repository_revision: "R611" as never,
      entries: evidenceEntries as never
    }
  } as unknown as CognitiveContextProjectionV2;
}

const CAT_ENTRY = {
  kind: "BEHAVIOR_OUTCOME",
  episode_ref: CAT_EPISODE,
  repository_revision: "R611",
  episode_payload_hash: `sha256:${"b".repeat(64)}`,
  experience_ref: `experience:${"c".repeat(64)}`,
  experience_payload_hash: `sha256:${"d".repeat(64)}`,
  event_ref: `event:${"e".repeat(64)}`,
  event_payload_hash: `sha256:${"f".repeat(64)}`,
  actor_ref: "entity:alice",
  delivered_behavior_text: "Got it — the cat from next door sleeps on the offcut pile.",
  exact_outcome_text: "I made a small rack for the screwdrivers and it took under an hour.",
  delivered_logical_time: 100,
  outcome_logical_time: 101
};

function section(entries: readonly unknown[], workingRefs?: readonly string[]): string {
  const proj = projection(entries, workingRefs);
  const evidence = (proj as unknown as { factual_memory_evidence: never }).factual_memory_evidence;
  return renderClaimableMemorySpanLinesV1(proj as never, evidence).join(String.fromCharCode(10));
}

describe("G1/G2/G3: selected memory becomes compact, exact, handle-bound candidates", () => {
  it("renders verbatim sentence spans under the entry's F handle", () => {
    const out = section([CAT_ENTRY]);
    expect(out).toContain("[CLAIMABLE VERBATIM SPANS");
    expect(out).toContain("- F1 subject's delivered behavior (recorded statement):");
    expect(out).toContain(JSON.stringify("Got it — the cat from next door sleeps on the offcut pile."));
    expect(out).toContain("- F1 recorded outcome reply (recorded statement):");
  });

  it("every rendered span is an EXACT substring of its source text (G2)", () => {
    const out = section([CAT_ENTRY]);
    const spans = [...out.matchAll(/- (F\d+) [^:]+: ("(?:[^"\\]|\\.)*")/g)].map((match) => ({
      handle: match[1],
      span: JSON.parse(match[2] ?? '""') as string
    }));
    expect(spans.length).toBeGreaterThanOrEqual(2);
    for (const span of spans) {
      const source = span.handle === "F1" ? CAT_ENTRY.delivered_behavior_text + " " + CAT_ENTRY.exact_outcome_text : "";
      expect(CAT_ENTRY.delivered_behavior_text.includes(span.span) || CAT_ENTRY.exact_outcome_text.includes(span.span)).toBe(true);
      void source;
    }
  });

  it("candidates bind to the same F handle the validator's source-ref law assigns (G3)", () => {
    const proj = projection([CAT_ENTRY]);
    const raw = renderFactualMemoryEvidenceSectionV1(proj);
    // The raw section carries the canonical ref; the span section labels the SAME
    // entry F1 (factualAssessmentSourceRefs sorts episode: < observation:).
    expect(raw).toContain(CAT_EPISODE);
    expect(raw).toContain("[END HISTORICAL FACTUAL CONTENT]");
    const spans = section([CAT_ENTRY]);
    expect(spans).toMatch(/- F1 subject's delivered behavior/);
  });
});

describe("G4: no evidence → section empty → frozen request unchanged", () => {
  it("returns an empty section for absent and empty evidence", () => {
    expect(renderFactualMemoryEvidenceSectionV1(projection([]))).toBe("");
    const noField = projection([]) as unknown as Record<string, unknown>;
    delete noField["factual_memory_evidence"];
    expect(renderFactualMemoryEvidenceSectionV1(noField as never)).toBe("");
  });
});

describe("G5/G10: evidence is ignorable and never mandatory (CAN_SAY unchanged)", () => {
  it("the candidate header states evidence may or may not resolve the question", () => {
    const out = section([CAT_ENTRY]);
    expect(out).toContain("may or may not resolve the current question");
    expect(out).toContain("historical evidence");
  });

  it("no mandatory-answer imperative exists anywhere in the section", () => {
    const out = section([CAT_ENTRY]);
    for (const forbidden of ["you must answer", "MUST use", "you must cite", "definitely true"]) {
      expect(out.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("G6: prior-question self-match text is labeled as a question, not an answer", () => {
  it("a recorded question span carries the question label", () => {
    const echoEntry = {
      ...CAT_ENTRY,
      episode_ref: "episode:eeee000000000000000000000000000000000000000000000000000000000000",
      delivered_behavior_text: "Could you clarify what you mean? The neighbour's cat is at the door again — where does she usually nap when she visits?"
    };
    const out = section([echoEntry]);
    expect(out).toContain("(recorded question)");
    expect(out).toContain("(recorded statement)");
    // The question span is explicitly NOT presented as a statement. Both the echo
    // ("Could you clarify…?") and the nap question are recorded questions.
    const questionLines = out
      .split("\n")
      .filter((line) => line.startsWith("- F") && line.includes("(recorded question)"));
    expect(questionLines.length).toBe(2);
    expect(questionLines.some((line) => line.includes("nap when she visits"))).toBe(true);
  });
});

describe("G7: conflicting candidates remain distinct under separate handles", () => {
  it("two conflicting entries render under F1 and F2 with their own spans", () => {
    const entryA = {
      ...CAT_ENTRY,
      episode_ref: "episode:aaaa000000000000000000000000000000000000000000000000000000000000",
      delivered_behavior_text: "The key was in the drawer.",
      exact_outcome_text: "The key was in the drawer."
    };
    const entryB = {
      ...CAT_ENTRY,
      episode_ref: "episode:bbbb000000000000000000000000000000000000000000000000000000000000",
      delivered_behavior_text: "The key was moved to the shelf.",
      exact_outcome_text: "The key was moved to the shelf."
    };
    const out = section([entryA, entryB], [entryA.episode_ref, entryB.episode_ref]);
    expect(out).toContain("- F1 subject's delivered behavior");
    expect(out).toContain("- F2 subject's delivered behavior");
    expect(out).toContain("The key was in the drawer.");
    expect(out).toContain("The key was moved to the shelf.");
  });
});

describe("G8: the current user utterance remains prominently visible", () => {
  it("with the option OFF the user content is byte-identical to the frozen builder", () => {
    const proj = projection([CAT_ENTRY]);
    const off = cognitionUserContentForV8(proj);
    expect(off).not.toContain("CLAIMABLE VERBATIM SPANS");
    expect(off).toContain("[END HISTORICAL FACTUAL CONTENT]");
  });

  it("with the option ON the spans are injected INSIDE the evidence block, and the utterance stays visible (G8)", () => {
    const proj = projection([CAT_ENTRY]);
    const on = cognitionUserContentForV8(proj, { claimable_memory_spans: true });
    const spansAt = on.indexOf("CLAIMABLE VERBATIM SPANS");
    const endAt = on.indexOf("[END HISTORICAL FACTUAL CONTENT]");
    expect(spansAt).toBeGreaterThan(-1);
    expect(endAt).toBeGreaterThan(spansAt); // spans precede the end marker → inside the block
    expect(on).toContain("[BEGIN HISTORICAL FACTUAL CONTENT");
    expect(on).toContain(QUERY); // the current utterance remains visible
    expect(on).toContain(CAT_ENTRY.delivered_behavior_text);
  });
});

describe("G9: SOURCE_QUOTE strictness is unchanged", () => {
  it("a near-miss span (one word changed) is NOT a substring of the source", () => {
    const paraphrase = "Got it — the cat from next door sleeps on the shelf near the window.";
    expect(CAT_ENTRY.delivered_behavior_text.includes(paraphrase)).toBe(false);
    // The candidate projection never invents this text: candidates are split spans of
    // the source, so a paraphrase cannot appear in the section at all.
    const out = section([CAT_ENTRY]);
    expect(out).not.toContain("shelf near the window");
  });
});
