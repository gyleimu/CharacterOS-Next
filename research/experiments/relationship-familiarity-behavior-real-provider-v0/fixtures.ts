/* eslint-disable no-restricted-imports -- Isolated trusted experiment host over frozen built public roots. */
/**
 * Canonical arm construction for RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0.
 *
 * Strict isolation: both arms are built from the SAME canonical base, the SAME
 * Memory repository revision and the SAME shared convention episode. The ONLY
 * difference is the canonical `relationship_core_interaction_familiarity_v0`
 * value (1/32 vs 2/32). No renderer patching, no prompt-only familiarity text,
 * no natural-history contrast.
 */

import {
  createInMemorySubjectCoreFacade,
  canonicalJsonString,
  type SubjectStateV0,
  type InMemoryFacadeAssembly,
  type RepositoryRevisionBindingV1
} from "../../../packages/subject-core/dist/index.js";
import {
  InMemoryMemoryRepository,
  computeRepositoryRevisionHash,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryRecordV0
} from "../../../packages/memory/dist/index.js";
import {
  ALICE,
  CONVENTION_REF,
  CONVENTION_SCENE,
  DIMENSION_ID,
  HIGH,
  LOW,
  SUBJECT,
  scenarioById,
  type ScenarioV0
} from "./contract.ts";

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PREFLIGHT: ${message}`);
}
export function equal(a: unknown, b: unknown): boolean {
  return canonicalJsonString(a) === canonicalJsonString(b);
}

export interface ArmSpec {
  readonly scenario: ScenarioV0;
  readonly arm: "LOW" | "HIGH";
  readonly familiarity: number;
}

export interface World {
  readonly assembly: InMemoryFacadeAssembly;
  readonly genesis: SubjectStateV0;
  readonly snapshot: SubjectStateV0;
  readonly memory: InMemoryMemoryRepository;
  readonly records: readonly EpisodicMemoryRecordV0[];
  readonly binding: RepositoryRevisionBindingV1;
  readonly scenario: ScenarioV0;
  readonly arm: "LOW" | "HIGH";
  readonly familiarity: number;
}

/** The ONE shared canonical convention episode (identical bytes in both arms). */
export function conventionEpisode(): EpisodicMemoryRecordV0 {
  const record = {
    schema_version: "episodic-memory-record-v0",
    episode_ref: CONVENTION_REF,
    occurrence_logical_time: 0,
    recorded_at_logical_time: 0,
    provenance: { transition_id: "t-encoding-alice-08", producer: "memory", cause_refs: [] },
    references: [ALICE],
    context: { scene: CONVENTION_SCENE, focus_refs: [ALICE], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5, source: "ENCODING_DECLARED_V0" }
  };
  const checked = validateEpisodicMemoryRecord(record);
  check(checked.ok, "shared convention episode validates");
  return checked.value;
}

function seed(scenario: ScenarioV0, revision: string, familiarity: number): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: SUBJECT,
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: { openness: 0.5 } },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      // The shared convention is lawful canonical Memory evidence in BOTH arms.
      working_refs: [CONVENTION_REF],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: revision,
      consolidation_cursor: null,
      retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
      recent_retrieval_trace: [],
      lifecycle_metadata: {},
      pending_encoding_refs: [],
      last_retrieval_at: 0
    },
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: DIMENSION_ID, value: familiarity }] }]
    },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: scenario.current_event,
      task: scenario.task,
      focus_refs: [],
      active_entity_refs: [ALICE],
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
      state_revision: 0,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  } as unknown as SubjectStateV0;
}

/** Builds ONE arm: same shared Memory, same base state, familiarity value only. */
export async function buildArm(spec: ArmSpec): Promise<World> {
  const records = [conventionEpisode()];
  const memory = new InMemoryMemoryRepository();
  const refs: { ref: string; payload_hash: string }[] = [];
  for (const record of records) {
    refs.push({ ref: record.episode_ref, payload_hash: await memory.storePayload(record.episode_ref as never, record) });
  }
  refs.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: "intent-familiarity-behavior" as never,
    parent_revision: null,
    records: refs as never
  });
  const binding: RepositoryRevisionBindingV1 = {
    repository_revision: prepared.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest)
  } as never;
  check(await memory.validateRevisionBinding(binding), "real repository binding");

  const genesis = seed(spec.scenario, binding.repository_revision as unknown as string, spec.familiarity);
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT as never, genesis]]),
    preparedResultValidator: async (candidate) => candidate.prepared_result_ref.startsWith("workflow:")
  });

  // A real governed Relationship commit establishes the arm's canonical state
  // (validated state, registered feature, lawful value). It writes exactly the
  // seeded /relationships replacement; nothing else.
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    // Scenario-scoped (arm-independent) identity: the committed successor then
    // differs between arms ONLY in the canonical familiarity value.
    transition_id: `t-familiarity-arm-${spec.scenario.scenario_id}`,
    subject_id: SUBJECT,
    transition_type: "Relationship",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    external_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: genesis.relationships }],
        provenance_refs: []
      }
    ]
  } as const;
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  check(reserved.kind === "CONTINUE", "arm head reservation");
  const committed = await assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([{ producer: "relationship", domain: "relationship" }]),
    preparedBinding: {
      transition_id: proposal.transition_id as never,
      subject_id: SUBJECT as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:familiarity-arm-head" as never
    },
    repository_bindings: [binding]
  } as never);
  check(committed.kind === "COMMITTED", `arm head commit (${JSON.stringify(committed).slice(0, 200)})`);

  const snapshot = await assembly.storeRead.readCurrentState(SUBJECT as never);
  check(snapshot !== null, "post-commit snapshot");
  return {
    assembly,
    genesis,
    snapshot: snapshot as SubjectStateV0,
    memory,
    records,
    binding,
    scenario: spec.scenario,
    arm: spec.arm,
    familiarity: spec.familiarity
  };
}

export function armSpecs(): readonly ArmSpec[] {
  const result: ArmSpec[] = [];
  for (const scenario of SCENARIOS_OF()) {
    result.push({ scenario, arm: "LOW", familiarity: LOW.value });
    result.push({ scenario, arm: "HIGH", familiarity: HIGH.value });
  }
  return result;
}

function SCENARIOS_OF(): readonly ScenarioV0[] {
  return Object.freeze([scenarioById("S1"), scenarioById("S2"), scenarioById("S3"), scenarioById("S4")]);
}
