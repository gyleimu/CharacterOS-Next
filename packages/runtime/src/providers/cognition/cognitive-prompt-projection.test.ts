/**
 * Cognition Persistent-State Grounding Contract V0 — prompt rendering tests.
 *
 * Frozen policy: STATE_VISIBLE_NOT_CITEABLE. Persistent subject state
 * (traits_seed / affect / mood / regulation / relationship_dimensions) is
 * VISIBLE to cognition, projection-hash bound, and may influence reasoning —
 * but is NOT automatically citeable. The CITEABLE CONTEXT REFS allowlist in
 * the prompt is derived from the SAME executable authority the production
 * validator enforces (allowedEvidenceSet) and must match it exactly.
 *
 * These tests are fully offline: they exercise the deterministic renderer and
 * the frozen production validators only. No real model, no network.
 */

import { describe, expect, it } from "vitest";
import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../../transitions/observation/observation-fixtures.js";
import {
  buildCognitiveContextProjection
} from "../../transitions/cognition-action/cognition-action-transition-executor.js";
import {
  allowedEvidenceSet,
  findUnsupportedEvidenceRef,
  validateCognitionProposal
} from "../../transitions/cognition-action/types.js";
import {
  renderCognitiveSubjectData,
  renderCognitiveSystemRules
} from "./cognitive-prompt-projection.js";

const ALICE = "entity:alice";
const DIMENSION_ID = "relationship_test_dimension_v0";

/** Base fixture: alice registered with the test relationship dimension. */
function stateWithAlice(dimensionValue: number, overrides: Record<string, unknown> = {}): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [{ dimension_id: DIMENSION_ID, value: dimensionValue }]
        }
      ]
    },
    ...overrides
  };
  return state as unknown as SubjectStateV0;
}

/** Extracts the exact ref lines rendered inside the CITEABLE CONTEXT REFS section. */
function citeableSectionRefs(rendered: string): string[] {
  const header = "CITEABLE CONTEXT REFS (only the exact refs listed below may appear in relevant_memory_refs, considered_context_refs, or evidence_refs):";
  const start = rendered.indexOf(header);
  if (start === -1) throw new Error("CITEABLE CONTEXT REFS section missing");
  const rest = rendered.slice(start + header.length);
  const end = rest.indexOf("[ALLOWED ACTION SPACE]");
  const section = rest.slice(0, end === -1 ? rest.length : end);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

describe("Cognition persistent-state grounding contract V0 (prompt rendering)", () => {
  it("P1: rendered CITEABLE CONTEXT REFS equals the exact allowedEvidenceSet (sorted, deduped, no drift)", async () => {
    const projection = await buildCognitiveContextProjection(
      stateWithAlice(0.45, {
        context: {
          scene: "difficult problem",
          task: null,
          focus_refs: ["event:focus-1"],
          active_entity_refs: [ALICE, "entity:bob"],
          environment_refs: ["environment:room-1"],
          current_observation_ref: "observation:o-77"
        }
      })
    );
    const rendered = renderCognitiveSubjectData(projection);
    const renderedRefs = citeableSectionRefs(rendered);
    const expectedRefs = [...allowedEvidenceSet(projection)].sort();
    expect(renderedRefs).toEqual(expectedRefs);
    // Deterministic ordering: rendering is sorted; running twice is identical.
    expect(rendered).toBe(renderCognitiveSubjectData(projection));
    // No missing refs, no extra refs.
    expect(new Set(renderedRefs).size).toBe(renderedRefs.length);
  });

  it("P2: relationship state is VISIBLE in SUBJECT STATE but its counterpart_ref is NOT citeable", async () => {
    // alice appears ONLY under relationship_dimensions — nowhere in lawful
    // evidence/context slots.
    const projection = await buildCognitiveContextProjection(
      stateWithAlice(0.45, {
        context: {
          scene: "difficult problem",
          task: null,
          focus_refs: [],
          active_entity_refs: [],
          environment_refs: ["environment:room-1"],
          current_observation_ref: null
        }
      })
    );
    const rendered = renderCognitiveSubjectData(projection);
    // VISIBLE as subject state data:
    expect(rendered).toContain(`- ${ALICE}: ${DIMENSION_ID}=0.45`);
    // NOT citeable:
    const refs = citeableSectionRefs(rendered);
    expect(refs).not.toContain(ALICE);
    expect(allowedEvidenceSet(projection).has(ALICE)).toBe(false);
  });

  it("P3: the same entity is independently citeable when it lawfully appears in context refs", async () => {
    const projection = await buildCognitiveContextProjection(
      stateWithAlice(0.45, {
        context: {
          scene: "difficult problem",
          task: null,
          focus_refs: [],
          active_entity_refs: [ALICE],
          environment_refs: [],
          current_observation_ref: null
        }
      })
    );
    const rendered = renderCognitiveSubjectData(projection);
    const refs = citeableSectionRefs(rendered);
    // Citeable exactly once — as a contextual entity ref, NOT as relationship
    // provenance.
    expect(refs.filter((ref) => ref === ALICE)).toHaveLength(1);
    expect(allowedEvidenceSet(projection).has(ALICE)).toBe(true);
  });

  it("P4: a lawful proposal influenced by relationship state with empty ref arrays is valid", async () => {
    const projection = await buildCognitiveContextProjection(
      stateWithAlice(0.45, {
        context: {
          scene: "difficult problem",
          task: null,
          focus_refs: [],
          active_entity_refs: [ALICE],
          environment_refs: [],
          current_observation_ref: null
        }
      })
    );
    // STATE_INFLUENCED_EMPTY_REF_RECEIPT: relationship state influenced the
    // proposal shape, yet empty ref arrays are lawful.
    const checked = validateCognitionProposal({
      schema_version: "cognition-proposal-v0",
      projection_hash: projection.projection_hash,
      reasoning_summary: "relationship state informs hesitation",
      relevant_memory_refs: [],
      considered_context_refs: [],
      current_intent: null,
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_refs: []
    });
    expect(checked.ok).toBe(true);
  });

  it("P5: an invented relationship: ref is rejected by evidence membership validation", async () => {
    const projection = await buildCognitiveContextProjection(stateWithAlice(0.45));
    // "relationship" is a legal CanonicalRefV0 KIND, so the invented ref is
    // syntactically valid — the rejection is at the EVIDENCE MEMBERSHIP gate:
    const schemaChecked = validateCognitionProposal({
      schema_version: "cognition-proposal-v0",
      projection_hash: projection.projection_hash,
      reasoning_summary: "invented ref",
      relevant_memory_refs: ["relationship:r-invented"],
      considered_context_refs: [],
      current_intent: null,
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_refs: ["relationship:r-invented"]
    });
    expect(schemaChecked.ok).toBe(true);
    if (!schemaChecked.ok) throw new Error("unexpected schema rejection");
    // The frozen membership authority rejects it (UNSUPPORTED_EVIDENCE_REF path):
    const membership = findUnsupportedEvidenceRef(
      [...schemaChecked.value.relevant_memory_refs, ...schemaChecked.value.evidence_refs],
      allowedEvidenceSet(projection)
    );
    expect(membership).toBe("relationship:r-invented");
    // INVENTED_RELATIONSHIP_REF: REJECTED — no allowlist widening occurred.
    expect(allowedEvidenceSet(projection).has("relationship:r-invented")).toBe(false);
  });

  it("P6: the observed model fake ref 'relationships - entity' remains schema-invalid", async () => {
    const projection = await buildCognitiveContextProjection(stateWithAlice(0.45));
    const checked = validateCognitionProposal({
      schema_version: "cognition-proposal-v0",
      projection_hash: projection.projection_hash,
      reasoning_summary: "observed real-model output shape",
      relevant_memory_refs: [],
      considered_context_refs: ["relationships - entity"],
      current_intent: null,
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_refs: []
    });
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_SCHEMA");
      expect(checked.error.reason).toBe("SS-SCHEMA-001");
    }
  });

  it("P7: system rules state the visible-not-citeable contract explicitly", () => {
    const rules = renderCognitiveSystemRules();
    expect(rules).toContain("CITEABLE CONTEXT REFS");
    expect(rules).toContain("Do not turn subject-state field names or labels into refs.");
    expect(rules).toContain("Do not cite a counterpart_ref merely because it appears under Relationships state.");
    expect(rules).not.toContain("trust Alice");
    expect(rules).not.toContain("prefer higher");
    expect(rules).not.toContain("ask Alice");
    expect(rules).not.toContain("choose Alice");
  });
});
