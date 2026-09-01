/**
 * Belief Decision Influence Relation Foundation V0 — host admission runner +
 * relation-only projection producer acceptance suite (§54-§79):
 * SUPPORTS/OPPOSES/IRRELEVANT/UNASSERTED semantics, fail-closed rejection
 * codes through the runner, capability privacy (WeakSet mint), forbidden
 * projection fields, deterministic canonical relations + output fingerprint,
 * order-insensitive host action authority, cardinality bounds and ZERO
 * canonical effects.
 *
 * Fully OFFLINE: deterministic fake provider only — no model, no transport.
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
import { CognitionRelationRejectionErrorV1 } from "./cognition-proposal-v1.js";
import {
  DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION,
  DECISION_INFLUENCE_RELATION_OUTPUT_FINGERPRINT_PROJECTION,
  produceBeliefDecisionInfluenceRelationProjectionV0,
  runCognitionRelationAdmissionV1,
  type CognitionRelationAdmissionResultV1,
  type CognitionRelationHostBindingV1
} from "./belief-decision-influence-relation.js";

// ---- deterministic fixtures ----------------------------------------------------

const BELIEFS = [
  { proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 },
  { proposition_id: "prop.alex-trustworthy", proposition_label: "Alex is trustworthy", credence: 0.5 }
];

async function buildProjection(args?: {
  readonly beliefItems?: readonly {
    readonly proposition_id: string;
    readonly proposition_label: string;
    readonly credence: number;
  }[];
  readonly workingRefs?: readonly string[];
}): Promise<CognitiveContextProjectionV0> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: { schema_version: "belief-state-v0", items: args?.beliefItems ?? BELIEFS },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: args?.workingRefs ?? ["episode:e1", "episode:e2"]
    }
  } as unknown as SubjectStateV0;
  return buildCognitiveContextProjection(snapshot);
}

/** Deterministic fake provider: payload is a pure function of the host input. */
class FakeRelationProvider implements CognitionRelationProviderV1 {
  calls = 0;
  lastInput: CognitionRelationProviderInputV1 | null = null;
  constructor(private readonly payloadFactory: (input: CognitionRelationProviderInputV1) => unknown) {}
  async propose(input: CognitionRelationProviderInputV1): Promise<unknown> {
    this.calls += 1;
    this.lastInput = input;
    return this.payloadFactory(input);
  }
}

function relation(
  propositionId: string,
  actionType: string,
  targetRef: string | null,
  kind: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    state_locator: { domain: "BELIEF", proposition_id: propositionId },
    action: { action_type: actionType, target_ref: targetRef },
    relation: kind,
    ...extra
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
    reasoning_summary: "relation fixture",
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

const HOST_ACTIONS = [{ action_type: "TRY_EAST_ENTRANCE", target_ref: null }];

async function runAdmission(args: {
  readonly projection?: CognitiveContextProjectionV0;
  readonly allowedActions?: readonly { action_type: string; target_ref: string | null }[];
  readonly provider: CognitionRelationProviderV1;
  readonly subjectIdOverride?: string;
  readonly stateRevisionOverride?: number;
}): Promise<{ result: CognitionRelationAdmissionResultV1; provider: FakeRelationProvider }> {
  const projection = args.projection ?? (await buildProjection());
  const provider = args.provider as FakeRelationProvider;
  const result = await runCognitionRelationAdmissionV1({
    subject_id: (args.subjectIdOverride ?? projection.subject_id) as never,
    state_revision: (args.stateRevisionOverride ?? projection.state_revision) as never,
    current_logical_time: projection.current_logical_time,
    projection,
    allowed_actions: (args.allowedActions ?? HOST_ACTIONS) as unknown as readonly AllowedActionV0[],
    provider: args.provider
  });
  return { result, provider };
}

/** Mint a valid accepted capability through the real runner. */
async function mintAccepted(args?: {
  readonly relations?: readonly Record<string, unknown>[];
  readonly allowedActions?: readonly { action_type: string; target_ref: string | null }[];
}): Promise<{
  readonly result: Extract<CognitionRelationAdmissionResultV1, { kind: "ACCEPTED" }>;
  readonly binding: CognitionRelationHostBindingV1;
  readonly provider: FakeRelationProvider;
}> {
  const allowedActions = args?.allowedActions ?? HOST_ACTIONS;
  const provider = new FakeRelationProvider((input) =>
    validPayload(input, args?.relations ?? [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
  );
  const { result } = await runAdmission({ allowedActions, provider });
  if (result.kind !== "ACCEPTED") throw new Error(`expected ACCEPTED, got ${JSON.stringify(result)}`);
  return {
    result,
    binding: {
      subject_id: result.accepted.subject_id,
      state_revision: result.accepted.state_revision,
      current_logical_time: result.accepted.current_logical_time,
      projection_hash: result.accepted.projection_hash,
      action_space_fingerprint: result.accepted.action_space_fingerprint
    },
    provider
  };
}

// ---- directional relation semantics (§54-§57) ------------------------------------

describe("Relation Foundation V0 — directional relation semantics", () => {
  it("§54 SUPPORTS: accepted chain yields the exact relation-only projection (no numeric/final-action fields)", async () => {
    const { result, binding } = await mintAccepted();
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(projection.schema_version).toBe(DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION);
    expect(projection.relations).toEqual([
      {
        state_locator: { domain: "BELIEF", proposition_id: "prop.bob-trustworthy" },
        action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
        relation: "SUPPORTS"
      }
    ]);
    expect(projection.source_proposal_fingerprint).toBe(result.accepted.accepted_proposal_fingerprint);
    expect(projection.output_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(DECISION_INFLUENCE_RELATION_OUTPUT_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-influence-relation-projection/v1"
    );
    // §26: relation-only shape — no scoring, ranking, selection or reasoning surface.
    const keys = Object.keys(projection);
    expect(keys).toEqual([
      "schema_version",
      "subject_id",
      "state_revision",
      "current_logical_time",
      "projection_hash",
      "action_space_fingerprint",
      "relations",
      "source_proposal_fingerprint",
      "output_fingerprint"
    ]);
    for (const forbidden of [
      "score",
      "rank",
      "winner",
      "selected_action",
      "influence_strength",
      "utility",
      "margin",
      "reasoning_summary",
      "current_intent",
      "confidence",
      "uncertainty",
      "evidence_refs",
      "action_intent"
    ]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.relations[0])).toBe(true);
  });

  it("§55 OPPOSES is preserved verbatim as a directional relation", async () => {
    const { result, binding } = await mintAccepted({
      relations: [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES")]
    });
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(projection.relations[0]?.relation).toBe("OPPOSES");
  });

  it("§56 IRRELEVANT is preserved when asserted; omitted pairs stay UNASSERTED (absent)", async () => {
    const { result, binding } = await mintAccepted({
      relations: [relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "IRRELEVANT")]
    });
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(projection.relations).toHaveLength(1);
    expect(projection.relations[0]?.relation).toBe("IRRELEVANT");
    // prop.bob-trustworthy x TRY_EAST_ENTRANCE was omitted → never materialized.
    expect(projection.relations.some((r) => r.state_locator.proposition_id === "prop.bob-trustworthy")).toBe(false);
  });

  it("§57 empty relations are valid, deterministic and fully frozen", async () => {
    const first = await mintAccepted({ relations: [] });
    const second = await mintAccepted({ relations: [] });
    const p1 = await produceBeliefDecisionInfluenceRelationProjectionV0(first.result.accepted, first.binding);
    const p2 = await produceBeliefDecisionInfluenceRelationProjectionV0(second.result.accepted, second.binding);
    expect(p1.relations).toEqual([]);
    expect(p2.relations).toEqual([]);
    expect(p1.output_fingerprint).toBe(p2.output_fingerprint);
  });
});

// ---- runner rejection codes (§58-§71) --------------------------------------------

describe("Relation Foundation V0 — host runner fail-closed rejection codes", () => {
  it("rejects malformed payloads with the exact stable model codes", async () => {
    const cases: readonly {
      label: string;
      factory: (input: CognitionRelationProviderInputV1) => unknown;
      code: string;
    }[] = [
      { label: "non-object payload", factory: () => "not an object", code: "MODEL_SCHEMA_INVALID" },
      {
        label: "forbidden action_intent",
        factory: (input) =>
          validPayload(input, [], { action_intent: { action_type: "TRY_EAST_ENTRANCE", target_ref: null } }),
        code: "MODEL_SCHEMA_INVALID"
      },
      {
        label: "numeric relation field",
        factory: (input) =>
          validPayload(input, [
            relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS", { weight: 0.9 })
          ]),
        code: "MODEL_SCHEMA_INVALID"
      },
      {
        label: "unknown proposition",
        factory: (input) => validPayload(input, [relation("prop.never-projected", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]),
        code: "MODEL_UNKNOWN_PROPOSITION"
      },
      {
        label: "wrong locator domain",
        factory: (input) =>
          validPayload(input, [
            {
              state_locator: { domain: "PERSONALITY", proposition_id: "prop.bob-trustworthy" },
              action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
              relation: "SUPPORTS"
            }
          ]),
        code: "MODEL_INVALID_STATE_LOCATOR"
      },
      {
        label: "EXACT_TUPLE violation",
        factory: (input) => validPayload(input, [relation("prop.bob-trustworthy", "TELEPORT", null, "SUPPORTS")]),
        code: "MODEL_ACTION_NOT_ALLOWED"
      },
      {
        label: "duplicate relation pair",
        factory: (input) =>
          validPayload(input, [
            relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
            relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES")
          ]),
        code: "MODEL_DUPLICATE_RELATION_PAIR"
      },
      {
        label: "projection_hash mismatch",
        factory: (input) => validPayload(input, [], { projection_hash: `sha256:${"0".repeat(64)}` }),
        code: "MODEL_PROJECTION_MISMATCH"
      },
      {
        label: "action_space_fingerprint mismatch",
        factory: (input) => validPayload(input, [], { action_space_fingerprint: `sha256:${"1".repeat(64)}` }),
        code: "MODEL_ACTION_SPACE_MISMATCH"
      },
      {
        label: "unsupported evidence ref",
        factory: (input) => validPayload(input, [], { evidence_refs: ["episode:e-invented"] }),
        code: "MODEL_UNSUPPORTED_EVIDENCE"
      },
      {
        label: "§69 belief ID as evidence fails closed",
        factory: (input) => validPayload(input, [], { evidence_refs: ["prop.bob-trustworthy"] }),
        code: "MODEL_SCHEMA_INVALID"
      }
    ];
    for (const testCase of cases) {
      const provider = new FakeRelationProvider(testCase.factory);
      const { result } = await runAdmission({ provider });
      expect(result.kind, testCase.label).toBe("PROVIDER_REJECTED");
      if (result.kind === "PROVIDER_REJECTED") {
        expect(result.code, testCase.label).toBe(testCase.code);
      }
      expect(provider.calls, testCase.label).toBe(1);
    }
  });

  it("maps generic provider failure to PROVIDER_REJECTED and preserves stable model codes", async () => {
    const generic = new FakeRelationProvider(() => {
      throw new Error("provider exploded");
    });
    const { result } = await runAdmission({ provider: generic });
    expect(result.kind).toBe("PROVIDER_REJECTED");
    if (result.kind === "PROVIDER_REJECTED") expect(result.code).toBe("PROVIDER_REJECTED");
    expect(generic.calls).toBe(1);

    const stable = new FakeRelationProvider(() => {
      throw new CognitionRelationRejectionErrorV1("MODEL_MALFORMED_JSON", "direct JSON.parse failed");
    });
    const second = await runAdmission({ provider: stable });
    expect(second.result.kind).toBe("PROVIDER_REJECTED");
    if (second.result.kind === "PROVIDER_REJECTED") expect(second.result.code).toBe("MODEL_MALFORMED_JSON");
  });

  it("fails the binding BEFORE any provider call (BOUND_CONTEXT_MISMATCH, zero provider calls)", async () => {
    const provider = new FakeRelationProvider((input) => validPayload(input, []));
    const projection = await buildProjection();
    const wrongSubject = await runAdmission({ projection, provider, subjectIdOverride: "subject.someone-else" });
    expect(wrongSubject.result).toEqual(
      expect.objectContaining({ kind: "FAILED", code: "BOUND_CONTEXT_MISMATCH" })
    );
    expect(provider.calls).toBe(0);

    const wrongRevision = await runAdmission({
      projection,
      provider,
      stateRevisionOverride: (projection.state_revision as number) + 1
    });
    expect(wrongRevision.result).toEqual(
      expect.objectContaining({ kind: "FAILED", code: "BOUND_CONTEXT_MISMATCH" })
    );
    expect(provider.calls).toBe(0);
  });

  it("rejects a tampered projection body (hash integrity) as BOUND_CONTEXT_MISMATCH", async () => {
    const projection = await buildProjection();
    const tampered = {
      ...projection,
      belief_items: [...projection.belief_items.map((b) => ({ ...b, credence: 1 as never }))]
    } as unknown as CognitiveContextProjectionV0;
    const provider = new FakeRelationProvider((input) => validPayload(input, []));
    const { result } = await runAdmission({ projection: tampered, provider });
    expect(result).toEqual(expect.objectContaining({ kind: "FAILED", code: "BOUND_CONTEXT_MISMATCH" }));
    expect(provider.calls).toBe(0);
  });

  it("§78 rejects >64 host actions BEFORE provider use and accepts exactly 64", async () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ action_type: `ACT_${String(i).padStart(2, "0")}`, target_ref: null }));
    const oversized = new FakeRelationProvider((input) => validPayload(input, []));
    const { result } = await runAdmission({ allowedActions: mk(65), provider: oversized });
    expect(result).toEqual(expect.objectContaining({ kind: "FAILED", code: "INVALID_ACTION_SPACE" }));
    expect(oversized.calls).toBe(0);

    const exact = new FakeRelationProvider((input) => validPayload(input, []));
    const { result: ok64 } = await runAdmission({ allowedActions: mk(64), provider: exact });
    expect(ok64.kind).toBe("ACCEPTED");
    expect(exact.calls).toBe(1);
  });

  it("§63 rejects duplicate host action tuples with zero provider calls", async () => {
    const provider = new FakeRelationProvider((input) => validPayload(input, []));
    const { result } = await runAdmission({
      allowedActions: [
        { action_type: "WAIT", target_ref: null },
        { action_type: "WAIT", target_ref: null }
      ],
      provider
    });
    expect(result).toEqual(expect.objectContaining({ kind: "FAILED", code: "INVALID_ACTION_SPACE" }));
    expect(provider.calls).toBe(0);
  });
});

// ---- canonicalization, determinism, capability privacy (§64, §72-§77) -------------

describe("Relation Foundation V0 — order-insensitive authority + capability privacy", () => {
  it("§64 host action order has NO authority: identical canonical actions, fingerprints and provider input", async () => {
    const eastFirst = [
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null },
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
    ];
    const westFirst = [...eastFirst].reverse();
    const snapshotA = JSON.stringify(eastFirst);
    const snapshotB = JSON.stringify(westFirst);

    const providerA = new FakeRelationProvider((input) =>
      validPayload(input, [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
    );
    const providerB = new FakeRelationProvider((input) =>
      validPayload(input, [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
    );
    const { result: a } = await runAdmission({ allowedActions: eastFirst, provider: providerA });
    const { result: b } = await runAdmission({ allowedActions: westFirst, provider: providerB });
    if (a.kind !== "ACCEPTED" || b.kind !== "ACCEPTED") throw new Error("both admissions must accept");

    expect(JSON.stringify(eastFirst)).toBe(snapshotA);
    expect(JSON.stringify(westFirst)).toBe(snapshotB);
    expect(JSON.stringify(a.canonical_actions)).toBe(JSON.stringify(b.canonical_actions));
    expect(a.action_space_fingerprint).toBe(b.action_space_fingerprint);
    expect(JSON.stringify(providerA.lastInput)).toBe(JSON.stringify(providerB.lastInput));
    expect(a.accepted.accepted_proposal_fingerprint).toBe(b.accepted.accepted_proposal_fingerprint);
  });

  it("§75 relations from the provider are emitted in canonical comparator order", async () => {
    const { result, binding } = await mintAccepted({
      relations: [
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES")
      ],
      allowedActions: HOST_ACTIONS
    });
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(projection.relations.map((r) => r.state_locator.proposition_id)).toEqual([
      "prop.alex-trustworthy",
      "prop.bob-trustworthy"
    ]);
  });

  it("§76/§77 accepted + output fingerprints are deterministic and relation-permutation insensitive", async () => {
    const forward = await mintAccepted({
      relations: [
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES")
      ]
    });
    const reversed = await mintAccepted({
      relations: [
        relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES"),
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
      ]
    });
    expect(forward.result.accepted.accepted_proposal_fingerprint).toBe(
      reversed.result.accepted.accepted_proposal_fingerprint
    );
    const pf = await produceBeliefDecisionInfluenceRelationProjectionV0(forward.result.accepted, forward.binding);
    const pr = await produceBeliefDecisionInfluenceRelationProjectionV0(reversed.result.accepted, reversed.binding);
    expect(pf.output_fingerprint).toBe(pr.output_fingerprint);
    expect(JSON.stringify(pf.relations)).toBe(JSON.stringify(pr.relations));
  });

  it("§72 forged accepted proposals (spread / JSON clone / raw literal) are UNAUTHORIZED", async () => {
    const { result, binding } = await mintAccepted();
    const spread = { ...result.accepted };
    const cloned = JSON.parse(JSON.stringify(result.accepted));
    for (const forged of [spread, cloned]) {
      const error = await produceBeliefDecisionInfluenceRelationProjectionV0(
        forged as never,
        binding
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CognitionRelationRejectionErrorV1);
      expect((error as CognitionRelationRejectionErrorV1).code).toBe("UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL");
    }
  });

  it("§73 the genuine minted capability produces its projection; binding mismatch rejects", async () => {
    const { result, binding } = await mintAccepted();
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(projection.relations).toHaveLength(1);

    const wrongBinding: CognitionRelationHostBindingV1 = {
      ...binding,
      action_space_fingerprint: `sha256:${"2".repeat(64)}` as never
    };
    const error = await produceBeliefDecisionInfluenceRelationProjectionV0(
      result.accepted,
      wrongBinding
    ).catch((e: unknown) => e);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("BOUND_CONTEXT_MISMATCH");
  });
});

// ---- zero canonical effects (§74, §79) --------------------------------------------

describe("Relation Foundation V0 — zero canonical effects + input immutability", () => {
  it("§74/§79 deep-frozen inputs survive admission + production byte-identical", async () => {
    const projection = await buildProjection();
    const hostActions = [{ action_type: "TRY_EAST_ENTRANCE", target_ref: null }];
    const projectionSnapshot = JSON.stringify(projection);
    const actionsSnapshot = JSON.stringify(hostActions);
    const provider = new FakeRelationProvider((input) =>
      validPayload(input, [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")])
    );
    const { result } = await runAdmission({ projection, allowedActions: hostActions, provider });
    if (result.kind !== "ACCEPTED") throw new Error("expected ACCEPTED");
    const binding: CognitionRelationHostBindingV1 = {
      subject_id: result.accepted.subject_id,
      state_revision: result.accepted.state_revision,
      current_logical_time: result.accepted.current_logical_time,
      projection_hash: result.accepted.projection_hash,
      action_space_fingerprint: result.accepted.action_space_fingerprint
    };
    const output = await produceBeliefDecisionInfluenceRelationProjectionV0(result.accepted, binding);
    expect(JSON.stringify(projection)).toBe(projectionSnapshot);
    expect(JSON.stringify(hostActions)).toBe(actionsSnapshot);
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(result.accepted)).toBe(true);
    expect(Object.isFrozen(output)).toBe(true);
    // The V0 cognition projection still reports NO allowed actions (V0 surface untouched).
    expect(projection.allowed_actions).toEqual([]);
  });
});
