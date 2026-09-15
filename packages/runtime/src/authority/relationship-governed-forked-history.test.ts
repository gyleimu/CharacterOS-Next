/**
 * Relationship Governed Forked-History Adversarial Boundary V0 — negative suite
 * (AUDIT_REMEDIATION_AND_FREEZE_V0, TASK 2).
 *
 * Constructs DIVERGENT-BUT-INDIVIDUALLY-VALID history branches over ONE shared
 * genesis and proves that a fork can never be substituted for canonical
 * history. BOTH branches are produced by the REAL production pipeline (facade →
 * engine → store; each branch's governed familiarity authority comes from the
 * REAL experience-ingestion workflow), and every assertion runs through the
 * REAL validation path (`validateAtomicCommitChainV0`,
 * `mintRelationshipGovernedTrustedHistoryCapabilityV0`,
 * `lookupLatestRelationshipGovernedAuthorityV0`,
 * `evaluateRelationshipGovernedWriteV0`).
 *
 * NO production bypass exists or is added for this suite: the fork branch is an
 * ordinary second subject history, not a mocked validator.
 *
 * Properties proven (each fails closed):
 *   A  two divergent branches are EACH individually chain-valid, each carrying
 *      its own lawful governed familiarity authority — a valid chain with a
 *      resolvable authority is NOT canonicality
 *   B  a fork cannot mint a trusted-history capability against the canonical
 *      head (divergent head), while the same fork mints for its OWN head
 *   C  a boundary minted for one branch cannot validate the other branch's
 *      bundles (trusted-head binding is exact, never a subset)
 *   D  a capability minted for one branch cannot read the OTHER branch's
 *      governed authority — no cross-branch previous authority (both
 *      directions), with the own-branch pairing as positive control
 *   E  the governed writer DENIES evaluation across branches (both directions)
 *   F  a fork cannot inherit authority by lineage: a predecessor-absent target
 *      over canonical governed history is rejected (INITIALIZE_WITH_LINEAGE),
 *      while the same shape on a lineage-free counterpart still initializes
 *   G  a truncated prefix of the canonical branch cannot mint (a prefix is not
 *      a shorter canonical history)
 *
 * DOCUMENTED RESIDUAL BOUNDARY (pre-existing, unchanged by this suite): the
 * lookup admits the caller-supplied bundle array and re-binds it against the
 * capability's frozen head only once a matching authority candidate is found;
 * when the array carries NO matching candidate the lookup reports
 * NO_MATCHING_AUTHORITY. The capability itself is only mintable over a fully
 * validated chain terminating at the exact current head, and the lookup is
 * reachable only from trusted internal composition (see the audit's
 * "trusted caller only" finding) — this suite therefore proves the enforced
 * fork rejection, and does not claim a forged-array guarantee the architecture
 * does not make.
 *
 * Fully OFFLINE: deterministic fixtures only — 0 real model calls.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  type AtomicCommitBundleAnyVersion,
  type CanonicalTransitionProposalV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  computeMemoryRecordPayloadHash,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";

import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";
import {
  isRelationshipGovernedTrustedHistoryCapabilityV0,
  lookupLatestRelationshipGovernedAuthorityV0,
  mintRelationshipGovernedTrustedHistoryCapabilityV0,
  type RelationshipGovernedTrustedHistoryCapabilityV0
} from "./relationship-governed-trusted-history.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "./trusted-canonical-history-boundary.js";
import { evaluateRelationshipGovernedWriteV0 } from "../transitions/relationship/relationship-governed-write-authority-service.js";
import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
} from "../transitions/relationship/relationship-feature-decision-semantics.js";
import {
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0
} from "../transitions/relationship/relationship-interaction-familiarity-evidence-receipt.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0,
  type RelationshipInteractionQualifyingAdmissionProviderV0
} from "../transitions/relationship/relationship-interaction-familiarity-ingestion.js";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const ALICE = "entity:alice-like";
const BOB = "entity:bob-like";
const SUBJECT = "subject-s0";
const HOST_DIMENSION = "arbitrary_host_dimension";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;

type Assembly = ReturnType<typeof createInMemorySubjectCoreFacade>;

// ---- deterministic fixtures -------------------------------------------------------------

function episodeFixture(overrides: Partial<EpisodicMemoryRecordV0> = {}): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: "episode:e-fork-1" as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: {
      transition_id: "t-fork-encoding-1" as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE as never],
    context: {
      scene: "walked and talked with alice in the park",
      focus_refs: [ALICE as never],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" },
    ...overrides
  };
}

function seedState(input: {
  readonly memoryRevision: string;
  readonly counterparts?: readonly { counterpart_ref: string; dimension_id: string; value: number }[];
}): SubjectStateV0 {
  const grouped = new Map<string, { dimension_id: string; value: number }[]>();
  for (const entry of input.counterparts ?? []) {
    const dimensions = grouped.get(entry.counterpart_ref) ?? [];
    dimensions.push({ dimension_id: entry.dimension_id, value: entry.value });
    grouped.set(entry.counterpart_ref, dimensions);
  }
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: SUBJECT,
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
      repository_revision: input.memoryRevision,
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
      counterparts: [...grouped.entries()].map(([counterpart_ref, dimensions]) => ({
        counterpart_ref,
        dimensions
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
      state_revision: 0,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  } as unknown as SubjectStateV0;
}

function deterministicProvider(): RelationshipInteractionQualifyingAdmissionProviderV0 {
  return {
    async admit() {
      return { kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" as never };
    }
  };
}

interface Composition {
  readonly deps: InteractionFamiliarityIngestionDepsV0;
  readonly assembly: Assembly;
  readonly genesis: SubjectStateV0;
}

/** REAL production composition: durable memory repository + sanctioned facade. */
async function compose(episodes: readonly EpisodicMemoryRecordV0[]): Promise<Composition> {
  const memory = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (const episode of episodes) {
    const hash = await memory.storePayload(episode.episode_ref as never, episode);
    records.push({ ref: episode.episode_ref as never, payload_hash: hash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: "intent-forked-history-fixture" as never,
    parent_revision: null,
    records
  });
  const genesis = seedState({
    memoryRevision: prepared.repository_revision,
    counterparts: [{ counterpart_ref: ALICE, dimension_id: HOST_DIMENSION, value: 0.25 }]
  });
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT as never, genesis]]),
    preparedResultValidator: async () => true
  });
  return {
    deps: {
      memory,
      assembly,
      admissionProvider: deterministicProvider(),
      repositoryBindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      readGenesisSnapshot: async (subjectId) => (subjectId === SUBJECT ? genesis : null)
    },
    assembly,
    genesis
  };
}

async function commitViaFacade(assembly: Assembly, proposal: CanonicalTransitionProposalV1): Promise<void> {
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`fixture reservation failed: ${reserved.kind}`);
  const committed = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: proposal.transition_id as never,
      subject_id: SUBJECT as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: `workflow:w-${proposal.transition_id}` as never
    },
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
  });
  if (committed.kind !== "COMMITTED") throw new Error("fixture commit failed");
}

/** Ordinary (non-governed) host-dimension write. */
async function hostWrite(assembly: Assembly, transitionId: string, value: number): Promise<void> {
  const currentState = (await assembly.storeRead.readCurrentState(SUBJECT)) as SubjectStateV0;
  const revision = (currentState as unknown as { runtime_metadata: { state_revision: number } })
    .runtime_metadata.state_revision;
  const relationships = structuredClone(
    (currentState as unknown as Record<string, unknown>)["relationships"]
  ) as {
    counterparts: { counterpart_ref: string; dimensions: { dimension_id: string; value: number }[] }[];
  };
  const alice = relationships.counterparts.find((entry) => entry.counterpart_ref === ALICE);
  if (alice === undefined) throw new Error("fixture: alice missing from canonical relationships");
  alice.dimensions = [{ dimension_id: HOST_DIMENSION, value }];
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: SUBJECT,
    transition_type: "Relationship",
    expected_state_revision: revision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: relationships }],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
  await commitViaFacade(assembly, proposal);
}

async function mintBoundary(genesis: SubjectStateV0, terminal: AtomicCommitBundleAnyVersion) {
  const genesisResult = await createPersistenceEnvelope({
    snapshot: genesis,
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
    commit_head: null
  });
  if (!genesisResult.ok) throw new Error("fixture genesis envelope failed");
  const boundaryMint = await mintTrustedCanonicalHistoryBoundaryV0({
    genesis: genesisResult.value,
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
  if (boundaryMint.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  return boundaryMint.receipt;
}

function headFacts(terminal: AtomicCommitBundleAnyVersion) {
  return {
    subject_id: terminal.subject_id as never,
    state_revision: terminal.next_revision as never,
    commit_ref: terminal.commit_ref,
    record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after,
    snapshot_hash: terminal.snapshot_hash_after
  };
}

async function mintCapability(
  genesis: SubjectStateV0,
  bundles: readonly AtomicCommitBundleAnyVersion[],
  head: AtomicCommitBundleAnyVersion
): Promise<RelationshipGovernedTrustedHistoryCapabilityV0> {
  const mint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
    trusted_boundary: await mintBoundary(genesis, head),
    bundles,
    current_head: headFacts(head)
  });
  if (mint.kind !== "MINTED") throw new Error(`fixture capability mint failed: ${mint.detail}`);
  return mint.capability;
}

async function receiptRefFor(episode: EpisodicMemoryRecordV0): Promise<string> {
  return deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0({
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
    subject_id: SUBJECT as never,
    counterpart_ref: ALICE as never,
    episode_ref: episode.episode_ref,
    episode_payload_hash: (await computeMemoryRecordPayloadHash(episode)) as never,
    qualifying_class: "DIRECT_COMMUNICATION" as never,
    evidence_admission_policy_id: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0
  });
}

// ---- the two divergent branches -----------------------------------------------------------

interface Branch {
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly terminal: AtomicCommitBundleAnyVersion;
}

interface ForkedWorld {
  readonly genesis: SubjectStateV0;
  readonly canonical: Branch;
  readonly fork: Branch;
}

/**
 * ONE genesis, TWO histories. Each branch commits an ordinary host write and
 * then a REAL production governed familiarity INITIALIZE for the SAME
 * counterpart, so both branches carry a lawful, resolvable governed authority
 * over divergent commit refs and divergent state hashes.
 */
async function buildForkedWorld(): Promise<ForkedWorld> {
  const episode = episodeFixture();
  const composition = await compose([episode]);

  // Canonical branch.
  await hostWrite(composition.assembly, "t-canonical-1", 0.25);
  const canonicalIngest = await processInteractionExperience(composition.deps, {
    subject_id: SUBJECT as never,
    counterpart_ref: ALICE as never,
    episode
  });
  expect(canonicalIngest.kind).toBe("QUALIFIED_AND_COMMITTED");

  // Fork branch — same genesis, independent store, DIFFERENT content.
  const forkAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT as never, composition.genesis]]),
    preparedResultValidator: async () => true
  });
  await hostWrite(forkAssembly, "t-fork-1", 0.75);
  const forkIngest = await processInteractionExperience(
    { ...composition.deps, assembly: forkAssembly },
    { subject_id: SUBJECT as never, counterpart_ref: ALICE as never, episode }
  );
  expect(forkIngest.kind).toBe("QUALIFIED_AND_COMMITTED");

  const canonicalBundles = composition.assembly.storeRead.getCommittedBundles();
  const forkBundles = forkAssembly.storeRead.getCommittedBundles();
  return {
    genesis: composition.genesis,
    canonical: {
      bundles: canonicalBundles,
      terminal: canonicalBundles[canonicalBundles.length - 1] as AtomicCommitBundleAnyVersion
    },
    fork: {
      bundles: forkBundles,
      terminal: forkBundles[forkBundles.length - 1] as AtomicCommitBundleAnyVersion
    }
  };
}

function targetFor(counterpart: string, previous: unknown, next: number) {
  return {
    counterpart_ref: counterpart as never,
    dimension_id: FAMILIARITY as never,
    previous: previous as never,
    next: { kind: "PRESENT", value: next } as never
  };
}

const FEATURE = {
  feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
} as const;

async function evaluateAgainst(input: {
  readonly capability: unknown;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly counterpart?: string;
  readonly previous: unknown;
  readonly next: number;
  readonly receipt: string;
}) {
  return evaluateRelationshipGovernedWriteV0({
    proposal: {
      proposal_ref: "proposal:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as never,
      payload_fingerprint: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as never,
      subject_id: SUBJECT as never,
      expected_revision: 2 as never,
      transition_id: "t-fork-eval" as never,
      cause_refs: [input.receipt] as never,
      external_refs: [],
      relationship_delta_provenance_refs: [input.receipt] as never
    },
    target: targetFor(input.counterpart ?? ALICE, input.previous, input.next),
    feature: FEATURE,
    evidence_receipt_refs: [input.receipt] as never,
    history: { capability: input.capability as never, bundles: input.bundles as never }
  });
}

describe("forked canonical history cannot be substituted (adversarial, fail closed)", () => {
  it("A. two divergent branches over ONE genesis are EACH individually chain-valid with a resolvable authority", async () => {
    const world = await buildForkedWorld();

    expect(world.canonical.bundles).toHaveLength(2);
    expect(world.fork.bundles).toHaveLength(2);
    expect(world.canonical.terminal.next_revision).toBe(2);
    expect(world.fork.terminal.next_revision).toBe(2);

    // Genuinely divergent: different commit refs and different resulting states.
    expect(world.canonical.terminal.commit_ref).not.toBe(world.fork.terminal.commit_ref);
    expect(world.canonical.terminal.state_hash_after).not.toBe(world.fork.terminal.state_hash_after);

    // EACH branch is independently VALID under the real chain validator.
    const canonicalValidation = await validateAtomicCommitChainV0({
      trusted_boundary: await mintBoundary(world.genesis, world.canonical.terminal),
      bundles: world.canonical.bundles as never
    });
    expect(canonicalValidation.kind).toBe("VALID");

    const forkValidation = await validateAtomicCommitChainV0({
      trusted_boundary: await mintBoundary(world.genesis, world.fork.terminal),
      bundles: world.fork.bundles as never
    });
    expect(forkValidation.kind).toBe("VALID");

    // Each branch's governed authority is real and lawful WITHIN ITS OWN branch.
    for (const branch of [world.canonical, world.fork]) {
      const capability = await mintCapability(world.genesis, branch.bundles, branch.terminal);
      const ownLookup = await lookupLatestRelationshipGovernedAuthorityV0({
        capability,
        bundles: branch.bundles as never,
        subject_id: SUBJECT as never,
        counterpart_ref: ALICE as never,
        dimension_id: FAMILIARITY as never
      });
      expect(ownLookup.kind).toBe("FOUND");
      if (ownLookup.kind === "FOUND") expect(ownLookup.status).toBe("RESOLVED_VALID");
    }
  });

  it("B. a fork cannot mint a trusted-history capability against the canonical head", async () => {
    const world = await buildForkedWorld();

    // The fork's OWN boundary + OWN bundles (chain VALID), but the caller's
    // current head is the CANONICAL head → the fork cannot inherit authority.
    const forged = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(world.genesis, world.fork.terminal),
      bundles: world.fork.bundles,
      current_head: headFacts(world.canonical.terminal)
    });
    expect(forged.kind).toBe("REJECTED");
    if (forged.kind === "REJECTED") expect(forged.code).toBe("HEAD_MISMATCH");

    // A STALE head is the same class of failure, not a lesser one.
    const stale = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(world.genesis, world.canonical.terminal),
      bundles: world.canonical.bundles,
      current_head: headFacts(world.canonical.bundles[0] as AtomicCommitBundleAnyVersion)
    });
    expect(stale.kind).toBe("REJECTED");
    if (stale.kind === "REJECTED") expect(stale.code).toBe("HEAD_MISMATCH");

    // The fork still mints for its OWN head — so B is about canonicality, not
    // about the fork being structurally broken.
    const forkOwn = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(world.genesis, world.fork.terminal),
      bundles: world.fork.bundles,
      current_head: headFacts(world.fork.terminal)
    });
    expect(forkOwn.kind).toBe("MINTED");
  });

  it("C. a boundary minted for one branch cannot validate the other branch's bundles", async () => {
    const world = await buildForkedWorld();

    const canonicalBoundary = await mintBoundary(world.genesis, world.canonical.terminal);
    const crossValidation = await validateAtomicCommitChainV0({
      trusted_boundary: canonicalBoundary,
      bundles: world.fork.bundles as never
    });
    expect(crossValidation.kind).toBe("INVALID");
    if (crossValidation.kind === "INVALID") {
      // Same revision count ⇒ the exact terminal-head binding is what fails,
      // never a tolerated subset.
      expect(crossValidation.failure.code).toBe("TRUSTED_HEAD_MISMATCH");
    }

    const reverseValidation = await validateAtomicCommitChainV0({
      trusted_boundary: await mintBoundary(world.genesis, world.fork.terminal),
      bundles: world.canonical.bundles as never
    });
    expect(reverseValidation.kind).toBe("INVALID");
    if (reverseValidation.kind === "INVALID") {
      expect(reverseValidation.failure.code).toBe("TRUSTED_HEAD_MISMATCH");
    }
  });

  it("D. a capability cannot read the other branch's governed authority — no cross-branch previous authority", async () => {
    const world = await buildForkedWorld();
    const canonicalCapability = await mintCapability(
      world.genesis,
      world.canonical.bundles,
      world.canonical.terminal
    );
    const forkCapability = await mintCapability(world.genesis, world.fork.bundles, world.fork.terminal);
    expect(isRelationshipGovernedTrustedHistoryCapabilityV0(canonicalCapability)).toBe(true);
    expect(isRelationshipGovernedTrustedHistoryCapabilityV0(forkCapability)).toBe(true);

    // Canonical capability + fork bundles: the fork DOES carry a matching
    // authority, so the frozen-head re-bind is what must reject it.
    const crossLookup = await lookupLatestRelationshipGovernedAuthorityV0({
      capability: canonicalCapability,
      bundles: world.fork.bundles as never,
      subject_id: SUBJECT as never,
      counterpart_ref: ALICE as never,
      dimension_id: FAMILIARITY as never
    });
    expect(crossLookup.kind).toBe("UNTRUSTED_CAPABILITY");

    // The symmetric direction must fail closed identically.
    const reverseLookup = await lookupLatestRelationshipGovernedAuthorityV0({
      capability: forkCapability,
      bundles: world.canonical.bundles as never,
      subject_id: SUBJECT as never,
      counterpart_ref: ALICE as never,
      dimension_id: FAMILIARITY as never
    });
    expect(reverseLookup.kind).toBe("UNTRUSTED_CAPABILITY");

    // A structural clone is never authority either.
    const cloneLookup = await lookupLatestRelationshipGovernedAuthorityV0({
      capability: structuredClone(canonicalCapability) as never,
      bundles: world.canonical.bundles as never,
      subject_id: SUBJECT as never,
      counterpart_ref: ALICE as never,
      dimension_id: FAMILIARITY as never
    });
    expect(cloneLookup.kind).toBe("UNTRUSTED_CAPABILITY");
  });

  it("E. the governed writer DENIES evaluation across branches (both directions)", async () => {
    const world = await buildForkedWorld();
    const canonicalCapability = await mintCapability(
      world.genesis,
      world.canonical.bundles,
      world.canonical.terminal
    );
    const forkCapability = await mintCapability(world.genesis, world.fork.bundles, world.fork.terminal);
    const receipt = await receiptRefFor(episodeFixture());

    // Present target ⇒ the fork's authority would be the claimed prior.
    const crossEvaluation = await evaluateAgainst({
      capability: canonicalCapability,
      bundles: world.fork.bundles,
      previous: { kind: "PRESENT", value: 1 / 32 },
      next: 2 / 32,
      receipt
    });
    expect(crossEvaluation.kind).toBe("DENIED");
    if (crossEvaluation.kind === "DENIED") expect(crossEvaluation.code).toBe("UNTRUSTED_HISTORY");

    const reverseEvaluation = await evaluateAgainst({
      capability: forkCapability,
      bundles: world.canonical.bundles,
      previous: { kind: "PRESENT", value: 1 / 32 },
      next: 2 / 32,
      receipt
    });
    expect(reverseEvaluation.kind).toBe("DENIED");
    if (reverseEvaluation.kind === "DENIED") expect(reverseEvaluation.code).toBe("UNTRUSTED_HISTORY");
  });

  it("F. a fork cannot inherit authority by lineage: a predecessor-absent target over canonical governed history is rejected", async () => {
    const world = await buildForkedWorld();
    const canonicalCapability = await mintCapability(
      world.genesis,
      world.canonical.bundles,
      world.canonical.terminal
    );
    const receipt = await receiptRefFor(episodeFixture());

    // Fork-shaped claim: pretend familiarity never existed for this counterpart
    // and re-INITIALIZE at 1/32. The CANONICAL history already carries a
    // matching governed authority, so lineage is not ignorable.
    const lineageForgery = await evaluateAgainst({
      capability: canonicalCapability,
      bundles: world.canonical.bundles,
      previous: { kind: "ABSENT" },
      next: 1 / 32,
      receipt
    });
    expect(lineageForgery.kind).toBe("DENIED");
    if (lineageForgery.kind === "DENIED") {
      expect(lineageForgery.code).toBe("OPERATION_REJECTED");
      expect(lineageForgery.detail).toContain("INITIALIZE_WITH_LINEAGE");
    }

    // Positive control: the SAME shape on a lineage-free counterpart is lawful,
    // so the rejection above is about lineage, not a blanket denial.
    const lineageFree = await evaluateAgainst({
      capability: canonicalCapability,
      bundles: world.canonical.bundles,
      counterpart: BOB,
      previous: { kind: "ABSENT" },
      next: 1 / 32,
      receipt
    });
    expect(lineageFree.kind).toBe("PREPARED");
    if (lineageFree.kind === "PREPARED") expect(lineageFree.operation).toBe("INITIALIZE");
  });

  it("G. a truncated prefix of the canonical branch is not a shorter canonical history", async () => {
    const world = await buildForkedWorld();

    const prefixValidation = await validateAtomicCommitChainV0({
      trusted_boundary: await mintBoundary(world.genesis, world.canonical.terminal),
      bundles: [world.canonical.bundles[0] as AtomicCommitBundleAnyVersion] as never
    });
    expect(prefixValidation.kind).toBe("INVALID");
    if (prefixValidation.kind === "INVALID") {
      expect(prefixValidation.failure.code).toBe("TRUNCATED_HISTORY");
    }

    const prefixMint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(world.genesis, world.canonical.terminal),
      bundles: [world.canonical.bundles[0] as AtomicCommitBundleAnyVersion],
      current_head: headFacts(world.canonical.terminal)
    });
    expect(prefixMint.kind).toBe("REJECTED");
    if (prefixMint.kind === "REJECTED") expect(prefixMint.code).toBe("CHAIN_INVALID");
  });
});
