/**
 * Interaction Familiarity Cognition Influence V0 — acceptance suite
 * (RELATIONSHIP_FAMILIARITY_COGNITION_INFLUENCE_V0):
 *
 *   POLICY        fixed V0 matrix: ABSENT / PRESENT 0 / PRESENT 1 →
 *                 BASIC_CONTEXT_FIRST; PRESENT 2..32 →
 *                 COUNTERPART_CONTEXT_SEARCH_FIRST; threshold 2 owned by the
 *                 ONE policy module; ABSENT != PRESENT 0 while strategies
 *                 intentionally coincide
 *   ACTIVE GATE   influence only for canonically registered counterparts whose
 *                 exact ref is in context.active_entity_refs; no leakage
 *                 across counterparts; no global influence
 *   ISOLATION     opaque generic Relationship dimensions never feed the policy
 *   DETERMINISM   same inputs → strict-equal artifact/hash; 1→2 boundary
 *                 changes the artifact and parent hash; 2/32 and 16/32 share
 *                 ONE categorical strategy; same k / different revision → same
 *                 artifact
 *   LAYER A       REAL lived-history causal proof through the frozen
 *                 experience-ingestion path: Arm A (1 qualifying experience →
 *                 1/32 → BASIC_CONTEXT_FIRST) vs Arm B (16 qualifying
 *                 experiences → 16/32 → COUNTERPART_CONTEXT_SEARCH_FIRST) from
 *                 equivalent fixtures — real-model calls ZERO,
 *                 familiarity-triggered retrieval calls ZERO
 *   RESTORE       pre/post authoritative-restore strategy equivalence for both
 *                 arms, no manual familiarity reconstruction
 *   PROMPT        the shared deterministic rendering distinguishes the two
 *                 strategies, encodes no trust/liking/safety/utility/evidence,
 *                 and stays NOT citeable; identical across V0/V1 paths
 *
 * Fully OFFLINE: zero real-model calls.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV0 } from "../cognition-action/types.js";
import { InMemoryMemoryRepository, type EpisodicMemoryRecordV0 } from "@characteros-next/memory";

import {
  COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0,
  deriveInteractionFamiliarityCognitionInfluenceV0,
  renderInteractionFamiliarityCognitionInfluencesV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_COGNITION_INFLUENCE_SCHEMA_VERSION_V0
} from "./relationship-interaction-familiarity-cognition-influence.js";
import {
  buildCognitiveContextProjection,
} from "../cognition-action/cognition-action-transition-executor.js";
import { verifyCognitiveProjectionIntegrityV1 } from "../cognition-action/belief-decision-influence-relation.js";
import {
  buildCognitivePromptMessagesV1
} from "../../providers/cognition/cognitive-prompt-projection-v1.js";
import {
  buildCognitivePromptMessages
} from "../../providers/cognition/cognitive-prompt-projection.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "../../authority/restore-chain-authority.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import {
  deriveInteractionFamiliarityReadProjectionV0
} from "./relationship-interaction-familiarity-read-projection.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0
} from "./relationship-interaction-familiarity-ingestion.js";
import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "./relationship-feature-decision-semantics.js";

const ALICE = "entity:alice-like";
const BOB = "entity:bob-like";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;
const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const SCENARIO_SCENE = `Alice says: "Can you help me revise that update in the usual way?"`;

// ---- fixtures ---------------------------------------------------------------------------

function subjectState(input: {
  readonly revision?: number;
  readonly counterparts: readonly {
    readonly counterpart_ref: string;
    readonly dimensions: readonly { dimension_id: string; value: number }[];
  }[];
  readonly activeEntityRefs?: readonly string[];
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
      scene: SCENARIO_SCENE,
      task: "revise the update",
      focus_refs: [],
      active_entity_refs: (input.activeEntityRefs ?? []) as never,
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

function aliceState(input: {
  readonly familiarity: number | null;
  readonly bobFamiliarity?: number | null;
  readonly activeAlice?: boolean;
  readonly activeBob?: boolean;
  readonly revision?: number;
  readonly hostValue?: number;
}): SubjectStateV0 {
  const counterparts: {
    counterpart_ref: string;
    dimensions: { dimension_id: string; value: number }[];
  }[] = [
    {
      counterpart_ref: ALICE,
      dimensions: [
        { dimension_id: "arbitrary_host_dimension", value: input.hostValue ?? 0.25 },
        ...(input.familiarity !== null ? [{ dimension_id: FAMILIARITY, value: input.familiarity }] : [])
      ]
    }
  ];
  if (input.bobFamiliarity !== undefined) {
    counterparts.push({
      counterpart_ref: BOB,
      dimensions: [
        { dimension_id: "arbitrary_host_dimension", value: 0.4 },
        ...(input.bobFamiliarity !== null ? [{ dimension_id: FAMILIARITY, value: input.bobFamiliarity }] : [])
      ]
    });
  }
  const active: string[] = [];
  if (input.activeAlice) active.push(ALICE);
  if (input.activeBob) active.push(BOB);
  return subjectState({
    ...(input.revision !== undefined ? { revision: input.revision } : {}),
    counterparts,
    activeEntityRefs: active
  });
}

function influenceFor(
  projection: CognitiveContextProjectionV0,
  counterpartRef: string
):
  | { readonly schema_version: string; readonly counterpart_ref: string; readonly context_resolution_strategy: string }
  | undefined {
  return projection.interaction_familiarity_cognition_influences?.find(
    (influence) => influence.counterpart_ref === counterpartRef
  );
}

// ---- fixed V0 policy matrix ----------------------------------------------------------------

describe("fixed V0 policy matrix", () => {
  it("maps ABSENT / PRESENT 0 / PRESENT 1 to BASIC_CONTEXT_FIRST", async () => {
    for (const familiarity of [null, 0, 1 / 32]) {
      const state = aliceState({ familiarity, activeAlice: true });
      const projection = await buildCognitiveContextProjection(state);
      const influence = influenceFor(projection, ALICE);
      expect(influence, `familiarity ${String(familiarity)}`).toBeDefined();
      expect(influence?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
      expect(influence?.schema_version).toBe(RELATIONSHIP_INTERACTION_FAMILIARITY_COGNITION_INFLUENCE_SCHEMA_VERSION_V0);
    }
  });

  it("maps PRESENT 2/32, 16/32 and 32/32 to COUNTERPART_CONTEXT_SEARCH_FIRST", async () => {
    for (const familiarity of [2 / 32, 16 / 32, 1]) {
      const state = aliceState({ familiarity, activeAlice: true });
      const projection = await buildCognitiveContextProjection(state);
      expect(influenceFor(projection, ALICE)?.context_resolution_strategy).toBe(
        "COUNTERPART_CONTEXT_SEARCH_FIRST"
      );
    }
  });

  it("owns the threshold 2 in ONE policy location", () => {
    expect(COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0).toBe(2);
  });

  it("maps source-ABSENT and source-PRESENT-0 to the SAME strategy while the sources stay distinct", async () => {
    const absentSource = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: aliceState({ familiarity: null, activeAlice: true }),
      counterpart_ref: ALICE as never
    });
    const zeroSource = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: aliceState({ familiarity: 0, activeAlice: true }),
      counterpart_ref: ALICE as never
    });
    expect(absentSource.ok && zeroSource.ok).toBe(true);
    if (!absentSource.ok || !zeroSource.ok) return;
    // frozen source semantics remain structurally distinct
    expect(absentSource.projection).not.toStrictEqual(zeroSource.projection);
    // the categorical V0 strategy intentionally coincides
    const absentInfluence = deriveInteractionFamiliarityCognitionInfluenceV0(absentSource.projection);
    const zeroInfluence = deriveInteractionFamiliarityCognitionInfluenceV0(zeroSource.projection);
    expect(absentInfluence).toStrictEqual(zeroInfluence);
    expect(absentInfluence.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
  });

  it("carries exactly the closed 3-field artifact — no values, refs, scores or explanations", async () => {
    const state = aliceState({ familiarity: 16 / 32, activeAlice: true });
    const projection = await buildCognitiveContextProjection(state);
    const influence = influenceFor(projection, ALICE);
    expect(Object.keys(influence as object).sort()).toStrictEqual([
      "context_resolution_strategy",
      "counterpart_ref",
      "schema_version"
    ]);
    const serialized = JSON.stringify(projection.interaction_familiarity_cognition_influences);
    for (const forbidden of ["ordinal", "canonical_value", "presence", "episode:", "appraisal:", "confidence", "score"]) {
      expect(serialized.includes(forbidden), forbidden).toBe(false);
    }
  });
});

// ---- active counterpart gate -----------------------------------------------------------------

describe("active counterpart gate", () => {
  it("emits influence only for ACTIVE registered counterparts", async () => {
    const active = await buildCognitiveContextProjection(
      aliceState({ familiarity: 2 / 32, activeAlice: true })
    );
    expect(influenceFor(active, ALICE)?.context_resolution_strategy).toBe(
      "COUNTERPART_CONTEXT_SEARCH_FIRST"
    );

    const inactive = await buildCognitiveContextProjection(
      aliceState({ familiarity: 2 / 32, activeAlice: false })
    );
    expect(inactive.interaction_familiarity_cognition_influences).toStrictEqual([]);
  });

  it("Bob familiarity changes never alter the Alice influence and never leak a Bob entry", async () => {
    const before = await buildCognitiveContextProjection(
      aliceState({ familiarity: 4 / 32, bobFamiliarity: null, activeAlice: true })
    );
    const afterBobChanges = await buildCognitiveContextProjection(
      aliceState({ familiarity: 4 / 32, bobFamiliarity: 16 / 32, activeAlice: true })
    );
    expect(influenceFor(before, ALICE)).toStrictEqual(influenceFor(afterBobChanges, ALICE));
    expect(influenceFor(afterBobChanges, BOB)).toBeUndefined();
    expect(afterBobChanges.interaction_familiarity_cognition_influences).toHaveLength(1);
  });

  it("emits each eligible active counterpart in raw-ASCII order without aggregation", async () => {
    const both = await buildCognitiveContextProjection(
      aliceState({ familiarity: 1 / 32, bobFamiliarity: 16 / 32, activeAlice: true, activeBob: true })
    );
    expect(both.interaction_familiarity_cognition_influences.map((influence) => influence.counterpart_ref)).toStrictEqual([
      ALICE,
      BOB
    ]);
    expect(influenceFor(both, ALICE)?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
    expect(influenceFor(both, BOB)?.context_resolution_strategy).toBe("COUNTERPART_CONTEXT_SEARCH_FIRST");
  });
});

// ---- opaque feature isolation ------------------------------------------------------------------

describe("opaque feature isolation", () => {
  it("changing generic Relationship dimensions never changes the influence", async () => {
    const base = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true, hostValue: 0.25 })
    );
    const changedGeneric = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true, hostValue: 0.9 })
    );
    expect(influenceFor(base, ALICE)).toStrictEqual(influenceFor(changedGeneric, ALICE));
  });
});

// ---- determinism ---------------------------------------------------------------------------------

describe("determinism", () => {
  it("same inputs → strict-equal artifact and same parent hash", async () => {
    const first = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true })
    );
    const second = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true })
    );
    expect(second.interaction_familiarity_cognition_influences).toStrictEqual(
      first.interaction_familiarity_cognition_influences
    );
    expect(second.projection_hash).toBe(first.projection_hash);
  });

  it("the 1/32 → 2/32 policy boundary changes the artifact and the parent hash", async () => {
    const low = await buildCognitiveContextProjection(
      aliceState({ familiarity: 1 / 32, activeAlice: true })
    );
    const high = await buildCognitiveContextProjection(
      aliceState({ familiarity: 2 / 32, activeAlice: true })
    );
    expect(influenceFor(low, ALICE)?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
    expect(influenceFor(high, ALICE)?.context_resolution_strategy).toBe(
      "COUNTERPART_CONTEXT_SEARCH_FIRST"
    );
    expect(high.projection_hash).not.toBe(low.projection_hash);
    const integrity = await verifyCognitiveProjectionIntegrityV1(high);
    expect(integrity.ok).toBe(true);
  });

  it("2/32 and 16/32 share ONE categorical strategy artifact for the same counterpart", async () => {
    const low = await buildCognitiveContextProjection(
      aliceState({ familiarity: 2 / 32, activeAlice: true })
    );
    const high = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true })
    );
    // V0 cognition policy is categorical — no "more search" at higher k
    expect(influenceFor(high, ALICE)).toStrictEqual(influenceFor(low, ALICE));
    // while the source familiarity projections remain different
    const lowSource = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: aliceState({ familiarity: 2 / 32, activeAlice: true }),
      counterpart_ref: ALICE as never
    });
    const highSource = await deriveInteractionFamiliarityReadProjectionV0({
      subjectState: aliceState({ familiarity: 16 / 32, activeAlice: true }),
      counterpart_ref: ALICE as never
    });
    expect(lowSource.ok && highSource.ok).toBe(true);
    if (lowSource.ok && highSource.ok) {
      expect(lowSource.projection).not.toStrictEqual(highSource.projection);
    }
  });

  it("same familiarity and active counterpart at a different revision → same artifact", async () => {
    const revisionA = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true, revision: 5 })
    );
    const revisionB = await buildCognitiveContextProjection(
      aliceState({ familiarity: 16 / 32, activeAlice: true, revision: 6 })
    );
    // the strategy is policy-derived; revision is not a hidden strategy input
    expect(influenceFor(revisionA, ALICE)).toStrictEqual(influenceFor(revisionB, ALICE));
    // the parent hash legitimately differs (revision is bound elsewhere)
    expect(revisionB.projection_hash).not.toBe(revisionA.projection_hash);
  });
});

// ---- Layer-A causal proof via REAL ingestion ------------------------------------------------------

interface CausalComposition {
  readonly deps: InteractionFamiliarityIngestionDepsV0;
  readonly assembly: ReturnType<typeof createInMemorySubjectCoreFacade>;
  readonly genesis: SubjectStateV0;
}

async function composeCausalArm(count: number): Promise<CausalComposition> {
  const memory = new InMemoryMemoryRepository();
  // Bind ALL of the arm's episodes into the subject's canonical memory revision
  // BEFORE building the genesis, so every lived ingestion verifies against the
  // subject's bound memory source. Equivalent fixture content; only the count
  // differs between arms.
  const records: { ref: never; payload_hash: never }[] = [];
  for (let index = 0; index < count; index++) {
    const episode = causalEpisode(index);
    const storedHash = await memory.storePayload(episode.episode_ref as never, episode);
    records.push({ ref: episode.episode_ref as never, payload_hash: storedHash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: `intent-causal-${count}` as never,
    parent_revision: null,
    records
  });
  const genesis = subjectState({
    revision: 0,
    counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }],
    activeEntityRefs: [ALICE]
  });
  (genesis as unknown as Record<string, unknown>)["memory_state"] = {
    ...((genesis as unknown as Record<string, unknown>)["memory_state"] as Record<string, unknown>),
    repository_revision: prepared.repository_revision
  };
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([["subject-s0" as never, genesis]]),
    preparedResultValidator: async () => true
  });
  return {
    deps: {
      memory,
      assembly,
      admissionProvider: {
        admit: async () => ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" })
      },
      repositoryBindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      readGenesisSnapshot: async () => genesis
    },
    assembly,
    genesis
  };
}

async function establishCausalHead(composition: CausalComposition): Promise<void> {
  const { assembly } = composition;
  const currentState = (await assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
  const revision = (currentState as unknown as { runtime_metadata: { state_revision: number } })
    .runtime_metadata.state_revision;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-influence-head",
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: revision,
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
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  if (reserved.kind !== "CONTINUE") throw new Error("fixture head reservation failed");
  const committed = await assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: "t-influence-head" as never,
      subject_id: "subject-s0" as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:w-t-influence-head" as never
    },
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
  });
  if (committed.kind !== "COMMITTED") throw new Error("fixture head commit failed");
}

function causalEpisode(index: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: `episode:e-causal-${index + 1}` as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: { transition_id: `t-enc-${index + 1}` as never, producer: "memory", cause_refs: [] },
    references: [ALICE as never],
    context: {
      scene: `qualifying firsthand interaction number ${index + 1} with alice`,
      focus_refs: [ALICE as never],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" }
  };
}

async function ingestArm(
  composition: CausalComposition,
  count: number
): Promise<SubjectStateV0> {
  for (let index = 0; index < count; index++) {
    const episode = causalEpisode(index);
    const outcome = await processInteractionExperience(composition.deps, {
      subject_id: "subject-s0" as never,
      counterpart_ref: ALICE as never,
      episode
    });
    expect(outcome.kind, `episode ${index + 1}`).toBe("QUALIFIED_AND_COMMITTED");
  }
  return (await composition.assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
}

describe("Layer-A causal proof (real lived histories, zero model calls)", () => {
  it(
    "Arm A: 1 real qualifying experience → 1/32 → BASIC_CONTEXT_FIRST; Arm B: 16 → 16/32 → COUNTERPART_CONTEXT_SEARCH_FIRST",
    { timeout: 120_000 },
    async () => {
      // Equalized fixtures: same seed shape, same Alice active ref, same
      // scene/task, empty memory evidence, identical non-Relationship state —
      // only the number of real lived qualifying experiences differs.
      const armA = await composeCausalArm(1);
      const armB = await composeCausalArm(16);
      await establishCausalHead(armA);
      await establishCausalHead(armB);

      const stateA = await ingestArm(armA, 1);
      const stateB = await ingestArm(armB, 16);

      // resulting canonical familiarity via the frozen read projection
      const readA = await deriveInteractionFamiliarityReadProjectionV0({
        subjectState: stateA,
        counterpart_ref: ALICE as never
      });
      const readB = await deriveInteractionFamiliarityReadProjectionV0({
        subjectState: stateB,
        counterpart_ref: ALICE as never
      });
      expect(readA.ok && readB.ok).toBe(true);
      if (!readA.ok || !readB.ok) return;
      expect(readA.projection.presence).toBe("PRESENT");
      expect(readA.projection.ordinal_level).toBe(1);
      expect(readB.projection.presence).toBe("PRESENT");
      expect(readB.projection.ordinal_level).toBe(16);

      // PRIMARY CharacterOS causal endpoint
      const projectionA = await buildCognitiveContextProjection(stateA);
      const projectionB = await buildCognitiveContextProjection(stateB);
      expect(influenceFor(projectionA, ALICE)?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
      expect(influenceFor(projectionB, ALICE)?.context_resolution_strategy).toBe(
        "COUNTERPART_CONTEXT_SEARCH_FIRST"
      );
      expect(projectionB.projection_hash).not.toBe(projectionA.projection_hash);
    }
  );
});

// ---- restore causal proof ---------------------------------------------------------------------------

describe("restore causal proof", () => {
  it(
    "strategies survive authoritative restore for both arms without manual reconstruction",
    { timeout: 120_000 },
    async () => {
      for (const [count, expectedStrategy] of [
        [1, "BASIC_CONTEXT_FIRST"],
        [16, "COUNTERPART_CONTEXT_SEARCH_FIRST"]
      ] as const) {
        const composition = await composeCausalArm(count);
        await establishCausalHead(composition);
        await ingestArm(composition, count);

        const liveState = (await composition.assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
        const before = await buildCognitiveContextProjection(liveState);
        expect(influenceFor(before, ALICE)?.context_resolution_strategy).toBe(expectedStrategy);

        // authoritative restore over the exact committed chain
        const bundles = composition.assembly.storeRead.getCommittedBundles();
        const terminal = bundles[bundles.length - 1];
        if (!terminal) throw new Error("fixture terminal bundle missing");
        const genesisEnvelope = await createPersistenceEnvelope({
          snapshot: composition.genesis,
          repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
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
          repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
          commit_head: { commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum } as never
        });
        if (!terminalEnvelope.ok) throw new Error("fixture terminal envelope failed");
        const restored = await restoreCanonicalSubjectFromHistoryV0({
          persisted_envelope: terminalEnvelope.value,
          trusted_boundary: boundary.receipt,
          bundles
        });
        expect(restored.kind).toBe("RESTORED");
        if (restored.kind !== "RESTORED") continue;

        const after = await buildCognitiveContextProjection(restored.restored_snapshot as SubjectStateV0);
        expect(influenceFor(after, ALICE)?.context_resolution_strategy).toBe(expectedStrategy);
        // strict-equal influence artifacts pre/post restore
        expect(after.interaction_familiarity_cognition_influences).toStrictEqual(
          before.interaction_familiarity_cognition_influences
        );
      }
    }
  );
});

// ---- prompt / provider rendering ---------------------------------------------------------------------

describe("provider rendering", () => {
  it("renders the two strategies distinctly in BOTH V0 and V1 paths with the safety boundary", async () => {
    const basicState = aliceState({ familiarity: 1 / 32, activeAlice: true });
    const searchState = aliceState({ familiarity: 16 / 32, activeAlice: true });

    for (const [state, expectedStrategy] of [
      [basicState, "BASIC_CONTEXT_FIRST"],
      [searchState, "COUNTERPART_CONTEXT_SEARCH_FIRST"]
    ] as const) {
      const projection = await buildCognitiveContextProjection(state);
      const v1Messages = buildCognitivePromptMessagesV1({
        projection,
        canonical_actions: [],
        action_space_fingerprint: R0_HASH as never,
        allowed_evidence_refs: []
      } as never);
      const v1Content = v1Messages[1]?.content ?? "";
      expect(v1Content).toContain(`context_resolution_strategy=${expectedStrategy}`);

      const v0Messages = buildCognitivePromptMessages(projection as never);
      const v0Content = v0Messages[1]?.content ?? "";
      // identical closed strategy semantics in both provider paths
      expect(v0Content).toContain(`context_resolution_strategy=${expectedStrategy}`);
      expect(v0Content).toContain("context-resolution ordering ONLY");
      expect(v0Content).toContain("NOT factual evidence");
      expect(v0Content).toContain("never place it in any refs array");
    }

    // distinct representations
    const basicRender = renderInteractionFamiliarityCognitionInfluencesV0(
      (await buildCognitiveContextProjection(basicState)).interaction_familiarity_cognition_influences
    );
    const searchRender = renderInteractionFamiliarityCognitionInfluencesV0(
      (await buildCognitiveContextProjection(searchState)).interaction_familiarity_cognition_influences
    );
    expect(basicRender).not.toBe(searchRender);
    expect(basicRender).toContain("BASIC_CONTEXT_FIRST");
    expect(searchRender).toContain("COUNTERPART_CONTEXT_SEARCH_FIRST");
    // the numeric policy threshold is never exposed as a model recommendation
    expect(basicRender).not.toContain("threshold");
    for (const forbidden of ["score", "weight", "rank", "winner", "utility", "margin"]) {
      expect(searchRender.toLowerCase()).not.toContain(forbidden);
    }
  });
});
