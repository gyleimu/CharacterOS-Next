/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * BELIEF_CAUSAL_VALIDATION_V0 — world + history + scene harness.
 *
 * HISTORY IS REAL (§8): each condition starts from a normal explicit-v4 genesis
 * with ZERO canonical beliefs and forms the target proposition through the
 * PRODUCTION session wiring (`BeliefAdaptationWiringV0` → frozen semantic
 * runner → host proposition admission / frozen plasticity → BeliefTransitionExecutor
 * → SubjectCore canonical commit) over real Memory episodes of a real repository
 * revision. No seed belief, no fixture INSERT, no direct mutation, no manual
 * credence write.
 *
 * The semantic decision inside the history is a DETERMINISTIC RESEARCH-SIDE
 * provider (a pure function of the model-visible evidence projection): the
 * treatment must be reproducible, and the executor is frozen to the API model
 * only for the CURRENT SCENE. Everything else — evidence, admission, identity,
 * credence, commit, persistence — is production.
 *
 * CURRENT SCENE (§11/§12/§31): fresh process, authoritative restore of the
 * frozen durable state, real production turn executor, identical observation,
 * no retrieval exposure. Cell interventions are RESEARCH-ONLY model-facing
 * views: the durable state is never written.
 */
import { createHash } from "node:crypto";

import {
  computeMemoryRecordPayloadHash,
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "../../../packages/memory/dist/index.js";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  stateHash,
  validateSubjectState,
  type AtomicCommitBundleAnyVersion,
  type InMemoryFacadeAssembly,
  type RepositoryRevisionBindingV1,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";

import {
  CELL_DEFINITION,
  CURRENT_SCENE,
  EXPECTED_HIGH_PROGRESSION,
  EXPECTED_LOW_PROGRESSION,
  HIGH_EPISODES,
  LOW_EPISODES,
  SEMANTIC_PROVIDER_LAW,
  SUBJECT,
  TARGET_PROPOSITION_LABEL,
  type CellId
} from "./contract.ts";
import { buildCapturedTransport, type TransportObservations } from "./transport.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { createConversationIngressLedgerAuthorityV0 } = await import(`${runtimeDist}transitions/conversation/conversation-ingress-ledger.js`);
const { buildContextDelta } = await import(`${runtimeDist}ports/context-producer-port.js`);
const { observationInput, observationCauseRefOf, s0 } = await import(`${runtimeDist}transitions/observation/observation-fixtures.js`);
const { buildObservationProposal } = await import(`${runtimeDist}transitions/observation/observation-transition-executor.js`);
const { BeliefAdaptationWiringV0 } = await import(`${runtimeDist}session/belief-adaptation-wiring-v0.js`);
const { InMemoryBeliefAdaptationWorkflowStoreV0 } = await import(`${runtimeDist}transitions/belief/belief-adaptation-workflow-store.js`);
const { deriveBeliefPropositionKeyV0 } = await import(`${runtimeDist}transitions/belief/index.js`);
const { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } = await import(`${runtimeDist}authority/restore-chain-authority-v4.js`);
const { mintTrustedCanonicalHistoryBoundaryV4V0 } = await import(`${runtimeDist}authority/trusted-canonical-history-boundary.js`);
const { RuntimeCompositionRoot } = await import(`${runtimeDist}composition/runtime-composition-root.js`);
const { ConversationTextResponseExecutorV1 } = await import(`${runtimeDist}transitions/conversation/conversation-text-response-executor-v1.js`);
const { createMiclStageMinter } = await import(`${runtimeDist}micl/micl-capabilities.js`);
const { InMemoryMiclWorkflowStore } = await import(`${runtimeDist}micl/micl-workflow-store.js`);
const { createEpisodeContentReaderV0, RepositoryBackedMemoryRetrievalServiceV0 } = await import("../../../packages/memory/dist/index.js");
const { buildCognitiveContextProjection } = await import(`${runtimeDist}transitions/cognition-action/cognition-action-transition-executor.js`);
const { buildConversationSubjectDataV4 } = await import(`${runtimeDist}providers/behavior/conversation-cognition-provider-v6.js`);
const { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } = await import(`${runtimeDist}providers/behavior/conversation-cognition-provider-v8.js`);

export const MODEL_TRANSPORT_ROLES = Object.freeze({ cognition: "cognition", language: "language" } as const);

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`EXPERIMENT_ASSERT: ${message}`);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

/**
 * §41 normalization shared by the precheck and every live scene: the model-facing
 * comparison surface excludes the belief section and normalizes the
 * projection_hash token, which is a deterministic function of the
 * (belief-including) projection (proved by D==B byte-identity).
 */
export function normalizeNonBelief(text: string): string {
  return text.replace(new RegExp("\\[projection_hash\\] \\S+", "g"), "[projection_hash] <normalized>");
}

export function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

export type ConditionId = "LOW" | "HIGH";

export function episodesOf(condition: ConditionId): typeof LOW_EPISODES {
  return condition === "LOW" ? LOW_EPISODES : HIGH_EPISODES;
}

function episodeRecord(entry: { readonly ref: string; readonly occurrence_logical_time: number; readonly scene: string }): EpisodicMemoryRecordV0 {
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
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: SUBJECT },
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

async function buildRepository(condition: ConditionId): Promise<{
  repo: InMemoryMemoryRepository;
  binding: RepositoryRevisionBindingV1;
  records: readonly { readonly ref: string; readonly payload_hash: string }[];
}> {
  const repo = new InMemoryMemoryRepository();
  const records: { ref: string; payload_hash: string }[] = [];
  for (const entry of episodesOf(condition)) {
    const record = episodeRecord(entry);
    records.push({ ref: entry.ref, payload_hash: (await repo.storePayload(entry.ref as never, record)) as string });
  }
  records.sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: `intent-bcv-${condition.toLowerCase()}` as never,
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

/**
 * The deterministic research-side semantic provider (§7). Pure function of the
 * evidence projection: NEW candidate with the target label while the canonical
 * catalog is empty; otherwise EXISTING on the target proposition with a bearing
 * classified from the episode scene text. It supplies NO identity and NO number
 * for a NEW candidate.
 */
export class DeterministicSemanticProvider {
  calls = 0;
  readonly seen: unknown[] = [];

  async propose(input: {
    readonly catalog: { readonly propositions: readonly { readonly proposition_id: string; readonly proposition_label: string }[] };
    readonly evidence: { readonly evidence: readonly { readonly scene: string }[] };
    readonly semantic_context_fingerprint: string;
    readonly candidate_catalog_fingerprint: string;
  }): Promise<unknown> {
    this.calls += 1;
    this.seen.push(JSON.parse(JSON.stringify(input)) as unknown);
    const bindings = {
      schema_version: "belief-semantic-provider-output-v0",
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    if (SEMANTIC_PROVIDER_LAW.new_when_catalog_empty && input.catalog.propositions.length === 0) {
      return { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: TARGET_PROPOSITION_LABEL };
    }
    const target = input.catalog.propositions.find(
      (proposition) => proposition.proposition_label === TARGET_PROPOSITION_LABEL
    ) ?? input.catalog.propositions[0];
    check(target !== undefined, "target proposition present in the canonical catalog");
    const scenes = input.evidence.evidence.map((evidence) => evidence.scene).join(" ");
    const relation = new RegExp(SEMANTIC_PROVIDER_LAW.contradicts_pattern).test(scenes) ? "CONTRADICTS" : "SUPPORTS";
    return { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation };
  }
}

export interface HistoryStep {
  readonly episode_ref: string;
  readonly intended_bearing: string;
  readonly provider_decision: string;
  readonly terminal_kind: string;
  readonly reported_credence: number | null;
  readonly canonical_credence: number | null;
  readonly state_revision: number;
  readonly commit_ref: string | null;
}

export interface BelievIdentity {
  readonly canonical_label: string;
  readonly proposition_key: string;
  readonly proposition_id: string;
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
  readonly proposition: BelievIdentity;
  readonly steps: readonly HistoryStep[];
  readonly repository_digest: string;
}

/**
 * Forms ONE condition's history through the real production wiring, from a
 * normal empty genesis, and freezes the durable bundle set for later restore.
 */
export async function buildHistory(condition: ConditionId): Promise<{ bundle: HistoryBundle; repo: InMemoryMemoryRepository }> {
  const { repo, binding, records } = await buildRepository(condition);
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
  if (!genesisResult.ok) throw new Error(`genesis: ${genesisResult.code}: ${genesisResult.detail}`);
  const genesis = genesisResult.state as unknown as SubjectStateV4;
  check(genesis.beliefs.items.length === 0, "explicit-v4 genesis contains ZERO canonical beliefs");

  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT as never, genesis as never]]),
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

  const steps: HistoryStep[] = [];
  const progression: number[] = [];
  for (const entry of episodesOf(condition)) {
    const report = await wiring.runForEpisodeRefs({ subject_id: SUBJECT, episode_refs: [entry.ref] });
    check(report.status === "COMPLETED", `wiring status for ${entry.ref}: ${report.status} (${report.failure ?? ""})`);
    const current = report.current;
    check(current !== null, `wiring outcome for ${entry.ref}`);
    check(current.terminal_kind === "COMPLETE_COMMITTED", `terminal for ${entry.ref}: ${current.terminal_kind} (${current.detail ?? ""})`);
    const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
    check(snapshot.beliefs.items.length === 1, `exactly one canonical proposition after ${entry.ref}`);
    const item = snapshot.beliefs.items[0];
    check(item !== undefined, "canonical belief item present");
    progression.push(item.credence as number);
    const committedSoFar = assembly.storeRead.getCommittedBundles();
    steps.push({
      episode_ref: entry.ref,
      intended_bearing: "bearing" in entry ? (entry.bearing as string) : "SUPPORTS",
      provider_decision: current.provider_calls === 1 ? "ONE_PROVIDER_CALL" : "NO_PROVIDER_CALL",
      terminal_kind: current.terminal_kind,
      reported_credence: current.next_credence,
      canonical_credence: item.credence as number,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      commit_ref: (committedSoFar.at(-1)?.commit_ref as string | undefined) ?? null
    });
  }

  const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  const expected = condition === "LOW" ? EXPECTED_LOW_PROGRESSION : EXPECTED_HIGH_PROGRESSION;
  check(
    JSON.stringify(progression) === JSON.stringify(expected),
    `${condition} progression ${JSON.stringify(progression)} != expected ${JSON.stringify(expected)}`
  );
  const item = snapshot.beliefs.items[0];
  check(item !== undefined, "final canonical belief item present");
  const bundle = {
    condition,
    subject_id: SUBJECT,
    records,
    binding,
    genesis_envelope: JSON.parse(JSON.stringify(genesisResult.envelope)) as unknown,
    bundles: JSON.parse(JSON.stringify(assembly.storeRead.getCommittedBundles())) as readonly unknown[],
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
    repository_digest: hashJson(records)
  } satisfies HistoryBundle;
  return { bundle, repo };
}

export interface RestoredWorld {
  readonly repo: InMemoryMemoryRepository;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly binding: RepositoryRevisionBindingV1;
  readonly genesisEnvelope: unknown;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly snapshot: SubjectStateV4;
  readonly history_episode_refs: readonly string[];
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  readonly restore: {
    readonly authority: string;
    readonly head_revision: number;
    readonly head_commit_ref: string;
    readonly state_hash: string;
    readonly snapshot_hash: string;
    readonly belief_item: unknown;
  };
}

/** Fresh-process authoritative restore (§32): durable image only, no live objects. */
export async function restoreHistory(bundle: HistoryBundle): Promise<RestoredWorld> {
  const { repo, binding } = await buildRepository(bundle.condition);
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
    JSON.stringify(restoredSnapshot.beliefs) === JSON.stringify(headSnapshot.beliefs),
    "restored beliefs equal the persisted beliefs"
  );
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
    binding,
    genesisEnvelope: bundle.genesis_envelope,
    bundles,
    snapshot: restoredSnapshot,
    history_episode_refs: bundle.records.map((record) => record.ref),
    ingressLedger: createConversationIngressLedgerAuthorityV0(),
    restore: {
      authority: "restoreSubjectStateV4AuthoritativelyV0",
      head_revision: headBundle.next_revision as number,
      head_commit_ref: headBundle.commit_ref as string,
      state_hash: headBundle.state_hash_after as string,
      snapshot_hash: headBundle.snapshot_hash_after as string,
      belief_item: JSON.parse(JSON.stringify(restoredSnapshot.beliefs.items)) as unknown
    }
  };
}

export interface BeliefViewIntervention {
  readonly kind: "NONE" | "ABLATE_TARGET" | "EQUALIZE_TARGET_TO_HIGH";
  readonly target_proposition_id: string;
  readonly high_credence: number | null;
}

/** Research-only model-facing belief view (§14/§15): never a durable write. */
export function applyBeliefViewIntervention(
  snapshot: SubjectStateV4,
  intervention: BeliefViewIntervention
): SubjectStateV4 {
  if (intervention.kind === "NONE") return snapshot;
  const items = snapshot.beliefs.items;
  if (intervention.kind === "ABLATE_TARGET") {
    return {
      ...snapshot,
      beliefs: {
        ...snapshot.beliefs,
        items: items.filter((item) => (item.proposition_id as string) !== intervention.target_proposition_id)
      }
    } as unknown as SubjectStateV4;
  }
  check(intervention.high_credence !== null, "equalization requires the HIGH credence");
  return {
    ...snapshot,
    beliefs: {
      ...snapshot.beliefs,
      items: items.map((item) =>
        (item.proposition_id as string) === intervention.target_proposition_id
          ? { ...item, credence: intervention.high_credence as never }
          : item
      )
    }
  } as unknown as SubjectStateV4;
}

export function interventionFor(cell: CellId, highBundle: { readonly proposition: BelievIdentity; readonly final_credence: number }): BeliefViewIntervention {
  const definition = CELL_DEFINITION[cell];
  return {
    kind: definition.intervention,
    target_proposition_id: highBundle.proposition.proposition_id,
    high_credence: definition.intervention === "EQUALIZE_TARGET_TO_HIGH" ? highBundle.final_credence : null
  };
}

/** Wraps a subject-core port with a read-only model-facing belief view. */
export function decorateSubjectCoreWithBeliefView<T extends { readCurrentSnapshot(id: never): Promise<unknown> }>(
  core: T,
  intervene: (snapshot: never) => SubjectStateV4
): T {
  const original = core.readCurrentSnapshot.bind(core);
  return {
    ...core,
    readCurrentSnapshot: async (subjectId: never) => {
      const snapshot = (await original(subjectId)) as never;
      return snapshot === null || snapshot === undefined ? snapshot : intervene(snapshot);
    }
  } as unknown as T;
}

/** The exact model-facing cognition request the production providers render. */
export async function renderCognitionRequest(snapshot: SubjectStateV4): Promise<{ system: string; user: string; projection_hash: string }> {
  const projection = await buildCognitiveContextProjection(snapshot as never);
  return {
    system: CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
    user: buildConversationSubjectDataV4(projection as never),
    projection_hash: (projection as { projection_hash: string }).projection_hash
  };
}

/** §41: split one rendered cognition user message into its auditable parts. */
export function splitBeliefSection(user: string): {
  readonly before: string;
  readonly belief: string;
  readonly after: string;
} {
  const start = user.indexOf("[SUBJECTIVE BELIEF STANCES");
  check(start >= 0, "belief section present in the rendered request");
  const end = user.indexOf("\n[relationships]", start);
  check(end > start, "belief section end marker present");
  return { before: user.slice(0, start), belief: user.slice(start, end), after: user.slice(end) };
}

export interface SceneObservation {
  readonly schema_version: "belief-causal-scene-v0";
  readonly experiment_id: string;
  readonly phase: string;
  readonly cell: CellId;
  readonly replicate: number;
  readonly condition: string;
  readonly intervention: string;
  readonly result_kind: "OUTPUT_READY" | "FAILED";
  readonly failure_stage: string | null;
  readonly failure_detail: string | null;
  readonly directive_kind: string | null;
  readonly response_semantics_kind: string | null;
  readonly cognition: {
    readonly current_intent: string | null;
    readonly confidence: number | null;
    readonly uncertainty: number | null;
    readonly reasoning_summary: string | null;
    readonly claim_count: number;
  } | null;
  readonly delivered_text: string | null;
  readonly classification: {
    readonly proceeds_with_passage: boolean;
    readonly proposes_alternative_route: boolean;
    readonly seeks_verification: boolean;
    readonly asserts_current_truth: boolean;
    readonly objective_truth_conflation: boolean;
    readonly cross_domain_inference: boolean;
  };
  readonly belief_view: {
    readonly target_visible: boolean;
    readonly target_credence: number | null;
    readonly target_label: string | null;
    readonly belief_section: string;
    readonly belief_item_count: number;
  };
  readonly prompts: {
    readonly user_text: string;
    readonly language_user_text: string;
    readonly system_hash: string;
    readonly user_hash: string;
    readonly belief_section_hash: string;
    readonly non_belief_user_hash: string;
    readonly projection_hash: string;
  };
  readonly canonical: {
    readonly restore_authority: string;
    readonly head_revision: number;
    readonly state_revision_before: number;
    readonly state_revision_after: number;
    readonly belief_item_before: unknown;
    readonly belief_item_after: unknown;
    readonly belief_unchanged: boolean;
    readonly production_write_from_intervention: false;
  };
  readonly isolation: {
    readonly retrieval_queries: number;
    readonly recent_retrieval_refs: readonly string[];
    readonly raw_history_refs_visible: readonly string[];
    readonly observation_ref: string;
  };
  readonly provider: {
    readonly model: string;
    readonly requests: number;
    readonly usage: TransportObservations["usage"];
    readonly attempts: TransportObservations["attempts"];
  };
}

function classify(input: { readonly text: string; readonly intent: string | null; readonly patterns: typeof import("./contract.ts").OUTCOME_CLASSIFIER }): SceneObservation["classification"] {
  const haystack = `${input.text}\n${input.intent ?? ""}`.toLowerCase();
  const matches = (pattern: string): boolean => new RegExp(pattern, "i").test(haystack);
  return {
    proceeds_with_passage: matches(input.patterns.passage_route_pattern) && !matches(input.patterns.verification_pattern),
    proposes_alternative_route: matches(input.patterns.alternative_route_pattern),
    seeks_verification: matches(input.patterns.verification_pattern),
    asserts_current_truth: /the service passage is (open|usable|closed|unusable)/i.test(haystack),
    objective_truth_conflation: matches(input.patterns.truth_conflation_pattern),
    cross_domain_inference: matches(input.patterns.cross_domain_pattern)
  };
}

/** Admits the frozen current observation (identical bytes across cells). */
export async function admitCurrentObservation(world: RestoredWorld): Promise<{ observation_ref: string; observation_transition_id: string }> {
  const snapshot = (await world.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  const outcome = await world.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: CURRENT_SCENE.conversation_id,
    actor_ref: "entity:caretaker",
    text: CURRENT_SCENE.text,
    logical_time: snapshot.runtime_metadata.logical_time as number,
    source_event_id: CURRENT_SCENE.source_event_id,
    in_reply_to_delivery_id: null,
    host_adapter: "experiment-adapter"
  } as never);
  check(
    outcome.kind === "RECORDED" || outcome.kind === "REPLAY",
    `ingress recorded (${String(outcome.kind)}: ${(outcome as { detail?: string }).detail ?? ""})`
  );
  const eventRef = outcome.record.event_ref as string;
  const observation = observationInput({
    observation_id: `observation:o-${CURRENT_SCENE.source_event_id}`,
    source_refs: [eventRef, "source:s-bcv"],
    entity_refs: ["entity:caretaker" as never, "subject:s0" as never],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time as never
  });
  const contextDelta = await buildContextDelta(observation as never, snapshot as never);
  // PRODUCTION observability law (identical to the interactive session): the
  // user's words become the observable CONTEXT scene/task, so cognition responds
  // to a situation rather than treating its own input as the thing to realize.
  const baseOp = contextDelta.operations[0] as { path: string; value: Record<string, unknown> };
  const observableContextDelta = {
    ...contextDelta,
    operations: [
      {
        ...baseOp,
        value: {
          ...baseOp.value,
          scene: `The user says: "${CURRENT_SCENE.text}"`,
          task: "Respond to the user's latest message."
        }
      }
    ]
  } as typeof contextDelta;
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [observableContextDelta]
  } as never);
  const reserved = await world.assembly.facade.reserveAndRoute(proposal as never);
  check(reserved.kind === "CONTINUE", `observation reservation (${String(reserved.kind)})`);
  const committed = await world.assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: world.assembly.producerAuthorizationIssuer.issue([{ producer: "context", domain: "context" }] as never),
    preparedBinding: {
      prepared_result_ref: `workflow:w-bcv-obs` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal as never)
    },
    repository_bindings: [world.binding] as never
  } as never);
  check(committed.kind === "COMMITTED", `observation commit (${JSON.stringify(committed).slice(0, 200)})`);
  return {
    observation_ref: observationCauseRefOf(committed.bundle as never),
    observation_transition_id: committed.bundle.transition_id as string
  };
}

export interface RunSceneInput {
  readonly world: RestoredWorld;
  readonly phase: string;
  readonly cell: CellId;
  readonly replicate: number;
  readonly intervention: BeliefViewIntervention;
  readonly env: Record<string, string | undefined>;
  readonly highCredenceLabel: string;
}

/** ONE scene: fresh process (caller), authoritative restore, real turn, no retries of science. */
export async function runScene(input: RunSceneInput): Promise<SceneObservation> {
  const { world } = input;
  const before = (await world.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  const beliefItemBefore = JSON.parse(JSON.stringify(before.beliefs.items)) as unknown;

  const cognitionTransport = buildCapturedTransport({ role: "cognition", env: input.env });
  const languageTransport = buildCapturedTransport({ role: "language", env: input.env });
  if (!cognitionTransport.ok || !languageTransport.ok) {
    throw new Error(`transport configuration: ${JSON.stringify([cognitionTransport, languageTransport].map((result) => (result.ok ? "ok" : result.missing)))}`);
  }

  const observation = await admitCurrentObservation(world);

  let retrievalQueries = 0;
  const productionRetrieval = new RepositoryBackedMemoryRetrievalServiceV0(world.repo as never);
  const root = new RuntimeCompositionRoot({
    subjectCore: world.assembly.facade as never,
    producerAuthorizationIssuer: world.assembly.producerAuthorizationIssuer as never,
    memoryRepository: world.repo as never,
    // §36 MEMORY ISOLATION: research-side retrieval exposure is DISABLED for
    // every cell (an empty selection, never a per-condition corpus).
    retrieval: {
      retrieve: async (query: unknown) => {
        retrievalQueries += 1;
        const result = (await productionRetrieval.retrieve(query as never)) as {
          readonly selected_memory_refs: readonly string[];
        };
        void result;
        return { ...(result as object), selected_memory_refs: [], evidence: [] };
      }
    } as never,
    cognitionProvider: { propose: async () => { throw new Error("experiment: ordinary cognition provider must not be called"); } } as never,
    conversationCognitionTransport: cognitionTransport.built.transport as never,
    languageTransport: languageTransport.built.transport as never,
    episodeContentReader: createEpisodeContentReaderV0(world.repo as never) as never,
    experiencePayloadRepository: world.repo as never
  } as never);

  const requestId = "req-bcv-scene";
  const minter = createMiclStageMinter(world.assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-bcv-scene` as never,
    micl_request_fingerprint: `sha256:${createHash("sha256").update(requestId).digest("hex")}` as never,
    stage_key: "OBSERVATION"
  } as never);
  const decoratedCore = decorateSubjectCoreWithBeliefView(
    minter.core() as never,
    (snapshot: never) => applyBeliefViewIntervention(snapshot as unknown as SubjectStateV4, input.intervention)
  );
  const executor = new ConversationTextResponseExecutorV1({
    ...root.dependencies(),
    subjectCore: decoratedCore
  } as never);

  const current = (await world.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  let result: { kind: string; stage?: string; detail?: string; behavior?: { text?: string }; trace?: Record<string, unknown> };
  try {
    result = (await executor.execute(
      {
        subject_id: SUBJECT,
        current_logical_time: current.runtime_metadata.logical_time,
        state_revision: current.runtime_metadata.state_revision
      } as never,
      { response_request_id: requestId as never, cause_refs: [] } as never,
      minter.capabilities([world.binding] as never) as never
    )) as never;
  } catch (error) {
    result = { kind: "FAILED", stage: "THROWN", detail: error instanceof Error ? error.message : String(error) };
  }

  const after = (await world.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as unknown as SubjectStateV4;
  const beliefItemAfter = JSON.parse(JSON.stringify(after.beliefs.items)) as unknown;
  const cognitionRequest = cognitionTransport.built.observations.requests.find((entry) => entry.role === "cognition");
  const cognitionResponse = cognitionTransport.built.observations.responses.find((entry) => entry.role === "cognition");
  const user = cognitionRequest?.user ?? "";
  const sections = user.includes("[SUBJECTIVE BELIEF STANCES") ? splitBeliefSection(user) : null;
  const targetVisible = sections === null ? false : sections.belief.includes(input.highCredenceLabel);
  const targetCredence = sections === null ? null : extractTargetCredence(sections.belief, input.highCredenceLabel);
  const parsed = cognitionResponse === undefined ? null : safeParseJson(cognitionResponse.content);
  const intent = parsed === null ? null : readPath<string>(parsed, ["cognition", "current_intent"]);
  const classification = classify({
    text: result.behavior?.text ?? "",
    intent: typeof intent === "string" ? intent : null,
    patterns: (await import("./contract.ts")).OUTCOME_CLASSIFIER
  });
  const visibleHistoryRefs = world.history_episode_refs.filter((ref) => user.includes(ref));

  return {
    schema_version: "belief-causal-scene-v0",
    experiment_id: "BELIEF_CAUSAL_VALIDATION_V0",
    phase: input.phase,
    cell: input.cell,
    replicate: input.replicate,
    condition: CELL_DEFINITION[input.cell].durable,
    intervention: input.intervention.kind,
    result_kind: result.kind === "OUTPUT_READY" ? "OUTPUT_READY" : "FAILED",
    failure_stage: result.kind === "OUTPUT_READY" ? null : (result.stage ?? null),
    failure_detail: result.kind === "OUTPUT_READY" ? null : (result.detail ?? null),
    directive_kind: (result.trace?.["communication_directive_kind"] as string | undefined) ?? null,
    response_semantics_kind: parsed === null ? null : (readPath<string>(parsed, ["response_semantics", "kind"]) ?? null),
    cognition:
      parsed === null
        ? null
        : {
            current_intent: typeof intent === "string" ? intent : null,
            confidence: readPath<number>(parsed, ["cognition", "confidence"]) ?? null,
            uncertainty: readPath<number>(parsed, ["cognition", "uncertainty"]) ?? null,
            reasoning_summary: readPath<string>(parsed, ["cognition", "reasoning_summary"]) ?? null,
            claim_count: readClaims(parsed).length
          },
    delivered_text: result.behavior?.text ?? null,
    classification,
    belief_view: {
      target_visible: targetVisible,
      target_credence: targetCredence,
      target_label: targetVisible ? input.highCredenceLabel : null,
      belief_section: sections?.belief ?? "",
      belief_item_count: sections === null ? 0 : countBeliefItems(sections.belief)
    },
    prompts: {
      user_text: user,
      language_user_text: languageTransport.built.observations.requests.find((entry) => entry.role === "language")?.user ?? "",
      system_hash: hashText(cognitionRequest?.system ?? ""),
      user_hash: hashText(user),
      belief_section_hash: hashText(sections?.belief ?? ""),
      non_belief_user_hash: sections === null ? hashText(user) : hashText(normalizeNonBelief(`${sections.before}${sections.after}`)),
      projection_hash: extractProjectionHash(user)
    },
    canonical: {
      restore_authority: world.restore.authority,
      head_revision: world.restore.head_revision,
      state_revision_before: before.runtime_metadata.state_revision as number,
      state_revision_after: after.runtime_metadata.state_revision as number,
      belief_item_before: beliefItemBefore,
      belief_item_after: beliefItemAfter,
      belief_unchanged: JSON.stringify(beliefItemBefore) === JSON.stringify(beliefItemAfter),
      production_write_from_intervention: false
    },
    isolation: {
      retrieval_queries: retrievalQueries,
      recent_retrieval_refs: [],
      raw_history_refs_visible: visibleHistoryRefs,
      observation_ref: observation.observation_ref
    },
    provider: {
      model: (await import("./contract.ts")).MODEL.id,
      requests: cognitionTransport.built.observations.usage.requests + languageTransport.built.observations.usage.requests,
      usage: mergeUsage(cognitionTransport.built.observations.usage, languageTransport.built.observations.usage),
      attempts: [...cognitionTransport.built.observations.attempts, ...languageTransport.built.observations.attempts]
    }
  };
}

function mergeUsage(left: TransportObservations["usage"], right: TransportObservations["usage"]): TransportObservations["usage"] {
  return {
    requests: left.requests + right.requests,
    prompt_tokens: left.prompt_tokens + right.prompt_tokens,
    completion_tokens: left.completion_tokens + right.completion_tokens,
    total_tokens: left.total_tokens + right.total_tokens,
    cached_tokens: left.cached_tokens + right.cached_tokens,
    reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens
  };
}

function extractTargetCredence(beliefSection: string, label: string): number | null {
  const match = new RegExp(`\\{[^}]*${escapeRegExp(label)}[^}]*\\}`).exec(beliefSection);
  if (match === null) return null;
  const parsed = safeParseJson(match[0].trim().replace(/^-\s*/, ""));
  return parsed === null ? null : (readPath<number>(parsed, ["credence"]) ?? null);
}

function countBeliefItems(beliefSection: string): number {
  const match = /showing (\d+) of (\d+)/.exec(beliefSection);
  return match === null ? 0 : Number(match[1]);
}

function extractProjectionHash(user: string): string {
  return /\[projection_hash\] (\S+)/.exec(user)?.[1] ?? "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readPath<T>(value: Record<string, unknown>, path: readonly string[]): T | undefined {
  let cursor: unknown = value;
  for (const key of path) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor as T | undefined;
}

function readClaims(parsed: Record<string, unknown>): readonly unknown[] {
  const assessment = parsed["factual_assessment"];
  if (typeof assessment !== "object" || assessment === null) return [];
  const claims = (assessment as Record<string, unknown>)["claims"];
  return Array.isArray(claims) ? claims : [];
}

export { stateHash, computeMemoryRecordPayloadHash };
