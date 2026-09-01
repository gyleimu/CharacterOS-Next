/**
 * Belief Decision Integration Policy V0 — deterministic numeric tendency
 * acceptance suite (§38-§63): stance(c)=2c-1 extreme table, 0.1/0.9 inversion,
 * monotonicity, polarity symmetry, negative-zero normalization, empty
 * directional set, IRRELEVANT no-dilution, count amplification, conflict
 * cancellation, exact IEEE-754 mixed mean, action/relation order invariance,
 * unrelated-action independence, confidence/uncertainty/text zero numeric
 * authority, stale/wrong-universe fail-closed, capability clone rejection,
 * fabricated-relation authority absence, policy/output fingerprint determinism,
 * all-actions-present, zero canonical effect, workflow replay equivalence and
 * ZERO real model calls.
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
import {
  CognitionRelationRejectionErrorV1,
  type AcceptedCognitionProposalV1
} from "./cognition-proposal-v1.js";
import {
  runCognitionRelationAdmissionV1,
  type CognitionRelationAdmissionResultV1
} from "./belief-decision-influence-relation.js";
import {
  BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0,
  BELIEF_DECISION_INTEGRATION_POLICY_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
  BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION,
  BeliefDecisionIntegrationPolicyErrorV0,
  deriveBeliefDecisionIntegrationPolicyFingerprintV0,
  produceBeliefDecisionTendencyProjectionV0,
  type BeliefDecisionRelationContributionV0,
  type BeliefDecisionTendencyProjectionV0
} from "./belief-decision-integration-policy.js";
import {
  deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0,
  runBeliefDecisionInfluenceRelationWorkflowV0,
  type BeliefDecisionInfluenceRelationProviderOutcomeV0,
  type BeliefDecisionInfluenceRelationWorkflowRecordV0,
  type BeliefDecisionInfluenceRelationWorkflowStoreV0
} from "./belief-decision-influence-relation-workflow.js";

// ---- deterministic fixtures ----------------------------------------------------

const EAST = { action_type: "TRY_EAST_ENTRANCE", target_ref: null };
const HOST_ACTIONS = [EAST];

type BeliefItem = {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
};

/** Build belief items from compact [proposition_id, credence] tuples. */
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

/** Deterministic fake provider: payload is a pure function of the host input. */
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
    reasoning_summary: "policy fixture",
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
 * runner (never a fabricated WeakSet capability — §38), bound to a freshly
 * built projection over the given belief items / action universe / relations.
 */
async function mintTendencyInput(args: {
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
  const result: CognitionRelationAdmissionResultV1 = await runCognitionRelationAdmissionV1({
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

async function produceTendency(args: {
  readonly beliefItems: readonly BeliefItem[];
  readonly relations: readonly Record<string, unknown>[];
  readonly allowedActions?: readonly { action_type: string; target_ref: string | null }[];
  readonly overrides?: Record<string, unknown>;
}): Promise<BeliefDecisionTendencyProjectionV0> {
  const minted = await mintTendencyInput(args);
  return produceBeliefDecisionTendencyProjectionV0({
    current_projection: minted.projection,
    allowed_actions: minted.allowedActions,
    accepted_cognition_proposal: minted.accepted
  });
}

function tendencyFor(
  projection: BeliefDecisionTendencyProjectionV0,
  actionType: string,
  targetRef: string | null = null
): BeliefDecisionTendencyProjectionV0["action_tendencies"][number] {
  const found = projection.action_tendencies.find(
    (t) => t.action.action_type === actionType && t.action.target_ref === targetRef
  );
  if (found === undefined) throw new Error(`no tendency for ${actionType}`);
  return found;
}

/** Guarded first ledger entry (test-only; keeps noUncheckedIndexedAccess happy). */
function firstEntry(
  projection: BeliefDecisionTendencyProjectionV0,
  actionType: string,
  targetRef: string | null = null
): BeliefDecisionRelationContributionV0 {
  const entry = tendencyFor(projection, actionType, targetRef).contribution_ledger[0];
  if (entry === undefined) throw new Error(`expected a ledger entry for ${actionType}`);
  return entry;
}

// ---- §4/§5/§33 frozen policy identity -------------------------------------------

describe("Integration Policy V0 — frozen policy identity", () => {
  it("§4/§5/§33 pins exact policy id, schema version and fingerprint namespaces", () => {
    expect(BELIEF_DECISION_INTEGRATION_POLICY_ID_V0).toBe("belief-decision-integration-policy-v0");
    expect(BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION).toBe(
      "belief-decision-tendency-projection-v0"
    );
    expect(BELIEF_DECISION_INTEGRATION_POLICY_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-integration-policy/v1"
    );
    expect(BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-tendency-projection/v1"
    );
  });

  it("§5 exposes the exact frozen descriptor and deep-freezes it", () => {
    expect(BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0).toEqual({
      policy_id: "belief-decision-integration-policy-v0",
      credence_semantics: "SUBJECTIVE_ENDORSEMENT_BIPOLAR_AXIS",
      neutral_point: 0.5,
      stance_transform: "CENTERED_LINEAR_2C_MINUS_1",
      stance_range: { minimum: -1, maximum: 1 },
      relation_polarity: { SUPPORTS: 1, OPPOSES: -1, IRRELEVANT: 0 },
      negative_stance_relation_inversion: true,
      aggregation: "DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO",
      arithmetic:
        "IEEE_754_CANONICAL_SEQUENTIAL_SUM_SINGLE_DIVIDE_NO_ROUND_NO_EPSILON_NO_CLAMP_NORMALIZE_NEGATIVE_ZERO_VALIDATE_JCS"
    });
    expect(Object.isFrozen(BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0)).toBe(true);
    expect(Object.isFrozen(BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0.relation_polarity)).toBe(
      true
    );
    expect(Object.isFrozen(BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0.stance_range)).toBe(true);
  });
});

// ---- §39 extreme table -------------------------------------------------------------

describe("Integration Policy V0 — §39 extreme stance/contribution table", () => {
  const table: Record<number, { SUPPORTS: number; OPPOSES: number; IRRELEVANT: number }> = {
    0: { SUPPORTS: -1, OPPOSES: 1, IRRELEVANT: 0 },
    0.5: { SUPPORTS: 0, OPPOSES: 0, IRRELEVANT: 0 },
    1: { SUPPORTS: 1, OPPOSES: -1, IRRELEVANT: 0 }
  };

  for (const credence of [0, 0.5, 1]) {
    for (const kind of ["SUPPORTS", "OPPOSES", "IRRELEVANT"] as const) {
      it(`credence ${credence} × ${kind}`, async () => {
        const row = table[credence];
        if (row === undefined) throw new Error("unreachable table row");
        const expectedContribution = row[kind];
        const projection = await produceTendency({
          beliefItems: beliefs(["prop.a", credence]),
          relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, kind)]
        });
        const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
        expect(tendency.contribution_ledger).toHaveLength(1);
        const entry = firstEntry(projection, "TRY_EAST_ENTRANCE");
        expect(entry.relation).toBe(kind);
        expect(entry.canonical_credence).toBe(credence);
        // stance always reflects credence: 2c-1 (normalized).
        expect(entry.stance as number).toBe(credence === 0.5 ? 0 : 2 * credence - 1);
        expect(entry.signed_contribution as number).toBe(expectedContribution);
        expect(Object.is(entry.signed_contribution as number, -0)).toBe(false);
        // aggregate: IRRELEVANT → empty directional set → +0; else the single contribution.
        const expectedAggregate = kind === "IRRELEVANT" ? 0 : expectedContribution;
        expect(tendency.aggregate_tendency as number).toBe(expectedAggregate);
        expect(Object.is(tendency.aggregate_tendency as number, -0)).toBe(false);
      });
    }
  }
});

// ---- §40 0.1 / 0.9 inversion ---------------------------------------------------------

describe("Integration Policy V0 — §40 low/high credence inversion", () => {
  it("SUPPORTS 0.1 contribution is the exact negative of SUPPORTS 0.9", async () => {
    const low = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.1]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const high = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const lowC = firstEntry(low, "TRY_EAST_ENTRANCE").signed_contribution as number;
    const highC = firstEntry(high, "TRY_EAST_ENTRANCE").signed_contribution as number;
    expect(highC).toBe(0.8);
    expect(lowC).toBe(-0.8);
    expect(lowC).toBe(-highC);
  });

  it("OPPOSES 0.1 contribution is the exact negative of OPPOSES 0.9", async () => {
    const low = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.1]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "OPPOSES")]
    });
    const high = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "OPPOSES")]
    });
    const lowC = firstEntry(low, "TRY_EAST_ENTRANCE").signed_contribution as number;
    const highC = firstEntry(high, "TRY_EAST_ENTRANCE").signed_contribution as number;
    expect(highC).toBe(-0.8);
    expect(lowC).toBe(0.8);
    expect(lowC).toBe(-highC);
  });
});

// ---- §41 monotonicity -----------------------------------------------------------------

describe("Integration Policy V0 — §41 monotonicity over credence", () => {
  it("SUPPORTS is non-decreasing and OPPOSES is non-increasing across the bounded table", async () => {
    const table = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
    const supports: number[] = [];
    const opposes: number[] = [];
    for (const credence of table) {
      const s = await produceTendency({
        beliefItems: beliefs(["prop.a", credence]),
        relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
      });
      supports.push(firstEntry(s, "TRY_EAST_ENTRANCE").signed_contribution as number);
      const o = await produceTendency({
        beliefItems: beliefs(["prop.a", credence]),
        relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "OPPOSES")]
      });
      opposes.push(firstEntry(o, "TRY_EAST_ENTRANCE").signed_contribution as number);
    }
    for (let i = 1; i < table.length; i++) {
      const curS = supports[i];
      const prevS = supports[i - 1];
      const curO = opposes[i];
      const prevO = opposes[i - 1];
      if (curS === undefined || prevS === undefined || curO === undefined || prevO === undefined) {
        throw new Error("unreachable: table length mismatch");
      }
      expect(curS).toBeGreaterThanOrEqual(prevS);
      expect(curO).toBeLessThanOrEqual(prevO);
    }
  });
});

// ---- §42 polarity symmetry --------------------------------------------------------------

describe("Integration Policy V0 — §42 polarity symmetry", () => {
  it("OPPOSES contribution is the exact negative of SUPPORTS at equal credence", async () => {
    for (const credence of [0, 0.1, 0.5, 0.9, 1]) {
      const s = await produceTendency({
        beliefItems: beliefs(["prop.a", credence]),
        relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
      });
      const o = await produceTendency({
        beliefItems: beliefs(["prop.a", credence]),
        relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "OPPOSES")]
      });
      const sC = firstEntry(s, "TRY_EAST_ENTRANCE").signed_contribution as number;
      const oC = firstEntry(o, "TRY_EAST_ENTRANCE").signed_contribution as number;
      // OPPOSES = -(SUPPORTS) with negative zero normalized (-(+0) is -0 → +0).
      expect(oC).toBe(-sC === 0 ? 0 : -sC);
      expect(Object.is(oC, -0)).toBe(false);
      expect(Object.is(sC, -0)).toBe(false);
    }
  });
});

// ---- §43 negative zero --------------------------------------------------------------------

describe("Integration Policy V0 — §43 negative-zero normalization", () => {
  it("at c=0.5 stance, contribution and aggregate are all +0 (never -0)", async () => {
    for (const kind of ["SUPPORTS", "OPPOSES", "IRRELEVANT"] as const) {
      const projection = await produceTendency({
        beliefItems: beliefs(["prop.a", 0.5]),
        relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, kind)]
      });
      const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
      const entry = firstEntry(projection, "TRY_EAST_ENTRANCE");
      expect(Object.is(entry.stance as number, -0)).toBe(false);
      expect(entry.stance as number).toBe(0);
      expect(Object.is(entry.signed_contribution as number, -0)).toBe(false);
      expect(Object.is(tendency.aggregate_tendency as number, -0)).toBe(false);
      expect(tendency.aggregate_tendency as number).toBe(0);
    }
  });
});

// ---- §44 empty directional set --------------------------------------------------------------

describe("Integration Policy V0 — §44 empty directional set", () => {
  it("no relations → empty ledger, aggregate +0", async () => {
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: []
    });
    const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
    expect(tendency.contribution_ledger).toEqual([]);
    expect(tendency.aggregate_tendency as number).toBe(0);
    expect(Object.is(tendency.aggregate_tendency as number, -0)).toBe(false);
  });

  it("only IRRELEVANT relations → ledger preserved, directional aggregate +0", async () => {
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "IRRELEVANT")]
    });
    const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
    expect(tendency.contribution_ledger).toHaveLength(1);
    expect(firstEntry(projection, "TRY_EAST_ENTRANCE").relation).toBe("IRRELEVANT");
    expect(tendency.aggregate_tendency as number).toBe(0);
    expect(Object.is(tendency.aggregate_tendency as number, -0)).toBe(false);
  });
});

// ---- §45 IRRELEVANT no dilution ---------------------------------------------------------------

describe("Integration Policy V0 — §45 IRRELEVANT no dilution", () => {
  it("adding explicit IRRELEVANT entries leaves the directional aggregate identical", async () => {
    const items = beliefs(["prop.a", 0.9], ["prop.b", 0.5], ["prop.c", 0.5]);
    const directionalOnly = await produceTendency({
      beliefItems: items,
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const withIrrelevant = await produceTendency({
      beliefItems: items,
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_EAST_ENTRANCE", null, "IRRELEVANT"),
        relation("prop.c", "TRY_EAST_ENTRANCE", null, "IRRELEVANT")
      ]
    });
    const a = tendencyFor(directionalOnly, "TRY_EAST_ENTRANCE");
    const b = tendencyFor(withIrrelevant, "TRY_EAST_ENTRANCE");
    expect(a.aggregate_tendency as number).toBe(0.8);
    expect(b.aggregate_tendency as number).toBe(a.aggregate_tendency as number);
    // ledger grows, output fingerprint differs — but the number is unchanged.
    expect(a.contribution_ledger).toHaveLength(1);
    expect(b.contribution_ledger).toHaveLength(3);
    expect(withIrrelevant.output_fingerprint).not.toBe(directionalOnly.output_fingerprint);
  });
});

// ---- §46 count amplification --------------------------------------------------------------------

describe("Integration Policy V0 — §46 semantic-cardinality leverage mitigation", () => {
  it("1 directional +0.8 and 5 directional +0.8 both aggregate to +0.8", async () => {
    const caseA = await produceTendency({
      beliefItems: beliefs(["prop.p1", 0.9]),
      relations: [relation("prop.p1", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const caseB = await produceTendency({
      beliefItems: beliefs(
        ["prop.p1", 0.9],
        ["prop.p2", 0.9],
        ["prop.p3", 0.9],
        ["prop.p4", 0.9],
        ["prop.p5", 0.9]
      ),
      relations: [
        relation("prop.p1", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.p2", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.p3", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.p4", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.p5", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
      ]
    });
    const a = tendencyFor(caseA, "TRY_EAST_ENTRANCE").aggregate_tendency as number;
    const b = tendencyFor(caseB, "TRY_EAST_ENTRANCE").aggregate_tendency as number;
    expect(a).toBe(2 * 0.9 - 1);
    expect(b).toBe(a);
    expect(tendencyFor(caseB, "TRY_EAST_ENTRANCE").contribution_ledger).toHaveLength(5);
  });
});

// ---- §47 conflict cancellation ------------------------------------------------------------------

describe("Integration Policy V0 — §47 conflict cancellation", () => {
  it("+0.8 and -0.8 on one action cancel to +0 with both ledger entries retained", async () => {
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.1]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
      ]
    });
    const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
    expect(tendency.contribution_ledger).toHaveLength(2);
    expect(tendency.aggregate_tendency as number).toBe(0);
    expect(Object.is(tendency.aggregate_tendency as number, -0)).toBe(false);
  });
});

// ---- §48 mixed mean (exact IEEE-754) --------------------------------------------------------------

describe("Integration Policy V0 — §48 mixed directional mean (exact IEEE-754)", () => {
  it("equals the exact sequential mean of +0.8, +0.6…, -0.4 in canonical relation order", async () => {
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.8], ["prop.c", 0.3]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.c", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
      ]
    });
    // Expected computed live with the SAME frozen arithmetic + canonical order
    // (proposition_id ascending): NOT a rounded decimal literal (§48/§25).
    const expected = (2 * 0.9 - 1 + (2 * 0.8 - 1) + (2 * 0.3 - 1)) / 3;
    const tendency = tendencyFor(projection, "TRY_EAST_ENTRANCE");
    expect(tendency.aggregate_tendency as number).toBe(expected);
    expect(tendency.aggregate_tendency as number).toBe(0.3333333333333333);
  });
});

// ---- §49 action order invariance ------------------------------------------------------------------

describe("Integration Policy V0 — §49 action order invariance", () => {
  it("reversed host action input yields byte-identical canonical output", async () => {
    const items = beliefs(["prop.a", 0.9], ["prop.b", 0.4]);
    const relations = [
      relation("prop.a", "ASK_BOB", null, "SUPPORTS"),
      relation("prop.b", "TRY_EAST_ENTRANCE", null, "OPPOSES")
    ];
    const forward = await mintTendencyInput({
      beliefItems: items,
      relations,
      allowedActions: [
        { action_type: "ASK_BOB", target_ref: null },
        { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
      ]
    });
    const forwardOut = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: forward.projection,
      allowed_actions: forward.allowedActions,
      accepted_cognition_proposal: forward.accepted
    });
    // Same accepted proposal + projection, but host supplies the universe reversed.
    const reversed = [
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "ASK_BOB", target_ref: null }
    ] as unknown as readonly AllowedActionV0[];
    const reversedOut = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: forward.projection,
      allowed_actions: reversed,
      accepted_cognition_proposal: forward.accepted
    });
    expect(reversedOut.action_space_fingerprint).toBe(forwardOut.action_space_fingerprint);
    expect(reversedOut.policy_fingerprint).toBe(forwardOut.policy_fingerprint);
    expect(reversedOut.output_fingerprint).toBe(forwardOut.output_fingerprint);
    expect(JSON.stringify(reversedOut.action_tendencies)).toBe(JSON.stringify(forwardOut.action_tendencies));
    // canonical order: ASK_BOB precedes TRY_EAST_ENTRANCE regardless of input order.
    expect(forwardOut.action_tendencies.map((t) => t.action.action_type)).toEqual([
      "ASK_BOB",
      "TRY_EAST_ENTRANCE"
    ]);
  });
});

// ---- §50 relation order invariance ----------------------------------------------------------------

describe("Integration Policy V0 — §50 relation order invariance", () => {
  it("identical relation sets with different provider order produce identical output", async () => {
    const items = beliefs(["prop.a", 0.9], ["prop.b", 0.2]);
    const r1 = relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS");
    const r2 = relation("prop.b", "TRY_EAST_ENTRANCE", null, "OPPOSES");
    const first = await produceTendency({ beliefItems: items, relations: [r1, r2] });
    const second = await produceTendency({ beliefItems: items, relations: [r2, r1] });
    expect(second.output_fingerprint).toBe(first.output_fingerprint);
    expect(second.source_relation_projection_fingerprint).toBe(
      first.source_relation_projection_fingerprint
    );
    expect(JSON.stringify(second.action_tendencies)).toBe(JSON.stringify(first.action_tendencies));
  });
});

// ---- §51 unrelated action independence --------------------------------------------------------------

describe("Integration Policy V0 — §51 unrelated action independence", () => {
  it("an added zero-relation action keeps its own zero entry and never rescales others", async () => {
    const solo = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const duo = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")],
      allowedActions: [
        { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
        { action_type: "WAIT_HERE", target_ref: null }
      ]
    });
    const soloEast = tendencyFor(solo, "TRY_EAST_ENTRANCE").aggregate_tendency as number;
    const duoEast = tendencyFor(duo, "TRY_EAST_ENTRANCE").aggregate_tendency as number;
    const duoWait = tendencyFor(duo, "WAIT_HERE");
    expect(duoEast).toBe(soloEast);
    expect(duoWait.contribution_ledger).toEqual([]);
    expect(duoWait.aggregate_tendency as number).toBe(0);
  });
});

// ---- §52 confidence / uncertainty have zero numeric authority ----------------------------------------

describe("Integration Policy V0 — §52 confidence/uncertainty zero numeric authority", () => {
  it("different confidence/uncertainty leave stance/contribution/aggregate unchanged", async () => {
    const items = beliefs(["prop.a", 0.9], ["prop.b", 0.3]);
    const relations = [
      relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
      relation("prop.b", "TRY_EAST_ENTRANCE", null, "OPPOSES")
    ];
    const base = await produceTendency({ beliefItems: items, relations });
    const varied = await produceTendency({
      beliefItems: items,
      relations,
      overrides: { confidence: 0.05, uncertainty: 0.95 }
    });
    expect(JSON.stringify(varied.action_tendencies)).toBe(JSON.stringify(base.action_tendencies));
    // provenance fingerprint MAY lawfully differ (source accepted proposal differs).
    expect(varied.source_relation_projection_fingerprint).not.toBe(
      base.source_relation_projection_fingerprint
    );
  });
});

// ---- §53 text has zero numeric authority -------------------------------------------------------------

describe("Integration Policy V0 — §53 cognition text zero numeric authority", () => {
  it("changing reasoning_summary/current_intent leaves the numeric tendency unchanged", async () => {
    const items = beliefs(["prop.a", 0.9]);
    const relations = [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")];
    const base = await produceTendency({ beliefItems: items, relations });
    const varied = await produceTendency({
      beliefItems: items,
      relations,
      overrides: { reasoning_summary: "an entirely different summary", current_intent: "go east now" }
    });
    expect(JSON.stringify(varied.action_tendencies)).toBe(JSON.stringify(base.action_tendencies));
    expect(varied.source_relation_projection_fingerprint).not.toBe(
      base.source_relation_projection_fingerprint
    );
  });
});

// ---- §54 stale projection fail-closed -----------------------------------------------------------------

describe("Integration Policy V0 — §54 stale projection rebase forbidden", () => {
  it("an accepted proposal bound to a changed credence/projection fails BOUND_CONTEXT_MISMATCH", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    // A DIFFERENT current projection (credence changed → new projection_hash).
    const staleCurrent = await buildProjection(beliefs(["prop.a", 0.4]));
    await expect(
      produceBeliefDecisionTendencyProjectionV0({
        current_projection: staleCurrent,
        allowed_actions: minted.allowedActions,
        accepted_cognition_proposal: minted.accepted
      })
    ).rejects.toMatchObject({ code: "BOUND_CONTEXT_MISMATCH" });
  });
});

// ---- §55 wrong action universe / syntactic action-space failure ---------------------------------------

describe("Integration Policy V0 — §55 wrong action universe fail-closed", () => {
  it("a changed action universe fails BOUND_CONTEXT_MISMATCH (no numeric output)", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const otherUniverse = [
      { action_type: "WAIT_HERE", target_ref: null }
    ] as unknown as readonly AllowedActionV0[];
    await expect(
      produceBeliefDecisionTendencyProjectionV0({
        current_projection: minted.projection,
        allowed_actions: otherUniverse,
        accepted_cognition_proposal: minted.accepted
      })
    ).rejects.toMatchObject({ code: "BOUND_CONTEXT_MISMATCH" });
  });

  it("a syntactically invalid action universe (duplicate tuple) fails ACTION_SPACE_MISMATCH", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const duplicated = [
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
    ] as unknown as readonly AllowedActionV0[];
    await expect(
      produceBeliefDecisionTendencyProjectionV0({
        current_projection: minted.projection,
        allowed_actions: duplicated,
        accepted_cognition_proposal: minted.accepted
      })
    ).rejects.toMatchObject({
      name: "BeliefDecisionIntegrationPolicyErrorV0",
      code: "ACTION_SPACE_MISMATCH"
    });
  });
});

// ---- §56 structural clone rejection -------------------------------------------------------------------

describe("Integration Policy V0 — §56 capability clone rejection", () => {
  it("spread / JSON / manual clones of the accepted proposal fail UNAUTHORIZED", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const spread = { ...minted.accepted } as unknown as AcceptedCognitionProposalV1;
    const json = JSON.parse(JSON.stringify(minted.accepted)) as AcceptedCognitionProposalV1;
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
    for (const clone of [spread, json, lookalike]) {
      await expect(
        produceBeliefDecisionTendencyProjectionV0({
          current_projection: minted.projection,
          allowed_actions: minted.allowedActions,
          accepted_cognition_proposal: clone
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL" });
    }
    // the authorized original still works.
    const ok = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    expect(ok.action_tendencies).toHaveLength(1);
  });
});

// ---- §57 no caller-supplied relation projection API ----------------------------------------------------

describe("Integration Policy V0 — §57 fabricated relation projection has no authority", () => {
  it("an injected forged relation projection field is ignored (recomputed internally)", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const clean = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    const forged = {
      schema_version: "decision-influence-projection-v0",
      relations: [
        {
          state_locator: { domain: "BELIEF", proposition_id: "prop.a" },
          action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
          relation: "OPPOSES"
        }
      ],
      output_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    };
    const withForged = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted,
      // extra forged authority field — the producer input type has NO such slot.
      relation_projection: forged
    } as unknown as Parameters<typeof produceBeliefDecisionTendencyProjectionV0>[0]);
    expect(withForged.output_fingerprint).toBe(clean.output_fingerprint);
    expect(firstEntry(withForged, "TRY_EAST_ENTRANCE").relation).toBe(
      "SUPPORTS"
    );
  });
});

// ---- §58 policy fingerprint determinism ---------------------------------------------------------------

describe("Integration Policy V0 — §58 policy fingerprint constant", () => {
  it("repeated derivation yields the identical fingerprint with no wall-clock dependency", async () => {
    const a = await deriveBeliefDecisionIntegrationPolicyFingerprintV0();
    const b = await deriveBeliefDecisionIntegrationPolicyFingerprintV0();
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    expect(projection.policy_fingerprint).toBe(a);
  });
});

// ---- §59 output fingerprint determinism ---------------------------------------------------------------

describe("Integration Policy V0 — §59 output fingerprint determinism", () => {
  it("equivalent authorized inputs yield identical output bytes/fingerprint", async () => {
    const args = {
      beliefItems: beliefs(["prop.a", 0.9], ["prop.b", 0.2]),
      relations: [
        relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.b", "TRY_EAST_ENTRANCE", null, "OPPOSES")
      ]
    };
    const first = await produceTendency(args);
    const second = await produceTendency(args);
    expect(first.output_fingerprint).toBe(second.output_fingerprint);
    expect(first.output_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ---- §60 all actions present ----------------------------------------------------------------------------

describe("Integration Policy V0 — §60 every canonical action present exactly once", () => {
  it("N allowed actions → N tendency entries, zero-relation actions included", async () => {
    const projection = await produceTendency({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")],
      allowedActions: [
        { action_type: "ASK_BOB", target_ref: null },
        { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
        { action_type: "WAIT_HERE", target_ref: null }
      ]
    });
    expect(projection.action_tendencies).toHaveLength(3);
    const types = projection.action_tendencies.map((t) => t.action.action_type);
    expect(new Set(types).size).toBe(3);
    expect(tendencyFor(projection, "ASK_BOB").aggregate_tendency as number).toBe(0);
    expect(tendencyFor(projection, "WAIT_HERE").contribution_ledger).toEqual([]);
    expect(tendencyFor(projection, "TRY_EAST_ENTRANCE").aggregate_tendency as number).toBe(0.8);
  });
});

// ---- §61 zero canonical effect ---------------------------------------------------------------------------

describe("Integration Policy V0 — §61 zero canonical effect", () => {
  it("producing a tendency never mutates the bound projection or accepted proposal", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const projectionBefore = JSON.stringify(minted.projection);
    const acceptedBefore = JSON.stringify(minted.accepted);
    await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    expect(JSON.stringify(minted.projection)).toBe(projectionBefore);
    expect(JSON.stringify(minted.accepted)).toBe(acceptedBefore);
  });
});

// ---- §63 zero real model calls ---------------------------------------------------------------------------

describe("Integration Policy V0 — §63 zero model recall for numeric integration", () => {
  it("the producer makes ZERO provider calls (numeric authority is internal)", async () => {
    const minted = await mintTendencyInput({
      beliefItems: beliefs(["prop.a", 0.9]),
      relations: [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const callsAfterMint = minted.provider.calls;
    expect(callsAfterMint).toBe(1);
    await produceBeliefDecisionTendencyProjectionV0({
      current_projection: minted.projection,
      allowed_actions: minted.allowedActions,
      accepted_cognition_proposal: minted.accepted
    });
    // produceBeliefDecisionTendencyProjectionV0 accepts NO provider — count is unchanged.
    expect(minted.provider.calls).toBe(callsAfterMint);
  });
});

// ---- §37 failure taxonomy stability ----------------------------------------------------------------------

describe("Integration Policy V0 — §37 failure taxonomy", () => {
  it("classifies errors with the stable BeliefDecisionIntegrationPolicyErrorV0 shape", () => {
    const error = new BeliefDecisionIntegrationPolicyErrorV0("UNKNOWN_PROPOSITION", "detail text");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BeliefDecisionIntegrationPolicyErrorV0");
    expect(error.code).toBe("UNKNOWN_PROPOSITION");
    expect(error.message).toBe("BELIEF_DECISION_INTEGRATION_UNKNOWN_PROPOSITION: detail text");
    // relation-authority / bound-context failures pass through the frozen code.
    const passthrough = new CognitionRelationRejectionErrorV1("BOUND_CONTEXT_MISMATCH", "x");
    expect(passthrough.code).toBe("BOUND_CONTEXT_MISMATCH");
  });
});

// ---- §62 replay equivalence ------------------------------------------------------------------------------

/**
 * TEST-PRIVATE in-memory linearizable store implementing the frozen workflow
 * port (copied pattern; claim/outcome re-check synchronously after the async
 * hash so two concurrent claimers can never both observe count 0).
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

describe("Integration Policy V0 — §62 workflow replay equivalence", () => {
  it("first run makes ONE provider call, replay makes ZERO, tendencies are byte-equivalent", async () => {
    const projection = await buildProjection(beliefs(["prop.a", 0.9]));
    const provider = new FakeRelationProvider((input) =>
      validPayload(input, [relation("prop.a", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
    );
    const store = new InMemoryRelationWorkflowStore();
    const request = {
      workflow_id: "wf-replay-1" as never,
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
    // ZERO additional real provider calls on replay.
    expect(provider.calls).toBe(1);

    const t1 = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: projection,
      allowed_actions: HOST_ACTIONS as unknown as readonly AllowedActionV0[],
      accepted_cognition_proposal: first.accepted
    });
    const t2 = await produceBeliefDecisionTendencyProjectionV0({
      current_projection: projection,
      allowed_actions: HOST_ACTIONS as unknown as readonly AllowedActionV0[],
      accepted_cognition_proposal: second.accepted
    });
    expect(t2.output_fingerprint).toBe(t1.output_fingerprint);
    expect(JSON.stringify(t2)).toBe(JSON.stringify(t1));
  });
});
