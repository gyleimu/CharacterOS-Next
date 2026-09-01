/**
 * PersonalityPlasticityProducerV0 acceptance suite (PP1–PP39).
 * Deterministic and offline: no LLM, no network, no wall clock, no random.
 *
 * The fixture dimension `test_openness_like` is an explicitly SYNTHETIC
 * registered-dimension id (GENERIC_REGISTERED_CONTAINER) — it carries NO claim
 * of psychological taxonomy or truth. The policy under test is
 * ENGINEERING_REFERENCE_V0: an engineering safety bound, not psychological
 * science.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacade,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  validateUnitInterval,
  type InMemoryFacadeAssembly,
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
  InfluenceEvidenceErrorV0,
  aggregateInfluenceEvidence
} from "@characteros-next/influence-evidence";
import {
  PersonalityTransitionExecutor,
  deriveEvidenceMemberSetFingerprint,
  validatePersonalityUpdateProposal,
  type PersonalityUpdateProposalV0,
  type RuntimeContext
} from "@characteros-next/runtime";
import type { SubjectCorePort } from "@characteros-next/runtime";

import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityPolicyV0
} from "./personality-plasticity-producer.js";

const SUBJECT_ID = "subject-s0";
const DIM = "test_openness_like";
const EP_A = `episode:${"a".repeat(64)}`;
const EP_B = `episode:${"b".repeat(64)}`;
const EP_C = `episode:${"c".repeat(64)}`;
const EP_MISSING = `episode:${"f".repeat(64)}`;
const SEED_TRAIT = "seed_stability_trait";

function requireBrand<T>(r: ValidationResult<T>): T {
  if (!r.ok) throw new Error(`fixture brand invalid: ${r.error.detail}`);
  return r.value;
}

function unit(v: number): UnitIntervalV0 {
  return requireBrand(validateUnitInterval(v, "fixture.unit"));
}

function personalityCtxBranded(revision: number): RuntimeContext {
  return {
    subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireBrand(validateLogicalTime(0, "ctx.logical_time")),
    state_revision: requireBrand(validateStateRevision(revision, "ctx.state_revision"))
  };
}

/** Explicitly synthetic registered dimension; seed trait is unrelated. */
function personalityFixture(value: number): SubjectStateV0 {
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
    personality: {
      schema_version: "personality-state-v0",
      dimensions: [{ dimension_id: DIM, value: unit(value) }]
    },
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

function producerCtx(
  currentValue: number,
  revision = 0
): PersonalityPlasticityContextV0 {
  return {
    subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    expected_state_revision: requireBrand(validateStateRevision(revision, "ctx.revision")),
    current_personality: personalityFixture(currentValue).personality
  };
}

/** Explicit caller-selected evidence set (no automatic selection anywhere). */
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

const DEFAULT_POLICY = ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY;
const ELIGIBLE_TRIPLE = [0.9, 0.9, 0.9];

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): { next_snapshot: SubjectStateV0 } | null;
    getCommittedBundles(): readonly { next_snapshot: SubjectStateV0 }[];
  };
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
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    }
  };
  return { ...port, issuer: assembly.producerAuthorizationIssuer, storeRead: assembly.storeRead };
}

/** Integration world: real bound episodic evidence at R1 + frozen executor. */
async function integrationWorld(currentValue = 0.4) {
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
  const core = createTestCore(personalityFixture(currentValue), memory);
  const executor = new PersonalityTransitionExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { memory, core, executor };
}

function firstUpdate(proposal: PersonalityUpdateProposalV0) {
  const u = proposal.updates[0];
  if (u === undefined) throw new Error("expected exactly one update");
  return u;
}

describe("PersonalityPlasticityProducerV0", () => {
  it("PP1/PP4/PP5: eligible evidence for an existing dimension → bounded INCREASE proposal", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    expect(result.proposal.updates).toHaveLength(1);
    expect(firstUpdate(result.proposal).dimension_id).toBe(DIM);
    expect(firstUpdate(result.proposal).next_value).toBeCloseTo(0.45, 12);
    expect(firstUpdate(result.proposal).next_value).toBeGreaterThan(0.4);
    expect(result.proposal.subject_id).toBe(SUBJECT_ID);
    expect(result.proposal.expected_state_revision).toBe(0);
  });

  it("PP2: ineligible evidence → typed NOT_ELIGIBLE with frozen reason codes", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections([0.1, 0.1], [EP_A, EP_B]),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("NOT_ELIGIBLE");
    if (result.kind !== "NOT_ELIGIBLE") return;
    expect(result.reasons).toContain("INSUFFICIENT_MEMBER_COUNT");
    expect(result.reasons).toContain("INSUFFICIENT_TOTAL_ACTIVATION");
  });

  it("PP3: unknown dimension → fail closed, no proposal", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: "dimension_not_registered", direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("UNKNOWN_DIMENSION");
  });

  it("PP6: DECREASE produces bounded negative movement", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "DECREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    expect(firstUpdate(result.proposal).next_value).toBeCloseTo(0.35, 12);
    expect(firstUpdate(result.proposal).next_value).toBeLessThan(0.4);
  });

  it("PP7/PP8: [0,1] bounds hold with no overshoot; at-bound movement is NO_CHANGE", async () => {
    const up = await proposePersonalityPlasticityV0(
      producerCtx(0.98),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(up.kind).toBe("PROPOSED");
    if (up.kind === "PROPOSED") {
      expect(firstUpdate(up.proposal).next_value).toBeLessThanOrEqual(1);
      expect(firstUpdate(up.proposal).next_value).toBe(1);
    }
    const down = await proposePersonalityPlasticityV0(
      producerCtx(0.02),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "DECREASE" },
      DEFAULT_POLICY
    );
    expect(down.kind).toBe("PROPOSED");
    if (down.kind === "PROPOSED") {
      expect(firstUpdate(down.proposal).next_value).toBeGreaterThanOrEqual(0);
      expect(firstUpdate(down.proposal).next_value).toBe(0);
    }
    // At the bound the bounded computation equals the current value → NO_CHANGE.
    const atTop = await proposePersonalityPlasticityV0(
      producerCtx(1),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(atTop.kind).toBe("NO_CHANGE");
  });

  it("PP9: max_step is enforced regardless of evidence strength", async () => {
    const greedy: PersonalityPlasticityPolicyV0 = {
      ...DEFAULT_POLICY,
      evidence_scale: 100
    };
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      greedy
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    expect(result.step).toBe(0.05);
    expect(firstUpdate(result.proposal).next_value).toBeCloseTo(0.45, 12);
  });

  it("PP10: empty evidence set → typed NOT_ELIGIBLE (legal zero aggregate)", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections([]),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("NOT_ELIGIBLE");
    if (result.kind !== "NOT_ELIGIBLE") return;
    expect(result.reasons).toContain("INSUFFICIENT_MEMBER_COUNT");
  });

  it("PP11: duplicate member refs fail closed through the frozen aggregation", async () => {
    await expect(
      proposePersonalityPlasticityV0(
        producerCtx(0.4),
        projections([0.9, 0.9, 0.9], [EP_A, EP_A, EP_B]),
        { dimension_id: DIM, direction: "INCREASE" },
        DEFAULT_POLICY
      )
    ).rejects.toBeInstanceOf(InfluenceEvidenceErrorV0);
  });

  it("PP12: producer recomputes the aggregate itself (mean-based bounded step, not raw total)", async () => {
    const activations = [0.4, 0.5, 0.6]; // total 1.5 eligible; mean 0.5
    const evidence = projections(activations);
    const policy: PersonalityPlasticityPolicyV0 = {
      eligibility_policy: { minMemberCount: 3, minTotalActivation: 1.5, minLogicalSpan: 0 },
      max_step: unit(1),
      evidence_scale: 1
    };
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      evidence,
      { dimension_id: DIM, direction: "INCREASE" },
      policy
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    const frozenMean = aggregateInfluenceEvidence(evidence).mean_activation;
    expect(result.step).toBe(Math.min(1, frozenMean));
    expect(firstUpdate(result.proposal).next_value).toBeCloseTo(0.4 + frozenMean, 12);
    // Raw total (1.5) would have saturated max_step (1) — it did not.
    expect(result.step).toBeLessThan(1);
  });

  it("PP13/PP14: injected aggregate metrics and eligibility claims are ignored", async () => {
    const hostile = projections(ELIGIBLE_TRIPLE).map((p) =>
      ({ ...p, total_activation: 999, mean_activation: 0.01, eligible: true }) as never
    );
    const hostileResult = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      hostile,
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    const cleanResult = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(hostileResult).toEqual(cleanResult);
    // Claims cannot rescue evidence that fails the recomputed thresholds.
    const ineligible = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections([0.1, 0.1], [EP_A, EP_B]).map((p) =>
        ({ ...p, eligible: true, total_activation: 99 }) as never
      ),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(ineligible.kind).toBe("NOT_ELIGIBLE");
  });

  it("PP15/PP16: fingerprint derived from actual members; deterministic; no caller injection", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    const expected = await deriveEvidenceMemberSetFingerprint([EP_A, EP_B, EP_C].sort() as never);
    expect(result.proposal.evidence_binding.member_set_fingerprint).toBe(expected);
    // Input contract carries no fingerprint field; unknown fields are inert.
    const hostile = projections(ELIGIBLE_TRIPLE).map((p) =>
      ({ ...p, member_set_fingerprint: "sha256:" + "0".repeat(64) }) as never
    );
    const hostileResult = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      hostile,
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(hostileResult).toEqual(result);
  });

  it("PP17: proposal member_refs exactly match the aggregate members", async () => {
    const evidence = projections([0.9, 0.5, 0.7]);
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      evidence,
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    expect(result.proposal.evidence_binding.member_refs).toEqual(
      aggregateInfluenceEvidence(evidence).member_refs
    );
  });

  it("PP18: one target dimension per invocation (PLASTICITY_PRODUCER_TARGET_CARDINALITY = ONE)", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;
    expect(result.proposal.updates).toHaveLength(1);
  });

  it("PP19: traits_seed is unused and unchanged by production", async () => {
    const fullFixture = personalityFixture(0.4);
    const ctx: PersonalityPlasticityContextV0 = {
      subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
      expected_state_revision: requireBrand(validateStateRevision(0, "ctx.revision")),
      current_personality: fullFixture.personality
    };
    const result = await proposePersonalityPlasticityV0(
      ctx,
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    expect(fullFixture.traits_seed).toEqual({
      dimensions: { [SEED_TRAIT]: unit(0.5) }
    });
    expect(JSON.stringify(result).includes("traits_seed")).toBe(false);
  });

  it("PP23/PP24: deterministic — same input identical; shuffled equivalent", async () => {
    const evidence = projections([0.9, 0.5, 0.7]);
    const a = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      evidence,
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    const b = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections([0.9, 0.5, 0.7]),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(a).toEqual(b);
    const shuffled = [...evidence].reverse(); // deterministic permutation, no randomness
    const c = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      shuffled,
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(c).toEqual(a);
  });

  it("fail-closed admission: invalid policy and invalid target are typed rejections", async () => {
    const badPolicy = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      { ...DEFAULT_POLICY, max_step: unit(0) }
    );
    expect(badPolicy.kind).toBe("INVALID_POLICY");
    const badTarget = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: "BAD ID!", direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(badTarget.kind).toBe("INVALID_TARGET");
    const badDirection = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "SIDEWAYS" as never },
      DEFAULT_POLICY
    );
    expect(badDirection.kind).toBe("INVALID_TARGET");
  });

  it("PP29–PP32/PP34/PP35: frozen transition accepts a produced proposal; +1 revision; traits_seed preserved", async () => {
    const world = await integrationWorld(0.4);
    const produced = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    expect(produced.kind).toBe("PROPOSED");
    if (produced.kind !== "PROPOSED") throw new Error("expected proposal");
    // PP20/PP21/PP22: producing alone mutated nothing.
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
    const r1 = await world.memory.readManifest("R1" as never);
    expect(r1?.record_hashes ?? []).toHaveLength(3);
    const validated = validatePersonalityUpdateProposal(produced.proposal);
    expect(validated.ok).toBe(true);
    // PP32: producer → proposal → frozen transition → SubjectCore commit.
    const outcome = await world.executor.execute(personalityCtxBranded(0), produced.proposal);
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1); // PP19/PP32: exactly +1
    expect(outcome.bundle.next_snapshot.runtime_metadata.state_revision).toBe(1);
    expect(outcome.bundle.next_snapshot.runtime_metadata.logical_time).toBe(0); // PP34
    const dim = outcome.bundle.next_snapshot.personality.dimensions.find(
      (d) => d.dimension_id === DIM
    );
    expect(dim?.value).toBeCloseTo(0.45, 12); // PP32: changed slightly
    expect(outcome.bundle.next_snapshot.traits_seed).toEqual({
      dimensions: { [SEED_TRAIT]: unit(0.5) }
    }); // PP35
  });

  it("PP30: forged modification of a produced fingerprint is rejected by the frozen transition", async () => {
    const world = await integrationWorld(0.4);
    const produced = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    if (produced.kind !== "PROPOSED") throw new Error("expected proposal");
    const forged = {
      ...produced.proposal,
      evidence_binding: {
        ...produced.proposal.evidence_binding,
        member_set_fingerprint: "sha256:" + "f".repeat(64)
      }
    };
    const outcome = await world.executor.execute(personalityCtxBranded(0), forged);
    expect(outcome.kind).toBe("REJECTED_FORGED_EVIDENCE_FINGERPRINT");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("PP31: evidence absent from the bound repository revision is rejected by the frozen transition", async () => {
    const world = await integrationWorld(0.4);
    const produced = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE, [EP_MISSING, EP_A, EP_B]),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    // The pure producer does NOT duplicate repository membership authority —
    // it produces the proposal; the frozen transition is the canonical authority.
    expect(produced.kind).toBe("PROPOSED");
    if (produced.kind !== "PROPOSED") return;
    const outcome = await world.executor.execute(personalityCtxBranded(0), produced.proposal);
    expect(outcome.kind).toBe("REJECTED_UNVERIFIED_EVIDENCE_MEMBER");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("PP33: replay of the resulting transition → ALREADY_COMMITTED, +0 revision", async () => {
    const world = await integrationWorld(0.4);
    const produced = await proposePersonalityPlasticityV0(
      producerCtx(0.4),
      projections(ELIGIBLE_TRIPLE),
      { dimension_id: DIM, direction: "INCREASE" },
      DEFAULT_POLICY
    );
    if (produced.kind !== "PROPOSED") throw new Error("expected proposal");
    const first = await world.executor.execute(personalityCtxBranded(0), produced.proposal);
    expect(first.kind).toBe("COMMITTED");
    const bundlesAfterFirst = world.core.storeRead.getCommittedBundles().length;
    const replay = await world.executor.execute(personalityCtxBranded(0), produced.proposal);
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(world.core.storeRead.getCommittedBundles().length).toBe(bundlesAfterFirst);
  });
});
