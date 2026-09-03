/**
 * Interaction Familiarity Read Projection V0 — acceptance suite
 * (INTERACTION_FAMILIARITY_READ_PROJECTION_V0, READ-ONLY):
 *
 *   CONTRACT      exact closed 13-field schema, admitted semantics binding,
 *                 ordinal_max 32, STATE_VISIBLE_NOT_CITEABLE
 *   ABSENCE       ABSENT != PRESENT 0; ABSENT projects nulls; PRESENT 0 is an
 *                 unlawful state that fails closed
 *   PRESENT       exact grid values → exact ordinals (1/32→1, 16/32→16, 1→32)
 *   INVALID       off-grid / NaN / Infinity / negative / >1 / duplicate /
 *                 malformed Relationship state all FAIL CLOSED (no coercion)
 *   ISOLATION     Alice projection never contains Bob state (and vice versa)
 *   COGNITION     the projection reaches the existing cognitive context
 *                 surface as structured semantics; raw governed values never
 *                 leak; the semantic boundary is rendered; determinism and
 *                 hash binding hold
 *   RESTORE       committed familiarity → authoritative restore → identical
 *                 projection from the restored canonical state
 *
 * Fully OFFLINE: zero real-model calls.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  type CanonicalRefV0,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import { InMemoryMemoryRepository, type EpisodicMemoryRecordV0 } from "@characteros-next/memory";

import {
  deriveInteractionFamiliarityReadProjectionV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_SCHEMA_VERSION_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_VISIBILITY_V0,
  type RelationshipInteractionFamiliarityReadProjectionV0
} from "./relationship-interaction-familiarity-read-projection.js";
import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0
} from "./relationship-feature-decision-semantics.js";
import { buildCognitiveContextProjection } from "../cognition-action/cognition-action-transition-executor.js";
import { verifyCognitiveProjectionIntegrityV1 } from "../cognition-action/belief-decision-influence-relation.js";
import { buildCognitivePromptMessagesV1 } from "../../providers/cognition/cognitive-prompt-projection-v1.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "../../authority/restore-chain-authority.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0
} from "./relationship-interaction-familiarity-ingestion.js";

const ALICE = "entity:alice-like";
const BOB = "entity:bob-like";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;

// ---- fixtures ---------------------------------------------------------------------------

function subjectState(input: {
  readonly revision?: number;
  readonly counterparts: readonly {
    readonly counterpart_ref: string;
    readonly dimensions: readonly { dimension_id: string; value: number }[];
  }[];
}): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: "R0",
      consolidation_cursor: null,
      retrieval_config: {
        profile_id: "RETRIEVAL_V0",
        affect_congruence_enabled: false,
        recent_trace_capacity: 64
      },
      recent_retrieval_trace: [],
      lifecycle_metadata: {},
      pending_encoding_refs: [],
      last_retrieval_at: null
    },
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: input.counterparts.map((entry) => ({
        counterpart_ref: entry.counterpart_ref,
        dimensions: [...entry.dimensions]
      }))
    },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: null
    },
    mechanism_config: {
      affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
      legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
      feature_flags: {},
      thresholds: {}
    },
    trace_window: {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: input.revision ?? 3,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  } as unknown as SubjectStateV0;
}

function aliceOnly(familiarity: number | null): SubjectStateV0 {
  return subjectState({
    counterparts: [
      {
        counterpart_ref: ALICE,
        dimensions:
          familiarity === null
            ? [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }]
            : [
                { dimension_id: "arbitrary_host_dimension", value: 0.25 },
                { dimension_id: FAMILIARITY, value: familiarity }
              ]
      }
    ]
  });
}

async function project(
  state: SubjectStateV0,
  counterpartRef: string = ALICE
): Promise<ReturnType<typeof deriveInteractionFamiliarityReadProjectionV0>> {
  return deriveInteractionFamiliarityReadProjectionV0({
    subjectState: state,
    counterpart_ref: counterpartRef as CanonicalRefV0
  });
}

// ---- projection contract -----------------------------------------------------------------

describe("projection contract", () => {
  it("projects the exact closed schema with the admitted semantics bound internally", async () => {
    const result = await project(aliceOnly(1 / 32));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const projection: RelationshipInteractionFamiliarityReadProjectionV0 = result.projection;
    expect(Object.keys(projection).sort()).toStrictEqual(
      [
        "canonical_value",
        "counterpart_ref",
        "dimension_id",
        "feature_semantics_contract_fingerprint",
        "feature_semantics_contract_id",
        "ordinal_level",
        "ordinal_max",
        "presence",
        "quantity_semantics_id",
        "schema_version",
        "source_state_revision",
        "subject_id",
        "visibility"
      ].sort()
    );
    expect(projection.schema_version).toBe(RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_SCHEMA_VERSION_V0);
    expect(projection.subject_id).toBe("subject-s0");
    expect(projection.source_state_revision).toBe(3);
    expect(projection.counterpart_ref).toBe(ALICE);
    expect(projection.dimension_id).toBe(INTERACTION_FAMILIARITY_DIMENSION_ID_V0);
    expect(projection.feature_semantics_contract_id).toBe(INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0);
    expect(projection.feature_semantics_contract_fingerprint).toBe(
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
    );
    expect(projection.quantity_semantics_id).toBe(INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0);
    expect(projection.ordinal_max).toBe(32);
    expect(projection.visibility).toBe(RELATIONSHIP_INTERACTION_FAMILIARITY_READ_PROJECTION_VISIBILITY_V0);
    expect(projection.visibility).toBe("STATE_VISIBLE_NOT_CITEABLE");
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it("carries no episode/evidence/authority refs and no utility field", async () => {
    const result = await project(aliceOnly(1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.projection);
    expect(serialized.includes("episode:")).toBe(false);
    expect(serialized.includes("appraisal:")).toBe(false);
    expect(serialized.includes("commit:")).toBe(false);
    expect("utility" in result.projection).toBe(false);
    expect("tendency" in result.projection).toBe(false);
  });
});

// ---- absence ------------------------------------------------------------------------------

describe("absence semantics", () => {
  it("projects ABSENT with null canonical value and null ordinal for a registered counterpart", async () => {
    const result = await project(aliceOnly(null));
    expect(result).toMatchObject({
      ok: true,
      projection: {
        presence: "ABSENT",
        canonical_value: null,
        ordinal_level: null,
        ordinal_max: 32
      }
    });
  });

  it("keeps ABSENT and PRESENT 0 lawful, structurally and hash-distinct, never coerced", async () => {
    // PRESENT 0 is a VALID grid state: present familiarity at its lower endpoint.
    const zero = await project(aliceOnly(0));
    expect(zero).toMatchObject({
      ok: true,
      projection: {
        presence: "PRESENT",
        canonical_value: 0,
        ordinal_level: 0,
        ordinal_max: 32
      }
    });

    const absent = await project(aliceOnly(null));
    expect(absent).toMatchObject({
      ok: true,
      projection: { presence: "ABSENT", canonical_value: null, ordinal_level: null }
    });

    // structurally distinct — never coerced into each other
    if (!zero.ok || !absent.ok) return;
    expect(absent.projection).not.toStrictEqual(zero.projection);

    // hash-distinct under the existing cognitive projection binding
    const absentView = await buildCognitiveContextProjection(aliceOnly(null));
    const zeroView = await buildCognitiveContextProjection(aliceOnly(0));
    expect(absentView.projection_hash).not.toBe(zeroView.projection_hash);
    expect(absentView.interaction_familiarity[0]?.presence).toBe("ABSENT");
    expect(zeroView.interaction_familiarity[0]?.presence).toBe("PRESENT");
    expect(zeroView.interaction_familiarity[0]?.canonical_value).toBe(0);
    expect(zeroView.interaction_familiarity[0]?.ordinal_level).toBe(0);

    // deterministic PRESENT 0 projection/hash
    const zeroAgain = await buildCognitiveContextProjection(aliceOnly(0));
    expect(zeroAgain.projection_hash).toBe(zeroView.projection_hash);
    expect(zeroAgain.interaction_familiarity).toStrictEqual(zeroView.interaction_familiarity);
  });
});

// ---- present state --------------------------------------------------------------------------

describe("present state", () => {
  it("projects exact ordinals for exact grid values and retains the exact canonical value", async () => {
    for (const [value, ordinal] of [
      [1 / 32, 1],
      [16 / 32, 16],
      [1, 32]
    ] as const) {
      const result = await project(aliceOnly(value));
      expect(result.ok, `value ${String(value)}`).toBe(true);
      if (!result.ok) continue;
      expect(result.projection.presence).toBe("PRESENT");
      expect(result.projection.canonical_value).toBe(value);
      expect(result.projection.ordinal_level).toBe(ordinal);
    }
  });
});

// ---- invalid state ---------------------------------------------------------------------------

describe("invalid state fails closed", () => {
  it("rejects off-grid, non-finite, negative and >1 values without coercion", async () => {
    for (const value of [0.1, 1 / 3, 0.999, Number.NaN, Number.POSITIVE_INFINITY, -1 / 32, 1.5]) {
      const result = await project(aliceOnly(value));
      expect(result.ok, `value ${String(value)}`).toBe(false);
      if (!result.ok) expect(result.code).toBe("FAMILIARITY_STATE_MALFORMED");
    }
  });

  it("rejects malformed Relationship state and duplicate familiarity entries", async () => {
    const brokenRelationships = subjectState({ counterparts: [] });
    (brokenRelationships as unknown as Record<string, unknown>)["relationships"] = "not-an-object";
    expect(await project(brokenRelationships)).toMatchObject({
      ok: false,
      code: "MALFORMED_RELATIONSHIP_STATE"
    });

    const duplicated = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: FAMILIARITY, value: 1 / 32 },
            { dimension_id: FAMILIARITY, value: 2 / 32 }
          ]
        }
      ]
    });
    expect(await project(duplicated)).toMatchObject({
      ok: false,
      code: "FAMILIARITY_STATE_MALFORMED"
    });

    const missingCounterpart = subjectState({
      counterparts: [{ counterpart_ref: BOB, dimensions: [] }]
    });
    expect(await project(missingCounterpart)).toMatchObject({
      ok: false,
      code: "COUNTERPART_NOT_REGISTERED"
    });
  });
});

// ---- counterpart isolation -------------------------------------------------------------------

describe("counterpart isolation", () => {
  it("never leaks familiarity across counterparts and never aggregates", async () => {
    const both = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 1 / 32 }
          ]
        },
        {
          counterpart_ref: BOB,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.4 },
            { dimension_id: FAMILIARITY, value: 16 / 32 }
          ]
        }
      ]
    });
    const alice = await project(both, ALICE);
    const bob = await project(both, BOB);
    expect(alice).toMatchObject({ ok: true, projection: { counterpart_ref: ALICE, ordinal_level: 1 } });
    expect(bob).toMatchObject({ ok: true, projection: { counterpart_ref: BOB, ordinal_level: 16 } });
    if (alice.ok && bob.ok) {
      expect(JSON.stringify(alice.projection)).not.toContain("16");
      expect(JSON.stringify(bob.projection)).not.toContain("0.03125");
      // no global relationship familiarity scalar exists anywhere
      expect("aggregate" in alice.projection).toBe(false);
    }
  });
});

// ---- cognition visibility ----------------------------------------------------------------------

describe("cognition visibility", () => {
  it("exposes the structured projection, hides raw governed values, and binds the hash", async () => {
    const state = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 1 / 32 }
          ]
        },
        {
          counterpart_ref: BOB,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.4 },
            { dimension_id: FAMILIARITY, value: 16 / 32 }
          ]
        }
      ]
    });
    const projection = await buildCognitiveContextProjection(state);

    // structured semantic entries, counterpart-sorted, no leakage
    expect(projection.interaction_familiarity).toHaveLength(2);
    expect(projection.interaction_familiarity[0]?.counterpart_ref).toBe(ALICE);
    expect(projection.interaction_familiarity[0]?.presence).toBe("PRESENT");
    expect(projection.interaction_familiarity[0]?.ordinal_level).toBe(1);
    expect(projection.interaction_familiarity[1]?.counterpart_ref).toBe(BOB);
    expect(projection.interaction_familiarity[1]?.ordinal_level).toBe(16);

    // raw governed values never leak; generic dims are unchanged
    expect(
      projection.relationship_dimensions.filter((dimension) =>
        dimension.dimension_id.startsWith("relationship_core_")
      )
    ).toStrictEqual([]);
    expect(projection.relationship_dimensions).toHaveLength(2);
    expect(projection.relationship_dimensions.every((d) => d.dimension_id === "arbitrary_host_dimension")).toBe(true);

    // the projection hash binds the familiarity content
    const integrity = await verifyCognitiveProjectionIntegrityV1(projection);
    expect(integrity.ok).toBe(true);

    // determinism: same state → same projection and hash
    const again = await buildCognitiveContextProjection(subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 1 / 32 }
          ]
        },
        {
          counterpart_ref: BOB,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.4 },
            { dimension_id: FAMILIARITY, value: 16 / 32 }
          ]
        }
      ]
    }));
    expect(again.projection_hash).toBe(projection.projection_hash);
    expect(again.interaction_familiarity).toStrictEqual(projection.interaction_familiarity);

    // changed familiarity → changed projection hash
    const changed = await buildCognitiveContextProjection(subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 2 / 32 }
          ]
        },
        {
          counterpart_ref: BOB,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.4 },
            { dimension_id: FAMILIARITY, value: 16 / 32 }
          ]
        }
      ]
    }));
    expect(changed.projection_hash).not.toBe(projection.projection_hash);

    // an unknown reserved governed dimension is not projected and not leaked
    const unknownReserved = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [{ dimension_id: "relationship_core_unknown_feature_v0", value: 0.5 }]
        }
      ]
    });
    const unknownProjection = await buildCognitiveContextProjection(unknownReserved);
    expect(unknownProjection.interaction_familiarity).toHaveLength(1);
    expect(unknownProjection.interaction_familiarity[0]?.presence).toBe("ABSENT");
    expect(unknownProjection.relationship_dimensions).toStrictEqual([]);
  });

  it("renders the semantic boundary and never raw governed values into the model prompt", async () => {
    const state = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 1 / 32 }
          ]
        },
        {
          counterpart_ref: BOB,
          dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.4 }]
        }
      ]
    });
    const projection = await buildCognitiveContextProjection(state);
    const messages = buildCognitivePromptMessagesV1({
      projection,
      canonical_actions: [],
      action_space_fingerprint: "sha256:4444444444444444444444444444444444444444444444444444444444444444" as never,
      allowed_evidence_refs: []
    } as never);
    const userContent = messages[1]?.content ?? "";
    expect(userContent).toContain("[interaction familiarity");
    expect(userContent).toContain("STATE_VISIBLE_NOT_CITEABLE");
    expect(userContent).toContain(`${ALICE}: presence=PRESENT level=1/32`);
    expect(userContent).toContain(`${BOB}: presence=ABSENT`);
    // semantic exclusions are explicit, not left for the model to infer
    expect(userContent).toContain("familiarity does NOT imply trust");
    expect(userContent).toContain("liking");
    expect(userContent).toContain("higher is NOT better");
    // the raw governed dimension never reaches the model unexplained
    expect(userContent).not.toContain(`${FAMILIARITY}=`);
    expect(userContent).not.toContain("0.03125");

    // PRESENT 0 renders distinctly from ABSENT (lower endpoint, not absence,
    // and not an interaction occurrence)
    const zeroState = subjectState({
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: "arbitrary_host_dimension", value: 0.25 },
            { dimension_id: FAMILIARITY, value: 0 }
          ]
        }
      ]
    });
    const zeroRender = buildCognitivePromptMessagesV1({
      projection: await buildCognitiveContextProjection(zeroState),
      canonical_actions: [],
      action_space_fingerprint: "sha256:4444444444444444444444444444444444444444444444444444444444444444" as never,
      allowed_evidence_refs: []
    } as never);
    const zeroContent = zeroRender[1]?.content ?? "";
    expect(zeroContent).toContain(`${ALICE}: presence=PRESENT level=0/32`);
    expect(zeroContent).not.toContain(`${ALICE}: presence=ABSENT`);
  });
});

// ---- restore proof ---------------------------------------------------------------------------

describe("restore equivalence", () => {
  it("projects identically before and after authoritative restore", { timeout: 30_000 }, async () => {
    // live composition: head commit + one governed familiarity ingestion commit
    const memory = new InMemoryMemoryRepository();
    const episode: EpisodicMemoryRecordV0 = {
      schema_version: "episodic-memory-record-v0",
      episode_ref: "episode:e-restore-1" as never,
      occurrence_logical_time: 1 as never,
      recorded_at_logical_time: 1 as never,
      provenance: { transition_id: "t-enc-1" as never, producer: "memory", cause_refs: [] },
      references: [ALICE as never],
      context: { scene: "walked with alice", focus_refs: [ALICE as never], environment_refs: [] },
      appraisal_ref: null,
      affect_snapshot_ref: null,
      salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" }
    };
    const storedHash = await memory.storePayload(episode.episode_ref as never, episode);
    const prepared = await memory.prepareRevisionForIntent({
      intent_id: "intent-restore-proof" as never,
      parent_revision: null,
      records: [{ ref: episode.episode_ref as never, payload_hash: storedHash }]
    });
    const genesisState = subjectState({
      revision: 0,
      counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }]
    });
    (genesisState as unknown as Record<string, unknown>)["memory_state"] = {
      ...((genesisState as unknown as Record<string, unknown>)["memory_state"] as Record<string, unknown>),
      repository_revision: prepared.repository_revision
    };
    const assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([["subject-s0" as never, genesisState]]),
      preparedResultValidator: async () => true
    });
    const deps: InteractionFamiliarityIngestionDepsV0 = {
      memory,
      assembly,
      admissionProvider: { admit: async () => ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" }) },
      repositoryBindings: [
        { repository_revision: "R0", repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444" } as never
      ],
      readGenesisSnapshot: async () => genesisState
    };
    const headProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-restore-head",
      subject_id: "subject-s0",
      transition_type: "Relationship",
      expected_state_revision: 0,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
      cause_refs: [],
      domain_deltas: [
        {
          producer: "relationship",
          domain: "relationship",
          expected_repository_revision: null,
          operations: [
            {
              path: "/relationships",
              value: {
                schema_version: "relationship-state-v0",
                counterparts: [
                  { counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }
                ]
              }
            }
          ],
          provenance_refs: []
        }
      ],
      external_refs: []
    } as unknown as never;
    const reservedHead = await assembly.facade.reserveAndRoute(headProposal as never);
    if (reservedHead.kind !== "CONTINUE") throw new Error("fixture head reservation failed");
    await assembly.facade.commitReserved({
      proposal: headProposal as never,
      continuation: reservedHead.continuation,
      producerAuthorization: assembly.producerAuthorizationIssuer.issue([
        { producer: "relationship", domain: "relationship" }
      ]),
      preparedBinding: {
        transition_id: "t-restore-head" as never,
        subject_id: "subject-s0" as never,
        transition_type: "Relationship",
        payload_fingerprint: reservedHead.continuation.payload_fingerprint,
        prepared_result_ref: "workflow:w-t-restore-head" as never
      },
      repository_bindings: [
        { repository_revision: "R0", repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444" } as never
      ]
    });
    const ingestion = await processInteractionExperience(deps, {
      subject_id: "subject-s0" as never,
      counterpart_ref: ALICE as never,
      episode
    });
    expect(ingestion).toMatchObject({ kind: "QUALIFIED_AND_COMMITTED", familiarity: { next: 1 / 32 } });

    const liveState = (await assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
    const before = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: liveState,
      counterpart_ref: ALICE as never
    });
    expect(before.ok).toBe(true);

    // authoritative restore over the exact committed chain
    const bundles = assembly.storeRead.getCommittedBundles();
    const terminal = bundles[bundles.length - 1];
    if (!terminal) throw new Error("fixture terminal bundle missing");
    const genesisEnvelope = await createPersistenceEnvelope({
      snapshot: genesisState,
      repository_bindings: [
        { repository_revision: "R0", repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444" } as never
      ],
      commit_head: null
    });
    if (!genesisEnvelope.ok) throw new Error("fixture genesis envelope failed");
    const boundary = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: genesisEnvelope.value,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: terminal.subject_id,
        revision: terminal.next_revision,
        commit_ref: terminal.commit_ref,
        record_checksum: terminal.record_checksum,
        state_hash: terminal.state_hash_after,
        snapshot_hash: terminal.snapshot_hash_after
      } as never
    });
    if (boundary.kind !== "MINTED") throw new Error("fixture boundary mint failed");
    const terminalEnvelope = await createPersistenceEnvelope({
      snapshot: terminal.next_snapshot,
      repository_bindings: [
        { repository_revision: "R0", repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444" } as never
      ],
      commit_head: { commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum } as never
    });
    if (!terminalEnvelope.ok) throw new Error("fixture terminal envelope failed");
    const restored = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: terminalEnvelope.value,
      trusted_boundary: boundary.receipt,
      bundles
    });
    expect(restored.kind).toBe("RESTORED");
    if (restored.kind !== "RESTORED") return;

    const after = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: restored.restored_snapshot as SubjectStateV0,
      counterpart_ref: ALICE as never
    });
    expect(after.ok).toBe(true);
    // the restored canonical state yields the EXACT same semantic projection
    expect(after.ok && before.ok ? after.projection : null).toStrictEqual(before.ok ? before.projection : null);
  });
});
