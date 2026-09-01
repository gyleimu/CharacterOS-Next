/**
 * PersonalityEvidenceChannelPolicyV0 acceptance suite (PC1–PC42).
 * Deterministic and offline: no LLM, no network, no wall clock, no random.
 *
 * All channel/dimension ids are obviously SYNTHETIC engineering fixtures
 * (channel.a_exploration_positive, test_openness_like, ...). They carry NO
 * claim of psychological taxonomy or truth.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacade,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  validateUnitInterval,
  type InMemoryFacadeAssembly,
  type PersonalityStateV0,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";
import {
  PersonalityTransitionExecutor,
  validatePersonalityUpdateProposal,
  type RuntimeContext,
  type SubjectCorePort
} from "@characteros-next/runtime";

import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0,
  type PersonalityPlasticityContextV0
} from "./personality-plasticity-producer.js";
import {
  PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  derivePersonalityEvidenceChannelPolicyFingerprint,
  producePersonalityPlasticityFromChannel,
  resolvePersonalityEvidenceChannel,
  validatePersonalityEvidenceChannelPolicy,
  type PersonalityEvidenceChannelPolicyV0
} from "./personality-evidence-channel.js";

const SUBJECT_ID = "subject-s0";
const DIM_OPENNESS = "test_openness_like";
const DIM_DILIGENCE = "test_diligence_like";
const DIM_UNREGISTERED = "dimension_not_registered";
const CH_A = "channel.a_exploration_positive";
const CH_B = "channel.b_social_negative";
const CH_C = "channel.c_diligence_positive";
const CH_UNKNOWN = "channel.does_not_exist";
const POLICY_ID = "host_channel_policy_v0";
const SEED_TRAIT = "seed_stability_trait";
const EP_A = `episode:${"a".repeat(64)}`;
const EP_B = `episode:${"b".repeat(64)}`;
const EP_C = `episode:${"c".repeat(64)}`;

function requireBrand<T>(r: ValidationResult<T>): T {
  if (!r.ok) throw new Error(`fixture brand invalid: ${r.error.detail}`);
  return r.value;
}

function unit(v: number): UnitIntervalV0 {
  return requireBrand(validateUnitInterval(v, "fixture.unit"));
}

function id(v: string): PersonalityEvidenceChannelPolicyV0["policy_id"] {
  return requireBrand(validateIdentifier(v, "fixture.id"));
}

/** Canonical-order synthetic policy: three explicit routes, no built-ins. */
function policyFixture(): PersonalityEvidenceChannelPolicyV0 {
  return {
    schema_version: PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: id(POLICY_ID),
    channels: [
      { channel_id: id(CH_A), target_dimension_id: id(DIM_OPENNESS), direction: "INCREASE" },
      { channel_id: id(CH_B), target_dimension_id: id(DIM_OPENNESS), direction: "DECREASE" },
      { channel_id: id(CH_C), target_dimension_id: id(DIM_DILIGENCE), direction: "INCREASE" }
    ]
  };
}

/** Canonical personality read model: two registered synthetic dimensions. */
function personalityState(): PersonalityStateV0 {
  return {
    schema_version: "personality-state-v0",
    dimensions: [
      { dimension_id: id(DIM_DILIGENCE), value: unit(0.6) },
      { dimension_id: id(DIM_OPENNESS), value: unit(0.4) }
    ]
  };
}

function producerCtx(): PersonalityPlasticityContextV0 {
  return {
    subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    expected_state_revision: requireBrand(validateStateRevision(0, "ctx.revision")),
    current_personality: personalityState()
  };
}

function projections(
  activations: number[],
  refs: readonly string[] = [EP_A, EP_B, EP_C]
): MemoryInfluenceProjectionV0[] {
  return activations.map((a, i) => ({
    memory_ref: refs[i] as MemoryInfluenceProjectionV0["memory_ref"],
    age_logical: i,
    decay_factor: unit(1),
    activation_strength: unit(a)
  }));
}

const ELIGIBLE_TRIPLE = [0.9, 0.9, 0.9];

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): { next_snapshot: SubjectStateV0 } | null;
    getCommittedBundles(): readonly { next_snapshot: SubjectStateV0 }[];
  };
}

/** Full subject-state-v3 fixture with the synthetic registered dimension. */
function subjectFixture(): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: SUBJECT_ID,
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: { [SEED_TRAIT]: unit(0.5) } },
    personality: personalityState(),
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: "R1",
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
    relationships: { schema_version: "relationship-state-v0", counterparts: [] },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: ["environment:room-1"],
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

function createTestCore(snapshot: SubjectStateV0, memory: InMemoryMemoryRepository): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memory.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (adoption.next_repository_revision_hash === null) return false;
      return memory.validateRevisionBinding({
        repository_revision: adoption.next_repository_revision,
        repository_revision_hash: adoption.next_repository_revision_hash
      } as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]);
    }
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (sid) => {
      const bundle = assembly.storeRead.readCurrentBundle(sid);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    }
  };
  return { ...port, issuer: assembly.producerAuthorizationIssuer, storeRead: assembly.storeRead };
}

async function integrationWorld() {
  const memory = new InMemoryMemoryRepository();
  await memory.prepareRevision({ parent_revision: null, records: [] });
  await memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [
      { ref: EP_A, payload_hash: `sha256:${"1".repeat(60)}0001` },
      { ref: EP_B, payload_hash: `sha256:${"1".repeat(60)}0002` },
      { ref: EP_C, payload_hash: `sha256:${"1".repeat(60)}0003` }
    ] as never
  });
  const core = createTestCore(subjectFixture(), memory);
  const executor = new PersonalityTransitionExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { memory, core, executor };
}

function ruleAt(p: PersonalityEvidenceChannelPolicyV0, i: number) {
  const r = p.channels[i];
  if (r === undefined) throw new Error("fixture rule missing");
  return r;
}

function firstUpdate(proposal: { updates: readonly { next_value: UnitIntervalV0 }[] }) {
  const u = proposal.updates[0];
  if (u === undefined) throw new Error("expected exactly one update");
  return u;
}

describe("PersonalityEvidenceChannelPolicyV0", () => {
  it("PC1/PC2: valid policy validates; closed keys enforced", () => {
    expect(validatePersonalityEvidenceChannelPolicy(policyFixture()).ok).toBe(true);
    const base = policyFixture() as unknown as Record<string, unknown>;
    expect(validatePersonalityEvidenceChannelPolicy({ ...base, extra: 1 }).ok).toBe(false);
    expect(
      validatePersonalityEvidenceChannelPolicy({
        ...base,
        schema_version: "personality-evidence-channel-policy-v9"
      }).ok
    ).toBe(false);
    const ruleWithExtra = policyFixture();
    expect(
      validatePersonalityEvidenceChannelPolicy({
        ...ruleWithExtra,
        channels: [{ ...ruleAt(ruleWithExtra, 0), confidence: 0.9 }]
      }).ok
    ).toBe(false);
  });

  it("PC3: duplicate channel ids fail closed (DUPLICATE_CHANNEL_ID)", () => {
    const p = policyFixture();
    const duplicated = {
      ...p,
      channels: [
        ruleAt(p, 0),
        { ...ruleAt(p, 1), channel_id: ruleAt(p, 0).channel_id }
      ]
    };
    const r = validatePersonalityEvidenceChannelPolicy(duplicated);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Frozen ErrorCode convention (subject-core closed union); the specific
    // duplicate condition is carried in the detail, mirroring the frozen
    // proposal validator's "duplicate dimension_id" pattern.
    expect(r.error.error_code).toBe("INVALID_SCHEMA");
    expect(r.error.detail).toContain("duplicate channel_id");
  });

  it("PC4: canonical raw-ASCII rule ordering required by the validator", () => {
    const p = policyFixture();
    const unsorted = { ...p, channels: [...p.channels].reverse() };
    expect(validatePersonalityEvidenceChannelPolicy(unsorted).ok).toBe(false);
    expect(validatePersonalityEvidenceChannelPolicy(p).ok).toBe(true);
  });

  it("PC5/PC9: explicit known channel resolves to the configured target and direction", async () => {
    const r = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, personalityState());
    expect(r.kind).toBe("RESOLVED");
    if (r.kind !== "RESOLVED") return;
    expect(r.decision.channel_id).toBe(CH_A);
    expect(r.decision.target_dimension_id).toBe(DIM_OPENNESS);
    expect(r.decision.direction).toBe("INCREASE");
    expect(r.decision.policy_id).toBe(POLICY_ID);
    const d = await resolvePersonalityEvidenceChannel(policyFixture(), CH_B, personalityState());
    expect(d.kind).toBe("RESOLVED");
    if (d.kind !== "RESOLVED") return;
    expect(d.decision.direction).toBe("DECREASE");
  });

  it("PC6/PC12/PC13: unknown channel / empty policy / no default route fail typed", async () => {
    const unknown = await resolvePersonalityEvidenceChannel(policyFixture(), CH_UNKNOWN, personalityState());
    expect(unknown.kind).toBe("UNKNOWN_CHANNEL");
    const empty = await validatePersonalityEvidenceChannelPolicy({
      schema_version: PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
      policy_id: id("host_empty_policy_v0"),
      channels: []
    });
    expect(empty.ok).toBe(true); // structurally valid
    if (!empty.ok) throw new Error("empty policy must validate");
    const emptyResolve = await resolvePersonalityEvidenceChannel(empty.value, CH_A, personalityState());
    expect(emptyResolve.kind).toBe("UNKNOWN_CHANNEL"); // but routes nothing
    const malformed = await resolvePersonalityEvidenceChannel(policyFixture(), "", personalityState());
    expect(malformed.kind).toBe("INVALID_CHANNEL_ID");
  });

  it("PC7/PC8: target dimension must already be registered; unknown fails closed", async () => {
    const okResolve = await resolvePersonalityEvidenceChannel(policyFixture(), CH_C, personalityState());
    expect(okResolve.kind).toBe("RESOLVED");
    if (okResolve.kind !== "RESOLVED") return;
    expect(okResolve.decision.target_dimension_id).toBe(DIM_DILIGENCE);
    const p = policyFixture();
    const badTarget = {
      ...p,
      channels: [
        { channel_id: ruleAt(p, 0).channel_id, target_dimension_id: id(DIM_UNREGISTERED), direction: "INCREASE" as const }
      ]
    };
    const r = await resolvePersonalityEvidenceChannel(badTarget, CH_A, personalityState());
    expect(r.kind).toBe("UNKNOWN_TARGET_DIMENSION");
  });

  it("PC10/PC11: caller cannot override target or direction (no override surface exists)", async () => {
    const hostileHint = {
      channel_id: CH_A,
      target_dimension_id: DIM_DILIGENCE,
      direction: "DECREASE"
    } as never;
    const r = await resolvePersonalityEvidenceChannel(policyFixture(), hostileHint, personalityState());
    expect(r.kind).toBe("INVALID_CHANNEL_ID"); // non-string channel id: typed rejection
    const result = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_A,
      producerCtx(),
      projections(ELIGIBLE_TRIPLE),
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(result.kind).toBe("RESOLVED");
    if (result.kind !== "RESOLVED") return;
    // Route came ONLY from the policy — INCREASE on test_openness_like.
    expect(result.decision.target_dimension_id).toBe(DIM_OPENNESS);
    expect(result.decision.direction).toBe("INCREASE");
  });

  it("PC14/PC15: same policy resolves deterministically; fingerprint stable", async () => {
    const a = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, personalityState());
    const b = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, personalityState());
    expect(a).toEqual(b);
    if (a.kind !== "RESOLVED") return;
    const direct = await derivePersonalityEvidenceChannelPolicyFingerprint(policyFixture());
    expect(a.decision.policy_fingerprint).toBe(direct);
  });

  it("PC16/PC17: changed target or direction changes the fingerprint", async () => {
    const base = await derivePersonalityEvidenceChannelPolicyFingerprint(policyFixture());
    const p = policyFixture();
    const changedTarget = await derivePersonalityEvidenceChannelPolicyFingerprint({
      ...p,
      channels: [
        ruleAt(p, 0),
        ruleAt(p, 1),
        { channel_id: ruleAt(p, 2).channel_id, target_dimension_id: id(DIM_OPENNESS), direction: "INCREASE" }
      ]
    });
    expect(changedTarget).not.toBe(base);
    const changedDirection = await derivePersonalityEvidenceChannelPolicyFingerprint({
      ...p,
      channels: [
        ruleAt(p, 0),
        ruleAt(p, 1),
        { channel_id: ruleAt(p, 2).channel_id, target_dimension_id: ruleAt(p, 2).target_dimension_id, direction: "DECREASE" }
      ]
    });
    expect(changedDirection).not.toBe(base);
  });

  it("PC18: decision carries no evidence metrics", async () => {
    const r = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, personalityState());
    expect(r.kind).toBe("RESOLVED");
    if (r.kind !== "RESOLVED") return;
    const json = JSON.stringify(r.decision);
    for (const banned of ["activation", "age_logical", "decay", "member", "total", "mean", "next_value", "step"]) {
      expect(json.includes(banned)).toBe(false);
    }
    expect(Object.keys(r.decision)).toEqual([
      "schema_version",
      "policy_id",
      "policy_fingerprint",
      "channel_id",
      "target_dimension_id",
      "direction"
    ]);
  });

  it("PC19/PC20/PC21: resolver is a pure lookup — routing ignores personality VALUES and mutates nothing", async () => {
    // Different current VALUES, same membership → identical routing decision.
    const otherValues: PersonalityStateV0 = {
      schema_version: "personality-state-v0",
      dimensions: [
        { dimension_id: id(DIM_DILIGENCE), value: unit(0.11) },
        { dimension_id: id(DIM_OPENNESS), value: unit(0.99) }
      ]
    };
    const a = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, personalityState());
    const b = await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, otherValues);
    expect(a).toEqual(b);
    const after = personalityState();
    await resolvePersonalityEvidenceChannel(policyFixture(), CH_A, after);
    expect(after).toEqual(personalityState()); // pure data in, pure data out
  });

  it("PC27/PC28/PC29/PC30: bridge delegates to the frozen producer and passes evidence exactly", async () => {
    const evidence = projections(ELIGIBLE_TRIPLE);
    const bridged = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_A,
      producerCtx(),
      evidence,
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    const direct = await proposePersonalityPlasticityV0(
      producerCtx(),
      evidence,
      { dimension_id: DIM_OPENNESS, direction: "INCREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(bridged.kind).toBe("RESOLVED");
    expect(direct.kind).toBe("PROPOSED");
    if (bridged.kind !== "RESOLVED" || direct.kind !== "PROPOSED") return;
    if (bridged.producerResult.kind !== "PROPOSED") throw new Error("expected routed proposal");
    expect(bridged.producerResult).toEqual(direct); // identical delegation, zero formula duplication
    expect(firstUpdate(bridged.producerResult.proposal).next_value).toBeCloseTo(0.45, 12);
    expect(validatePersonalityUpdateProposal(bridged.producerResult.proposal).ok).toBe(true); // PC30
    // Reordered evidence passes through unchanged: bridge ≡ direct on the same set.
    const shuffled = [...evidence].reverse();
    const bridgedShuffled = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_A,
      producerCtx(),
      shuffled,
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    const directShuffled = await proposePersonalityPlasticityV0(
      producerCtx(),
      shuffled,
      { dimension_id: DIM_OPENNESS, direction: "INCREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    if (bridgedShuffled.kind !== "RESOLVED" || directShuffled.kind !== "PROPOSED") return;
    expect(bridgedShuffled.producerResult).toEqual(directShuffled);
  });

  it("PC31: ineligible evidence remains NOT_ELIGIBLE through the frozen producer", async () => {
    const result = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_A,
      producerCtx(),
      projections([0.1, 0.1], [EP_A, EP_B]),
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(result.kind).toBe("RESOLVED");
    if (result.kind !== "RESOLVED") return;
    expect(result.producerResult.kind).toBe("NOT_ELIGIBLE");
  });

  it("PC32/PC33: unknown channel / unknown target dimension cannot produce proposals", async () => {
    const unknownChannel = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_UNKNOWN,
      producerCtx(),
      projections(ELIGIBLE_TRIPLE),
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(unknownChannel.kind).toBe("UNKNOWN_CHANNEL");
    const p = policyFixture();
    const badTargetPolicy = {
      ...p,
      channels: [
        { channel_id: ruleAt(p, 0).channel_id, target_dimension_id: id(DIM_UNREGISTERED), direction: "INCREASE" as const }
      ]
    };
    const unknownDim = await producePersonalityPlasticityFromChannel(
      badTargetPolicy,
      CH_A,
      producerCtx(),
      projections(ELIGIBLE_TRIPLE),
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(unknownDim.kind).toBe("UNKNOWN_TARGET_DIMENSION");
  });

  it("PC34/PC35/PC36/PC37: explicit channel → frozen plasticity → frozen canonical transition", async () => {
    const world = await integrationWorld();
    const evidence = projections(ELIGIBLE_TRIPLE);
    const routed = await producePersonalityPlasticityFromChannel(
      policyFixture(),
      CH_A,
      producerCtx(),
      evidence,
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(routed.kind).toBe("RESOLVED");
    if (routed.kind !== "RESOLVED" || routed.producerResult.kind !== "PROPOSED") {
      throw new Error("expected routed proposal");
    }
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
    const ctx: RuntimeContext = {
      subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
      current_logical_time: requireBrand(validateLogicalTime(0, "ctx.logical_time")),
      state_revision: requireBrand(validateStateRevision(0, "ctx.state_revision"))
    };
    const outcome = await world.executor.execute(ctx, routed.producerResult.proposal);
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1); // SubjectCore-only canonical commit
    expect(outcome.bundle.next_snapshot.runtime_metadata.state_revision).toBe(1);
    expect(outcome.bundle.next_snapshot.runtime_metadata.logical_time).toBe(0); // PC36
    const dim = outcome.bundle.next_snapshot.personality.dimensions.find(
      (d) => d.dimension_id === DIM_OPENNESS
    );
    expect(dim?.value).toBeCloseTo(0.45, 12); // PC34: 0.4 → 0.45
    expect(outcome.bundle.next_snapshot.traits_seed).toEqual({
      dimensions: { [SEED_TRAIT]: unit(0.5) }
    }); // PC37
  });
});
