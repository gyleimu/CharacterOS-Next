/**
 * Belief Adaptation Workflow V0 — durable runtime orchestration of the frozen
 * semantic target resolution, frozen BeliefPlasticityProducer, and frozen
 * BeliefTransitionExecutor into AT MOST ONE canonical Belief commit per
 * workflow identity. EXISTING propositions only: NO INSERT, NO proposition
 * registration, NO cognition surface.
 *
 * IDENTITY (frozen convention): stable host workflow_id + deterministic JCS
 * request fingerprint over the request anchors (schema, subject, expected
 * revisions, sorted candidate ids, evidence episode_ref + frozen Memory payload
 * hash). The workflow_id itself, provider executables, repository objects, and
 * any model output NEVER enter the request fingerprint. A different fingerprint
 * under the same workflow_id is a FATAL identity conflict — never an automatic
 * new attempt.
 *
 * NONDETERMINISM BOUNDARY: exactly ONE external semantic provider call per
 * workflow identity (atomically claimed create-once). Only a frozen-runner-
 * ACCEPTED EXISTING/NO_BEARING output is persisted create-once as a
 * NON-AUTHORITATIVE replay candidate (NEW proposed labels are NEVER persisted).
 * The WeakSet semantic/plasticity capabilities are NEVER serialized: every
 * continuation re-mints fresh process-local capabilities by replaying the
 * persisted candidate through the frozen semantic runner and recomputing
 * plasticity against fresh CURRENT SubjectState — zero external provider
 * recall. A claimed-but-uncandidated workflow after restart is
 * RESTART_REQUIRED / PROVIDER_OUTCOME_UNKNOWN.
 *
 * STALENESS: STRICT_FAIL_ON_STALE with MAX_STALE_REBUILDS 0. Any state or
 * repository drift before a prepared proposal is RESTART_REQUIRED /
 * NEW_WORKFLOW_ID — no rebuild, no rebase, no provider recall. Once the exact
 * proposal checkpoint is durable, resume FIRST reconciles whether that proposal
 * already committed (the current revision may have advanced BECAUSE of the
 * workflow's own commit) before any stale judgement.
 *
 * COMMIT RECONCILIATION: the workflow persists the exact proposal checkpoint
 * BEFORE any executor invocation, then consults the host-supplied public
 * committed-bundle read port; if no public bundle is found, the exact frozen
 * BeliefTransitionExecutor replay is the reconciliation authority
 * (reserveAndRoute returns ALREADY_COMMITTED for the identical transition
 * identity). NO journal backdoor, NO private SubjectCore internals.
 *
 * AUTHORITY: canonical mutation happens ONLY through the frozen
 * BeliefTransitionExecutor (which alone commits via SubjectCore). The workflow
 * writes no canonical state, no canonical trace, no Memory, never advances
 * logical time, and never constructs INSERT proposals. Workflow records are
 * INFRASTRUCTURE state only; every durable write carries the exact record
 * checkpoint fingerprint and is re-validated + recomputed on load.
 */

import type {
  AtomicCommitBundleV1,
  HashV1,
  ProducerAuthorizationIssuer,
  RepositoryRevisionIdV0,
  SubjectStateV0,
  TransitionIdV0
} from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  validateHash,
  validateIdentifier,
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

import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  deriveBeliefTransitionId,
  validateBeliefMutationProposal,
  type BeliefMutationProposalV0
} from "./belief-mutation-proposal.js";
import {
  BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS,
  BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES,
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  runBeliefSemanticTargetResolutionV0,
  type BeliefSemanticRelationV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";
import {
  BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION,
  produceBeliefPlasticityV0,
  type BeliefPlasticityResultV0
} from "./belief-plasticity-producer.js";
import { BeliefTransitionExecutor, type BeliefExecutionResult } from "./belief-transition-executor.js";

export const BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION = "belief-adaptation-request-v0" as const;
export const BELIEF_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION =
  "belief-adaptation-workflow-record-v0" as const;
export const BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION =
  "belief-adaptation-proposal-checkpoint-v0" as const;

export const BELIEF_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION =
  "characteros-next/belief/adaptation-request-fingerprint/v1" as const;
export const BELIEF_ADAPTATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION =
  "characteros-next/belief/adaptation-workflow-checkpoint/v1" as const;
export const BELIEF_ADAPTATION_SEMANTIC_CANDIDATE_FINGERPRINT_PROJECTION =
  "characteros-next/belief/adaptation-semantic-candidate/v1" as const;
export const BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION =
  "characteros-next/belief/adaptation-proposal-checkpoint/v1" as const;

/** Strict stale policy: zero rebuilds inside one workflow identity. */
export const BELIEF_WORKFLOW_MAX_STALE_REBUILDS = 0 as const;
/** External semantic provider call bound per workflow identity. */
export const BELIEF_WORKFLOW_MAX_EXTERNAL_SEMANTIC_CALLS = 1 as const;

/** Exact closed durable stage set; unknown stages reject. */
export type BeliefAdaptationStageV0 =
  | "B1_SEMANTIC_PREPARE"
  | "B2_SEMANTIC_PROVIDER_CALL"
  | "B3_SEMANTIC_CHECKPOINTED"
  | "B4_PLASTICITY_CHECKPOINTED"
  | "B5_PROPOSAL_PREPARED"
  | "B6_CANONICAL_RECONCILIATION"
  | "B7_COMPLETE";

const BELIEF_ADAPTATION_STAGES: readonly BeliefAdaptationStageV0[] = [
  "B1_SEMANTIC_PREPARE",
  "B2_SEMANTIC_PROVIDER_CALL",
  "B3_SEMANTIC_CHECKPOINTED",
  "B4_PLASTICITY_CHECKPOINTED",
  "B5_PROPOSAL_PREPARED",
  "B6_CANONICAL_RECONCILIATION",
  "B7_COMPLETE"
];

/**
 * Closed durable semantic replay candidate: ONLY the approved frozen provider
 * output fields of an ACCEPTED EXISTING/NO_BEARING decision. NEW labels are
 * never persisted; no reasoning, confidence, numeric strength, or model trace.
 */
export type BeliefAdaptationSemanticCandidateV0 =
  | {
      readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION;
      readonly kind: "EXISTING_PROPOSITION";
      readonly proposition_id: IdentifierV0;
      readonly relation: BeliefSemanticRelationV0;
      readonly semantic_context_fingerprint: HashV1;
      readonly candidate_catalog_fingerprint: HashV1;
    }
  | {
      readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION;
      readonly kind: "NO_BEARING";
      readonly semantic_context_fingerprint: HashV1;
      readonly candidate_catalog_fingerprint: HashV1;
    };

/** Exact closed proposal checkpoint persisted BEFORE any executor invocation. */
export interface BeliefAdaptationProposalCheckpointV0 {
  readonly schema_version: typeof BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION;
  readonly proposal: BeliefMutationProposalV0;
  readonly transition_id: TransitionIdV0;
  readonly plasticity_output_fingerprint: HashV1;
  readonly proposal_checkpoint_fingerprint: HashV1;
}

/** Closed terminal union; write-once; replayed byte-equivalently. */
export type BeliefAdaptationTerminalV0 =
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
  | { readonly kind: "COMPLETE_NO_BEARING"; readonly canonical_commits: 0 }
  | { readonly kind: "COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED"; readonly canonical_commits: 0 }
  | {
      readonly kind: "COMPLETE_NO_CHANGE";
      readonly reason: "SATURATED";
      readonly canonical_commits: 0;
    }
  | { readonly kind: "COMPLETE_EXECUTOR_NO_OP"; readonly canonical_commits: 0 }
  | {
      readonly kind: "REJECTED_SEMANTIC";
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
        | "STALE_STATE_REVISION"
        | "STALE_REPOSITORY_REVISION"
        | "TARGET_PROPOSITION_MISSING"
        | "COMMIT_OUTCOME_UNKNOWN"
        | "SUBJECT_UNAVAILABLE";
      readonly detail: string;
      readonly canonical_commits: 0;
    }
  | {
      readonly kind: "FATAL_REUSE_CONFLICT";
      readonly source:
        | "WORKFLOW_IDENTITY"
        | "WORKFLOW_CHECKPOINT"
        | "SEMANTIC_CANDIDATE"
        | "PLASTICITY_RECEIPT"
        | "PROPOSAL_CHECKPOINT"
        | "EXECUTOR_TRANSITION";
      readonly detail: string;
      readonly canonical_commits: 0;
    };

/** The ONE closed/versioned durable workflow record (infrastructure state only). */
export interface BeliefAdaptationWorkflowRecordV0 {
  readonly schema_version: typeof BELIEF_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION;
  readonly workflow_id: IdentifierV0;
  readonly request_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly initial_state_revision: StateRevisionV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly proposition_candidate_ids: readonly IdentifierV0[];
  readonly evidence_bindings: readonly {
    readonly episode_ref: EpisodeRef;
    readonly payload_hash: HashV1;
  }[];
  readonly stage: BeliefAdaptationStageV0;
  /** Create-once external claim: 0 → 1 exactly once per workflow identity. */
  readonly external_provider_call_count: 0 | 1;
  readonly semantic_candidate: BeliefAdaptationSemanticCandidateV0 | null;
  readonly semantic_candidate_fingerprint: HashV1 | null;
  /** Durable NONAUTHORITATIVE replay receipt of the frozen plasticity result. */
  readonly plasticity_receipt: BeliefPlasticityResultV0 | null;
  readonly proposal_checkpoint: BeliefAdaptationProposalCheckpointV0 | null;
  readonly terminal_result: BeliefAdaptationTerminalV0 | null;
  /** Exact projection over the entire record excluding this field itself. */
  readonly checkpoint_fingerprint: HashV1;
}

export interface BeliefAdaptationRequestV0 {
  readonly schema_version: typeof BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION;
  readonly workflow_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly expected_initial_state_revision: StateRevisionV0;
  readonly expected_repository_revision: RepositoryRevisionIdV0;
  readonly proposition_candidate_ids: readonly IdentifierV0[];
  readonly selected_episodes: readonly EpisodicMemoryRecordV0[];
}

const REQUEST_KEYS: readonly string[] = [
  "schema_version",
  "workflow_id",
  "subject_id",
  "expected_initial_state_revision",
  "expected_repository_revision",
  "proposition_candidate_ids",
  "selected_episodes"
];

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "workflow_id",
  "request_fingerprint",
  "subject_id",
  "initial_state_revision",
  "repository_revision",
  "proposition_candidate_ids",
  "evidence_bindings",
  "stage",
  "external_provider_call_count",
  "semantic_candidate",
  "semantic_candidate_fingerprint",
  "plasticity_receipt",
  "proposal_checkpoint",
  "terminal_result",
  "checkpoint_fingerprint"
];

/**
 * Narrow, belief-specific durable workflow store. createIfAbsent and every
 * conditional update MUST be linearizable: concurrent duplicate workflow
 * invocations must not both claim the external provider call, must not
 * overwrite the semantic candidate, the plasticity receipt, or the proposal
 * checkpoint, and must not write conflicting terminal outcomes. Implementations
 * MUST maintain checkpoint_fingerprint as the exact recomputed projection of
 * the full record after every write (see
 * deriveBeliefAdaptationWorkflowCheckpointFingerprint). Production defines the
 * interface only; hosts provide the durable implementation.
 */
export interface BeliefAdaptationWorkflowStoreV0 {
  load(workflow_id: IdentifierV0): Promise<BeliefAdaptationWorkflowRecordV0 | null>;
  /** Linearizable create-if-absent keyed by workflow_id. */
  createIfAbsent(record: BeliefAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING">;
  /**
   * Linearizable create-once external provider call claim: count 0 → 1 and
   * stage B1 → B2. Exactly one concurrent invocation receives "CLAIMED".
   */
  claimProviderCall(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1
  ): Promise<"CLAIMED" | "ALREADY_CLAIMED">;
  /**
   * Create-once semantic replay candidate (EXISTING/NO_BEARING only; NEW
   * labels are never persisted). A different candidate under the same workflow
   * identity is rejected (CANDIDATE_CONFLICT) — never overwritten. Stage → B3.
   */
  saveSemanticCandidate(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    candidate: BeliefAdaptationSemanticCandidateV0,
    candidate_fingerprint: HashV1
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT">;
  /** Create-once NONAUTHORITATIVE plasticity receipt. Stage → B4. */
  savePlasticityReceipt(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    receipt: BeliefPlasticityResultV0
  ): Promise<"SAVED" | "RECEIPT_CONFLICT">;
  /** Create-once exact proposal checkpoint (persisted BEFORE the executor). Stage → B5. */
  saveProposalCheckpoint(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    checkpoint: BeliefAdaptationProposalCheckpointV0
  ): Promise<"SAVED" | "CHECKPOINT_CONFLICT">;
  /** Guarded stage transition (compare-and-set). */
  compareAndSetStage(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    from: BeliefAdaptationStageV0,
    to: BeliefAdaptationStageV0
  ): Promise<"SET" | "STAGE_CONFLICT">;
  /** Write-once terminal result (write-after-terminal is a conflict). Stage → B7. */
  saveTerminalResult(
    workflow_id: IdentifierV0,
    request_fingerprint: HashV1,
    terminal: BeliefAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT">;
}

export interface BeliefAdaptationWorkflowDepsV0 {
  readonly subjectCore: SubjectCorePort;
  readonly memoryRepository: MemoryPreparationAuthority;
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  readonly semanticProvider: BeliefSemanticTargetResolutionProviderV0;
  readonly workflowStore: BeliefAdaptationWorkflowStoreV0;
  /**
   * Public committed-transition read authority consulted before every executor
   * invocation (commit-before-terminal reconciliation). Hosts supply any
   * PUBLIC read-only journal/bundle lookup; null means "not found" and the
   * exact frozen executor replay remains the fallback reconciliation authority.
   */
  readonly readCommittedBundle: (
    transition_id: TransitionIdV0
  ) => Promise<AtomicCommitBundleV1 | null>;
}

interface ValidatedRequest {
  readonly request: BeliefAdaptationRequestV0;
  readonly proposition_ids: readonly IdentifierV0[];
  readonly records: readonly EpisodicMemoryRecordV0[];
  readonly evidence_bindings: readonly {
    readonly episode_ref: EpisodeRef;
    readonly payload_hash: HashV1;
  }[];
  readonly request_fingerprint: HashV1;
}

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

function isHashV1(v: unknown): v is HashV1 {
  return typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);
}

/** Deterministic projection of the entire durable record minus the fingerprint. */
function workflowCheckpointPreimage(record: BeliefAdaptationWorkflowRecordV0) {
  return {
    schema_version: record.schema_version,
    workflow_id: record.workflow_id,
    request_fingerprint: record.request_fingerprint,
    subject_id: record.subject_id,
    initial_state_revision: record.initial_state_revision,
    repository_revision: record.repository_revision,
    proposition_candidate_ids: record.proposition_candidate_ids,
    evidence_bindings: record.evidence_bindings,
    stage: record.stage,
    external_provider_call_count: record.external_provider_call_count,
    semantic_candidate: record.semantic_candidate,
    semantic_candidate_fingerprint: record.semantic_candidate_fingerprint,
    plasticity_receipt: record.plasticity_receipt,
    proposal_checkpoint: record.proposal_checkpoint,
    terminal_result: record.terminal_result
  };
}

/** Authoritative JCS/SHA256 fingerprint of one durable workflow record. */
export function deriveBeliefAdaptationWorkflowCheckpointFingerprint(
  record: BeliefAdaptationWorkflowRecordV0
): Promise<HashV1> {
  return hashEnvelope(
    BELIEF_ADAPTATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION,
    workflowCheckpointPreimage(record)
  );
}

/** Fingerprint of one persisted semantic replay candidate. */
export function deriveBeliefAdaptationSemanticCandidateFingerprint(
  candidate: BeliefAdaptationSemanticCandidateV0
): Promise<HashV1> {
  return hashEnvelope(BELIEF_ADAPTATION_SEMANTIC_CANDIDATE_FINGERPRINT_PROJECTION, candidate);
}

/** Fingerprint of one proposal checkpoint (proposal + transition intent + plasticity binding). */
export function deriveBeliefAdaptationProposalCheckpointFingerprint(input: {
  readonly schema_version: typeof BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION;
  readonly proposal: BeliefMutationProposalV0;
  readonly transition_id: TransitionIdV0;
  readonly plasticity_output_fingerprint: HashV1;
}): Promise<HashV1> {
  return hashEnvelope(BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION, {
    schema_version: input.schema_version,
    proposal: input.proposal,
    transition_id: input.transition_id,
    plasticity_output_fingerprint: input.plasticity_output_fingerprint
  });
}

/**
 * Closed, fail-closed request admission + canonical identity derivation.
 * Caller numeric authority (current/next/initial credence, delta, step,
 * confidence, score, weight) is impossible: the request shape is closed and
 * unknown keys reject. Caller objects are never mutated.
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
  if (input["schema_version"] !== BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION) {
    return { ok: false, code: "INVALID_REQUEST", detail: "request.schema_version" };
  }
  for (const field of ["workflow_id", "subject_id"] as const) {
    if (typeof input[field] !== "string") {
      return { ok: false, code: "INVALID_REQUEST", detail: `request.${field}: expected identifier` };
    }
    const checked = validateIdentifier(input[field] as string, `request.${field}`);
    if (!checked.ok) return { ok: false, code: "INVALID_REQUEST", detail: checked.error.detail };
  }
  if (!isSafeNonnegativeInteger(input["expected_initial_state_revision"])) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "request.expected_initial_state_revision: nonnegative safe integer required"
    };
  }
  if (typeof input["expected_repository_revision"] !== "string" || input["expected_repository_revision"] === "") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "request.expected_repository_revision: repository revision id required"
    };
  }

  // ---- candidate universe: 0..64 unique canonical raw-ASCII sorted ids --------
  const rawIds = input["proposition_candidate_ids"];
  if (!Array.isArray(rawIds)) {
    return { ok: false, code: "INVALID_REQUEST", detail: "request.proposition_candidate_ids: array required" };
  }
  if (rawIds.length > BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: `request.proposition_candidate_ids: exceeds ${BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS}`
    };
  }
  const propositionIds: IdentifierV0[] = [];
  for (let i = 0; i < rawIds.length; i++) {
    if (typeof rawIds[i] !== "string") {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.proposition_candidate_ids[${i}]: expected identifier`
      };
    }
    const checked = validateIdentifier(rawIds[i] as string, `request.proposition_candidate_ids[${i}]`);
    if (!checked.ok) return { ok: false, code: "INVALID_REQUEST", detail: checked.error.detail };
    propositionIds.push(checked.value);
  }
  propositionIds.sort((a, b) => rawAsciiCompare(a as string, b as string));
  let previousId: string | undefined;
  for (const id of propositionIds) {
    if ((id as string) === previousId) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.proposition_candidate_ids: duplicate ${id as string}`
      };
    }
    previousId = id as string;
  }

  // ---- evidence: 1..32 validated unique records, canonical episode_ref order --
  const rawEpisodes = input["selected_episodes"];
  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: "request.selected_episodes: nonempty array required"
    };
  }
  if (rawEpisodes.length > BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      detail: `request.selected_episodes: exceeds ${BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES}`
    };
  }
  const records: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < rawEpisodes.length; i++) {
    const checked = validateEpisodicMemoryRecord(rawEpisodes[i]);
    if (!checked.ok) {
      return { ok: false, code: "INVALID_REQUEST", detail: `request.selected_episodes[${i}]: ${checked.error.detail}` };
    }
    records.push(checked.value);
  }
  records.sort((a, b) => rawAsciiCompare(a.episode_ref as string, b.episode_ref as string));
  const evidenceBindings: { episode_ref: EpisodeRef; payload_hash: HashV1 }[] = [];
  let previousRef: string | undefined;
  for (const record of records) {
    const ref = record.episode_ref as string;
    if (ref === previousRef) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        detail: `request.selected_episodes: duplicate episode_ref ${ref}`
      };
    }
    previousRef = ref;
    evidenceBindings.push({
      episode_ref: record.episode_ref,
      payload_hash: await computeMemoryRecordPayloadHash(record)
    });
  }

  // ---- request fingerprint: workflow_id/provider/repository NEVER bound -------
  const requestFingerprint = await hashEnvelope(BELIEF_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION, {
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    subject_id: input["subject_id"],
    expected_initial_state_revision: input["expected_initial_state_revision"],
    expected_repository_revision: input["expected_repository_revision"],
    proposition_candidate_ids: propositionIds,
    evidence: evidenceBindings
  });

  const request: BeliefAdaptationRequestV0 = deepFreeze({
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: input["workflow_id"] as IdentifierV0,
    subject_id: input["subject_id"] as IdentifierV0,
    expected_initial_state_revision: input["expected_initial_state_revision"] as StateRevisionV0,
    expected_repository_revision: input["expected_repository_revision"] as RepositoryRevisionIdV0,
    proposition_candidate_ids: propositionIds,
    selected_episodes: records
  });

  return {
    ok: true,
    validated: {
      request,
      proposition_ids: propositionIds,
      records,
      evidence_bindings: evidenceBindings,
      request_fingerprint: requestFingerprint
    }
  };
}

async function initialRecord(
  validated: ValidatedRequest,
  currentState: SubjectStateV0
): Promise<BeliefAdaptationWorkflowRecordV0> {
  const partial = {
    schema_version: BELIEF_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION,
    workflow_id: validated.request.workflow_id,
    request_fingerprint: validated.request_fingerprint,
    subject_id: validated.request.subject_id,
    initial_state_revision: currentState.runtime_metadata.state_revision,
    repository_revision: currentState.memory_state.repository_revision,
    proposition_candidate_ids: validated.proposition_ids,
    evidence_bindings: validated.evidence_bindings,
    stage: "B1_SEMANTIC_PREPARE" as const,
    external_provider_call_count: 0 as const,
    semantic_candidate: null,
    semantic_candidate_fingerprint: null,
    plasticity_receipt: null,
    proposal_checkpoint: null,
    terminal_result: null,
    checkpoint_fingerprint: "sha256:" + "0".repeat(64) as HashV1
  };
  const fingerprint = await deriveBeliefAdaptationWorkflowCheckpointFingerprint(
    partial as BeliefAdaptationWorkflowRecordV0
  );
  return deepFreeze({ ...partial, checkpoint_fingerprint: fingerprint });
}

type RecordCheck =
  | { readonly ok: true; readonly value: BeliefAdaptationWorkflowRecordV0 }
  | { readonly ok: false; readonly detail: string };

/**
 * Closed load-time validation of one durable record: exact schema/keys, closed
 * stage set, lawful stage/data combinations, and exact checkpoint fingerprint
 * recomputation. Any tamper FAILS CLOSED.
 */
function validateWorkflowRecord(raw: unknown): RecordCheck {
  const invalid = (detail: string): RecordCheck => ({ ok: false, detail });
  if (!isRecord(raw)) return invalid("workflow record: expected object");
  const keys = Object.keys(raw);
  if (keys.length !== RECORD_KEYS.length || !keys.every((key) => RECORD_KEYS.includes(key))) {
    return invalid("workflow record: unknown or missing key");
  }
  if (raw["schema_version"] !== BELIEF_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION) {
    return invalid("workflow record.schema_version: unsupported schema");
  }
  for (const field of ["workflow_id", "subject_id"] as const) {
    if (typeof raw[field] !== "string") return invalid(`workflow record.${field}: expected identifier`);
    const checked = validateIdentifier(raw[field] as string, `workflow record.${field}`);
    if (!checked.ok) return invalid(checked.error.detail);
  }
  for (const field of ["request_fingerprint", "checkpoint_fingerprint"] as const) {
    if (typeof raw[field] !== "string") return invalid(`workflow record.${field}: expected hash`);
    const checked = validateHash(raw[field] as string, `workflow record.${field}`);
    if (!checked.ok) return invalid(checked.error.detail);
  }
  if (!isSafeNonnegativeInteger(raw["initial_state_revision"])) {
    return invalid("workflow record.initial_state_revision: nonnegative safe integer required");
  }
  if (typeof raw["repository_revision"] !== "string" || raw["repository_revision"] === "") {
    return invalid("workflow record.repository_revision: repository revision id required");
  }
  if (!Array.isArray(raw["proposition_candidate_ids"])) {
    return invalid("workflow record.proposition_candidate_ids: array required");
  }
  for (const id of raw["proposition_candidate_ids"]) {
    if (typeof id !== "string") return invalid("workflow record.proposition_candidate_ids: expected identifiers");
  }
  if (!Array.isArray(raw["evidence_bindings"])) {
    return invalid("workflow record.evidence_bindings: array required");
  }
  for (const binding of raw["evidence_bindings"]) {
    if (
      !isRecord(binding) ||
      typeof binding["episode_ref"] !== "string" ||
      !isHashV1(binding["payload_hash"])
    ) {
      return invalid("workflow record.evidence_bindings: malformed binding");
    }
  }
  const stage = raw["stage"];
  if (typeof stage !== "string" || !BELIEF_ADAPTATION_STAGES.includes(stage as BeliefAdaptationStageV0)) {
    return invalid("workflow record.stage: unknown stage");
  }
  const count = raw["external_provider_call_count"];
  if (count !== 0 && count !== 1) {
    return invalid("workflow record.external_provider_call_count: must be 0 or 1");
  }
  const candidate = raw["semantic_candidate"];
  const candidateFingerprint = raw["semantic_candidate_fingerprint"];
  if ((candidate === null) !== (candidateFingerprint === null)) {
    return invalid("workflow record: semantic candidate/fingerprint pairing broken");
  }
  if (candidate !== null) {
    if (count !== 1) {
      return invalid("workflow record: semantic candidate without provider claim");
    }
    if (!isRecord(candidate) || candidate["schema_version"] !== BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION) {
      return invalid("workflow record.semantic_candidate: unsupported schema");
    }
    const kind = candidate["kind"];
    const expectedKeys =
      kind === "EXISTING_PROPOSITION"
        ? [
            "schema_version",
            "kind",
            "proposition_id",
            "relation",
            "semantic_context_fingerprint",
            "candidate_catalog_fingerprint"
          ]
        : kind === "NO_BEARING"
          ? ["schema_version", "kind", "semantic_context_fingerprint", "candidate_catalog_fingerprint"]
          : null;
    if (expectedKeys === null) {
      return invalid("workflow record.semantic_candidate: NEW labels are never persisted");
    }
    const candidateKeys = Object.keys(candidate);
    if (candidateKeys.length !== expectedKeys.length || !candidateKeys.every((key) => expectedKeys.includes(key))) {
      return invalid("workflow record.semantic_candidate: closed keys violated");
    }
    if (!isHashV1(candidate["semantic_context_fingerprint"]) || !isHashV1(candidate["candidate_catalog_fingerprint"])) {
      return invalid("workflow record.semantic_candidate: malformed fingerprints");
    }
  }
  const receipt = raw["plasticity_receipt"];
  if (receipt !== null) {
    if (candidate === null) {
      return invalid("workflow record: plasticity receipt without semantic candidate");
    }
    if (
      !isRecord(receipt) ||
      receipt["schema_version"] !== BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION ||
      !isHashV1(receipt["output_fingerprint"])
    ) {
      return invalid("workflow record.plasticity_receipt: malformed receipt");
    }
  }
  const checkpoint = raw["proposal_checkpoint"];
  if (checkpoint !== null) {
    if (receipt === null) {
      return invalid("workflow record: proposal checkpoint without plasticity receipt");
    }
    if (!isRecord(checkpoint) || checkpoint["schema_version"] !== BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION) {
      return invalid("workflow record.proposal_checkpoint: unsupported schema");
    }
    const checkpointKeys = Object.keys(checkpoint);
    const expected = [
      "schema_version",
      "proposal",
      "transition_id",
      "plasticity_output_fingerprint",
      "proposal_checkpoint_fingerprint"
    ];
    if (checkpointKeys.length !== expected.length || !checkpointKeys.every((key) => expected.includes(key))) {
      return invalid("workflow record.proposal_checkpoint: closed keys violated");
    }
    if (!isHashV1(checkpoint["plasticity_output_fingerprint"]) || !isHashV1(checkpoint["proposal_checkpoint_fingerprint"])) {
      return invalid("workflow record.proposal_checkpoint: malformed fingerprints");
    }
  }
  const terminal = raw["terminal_result"];
  if (terminal !== null && stage !== "B7_COMPLETE") {
    return invalid("workflow record: terminal result outside B7_COMPLETE");
  }
  if (terminal === null && stage === "B7_COMPLETE") {
    return invalid("workflow record: B7_COMPLETE without terminal result");
  }
  if (terminal !== null && (!isRecord(terminal) || typeof terminal["kind"] !== "string")) {
    return invalid("workflow record.terminal_result: malformed terminal");
  }

  const record = raw as unknown as BeliefAdaptationWorkflowRecordV0;
  // Exact fingerprint recomputation is the final tamper gate (async caller).
  return { ok: true, value: record };
}

async function verifyCheckpointFingerprint(record: BeliefAdaptationWorkflowRecordV0): Promise<string | null> {
  const recomputed = await deriveBeliefAdaptationWorkflowCheckpointFingerprint(record);
  return recomputed === record.checkpoint_fingerprint ? null : "workflow checkpoint fingerprint mismatch";
}

function restartTerminal(
  code: "PROVIDER_OUTCOME_UNKNOWN" | "STALE_STATE_REVISION" | "STALE_REPOSITORY_REVISION" | "TARGET_PROPOSITION_MISSING" | "SUBJECT_UNAVAILABLE",
  detail: string
): BeliefAdaptationTerminalV0 {
  return {
    kind: "RESTART_REQUIRED",
    scope: "NEW_WORKFLOW_ID",
    code,
    detail,
    canonical_commits: 0
  };
}

/**
 * Execute (or resume) one belief adaptation workflow. Deterministic given the
 * persisted semantic candidate; the only nondeterministic step is the single
 * claimed external semantic provider call. Terminal results are replayed
 * byte-equivalently without re-execution.
 */
export async function runBeliefAdaptationWorkflowV0(
  deps: BeliefAdaptationWorkflowDepsV0,
  requestInput: unknown
): Promise<BeliefAdaptationTerminalV0> {
  const executor = new BeliefTransitionExecutor({
    subjectCore: deps.subjectCore,
    issuer: deps.producerAuthorizationIssuer,
    memoryRepository: deps.memoryRepository
  });
  const store = deps.workflowStore;

  // ---- request validation + canonical identity ---------------------------------
  const requestChecked = await validateRequest(requestInput);
  if (!requestChecked.ok) {
    return {
      kind: "REJECTED_SEMANTIC",
      code: requestChecked.code,
      detail: requestChecked.detail,
      canonical_commits: 0
    };
  }
  const validated = requestChecked.validated;
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- workflow identity / durable record admission -----------------------------
  const existingRaw: unknown = await store.load(workflowId);
  if (existingRaw !== null) {
    if (!isRecord(existingRaw) || existingRaw["request_fingerprint"] !== fingerprint) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "WORKFLOW_IDENTITY",
        detail: `workflow_id ${workflowId as string} already exists with a different request fingerprint`,
        canonical_commits: 0
      };
    }
    const recordChecked = validateWorkflowRecord(existingRaw);
    if (!recordChecked.ok) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "WORKFLOW_CHECKPOINT",
        detail: recordChecked.detail,
        canonical_commits: 0
      };
    }
    const fingerprintMismatch = await verifyCheckpointFingerprint(recordChecked.value);
    if (fingerprintMismatch !== null) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "WORKFLOW_CHECKPOINT",
        detail: fingerprintMismatch,
        canonical_commits: 0
      };
    }
    const existing = recordChecked.value;
    // Identity conflict is decided BEFORE terminal replay.
    if (existing.terminal_result !== null) {
      return existing.terminal_result;
    }
    return resumeFrom(deps, executor, store, validated, existing);
  }

  // ---- NEW workflow: initial strict binding (§15, before any semantic work) -----
  const current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null) {
    return restartTerminal("SUBJECT_UNAVAILABLE", "canonical subject state unavailable");
  }
  if (current.identity.subject_id !== validated.request.subject_id) {
    return {
      kind: "REJECTED_SEMANTIC",
      code: "SUBJECT_MISMATCH",
      detail: "request subject does not match canonical subject",
      canonical_commits: 0
    };
  }
  if (current.runtime_metadata.state_revision !== validated.request.expected_initial_state_revision) {
    return restartTerminal(
      "STALE_STATE_REVISION",
      `expected initial revision ${validated.request.expected_initial_state_revision}, canonical is ${current.runtime_metadata.state_revision}`
    );
  }
  if (current.memory_state.repository_revision !== validated.request.expected_repository_revision) {
    return restartTerminal(
      "STALE_REPOSITORY_REVISION",
      "expected repository revision does not match the canonical bound revision"
    );
  }
  const initial = await initialRecord(validated, current);
  const created = await store.createIfAbsent(initial);
  if (created === "EXISTING") {
    // Concurrent duplicate: re-load and fall through to the resume path.
    const raced: unknown = await store.load(workflowId);
    if (!isRecord(raced) || raced["request_fingerprint"] !== fingerprint) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "WORKFLOW_IDENTITY",
        detail: "concurrent workflow creation with a different request fingerprint",
        canonical_commits: 0
      };
    }
    const racedChecked = validateWorkflowRecord(raced);
    if (!racedChecked.ok) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "WORKFLOW_CHECKPOINT",
        detail: racedChecked.detail,
        canonical_commits: 0
      };
    }
    return resumeFrom(deps, executor, store, validated, racedChecked.value);
  }
  return resumeFrom(deps, executor, store, validated, initial);
}

async function resumeFrom(
  deps: BeliefAdaptationWorkflowDepsV0,
  executor: BeliefTransitionExecutor,
  store: BeliefAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: BeliefAdaptationWorkflowRecordV0
): Promise<BeliefAdaptationTerminalV0> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- prepared proposal checkpoint: reconcile FIRST (§38), never reject early --
  if (record.proposal_checkpoint !== null) {
    return reconcileCheckpoint(deps, executor, store, validated, record);
  }

  // ---- CURRENT canonical read for this continuation ------------------------------
  const current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null) {
    return restartTerminal("SUBJECT_UNAVAILABLE", "canonical subject state unavailable");
  }
  // ---- strict stale policy before prepared proposal (MAX_STALE_REBUILDS 0) ------
  if (current.memory_state.repository_revision !== record.repository_revision) {
    return restartTerminal(
      "STALE_REPOSITORY_REVISION",
      `repository revision changed: workflow bound ${record.repository_revision}, canonical is ${current.memory_state.repository_revision}`
    );
  }
  if (current.runtime_metadata.state_revision !== record.initial_state_revision) {
    return restartTerminal(
      "STALE_STATE_REVISION",
      `state revision drifted: workflow bound ${record.initial_state_revision}, canonical is ${current.runtime_metadata.state_revision}`
    );
  }

  // ---- external provider claim (AT MOST ONE per workflow identity) ---------------
  if (record.external_provider_call_count === 0) {
    const claim = await store.claimProviderCall(workflowId, fingerprint);
    if (claim === "ALREADY_CLAIMED") {
      const reloadedRaw: unknown = await store.load(workflowId);
      const reloadedChecked = reloadedRaw === null ? null : validateWorkflowRecord(reloadedRaw);
      if (reloadedChecked === null || !reloadedChecked.ok) {
        return restartTerminal(
          "PROVIDER_OUTCOME_UNKNOWN",
          "provider call claimed; workflow record unavailable for candidate verification"
        );
      }
      if (reloadedChecked.value.terminal_result !== null) {
        return reloadedChecked.value.terminal_result;
      }
      if (reloadedChecked.value.semantic_candidate === null) {
        return restartTerminal(
          "PROVIDER_OUTCOME_UNKNOWN",
          "provider call already claimed without a persisted candidate"
        );
      }
      record = reloadedChecked.value;
    } else {
      // This invocation won the claim: exactly one external provider call.
      let captured: unknown;
      const captureProvider: BeliefSemanticTargetResolutionProviderV0 = {
        propose: async (input) => {
          captured = await deps.semanticProvider.propose(input);
          return captured;
        }
      };
      const run = await runBeliefSemanticTargetResolutionV0(
        { memoryRepository: deps.memoryRepository },
        {
          subjectState: current,
          proposition_ids: validated.proposition_ids,
          selected_episodes: validated.records,
          provider: captureProvider
        }
      );
      if (!run.ok) {
        // Provider failure / invalid output remain failures: no retry, no repair.
        return saveTerminal(workflowId, fingerprint, store, {
          kind: "REJECTED_SEMANTIC",
          code: run.code,
          detail: run.detail,
          canonical_commits: 0
        });
      }
      const decision = run.resolution.decision;
      if (decision.kind === "NEW_PROPOSITION_CANDIDATE") {
        // TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL: proposed_label and the
        // raw NEW output are NEVER persisted and never reach plasticity.
        return saveTerminal(workflowId, fingerprint, store, {
          kind: "COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED",
          canonical_commits: 0
        });
      }
      // EXISTING / NO_BEARING: persist ONLY the approved closed provider-output
      // fields, reconstructed from the ACCEPTED frozen resolution.
      const candidate: BeliefAdaptationSemanticCandidateV0 =
        decision.kind === "EXISTING_PROPOSITION"
          ? {
              schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
              kind: "EXISTING_PROPOSITION",
              proposition_id: decision.proposition_id,
              relation: decision.relation,
              semantic_context_fingerprint: run.resolution.semantic_context_fingerprint,
              candidate_catalog_fingerprint: run.resolution.candidate_catalog_fingerprint
            }
          : {
              schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
              kind: "NO_BEARING",
              semantic_context_fingerprint: run.resolution.semantic_context_fingerprint,
              candidate_catalog_fingerprint: run.resolution.candidate_catalog_fingerprint
            };
      const candidateHash = await deriveBeliefAdaptationSemanticCandidateFingerprint(candidate);
      const saved = await store.saveSemanticCandidate(workflowId, fingerprint, candidate, candidateHash);
      if (saved === "CANDIDATE_CONFLICT") {
        return {
          kind: "FATAL_REUSE_CONFLICT",
          source: "SEMANTIC_CANDIDATE",
          detail: "a different semantic candidate already exists for this workflow identity",
          canonical_commits: 0
        };
      }
      const reloadedRaw: unknown = await store.load(workflowId);
      const reloadedChecked = reloadedRaw === null ? null : validateWorkflowRecord(reloadedRaw);
      if (reloadedChecked === null || !reloadedChecked.ok || reloadedChecked.value.semantic_candidate === null) {
        return restartTerminal(
          "PROVIDER_OUTCOME_UNKNOWN",
          "semantic candidate unavailable after persistence"
        );
      }
      record = reloadedChecked.value;
    }
  }

  // ---- semantic capability restore: replay through the frozen runner -------------
  if (record.semantic_candidate === null || record.semantic_candidate_fingerprint === null) {
    return restartTerminal(
      "PROVIDER_OUTCOME_UNKNOWN",
      "provider call claimed without a persisted candidate; the external outcome is unknowable"
    );
  }
  const replayHash = await deriveBeliefAdaptationSemanticCandidateFingerprint(record.semantic_candidate);
  if (replayHash !== record.semantic_candidate_fingerprint) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "SEMANTIC_CANDIDATE",
      detail: "persisted semantic candidate fails its stored fingerprint",
      canonical_commits: 0
    };
  }
  const replayCandidate = record.semantic_candidate;
  const replayProvider: BeliefSemanticTargetResolutionProviderV0 = {
    propose: async () => replayCandidate
  };
  const replayed = await runBeliefSemanticTargetResolutionV0(
    { memoryRepository: deps.memoryRepository },
    {
      subjectState: current,
      proposition_ids: validated.proposition_ids,
      selected_episodes: validated.records,
      provider: replayProvider
    }
  );
  if (!replayed.ok) {
    if (replayed.code === "STALE_SEMANTIC_CONTEXT" || replayed.code === "STALE_CANDIDATE_CATALOG") {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "SEMANTIC_CANDIDATE",
        detail: `persisted semantic candidate no longer matches the bound context: ${replayed.detail}`,
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
  if (replayed.resolution.decision.kind === "NO_BEARING") {
    // NO_BEARING never reaches plasticity; zero canonical commits.
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_NO_BEARING",
      canonical_commits: 0
    });
  }
  if (replayed.resolution.decision.kind !== "EXISTING_PROPOSITION") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "SEMANTIC_CANDIDATE",
      detail: "persisted semantic candidate replayed to an impossible NEW decision",
      canonical_commits: 0
    };
  }
  await store.compareAndSetStage(workflowId, fingerprint, record.stage, "B3_SEMANTIC_CHECKPOINTED");

  // ---- plasticity: remint + recompute; NEVER trust the serialized receipt -------
  const plasticity = await produceBeliefPlasticityV0({
    current_subject_state: current,
    semantic_capability: replayed.resolution
  });
  if (!plasticity.ok) {
    if (plasticity.code === "STALE_STATE_REVISION") {
      return restartTerminal("STALE_STATE_REVISION", plasticity.detail);
    }
    if (plasticity.code === "STALE_REPOSITORY_REVISION") {
      return restartTerminal("STALE_REPOSITORY_REVISION", plasticity.detail);
    }
    if (plasticity.code === "TARGET_PROPOSITION_MISSING") {
      return restartTerminal("TARGET_PROPOSITION_MISSING", plasticity.detail);
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_SEMANTIC",
      code: plasticity.code,
      detail: plasticity.detail,
      canonical_commits: 0
    });
  }
  const freshResult = plasticity.result;
  if (record.plasticity_receipt !== null) {
    // §27: exact public result + output_fingerprint comparison against the
    // durable NONAUTHORITATIVE receipt; serialized next_credence alone never
    // authorizes anything.
    if (
      JSON.stringify(record.plasticity_receipt) !== JSON.stringify(freshResult) ||
      record.plasticity_receipt.output_fingerprint !== freshResult.output_fingerprint
    ) {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "PLASTICITY_RECEIPT",
        detail: "recomputed plasticity result does not exactly match the durable receipt",
        canonical_commits: 0
      };
    }
  } else {
    const saved = await store.savePlasticityReceipt(workflowId, fingerprint, freshResult);
    if (saved === "RECEIPT_CONFLICT") {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "PLASTICITY_RECEIPT",
        detail: "a different plasticity receipt already exists for this workflow identity",
        canonical_commits: 0
      };
    }
  }
  await store.compareAndSetStage(workflowId, fingerprint, "B3_SEMANTIC_CHECKPOINTED", "B4_PLASTICITY_CHECKPOINTED");

  // ---- saturation: explicit NO_CHANGE terminal, no proposal, no executor --------
  if (freshResult.outcome.kind === "NO_CHANGE") {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_NO_CHANGE",
      reason: freshResult.outcome.reason,
      canonical_commits: 0
    });
  }

  // ---- CREDENCE_CHANGE: construct the UPDATE proposal from frozen authority -------
  const proposal: BeliefMutationProposalV0 = {
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: freshResult.subject_id,
    expected_state_revision: freshResult.state_revision,
    mutation: {
      kind: "UPDATE",
      proposition_id: freshResult.proposition_id,
      next_credence: freshResult.outcome.next_credence
    },
    evidence_binding: freshResult.evidence_binding
  };
  const selfCheck = validateBeliefMutationProposal(proposal);
  if (!selfCheck.ok) {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_SEMANTIC",
      code: "PROPOSAL_SCHEMA_FAILURE",
      detail: selfCheck.error.detail,
      canonical_commits: 0
    });
  }
  const transitionId = await deriveBeliefTransitionId(selfCheck.value);
  const proposalCheckpointFingerprint = await deriveBeliefAdaptationProposalCheckpointFingerprint({
    schema_version: BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION,
    proposal: selfCheck.value,
    transition_id: transitionId,
    plasticity_output_fingerprint: freshResult.output_fingerprint
  });
  const checkpoint: BeliefAdaptationProposalCheckpointV0 = deepFreeze({
    schema_version: BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION,
    proposal: selfCheck.value,
    transition_id: transitionId,
    plasticity_output_fingerprint: freshResult.output_fingerprint,
    proposal_checkpoint_fingerprint: proposalCheckpointFingerprint
  });
  const saved = await store.saveProposalCheckpoint(workflowId, fingerprint, checkpoint);
  if (saved === "CHECKPOINT_CONFLICT") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "a different proposal checkpoint already exists for this workflow identity",
      canonical_commits: 0
    };
  }
  await store.compareAndSetStage(workflowId, fingerprint, "B4_PLASTICITY_CHECKPOINTED", "B5_PROPOSAL_PREPARED");
  const staged = await store.compareAndSetStage(
    workflowId,
    fingerprint,
    "B5_PROPOSAL_PREPARED",
    "B6_CANONICAL_RECONCILIATION"
  );
  if (staged === "STAGE_CONFLICT") {
    const reloadedRaw: unknown = await store.load(workflowId);
    const reloadedChecked = reloadedRaw === null ? null : validateWorkflowRecord(reloadedRaw);
    if (reloadedChecked === null || !reloadedChecked.ok || reloadedChecked.value.proposal_checkpoint === null) {
      return {
        kind: "RESTART_REQUIRED",
        scope: "SAME_WORKFLOW",
        code: "COMMIT_OUTCOME_UNKNOWN",
        detail: "workflow record unavailable during commit reconciliation",
        canonical_commits: 0
      };
    }
  }
  return commitOrReconcile(deps, executor, store, validated, checkpoint, current);
}

/**
 * Resume with an existing durable proposal checkpoint (§38): revalidate the
 * exact proposal, rederive the transition identity, recompute the checkpoint
 * fingerprint, then reconcile commit truth BEFORE any stale judgement — the
 * current revision may have advanced BECAUSE of this workflow's own commit.
 * If no commit is found and the canonical state is still exactly at the initial
 * binding, the FULL durable chain is re-verified before any executor
 * invocation: candidate fingerprint + frozen-runner replay + fresh plasticity
 * recomputation compared exactly against the durable receipt (§27), so a
 * tampered candidate or serialized next_credence can never authorize a
 * proposal. Only when the state has drifted (possibly because of the workflow's
 * own commit under a host without public bundle lookup) does the exact frozen
 * executor replay become the reconciliation authority directly.
 */
async function reconcileCheckpoint(
  deps: BeliefAdaptationWorkflowDepsV0,
  executor: BeliefTransitionExecutor,
  store: BeliefAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: BeliefAdaptationWorkflowRecordV0
): Promise<BeliefAdaptationTerminalV0> {
  const checkpoint = record.proposal_checkpoint;
  if (checkpoint === null) {
    throw new Error("unreachable: reconcileCheckpoint without checkpoint");
  }
  const proposalCheck = validateBeliefMutationProposal(checkpoint.proposal);
  if (!proposalCheck.ok) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "checkpointed proposal fails frozen validation: " + proposalCheck.error.detail,
      canonical_commits: 0
    };
  }
  const rederivedId = await deriveBeliefTransitionId(proposalCheck.value);
  const recomputedFingerprint = await deriveBeliefAdaptationProposalCheckpointFingerprint({
    schema_version: BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION,
    proposal: proposalCheck.value,
    transition_id: rederivedId,
    plasticity_output_fingerprint: checkpoint.plasticity_output_fingerprint
  });
  if (
    rederivedId !== checkpoint.transition_id ||
    recomputedFingerprint !== checkpoint.proposal_checkpoint_fingerprint
  ) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "checkpointed proposal fails transition-id or fingerprint re-derivation",
      canonical_commits: 0
    };
  }
  if (
    record.plasticity_receipt !== null &&
    record.plasticity_receipt.output_fingerprint !== checkpoint.plasticity_output_fingerprint
  ) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PLASTICITY_RECEIPT",
      detail: "proposal checkpoint is not bound to the durable plasticity receipt",
      canonical_commits: 0
    };
  }
  const current = await deps.subjectCore.readCurrentSnapshot(validated.request.subject_id);
  if (current === null) {
    return restartTerminal("SUBJECT_UNAVAILABLE", "canonical subject state unavailable during reconciliation");
  }

  // ---- §38: reconcile committed truth FIRST (the revision may have advanced
  // because of this workflow's own commit-before-terminal crash) --------------
  const committedBundle = await deps.readCommittedBundle(checkpoint.transition_id);
  if (committedBundle !== null) {
    return saveTerminal(validated.request.workflow_id, validated.request_fingerprint, store, {
      kind: "COMPLETE_ALREADY_COMMITTED",
      transition_id: committedBundle.transition_id,
      commit_ref: committedBundle.commit_ref,
      final_state_revision: committedBundle.next_revision,
      snapshot_hash: committedBundle.state_hash_after,
      canonical_commits: 0
    });
  }

  // ---- still-bound state: re-verify the ENTIRE durable chain (§27) -----------
  const stillBound =
    current.memory_state.repository_revision === record.repository_revision &&
    current.runtime_metadata.state_revision === record.initial_state_revision;
  if (stillBound) {
    const chainFailure = await verifyDurableChain(deps, store, validated, record, current);
    if (chainFailure !== null) return chainFailure;
  }

  await store.compareAndSetStage(
    validated.request.workflow_id,
    validated.request_fingerprint,
    record.stage,
    "B6_CANONICAL_RECONCILIATION"
  );
  return commitOrReconcile(deps, executor, store, validated, checkpoint, current);
}

/**
 * §27 chain re-verification for a still-bound checkpoint resume: candidate
 * fingerprint + frozen-runner semantic replay + fresh plasticity recomputation
 * compared EXACTLY against the durable receipt, then the fresh result must
 * re-derive the exact checkpointed proposal. Returns a FATAL/restart terminal
 * on any mismatch, or null when the chain is intact.
 */
async function verifyDurableChain(
  deps: BeliefAdaptationWorkflowDepsV0,
  store: BeliefAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  record: BeliefAdaptationWorkflowRecordV0,
  current: SubjectStateV0
): Promise<BeliefAdaptationTerminalV0 | null> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;
  const checkpoint = record.proposal_checkpoint;
  if (checkpoint === null) throw new Error("unreachable: verifyDurableChain without checkpoint");

  if (record.semantic_candidate === null || record.semantic_candidate_fingerprint === null) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "SEMANTIC_CANDIDATE",
      detail: "proposal checkpoint exists without a persisted semantic candidate",
      canonical_commits: 0
    };
  }
  const replayHash = await deriveBeliefAdaptationSemanticCandidateFingerprint(record.semantic_candidate);
  if (replayHash !== record.semantic_candidate_fingerprint) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "SEMANTIC_CANDIDATE",
      detail: "persisted semantic candidate fails its stored fingerprint",
      canonical_commits: 0
    };
  }
  const replayCandidate = record.semantic_candidate;
  const replayProvider: BeliefSemanticTargetResolutionProviderV0 = {
    propose: async () => replayCandidate
  };
  const replayed = await runBeliefSemanticTargetResolutionV0(
    { memoryRepository: deps.memoryRepository },
    {
      subjectState: current,
      proposition_ids: validated.proposition_ids,
      selected_episodes: validated.records,
      provider: replayProvider
    }
  );
  if (!replayed.ok) {
    if (replayed.code === "STALE_SEMANTIC_CONTEXT" || replayed.code === "STALE_CANDIDATE_CATALOG") {
      return {
        kind: "FATAL_REUSE_CONFLICT",
        source: "SEMANTIC_CANDIDATE",
        detail: `persisted semantic candidate no longer matches the bound context: ${replayed.detail}`,
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
  if (replayed.resolution.decision.kind !== "EXISTING_PROPOSITION") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "SEMANTIC_CANDIDATE",
      detail: "proposal checkpoint cannot reconcile with a non-EXISTING replayed decision",
      canonical_commits: 0
    };
  }

  const plasticity = await produceBeliefPlasticityV0({
    current_subject_state: current,
    semantic_capability: replayed.resolution
  });
  if (!plasticity.ok) {
    if (plasticity.code === "STALE_STATE_REVISION") {
      return restartTerminal("STALE_STATE_REVISION", plasticity.detail);
    }
    if (plasticity.code === "STALE_REPOSITORY_REVISION") {
      return restartTerminal("STALE_REPOSITORY_REVISION", plasticity.detail);
    }
    if (plasticity.code === "TARGET_PROPOSITION_MISSING") {
      return restartTerminal("TARGET_PROPOSITION_MISSING", plasticity.detail);
    }
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "REJECTED_SEMANTIC",
      code: plasticity.code,
      detail: plasticity.detail,
      canonical_commits: 0
    });
  }
  const freshResult = plasticity.result;
  if (
    record.plasticity_receipt === null ||
    JSON.stringify(record.plasticity_receipt) !== JSON.stringify(freshResult) ||
    record.plasticity_receipt.output_fingerprint !== freshResult.output_fingerprint
  ) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PLASTICITY_RECEIPT",
      detail: "recomputed plasticity result does not exactly match the durable receipt",
      canonical_commits: 0
    };
  }
  if (freshResult.outcome.kind !== "CREDENCE_CHANGE") {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PLASTICITY_RECEIPT",
      detail: "proposal checkpoint cannot reconcile with a non-CREDENCE_CHANGE recomputation",
      canonical_commits: 0
    };
  }

  // The fresh authorized result must re-derive the EXACT checkpointed proposal.
  const freshProposal: BeliefMutationProposalV0 = {
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: freshResult.subject_id,
    expected_state_revision: freshResult.state_revision,
    mutation: {
      kind: "UPDATE",
      proposition_id: freshResult.proposition_id,
      next_credence: freshResult.outcome.next_credence
    },
    evidence_binding: freshResult.evidence_binding
  };
  const freshCheck = validateBeliefMutationProposal(freshProposal);
  if (!freshCheck.ok) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "recomputed proposal fails frozen validation: " + freshCheck.error.detail,
      canonical_commits: 0
    };
  }
  const freshId = await deriveBeliefTransitionId(freshCheck.value);
  if (
    freshId !== checkpoint.transition_id ||
    JSON.stringify(freshCheck.value) !== JSON.stringify(checkpoint.proposal)
  ) {
    return {
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      detail: "checkpointed proposal does not re-derive from the recomputed plasticity authority",
      canonical_commits: 0
    };
  }
  return null;
}

async function saveTerminal(
  workflowId: IdentifierV0,
  fingerprint: HashV1,
  store: BeliefAdaptationWorkflowStoreV0,
  terminal: BeliefAdaptationTerminalV0
): Promise<BeliefAdaptationTerminalV0> {
  const saved = await store.saveTerminalResult(workflowId, fingerprint, terminal);
  if (saved === "SAVED") return terminal;
  const existingRaw: unknown = await store.load(workflowId);
  if (
    isRecord(existingRaw) &&
    isRecord(existingRaw["terminal_result"]) &&
    typeof existingRaw["terminal_result"]["kind"] === "string"
  ) {
    return existingRaw["terminal_result"] as unknown as BeliefAdaptationTerminalV0;
  }
  return terminal;
}

/**
 * Commit ordering (§33): exact proposal checkpoint durable → public committed
 * bundle read → exact frozen executor. Executor replay safely returns
 * ALREADY_COMMITTED for the identical transition identity, so no journal
 * backdoor is required.
 */
async function commitOrReconcile(
  deps: BeliefAdaptationWorkflowDepsV0,
  executor: BeliefTransitionExecutor,
  store: BeliefAdaptationWorkflowStoreV0,
  validated: ValidatedRequest,
  checkpoint: BeliefAdaptationProposalCheckpointV0,
  current: SubjectStateV0
): Promise<BeliefAdaptationTerminalV0> {
  const workflowId = validated.request.workflow_id;
  const fingerprint = validated.request_fingerprint;

  // ---- committed-journal reconciliation BEFORE any executor invocation ----------
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

  // ---- frozen executor invocation (the ONLY canonical authority) ----------------
  const ctx: RuntimeContext = {
    subject_id: validated.request.subject_id,
    current_logical_time: current.runtime_metadata.logical_time as LogicalTimeV0,
    state_revision: current.runtime_metadata.state_revision
  };
  let outcome: BeliefExecutionResult;
  try {
    outcome = await executor.execute(ctx, checkpoint.proposal);
  } catch (error) {
    // Ambiguous commit outcome: never write success; the next continuation
    // reconciles the exact checkpointed proposal.
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
  if (outcome.kind === "NO_OP") {
    return saveTerminal(workflowId, fingerprint, store, {
      kind: "COMPLETE_EXECUTOR_NO_OP",
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
    // MAX_STALE_REBUILDS 0: no rebuild inside the same workflow identity.
    return restartTerminal("STALE_STATE_REVISION", outcome.detail);
  }
  if (outcome.kind === "REJECTED_UNKNOWN_PROPOSITION") {
    return restartTerminal("TARGET_PROPOSITION_MISSING", outcome.detail);
  }
  return saveTerminal(workflowId, fingerprint, store, {
    kind: "REJECTED_EXECUTOR",
    code: outcome.kind,
    detail: outcome.detail,
    canonical_commits: 0
  });
}
