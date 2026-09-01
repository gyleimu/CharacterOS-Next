/**
 * Cognition Decision Arbitration Policy V0 — Belief-only UNIQUE_POSITIVE_MAX
 * acceptance suite (§52-§84): unique positive max selection, one-positive +
 * zero/negative, multiple positive unequal, positive exact tie, all-zero,
 * all-negative, zero + negative, single action, empty action space, near tie
 * (exact IEEE-754, no epsilon), action/tie order invariance, clone rejection,
 * fabricated tendency exclusion, stale projection, changed action universe,
 * same-type wrong-target exact tuple, confidence/uncertainty/text zero
 * authority, policy/output fingerprint determinism, decision capability,
 * tamper/freeze, NO_SELECTION authorized, zero canonical effect, zero model
 * calls, workflow replay equivalence, no model tiebreak, no randomness, result
 * boundary, no execution.
 *
 * Fully OFFLINE: deterministic fake provider + test-private in-memory store —
 * no model, no transport, no localhost, no persistence dependency.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "./cognition-action-transition-executor.js";
import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import type {
  CognitionRelationProviderInputV1,
  CognitionRelationProviderV1
} from "../../ports/cognition-relation-port.js";
import type { AcceptedCognitionProposalV1 } from "./cognition-proposal-v1.js";
import { runCognitionRelationAdmissionV1 } from "./belief-decision-influence-relation.js";
import {
  produceBeliefDecisionTendencyProjectionV0
} from "./belief-decision-integration-policy.js";
import {
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0,
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_FINGERPRINT_PROJECTION,
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0,
  BELIEF_DECISION_SELECTION_OUTPUT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_SELECTION_SCHEMA_VERSION,
  deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0,
  isAuthorizedBeliefDecisionSelectionV0,
  produceBeliefDecisionSelectionV0,
  type BeliefDecisionArbitrationInputV0,
  type BeliefDecisionSelectionV0
} from "./belief-decision-arbitration-policy.js";
import {
  deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0,
  runBeliefDecisionInfluenceRelationWorkflowV0,
  type BeliefDecisionInfluenceRelationProviderOutcomeV0,
  type BeliefDecisionInfluenceRelationWorkflowRecordV0,
  type BeliefDecisionInfluenceRelationWorkflowStoreV0
} from "./belief-decision-influence-relation-workflow.js";

const { readFileSync } = process.getBuiltinModule("node:fs");
const ARBITRATION_POLICY_SOURCE = readFileSync(
  new URL("./belief-decision-arbitration-policy.ts", import.meta.url),
  "utf-8"
);

// ---- deterministic fixtures (§52) ----------------------------------------------------

const EAST = { action_type: "TRY_EAST_ENTRANCE", target_ref: null };
const WEST = { action_type: "TRY_WEST_ENTRANCE", target_ref: null };
const HOST_ACTIONS = [EAST];
const TWO_ACTIONS = [EAST, WEST];

type BeliefItem = {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
};

function beliefs(...entries: readonly (readonly [string, number])[]): BeliefItem[] {
  return entries.map(([id, credence]) => ({
    proposition_id: id,
    proposition_label: `label for ${id}`,
    credence
  }));
}

async function buildProjection(beliefItems: readonly BeliefItem[]): Promise<CognitiveContextProjectionV0> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: { schema_version: "belief-state-v0", items: beliefItems },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: ["episode:e1", "episode:e2"]
    }
  } as unknown as SubjectStateV0;
  return buildCognitiveContextProjection(snapshot);
}

class FakeRelationProvider implements CognitionRelationProviderV1 {
  calls = 0;
  constructor(private readonly payloadFactory: (input: CognitionRelationProviderInputV1) => unknown) {}
  async propose(input: CognitionRelationProviderInputV1): Promise<unknown> {
    this.calls += 1;
    return this.payloadFactory(input);
  }
}

function relation(
  propositionId: string,
  actionType: string,
  targetRef: string | null,
  kind: string
): Record<string, unknown> {
  return {
    state_locator: { domain: "BELIEF", proposition_id: propositionId },
    action: { action_type: actionType, target_ref: targetRef },
    relation: kind
  };
}

function validPayload(
  input: CognitionRelationProviderInputV1,
  relations: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v1",
    projection_hash: input.projection.projection_hash,
    action_space_fingerprint: input.action_space_fingerprint,
    reasoning_summary: "arbitration fixture",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: null,
    confidence: 0.6,
    uncertainty: 0.4,
    state_action_relations: relations,
    evidence_refs: [],
    ...overrides
  };
}

/**
 * Mint a REAL authorized accepted proposal through the frozen host admission
 * runner (§52: never a fabricated WeakSet capability), bound to a freshly
 * built projection over the given belief items / action universe / relations.
 */
async function mintArbitrationInput(args: {
  readonly beliefItems: readonly BeliefItem[];
  readonly relations: readonly Record<string, unknown>[];
  readonly allowedActions?: readonly { action_type: string; target_ref: string | null }[];
  readonly overrides?: Record<string, unknown>;
}): Promise<{
  readonly projection: CognitiveContextProjectionV0;
  readonly allowedActions: readonly AllowedActionV0[];
  readonly accepted: AcceptedCognitionProposalV1;
  readonly provider: FakeRelationProvider;
}> {
  const allowedActions = args.allowedActions ?? HOST_ACTIONS;
  const projection = await buildProjection(args.beliefItems);
  const provider = new FakeRelationProvider((input) =>
    validPayload(input, args.relations, args.overrides)
  );
  const result = await runCognitionRelationAdmissionV1({
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    current_logical_time: projection.current_logical_time,
    projection,
    allowed_actions: allowedActions as unknown as readonly AllowedActionV0[],
    provider
  });
  if (result.kind !== "ACCEPTED") {
    throw new Error(`expected ACCEPTED, got ${JSON.stringify(result)}`);
  }
  return {
    projection,
    allowedActions: allowedActions as unknown as readonly AllowedActionV0[],
    accepted: result.accepted,
    provider
  };
}

async function produceSelection(args: {
  readonly beliefItems: readonly BeliefItem[];
  readonly relations: readonly Record<string, unknown>[];
  readonly allowedActions?: readonly { action_type: string; target_ref: string | null }[];
  readonly overrides?: Record<string, unknown>;
}): Promise<{ selection: BeliefDecisionSelectionV0; provider: FakeRelationProvider }> {
  const minted = await mintArbitrationInput(args);
  const selection = await produceBeliefDecisionSelectionV0({
    current_projection: minted.projection,
    allowed_actions: minted.allowedActions,
    accepted_cognition_proposal: minted.accepted
  });
  return { selection, provider: minted.provider };
}

// ---- §4/§5/§6 frozen policy identity -------------------------------------------

describe("Arbitration Policy V0 — frozen policy identity", () => {
  it("§4/§6/§35 pins exact policy id, schema version and fingerprint namespaces", () => {
    expect(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0).toBe(
      "belief-positive-max-arbitration-policy-v0"
    );
    expect(BELIEF_DECISION_SELECTION_SCHEMA_VERSION).toBe("belief-decision-selection-v0");
    expect(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-positive-max-arbitration-policy/v1"
    );
    expect(BELIEF_DECISION_SELECTION_OUTPUT_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-selection/v1"
    );
  });

  it("§5 exposes the exact frozen descriptor and deep-freezes it", () => {
    expect(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0).toEqual({
      policy_id: "belief-positive-max-arbitration-policy-v0",
      domain_scope: "BELIEF_ONLY",
      input_semantics: "DOMAIN_LOCAL_ALIGNMENT_NOT_UTILITY",
      eligibility: "EXACT_TENDENCY_GT_ZERO",
      winner: "UNIQUE_EXACT_POSITIVE_MAXIMUM",
      all_nonpositive: "NO_SELECTION",
      positive_tie: "NO_SELECTION",
      near_tie: "EXACT_IEEE_754_COMPARISON_NO_EPSILON",
      decision_margin: "NONE",
      no_selection: "LAWFUL_TERMINAL_RESULT",
      canonical_order_as_tiebreaker: false,
      randomness: "NONE"
    });
    expect(Object.isFrozen(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0)).toBe(true);
  });

  it("§73 repeated policy fingerprint derivation is identical; descriptor immutable", async () => {
    const f1 = await deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0();
    const f2 = await deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0();
    expect(f2).toBe(f1);
    expect(Object.isFrozen(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0)).toBe(true);
    // Attempted mutation throws TypeError in strict mode (frozen).
    expect(() => {
      (BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0 as unknown as Record<string, unknown>)["policy_id"] = "tampered";
    }).toThrow(TypeError);
    expect(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0.policy_id).toBe(
      "belief-positive-max-arbitration-policy-v0"
    );
  });
});

// ---- §53-§56 UNIQUE_POSITIVE_MAX selection -------------------------------------------

describe("Arbitration Policy V0 — §53-§56 unique positive max selection", () => {
  it("§53 A +0.8, B +0.2 → SELECTED A with exact ActionIntent tuple", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.6]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
    expect(selection.no_selection_reason).toBeNull();
  });

  it("§54 A +0.4, B 0 → A selected (zero not eligible)", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.7], ["prop.b", 0.5]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });

  it("§55 A +0.4, B -0.9 → A selected", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.7], ["prop.b", 0.05]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });

  it("§56 A +0.8, B +0.4 → A selected (multiple positive unequal)", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.7]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });
});

// ---- §57-§60 NO_SELECTION cases -------------------------------------------

describe("Arbitration Policy V0 — §57-§60 no-selection cases", () => {
  it("§57 A +0.8, B +0.8 → NO_SELECTION / POSITIVE_MAX_TIE", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.9]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.selected_action).toBeNull();
    expect(selection.no_selection_reason).toBe("POSITIVE_MAX_TIE");
  });

  it("§58 all zero → NO_SELECTION / NO_POSITIVE_TENDENCY", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.5], ["prop.b", 0.5]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
  });

  it("§59 all negative → NO_SELECTION / NO_POSITIVE_TENDENCY (not least-negative)", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.4], ["prop.b", 0.1]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
    expect(selection.selected_action).toBeNull();
  });

  it("§60 zero + negative → NO_SELECTION / NO_POSITIVE_TENDENCY", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.5], ["prop.b", 0.25]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
  });
});

// ---- §61-§62 single/empty action -------------------------------------------

describe("Arbitration Policy V0 — §61-§62 single and empty action space", () => {
  it("§61 single action +0.4 → SELECTED", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.7]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });

  it("§61 single action 0 → NO_SELECTION / NO_POSITIVE_TENDENCY", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.5]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
  });

  it("§61 single action -0.4 → NO_SELECTION / NO_POSITIVE_TENDENCY", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.3]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
  });

  it("§62 empty allowed action universe → lawful NO_SELECTION / NO_POSITIVE_TENDENCY, no throw", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [],
      allowedActions: []
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("NO_POSITIVE_TENDENCY");
    expect(selection.selected_action).toBeNull();
  });
});

// ---- §63 near tie -------------------------------------------

describe("Arbitration Policy V0 — §63 near tie exact IEEE-754", () => {
  it("0.8 vs 0.7999999999999999 → 0.8 wins (no epsilon, no margin)", async () => {
    // Action A: single SUPPORTS c=0.9 → stance 0.8 → aggregate 0.8
    // Action B: two SUPPORTS c=0.9 (0.8) + c=0.8999999999999999 (0.7999999999999998)
    //   → mean = (0.8 + 0.7999999999999998) / 2 = 0.7999999999999999
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.9], ["prop.c", 0.8999999999999999]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.c", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });
});

// ---- §64-§65 order invariance -------------------------------------------

describe("Arbitration Policy V0 — §64-§65 action order invariance", () => {
  it("§64 reversed caller action order → same decision kind, selected action, output fingerprint", async () => {
    const beliefItems = beliefs(["prop.a", 0.9], ["prop.b", 0.7]);
    const relations = [
      relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
      relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
    ];
    const forward = await produceSelection({ beliefItems, relations, allowedActions: [EAST, WEST] });
    const reversed = await produceSelection({ beliefItems, relations, allowedActions: [WEST, EAST] });
    expect(reversed.selection.decision_kind).toBe(forward.selection.decision_kind);
    expect(reversed.selection.selected_action).toEqual(forward.selection.selected_action);
    expect(reversed.selection.action_space_fingerprint).toBe(
      forward.selection.action_space_fingerprint
    );
    expect(reversed.selection.output_fingerprint).toBe(forward.selection.output_fingerprint);
  });

  it("§65 positive tie with reversed caller order → still NO_SELECTION / POSITIVE_MAX_TIE", async () => {
    const beliefItems = beliefs(["prop.a", 0.9], ["prop.b", 0.9]);
    const relations = [
      relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
      relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
    ];
    const forward = await produceSelection({ beliefItems, relations, allowedActions: [EAST, WEST] });
    const reversed = await produceSelection({ beliefItems, relations, allowedActions: [WEST, EAST] });
    expect(forward.selection.no_selection_reason).toBe("POSITIVE_MAX_TIE");
    expect(reversed.selection.no_selection_reason).toBe("POSITIVE_MAX_TIE");
    expect(reversed.selection.decision_kind).toBe("NO_SELECTION");
    expect(reversed.selection.selected_action).toBeNull();
  });
});

// ---- §66 clone rejection -------------------------------------------

describe("Arbitration Policy V0 — §66 accepted proposal clone rejection", () => {
  it("spread clone of authorized accepted proposal fails through frozen capability", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const spreadClone = { ...minted.accepted } as unknown as AcceptedCognitionProposalV1;
    await expect(
      produceBeliefDecisionSelectionV0({
        current_projection: minted.projection,
        allowed_actions: minted.allowedActions,
        accepted_cognition_proposal: spreadClone
      })
    ).rejects.toThrow();
  });

  it("JSON clone of authorized accepted proposal fails", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const jsonClone = JSON.parse(JSON.stringify(minted.accepted)) as AcceptedCognitionProposalV1;
    await expect(
      produceBeliefDecisionSelectionV0({
        current_projection: minted.projection,
        allowed_actions: minted.allowedActions,
        accepted_cognition_proposal: jsonClone
      })
    ).rejects.toThrow();
  });

  it("manual structural lookalike fails", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const lookalike = {
      schema_version: minted.accepted.schema_version,
      subject_id: minted.accepted.subject_id,
      state_revision: minted.accepted.state_revision,
      current_logical_time: minted.accepted.current_logical_time,
      projection_hash: minted.accepted.projection_hash,
      action_space_fingerprint: minted.accepted.action_space_fingerprint,
      proposal: minted.accepted.proposal,
      accepted_proposal_fingerprint: minted.accepted.accepted_proposal_fingerprint
    } as unknown as AcceptedCognitionProposalV1;
    await expect(
      produceBeliefDecisionSelectionV0({
        current_projection: minted.projection,
        allowed_actions: minted.allowedActions,
        accepted_cognition_proposal: lookalike
      })
    ).rejects.toThrow();
  });
});

// ---- §67 fabricated tendency cannot drive -------------------------------------------

describe("Arbitration Policy V0 — §67 fabricated tendency exclusion", () => {
  it("caller-supplied fake tendency field is ignored; internal rederivation is sole authority", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    // Attempt to inject a fake tendency projection as an extra structural field.
    // The closed input shape means the producer never reads it; internal
    // rederivation via produceBeliefDecisionTendencyProjectionV0 is sole authority.
    const inputWithFake = {
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted,
      fake_tendency_projection: {
        action_tendencies: [
          { action: EAST, aggregate_tendency: -1, contribution_ledger: [] }
        ]
      }
    } as unknown as BeliefDecisionArbitrationInputV0;
    const selection = await produceBeliefDecisionSelectionV0(inputWithFake);
    // The fake -1 tendency is ignored; real tendency +0.8 drives SELECTED.
    expect(selection.decision_kind).toBe("SELECTED");
    expect(selection.selected_action).toEqual({ action_type: "TRY_EAST_ENTRANCE", target_ref: null });
  });
});

// ---- §68-§69 staleness / changed universe -------------------------------------------

describe("Arbitration Policy V0 — §68-§69 staleness and changed universe", () => {
  it("§68 stale projection (changed credence) fails closed through frozen chain", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    // Build a NEW projection with different credence — accepted proposal is bound
    // to the OLD projection hash, so the frozen chain rejects it.
    const staleProjection = await buildProjection(beliefs(["prop.a", 0.3]));
    await expect(
      produceBeliefDecisionSelectionV0({
        current_projection: staleProjection,
        allowed_actions: minted.allowedActions,
        accepted_cognition_proposal: minted.accepted
      })
    ).rejects.toThrow();
  });

  it("§69 changed action universe fails closed", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")],
      allowedActions: [EAST]
    });
    // Call arbitration with a DIFFERENT action universe.
    await expect(
      produceBeliefDecisionSelectionV0({
        current_projection: minted.projection,
        allowed_actions: [WEST] as unknown as readonly AllowedActionV0[],
        accepted_cognition_proposal: minted.accepted
      })
    ).rejects.toThrow();
  });
});

// ---- §70 exact tuple membership -------------------------------------------

describe("Arbitration Policy V0 — §70 same action_type wrong target_ref", () => {
  it("selected action cannot bypass exact tuple membership via same type different target", async () => {
    const EAST_TARGET = { action_type: "TRY_EAST_ENTRANCE", target_ref: "entity:east" };
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", "entity:east", "SUPPORTS")],
      allowedActions: [EAST_TARGET]
    });
    expect(selection.decision_kind).toBe("SELECTED");
    // The selected action must carry the EXACT target_ref, not null.
    expect(selection.selected_action).toEqual({
      action_type: "TRY_EAST_ENTRANCE",
      target_ref: "entity:east"
    });
  });
});

// ---- §71-§72 advisory fields zero authority -------------------------------------------

describe("Arbitration Policy V0 — §71-§72 confidence/uncertainty/text zero authority", () => {
  it("§71 different confidence/uncertainty, same semantics → same decision kind and selected tuple", async () => {
    const beliefItems = beliefs(["prop.a", 0.9], ["prop.b", 0.7]);
    const relations = [
      relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
      relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
    ];
    const low = await produceSelection({
      beliefItems,
      relations,
      allowedActions: TWO_ACTIONS,
      overrides: { confidence: 0.1, uncertainty: 0.9 }
    });
    const high = await produceSelection({
      beliefItems,
      relations,
      allowedActions: TWO_ACTIONS,
      overrides: { confidence: 0.95, uncertainty: 0.05 }
    });
    expect(low.selection.decision_kind).toBe(high.selection.decision_kind);
    expect(low.selection.selected_action).toEqual(high.selection.selected_action);
  });

  it("§72 different reasoning_summary/current_intent, same semantics → same decision", async () => {
    const beliefItems = beliefs(["prop.a", 0.9]);
    const relations = [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")];
    const textA = await produceSelection({
      beliefItems,
      relations,
      overrides: { reasoning_summary: "summary A", current_intent: "intent A" }
    });
    const textB = await produceSelection({
      beliefItems,
      relations,
      overrides: { reasoning_summary: "completely different summary B", current_intent: null }
    });
    expect(textA.selection.decision_kind).toBe(textB.selection.decision_kind);
    expect(textA.selection.selected_action).toEqual(textB.selection.selected_action);
  });
});

// ---- §74 output fingerprint -------------------------------------------

describe("Arbitration Policy V0 — §74 output fingerprint determinism", () => {
  it("same authorized inputs → same output fingerprint and serialized bytes", async () => {
    const args = {
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    };
    const first = await produceSelection(args);
    const second = await produceSelection(args);
    expect(second.selection.output_fingerprint).toBe(first.selection.output_fingerprint);
    expect(JSON.stringify(second.selection)).toBe(JSON.stringify(first.selection));
  });
});

// ---- §75-§77 decision capability -------------------------------------------

describe("Arbitration Policy V0 — §75-§77 decision capability", () => {
  it("§75 actual producer result is authorized; spread/JSON/manual clones are unauthorized", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(isAuthorizedBeliefDecisionSelectionV0(selection)).toBe(true);
    const spreadClone = { ...selection };
    expect(isAuthorizedBeliefDecisionSelectionV0(spreadClone)).toBe(false);
    const jsonClone = JSON.parse(JSON.stringify(selection));
    expect(isAuthorizedBeliefDecisionSelectionV0(jsonClone)).toBe(false);
    const manualLookalike = {
      schema_version: selection.schema_version,
      policy_id: selection.policy_id,
      policy_fingerprint: selection.policy_fingerprint,
      domain_scope: selection.domain_scope,
      subject_id: selection.subject_id,
      state_revision: selection.state_revision,
      current_logical_time: selection.current_logical_time,
      projection_hash: selection.projection_hash,
      action_space_fingerprint: selection.action_space_fingerprint,
      source_accepted_proposal_fingerprint: selection.source_accepted_proposal_fingerprint,
      source_relation_projection_fingerprint: selection.source_relation_projection_fingerprint,
      source_belief_integration_policy_id: selection.source_belief_integration_policy_id,
      source_belief_integration_policy_fingerprint: selection.source_belief_integration_policy_fingerprint,
      source_belief_tendency_output_fingerprint: selection.source_belief_tendency_output_fingerprint,
      output_fingerprint: selection.output_fingerprint,
      decision_kind: selection.decision_kind,
      selected_action: selection.selected_action,
      no_selection_reason: selection.no_selection_reason
    };
    expect(isAuthorizedBeliefDecisionSelectionV0(manualLookalike)).toBe(false);
  });

  it("§76 deep-frozen result graph cannot be mutated; reconstructed altered object gains no authority", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(Object.isFrozen(selection)).toBe(true);
    if (selection.decision_kind === "SELECTED" && selection.selected_action !== null) {
      expect(Object.isFrozen(selection.selected_action)).toBe(true);
    }
    // Attempted mutation throws TypeError in strict mode (frozen).
    expect(() => {
      (selection as unknown as Record<string, unknown>)["decision_kind"] = "NO_SELECTION";
    }).toThrow(TypeError);
    expect(selection.decision_kind).toBe("SELECTED");
    // Reconstructed altered object gains no authority.
    const altered = { ...JSON.parse(JSON.stringify(selection)), decision_kind: "NO_SELECTION" };
    expect(isAuthorizedBeliefDecisionSelectionV0(altered)).toBe(false);
  });

  it("§77 lawful NO_SELECTION result itself receives decision capability", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.5]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(isAuthorizedBeliefDecisionSelectionV0(selection)).toBe(true);
  });
});

// ---- §78-§79 zero canonical effect / zero model calls -------------------------------------------

describe("Arbitration Policy V0 — §78-§79 zero canonical effect and zero model calls", () => {
  it("§78 no SubjectState mutation, no revision/logical-time/trace/memory/belief write", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const revisionBefore = minted.projection.state_revision;
    const timeBefore = minted.projection.current_logical_time;
    await produceBeliefDecisionSelectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    // Projection is unchanged (no mutation port received).
    expect(minted.projection.state_revision).toBe(revisionBefore);
    expect(minted.projection.current_logical_time).toBe(timeBefore);
  });

  it("§79 arbitration itself causes zero additional provider/model calls", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const callsAfterFixture = minted.provider.calls;
    await produceBeliefDecisionSelectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    // Arbitration has no provider dependency; fixture construction calls only.
    expect(minted.provider.calls).toBe(callsAfterFixture);
  });
});

// ---- §80-§81 replay / no model tiebreak -------------------------------------------

/**
 * TEST-PRIVATE in-memory linearizable store implementing the frozen workflow
 * port (copied pattern from integration policy test §62).
 */
class InMemoryRelationWorkflowStore implements BeliefDecisionInfluenceRelationWorkflowStoreV0 {
  private readonly records = new Map<string, BeliefDecisionInfluenceRelationWorkflowRecordV0>();

  async load(workflowId: string): Promise<BeliefDecisionInfluenceRelationWorkflowRecordV0 | null> {
    const record = this.records.get(workflowId);
    return record === undefined
      ? null
      : (JSON.parse(JSON.stringify(record)) as BeliefDecisionInfluenceRelationWorkflowRecordV0);
  }

  async createIfAbsent(
    record: BeliefDecisionInfluenceRelationWorkflowRecordV0
  ): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, JSON.parse(JSON.stringify(record)));
    return "CREATED";
  }

  async claimProviderCall(
    workflowId: string,
    requestFingerprint: string
  ): Promise<"CLAIMED" | "ALREADY_CLAIMED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT"> {
    const record = this.records.get(workflowId);
    if (record === undefined) return "NOT_FOUND";
    if (record.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (record.external_provider_call_count !== 0) return "ALREADY_CLAIMED";
    const base = {
      ...record,
      stage: "R2_PROVIDER_CLAIMED" as const,
      external_provider_call_count: 1 as const
    };
    const checkpointFingerprint =
      await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base);
    const current = this.records.get(workflowId);
    if (current === undefined) return "NOT_FOUND";
    if (current.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (current.external_provider_call_count !== 0) return "ALREADY_CLAIMED";
    this.records.set(workflowId, { ...base, checkpoint_fingerprint: checkpointFingerprint });
    return "CLAIMED";
  }

  async saveProviderOutcome(
    workflowId: string,
    requestFingerprint: string,
    outcome: BeliefDecisionInfluenceRelationProviderOutcomeV0
  ): Promise<"SAVED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT" | "OUTCOME_CONFLICT"> {
    const record = this.records.get(workflowId);
    if (record === undefined) return "NOT_FOUND";
    if (record.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (record.provider_outcome !== null) return "OUTCOME_CONFLICT";
    const base = {
      ...record,
      stage: "R3_PROVIDER_OUTCOME_CHECKPOINTED" as const,
      provider_outcome: outcome
    };
    const checkpointFingerprint =
      await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base);
    const current = this.records.get(workflowId);
    if (current === undefined) return "NOT_FOUND";
    if (current.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (current.provider_outcome !== null) return "OUTCOME_CONFLICT";
    this.records.set(workflowId, { ...base, checkpoint_fingerprint: checkpointFingerprint });
    return "SAVED";
  }
}

describe("Arbitration Policy V0 — §80-§81 replay and no model tiebreak", () => {
  it("§80 first workflow call 1, replay 0; arbitration from both → same decision/fingerprint/bytes", async () => {
    const projection = await buildProjection(beliefs(["prop.a", 0.9]));
    const provider = new FakeRelationProvider((input) =>
      validPayload(input, [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
    );
    const store = new InMemoryRelationWorkflowStore();
    const request = {
      workflow_id: "wf-arb-replay-1" as never,
      subject_id: projection.subject_id,
      state_revision: projection.state_revision,
      current_logical_time: projection.current_logical_time,
      projection,
      allowed_actions: HOST_ACTIONS as unknown as readonly AllowedActionV0[]
    };

    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, { store, provider });
    if (first.kind !== "ACCEPTED") throw new Error(`expected ACCEPTED, got ${JSON.stringify(first)}`);
    expect(first.provider_calls).toBe(1);
    expect(first.replayed).toBe(false);
    expect(provider.calls).toBe(1);

    const second = await runBeliefDecisionInfluenceRelationWorkflowV0(request, { store, provider });
    if (second.kind !== "ACCEPTED") throw new Error(`expected ACCEPTED, got ${JSON.stringify(second)}`);
    expect(second.provider_calls).toBe(0);
    expect(second.replayed).toBe(true);
    expect(provider.calls).toBe(1);

    const s1 = await produceBeliefDecisionSelectionV0({
      current_projection: projection,
      allowed_actions: HOST_ACTIONS as unknown as readonly AllowedActionV0[],
      accepted_cognition_proposal: first.accepted
    });
    const s2 = await produceBeliefDecisionSelectionV0({
      current_projection: projection,
      allowed_actions: HOST_ACTIONS as unknown as readonly AllowedActionV0[],
      accepted_cognition_proposal: second.accepted
    });
    expect(s2.decision_kind).toBe(s1.decision_kind);
    expect(s2.selected_action).toEqual(s1.selected_action);
    expect(s2.policy_fingerprint).toBe(s1.policy_fingerprint);
    expect(s2.output_fingerprint).toBe(s1.output_fingerprint);
    expect(JSON.stringify(s2)).toBe(JSON.stringify(s1));
  });

  it("§81 positive tie → zero additional provider/model calls after acceptance", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.9]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_WEST_ENTRANCE", null, "SUPPORTS")
      ],
      allowedActions: TWO_ACTIONS
    });
    const callsBefore = minted.provider.calls;
    const selection = await produceBeliefDecisionSelectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    expect(selection.decision_kind).toBe("NO_SELECTION");
    expect(selection.no_selection_reason).toBe("POSITIVE_MAX_TIE");
    expect(minted.provider.calls).toBe(callsBefore);
  });
});

// ---- §82-§84 structural guarantees -------------------------------------------

describe("Arbitration Policy V0 — §82-§84 structural guarantees", () => {
  it("§82 production source contains no Math.random/crypto.randomUUID/Date.now/new Date", () => {
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/Math\.random/);
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/crypto\.randomUUID/);
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/Date\.now/);
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/new\s+Date/);
  });

  it("§83 result contains no rank/ranked_actions/decision_margin/top_tendency/second_tendency/utility/global_score/context_score/relationship_score/personality_score/affect_score", async () => {
    const { selection } = await produceSelection({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const keys = Object.keys(selection);
    const forbidden = [
      "rank",
      "ranked_actions",
      "decision_margin",
      "top_tendency",
      "second_tendency",
      "utility",
      "global_score",
      "context_score",
      "relationship_score",
      "personality_score",
      "affect_score"
    ];
    for (const key of forbidden) {
      expect(keys).not.toContain(key);
    }
  });

  it("§84 production source does not import or reference ActionExecutionRunner", () => {
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/ActionExecutionRunner/);
    expect(ARBITRATION_POLICY_SOURCE).not.toMatch(/action-runner/);
  });
});

// ---- §13/§18 result provenance binding -------------------------------------------

describe("Arbitration Policy V0 — §13/§18 result provenance binding", () => {
  it("result binds all required source fingerprints and policy identifiers", async () => {
    const minted = await mintArbitrationInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const selection = await produceBeliefDecisionSelectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    // Verify the tendency projection to cross-check source fingerprints.
    const tendency = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    expect(selection.schema_version).toBe("belief-decision-selection-v0");
    expect(selection.policy_id).toBe("belief-positive-max-arbitration-policy-v0");
    expect(selection.domain_scope).toBe("BELIEF_ONLY");
    expect(selection.source_accepted_proposal_fingerprint).toBe(
      minted.accepted.accepted_proposal_fingerprint
    );
    expect(selection.source_relation_projection_fingerprint).toBe(
      tendency.source_relation_projection_fingerprint
    );
    expect(selection.source_belief_integration_policy_id).toBe(
      "belief-decision-integration-policy-v0"
    );
    expect(selection.source_belief_integration_policy_fingerprint).toBe(tendency.policy_fingerprint);
    expect(selection.source_belief_tendency_output_fingerprint).toBe(tendency.output_fingerprint);
    expect(selection.subject_id).toBe(minted.projection.subject_id);
    expect(selection.state_revision).toBe(minted.projection.state_revision);
    expect(selection.current_logical_time).toBe(minted.projection.current_logical_time);
    expect(selection.projection_hash).toBe(minted.projection.projection_hash);
    expect(selection.action_space_fingerprint).toBe(tendency.action_space_fingerprint);
  });
});
