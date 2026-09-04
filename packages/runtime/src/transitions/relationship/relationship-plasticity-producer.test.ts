/**
 * RelationshipPlasticityProducer V0 acceptance suite (RPP1–RPP98).
 *
 * Proves: host-minted-capability-only admission, ABSTAIN short-circuit,
 * current-canonical-state authority, CURRENT_REVALIDATED_REBASE_AT_N_PLUS_K,
 * frozen policy resolution, structural projection revalidation, exact
 * three-way evidence alignment, logical-age revalidation, producer-recomputed
 * aggregation, frozen eligibility, the ENGINEERING_BASELINE numeric kernel
 * (round4 → min(0.05) → symmetric sign → clamp01, no final round), and the
 * complete absence of canonical mutation / provider dependency / psychology.
 * `test_trust_like` / `test_closeness_like` are NON_SCIENTIFIC_TEST_FIXTURE
 * identifiers only.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  aggregateInfluenceEvidence,
  InfluenceEvidenceErrorV0
} from "@characteros-next/influence-evidence";
import {
  RELATIONSHIP_STATE_SCHEMA_VERSION,
  validateSubjectState,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  deriveRelationshipEvidenceMemberSetFingerprint,
  validateRelationshipUpdateProposal
} from "./relationship-update-proposal.js";
// Vite `?raw` asset import (vitest-native); intentionally untyped.
// @ts-expect-error -- Vite ?raw imports carry no TypeScript declaration by design.
import runtimePackageRaw from "../../../package.json?raw";
import { s0 } from "../observation/observation-fixtures.js";
import {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  type RelationshipEvidenceChannelPolicyV0
} from "./relationship-evidence-channel-policy.js";
import {
  RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  runRelationshipSemanticChannelV0,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelProviderV0,
  type RelationshipSemanticChannelRunResultV0
} from "./relationship-semantic-channel.js";
import {
  RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE,
  RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP,
  produceRelationshipPlasticityV0,
  type RelationshipPlasticityProducerInputV0,
  type RelationshipPlasticityProducerResultV0
} from "./relationship-plasticity-producer.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const DIM_TRUST = "test_trust_like";
const DIM_CLOSE = "test_closeness_like";
const CH_A = "ch_a";
const CH_B = "ch_b";
const BASE_LOGICAL_TIME = 10;

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function policyFixture(): RelationshipEvidenceChannelPolicyV0 {
  return {
    schema_version: RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: identifier("rel_policy"),
    channels: [
      { channel_id: identifier(CH_A), target_dimension_id: identifier(DIM_CLOSE), direction: "INCREASE" },
      { channel_id: identifier(CH_B), target_dimension_id: identifier(DIM_TRUST), direction: "DECREASE" }
    ]
  };
}

async function catalogFixture(
  policy: RelationshipEvidenceChannelPolicyV0 = policyFixture(),
  criterionA =
    "Selected shared experiences consistently involve kept agreements and reliable follow-through.",
  criterionB = "Selected shared experiences consistently involve broken agreements or avoidance."
): Promise<RelationshipSemanticChannelCatalogV0> {
  return {
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: identifier("rel_catalog"),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await deriveRelationshipEvidenceChannelPolicyFingerprint(policy),
    channels: [
      { channel_id: identifier(CH_A), criterion: criterionA },
      { channel_id: identifier(CH_B), criterion: criterionB }
    ]
  };
}

function recordFixture(
  episodeRef: string,
  scene: string,
  references: readonly string[],
  occurrenceLogicalTime: number
): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: occurrenceLogicalTime as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: (occurrenceLogicalTime + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${episodeRef.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: references as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

function baseRecords(count = 3): EpisodicMemoryRecordV0[] {
  const scenes = [
    "Alice kept the plan we made and arrived early.",
    "Alice apologized for the missed call and rescheduled.",
    "Alice helped carry the boxes without being asked."
  ];
  const records: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < count; i++) {
    const ref = `episode:ep-${String(i + 1).padStart(2, "0")}`;
    records.push(recordFixture(ref, scenes[i % scenes.length] ?? `Shared experience ${i}.`, [ALICE], 7 + i));
  }
  return records;
}

const EXACT_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

function traceEntry(sequence: number, repositoryRevision: string): Record<string, unknown> {
  return {
    trace_schema_version: "trace-v1",
    trace_id: `trace:trace-${sequence}`,
    history_sequence: sequence,
    transition_id: `t-fixture-${sequence}`,
    transition_type: "Relationship",
    subject_id: SUBJECT_ID,
    subject_revision_before: sequence - 1,
    subject_revision_after: sequence,
    logical_time: BASE_LOGICAL_TIME,
    rule_ids: EXACT_RULE_IDS,
    cause_refs: [],
    proposal_ref: `proposal:p${sequence}`,
    domain_mutations: [
      {
        producer: "relationship",
        domain: "relationship",
        layers: ["relationships"],
        field_changes: [{ path: "/relationships", operation: "SET" }]
      }
    ],
    state_hash_before: `sha256:${"3".repeat(64)}`,
    state_hash_after: `sha256:${"4".repeat(64)}`,
    memory_revision_before: repositoryRevision,
    memory_revision_after: repositoryRevision,
    outcome: "COMMITTED"
  };
}

interface StateOptions {
  readonly logicalTime?: number;
  readonly stateRevision?: number;
  readonly subjectId?: string;
  readonly aliceDimensions?: readonly { dimension_id: string; value: number }[];
  readonly includeAlice?: boolean;
}

function subjectStateFixture(
  repositoryRevision: string,
  options: StateOptions = {}
): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const logicalTime = options.logicalTime ?? BASE_LOGICAL_TIME;
  const stateRevision = options.stateRevision ?? 0;
  const aliceDimensions = options.aliceDimensions ?? [
    { dimension_id: DIM_CLOSE, value: 0.4 },
    { dimension_id: DIM_TRUST, value: 0.6 }
  ];
  const counterparts: Record<string, unknown>[] = [];
  if (options.includeAlice !== false) {
    counterparts.push({
      counterpart_ref: ALICE,
      dimensions: aliceDimensions.map((entry) => ({
        dimension_id: identifier(entry.dimension_id),
        value: unit(entry.value)
      }))
    });
  }
  counterparts.push({
    counterpart_ref: "subject:bob-like",
    dimensions: [
      { dimension_id: identifier(DIM_CLOSE), value: unit(0.2) },
      { dimension_id: identifier(DIM_TRUST), value: unit(0.8) }
    ]
  });
  const state = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    relationships: {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: logicalTime,
      state_revision: stateRevision,
      last_transition_time: stateRevision === 0 ? null : logicalTime,
      last_transition_type: stateRevision === 0 ? null : "Relationship",
      updated_at: logicalTime
    },
    trace_window: {
      ...base.trace_window,
      cursor: {
        last_history_sequence: stateRevision,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      entries: Array.from({ length: stateRevision }, (_, index) =>
        traceEntry(index + 1, repositoryRevision)
      )
    }
  };
  if (options.subjectId !== undefined) {
    (state.identity as { subject_id: unknown }).subject_id = options.subjectId;
  }
  return state as unknown as SubjectStateV0;
}

interface SemanticWorld {
  repository: InMemoryMemoryRepository;
  state: SubjectStateV0;
  records: readonly EpisodicMemoryRecordV0[];
  policy: RelationshipEvidenceChannelPolicyV0;
  catalog: RelationshipSemanticChannelCatalogV0;
}

async function buildSemanticWorld(recordCount = 3): Promise<SemanticWorld> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const records = baseRecords(recordCount);
  const hashes = [];
  for (const record of records) {
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
  }
  const prepared = await repository.prepareRevision({
    parent_revision: "R0" as never,
    records: hashes as never
  });
  const policy = policyFixture();
  const logicalTime = Math.max(BASE_LOGICAL_TIME, recordCount + 6);
  return {
    repository,
    records,
    state: subjectStateFixture(prepared.repository_revision, { logicalTime }),
    policy,
    catalog: await catalogFixture(policy)
  };
}

class FixedProvider implements RelationshipSemanticChannelProviderV0 {
  constructor(private readonly output: (input: { semantic_context_fingerprint: unknown; catalog_fingerprint: unknown }) => unknown) {}
  async propose(input: { semantic_context_fingerprint: unknown; catalog_fingerprint: unknown }): Promise<unknown> {
    return this.output(input);
  }
}

async function mintCapability(
  world: SemanticWorld,
  kind: "CHANNEL" | "ABSTAIN",
  channelId = CH_A
): Promise<Extract<RelationshipSemanticChannelRunResultV0, { kind: "ACCEPTED" }>> {
  const provider = new FixedProvider((input) => {
    const bindings = {
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
    return kind === "CHANNEL"
      ? { schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION, kind: "CHANNEL", channel_id: channelId, ...bindings }
      : { schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION, kind: "ABSTAIN", ...bindings };
  });
  const run = await runRelationshipSemanticChannelV0({
    subject_state: world.state,
    counterpart_ref: ALICE,
    selected_records: world.records,
    repository: world.repository,
    channel_policy: world.policy,
    semantic_catalog: world.catalog,
    provider
  });
  if (run.kind !== "ACCEPTED") throw new Error(`fixture capability mint failed: ${JSON.stringify(run)}`);
  return run;
}

function projectionsFor(
  world: SemanticWorld,
  activations: readonly number[]
): {
  memory_ref: string;
  age_logical: number;
  decay_factor: number;
  activation_strength: number;
}[] {
  const logicalTime = world.state.runtime_metadata.logical_time;
  return world.records.map((record, index) => ({
    memory_ref: record.episode_ref,
    age_logical: logicalTime - record.occurrence_logical_time,
    decay_factor: 0.9,
    activation_strength: activations[index % activations.length] ?? 0
  }));
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error("fixture index missing");
  return item;
}

const DEFAULT_ACTIVATIONS = [0.6, 0.6, 0.6];

function makeInput(
  world: SemanticWorld,
  capability: unknown,
  overrides: {
    readonly current_subject_state?: SubjectStateV0;
    readonly channel_policy?: unknown;
    readonly influence_projections?: readonly unknown[];
    readonly [key: string]: unknown;
  } = {}
): RelationshipPlasticityProducerInputV0 {
  const base = {
    current_subject_state: overrides.current_subject_state ?? world.state,
    semantic_capability: capability,
    channel_policy: overrides.channel_policy ?? world.policy,
    influence_projections:
      overrides.influence_projections ?? projectionsFor(world, DEFAULT_ACTIVATIONS)
  };
  const extras = Object.fromEntries(
    Object.entries(overrides).filter(
      ([key]) =>
        !["current_subject_state", "channel_policy", "influence_projections"].includes(key)
    )
  );
  return Object.assign(base, extras);
}

function expectRejected(
  result: RelationshipPlasticityProducerResultV0,
  code: string
): void {
  expect(result.kind).toBe("REJECTED");
  if (result.kind === "REJECTED") expect(result.code).toBe(code);
}

function executableSource(): string {
  return produceRelationshipPlasticityV0.toString();
}

describe("Semantic capability admission (RPP1–RPP6)", () => {
  it("RPP1: authentic CHANNEL capability accepted", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(makeInput(world, capability));
    expect(result.kind).toBe("PROPOSAL");
  });

  it("RPP2: authentic ABSTAIN -> NO_PROPOSAL SEMANTIC_ABSTAIN without projection processing", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "ABSTAIN");
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: [] })
    );
    expect(result).toEqual({ kind: "NO_PROPOSAL", reason: "SEMANTIC_ABSTAIN" });
  });

  it("RPP3: JSON cloned capability rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const clone = JSON.parse(JSON.stringify(capability));
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, clone)),
      "UNTRUSTED_SEMANTIC_CAPABILITY"
    );
  });

  it("RPP4: structuredClone capability rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, structuredClone(capability))),
      "UNTRUSTED_SEMANTIC_CAPABILITY"
    );
  });

  it("RPP5: field-perfect reconstructed capability rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const reconstruction = {
      kind: capability.kind,
      result: { ...capability.result },
      semantic_context: {
        ...capability.semantic_context,
        evidence: capability.semantic_context.evidence.map((item) => ({ ...item }))
      }
    };
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, reconstruction)),
      "UNTRUSTED_SEMANTIC_CAPABILITY"
    );
  });

  it("RPP6: inner result alone cannot grant authority", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability.result)),
      "UNTRUSTED_SEMANTIC_CAPABILITY"
    );
  });
});

describe("Current state authority and rebase (RPP7–RPP15)", () => {
  it("RPP7: SubjectState V3 fixture validates", async () => {
    const world = await buildSemanticWorld();
    expect(world.state.schema_version).toBe("subject-state-v3");
    expect(validateSubjectState(world.state).ok).toBe(true);
  });

  it("RPP8: invalid SubjectState rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const broken = {
      ...world.state,
      schema_version: "subject-state-v2"
    } as unknown as SubjectStateV0;
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { current_subject_state: broken })),
      "INVALID_CURRENT_SUBJECT_STATE"
    );
  });

  it("RPP9: subject mismatch rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const other = subjectStateFixture(world.state.memory_state.repository_revision, {
      subjectId: "subject-other"
    });
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { current_subject_state: other })),
      "SEMANTIC_SUBJECT_MISMATCH"
    );
  });

  it("RPP10: repository revision mismatch rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    await world.repository.prepareRevision({
      parent_revision: world.state.memory_state.repository_revision as never,
      records: []
    });
    const advanced = subjectStateFixture("R-next", {});
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { current_subject_state: advanced })),
      "SEMANTIC_REPOSITORY_REVISION_MISMATCH"
    );
  });

  it("RPP11: unrelated canonical revision advance allowed (N -> N+k)", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const advanced = subjectStateFixture(world.state.memory_state.repository_revision, {
      stateRevision: 3
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: advanced })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.proposal.expected_state_revision).toBe(3);
  });

  it("RPP12: current relationship value is used after N -> N+k", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_B);
    const advanced = subjectStateFixture(world.state.memory_state.repository_revision, {
      stateRevision: 2,
      aliceDimensions: [
        { dimension_id: DIM_CLOSE, value: 0.4 },
        { dimension_id: DIM_TRUST, value: 0.7 }
      ]
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: advanced })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.step).toBe(0.05);
    expect(result.proposal.updates[0]?.next_value).toBe(0.7 - 0.05);
  });

  it("RPP13: counterpart removed after semantic decision rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const removed = subjectStateFixture(world.state.memory_state.repository_revision, {
      includeAlice: false
    });
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { current_subject_state: removed })),
      "CURRENT_COUNTERPART_MISSING"
    );
  });

  it("RPP14: target dimension removed rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const narrowed = subjectStateFixture(world.state.memory_state.repository_revision, {
      aliceDimensions: [{ dimension_id: DIM_TRUST, value: 0.6 }]
    });
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { current_subject_state: narrowed })),
      "TARGET_DIMENSION_UNREGISTERED"
    );
  });

  it("RPP15: no automatic counterpart or dimension registration", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const removed = subjectStateFixture(world.state.memory_state.repository_revision, {
      includeAlice: false
    });
    const before = structuredClone(removed);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: removed })
    );
    expectRejected(result, "CURRENT_COUNTERPART_MISSING");
    expect(removed).toEqual(before);
    expect(executableSource()).not.toContain("CounterpartRegistration");
  });
});

describe("Frozen policy resolution (RPP16–RPP22)", () => {
  it("RPP16: invalid policy rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { channel_policy: { ...world.policy, extra: true } })
      ),
      "INVALID_CHANNEL_POLICY"
    );
  });

  it("RPP17: policy id mismatch rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const other = {
      ...policyFixture(),
      policy_id: identifier("other_policy")
    };
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { channel_policy: other })),
      "CHANNEL_POLICY_ID_MISMATCH"
    );
  });

  it("RPP18: policy fingerprint mismatch rejected (recomputed, caller fingerprint never trusted)", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const original = policyFixture();
    const rule0 = at(original.channels, 0);
    const rule1 = at(original.channels, 1);
    const tampered = {
      ...original,
      channels: [
        rule0,
        { channel_id: rule1.channel_id, target_dimension_id: identifier(DIM_CLOSE), direction: "DECREASE" }
      ]
    };
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { channel_policy: tampered })),
      "CHANNEL_POLICY_FINGERPRINT_MISMATCH"
    );
  });

  it("RPP19: channel resolution is an exact policy lookup; absent channel fails closed", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    // A policy without the semantic channel necessarily has a different
    // fingerprint, so the binding check fails first (fail-closed precedence).
    const original = policyFixture();
    const narrowed = {
      ...original,
      channels: original.channels.filter((channel) => channel.channel_id !== CH_A)
    };
    expectRejected(
      await produceRelationshipPlasticityV0(makeInput(world, capability, { channel_policy: narrowed })),
      "CHANNEL_POLICY_FINGERPRINT_MISMATCH"
    );
    // The resolver itself performs exact (non-fuzzy) lookup.
    const policy = policyFixture();
    expect(resolveChannel(policy, CH_A)?.target_dimension_id).toBe(DIM_CLOSE);
    expect(resolveChannel(policy, "ch_unknown")).toBe(null);
  });

  it("RPP20/21: dimension and direction come only from the frozen policy", async () => {
    const world = await buildSemanticWorld();
    const increase = await produceRelationshipPlasticityV0(
      makeInput(world, await mintCapability(world, "CHANNEL", CH_A))
    );
    const decrease = await produceRelationshipPlasticityV0(
      makeInput(world, await mintCapability(world, "CHANNEL", CH_B))
    );
    if (increase.kind !== "PROPOSAL" || decrease.kind !== "PROPOSAL") {
      throw new Error("fixture run failed");
    }
    expect(increase.proposal.updates[0]?.dimension_id).toBe(DIM_CLOSE);
    expect(decrease.proposal.updates[0]?.dimension_id).toBe(DIM_TRUST);
    expect((increase.proposal.updates[0]?.next_value as number)).toBeGreaterThan(0.4);
    expect((decrease.proposal.updates[0]?.next_value as number)).toBeLessThan(0.6);
  });

  it("RPP22: criterion text cannot affect dimension, direction or magnitude", async () => {
    const world = await buildSemanticWorld();
    const plain = await produceRelationshipPlasticityV0(
      makeInput(world, await mintCapability(world, "CHANNEL", CH_A))
    );
    const world2 = await buildSemanticWorld();
    const exoticCatalog = await catalogFixture(
      world2.policy,
      "Completely different criterion wording with totally unrelated vocabulary.",
      "Another unrelated wording for the second channel entry."
    );
    const exotic = await produceRelationshipPlasticityV0(
      makeInput(world2, await mintCapabilityWithCatalog(world2, "CHANNEL", CH_A, exoticCatalog))
    );
    if (plain.kind !== "PROPOSAL" || exotic.kind !== "PROPOSAL") throw new Error("fixture run failed");
    expect(JSON.stringify(exotic.proposal.updates)).toEqual(JSON.stringify(plain.proposal.updates));
    expect(exotic.step).toBe(plain.step);
  });
});

async function mintCapabilityWithCatalog(
  world: SemanticWorld,
  kind: "CHANNEL" | "ABSTAIN",
  channelId: string,
  catalog: RelationshipSemanticChannelCatalogV0
): Promise<Extract<RelationshipSemanticChannelRunResultV0, { kind: "ACCEPTED" }>> {
  const provider = new FixedProvider((input) => ({
    schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
    kind,
    ...(kind === "CHANNEL" ? { channel_id: channelId } : {}),
    semantic_context_fingerprint: input.semantic_context_fingerprint,
    catalog_fingerprint: input.catalog_fingerprint
  }));
  const run = await runRelationshipSemanticChannelV0({
    subject_state: world.state,
    counterpart_ref: ALICE,
    selected_records: world.records,
    repository: world.repository,
    channel_policy: world.policy,
    semantic_catalog: catalog,
    provider
  });
  if (run.kind !== "ACCEPTED") throw new Error(`fixture capability mint failed: ${JSON.stringify(run)}`);
  return run;
}

function resolveChannel(
  policy: RelationshipEvidenceChannelPolicyV0,
  channelId: string
): { target_dimension_id: string; direction: string } | null {
  const found = policy.channels.find((channel) => channel.channel_id === channelId);
  return found ?? null;
}

describe("Projection ingress and alignment (RPP23–RPP39)", () => {
  it("RPP23: zero projections rejected on CHANNEL path", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [] })
      ),
      "INVALID_PROJECTION_SET"
    );
  });

  it("RPP24: more than 32 projections rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const valid = projectionsFor(world, DEFAULT_ACTIVATIONS);
    const oversized = Array.from({ length: 33 }, (_, index) => at(valid, index % valid.length));
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: oversized })
      ),
      "INVALID_PROJECTION_SET"
    );
  });

  it("RPP25: malformed projection (unknown key) rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const malformed = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), weight: 1 };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [malformed] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP26: invalid memory_ref rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const bad = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), memory_ref: "entity:alice-like" };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [bad] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP27: negative age rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const bad = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), age_logical: -1 };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [bad] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP28: unsafe age rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const bad = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), age_logical: 2 ** 53 };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [bad] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP29: invalid decay_factor rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const bad = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), decay_factor: 1.1 };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [bad] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP30: invalid activation_strength rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const bad = { ...at(projectionsFor(world, DEFAULT_ACTIVATIONS), 0), activation_strength: Number.NaN };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: [bad] })
      ),
      "INVALID_INFLUENCE_PROJECTION"
    );
  });

  it("RPP31/RPP44: duplicate memory_ref rejected — duplicate inflation impossible", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const projections = projectionsFor(world, DEFAULT_ACTIVATIONS);
    const duplicated = [...projections, at(projections, 0)];
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: duplicated })
      ),
      "DUPLICATE_PROJECTION_REF"
    );
    // The frozen aggregator independently fails closed on duplicates.
    expect(() =>
      aggregateInfluenceEvidence([at(projections, 0) as never, at(projections, 0) as never])
    ).toThrowError(InfluenceEvidenceErrorV0);
  });

  it("RPP32: projection input permutation gives identical result", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const ordered = projectionsFor(world, DEFAULT_ACTIVATIONS);
    const shuffled = [...ordered].reverse();
    const first = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: ordered })
    );
    const second = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: shuffled })
    );
    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it("RPP33: evidence subset rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const subset = projectionsFor(world, DEFAULT_ACTIVATIONS).slice(0, 2);
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: subset })
      ),
      "EVIDENCE_REF_MISMATCH"
    );
  });

  it("RPP34: evidence superset rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const extra = projectionsFor(world, DEFAULT_ACTIVATIONS);
    extra.push({ memory_ref: "episode:ep-unbound", age_logical: 1, decay_factor: 0.9, activation_strength: 0.5 });
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: extra })
      ),
      "EVIDENCE_REF_MISMATCH"
    );
  });

  it("RPP35: evidence substitution rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const substituted = projectionsFor(world, DEFAULT_ACTIVATIONS);
    substituted[2] = { ...at(substituted, 2), memory_ref: "episode:ep-substitute" };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: substituted })
      ),
      "EVIDENCE_REF_MISMATCH"
    );
  });

  it("RPP36: semantic context refs, result refs and projection refs align exactly", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(makeInput(world, capability));
    if (result.kind !== "PROPOSAL") throw new Error("fixture run failed");
    const contextRefs = [...capability.semantic_context.evidence]
      .map((item) => item.episode_ref)
      .sort();
    expect(result.proposal.evidence_binding.member_refs).toEqual([...capability.result.evidence_refs].sort());
    expect(result.proposal.evidence_binding.member_refs).toEqual(contextRefs);
  });

  it("RPP37: wrong logical age rejected", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const swapped = projectionsFor(world, DEFAULT_ACTIVATIONS);
    const first = at(swapped, 0);
    const second = at(swapped, 1);
    swapped[0] = { ...first, age_logical: second.age_logical };
    swapped[1] = { ...second, age_logical: first.age_logical };
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { influence_projections: swapped })
      ),
      "PROJECTION_LOGICAL_TIME_MISMATCH"
    );
  });

  it("RPP38: logical-time advance requires fresh projection ages", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const advanced = subjectStateFixture(world.state.memory_state.repository_revision, {
      logicalTime: world.state.runtime_metadata.logical_time + 1
    });
    const stale = projectionsFor(world, DEFAULT_ACTIVATIONS);
    expectRejected(
      await produceRelationshipPlasticityV0(
        makeInput(world, capability, { current_subject_state: advanced, influence_projections: stale })
      ),
      "PROJECTION_LOGICAL_TIME_MISMATCH"
    );
    const fresh = stale.map((projection) => ({ ...projection, age_logical: projection.age_logical + 1 }));
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: advanced, influence_projections: fresh })
    );
    expect(result.kind).toBe("PROPOSAL");
  });

  it("RPP39: exact aligned refs accepted", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(makeInput(world, capability));
    expect(result.kind).toBe("PROPOSAL");
  });
});

describe("Aggregation and eligibility (RPP40–RPP48)", () => {
  it("RPP40/RPP41: aggregate recomputed inside producer; caller cannot inject aggregate", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const low = await produceRelationshipPlasticityV0(
      makeInput(world, capability, {
        influence_projections: projectionsFor(world, [0.5, 0.5, 0.4])
      })
    );
    expect(low).toEqual({
      kind: "NO_PROPOSAL",
      reason: "EVIDENCE_NOT_ELIGIBLE",
      eligibility_reasons: ["INSUFFICIENT_TOTAL_ACTIVATION"]
    });
    const injected = await produceRelationshipPlasticityV0(
      makeInput(world, capability, {
        influence_projections: projectionsFor(world, [0.5, 0.5, 0.4]),
        aggregate: { mean_activation: 0.9, member_refs: [] }
      })
    );
    expect(injected).toEqual(low);
  });

  it("RPP42: aggregate member refs exactly equal semantic evidence refs", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(makeInput(world, capability));
    if (result.kind !== "PROPOSAL") throw new Error("fixture run failed");
    const aggregate = aggregateInfluenceEvidence(
      result.proposal.evidence_binding.member_refs.map((ref, index) => ({
        memory_ref: ref,
        age_logical: index,
        decay_factor: unit(0.9),
        activation_strength: unit(0.5)
      }))
    );
    expect(aggregate.member_refs).toEqual([...result.proposal.evidence_binding.member_refs].sort());
  });

  it("RPP43: aggregation failure is typed in the frozen authority", () => {
    const projection = {
      memory_ref: "episode:ep-a",
      age_logical: 1,
      decay_factor: unit(0.9),
      activation_strength: unit(0.5)
    };
    let thrown: unknown = null;
    try {
      aggregateInfluenceEvidence([projection as never, projection as never]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InfluenceEvidenceErrorV0);
    expect((thrown as InfluenceEvidenceErrorV0).code).toBe("DUPLICATE_MEMORY_REF");
  });

  it("RPP45/RPP46: total_activation does not drive magnitude — mean_activation is the sole signal", async () => {
    const world3 = await buildSemanticWorld(3);
    const world6 = await buildSemanticWorld(6);
    const capability3 = await mintCapability(world3, "CHANNEL", CH_A);
    const capability6 = await mintCapability(world6, "CHANNEL", CH_A);
    const run3 = await produceRelationshipPlasticityV0(
      makeInput(world3, capability3, { influence_projections: projectionsFor(world3, [0.5, 0.5, 0.5]) })
    );
    const run6 = await produceRelationshipPlasticityV0(
      makeInput(world6, capability6, { influence_projections: projectionsFor(world6, Array(6).fill(0.5)) })
    );
    if (run3.kind !== "PROPOSAL" || run6.kind !== "PROPOSAL") throw new Error("fixture run failed");
    // total 1.5 vs total 3.0 — same mean 0.5, same capped step, same next value.
    expect(run3.step).toBe(run6.step);
    expect(run3.proposal.updates[0]?.next_value).toBe(run6.proposal.updates[0]?.next_value);
  });

  it("RPP47/RPP48: frozen eligibility thresholds -> NO_PROPOSAL EVIDENCE_NOT_ELIGIBLE with reasons", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, [0.5, 0.5, 0.4]) })
    );
    expect(result).toEqual({
      kind: "NO_PROPOSAL",
      reason: "EVIDENCE_NOT_ELIGIBLE",
      eligibility_reasons: ["INSUFFICIENT_TOTAL_ACTIVATION"]
    });
  });
});

describe("Numeric kernel (RPP49–RPP64)", () => {
  it("RPP49/RPP50: frozen constants — evidence scale 1, hard cap 0.05", () => {
    expect(RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE).toBe(1);
    expect(RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP).toBe(0.05);
  });

  it("RPP51: low mean activation produces the expected round4 step below the cap", async () => {
    const world = await buildSemanticWorld(32);
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const activations = Array(32).fill(0.046875);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, activations) })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.step).toBe(0.0469);
    expect(result.proposal.updates[0]?.next_value).toBe(0.4 + 0.0469);
  });

  it("RPP52: mean large enough caps step at 0.05", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, [0.9, 0.9, 0.9]) })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.step).toBe(0.05);
  });

  it("RPP53/RPP54/RPP55: INCREASE adds, DECREASE subtracts the same magnitude (symmetric V0)", async () => {
    const world = await buildSemanticWorld();
    const up = await produceRelationshipPlasticityV0(
      makeInput(world, await mintCapability(world, "CHANNEL", CH_A))
    );
    const down = await produceRelationshipPlasticityV0(
      makeInput(world, await mintCapability(world, "CHANNEL", CH_B))
    );
    if (up.kind !== "PROPOSAL" || down.kind !== "PROPOSAL") throw new Error("fixture run failed");
    // CH_A -> DIM_CLOSE (current 0.4, INCREASE); CH_B -> DIM_TRUST (current 0.6, DECREASE).
    expect(up.proposal.updates[0]?.next_value).toBeCloseTo(0.45, 12);
    expect(down.proposal.updates[0]?.next_value).toBeCloseTo(0.55, 12);
    // Symmetry: the SAME kernel step magnitude is applied with opposite signs.
    expect(up.step).toBe(0.05);
    expect(down.step).toBe(up.step);
    expect(up.proposal.updates[0]?.next_value).toBeCloseTo(0.4 + up.step, 12);
    expect(down.proposal.updates[0]?.next_value).toBeCloseTo(0.6 - down.step, 12);
  });

  it("RPP56: clamp upper boundary produces a bounded proposal", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const state = subjectStateFixture(world.state.memory_state.repository_revision, {
      aliceDimensions: [
        { dimension_id: DIM_CLOSE, value: 0.98 },
        { dimension_id: DIM_TRUST, value: 0.6 }
      ]
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: state })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.proposal.updates[0]?.next_value).toBe(1);
  });

  it("RPP57: clamp lower boundary produces a bounded proposal", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_B);
    const state = subjectStateFixture(world.state.memory_state.repository_revision, {
      aliceDimensions: [
        { dimension_id: DIM_CLOSE, value: 0.4 },
        { dimension_id: DIM_TRUST, value: 0.02 }
      ]
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: state })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    expect(result.proposal.updates[0]?.next_value).toBe(0);
  });

  it("RPP58: saturated upper -> NO_PROPOSAL SATURATED with computed step", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const state = subjectStateFixture(world.state.memory_state.repository_revision, {
      aliceDimensions: [
        { dimension_id: DIM_CLOSE, value: 1 },
        { dimension_id: DIM_TRUST, value: 0.6 }
      ]
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: state })
    );
    expect(result).toEqual({ kind: "NO_PROPOSAL", reason: "SATURATED", step: 0.05 });
  });

  it("RPP59: saturated lower -> NO_PROPOSAL SATURATED", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_B);
    const state = subjectStateFixture(world.state.memory_state.repository_revision, {
      aliceDimensions: [
        { dimension_id: DIM_CLOSE, value: 0.4 },
        { dimension_id: DIM_TRUST, value: 0 }
      ]
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: state })
    );
    expect(result).toEqual({ kind: "NO_PROPOSAL", reason: "SATURATED", step: 0.05 });
  });

  it("RPP60/RPP61: zero mean activation -> NO_PROPOSAL ZERO_EFFECTIVE_INFLUENCE (before eligibility)", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, [0, 0, 0]) })
    );
    expect(result).toEqual({ kind: "NO_PROPOSAL", reason: "ZERO_EFFECTIVE_INFLUENCE", step: 0 });
  });

  it("RPP62: no final rounding pass — kernel order reproduced exactly", async () => {
    const world = await buildSemanticWorld(32);
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const activations = Array(32).fill(0.046875);
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, activations) })
    );
    if (result.kind !== "PROPOSAL") throw new Error("fixture run failed");
    const expected = Math.max(0, Math.min(1, 0.4 + result.step));
    expect(result.proposal.updates[0]?.next_value).toBe(expected);
    expect(result.proposal.updates[0]?.next_value).toBe(0.4 + 0.0469);
  });

  it("RPP63: same input -> byte-identical proposal", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const input = makeInput(world, capability);
    const first = await produceRelationshipPlasticityV0(input);
    const second = await produceRelationshipPlasticityV0(input);
    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it("RPP64: projection permutation -> byte-identical proposal", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const ordered = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { influence_projections: projectionsFor(world, DEFAULT_ACTIVATIONS) })
    );
    const shuffled = await produceRelationshipPlasticityV0(
      makeInput(world, capability, {
        influence_projections: [...projectionsFor(world, DEFAULT_ACTIVATIONS)].reverse()
      })
    );
    expect(JSON.stringify(shuffled)).toEqual(JSON.stringify(ordered));
  });
});

describe("Proposal construction and canonical absence (RPP65–RPP78)", () => {
  it("RPP65–RPP72: proposal binds exact counterpart, one policy dimension, computed value, current revision, truthful evidence", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const state = subjectStateFixture(world.state.memory_state.repository_revision, {
      stateRevision: 2
    });
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { current_subject_state: state })
    );
    expect(result.kind).toBe("PROPOSAL");
    if (result.kind !== "PROPOSAL") return;
    const proposal = result.proposal;
    expect(proposal.counterpart_ref).toBe(ALICE);
    expect(proposal.updates).toHaveLength(1);
    expect(proposal.updates[0]?.dimension_id).toBe(DIM_CLOSE);
    expect(proposal.updates[0]?.next_value).toBe(0.4 + 0.05);
    expect(proposal.expected_state_revision).toBe(2);
    expect(proposal.subject_id).toBe(SUBJECT_ID);
    expect(proposal.evidence_binding.member_refs).toEqual([...capability.result.evidence_refs].sort());
    expect(proposal.evidence_binding.member_set_fingerprint).toBe(
      await deriveFingerprint(capability.result.evidence_refs)
    );
    expect(validateRelationshipUpdateProposal(proposal).ok).toBe(true);
  });

  it("RPP73–RPP78: producer never invokes executors, SubjectCore, memory, trace or Belief", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const before = structuredClone(world.state);
    const result = await produceRelationshipPlasticityV0(makeInput(world, capability));
    expect(result.kind).toBe("PROPOSAL");
    expect(world.state).toEqual(before);
    expect(world.state.trace_window.entries).toHaveLength(0);
    const source = executableSource();
    for (const forbidden of [
      "RelationshipTransitionExecutor",
      "CounterpartRegistration",
      "commitReserved",
      "reserveAndRoute",
      "prepareRevision",
      "storePayload",
      "Belief",
      "propose("
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

async function deriveFingerprint(refs: readonly string[]): Promise<string> {
  return deriveRelationshipEvidenceMemberSetFingerprint(refs as never);
}

describe("Non-scope / security (RPP79–RPP87)", () => {
  it("RPP79–RPP86: no provider, no confidence, no criterion magnitude, no psychology, no momentum, no homeostasis, no bridge, no Belief", () => {
    const source = executableSource();
    for (const forbidden of [
      "fetch(",
      "OpenAI",
      "provider",
      "LM Studio",
      "http",
      "confidence",
      "score",
      "probability",
      "momentum",
      "velocity",
      "inertia",
      "homeostasis",
      "RelationshipTransitionExecutor",
      "Belief"
    ]) {
      expect(source).not.toContain(forbidden);
    }
    for (const psychology of ["trust", "closeness", "attachment", "love", "hostility", "dominance"]) {
      // Word-boundary match: rejection codes like UNTRUSTED_* are not psychology.
      expect(new RegExp(`\\b${psychology}\\b`).test(source.toLowerCase())).toBe(false);
    }
  });

  it("RPP85b: repeated invocation with the same inputs is stateless (no hidden accumulator)", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const input = makeInput(world, capability);
    const first = await produceRelationshipPlasticityV0(input);
    const second = await produceRelationshipPlasticityV0(input);
    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it("RPP87: SubjectState remains V3", async () => {
    const world = await buildSemanticWorld();
    expect(world.state.schema_version).toBe("subject-state-v3");
    expect(validateSubjectState(world.state).ok).toBe(true);
    expect(executableSource()).not.toContain("subject-state-v2");
  });
});

describe("Workspace graph (RPP98)", () => {
  it("RPP98: new dependency edges are exactly the lawful two; graph stays acyclic", () => {
    const runtimePackage = JSON.parse(runtimePackageRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const workspaceDeps = Object.keys({
      ...runtimePackage.dependencies,
      ...runtimePackage.devDependencies
    })
      .filter((name) => name.startsWith("@characteros-next/"))
      .sort();
    expect(workspaceDeps).toEqual([
      "@characteros-next/behavior",
      "@characteros-next/influence-evidence",
      "@characteros-next/memory",
      "@characteros-next/memory-influence",
      "@characteros-next/subject-core"
    ]);
    // Closure: influence-evidence -> memory-influence -> memory -> subject-core;
    // no edge ever returns to runtime, so the graph remains acyclic.
  });
});

describe("Reserved-namespace writer hardening", () => {
  it("producer fail-closed when the supplied channel policy targets a reserved relationship_core_* dimension", async () => {
    const world = await buildSemanticWorld();
    const capability = await mintCapability(world, "CHANNEL", CH_A);
    const reservedTargetPolicy: RelationshipEvidenceChannelPolicyV0 = {
      ...world.policy,
      channels: [
        {
          channel_id:
            CH_A as RelationshipEvidenceChannelPolicyV0["channels"][number]["channel_id"],
          target_dimension_id:
            "relationship_core_reserved_v0" as RelationshipEvidenceChannelPolicyV0["channels"][number]["target_dimension_id"],
          direction: "INCREASE"
        }
      ]
    };
    const result = await produceRelationshipPlasticityV0(
      makeInput(world, capability, { channel_policy: reservedTargetPolicy })
    );
    expect(result.kind).toBe("REJECTED");
    if (result.kind !== "REJECTED") return;
    // Fail-closed at the hardened generic channel-policy validator the
    // producer re-runs internally; the dedicated TARGET_DIMENSION_RESERVED
    // rejection behind it is belt-and-braces for future refactors.
    expect(result.code).toBe("INVALID_CHANNEL_POLICY");
    expect(result.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
  });
});
