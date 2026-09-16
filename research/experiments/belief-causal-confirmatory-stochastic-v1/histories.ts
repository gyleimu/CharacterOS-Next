/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — frozen histories.
 *
 * Both branches are formed from a NORMAL EMPTY GENESIS through the production
 * path only: real Memory episodes → the production session wiring
 * (`BeliefAdaptationWiringV0`) → the frozen semantic runner → host proposition
 * admission / frozen plasticity → `BeliefTransitionExecutor` → SubjectCore
 * commit → durable state. No fixture INSERT, no seed belief, no direct mutation,
 * no manual credence assignment and no research-only writer.
 *
 * The semantic decision is supplied by a deterministic research-side provider:
 * it may replace SEMANTIC INTERPRETATION only and owns no identity, numeric or
 * write authority (it returns a label, or an existing target plus a relation).
 *
 * Branch isolation: each branch builds its OWN Memory repository, facade,
 * journal, genesis envelope, commit chain and workflow store. Nothing is shared
 * and nothing is derived from the other branch.
 */
import { createHash } from "node:crypto";

import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "../../../packages/memory/dist/index.js";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  validateSubjectState,
  type AtomicCommitBundleAnyVersion,
  type InMemoryFacadeAssembly,
  type RepositoryRevisionBindingV1,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";

import {
  EXPECTED_HIGH_PROGRESSION,
  EXPECTED_LOW_PROGRESSION,
  HIGH_EPISODES,
  LOW_EPISODES,
  TARGET_PROPOSITION_LABEL
} from "./contract.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { BeliefAdaptationWiringV0 } = await import(`${runtimeDist}session/belief-adaptation-wiring-v0.js`);
const { InMemoryBeliefAdaptationWorkflowStoreV0 } = await import(
  `${runtimeDist}transitions/belief/belief-adaptation-workflow-store.js`
);
const { deriveBeliefPropositionKeyV0 } = await import(`${runtimeDist}transitions/belief/index.js`);
const { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } = await import(
  `${runtimeDist}authority/restore-chain-authority-v4.js`
);
const { mintTrustedCanonicalHistoryBoundaryV4V0 } = await import(
  `${runtimeDist}authority/trusted-canonical-history-boundary.js`
);
const { observationInput, s0 } = await import(`${runtimeDist}transitions/observation/observation-fixtures.js`);

export const SUBJECT_ID = "subject-belief-causal-confirmatory" as const;

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PREREG_ASSERT: ${message}`);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

export function hashJson(value: unknown): string {
  return hashText(canonicalJson(value));
}

export type ConditionId = "LOW" | "HIGH";

export function episodesOf(condition: ConditionId): typeof LOW_EPISODES {
  return condition === "LOW" ? LOW_EPISODES : HIGH_EPISODES;
}

function episodeRecord(entry: {
  readonly ref: string;
  readonly occurrence_logical_time: number;
  readonly scene: string;
}): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: entry.ref as never,
    occurrence_logical_time: entry.occurrence_logical_time as never,
    recorded_at_logical_time: (entry.occurrence_logical_time + 1) as never,
    provenance: { transition_id: `t-enc-${entry.ref}` as never, producer: "memory", cause_refs: [] },
    references: [] as never,
    context: { scene: entry.scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: SALIENCE_SOURCE_ENCODING_DECLARED }
  } as unknown as EpisodicMemoryRecordV0;
}

export function seedState(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: SUBJECT_ID },
    memory_state: {
      ...(base["memory_state"] as Record<string, unknown>),
      working_refs: [],
      repository_revision: repositoryRevision
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`seed: ${checked.error.detail}`);
  check(checked.value.beliefs.items.length === 0, "normal genesis seed contains ZERO canonical beliefs");
  return checked.value;
}

/**
 * Deterministic research-side semantic provider: NEW candidate with the target
 * label while the canonical catalog is empty; otherwise EXISTING on the target
 * with a bearing classified from the episode scene text. It supplies no
 * identity and no number for a NEW candidate.
 */
export class DeterministicSemanticProvider {
  calls = 0;
  async propose(input: {
    readonly catalog: { readonly propositions: readonly { readonly proposition_id: string; readonly proposition_label: string }[] };
    readonly evidence: { readonly evidence: readonly { readonly scene: string }[] };
    readonly semantic_context_fingerprint: string;
    readonly candidate_catalog_fingerprint: string;
  }): Promise<unknown> {
    this.calls += 1;
    const bindings = {
      schema_version: "belief-semantic-provider-output-v0",
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    if (input.catalog.propositions.length === 0) {
      return { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: TARGET_PROPOSITION_LABEL };
    }
    const target =
      input.catalog.propositions.find((proposition) => proposition.proposition_label === TARGET_PROPOSITION_LABEL) ??
      input.catalog.propositions[0];
    check(target !== undefined, "target proposition present in the canonical catalog");
    const scenes = input.evidence.evidence.map((evidence) => evidence.scene).join(" ");
    const relation = /unusable|closed|not usable|obstructed/i.test(scenes) ? "CONTRADICTS" : "SUPPORTS";
    return { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation };
  }
}

export interface HistoryStepAttestation {
  readonly episode_ref: string;
  readonly intended_bearing: string;
  readonly terminal_kind: string;
  readonly reported_credence: number | null;
  readonly canonical_credence: number;
  readonly state_revision: number;
  readonly commit_ref: string | null;
  readonly provider_calls: number;
}

export interface HistoryBundle {
  readonly condition: ConditionId;
  readonly subject_id: string;
  readonly records: readonly { readonly ref: string; readonly payload_hash: string }[];
  readonly binding: RepositoryRevisionBindingV1;
  readonly genesis_envelope: unknown;
  readonly bundles: readonly unknown[];
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly seed_belief_item_count: number;
  readonly final_credence: number;
  readonly progression: readonly number[];
  readonly expected_progression: readonly number[];
  readonly proposition: {
    readonly canonical_label: string;
    readonly proposition_key: string;
    readonly proposition_id: string;
  };
  readonly steps: readonly HistoryStepAttestation[];
  readonly repository_digest: string;
  readonly commit_chain: readonly string[];
}

/** Forms ONE branch through the real production path and freezes its durable image. */
export async function buildBranch(condition: ConditionId): Promise<HistoryBundle> {
  const repo = new InMemoryMemoryRepository();
  const records: { ref: string; payload_hash: string }[] = [];
  for (const entry of episodesOf(condition)) {
    records.push({
      ref: entry.ref,
      payload_hash: (await repo.storePayload(entry.ref as never, episodeRecord(entry))) as string
    });
  }
  records.sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: `intent-bcv1-${condition.toLowerCase()}` as never,
    parent_revision: null as never,
    records: records as never
  });
  const binding = {
    repository_revision: prepared.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest)
  } as RepositoryRevisionBindingV1;
  check(await repo.validateRevisionBinding(binding as never), "real repository binding");

  const seed = seedState(binding.repository_revision);
  const genesisResult = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
      v3_source: seed,
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async (candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(binding)
  } as never);
  if (!genesisResult.ok) throw new Error(`genesis: ${genesisResult.code}: ${genesisResult.detail}`);
  const genesis = genesisResult.state as unknown as SubjectStateV4;
  check(genesis.beliefs.items.length === 0, "explicit-v4 genesis contains ZERO canonical beliefs");

  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, genesis as never]]),
    seedBundles: [],
    referenceValidator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);

  const provider = new DeterministicSemanticProvider();
  const store = new InMemoryBeliefAdaptationWorkflowStoreV0();
  const wiring = new BeliefAdaptationWiringV0({
    subjectCore: assembly.facade as never,
    memoryRepository: repo as never,
    producerAuthorizationIssuer: assembly.producerAuthorizationIssuer as never,
    semanticProvider: provider as never,
    workflowStore: store as never,
    readCommittedBundle: async (transitionId: string) =>
      assembly.storeRead.readCommittedByTransitionId(transitionId as never) as unknown as AtomicCommitBundleAnyVersion | null,
    readEpisodePayload: async (ref: string) =>
      (repo as unknown as { readStoredPayload(r: string): unknown }).readStoredPayload(ref) ?? null
  });

  const steps: HistoryStepAttestation[] = [];
  const progression: number[] = [];
  for (const entry of episodesOf(condition)) {
    const report = await wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [entry.ref] });
    check(report.status === "COMPLETED", `wiring status for ${entry.ref}: ${report.status} (${report.failure ?? ""})`);
    const current = report.current;
    check(current !== null, `wiring outcome for ${entry.ref}`);
    check(
      current.terminal_kind === "COMPLETE_COMMITTED",
      `terminal for ${entry.ref}: ${current.terminal_kind} (${current.detail ?? ""})`
    );
    const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT_ID as never)) as unknown as SubjectStateV4;
    check(snapshot.beliefs.items.length === 1, `exactly one canonical proposition after ${entry.ref}`);
    const item = snapshot.beliefs.items[0];
    check(item !== undefined, "canonical belief item present");
    progression.push(item.credence as number);
    const committedSoFar = assembly.storeRead.getCommittedBundles();
    steps.push({
      episode_ref: entry.ref,
      intended_bearing: entry.bearing,
      terminal_kind: current.terminal_kind,
      reported_credence: current.next_credence,
      canonical_credence: item.credence as number,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      commit_ref: (committedSoFar.at(-1)?.commit_ref as string | undefined) ?? null,
      provider_calls: current.provider_calls
    });
  }

  const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT_ID as never)) as unknown as SubjectStateV4;
  const expected = condition === "LOW" ? EXPECTED_LOW_PROGRESSION : EXPECTED_HIGH_PROGRESSION;
  check(
    JSON.stringify(progression) === JSON.stringify(expected),
    `${condition} progression ${JSON.stringify(progression)} != expected ${JSON.stringify(expected)}`
  );
  const item = snapshot.beliefs.items[0];
  check(item !== undefined, "final canonical belief item present");
  const committed = assembly.storeRead.getCommittedBundles();
  return {
    condition,
    subject_id: SUBJECT_ID,
    records,
    binding,
    genesis_envelope: JSON.parse(JSON.stringify(genesisResult.envelope)) as unknown,
    bundles: JSON.parse(JSON.stringify(committed)) as readonly unknown[],
    state_revision: snapshot.runtime_metadata.state_revision as number,
    repository_revision: snapshot.memory_state.repository_revision as string,
    seed_belief_item_count: 0,
    final_credence: item.credence as number,
    progression,
    expected_progression: expected,
    proposition: {
      canonical_label: item.proposition_label,
      proposition_key: await deriveBeliefPropositionKeyV0(item.proposition_label),
      proposition_id: item.proposition_id as string
    },
    steps,
    repository_digest: hashJson(records),
    commit_chain: committed.map((bundle) => `${bundle.transition_id as string}@${bundle.commit_ref as string}`)
  };
}

export interface RestoredBranch {
  readonly repo: InMemoryMemoryRepository;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly binding: RepositoryRevisionBindingV1;
  readonly genesisEnvelope: unknown;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly snapshot: SubjectStateV4;
  readonly restore: {
    readonly authority: string;
    readonly head_revision: number;
    readonly head_commit_ref: string;
    readonly state_hash: string;
    readonly snapshot_hash: string;
    readonly subject_id: string;
    readonly proposition_key: string;
    readonly credence: number;
    readonly status: string;
  };
}

/** Fresh-process authoritative restore from the frozen durable image alone. */
export async function restoreBranch(bundle: HistoryBundle): Promise<RestoredBranch> {
  const repo = new InMemoryMemoryRepository();
  const records: { ref: string; payload_hash: string }[] = [];
  for (const entry of episodesOf(bundle.condition)) {
    records.push({
      ref: entry.ref,
      payload_hash: (await repo.storePayload(entry.ref as never, episodeRecord(entry))) as string
    });
  }
  records.sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: `intent-bcv1-${bundle.condition.toLowerCase()}` as never,
    parent_revision: null as never,
    records: records as never
  });
  const binding = {
    repository_revision: prepared.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest)
  } as RepositoryRevisionBindingV1;
  check(JSON.stringify(binding) === JSON.stringify(bundle.binding), "fresh Memory binding equals the persisted binding");

  const bundles = bundle.bundles as readonly AtomicCommitBundleAnyVersion[];
  const headBundle = bundles.at(-1);
  check(headBundle !== undefined, "persisted terminal bundle");
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: headBundle.subject_id,
    revision: headBundle.next_revision,
    commit_ref: headBundle.commit_ref,
    record_checksum: headBundle.record_checksum,
    state_hash: headBundle.state_hash_after,
    snapshot_hash: headBundle.snapshot_hash_after
  };
  const minted = await mintTrustedCanonicalHistoryBoundaryV4V0({
    genesis: bundle.genesis_envelope as never,
    head: head as never,
    reference_validator: async (candidate: { repository_revision: string; repository_revision_hash: string }) => {
      const manifest = await repo.readManifest(candidate.repository_revision as never);
      return manifest !== null && (await computeRepositoryRevisionHash(manifest)) === candidate.repository_revision_hash;
    }
  } as never);
  check(minted.kind === "MINTED", `fresh v4 boundary minted (${String(minted.kind)})`);
  const headSnapshot = headBundle.next_snapshot as unknown as SubjectStateV4;
  const headManifest = await repo.readManifest(headSnapshot.memory_state.repository_revision as never);
  check(headManifest !== null, "head repository manifest");
  const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
    snapshot: headSnapshot,
    commit_head: head as never,
    repository_binding: {
      repository_revision: headSnapshot.memory_state.repository_revision,
      repository_revision_hash: await computeRepositoryRevisionHash(headManifest as never)
    } as never
  } as never);
  const restored = await restoreSubjectStateV4AuthoritativelyV0({
    envelope: envelope as never,
    trusted_boundary: minted.receipt,
    bundles: bundles as never,
    reference_validator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never)
  } as never);
  check(restored.kind === "RESTORED", `authoritative restore (${String(restored.kind)})`);
  const restoredSnapshot = restored.snapshot as unknown as SubjectStateV4;
  check(restoredSnapshot.runtime_metadata.state_revision === bundle.state_revision, "restored revision is exact");
  check(
    JSON.stringify(restoredSnapshot.beliefs.items) === JSON.stringify(headSnapshot.beliefs.items),
    "restored beliefs equal the persisted beliefs"
  );
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, restoredSnapshot as never]]),
    seedBundles: bundles as never,
    referenceValidator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);
  assembly.journal.rebuildFromCommittedBundles(bundles as never);
  const item = restoredSnapshot.beliefs.items[0];
  check(item !== undefined, "restored canonical belief present");
  return {
    repo,
    assembly: assembly as never,
    binding,
    genesisEnvelope: bundle.genesis_envelope,
    bundles,
    snapshot: restoredSnapshot,
    restore: {
      authority: "restoreSubjectStateV4AuthoritativelyV0",
      head_revision: headBundle.next_revision as number,
      head_commit_ref: bundle.commit_chain.at(-1) ?? "",
      state_hash: headBundle.state_hash_after as string,
      snapshot_hash: headBundle.snapshot_hash_after as string,
      subject_id: restoredSnapshot.identity.subject_id as string,
      proposition_key: await deriveBeliefPropositionKeyV0(item.proposition_label),
      credence: item.credence as number,
      status: "RESTORED"
    }
  };
}

export interface BranchIsolationAudit {
  /** Revision LABELS are per-repository counters and may coincide; the CONTENT must not. */
  readonly distinct_repository_digests: boolean;
  readonly distinct_genesis_envelopes: boolean;
  /**
   * The branches share exactly ONE canonical transition identity: the first
   * formation, which is intentionally byte-identical (same episode, same
   * proposition). Every LATER transition must be disjoint — which is precisely
   * what proves the treatment enters only from the second episode onward.
   */
  readonly shared_first_formation_identity: boolean;
  readonly shared_transitions_are_only_the_first_formation: boolean;
  readonly subsequent_transitions_disjoint: boolean;
  readonly same_subject_id: boolean;
  readonly same_proposition_key: boolean;
  readonly same_proposition_id: boolean;
  readonly same_state_revision: boolean;
  readonly isolated: boolean;
  readonly detail: Record<string, unknown>;
}

/** §11 explicit branch-isolation precheck over the two frozen histories. */
export function branchIsolationAudit(low: HistoryBundle, high: HistoryBundle): BranchIsolationAudit {
  const lowOrder = (low.bundles as readonly { transition_id: string }[]).map((bundle) => bundle.transition_id);
  const highOrder = (high.bundles as readonly { transition_id: string }[]).map((bundle) => bundle.transition_id);
  const lowSet = new Set(lowOrder);
  const sharedTransitions = highOrder.filter((id) => lowSet.has(id));
  const lowLater = lowOrder.slice(1);
  const highLater = highOrder.slice(1);
  const sharedFirst = lowOrder[0] !== undefined && lowOrder[0] === highOrder[0];
  const onlyFirstFormationShared = sharedTransitions.length === 1 && sharedTransitions[0] === lowOrder[0];
  const laterDisjoint = lowLater.every((id) => !highLater.includes(id));
  const distinctDigests = low.repository_digest !== high.repository_digest;
  const distinctEnvelopes = hashJson(low.genesis_envelope) !== hashJson(high.genesis_envelope);
  const sameSubject = low.subject_id === high.subject_id;
  const sameKey = low.proposition.proposition_key === high.proposition.proposition_key;
  const sameId = low.proposition.proposition_id === high.proposition.proposition_id;
  const sameRevision = low.state_revision === high.state_revision;
  return {
    distinct_repository_digests: distinctDigests,
    distinct_genesis_envelopes: distinctEnvelopes,
    shared_first_formation_identity: sharedFirst,
    shared_transitions_are_only_the_first_formation: onlyFirstFormationShared,
    subsequent_transitions_disjoint: laterDisjoint,
    same_subject_id: sameSubject,
    same_proposition_key: sameKey,
    same_proposition_id: sameId,
    same_state_revision: sameRevision,
    isolated:
      distinctDigests &&
      distinctEnvelopes &&
      sharedFirst &&
      onlyFirstFormationShared &&
      laterDisjoint &&
      sameSubject &&
      sameKey &&
      sameId &&
      sameRevision,
    detail: {
      low_transitions: lowOrder,
      high_transitions: highOrder,
      low_later_transitions: lowLater,
      high_later_transitions: highLater,
      shared_transition_ids: sharedTransitions,
      repository_revision_labels: { low: low.repository_revision, high: high.repository_revision },
      repository_digests: { low: low.repository_digest, high: high.repository_digest },
      note:
        "revision labels are per-repository counters; identity isolation is decided on content digests, genesis envelopes and transition sets"
    }
  };
}

/** The observation admission input for the frozen current scene (identical in all cells). */
export function currentObservationInput(input: {
  readonly occurrence_logical_time: number;
  readonly source_event_id: string;
}): unknown {
  return observationInput({
    observation_id: `observation:o-${input.source_event_id}`,
    source_refs: ["source:s-bcv1"],
    entity_refs: ["entity:caretaker" as never, "subject:s0" as never],
    occurrence_logical_time: input.occurrence_logical_time as never
  });
}
