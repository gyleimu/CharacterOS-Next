/**
 * Belief Decision Influence Relation Foundation V0 — CognitionProposalV1 schema
 * layer acceptance suite: closed V1 schema, BeliefStateLocatorV0 authority,
 * EXACT_TUPLE action membership, host action-space validation/canonicalization,
 * deterministic fingerprints, cardinality bounds, and the V2-observed failure
 * class guard (belief IDs never admitted as evidence refs).
 *
 * Fully OFFLINE: deterministic fixtures only — no model, no transport.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "./cognition-action-transition-executor.js";
import type { CognitiveContextProjectionV0 } from "./types.js";
import {
  ACCEPTED_COGNITION_PROPOSAL_FINGERPRINT_PROJECTION,
  ACTION_SPACE_FINGERPRINT_PROJECTION,
  CognitionRelationRejectionErrorV1,
  deriveAcceptedCognitionProposalFingerprintV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1,
  validateAndNormalizeCognitionProposalV1
} from "./cognition-proposal-v1.js";

async function buildProjection(args: {
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
    beliefs: { schema_version: "belief-state-v0", items: args.beliefItems ?? [] },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: args.workingRefs ?? []
    }
  } as unknown as SubjectStateV0;
  return buildCognitiveContextProjection(snapshot);
}

const BELIEFS = [
  { proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 },
  { proposition_id: "prop.alex-trustworthy", proposition_label: "Alex is trustworthy", credence: 0.5 }
];

async function buildContext(actions: readonly { action_type: string; target_ref: string | null }[]) {
  const projection = await buildProjection({ beliefItems: BELIEFS, workingRefs: ["episode:e1", "episode:e2"] });
  const space = validateAllowedActionSpaceV1(actions);
  if (!space.ok) throw new Error(`fixture action space invalid: ${space.error.detail}`);
  const actionSpaceFingerprint = await deriveCognitionActionSpaceFingerprintV1(space.value);
  return { projection, canonicalActions: space.value, actionSpaceFingerprint };
}

function validPayload(
  projection: CognitiveContextProjectionV0,
  actionSpaceFingerprint: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v1",
    projection_hash: projection.projection_hash,
    action_space_fingerprint: actionSpaceFingerprint,
    reasoning_summary: "relation proposal fixture",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: null,
    confidence: 0.6,
    uncertainty: 0.4,
    state_action_relations: [],
    evidence_refs: [],
    ...overrides
  };
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

async function expectRejection(
  raw: unknown,
  actions: readonly { action_type: string; target_ref: string | null }[],
  code: string
): Promise<void> {
  const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(actions);
  const error = await validateAndNormalizeCognitionProposalV1(raw, {
    projection,
    canonical_actions: canonicalActions,
    action_space_fingerprint: actionSpaceFingerprint
  }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(CognitionRelationRejectionErrorV1);
  expect((error as CognitionRelationRejectionErrorV1).code).toBe(code);
}

describe("Relation Foundation V0 — host action space validation/canonicalization", () => {
  it("rejects non-array action space", () => {
    const result = validateAllowedActionSpaceV1({ action_type: "WAIT" });
    expect(result.ok).toBe(false);
  });

  it("rejects exact duplicate tuples pre-fingerprint (REJECT_EXACT_DUPLICATES_PRE_FINGERPRINT)", () => {
    const result = validateAllowedActionSpaceV1([
      { action_type: "WAIT", target_ref: null },
      { action_type: "WAIT", target_ref: null }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain("duplicate action tuple");
  });

  it("rejects >64 actions and accepts exactly 64", () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ action_type: `A${String(i).padStart(2, "0")}`, target_ref: null }));
    expect(validateAllowedActionSpaceV1(mk(65)).ok).toBe(false);
    expect(validateAllowedActionSpaceV1(mk(64)).ok).toBe(true);
  });

  it("rejects invalid action grammar (empty type / bad ref / unknown key)", () => {
    expect(validateAllowedActionSpaceV1([{ action_type: "", target_ref: null }]).ok).toBe(false);
    expect(validateAllowedActionSpaceV1([{ action_type: "WAIT", target_ref: "no-prefix" }]).ok).toBe(false);
    expect(validateAllowedActionSpaceV1([{ action_type: "WAIT", target_ref: null, weight: 1 }]).ok).toBe(false);
  });

  it("canonicalizes host order (UTF-16 action_type ascending, null target first) without mutating the caller array", () => {
    const caller = [
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null },
      { action_type: "TRY_EAST_ENTRANCE", target_ref: "entity:bob" },
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
    ];
    const snapshot = JSON.stringify(caller);
    const result = validateAllowedActionSpaceV1(caller);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((a) => [a.action_type, a.target_ref])).toEqual([
        ["TRY_EAST_ENTRANCE", null],
        ["TRY_EAST_ENTRANCE", "entity:bob"],
        ["TRY_WEST_ENTRANCE", null]
      ]);
    }
    expect(JSON.stringify(caller)).toBe(snapshot);
  });

  it("action-space fingerprint is order-insensitive and deterministic (exact namespace)", async () => {
    const a = validateAllowedActionSpaceV1([
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null }
    ]);
    const b = validateAllowedActionSpaceV1([
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null },
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
    ]);
    if (!a.ok || !b.ok) throw new Error("fixture action spaces must validate");
    const fpA = await deriveCognitionActionSpaceFingerprintV1(a.value);
    const fpB = await deriveCognitionActionSpaceFingerprintV1(b.value);
    expect(fpA).toBe(fpB);
    expect(fpA).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ACTION_SPACE_FINGERPRINT_PROJECTION).toBe("characteros-next/runtime/cognition-action-space/v1");
    expect(ACCEPTED_COGNITION_PROPOSAL_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/accepted-cognition-proposal/v1"
    );
  });
});

describe("Relation Foundation V0 — CognitionProposalV1 closed schema", () => {
  const ACTIONS = [{ action_type: "TRY_EAST_ENTRANCE", target_ref: null }];

  it("accepts a lawful SUPPORTS proposal and freezes the normalized result", async () => {
    const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(ACTIONS);
    const payload = validPayload(projection, actionSpaceFingerprint, {
      state_action_relations: [
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
      ],
      relevant_memory_refs: ["episode:e1"],
      evidence_refs: ["episode:e2"]
    });
    const normalized = await validateAndNormalizeCognitionProposalV1(payload, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    });
    expect(normalized.schema_version).toBe("cognition-proposal-v1");
    expect(normalized.state_action_relations).toHaveLength(1);
    expect(normalized.state_action_relations[0]).toEqual({
      state_locator: { domain: "BELIEF", proposition_id: "prop.bob-trustworthy" },
      action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      relation: "SUPPORTS"
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.state_action_relations[0])).toBe(true);
  });

  it("rejects unknown top-level keys and the forbidden action_intent", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, { extra_key: 1 }),
      ACTIONS,
      "MODEL_SCHEMA_INVALID"
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        action_intent: { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
      }),
      ACTIONS,
      "MODEL_SCHEMA_INVALID"
    );
  });

  it("rejects numeric relation fields (weight/score/...) — closed relation shape", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS", { score: 0.9 })
        ]
      }),
      ACTIONS,
      "MODEL_SCHEMA_INVALID"
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS", { weight: 0.5 })
        ]
      }),
      ACTIONS,
      "MODEL_SCHEMA_INVALID"
    );
  });

  it("rejects label redeclaration inside the locator (MODEL_BELIEF_LABEL_AUTHORITY=NONE)", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    const payload = validPayload(projection, actionSpaceFingerprint, {
      state_action_relations: [
        {
          state_locator: {
            domain: "BELIEF",
            proposition_id: "prop.bob-trustworthy",
            proposition_label: "Bob is trustworthy"
          },
          action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
          relation: "SUPPORTS"
        }
      ]
    });
    await expectRejection(payload, ACTIONS, "MODEL_INVALID_STATE_LOCATOR");
  });

  it("rejects unknown proposition, wrong domain and bad locator shape", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [relation("prop.never-projected", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
      }),
      ACTIONS,
      "MODEL_UNKNOWN_PROPOSITION"
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [
          {
            state_locator: { domain: "PERSONALITY", proposition_id: "prop.bob-trustworthy" },
            action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
            relation: "SUPPORTS"
          }
        ]
      }),
      ACTIONS,
      "MODEL_INVALID_STATE_LOCATOR"
    );
  });

  it("enforces EXACT_TUPLE membership: unknown action, wrong target, null-target exactness", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    // Unknown action type.
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [relation("prop.bob-trustworthy", "TELEPORT", null, "SUPPORTS")]
      }),
      ACTIONS,
      "MODEL_ACTION_NOT_ALLOWED"
    );
    // Host allows ("communicate", entity:bob); model targets entity:alice → no type-only match.
    const ctx2 = await buildContext([{ action_type: "communicate", target_ref: "entity:bob" }]);
    const wrongTarget = validPayload(ctx2.projection, ctx2.actionSpaceFingerprint, {
      state_action_relations: [relation("prop.bob-trustworthy", "communicate", "entity:alice", "SUPPORTS")]
    });
    const err1 = await validateAndNormalizeCognitionProposalV1(wrongTarget, {
      projection: ctx2.projection,
      canonical_actions: ctx2.canonicalActions,
      action_space_fingerprint: ctx2.actionSpaceFingerprint
    }).catch((e: unknown) => e);
    expect((err1 as CognitionRelationRejectionErrorV1).code).toBe("MODEL_ACTION_NOT_ALLOWED");

    // Host allows ("WAIT", null): non-null target rejects; exact null accepts — and vice versa.
    const nullHost = await buildContext([{ action_type: "WAIT", target_ref: null }]);
    const withTarget = validPayload(nullHost.projection, nullHost.actionSpaceFingerprint, {
      state_action_relations: [relation("prop.bob-trustworthy", "WAIT", "entity:bob", "SUPPORTS")]
    });
    const err2 = await validateAndNormalizeCognitionProposalV1(withTarget, {
      projection: nullHost.projection,
      canonical_actions: nullHost.canonicalActions,
      action_space_fingerprint: nullHost.actionSpaceFingerprint
    }).catch((e: unknown) => e);
    expect((err2 as CognitionRelationRejectionErrorV1).code).toBe("MODEL_ACTION_NOT_ALLOWED");

    const exactNull = validPayload(nullHost.projection, nullHost.actionSpaceFingerprint, {
      state_action_relations: [relation("prop.bob-trustworthy", "WAIT", null, "SUPPORTS")]
    });
    const okNull = await validateAndNormalizeCognitionProposalV1(exactNull, {
      projection: nullHost.projection,
      canonical_actions: nullHost.canonicalActions,
      action_space_fingerprint: nullHost.actionSpaceFingerprint
    });
    expect(okNull.state_action_relations).toHaveLength(1);

    // Vice versa: host allows target-bearing tuple; null target rejects.
    const targetHost = await buildContext([{ action_type: "WAIT", target_ref: "entity:bob" }]);
    const nullModel = validPayload(targetHost.projection, targetHost.actionSpaceFingerprint, {
      state_action_relations: [relation("prop.bob-trustworthy", "WAIT", null, "SUPPORTS")]
    });
    const err3 = await validateAndNormalizeCognitionProposalV1(nullModel, {
      projection: targetHost.projection,
      canonical_actions: targetHost.canonicalActions,
      action_space_fingerprint: targetHost.actionSpaceFingerprint
    }).catch((e: unknown) => e);
    expect((err3 as CognitionRelationRejectionErrorV1).code).toBe("MODEL_ACTION_NOT_ALLOWED");
  });

  it("rejects duplicate and conflicting relation pairs (no dedup, no last-write-wins)", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")
        ]
      }),
      ACTIONS,
      "MODEL_DUPLICATE_RELATION_PAIR"
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        state_action_relations: [
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
          relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES")
        ]
      }),
      ACTIONS,
      "MODEL_DUPLICATE_RELATION_PAIR"
    );
  });

  it("rejects projection_hash / action_space_fingerprint mismatches", async () => {
    const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        projection_hash: `sha256:${"0".repeat(64)}`
      }),
      ACTIONS,
      "MODEL_PROJECTION_MISMATCH"
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, {
        action_space_fingerprint: `sha256:${"1".repeat(64)}`
      }),
      ACTIONS,
      "MODEL_ACTION_SPACE_MISMATCH"
    );
  });

  it("guards the V2-observed failure class: belief IDs in ref arrays fail closed (no strip, no migration)", async () => {
    for (const field of ["evidence_refs", "considered_context_refs", "relevant_memory_refs"]) {
      const { projection, actionSpaceFingerprint } = await buildContext(ACTIONS);
      const error = await validateAndNormalizeCognitionProposalV1(
        validPayload(projection, actionSpaceFingerprint, { [field]: ["prop.bob-trustworthy"] }),
        {
          projection,
          canonical_actions: canonicalActionsOf(ACTIONS),
          action_space_fingerprint: actionSpaceFingerprint
        }
      ).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CognitionRelationRejectionErrorV1);
      // "prop.bob-trustworthy" has no ref kind prefix — closed grammar rejects.
      expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_SCHEMA_INVALID");
    }
  });

  it("rejects duplicate refs and canonicalizes ref array order (copy, never repair)", async () => {
    const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(ACTIONS);
    const duplicateRefs = validPayload(projection, actionSpaceFingerprint, {
      evidence_refs: ["episode:e1", "episode:e1"]
    });
    const error = await validateAndNormalizeCognitionProposalV1(duplicateRefs, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    }).catch((e: unknown) => e);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_SCHEMA_INVALID");

    const unsorted = validPayload(projection, actionSpaceFingerprint, {
      evidence_refs: ["episode:e2", "episode:e1"]
    });
    const normalized = await validateAndNormalizeCognitionProposalV1(unsorted, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    });
    expect(normalized.evidence_refs).toEqual(["episode:e1", "episode:e2"]);
  });

  it("enforces cardinality: B=0/A=0 forces empty relations; relations <= min(64, B*A)", async () => {
    // Zero projected beliefs: any relation fails closed.
    const noBeliefs = await buildProjection({ workingRefs: ["episode:e1"] });
    const spaceA = validateAllowedActionSpaceV1(ACTIONS);
    if (!spaceA.ok) throw new Error("fixture");
    const fpA = await deriveCognitionActionSpaceFingerprintV1(spaceA.value);
    const payload = validPayload(noBeliefs, fpA, {
      state_action_relations: [relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS")]
    });
    const error = await validateAndNormalizeCognitionProposalV1(payload, {
      projection: noBeliefs,
      canonical_actions: spaceA.value,
      action_space_fingerprint: fpA
    }).catch((e: unknown) => e);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_RELATION_LIMIT_EXCEEDED");

    // B=2 beliefs, A=1 action: 3 relations exceed min(64, 2*1) = 2. The cheap
    // cardinality cap fires BEFORE membership/pair-uniqueness work (§41 step 6).
    const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(ACTIONS);
    const overflow = validPayload(projection, actionSpaceFingerprint, {
      state_action_relations: [
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "OPPOSES"),
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "IRRELEVANT")
      ]
    });
    const err2 = await validateAndNormalizeCognitionProposalV1(overflow, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    }).catch((e: unknown) => e);
    expect((err2 as CognitionRelationRejectionErrorV1).code).toBe("MODEL_RELATION_LIMIT_EXCEEDED");

    // Hard cap: >64 relations.
    const many = Array.from({ length: 65 }, (_, i) =>
      relation(`p${String(i).padStart(2, "0")}`, "TRY_EAST_ENTRANCE", null, "SUPPORTS")
    );
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, { state_action_relations: many }),
      ACTIONS,
      "MODEL_RELATION_LIMIT_EXCEEDED"
    );

    // Empty relations remain LAWFUL.
    const empty = validPayload(projection, actionSpaceFingerprint);
    const normalized = await validateAndNormalizeCognitionProposalV1(empty, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    });
    expect(normalized.state_action_relations).toEqual([]);
  });

  it("canonical relation comparator: scrambled model order → frozen canonical order", async () => {
    const actions = [
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null }
    ];
    const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(actions);
    const scrambled = validPayload(projection, actionSpaceFingerprint, {
      state_action_relations: [
        relation("prop.bob-trustworthy", "TRY_WEST_ENTRANCE", null, "OPPOSES"),
        relation("prop.alex-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
        relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "IRRELEVANT")
      ]
    });
    const normalized = await validateAndNormalizeCognitionProposalV1(scrambled, {
      projection,
      canonical_actions: canonicalActions,
      action_space_fingerprint: actionSpaceFingerprint
    });
    expect(
      normalized.state_action_relations.map((r) => [
        r.state_locator.proposition_id,
        r.action.action_type,
        r.relation
      ])
    ).toEqual([
      ["prop.alex-trustworthy", "TRY_EAST_ENTRANCE", "SUPPORTS"],
      ["prop.bob-trustworthy", "TRY_EAST_ENTRANCE", "IRRELEVANT"],
      ["prop.bob-trustworthy", "TRY_WEST_ENTRANCE", "OPPOSES"]
    ]);
  });

  it("accepted proposal fingerprint: deterministic; relation order carries NO authority", async () => {
    const actions = [
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null }
    ];
    const ctxA = await buildContext(actions);
    const ctxB = await buildContext(actions);
    const relationsA = [
      relation("prop.bob-trustworthy", "TRY_EAST_ENTRANCE", null, "SUPPORTS"),
      relation("prop.alex-trustworthy", "TRY_WEST_ENTRANCE", null, "OPPOSES")
    ];
    const relationsB = [...relationsA].reverse();

    const normA = await validateAndNormalizeCognitionProposalV1(
      validPayload(ctxA.projection, ctxA.actionSpaceFingerprint, { state_action_relations: relationsA }),
      {
        projection: ctxA.projection,
        canonical_actions: ctxA.canonicalActions,
        action_space_fingerprint: ctxA.actionSpaceFingerprint
      }
    );
    const normB = await validateAndNormalizeCognitionProposalV1(
      validPayload(ctxB.projection, ctxB.actionSpaceFingerprint, { state_action_relations: relationsB }),
      {
        projection: ctxB.projection,
        canonical_actions: ctxB.canonicalActions,
        action_space_fingerprint: ctxB.actionSpaceFingerprint
      }
    );
    expect(JSON.stringify(normA)).toBe(JSON.stringify(normB));

    const anchors = {
      subject_id: ctxA.projection.subject_id,
      state_revision: ctxA.projection.state_revision,
      current_logical_time: ctxA.projection.current_logical_time,
      projection_hash: ctxA.projection.projection_hash,
      action_space_fingerprint: ctxA.actionSpaceFingerprint
    };
    const fpA = await deriveAcceptedCognitionProposalFingerprintV1({ ...anchors, proposal: normA });
    const fpB = await deriveAcceptedCognitionProposalFingerprintV1({ ...anchors, proposal: normB });
    expect(fpA).toBe(fpB);
    expect(fpA).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("confidence/uncertainty are independently validated (no sum-to-one rule)", async () => {
    const { projection, canonicalActions, actionSpaceFingerprint } = await buildContext(ACTIONS);
    const normalized = await validateAndNormalizeCognitionProposalV1(
      validPayload(projection, actionSpaceFingerprint, { confidence: 0.9, uncertainty: 0.9 }),
      { projection, canonical_actions: canonicalActions, action_space_fingerprint: actionSpaceFingerprint }
    );
    expect(normalized.confidence).toBe(0.9);
    expect(normalized.uncertainty).toBe(0.9);
    await expectRejection(
      validPayload(projection, actionSpaceFingerprint, { confidence: 1.5 }),
      ACTIONS,
      "MODEL_SCHEMA_INVALID"
    );
  });
});

/** Fixture helper: validated canonical actions for the standard two-belief context. */
function canonicalActionsOf(actions: readonly { action_type: string; target_ref: string | null }[]) {
  const result = validateAllowedActionSpaceV1(actions);
  if (!result.ok) throw new Error(`fixture action space invalid: ${result.error.detail}`);
  return result.value;
}
