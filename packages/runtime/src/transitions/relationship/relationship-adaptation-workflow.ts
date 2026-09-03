/**
 * Relationship Adaptation Workflow V0 — explicit host-requested orchestration of
 * the frozen semantic channel, internal MemoryInfluence projection, frozen
 * Plasticity producer, and frozen RelationshipTransitionExecutor into at most
 * ONE canonical Relationship commit per workflow identity.
 *
 * IDENTITY (frozen): stable host workflow_id + deterministic JCS request
 * fingerprint over the request anchors, canonical cause_refs, evidence
 * bindings (episode_ref + frozen Memory payload hash), and catalog/policy
 * identities. Provider output NEVER enters the request fingerprint. A
 * different fingerprint under the same workflow_id is a FATAL identity
 * conflict — never an automatic new attempt.
 *
 * NONDETERMINISM BOUNDARY: exactly ONE external semantic provider call per
 * workflow (atomically claimed create-once). Its closed output is persisted
 * create-once as a NON-AUTHORITATIVE candidate checkpoint. The WeakSet
 * semantic capability is NEVER serialized: every continuation re-mints a
 * fresh process-local capability by replaying the persisted candidate through
 * the frozen semantic runner against fresh CURRENT SubjectState — zero
 * external provider recall. A claimed-but-uncandidated workflow after restart
 * is RESTART_REQUIRED (the external outcome is unknowable; temperature 0 is
 * NOT a recall license).
 *
 * STALENESS: only canonical revision may advance under the same workflow
 * (ONE deterministic plasticity rebuild, ordinal 0 → 1, same semantic
 * decision, zero provider recalls). A second stale proposal is
 * RESTART_REQUIRED. A repository revision change is always
 * RESTART_REQUIRED / NEW_WORKFLOW_ID (a new memory universe).
 *
 * AUTHORITY: canonical mutation happens ONLY through the frozen
 * RelationshipTransitionExecutor (which alone commits via SubjectCore). The
 * workflow writes no canonical state, no canonical trace, no Memory, never
 * advances logical time, never auto-registers counterparts, never touches
 * Belief/Personality. Workflow records are INFRASTRUCTURE state only.
 * Projections are generated WORKFLOW_INTERNALLY from the exact request
 * records via the frozen MemoryInfluence authority at CURRENT logical time —
 * callers cannot supply projections, magnitude, direction, or next_value.
 */

import type {
  AtomicCommitBundleAnyVersion,
  HashV1,
  SubjectStateV0,
  TransitionIdV0
} from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  validateIdentifier,
  validateRefElement,
  type CanonicalRefV0,
  type IdentifierV0,
  type LogicalTimeV0,
  type StateRevisionV0
} from "@characteros-next/subject-core";
import type { EpisodeRef, MemoryPreparationAuthority } from "@characteros-next/memory";
import {
  computeMemoryRecordPayloadHash,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import type {
  MemoryInfluencePolicyV0,
  MemoryInfluenceProjectionV0
} from "@characteros-next/memory-influence";
import { projectMemoryInfluences, validateMemoryInfluencePolicy } from "@characteros-next/memory-influence";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";

import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  validateRelationshipEvidenceChannelPolicy,
  type RelationshipEvidenceChannelPolicyV0
} from "./relationship-evidence-channel-policy.js";
import {
  deriveRelationshipSemanticCatalogFingerprint,
  runRelationshipSemanticChannelV0,
  validateRelationshipSemanticChannelCatalog,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelProviderV0
} from "./relationship-semantic-channel.js";
import {
  produceRelationshipPlasticityV0,
  type RelationshipPlasticityProducerResultV0
} from "./relationship-plasticity-producer.js";
import {
  deriveRelationshipTransitionId,
  validateRelationshipUpdateProposal,
  type RelationshipUpdateProposalV0
} from "./relationship-update-proposal.js";
import { RelationshipTransitionExecutor } from "./relationship-transition-executor.js";

export const RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION =
  "relationship-adaptation-request-v0" as const;
export const RELATIONSHIP_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION =
  "relationship-adaptation-workflow-record-v0" as const;

export const RELATIONSHIP_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/adaptation-request-fingerprint/v1" as const;
export const RELATIONSHIP_ADAPTATION_PROVIDER_CANDIDATE_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/adaptation-provider-candidate/v1" as const;
export const RELATIONSHIP_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/adaptation-proposal-checkpoint/v1" as const;

/** Exact workflow stages; the effective execution coordinate is (rebuild_ordinal, stage). */
export type RelationshipAdaptationStageV0 =
  | "A0_VALIDATE_INPUT"
  | "A1_SEMANTIC_PREPARE"
  | "A2_SEMANTIC_PROVIDER_CALL"
  | "A3_SEMANTIC_ACCEPTED"
  | "A4_INFLUENCE_PREPARE"
  | "A5_PLASTICITY_PRODUCE"
  | "A6_PROPOSAL_READY"
  | "A7_CANONICAL_COMMIT"
  | "A8_COMPLETE";

export type RelationshipAdaptationPlasticityRebuildOrdinalV0 = 0 | 1;

/** Closed provider-output candidate: the ONLY provider bytes ever persisted. */
export type RelationshipAdaptationProviderCandidateV0 =
  | {
      readonly schema_version: "relationship-semantic-provider-output-v0";
      readonly kind: "CHANNEL";
      readonly channel_id: IdentifierV0;
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
    }
  | {
      readonly schema_version: "relationship-semantic-provider-output-v0";
      readonly kind: "ABSTAIN";
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
    };

export interface RelationshipAdaptationProposalCheckpointV0 {
  readonly rebuild_ordinal: RelationshipAdaptationPlasticityRebuildOrdinalV0;
  readonly proposal: RelationshipUpdateProposalV0;
  readonly transition_id: TransitionIdV0;
  readonly proposal_checkpoint_fingerprint: HashV1;
}

export type RelationshipAdaptationTerminalV0 =
  | {
      readonly kind: "COMPLETE_COMMITTED";
      readonly transition_id: TransitionIdV0;
      readonly commit_ref: CanonicalRefV0;
      readonly final_state_revision: StateRevisionV0;
      readonly snapshot_hash: HashV1;
      readonly canonical_commits: 1;
    }
  | {
      readonly kind: "COMPLETE_ALREADY_COMMITTED";
      readonly transition_id: TransitionIdV0;
      readonly commit_ref: CanonicalRefV0;
      readonly final_state_revision: StateRevisionV0;
      readonly snapshot_hash: HashV1;
      readonly canonical_commits: 0;
    }
  | { readonly kind: "COMPLETE_ABSTAIN"; readonly canonical_commits: 0 }
  | {
      readonly kind: "COMPLETE_NO_PROPOSAL";
      readonly reason: "EVIDENCE_NOT_ELIGIBLE" | "ZERO_EFFECTIVE_INFLUENCE" | "SATURATED";
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "REJECTED_PRE_SEMANTIC";
      readonly code: string;
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "REJECTED_SEMANTIC";
      readonly code: string;
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "REJECTED_PLASTICITY";
      readonly code: string;
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "REJECTED_EXECUTOR";
      readonly code: string;
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "RESTART_REQUIRED";
      readonly scope: "NEW_WORKFLOW_ID" | "SAME_WORKFLOW";
      readonly code:
        | "PROVIDER_OUTCOME_UNKNOWN"
        | "REPOSITORY_UNIVERSE_CHANGED"
        | "STALE_AFTER_REBUILD"
        | "COUNTERPART_MISSING"
        | "TARGET_DIMENSION_UNREGISTERED"
        | "COMMIT_OUTCOME_UNKNOWN"
        | "PROJECTION_FAILED";
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "FATAL_REUSE_CONFLICT";
      readonly source:
        | "WORKFLOW_IDENTITY"
        | "PROVIDER_CANDIDATE"
        | "PROPOSAL_CHECKPOINT"
        | "EXECUTOR_TRANSITION";
      readonly detail: string;
      readonly canonical_commits: 0;
    };

export interface RelationshipAdaptationWorkflowRecordV0 {
  readonly schema_version: typeof RELATIONSHIP_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION;
  readonly workflow_id: IdentifierV0;
  readonly request_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly initial_state_revision: StateRevisionV0;
  readonly initial_logical_time: LogicalTimeV0;
  readonly repository_revision: string;
  readonly evidence_bindings: readonly {
    readonly episode_ref: EpisodeRef;
    readonly payload_hash: HashV1;
  }[];
  readonly channel_policy_id: IdentifierV0;
  readonly channel_policy_fingerprint: HashV1;
  readonly semantic_catalog_id: IdentifierV0;
  readonly semantic_catalog_fingerprint: HashV1;
  readonly stage: RelationshipAdaptationStageV0;
  /** Create-once external claim: 0 → 1 exactly once per workflow identity. */
  readonly external_provider_call_count: 0 | 1;
  readonly provider_output_candidate: RelationshipAdaptationProviderCandidateV0 | null;
  readonly provider_output_candidate_fingerprint: HashV1 | null;
  readonly plasticity_rebuild_ordinal: RelationshipAdaptationPlasticityRebuildOrdinalV0;
  readonly proposal_attempts: readonly RelationshipAdaptationProposalCheckpointV0[];
  readonly terminal_result: RelationshipAdaptationTerminalV0 | null;
}

export interface RelationshipAdaptationRequestV0 {
  readonly schema_version: typeof RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION;
  readonly workflow_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly expected_initial_state_revision: StateRevisionV0;
  readonly expected_initial_logical_time: LogicalTimeV0;
  readonly expected_repository_revision: string;
  readonly counterpart_ref: CanonicalRefV0;
  /** Request provenance / control identity only (canonical, unique, sorted). */
  readonly cause_refs: readonly CanonicalRefV0[];
  readonly selected_records: readonly unknown[];
  readonly semantic_catalog: unknown;
  readonly channel_policy: unknown;
  readonly memory_influence_policy: unknown;
}

const REQUEST_KEYS: readonly string[] = [
  "schema_version",
  "workflow_id",
  "subject_id",
  "expected_initial_state_revision",
  "expected_initial_logical_time",
  "expected_repository_revision",
  "counterpart_ref",
  "cause_refs",
  "selected_records",
  "semantic_catalog",
  "channel_policy",
  "memory_influence_policy"
];

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function isSafeNonnegativeInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/**
 * Narrow, relationship-specific durable workflow store. createIfAbsent and
 * every conditional update MUST be linearizable: concurrent duplicate
 * workflow invocations must not both claim the external provider call, must
 * not overwrite the provider candidate or a proposal attempt ordinal, and
 * must not write conflicting terminal outcomes. Production modules define the
 * interface only; hosts provide the durable implementation.
 */
export interface RelationshipAdaptationWorkflowStoreV0 {
  load(workflow_id: IdentifierV0): Promise<RelationshipAdaptationWorkflowRecordV0 | null>;
  /** Linearizable create-if-absent keyed by workflow_id. */
  createIfAbsent(record: RelationshipAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING">;
  /**
   * Linearizable create-once external provider call claim: count 0 → 1 and
   * stage A1 → A2. Exactly one concurrent invocation receives "CLAIMED".
   */
  claimProviderCall(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1
  ): Promise<"CLAIMED" | "ALREADY_CLAIMED">;
  /**
   * Create-once provider candidate. A different candidate under the same
   * workflow identity is rejected (CANDIDATE_CONFLICT) — never overwritten.
   */
  saveProviderCandidate(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    candidate: RelationshipAdaptationProviderCandidateV0,
    candidate_fingerprint: HashV1
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT">;
  /**
   * Append-only proposal attempt keyed by rebuild_ordinal. An existing
   * ordinal with a different checkpoint is rejected (ORDINAL_CONFLICT).
   */
  appendProposalAttempt(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    checkpoint: RelationshipAdaptationProposalCheckpointV0
  ): Promise<"APPENDED" | "ORDINAL_CONFLICT">;
  /** Guarded stage transition (compare-and-set). */
  compareAndSetStage(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    from: RelationshipAdaptationStageV0,
    to: RelationshipAdaptationStageV0
  ): Promise<"SET" | "STAGE_CONFLICT">;
  /** Advance the plasticity rebuild ordinal 0 → 1 exactly once. */
  setRebuildOrdinal(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1
  ): Promise<"SET" | "ORDINAL_CONFLICT">;
  /** Write-once terminal result (write-after-terminal is a conflict). */
  saveTerminalResult(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    terminal: RelationshipAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT">;
}

export interface RelationshipAdaptationWorkflowDepsV0 {
  readonly subjectCore: SubjectCorePort;
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  readonly semanticProvider: RelationshipSemanticChannelProviderV0;
  readonly workflowStore: RelationshipAdaptationWorkflowStoreV0;
  /** Committed-transition authority consulted before every executor call. */
  readonly readCommittedBundle: (
    transition_id: TransitionIdV0
  ) => Promise<AtomicCommitBundleAnyVersion | null>;
}

interface ValidatedRequest {
  readonly request: RelationshipAdaptationRequestV0;
  readonly records: readonly EpisodicMemoryRecordV0[];
  readonly evidence_bindings: readonly {
    readonly episode_ref: EpisodeRef;
    readonly payload_hash: HashV1;
  }[];
  readonly catalog: RelationshipSemanticChannelCatalogV0;
  readonly catalog_fingerprint: HashV1;
  readonly policy: RelationshipEvidenceChannelPolicyV0;
  readonly policy_fingerprint: HashV1;
  readonly influence_policy: MemoryInfluencePolicyV0;
  readonly request_fingerprint: HashV1;
}

/**
 * Closed, fail-closed request admission + canonical identity derivation:
 * structural record validation, canonical evidence ordering, catalog/policy
 * validation and binding, and the frozen Memory payload hash per record.
 */
async function validateRequest(
  input: unknown
): Promise<
  | { readonly ok: true; readonly validated: ValidatedRequest }
  | { readonly ok: false; readonly code: string; readonly detail: string }
> {
  if (!isRecord(input)) {
    return { ok: false, code: "INVALID_REQUEST", detail: "request: expected object" };
  }
  for (const key of Object.keys(input)) {
    if (!REQUEST_KEYS.includes(key)) {
      return { ok: false, code: "INVALID_REQUEST", detail: `request.${key}: unknown key` };
    }
  }
  if (input["schema_version"] !== RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION) {
    return { ok: false, code: "INVALID_REQUEST", detail: "request.schema_version" };
  }
  for (const field of ["workflow_id", "subject_id"] as const) {
    if (typeof input[field] !== "string") {
      return { ok: false, code: "INVALID_REQUEST", detail: `request.${field}: expected identifier` };
    }
    const checked = validateIdentifier(input[field] as string, `request.${field}`);
    if (!checked.ok) return { ok: false, code: "INVALID_REQUEST", detail: checked.error.detail };
  }
  for (const field of [
    "expected_initial_state_revision",
    "expected_initial_logical_time"
  ] as const) {
    if (!isSafeNonnegativeInteger(input[field])) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.${field}: nonnegative safe integer required`
      };
    }
  }
  if (typeof input["expected_repository_revision"] !== "string") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "request.expected_repository_revision: expected string"
    };
  }
  const counterpartChecked = validateRefElement(input["counterpart_ref"], "request.counterpart_ref", [
    "entity",
    "subject"
  ]);
  if (!counterpartChecked.ok) {
    return { ok: false, code: "INVALID_REQUEST", detail: counterpartChecked.error.detail };
  }

  const causeRefsRaw = input["cause_refs"];
  if (!Array.isArray(causeRefsRaw)) {
    return { ok: false, code: "INVALID_REQUEST", detail: "request.cause_refs: array required" };
  }
  const causeRefs: CanonicalRefV0[] = [];
  let previousCause: string | undefined;
  for (let i = 0; i < causeRefsRaw.length; i++) {
    const checked = validateRefElement(causeRefsRaw[i], `request.cause_refs[${i}]`);
    if (!checked.ok) return { ok: false, code: "INVALID_REQUEST", detail: checked.error.detail };
    if (previousCause !== undefined && rawAsciiCompare(checked.value, previousCause) <= 0) {
      const reason =
        checked.value === previousCause ? "duplicate cause_ref" : "cause_refs not raw-ASCII-sorted";
      return { ok: false, code: "INVALID_REQUEST", detail: `request.cause_refs[${i}]: ${reason}` };
    }
    previousCause = checked.value;
    causeRefs.push(checked.value);
  }

  const recordsRaw = input["selected_records"];
  if (!Array.isArray(recordsRaw) || recordsRaw.length === 0) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "request.selected_records: nonempty array required"
    };
  }
  const records: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < recordsRaw.length; i++) {
    const checked = validateEpisodicMemoryRecord(recordsRaw[i]);
    if (!checked.ok) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.selected_records[${i}]: ${checked.error.detail}`
      };
    }
    records.push(checked.value);
  }
  records.sort((a, b) => rawAsciiCompare(a.episode_ref, b.episode_ref));
  const evidence_bindings: { episode_ref: EpisodeRef; payload_hash: HashV1 }[] = [];
  let previousRef: string | undefined;
  for (const record of records) {
    if (record.episode_ref === previousRef) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.selected_records: duplicate episode_ref ${record.episode_ref}`
      };
    }
    previousRef = record.episode_ref;
    evidence_bindings.push({
      episode_ref: record.episode_ref,
      payload_hash: await computeMemoryRecordPayloadHash(record)
    });
  }

  const catalogChecked = validateRelationshipSemanticChannelCatalog(input["semantic_catalog"]);
  if (!catalogChecked.ok) {
    return { ok: false, code: "INVALID_REQUEST", detail: catalogChecked.error.detail };
  }
  const policyChecked = validateRelationshipEvidenceChannelPolicy(input["channel_policy"]);
  if (!policyChecked.ok) {
    return { ok: false, code: "INVALID_REQUEST", detail: `channel_policy: ${policyChecked.error.detail}` };
  }
  const policyFingerprint = await deriveRelationshipEvidenceChannelPolicyFingerprint(policyChecked.value);
  if (
    catalogChecked.value.channel_policy_id !== policyChecked.value.policy_id ||
    catalogChecked.value.channel_policy_fingerprint !== policyFingerprint
  ) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "semantic catalog is not bound to the supplied channel policy identity"
    };
  }
  const influencePolicyChecked = validateMemoryInfluencePolicy(input["memory_influence_policy"]);
  if (!influencePolicyChecked.ok) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: `memory_influence_policy: ${influencePolicyChecked.error.detail}`
    };
  }

  const catalogFingerprint = await deriveRelationshipSemanticCatalogFingerprint(catalogChecked.value);
  const requestFingerprint = await hashEnvelope(
    RELATIONSHIP_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION,
    {
      subject_id: input["subject_id"],
      expected_initial_state_revision: input["expected_initial_state_revision"],
      expected_initial_logical_time: input["expected_initial_logical_time"],
      expected_repository_revision: input["expected_repository_revision"],
      counterpart_ref: counterpartChecked.value,
      cause_refs: causeRefs,
      evidence: evidence_bindings,
      semantic_catalog_id: catalogChecked.value.catalog_id,
      semantic_catalog_fingerprint: catalogFingerprint,
      channel_policy_id: policyChecked.value.policy_id,
      channel_policy_fingerprint: policyFingerprint,
      memory_influence_policy: influencePolicyChecked.value
    }
  );

  const request: RelationshipAdaptationRequestV0 = deepFreeze({
    schema_version: RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: input["workflow_id"] as IdentifierV0,
    subject_id: input["subject_id"] as IdentifierV0,
    expected_initial_state_revision: input["expected_initial_state_revision"] as StateRevisionV0,
    expected_initial_logical_time: input["expected_initial_logical_time"] as LogicalTimeV0,
    expected_repository_revision: input["expected_repository_revision"] as string,
    counterpart_ref: counterpartChecked.value,
    cause_refs: causeRefs,
    selected_records: recordsRaw,
    semantic_catalog: input["semantic_catalog"],
    channel_policy: input["channel_policy"],
    memory_influence_policy: input["memory_influence_policy"]
  });

  return {
    ok: true,
    validated: {
      request,
      records,
      evidence_bindings,
      catalog: catalogChecked.value,
      catalog_fingerprint: catalogFingerprint,
      policy: policyChecked.value,
      policy_fingerprint: policyFingerprint,
      influence_policy: influencePolicyChecked.value,
      request_fingerprint: requestFingerprint
    }
  };
}

function initialRecord(
  validated: ValidatedRequest,
  currentState: SubjectStateV0
): RelationshipAdaptationWorkflowRecordV0 {
  return deepFreeze({
    schema_version: RELATIONSHIP_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION,
    workflow_id: validated.request.workflow_id,
    request_fingerprint: validated.request_fingerprint,
    subject_id: validated.request.subject_id,
    counterpart_ref: validated.request.counterpart_ref,
    initial_state_revision: currentState.runtime_metadata.state_revision,
    initial_logical_time: currentState.runtime_metadata.logical_time,
    repository_revision: currentState.memory_state.repository_revision,
    evidence_bindings: validated.evidence_bindings,
    channel_policy_id: validated.policy.policy_id,
    channel_policy_fingerprint: validated.policy_fingerprint,
    semantic_catalog_id: validated.catalog.catalog_id,
    semantic_catalog_fingerprint: validated.catalog_fingerprint,
    stage: "A1_SEMANTIC_PREPARE",
    external_provider_call_count: 0,
    provider_output_candidate: null,
    provider_output_candidate_fingerprint: null,
    plasticity_rebuild_ordinal: 0,
    proposal_attempts: [],
    terminal_result: null
  });
}

function checkpointFingerprint(checkpoint: {
  rebuild_ordinal: RelationshipAdaptationPlasticityRebuildOrdinalV0;
  proposal: RelationshipUpdateProposalV0;
  transition_id: TransitionIdV0;
}): Promise<HashV1> {
  return hashEnvelope(RELATIONSHIP_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION, {
    rebuild_ordinal: checkpoint.rebuild_ordinal,
    proposal: checkpoint.proposal,
    transition_id: checkpoint.transition_id
  });
}

function candidateFingerprint(candidate: RelationshipAdaptationProviderCandidateV0): Promise<HashV1> {
  return hashEnvelope(RELATIONSHIP_ADAPTATION_PROVIDER_CANDIDATE_FINGERPRINT_PROJECTION, candidate);
}

/**
 * Execute (or resume) one relationship adaptation workflow. Deterministic
 * given the persisted provider candidate; the only nondeterministic step is
 * the single claimed external semantic provider call. Terminal results are
 * replayed byte-equivalently without re-execution.
 */
export async function runRelationshipAdaptationWorkflowV0(
  deps: RelationshipAdaptationWorkflowDepsV0,
  requestInput: unknown
): Promise<RelationshipAdaptationTerminalV0> {
  const executor = new RelationshipTransitionExecutor({
    subjectCore: deps.subjectCore,
    issuer: deps.producerAuthorizationIssuer,
    memoryRepository: deps.memoryRepository
  });
  const store = deps.workflowStore;

  // ---- A0: request validation + canonical identity ---------------------------
  const requestChecked = await validateRequest(requestInput);
  if (!requestChecked.ok) {
    return {
      kind: "REJECTED_PRE_SEMANTIC",
      code: requestChecked.code,
      detail: requestChecked.detail,
      canonical_commits: 0
    };
  }
  const validated = requestChecked.validated;
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- workflow identity / reuse conflict ------------------------------------
  const existing = await store.load(workflowId);
  if (existing !== null && existing.request_fingerprint !== fingerprint) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "WORKFLOW_IDENTITY",
      detail: `workflow_id ${workflowId} already exists with a different request fingerprint`,
      canonical_commits: 0
    };
  }

  // ---- CURRENT canonical read (one fresh read per invocation) -----------------
  const current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);

  if (existing === null) {
    // ---- NEW workflow: initial admission anchors (before any provider call) ----
    if (current === null) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "SUBJECT_UNAVAILABLE",
        detail: "canonical subject state unavailable",
        canonical_commits: 0
      };
    }
    if (validated.request.subject_id !== current.identity.subject_id) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "SUBJECT_MISMATCH",
        detail: "request subject does not match canonical subject",
        canonical_commits: 0
      };
    }
    if (current.runtime_metadata.state_revision !== validated.request.expected_initial_state_revision) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "INITIAL_STATE_REVISION_MISMATCH",
        detail: `expected initial revision ${validated.request.expected_initial_state_revision}, canonical is ${current.runtime_metadata.state_revision}`,
        canonical_commits: 0
      };
    }
    if (current.runtime_metadata.logical_time !== validated.request.expected_initial_logical_time) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "INITIAL_LOGICAL_TIME_MISMATCH",
        detail: `expected initial logical time ${validated.request.expected_initial_logical_time}, canonical is ${current.runtime_metadata.logical_time}`,
        canonical_commits: 0
      };
    }
    if (current.memory_state.repository_revision !== validated.request.expected_repository_revision) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "INITIAL_REPOSITORY_REVISION_MISMATCH",
        detail: "expected repository revision does not match the canonical bound revision",
        canonical_commits: 0
      };
    }
    const counterpart = current.relationships.counterparts.find(
      (candidate) => candidate.counterpart_ref === validated.request.counterpart_ref
    );
    if (counterpart === undefined) {
      return {
        kind: "REJECTED_PRE_SEMANTIC",
        code: "COUNTERPART_NOT_REGISTERED",
        detail: `counterpart ${validated.request.counterpart_ref} is not registered in canonical RelationshipState`,
        canonical_commits: 0
      };
    }
    const registeredDimensions = new Set(
      counterpart.dimensions.map((dimension) => dimension.dimension_id)
    );
    for (const channel of validated.catalog.channels) {
      const rule = validated.policy.channels.find(
        (candidate) => candidate.channel_id === channel.channel_id
      );
      if (rule !== undefined && !registeredDimensions.has(rule.target_dimension_id)) {
        return {
          kind: "REJECTED_PRE_SEMANTIC",
          code: "TARGET_DIMENSION_UNREGISTERED",
          detail: `channel ${channel.channel_id} targets unregistered dimension ${rule.target_dimension_id}`,
          canonical_commits: 0
        };
      }
    }
    const created = await store.createIfAbsent(initialRecord(validated, current));
    if (created === "EXISTING") {
      // Concurrent duplicate: re-load and fall through to the resume path.
      const raced = await store.load(workflowId);
      if (raced === null || raced.request_fingerprint !== fingerprint) {
        return {
          kind: "FATAL_REUSE_CONFLICT",
          source: "WORKFLOW_IDENTITY",
          detail: "concurrent workflow creation with a different request fingerprint",
          canonical_commits: 0
        };
      }
      return resumeFrom(deps, executor, store, validated, raced);
    }
    return resumeFrom(deps, executor, store, validated, initialRecord(validated, current));
  }

  // ---- RESUME path -------------------------------------------------------------
  if (current === null) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "REPOSITORY_UNIVERSE_CHANGED",
      detail: "canonical subject state unavailable on resume",
      canonical_commits: 0
    };
  }
  return resumeFrom(deps, executor, store, validated, existing);
}

async function resumeFrom(
  deps: RelationshipAdaptationWorkflowDepsV0,
  executor: RelationshipTransitionExecutor,
  store: RelationshipAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: RelationshipAdaptationWorkflowRecordV0
): Promise<RelationshipAdaptationTerminalV0> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- terminal replay: byte-equivalent, zero re-execution --------------------
  if (record.terminal_result !== null) {
    return record.terminal_result;
  }

  // ---- CURRENT canonical read for this continuation ----------------------------
  let current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "REPOSITORY_UNIVERSE_CHANGED",
      detail: "canonical subject state unavailable",
      canonical_commits: 0
    };
  }
  // ---- repository universe rule (every continuation) ---------------------------
  if (current.memory_state.repository_revision !== record.repository_revision) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "REPOSITORY_UNIVERSE_CHANGED",
      detail: `repository revision changed: workflow bound ${record.repository_revision}, canonical is ${current.memory_state.repository_revision}`,
      canonical_commits: 0
    };
  }

  // ---- A2: external provider call claim + capture ------------------------------
  if (record.external_provider_call_count === 0) {
    const claim = await store.claimProviderCall(workflowId, fingerprint);
    if (claim === "ALREADY_CLAIMED") {
      // Claimed by a concurrent invocation or a crashed process; candidate
      // absence means the external outcome is unknowable.
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "PROVIDER_OUTCOME_UNKNOWN",
        detail: "provider call already claimed without a persisted candidate",
        canonical_commits: 0
      };
    }
    // This invocation won the claim: exactly one external provider call.
    let captured: unknown = undefined;
    const captureProvider: RelationshipSemanticChannelProviderV0 = {
      propose: async (input) => {
        captured = await deps.semanticProvider.propose(input);
        return captured;
      }
    };
    const run = await runRelationshipSemanticChannelV0({
      subject_state: current,
      counterpart_ref: validated.request.counterpart_ref,
      selected_records: validated.request.selected_records,
      repository: deps.memoryRepository,
      channel_policy: validated.request.channel_policy,
      semantic_catalog: validated.request.semantic_catalog,
      provider: captureProvider
    });
    if (run.kind === "REJECTED") {
      return saveTerminal(workflowId, fingerprint, store, {
        kind: "REJECTED_SEMANTIC",
        code: run.code,
        detail: run.detail,
        canonical_commits: 0
      });
    }
    if (!isRecord(captured)) {
      return saveTerminal(workflowId, fingerprint, store, {
        kind: "REJECTED_SEMANTIC",
        code: "INVALID_PROVIDER_OUTPUT",
        detail: "provider output was not a closed object",
        canonical_commits: 0
      });
    }
    // The frozen runner ACCEPTED the captured raw output, so it is a valid
    // closed candidate. Persist create-once; different bytes = fatal conflict.
    const candidate = captured as unknown as RelationshipAdaptationProviderCandidateV0;
    const candidateHash = await candidateFingerprint(candidate);
    const saved = await store.saveProviderCandidate(workflowId, fingerprint, candidate, candidateHash);
    if (saved === "CANDIDATE_CONFLICT") {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "PROVIDER_CANDIDATE",
        detail: "a different provider candidate already exists for this workflow identity",
        canonical_commits: 0
      };
    }
    // Fall through to local replay below for a fresh CURRENT-state capability.
    const reloaded = await store.load(workflowId);
    if (reloaded === null) {
      return restartProviderUnknown();
    }
    record = reloaded;
  }

  // ---- A3: candidate exists → local replay through the frozen runner -----------
  if (record.provider_output_candidate === null || record.provider_output_candidate_fingerprint === null) {
    return restartProviderUnknown();
  }
  const replayHash = await candidateFingerprint(record.provider_output_candidate);
  if (replayHash !== record.provider_output_candidate_fingerprint) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROVIDER_CANDIDATE",
      detail: "persisted provider candidate fails its stored fingerprint",
      canonical_commits: 0
    };
  }
  const replayProvider: RelationshipSemanticChannelProviderV0 = {
    propose: async () => record.provider_output_candidate
  };
  // Fresh CURRENT state for the replay; repository universe re-checked above.
  current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null || current.memory_state.repository_revision !== record.repository_revision) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "REPOSITORY_UNIVERSE_CHANGED",
      detail: "repository universe changed before semantic replay",
      canonical_commits: 0
    };
  }
  const replayed = await runRelationshipSemanticChannelV0({
    subject_state: current,
    counterpart_ref: validated.request.counterpart_ref,
    selected_records: validated.request.selected_records,
    repository: deps.memoryRepository,
    channel_policy: validated.request.channel_policy,
    semantic_catalog: validated.request.semantic_catalog,
    provider: replayProvider
  });
  if (replayed.kind === "REJECTED") {
    if (replayed.code === "UNREGISTERED_SEMANTIC_COUNTERPART") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "COUNTERPART_MISSING",
        detail: replayed.detail,
        canonical_commits: 0
      };
    }
    if (replayed.code === "UNREGISTERED_TARGET_DIMENSION") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "TARGET_DIMENSION_UNREGISTERED",
        detail: replayed.detail,
        canonical_commits: 0
      };
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_SEMANTIC",
      code: replayed.code,
      detail: replayed.detail,
      canonical_commits: 0
    });
  }
  await store.compareAndSetStage(workflowId, fingerprint, record.stage, "A3_SEMANTIC_ACCEPTED");

  // ---- existing proposal checkpoint: reconcile, never re-produce -----------------
  // A resumed workflow with a checkpointed proposal replays the EXACT
  // checkpointed proposal through the journal + executor; plasticity is only
  // re-entered through the single bounded stale-rebuild path.
  const existingAttempt =
    record.proposal_attempts.find(
      (attempt) => attempt.rebuild_ordinal === record.plasticity_rebuild_ordinal
    ) ??
    (record.proposal_attempts.length > 0
      ? record.proposal_attempts[record.proposal_attempts.length - 1]
      : undefined);
  if (existingAttempt !== undefined) {
    const proposalCheck = validateRelationshipUpdateProposal(existingAttempt.proposal);
    if (!proposalCheck.ok) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "PROPOSAL_CHECKPOINT",
        detail: "checkpointed proposal fails frozen validation: " + proposalCheck.error.detail,
        canonical_commits: 0
      };
    }
    const rederivedId = await deriveRelationshipTransitionId(proposalCheck.value);
    const recomputedFingerprint = await checkpointFingerprint({
      rebuild_ordinal: existingAttempt.rebuild_ordinal,
      proposal: proposalCheck.value,
      transition_id: rederivedId
    });
    if (
      rederivedId !== existingAttempt.transition_id ||
      recomputedFingerprint !== existingAttempt.proposal_checkpoint_fingerprint
    ) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "PROPOSAL_CHECKPOINT",
        detail: "checkpointed proposal fails transition-id or fingerprint re-derivation",
        canonical_commits: 0
      };
    }
    return commitOrReconcile(deps, executor, store, validated, record, existingAttempt, current);
  }

  // ---- ABSTAIN: successful terminal, zero mutation ------------------------------
  if (replayed.result.kind === "ABSTAIN") {
    return saveTerminal(workflowId, fingerprint, store, { kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
  }

  // ---- A4: workflow-internal projections at CURRENT logical time ----------------
  await store.compareAndSetStage(workflowId, fingerprint, "A3_SEMANTIC_ACCEPTED", "A4_INFLUENCE_PREPARE");
  let projections: readonly MemoryInfluenceProjectionV0[];
  try {
    projections = projectMemoryInfluences(
      validated.records,
      current.runtime_metadata.logical_time,
      validated.influence_policy
    );
  } catch (error) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "SAME_WORKFLOW",
      code: "PROJECTION_FAILED",
      detail: `frozen MemoryInfluence projection failed: ${error instanceof Error ? error.message : "unknown failure"}`,
      canonical_commits: 0
    };
  }

  // ---- A5: frozen Plasticity producer -------------------------------------------
  await store.compareAndSetStage(workflowId, fingerprint, "A4_INFLUENCE_PREPARE", "A5_PLASTICITY_PRODUCE");
  const plasticity = await produceRelationshipPlasticityV0({
    current_subject_state: current,
    semantic_capability: replayed,
    channel_policy: validated.request.channel_policy,
    influence_projections: projections
  });
  if (plasticity.kind === "NO_PROPOSAL") {
    if (plasticity.reason === "SEMANTIC_ABSTAIN") {
      return saveTerminal(workflowId, fingerprint, store, { kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_NO_PROPOSAL",
      reason: plasticity.reason,
      canonical_commits: 0
    });
  }
  if (plasticity.kind === "REJECTED") {
    if (plasticity.code === "SEMANTIC_REPOSITORY_REVISION_MISMATCH") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "REPOSITORY_UNIVERSE_CHANGED",
        detail: plasticity.detail,
        canonical_commits: 0
      };
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_PLASTICITY",
      code: plasticity.code,
      detail: plasticity.detail,
      canonical_commits: 0
    });
  }

  // ---- A6: proposal checkpoint (append-only, create-once per ordinal) ------------
  await store.compareAndSetStage(workflowId, fingerprint, "A5_PLASTICITY_PRODUCE", "A6_PROPOSAL_READY");
  const proposal = plasticity.proposal;
  const selfCheck = validateRelationshipUpdateProposal(proposal);
  if (!selfCheck.ok) {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_PLASTICITY",
      code: "PROPOSAL_SCHEMA_FAILURE",
      detail: selfCheck.error.detail,
      canonical_commits: 0
    });
  }
  const transitionId = await deriveRelationshipTransitionId(proposal);
  const ordinal: RelationshipAdaptationPlasticityRebuildOrdinalV0 =
    record.plasticity_rebuild_ordinal === 0 ? 0 : 1;
  const proposalCheckpointFingerprint = await checkpointFingerprint({
    rebuild_ordinal: ordinal,
    proposal,
    transition_id: transitionId
  });
  const checkpoint = deepFreeze({
    rebuild_ordinal: ordinal,
    proposal,
    transition_id: transitionId,
    proposal_checkpoint_fingerprint: proposalCheckpointFingerprint
  });
  const appended = await store.appendProposalAttempt(workflowId, fingerprint, checkpoint);
  if (appended === "ORDINAL_CONFLICT") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: `proposal attempt ordinal ${ordinal} already exists with different content`,
      canonical_commits: 0
    };
  }
  const stagedCommit = await store.compareAndSetStage(
    workflowId,
    fingerprint,
    "A6_PROPOSAL_READY",
    "A7_CANONICAL_COMMIT"
  );
  if (stagedCommit === "STAGE_CONFLICT") {
    // Another continuation already advanced; re-load and reconcile below.
    const reloaded = await store.load(workflowId);
    if (reloaded === null) {
      return restartCommitUnknown();
    }
    record = reloaded;
  } else {
    record = { ...record, stage: "A7_CANONICAL_COMMIT" };
  }

  // ---- A7: journal reconciliation first, then executor ----------------------------
  return commitOrReconcile(deps, executor, store, validated, record, checkpoint, current);
}

function restartProviderUnknown(): RelationshipAdaptationTerminalV0 {
  return {
    kind: "RESTART_REQUIRED",
    scope: "NEW_WORKFLOW_ID",
    code: "PROVIDER_OUTCOME_UNKNOWN",
    detail: "provider call claimed without a persisted candidate; the external outcome is unknowable",
    canonical_commits: 0
  };
}

function restartCommitUnknown(): RelationshipAdaptationTerminalV0 {
  return {
    kind: "RESTART_REQUIRED",
    scope: "SAME_WORKFLOW",
    code: "COMMIT_OUTCOME_UNKNOWN",
    detail: "workflow record unavailable during commit reconciliation",
    canonical_commits: 0
  };
}

async function saveTerminal(
  workflowId: IdentifierV0,
  fingerprint: HashV1,
  store: RelationshipAdaptationWorkflowStoreV0,
  terminal: RelationshipAdaptationTerminalV0
): Promise<RelationshipAdaptationTerminalV0> {
  const saved = await store.saveTerminalResult(workflowId, fingerprint, terminal);
  if (saved === "SAVED") return terminal;
  const existing = await store.load(workflowId);
  if (existing?.terminal_result != null) {
    return existing.terminal_result;
  }
  return terminal;
}

async function commitOrReconcile(
  deps: RelationshipAdaptationWorkflowDepsV0,
  executor: RelationshipTransitionExecutor,
  store: RelationshipAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: RelationshipAdaptationWorkflowRecordV0,
  checkpoint: RelationshipAdaptationProposalCheckpointV0,
  current: SubjectStateV0
): Promise<RelationshipAdaptationTerminalV0> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- journal reconciliation BEFORE any executor invocation ---------------------
  const committedBundle = await deps.readCommittedBundle(checkpoint.transition_id);
  if (committedBundle !== null) {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_ALREADY_COMMITTED",
      transition_id: committedBundle.transition_id,
      commit_ref: committedBundle.commit_ref,
      final_state_revision: committedBundle.next_revision,
      snapshot_hash: committedBundle.state_hash_after,
      canonical_commits: 0
    });
  }

  // ---- frozen executor invocation (the ONLY canonical authority) ------------------
  const ctx: RuntimeContext = {
    subject_id: validated.request.subject_id,
    current_logical_time: current.runtime_metadata.logical_time,
    state_revision: current.runtime_metadata.state_revision
  };
  let outcome;
  try {
    outcome = await executor.execute(ctx, checkpoint.proposal);
  } catch (error) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "SAME_WORKFLOW",
      code: "COMMIT_OUTCOME_UNKNOWN",
      detail: `executor threw during commit: ${error instanceof Error ? error.message : "unknown failure"}`,
      canonical_commits: 0
    };
  }

  if (outcome.kind === "COMMITTED") {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_COMMITTED",
      transition_id: outcome.bundle.transition_id,
      commit_ref: outcome.bundle.commit_ref,
      final_state_revision: outcome.bundle.next_revision,
      snapshot_hash: outcome.bundle.state_hash_after,
      canonical_commits: 1
    });
  }
  if (outcome.kind === "ALREADY_COMMITTED") {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_ALREADY_COMMITTED",
      transition_id: outcome.bundle.transition_id,
      commit_ref: outcome.bundle.commit_ref,
      final_state_revision: outcome.bundle.next_revision,
      snapshot_hash: outcome.bundle.state_hash_after,
      canonical_commits: 0
    });
  }
  if (outcome.kind === "REUSE_CONFLICT") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "EXECUTOR_TRANSITION",
      detail: outcome.detail,
      canonical_commits: 0
    };
  }
  if (outcome.kind === "REJECTED_STALE_REVISION") {
    if (checkpoint.rebuild_ordinal === 0) {
      const rebuilt = await rebuildOnce(deps, executor, store, validated, record);
      return rebuilt;
    }
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "STALE_AFTER_REBUILD",
      detail: "proposal is stale even after the single deterministic rebuild",
      canonical_commits: 0
    };
  }
  if (
    outcome.kind === "REJECTED_UNKNOWN_COUNTERPART" ||
    outcome.kind === "REJECTED_UNKNOWN_DIMENSION"
  ) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code:
        outcome.kind === "REJECTED_UNKNOWN_COUNTERPART"
          ? "COUNTERPART_MISSING"
          : "TARGET_DIMENSION_UNREGISTERED",
      detail: outcome.detail,
      canonical_commits: 0
    };
  }
  return saveTerminal(workflowId, fingerprint, store, {
    kind: "REJECTED_EXECUTOR",
    code: outcome.kind,
    detail: outcome.detail,
    canonical_commits: 0
  });
}

/**
 * The ONE deterministic plasticity rebuild (ordinal 0 → 1): re-read CURRENT
 * state, keep the repository universe, re-mint the semantic capability from
 * the persisted candidate locally (zero external provider calls), regenerate
 * projections at CURRENT logical time, rerun frozen Plasticity, and execute
 * the rebuilt proposal once.
 */
async function rebuildOnce(
  deps: RelationshipAdaptationWorkflowDepsV0,
  executor: RelationshipTransitionExecutor,
  store: RelationshipAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: RelationshipAdaptationWorkflowRecordV0
): Promise<RelationshipAdaptationTerminalV0> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;
  const ordinalSet = await store.setRebuildOrdinal(workflowId, fingerprint);
  if (ordinalSet === "ORDINAL_CONFLICT") {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "STALE_AFTER_REBUILD",
      detail: "rebuild ordinal already advanced",
      canonical_commits: 0
    };
  }
  const current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null || current.memory_state.repository_revision !== record.repository_revision) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "REPOSITORY_UNIVERSE_CHANGED",
      detail: "repository universe changed before rebuild",
      canonical_commits: 0
    };
  }
  if (record.provider_output_candidate === null || record.provider_output_candidate_fingerprint === null) {
    return restartProviderUnknown();
  }
  const replayProvider: RelationshipSemanticChannelProviderV0 = {
    propose: async () => record.provider_output_candidate
  };
  const replayed = await runRelationshipSemanticChannelV0({
    subject_state: current,
    counterpart_ref: validated.request.counterpart_ref,
    selected_records: validated.request.selected_records,
    repository: deps.memoryRepository,
    channel_policy: validated.request.channel_policy,
    semantic_catalog: validated.request.semantic_catalog,
    provider: replayProvider
  });
  if (replayed.kind === "REJECTED") {
    if (replayed.code === "UNREGISTERED_SEMANTIC_COUNTERPART") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "COUNTERPART_MISSING",
        detail: replayed.detail,
        canonical_commits: 0
      };
    }
    if (replayed.code === "UNREGISTERED_TARGET_DIMENSION") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "TARGET_DIMENSION_UNREGISTERED",
        detail: replayed.detail,
        canonical_commits: 0
      };
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_SEMANTIC",
      code: replayed.code,
      detail: replayed.detail,
      canonical_commits: 0
    });
  }
  if (replayed.result.kind === "ABSTAIN") {
    return saveTerminal(workflowId, fingerprint, store, { kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
  }
  let projections: readonly MemoryInfluenceProjectionV0[];
  try {
    projections = projectMemoryInfluences(
      validated.records,
      current.runtime_metadata.logical_time,
      validated.influence_policy
    );
  } catch (error) {
    return {
      kind: "RESTART_REQUIRED",
      scope: "SAME_WORKFLOW",
      code: "PROJECTION_FAILED",
      detail: `frozen MemoryInfluence projection failed during rebuild: ${error instanceof Error ? error.message : "unknown failure"}`,
      canonical_commits: 0
    };
  }
  const plasticity: RelationshipPlasticityProducerResultV0 = await produceRelationshipPlasticityV0({
    current_subject_state: current,
    semantic_capability: replayed,
    channel_policy: validated.request.channel_policy,
    influence_projections: projections
  });
  if (plasticity.kind === "NO_PROPOSAL") {
    if (plasticity.reason === "SEMANTIC_ABSTAIN") {
      return saveTerminal(workflowId, fingerprint, store, { kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_NO_PROPOSAL",
      reason: plasticity.reason,
      canonical_commits: 0
    });
  }
  if (plasticity.kind === "REJECTED") {
    if (plasticity.code === "SEMANTIC_REPOSITORY_REVISION_MISMATCH") {
      return {
        kind: "RESTART_REQUIRED",
        scope: "NEW_WORKFLOW_ID",
        code: "REPOSITORY_UNIVERSE_CHANGED",
        detail: plasticity.detail,
        canonical_commits: 0
      };
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_PLASTICITY",
      code: plasticity.code,
      detail: plasticity.detail,
      canonical_commits: 0
    });
  }
  const proposal = plasticity.proposal;
  const selfCheck = validateRelationshipUpdateProposal(proposal);
  if (!selfCheck.ok) {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_PLASTICITY",
      code: "PROPOSAL_SCHEMA_FAILURE",
      detail: selfCheck.error.detail,
      canonical_commits: 0
    });
  }
  const transitionId = await deriveRelationshipTransitionId(proposal);
  const proposalCheckpointFingerprint = await checkpointFingerprint({
    rebuild_ordinal: 1,
    proposal,
    transition_id: transitionId
  });
  const checkpoint = deepFreeze({
    rebuild_ordinal: 1 as const,
    proposal,
    transition_id: transitionId,
    proposal_checkpoint_fingerprint: proposalCheckpointFingerprint
  });
  const appended = await store.appendProposalAttempt(workflowId, fingerprint, checkpoint);
  if (appended === "ORDINAL_CONFLICT") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "proposal attempt ordinal 1 already exists with different content",
      canonical_commits: 0
    };
  }
  await store.compareAndSetStage(workflowId, fingerprint, "A6_PROPOSAL_READY", "A7_CANONICAL_COMMIT");
  const rebuiltRecord = await store.load(workflowId);
  return commitOrReconcile(
    deps,
    executor,
    store,
    validated,
    rebuiltRecord ?? { ...record, plasticity_rebuild_ordinal: 1 },
    checkpoint,
    current
  );
}
