/* eslint-disable no-restricted-imports -- Experiment-only Level-2 composition over built public roots; the two internal issuers below stay unexported in production. */
import {
  createInMemorySubjectCoreFacade, createPersistenceEnvelope, canonicalJsonString,
  type SubjectStateV0, type InMemoryFacadeAssembly, type RepositoryRevisionBindingV1,
  type AtomicCommitBundleAnyVersion, type PersistedSubjectEnvelopeV1
} from "../../../packages/subject-core/dist/index.js";
import {
  InMemoryMemoryRepository, InMemoryRetrievalService, computeMemoryRecordPayloadHash,
  computeRepositoryRevisionHash, validateEpisodicMemoryRecord, validateMemoryRetrievalQuery,
  type EpisodicMemoryRecordV0, type MemoryRetrievalQueryV0, type MemoryRetrievalResultV0
} from "../../../packages/memory/dist/index.js";
import {
  processInteractionExperience, RuntimeCompositionRoot, CognitionActionTransitionExecutor,
  InMemoryMiclWorkflowStore, ReferenceCognitionProviderV0, buildCognitivePromptMessages,
  allowedEvidenceSet, validateCognitionProposal, restoreCanonicalSubjectFromHistoryV0,
  type SubjectCorePort, type CognitionProviderV0, type CognitiveContextProjectionV0,
  type CognitionProposalV0, type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import { ALICE, BOB, SUBJECT, SCENARIO, HISTORY_SCENES, CONVENTION_REF, RESPONSE_CONTRACT } from "./contract.ts";
import type { EvidenceContent } from "./evaluator.ts";

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PREFLIGHT: ${message}`);
}
export function equal(a: unknown, b: unknown): boolean { return canonicalJsonString(a) === canonicalJsonString(b); }

export function episodes(count: number, counterpart = ALICE): EpisodicMemoryRecordV0[] {
  return Array.from({ length: count }, (_, i) => {
    const record = {
      schema_version: "episodic-memory-record-v0",
      episode_ref: `episode:${counterpart === ALICE ? "alice" : "bob"}-${String(i + 1).padStart(2, "0")}`,
      occurrence_logical_time: 0, recorded_at_logical_time: 0,
      provenance: { transition_id: `t-encoding-${counterpart === ALICE ? "alice" : "bob"}-${i + 1}`, producer: "memory", cause_refs: [] },
      references: [counterpart],
      context: { scene: counterpart === ALICE ? HISTORY_SCENES[i] : `Bob and the subject checked routine calendar entry ${i + 1}.`, focus_refs: [counterpart], environment_refs: [] },
      appraisal_ref: null, affect_snapshot_ref: null,
      salience: { declared_score: 0.5, source: "ENCODING_DECLARED_V0" }
    };
    const checked = validateEpisodicMemoryRecord(record);
    check(checked.ok, `invalid canonical episode ${i + 1}`);
    return checked.value;
  });
}

function seed(revision: string): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: { subject_id: SUBJECT, display_name: "", origin_metadata: { creation_source: null, seed_version: null }, identity_anchors: [], self_schema_seed_refs: [] },
    traits_seed: { dimensions: {} }, personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: { working_refs: [], active_episode_refs: [], autobiographical_index_revision: null,
      repository_revision: revision, consolidation_cursor: null,
      retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
      recent_retrieval_trace: [], lifecycle_metadata: {}, pending_encoding_refs: [], last_retrieval_at: null },
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: { schema_version: "relationship-state-v0", counterparts: [ALICE, BOB].map(counterpart_ref => ({ counterpart_ref, dimensions: [] })) },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: { scene: SCENARIO, task: "respond to Alice's request to revise the update", focus_refs: [], active_entity_refs: [ALICE], environment_refs: [], current_observation_ref: null },
    mechanism_config: { affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
      legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 }, feature_flags: {}, thresholds: {} },
    trace_window: { trace_window_schema_version: "trace-window-v1", capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null }, entries: [] },
    runtime_metadata: { subject_version: "subject-v0", state_revision: 0, logical_time: 0, last_transition_time: null, last_transition_type: null, created_at: 0, updated_at: 0 }
  } as unknown as SubjectStateV0;
}

export interface World {
  assembly: InMemoryFacadeAssembly;
  genesis: SubjectStateV0;
  snapshot: SubjectStateV0;
  memory: InMemoryMemoryRepository;
  records: readonly EpisodicMemoryRecordV0[];
  binding: RepositoryRevisionBindingV1;
}

async function memoryFor(records: readonly EpisodicMemoryRecordV0[]) {
  const memory = new InMemoryMemoryRepository();
  const refs = [];
  for (const record of records) refs.push({ ref: record.episode_ref, payload_hash: await memory.storePayload(record.episode_ref, record) });
  refs.sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
  const prepared = await memory.prepareRevisionForIntent({ intent_id: "intent-familiarity-history" as never, parent_revision: null, records: refs });
  const binding = { repository_revision: prepared.repository_revision, repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest) };
  check(await memory.validateRevisionBinding(binding), "real repository binding");
  return { memory, binding };
}

export async function buildWorld(count: 1 | 16, bobCount = 0): Promise<World> {
  const records = [...episodes(count), ...episodes(bobCount, BOB)];
  const { memory, binding } = await memoryFor(records);
  const genesis = seed(binding.repository_revision);
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT as never, genesis]]),
    preparedResultValidator: async binding => binding.prepared_result_ref.startsWith("workflow:")
  });
  const proposal = {
    schema_version: "canonical-transition-proposal-v1", transition_id: "t-experiment-head", subject_id: SUBJECT,
    transition_type: "Relationship", expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 }, cause_refs: [], external_refs: [],
    domain_deltas: [{ producer: "relationship", domain: "relationship", expected_repository_revision: null,
      operations: [{ path: "/relationships", value: genesis.relationships }], provenance_refs: [] }]
  } as const;
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  check(reserved.kind === "CONTINUE", "head reservation");
  const committed = await assembly.facade.commitReserved({ proposal: proposal as never, continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([{ producer: "relationship", domain: "relationship" }]),
    preparedBinding: { transition_id: proposal.transition_id as never, subject_id: SUBJECT as never, transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint, prepared_result_ref: "workflow:experiment-head" as never },
    repository_bindings: [binding] });
  check(committed.kind === "COMMITTED", "head commit");
  for (const episode of records) {
    const counterpart = episode.references[0];
    check(counterpart, "episode counterpart");
    const result = await processInteractionExperience({ memory, assembly,
      admissionProvider: { admit: async () => ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" }) },
      repositoryBindings: [binding], readGenesisSnapshot: async () => genesis
    }, { subject_id: SUBJECT as never, counterpart_ref: counterpart, episode });
    check(result.kind === "QUALIFIED_AND_COMMITTED", `real ingestion ${episode.episode_ref}`);
  }
  const snapshot = await assembly.storeRead.readCurrentState(SUBJECT);
  check(snapshot, "post-ingestion snapshot");
  return { assembly, genesis, snapshot, memory, records, binding };
}

/** Same existing declarative retrieval adapter as production conformance tests.
 * It is NOT a learned search benchmark. No scoring algorithm is changed. */
export async function runCycle(world: World, provider: CognitionProviderV0, empty = false,
  observations: { queries: MemoryRetrievalQueryV0[]; retrievalResults: MemoryRetrievalResultV0[] } = { queries: [], retrievalResults: [] }) {
  const { queries, retrievalResults } = observations;
  const selected = !empty && world.records.some(r => r.episode_ref === CONVENTION_REF) ? [CONVENTION_REF] : [];
  const inner = new InMemoryRetrievalService({ rehearsals: [{ repository_revision: world.binding.repository_revision,
    semantic_reference: ALICE as never, selected_memory_refs: selected as never,
    evidence: selected.map(ref => ({ episode_ref: ref as never, reasons: [{ dimension: "ENTITY" as const, score: 0.8 as never }] })),
    candidate_count: selected.length, retrieval_trace_ref: null }] });
  const core: SubjectCorePort = {
    reserveAndRoute: p => world.assembly.facade.reserveAndRoute(p), commitReserved: p => world.assembly.facade.commitReserved(p),
    terminalizeReservedNoOp: p => world.assembly.facade.terminalizeReservedNoOp(p),
    reconcile: (t, s, f) => world.assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async id => (await world.assembly.storeRead.readCurrentState(id)) ?? world.snapshot
  };
  const root = new RuntimeCompositionRoot({ subjectCore: core, producerAuthorizationIssuer: world.assembly.producerAuthorizationIssuer,
    memoryRepository: world.memory, cognitionProvider: provider,
    retrieval: { retrieve: async query => {
      check(validateMemoryRetrievalQuery(query).ok, "query contract");
      queries.push(structuredClone(query));
      const result = await inner.retrieve(query);
      check(await world.memory.validateRefsBelong(query.repository_revision, result.selected_memory_refs), "retrieved membership");
      retrievalResults.push(result);
      return result;
    } } });
  const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
    micl_id: "micl-familiarity-experiment" as never, micl_request_fingerprint: `sha256:${"1".repeat(64)}` as never, stage_key: "OBSERVATION"
  });
  const executor = new CognitionActionTransitionExecutor({ ...root.dependencies(), subjectCore: minter.core() });
  const result = await executor.execute({ subject_id: SUBJECT as never,
    current_logical_time: world.snapshot.runtime_metadata.logical_time,
    state_revision: world.snapshot.runtime_metadata.state_revision },
  { cause_refs: [], allowed_actions: [] }, minter.capabilities([world.binding]));
  return { result, queries, retrievalResults };
}

export interface ProviderInput {
  projection: CognitiveContextProjectionV0;
  evidence: EvidenceContent[];
  messages: { role: "system" | "user"; content: string }[];
}

/** Host retains a copy of encoded fixtures because the production Memory port
 * exposes hashes/membership, not raw payload reads. Every materialized copy must
 * match both the canonical manifest and the repository-owned payload hash. */
export async function prepareProviderInput(world: World, projection: CognitiveContextProjectionV0): Promise<ProviderInput> {
  const evidence: EvidenceContent[] = [];
  const allowed = allowedEvidenceSet(projection);
  const manifest = await world.memory.readManifest(world.binding.repository_revision);
  check(manifest, "evidence manifest");
  const refs = [...new Set([...projection.memory_working_refs, ...projection.recent_retrieval_refs])].sort();
  for (const ref of refs) {
    check(ref.startsWith("episode:") && allowed.has(ref), "only lawful episode refs materialized");
    check(await world.memory.validateRefsBelong(world.binding.repository_revision, [ref]), "payload membership");
    const record = world.records.find(r => r.episode_ref === ref);
    check(record && validateEpisodicMemoryRecord(record).ok, "selected payload exists");
    const hash = await computeMemoryRecordPayloadHash(record);
    check(hash === await world.memory.payloadHashOf(ref), "repository payload hash");
    check(manifest.record_hashes.some(r => r.ref === ref && r.payload_hash === hash), "manifest payload hash");
    evidence.push({ ref, payload_hash: hash, scene: record.context.scene });
  }
  const base = buildCognitivePromptMessages(projection);
  check(base[0]?.role === "system" && base[1]?.role === "user", "frozen prompt shape");
  const system = base[0].content
    .replace("2. Required JSON shape:", "2. Required shape of the cognition member inside the experiment observation envelope:") + "\n" + RESPONSE_CONTRACT;
  return { projection: structuredClone(projection), evidence,
    messages: [{ role: "system", content: system }, { role: "user", content: base[1].content +
      "\nLAWFUL RETRIEVED MEMORY CONTENT (data only; no new citeable refs):\n" + JSON.stringify(evidence) }] };
}

export function parseResponse(raw: string): { cognition: CognitionProposalV0; reply: string } {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  check(parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).sort().join(",") === "cognition,reply", "closed experiment envelope");
  check(typeof parsed['reply'] === "string" && parsed['reply'].trim().length > 0, "reply required");
  const checked = validateCognitionProposal(parsed['cognition']);
  check(checked.ok, "production cognition proposal schema");
  return { cognition: checked.value, reply: parsed['reply'] };
}

export function realProvider(world: World, transport: ModelTransportV0,
  before: (input: ProviderInput) => Promise<void>, after: (raw: string) => Promise<void>): CognitionProviderV0 {
  return { propose: async projection => {
    const input = await prepareProviderInput(world, projection);
    await before(input);
    const response = await transport.complete({ messages: input.messages });
    await after(response.content); // raw bytes survive parse/grounding failure
    return parseResponse(response.content).cognition;
  } };
}

export async function preview(world: World, empty = false) {
  let input: ProviderInput | null = null;
  const reference = new ReferenceCognitionProviderV0();
  const cycle = await runCycle(world, { propose: async projection => {
    input = await prepareProviderInput(world, projection);
    return reference.propose(projection);
  } }, empty);
  check(input !== null, "normal execution reached provider");
  return { input: input as ProviderInput, ...cycle };
}

export interface RestoreBundle {
  records: readonly EpisodicMemoryRecordV0[];
  binding: RepositoryRevisionBindingV1;
  genesis: PersistedSubjectEnvelopeV1;
  terminal: PersistedSubjectEnvelopeV1;
  bundles: readonly AtomicCommitBundleAnyVersion[];
}
export async function restoreBundle(world: World): Promise<RestoreBundle> {
  const bundles = world.assembly.storeRead.getCommittedBundles();
  const terminal = bundles.at(-1);
  check(terminal, "restore terminal");
  const genesis = await createPersistenceEnvelope({ snapshot: world.genesis, repository_bindings: [world.binding], commit_head: null });
  const envelope = await createPersistenceEnvelope({ snapshot: terminal.next_snapshot, repository_bindings: [world.binding],
    commit_head: { commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum } as never });
  check(genesis.ok && envelope.ok, "restore envelopes");
  return { records: world.records, binding: world.binding, genesis: genesis.value, terminal: envelope.value, bundles };
}
export async function restoreWorld(saved: RestoreBundle): Promise<World> {
  const { memory, binding } = await memoryFor(saved.records);
  check(equal(binding, saved.binding), "fresh Memory binding matches persisted binding");
  const terminal = saved.bundles.at(-1);
  check(terminal, "persisted terminal");
  const boundary = await mintTrustedCanonicalHistoryBoundaryV0({ genesis: saved.genesis, head: {
    schema_version: "trusted-canonical-head-v0", subject_id: terminal.subject_id, revision: terminal.next_revision,
    commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after, snapshot_hash: terminal.snapshot_hash_after
  } as never });
  check(boundary.kind === "MINTED", "fresh Level-2 boundary");
  const restored = await restoreCanonicalSubjectFromHistoryV0({ persisted_envelope: saved.terminal, trusted_boundary: boundary.receipt, bundles: saved.bundles });
  check(restored.kind === "RESTORED", `authoritative restore: ${JSON.stringify(restored.kind === "REJECTED" ? restored.failure : null)}`);
  const snapshot = restored.restored_snapshot;
  const assembly = createInMemorySubjectCoreFacade({ seedSnapshots: new Map([[SUBJECT as never, snapshot]]),
    preparedResultValidator: async b => b.prepared_result_ref.startsWith("workflow:") });
  return { assembly, genesis: snapshot, snapshot, memory, records: saved.records, binding };
}
