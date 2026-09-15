/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — world construction and the live scene run.
 *
 * The familiarity value is NEVER set directly: it is accrued by the production
 * governed writer authority + Atomic Commit V2 pipeline
 * (`processInteractionExperience`) from canonical firsthand episodes, exactly as
 * in production. Every condition builds its familiarity from the SAME 16
 * canonical episodes; only the number of ADMITTED (qualifying) interactions
 * differs, so repository payloads, episode refs, scene text and Memory are
 * identical across conditions.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  type EpisodicMemoryRecordV0
} from "../../../packages/memory/dist/index.js";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  validateSubjectState,
  type AtomicCommitBundleAnyVersion,
  type InMemoryFacadeAssembly,
  type RepositoryRevisionBindingV1,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";

import {
  ALICE,
  CONDITIONS,
  CONVENTION_REF,
  CONVENTION_SCENE,
  EPISODE_REFS,
  HISTORY_SCENES,
  MODEL,
  SUBJECT,
  TASK,
  type ConditionId
} from "./contract.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { createConversationIngressLedgerAuthorityV0 } = await import(`${runtimeDist}transitions/conversation/conversation-ingress-ledger.js`);
const { buildContextDelta } = await import(`${runtimeDist}ports/context-producer-port.js`);
const { observationInput, observationCauseRefOf, s0 } = await import(`${runtimeDist}transitions/observation/observation-fixtures.js`);
const { buildObservationProposal } = await import(`${runtimeDist}transitions/observation/observation-transition-executor.js`);
const { processInteractionExperience } = await import(`${runtimeDist}transitions/relationship/relationship-interaction-familiarity-ingestion.js`);
const { mintTrustedCanonicalHistoryBoundaryV4V0 } = await import(`${runtimeDist}authority/trusted-canonical-history-boundary.js`);
const { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } = await import(`${runtimeDist}authority/restore-chain-authority-v4.js`);

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`EXPERIMENT_ASSERT: ${message}`);
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

/** Deterministic JSON (sorted keys) for hashing frozen artifacts. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function objectHash(value: unknown): string {
  return hashJson(value);
}

export interface EpisodeRecordEntry {
  readonly ref: string;
  readonly payload_hash: string;
}

/** One canonical firsthand interaction episode (ordinary episode, not a feedback Experience). */
function interactionEpisode(ref: string, scene: string): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: ref as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: { transition_id: `t-enc-${ref}` as never, producer: "memory", cause_refs: [] },
    references: [ALICE as never],
    context: { scene, focus_refs: [ALICE as never], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" }
  } as unknown as EpisodicMemoryRecordV0;
}

export function historyEpisodes(): readonly EpisodicMemoryRecordV0[] {
  const convention = interactionEpisode(CONVENTION_REF, CONVENTION_SCENE);
  const interactions = EPISODE_REFS.map((ref, index) => interactionEpisode(ref, HISTORY_SCENES[index] as string));
  return Object.freeze([convention, ...interactions]);
}

export interface Runtime {
  readonly repo: InMemoryMemoryRepository;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly issuer: ReturnType<InMemoryFacadeAssembly<SubjectStateV4>["producerAuthorizationIssuer"]["issue"]> extends never ? never : InMemoryFacadeAssembly<SubjectStateV4>["producerAuthorizationIssuer"];
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  readonly binding: RepositoryRevisionBindingV1;
  readonly genesisEnvelope: unknown;
}

export interface HistoryBundle {
  readonly condition: string;
  readonly records: readonly EpisodeRecordEntry[];
  readonly binding: RepositoryRevisionBindingV1;
  readonly genesis_envelope: unknown;
  readonly bundles: readonly unknown[];
  readonly familiarity_value: number | null;
  readonly state_revision: number;
  readonly repository_revision: string;
}

/** Rebuild the deterministic memory repository for the frozen episode fixtures. */
export async function buildRepository(): Promise<{ repo: InMemoryMemoryRepository; binding: RepositoryRevisionBindingV1; records: readonly EpisodeRecordEntry[] }> {
  const repo = new InMemoryMemoryRepository();
  const records: EpisodeRecordEntry[] = [];
  for (const episode of historyEpisodes()) {
    records.push({ ref: episode.episode_ref as string, payload_hash: (await repo.storePayload(episode.episode_ref as never, episode)) as string });
  }
  records.sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: "intent-familiarity-completion-history" as never,
    parent_revision: null as never,
    records: records as never
  });
  const binding = {
    repository_revision: prepared.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest)
  } as RepositoryRevisionBindingV1;
  check(await repo.validateRevisionBinding(binding as never), "real repository binding");
  return { repo, binding, records };
}

function seedState(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: SUBJECT },
    memory_state: {
      ...(base["memory_state"] as Record<string, unknown>),
      working_refs: [CONVENTION_REF],
      repository_revision: repositoryRevision
    },
    context: {
      ...(base["context"] as Record<string, unknown>),
      scene: TASK,
      task: TASK,
      active_entity_refs: [ALICE]
    },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "experiment_host_dimension", value: 0.25 }] }]
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`seed: ${checked.error.detail}`);
  return checked.value;
}

/** Build a condition's world: real governed head commit + real familiarity ingestion. */
export async function buildHistory(condition: ConditionId): Promise<{ runtime: Runtime; bundle: HistoryBundle }> {
  return await buildHistoryWithCredits(CONDITIONS[condition].credits, condition);
}

/** Same real path with an explicit credit count (0 = the ABSENT baseline world). */
export async function buildHistoryWithCredits(credits: number, label: string): Promise<{ runtime: Runtime; bundle: HistoryBundle }> {
  const { repo, binding, records } = await buildRepository();
  const seed = seedState(binding.repository_revision);
  const genesisResult = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT, display_name: "", identity_anchors: [] },
      v3_source: seed,
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async (candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(binding)
  } as never);
  if (!genesisResult.ok) throw new Error(`${genesisResult.code}: ${genesisResult.detail}`);
  const genesis = genesisResult.state as unknown as SubjectStateV4;

  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT as never, genesis as never]]),
    seedBundles: [],
    referenceValidator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);
  const issuer = assembly.producerAuthorizationIssuer;

  // Counterpart registration head commit (generic dimension; no governed token).
  const headProposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-fam-completion-head-${label}`,
    subject_id: SUBJECT,
    transition_type: "Relationship",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    external_refs: [],
    domain_deltas: [{
      producer: "relationship",
      domain: "relationship",
      expected_repository_revision: null,
      operations: [{ path: "/relationships", value: genesis.relationships }],
      provenance_refs: []
    }]
  } as const;
  const reserved = await assembly.facade.reserveAndRoute(headProposal as never);
  check(reserved.kind === "CONTINUE", `head reservation (${String(reserved.kind)})`);
  const committed = await assembly.facade.commitReserved({
    proposal: headProposal as never,
    continuation: reserved.continuation,
    producerAuthorization: issuer.issue([{ producer: "relationship", domain: "relationship" }]),
    preparedBinding: {
      transition_id: headProposal.transition_id as never,
      subject_id: SUBJECT as never,
      transition_type: "Relationship",
      payload_fingerprint: await proposalFingerprint(headProposal as never),
      prepared_result_ref: `workflow:fam-completion-head-${label}` as never
    },
    repository_bindings: [binding]
  } as never);
  check(committed.kind === "COMMITTED", `head commit (${JSON.stringify(committed).slice(0, 200)})`);

  // Real familiarity accrual: the FIRST `credits` episodes are admitted firsthand
  // interactions; the remaining episodes are lawfully ABSTAINED (identical Memory).
  const episodes = historyEpisodes().filter((episode) => episode.episode_ref !== CONVENTION_REF);
  for (let index = 0; index < episodes.length; index += 1) {
    const episode = episodes[index] as EpisodicMemoryRecordV0;
    const admitted = index < credits;
    const outcome = await processInteractionExperience({
      memory: repo as never,
      assembly: assembly as never,
      admissionProvider: {
        admit: async () => (admitted ? { kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" } : { kind: "ABSTAIN" })
      } as never,
      repositoryBindings: [binding] as never,
      readGenesisSnapshot: async () => genesis as never,
      readGenesisEnvelope: async () => genesisResult.envelope as never,
      genesisReferenceValidator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never)
    } as never, { subject_id: SUBJECT as never, counterpart_ref: ALICE as never, episode } as never);
    const expected = admitted ? "QUALIFIED_AND_COMMITTED" : "NOT_QUALIFIED_ABSTAINED";
    check(outcome.kind === expected, `ingestion ${String(episode.episode_ref)} for ${label}: ${outcome.kind} (expected ${expected})`);
  }

  const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  const runtime: Runtime = {
    repo,
    assembly,
    issuer: issuer as never,
    ingressLedger: createConversationIngressLedgerAuthorityV0(),
    binding,
    genesisEnvelope: genesisResult.envelope
  };
  const familiarity = familiarityOf(snapshot);
  check(
    familiarity === (credits === 0 ? null : credits / 32),
    `familiarity for ${label}: ${String(familiarity)} (expected ${String(credits / 32)})`
  );
  const bundle: HistoryBundle = {
    condition: label,
    records,
    binding,
    genesis_envelope: JSON.parse(JSON.stringify(genesisResult.envelope)) as unknown,
    bundles: JSON.parse(JSON.stringify(assembly.storeRead.getCommittedBundles())) as readonly unknown[],
    familiarity_value: familiarity,
    state_revision: snapshot.runtime_metadata.state_revision as number,
    repository_revision: snapshot.memory_state.repository_revision as string
  };
  return { runtime, bundle };
}

export function familiarityOf(snapshot: SubjectStateV4): number | null {
  const counterpart = snapshot.relationships.counterparts.find((entry) => entry.counterpart_ref === ALICE);
  const dimension = counterpart?.dimensions.find((entry) => entry.dimension_id === "relationship_core_interaction_familiarity_v0");
  return dimension === undefined ? null : (dimension.value as number);
}

/** Fresh-process authoritative restore: rebuild Memory, mint the v4 boundary,
 * restore the exact committed head, and rebuild the transition journal. */
export async function restoreHistory(bundle: HistoryBundle): Promise<Runtime> {
  const { repo, binding } = await buildRepository();
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
  check(familiarityOf(restoredSnapshot) === bundle.familiarity_value, "restored familiarity is exactly the persisted value");
  check(restoredSnapshot.runtime_metadata.state_revision === bundle.state_revision, "restored state revision is exact");
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT as never, restoredSnapshot as never]]),
    seedBundles: bundles as never,
    referenceValidator: async (candidate: unknown) => repo.validateRevisionBinding(candidate as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);
  assembly.journal.rebuildFromCommittedBundles(bundles as never);
  return {
    repo,
    assembly: assembly as never,
    issuer: assembly.producerAuthorizationIssuer as never,
    ingressLedger: createConversationIngressLedgerAuthorityV0(),
    binding,
    genesisEnvelope: bundle.genesis_envelope
  };
}

export interface Admission {
  readonly observationRef: string;
  readonly observationTransitionId: string;
}

/** Admit the frozen current observation (the matched scenario utterance). */
export async function admitObservation(runtime: Runtime, sourceEventId: string, text: string): Promise<Admission> {
  const snapshot = (await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  check(snapshot !== null, "snapshot before observation");
  const outcome = await runtime.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-familiarity-completion",
    actor_ref: ALICE,
    text,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: null,
    host_adapter: "experiment-adapter"
  } as never);
  check(outcome.kind === "RECORDED", `ingress recorded (${String(outcome.kind)})`);
  const eventRef = outcome.record.event_ref as string;
  const observation = observationInput({
    observation_id: `observation:o-${sourceEventId}`,
    source_refs: [eventRef, "source:s-3"],
    entity_refs: [ALICE as never, "subject:s0" as never],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time
  });
  const contextDelta = await buildContextDelta(observation as never, snapshot as never);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta]
  } as never);
  const reserved = await runtime.assembly.facade.reserveAndRoute(proposal as never);
  check(reserved.kind === "CONTINUE", `observation reservation (${String(reserved.kind)})`);
  const commitOutcome = await runtime.assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: runtime.issuer.issue([{ producer: "context", domain: "context" }] as never),
    preparedBinding: {
      prepared_result_ref: `workflow:w-fam-obs-${sourceEventId}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal as never)
    },
    repository_bindings: [runtime.binding] as never
  } as never);
  check(commitOutcome.kind === "COMMITTED", `observation commit (${JSON.stringify(commitOutcome).slice(0, 200)})`);
  return {
    observationRef: observationCauseRefOf(commitOutcome.bundle as never),
    observationTransitionId: commitOutcome.bundle.transition_id as string
  };
}

export const DIMENSION_ID = "relationship_core_interaction_familiarity_v0" as const;
export const MODEL_SETTINGS = MODEL;

/** Map the host-validated response-semantics atom to the predeclared class. */
export function classifyAtom(proposal: {
  readonly response_semantics?: { readonly kind?: string; readonly claim_index?: number };
  readonly factual_assessment?: { readonly claims?: readonly { readonly kind?: string; readonly text?: string }[] };
}): string {
  const atom = proposal.response_semantics;
  if (atom === undefined || typeof atom.kind !== "string") return "UNCLASSIFIED";
  if (atom.kind === "PRIMARY_CLARIFICATION") return "FRAMING_QUESTION";
  if (atom.kind === "PRIMARY_STANCE") return "STANCE";
  if (atom.kind === "PRIMARY_CONVERSATIONAL_ACT") return "CONVERSATIONAL_ACT";
  if (atom.kind === "PRIMARY_FACT") {
    const claim = proposal.factual_assessment?.claims?.[atom.claim_index ?? -1];
    if (claim?.kind === "SOURCE_QUOTE" && typeof claim.text === "string" && CONVENTION_SCENE.includes(claim.text) && claim.text.length >= 24) {
      return "ESTABLISHED_CONVENTION_USED";
    }
    return "OTHER_FACT";
  }
  return "UNCLASSIFIED";
}

/** Read the source fingerprint of the harness tree (freeze provenance). */
export function readHarnessSource(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}
