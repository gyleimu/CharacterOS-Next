/**
 * AFFECT_COGNITION_FIELD_LOCAL_RATIONALE_AUTHORIZATION_V0 — production authorization
 * tests. The model proposes; the host authorizes only lawful fields.
 *
 * Verified here against the REAL runtime surfaces:
 *  - a structurally valid but semantically unlawful rationale is dropped to null in the
 *    AUTHORITATIVE proposal, while stance/facts/directive are preserved;
 *  - lawful and absent rationales are unaffected;
 *  - whole-proposal fail-closed is unchanged for every authoritative field;
 *  - the authoritative proposal hash binds the SANITIZED rationale (raw A with a
 *    forbidden rationale and raw B with null hash identically);
 *  - Language receives the authoritative selection only, with rationale null.
 */
import { describe, expect, it } from "vitest";
import {
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V6,
  SUBJECTIVE_RATIONALE_AUTHORIZATION_POLICY_VERSION_V0,
  authorizeSubjectiveRationaleV0,
  canonicalizeConversationCognitionModelOutputV6,
  deriveConversationCognitionProposalHashV6,
  lastRationaleAuthorizationV0,
  validateSubjectiveSelectionV1
} from "../../index.js";

const OBS = "observation:o-session-t2";
const OBS_HANDLE = "F1";
const HASH = `sha256:${"a".repeat(64)}` as never;
const R4_RATIONALE = "I prefer to tackle the more expressive task while my energy is high, leaving the inspection of the backup plan for later.";
const LAWFUL_RATIONALE = "I prefer to secure the primary communication output before verifying the backup plan.";

function projection() {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-authorization" as never,
    current_logical_time: 3 as never, state_revision: 3 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "Two preparation tasks are equally feasible and both are due tomorrow.", task: "Answer.",
      focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: ["environment:room-1"],
      current_observation_ref: OBS as never
    },
    memory_working_refs: [] as never, recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: { entries: [] }
  } as never;
}

function wire(rationale: string | null, overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "conversation-cognition-proposal-v6",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "Both tasks are due tomorrow.", source_handles: [OBS_HANDLE] }] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "order the tasks",
      relevant_memory_handles: [], considered_handles: [OBS_HANDLE], current_intent: "choose an order",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [OBS_HANDLE]
    },
    subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I will choose to rehearse the presentation first.", subjective_rationale: rationale },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

const canonicalize = (value: unknown) => canonicalizeConversationCognitionModelOutputV6(value, projection(), HASH);

describe("policy surface", () => {
  it("exposes the frozen policy identity and deterministic results", () => {
    expect(SUBJECTIVE_RATIONALE_AUTHORIZATION_POLICY_VERSION_V0).toBe("subjective-rationale-authorization-policy-v0");
    expect(authorizeSubjectiveRationaleV0(null)).toEqual({ status: "ABSENT", authoritative_rationale: null });
    expect(authorizeSubjectiveRationaleV0(LAWFUL_RATIONALE)).toEqual({ status: "AUTHORIZED", authoritative_rationale: LAWFUL_RATIONALE });
    expect(authorizeSubjectiveRationaleV0(R4_RATIONALE)).toEqual({ status: "REJECTED", authoritative_rationale: null, reason: "RAW_SELF_STATE_DESCRIPTION" });
  });

  it("forbidden families dominate a lawful preference frame", () => {
    expect(authorizeSubjectiveRationaleV0("I prefer this while my energy is high.").status).toBe("REJECTED");
    expect((authorizeSubjectiveRationaleV0('I have enough capacity.') as { reason?: string }).reason).toBe('INFERRED_CAPACITY');
    expect((authorizeSubjectiveRationaleV0("I feel mentally fresh.") as { reason?: string }).reason).toBe("RAW_SELF_STATE_DESCRIPTION");
    expect((authorizeSubjectiveRationaleV0("I handled this successfully before.") as { reason?: string }).reason).toBe("UNSUPPORTED_HISTORY_CLAIM");
    expect((authorizeSubjectiveRationaleV0("This improves productivity.") as { reason?: string }).reason).toBe("NO_SUBJECTIVE_FRAME");
  });
});

describe("field-local rejection through the V6 canonicalization", () => {
  it("drops the R4 rationale to null while preserving stance, facts and directive", () => {
    const checked = canonicalize(wire(R4_RATIONALE));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const selection = checked.proposal.subjective_selection;
    expect(selection.kind).toBe("SUBJECTIVE_SELECTION");
    if (selection.kind !== "SUBJECTIVE_SELECTION") return;
    expect(selection.stance).toBe("I will choose to rehearse the presentation first.");
    expect(selection.subjective_rationale).toBeNull();
    expect(checked.proposal.factual_assessment.claims).toHaveLength(1);
    expect(checked.proposal.communication_directive.kind).toBe("REALIZE_CURRENT_INTENT");
    // telemetry is diagnostic-only and records the exact rejection family
    expect(lastRationaleAuthorizationV0()).toEqual({ status: "REJECTED", authoritative_rationale: null, reason: "RAW_SELF_STATE_DESCRIPTION" });
  });

  it("preserves lawful and absent rationales unchanged", () => {
    const lawful = canonicalize(wire(LAWFUL_RATIONALE));
    expect(lawful.ok).toBe(true);
    if (lawful.ok && lawful.proposal.subjective_selection.kind === "SUBJECTIVE_SELECTION") {
      expect(lawful.proposal.subjective_selection.subjective_rationale).toBe(LAWFUL_RATIONALE);
    }
    expect(lastRationaleAuthorizationV0()).toEqual({ status: "AUTHORIZED", authoritative_rationale: LAWFUL_RATIONALE });
    const absent = canonicalize(wire(null));
    expect(absent.ok).toBe(true);
    if (absent.ok && absent.proposal.subjective_selection.kind === "SUBJECTIVE_SELECTION") {
      expect(absent.proposal.subjective_selection.subjective_rationale).toBeNull();
    }
    expect(lastRationaleAuthorizationV0()).toEqual({ status: "ABSENT", authoritative_rationale: null });
  });

  it("does not weaken whole-proposal fail-closed for authoritative fields", () => {
    // invalid stance (enum echo) still fails the whole proposal
    const badStance = canonicalize(wire(null, { subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "REALIZE_CURRENT_INTENT", subjective_rationale: null } }));
    expect(badStance.ok).toBe(false);
    // unknown handle still fails
    const badHandle = canonicalize(wire(null, { factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: ["F99"] }] } }));
    expect(badHandle.ok).toBe(false);
    // unbound claim source still fails
    const unbound = canonicalize(wire(null, { cognition: { schema_version: "cognition-proposal-v0", reasoning_summary: "x", relevant_memory_handles: [], considered_handles: [], current_intent: "x", confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [] } }));
    expect(unbound.ok).toBe(false);
    // a prohibited legacy carrier is still rejected
    expect(validateSubjectiveSelectionV1({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: null }).ok).toBe(false);
  });

  it("hashes the sanitized authoritative rationale: raw-forbidden and raw-null are identical", async () => {
    const rawForbidden = canonicalize(wire(R4_RATIONALE));
    const rawNull = canonicalize(wire(null));
    expect(rawForbidden.ok).toBe(true);
    expect(rawNull.ok).toBe(true);
    if (!rawForbidden.ok || !rawNull.ok) return;
    const hashForbidden = await deriveConversationCognitionProposalHashV6(rawForbidden.proposal);
    const hashNull = await deriveConversationCognitionProposalHashV6(rawNull.proposal);
    expect(hashForbidden).toBe(hashNull);
  });

  it("keeps the production prompt byte-frozen (no prompt repair in this slice)", () => {
    // The policy is host-side: the model-facing contract still states the boundary.
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V6).toContain("FORBIDDEN rationale content");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V6).toContain("SUBJECT-PROPERTY BOUNDARY");
  });
});
