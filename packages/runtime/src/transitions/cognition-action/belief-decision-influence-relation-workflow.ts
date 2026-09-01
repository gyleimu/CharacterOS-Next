/**
 * Belief Decision Influence Relation Foundation V0 — minimal create-once
 * provider-outcome workflow for replay safety (frozen architecture §27-§39).
 *
 * Responsibilities ONLY: create-once provider outcome receipt + safe
 * replay/remint/reprojection. NO final action, NO canonical commit, NO MICL
 * transition, NO SubjectCore revision.
 *
 * IDENTITY: caller-supplied stable workflow_id (idempotency key; never a
 * UUID/wall clock) + deterministic JCS request fingerprint over the semantic
 * anchors (request schema, subject, state revision, logical time,
 * projection_hash, action_space_fingerprint). workflow_id, provider identity
 * and wall clock NEVER enter the request fingerprint. A different fingerprint
 * under the same workflow_id is REUSE_CONFLICT — no provider call, no
 * overwrite, no rebase, no repair.
 *
 * NONDETERMINISM BOUNDARY: at most ONE external provider call per workflow
 * identity (atomically claimed). The durable outcome is a stable ACCEPTED
 * payload (normalized proposal + accepted fingerprint) or a stable REJECTED
 * payload; the DecisionInfluenceProjectionV0 itself is NEVER persisted —
 * replay recomputes it through the private revalidation/remint path with ZERO
 * provider recall. A claimed-but-outcome-unknown record is fail-closed
 * PROVIDER_OUTCOME_UNKNOWN (no recall, no retry, no automatic continuation).
 *
 * Workflow records are INFRASTRUCTURE state only: every durable write carries
 * the exact record checkpoint fingerprint, recomputed and verified on load.
 */

import type { HashV1, IdentifierV0, LogicalTimeV0, StateRevisionV0 } from "@characteros-next/subject-core";
import {
  hashEnvelope,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision
} from "@characteros-next/subject-core";

import type { CognitionRelationProviderV1 } from "../../ports/cognition-relation-port.js";
import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import {
  CognitionRelationRejectionErrorV1,
  type CognitionProposalV1
} from "./cognition-proposal-v1.js";
import {
  admitCognitionRelationProviderPayloadV1,
  prepareCognitionRelationAdmissionV1,
  produceBeliefDecisionInfluenceRelationProjectionV0,
  replayAcceptedCognitionProposalV1,
  type DecisionInfluenceProjectionV0
} from "./belief-decision-influence-relation.js";
import type { AcceptedCognitionProposalV1 } from "./cognition-proposal-v1.js";

export const BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_SCHEMA_VERSION =
  "belief-decision-influence-relation-request-v0" as const;
export const BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION =
  "belief-decision-influence-relation-workflow-record-v0" as const;
export const BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION =
  "belief-decision-influence-relation-provider-outcome-v0" as const;

/** Fingerprint namespace literals EXACT (single literal, no line break). */
export const BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-influence-relation-request/v1" as const;
export const BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-influence-relation-workflow-checkpoint/v1" as const;

/**
 * Bounded event-loop yields while a concurrent writer holds the claim. Each
 * yield hands one macrotask turn to the event loop so an in-flight writer
 * (resolving async crypto/store work) can checkpoint its outcome. Bounded
 * count keeps the wait deterministic — NOT a sleep as correctness authority:
 * under ANY scheduling the waiter either observes the stable record or fails
 * closed PROVIDER_OUTCOME_UNKNOWN after the bound.
 */
const MAX_OUTCOME_WAIT_YIELDS = 512 as const;

function yieldEventLoopTurn(): Promise<void> {
  return new Promise<void>((resolve) => {
    // setImmediate (Node) hands over the event loop without timer clamping;
    // setTimeout(0) is the portable fallback. Neither is a correctness
    // authority — the bounded yield count is.
    const immediate = (globalThis as { setImmediate?: (callback: () => void) => void }).setImmediate;
    if (typeof immediate === "function") {
      immediate(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Exact closed durable stage set; there is NO hidden fourth complete stage. */
export type BeliefDecisionInfluenceRelationStageV0 =
  | "R1_PROVIDER_READY"
  | "R2_PROVIDER_CLAIMED"
  | "R3_PROVIDER_OUTCOME_CHECKPOINTED";

/**
 * Stable durable provider outcome: either the normalized ACCEPTED payload
 * (proposal + accepted fingerprint — capability NEVER serialized) or a stable
 * REJECTED classification. Replay replays these byte-stable payloads.
 */
export type BeliefDecisionInfluenceRelationProviderOutcomeV0 =
  | {
      readonly schema_version: typeof BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION;
      readonly kind: "ACCEPTED";
      readonly proposal: CognitionProposalV1;
      readonly accepted_proposal_fingerprint: HashV1;
    }
  | {
      readonly schema_version: typeof BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION;
      readonly kind: "REJECTED";
      readonly code: string;
      readonly detail: string;
    };

/** The ONE closed/versioned durable workflow record (infrastructure state only). */
export interface BeliefDecisionInfluenceRelationWorkflowRecordV0 {
  readonly schema_version: typeof BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION;
  readonly workflow_id: IdentifierV0;
  readonly request_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly stage: BeliefDecisionInfluenceRelationStageV0;
  /** Create-once external claim: 0 → 1 exactly once per workflow identity. */
  readonly external_provider_call_count: 0 | 1;
  readonly provider_outcome: BeliefDecisionInfluenceRelationProviderOutcomeV0 | null;
  readonly checkpoint_fingerprint: HashV1;
}

/** Caller-supplied workflow request (workflow_id = idempotency identity). */
export interface BeliefDecisionInfluenceRelationRequestV0 {
  readonly workflow_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection: CognitiveContextProjectionV0;
  readonly allowed_actions: readonly AllowedActionV0[];
}

/**
 * Narrow linearizable store port. Production hosts supply a durable
 * implementation; a test-only in-memory store stays inside test code.
 */
export interface BeliefDecisionInfluenceRelationWorkflowStoreV0 {
  load(
    workflowId: IdentifierV0
  ): Promise<BeliefDecisionInfluenceRelationWorkflowRecordV0 | null>;

  /** Create-if-absent; returns the pre-existing record's status when present. */
  createIfAbsent(
    record: BeliefDecisionInfluenceRelationWorkflowRecordV0
  ): Promise<"CREATED" | "EXISTING">;

  /** Atomic create-once claim: 0 → 1 provider call exactly once per identity. */
  claimProviderCall(
    workflowId: IdentifierV0,
    requestFingerprint: HashV1
  ): Promise<"CLAIMED" | "ALREADY_CLAIMED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT">;

  /** Terminal create-once outcome checkpoint (R3). */
  saveProviderOutcome(
    workflowId: IdentifierV0,
    requestFingerprint: HashV1,
    outcome: BeliefDecisionInfluenceRelationProviderOutcomeV0
  ): Promise<"SAVED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT" | "OUTCOME_CONFLICT">;
}

export interface BeliefDecisionInfluenceRelationWorkflowDepsV0 {
  readonly store: BeliefDecisionInfluenceRelationWorkflowStoreV0;
  readonly provider: CognitionRelationProviderV1;
}

/** Closed terminal workflow result (fail-closed; deterministic first failure). */
export type BeliefDecisionInfluenceRelationWorkflowResultV0 =
  | {
      readonly kind: "ACCEPTED";
      readonly projection: DecisionInfluenceProjectionV0;
      readonly accepted: AcceptedCognitionProposalV1;
      readonly provider_calls: 0 | 1;
      readonly replayed: boolean;
    }
  | {
      readonly kind: "PROVIDER_REJECTED";
      readonly code: string;
      readonly detail: string;
      readonly provider_calls: 0 | 1;
      readonly replayed: boolean;
    }
  | {
      readonly kind: "FAILED";
      readonly code:
        | "INVALID_ACTION_SPACE"
        | "BOUND_CONTEXT_MISMATCH"
        | "REUSE_CONFLICT"
        | "PROVIDER_OUTCOME_UNKNOWN";
      readonly detail: string;
      readonly provider_calls: 0 | 1;
    };

/**
 * Deterministic request fingerprint over the semantic anchors ONLY — never
 * workflow_id, provider identity or wall clock.
 */
export async function deriveBeliefDecisionInfluenceRelationRequestFingerprintV0(args: {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
}): Promise<HashV1> {
  return hashEnvelope(BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_FINGERPRINT_PROJECTION, {
    schema_version: BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_SCHEMA_VERSION,
    subject_id: args.subject_id,
    state_revision: args.state_revision,
    current_logical_time: args.current_logical_time,
    projection_hash: args.projection_hash,
    action_space_fingerprint: args.action_space_fingerprint
  });
}

/** Checkpoint fingerprint binds the full record EXCLUDING checkpoint_fingerprint. */
export async function deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(
  record: Omit<BeliefDecisionInfluenceRelationWorkflowRecordV0, "checkpoint_fingerprint">
): Promise<HashV1> {
  return hashEnvelope(BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION, {
    schema_version: record.schema_version,
    workflow_id: record.workflow_id,
    request_fingerprint: record.request_fingerprint,
    subject_id: record.subject_id,
    state_revision: record.state_revision,
    current_logical_time: record.current_logical_time,
    projection_hash: record.projection_hash,
    action_space_fingerprint: record.action_space_fingerprint,
    stage: record.stage,
    external_provider_call_count: record.external_provider_call_count,
    provider_outcome: record.provider_outcome
  });
}

/** Load-time tamper gate: recompute and compare the checkpoint fingerprint. */
async function verifyRecordCheckpoint(
  record: BeliefDecisionInfluenceRelationWorkflowRecordV0
): Promise<void> {
  const recomputed = await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(record);
  if (recomputed !== record.checkpoint_fingerprint) {
    throw new Error(
      `belief decision influence relation workflow: record ${record.workflow_id} checkpoint fingerprint mismatch (tampered or corrupted)`
    );
  }
}

/**
 * The frozen minimal create-once provider-outcome workflow
 * (runBeliefDecisionInfluenceRelationWorkflowV0). Deterministic pre-provider
 * order: request shape → projection integrity/binding → action space →
 * canonical sort → fingerprints → create/load → reuse-conflict check → atomic
 * claim → frozen input → provider call maximum once. Replay performs ZERO
 * provider calls.
 */
export async function runBeliefDecisionInfluenceRelationWorkflowV0(
  request: BeliefDecisionInfluenceRelationRequestV0,
  deps: BeliefDecisionInfluenceRelationWorkflowDepsV0
): Promise<BeliefDecisionInfluenceRelationWorkflowResultV0> {
  // ---- step 1: workflow/request closed shape / IDs -----------------------------
  const workflowIdCheck = validateIdentifier(request.workflow_id, "request.workflow_id");
  if (!workflowIdCheck.ok) {
    throw new Error(`belief decision influence relation workflow: ${workflowIdCheck.error.detail}`);
  }
  const workflowId = workflowIdCheck.value;
  const subjectIdCheck = validateIdentifier(request.subject_id, "request.subject_id");
  if (!subjectIdCheck.ok) {
    throw new Error(`belief decision influence relation workflow: ${subjectIdCheck.error.detail}`);
  }
  const revisionCheck = validateStateRevision(request.state_revision, "request.state_revision");
  if (!revisionCheck.ok) {
    throw new Error(`belief decision influence relation workflow: ${revisionCheck.error.detail}`);
  }
  const timeCheck = validateLogicalTime(request.current_logical_time, "request.current_logical_time");
  if (!timeCheck.ok) {
    throw new Error(`belief decision influence relation workflow: ${timeCheck.error.detail}`);
  }
  if (!Array.isArray(request.allowed_actions)) {
    throw new Error("belief decision influence relation workflow: request.allowed_actions: expected array");
  }

  // ---- steps 2-11 + 15: admission preparation (integrity/binding/action space/
  // canonical sort/fingerprints/deep-frozen provider input) ----------------------
  let prepared: Awaited<ReturnType<typeof prepareCognitionRelationAdmissionV1>>;
  try {
    prepared = await prepareCognitionRelationAdmissionV1(request);
  } catch (error) {
    if (error instanceof CognitionRelationRejectionErrorV1) {
      return {
        kind: "FAILED",
        code: error.code as "INVALID_ACTION_SPACE" | "BOUND_CONTEXT_MISMATCH",
        detail: error.message,
        provider_calls: 0
      };
    }
    throw error;
  }
  const binding = prepared.binding;

  const requestFingerprint = await deriveBeliefDecisionInfluenceRelationRequestFingerprintV0({
    subject_id: request.subject_id,
    state_revision: request.state_revision,
    current_logical_time: request.current_logical_time,
    projection_hash: binding.projection_hash,
    action_space_fingerprint: binding.action_space_fingerprint
  });

  // ---- step 12: linearizable create/load ---------------------------------------
  let record = await deps.store.load(workflowId);
  if (record === null) {
    const base = {
      schema_version: BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION,
      workflow_id: workflowId,
      request_fingerprint: requestFingerprint,
      subject_id: request.subject_id,
      state_revision: request.state_revision,
      current_logical_time: request.current_logical_time,
      projection_hash: binding.projection_hash,
      action_space_fingerprint: binding.action_space_fingerprint,
      stage: "R1_PROVIDER_READY" as const,
      external_provider_call_count: 0 as const,
      provider_outcome: null
    };
    const initial: BeliefDecisionInfluenceRelationWorkflowRecordV0 = {
      ...base,
      checkpoint_fingerprint:
        await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base)
    };
    await deps.store.createIfAbsent(initial);
    // Re-read after the create race: the concurrent creator's record wins.
    record = await deps.store.load(workflowId);
    if (record === null) {
      throw new Error(
        "belief decision influence relation workflow: store corruption — record vanished after createIfAbsent"
      );
    }
  }

  // ---- step 13: reuse-conflict check + tamper gate ------------------------------
  await verifyRecordCheckpoint(record);
  if (record.request_fingerprint !== requestFingerprint) {
    return {
      kind: "FAILED",
      code: "REUSE_CONFLICT",
      detail:
        "workflow_id reused with a different request fingerprint — no provider call, no overwrite, no rebase, no repair",
      provider_calls: 0
    };
  }

  // ---- step 14: atomic provider claim -------------------------------------------
  if (record.stage === "R1_PROVIDER_READY") {
    const claim = await deps.store.claimProviderCall(workflowId, requestFingerprint);
    if (claim === "CLAIMED") {
      // ---- steps 15-16 + post-provider order + checkpoint -----------------------
      return runClaimedProviderOnce({
        store: deps.store,
        provider: deps.provider,
        workflowId,
        requestFingerprint,
        request,
        prepared
      });
    }
    if (claim === "NOT_FOUND" || claim === "FINGERPRINT_CONFLICT") {
      throw new Error(
        `belief decision influence relation workflow: store claim failure (${claim})`
      );
    }
    // ALREADY_CLAIMED: a concurrent invocation won the claim — re-read and replay.
    const reread = await deps.store.load(workflowId);
    if (reread === null) {
      throw new Error(
        "belief decision influence relation workflow: store corruption — record vanished after claim"
      );
    }
    record = reread;
  }

  // ---- claimed/checkpointed: replay with ZERO provider calls ---------------------
  if (record.stage === "R2_PROVIDER_CLAIMED") {
    // Bounded deterministic wait for an in-flight concurrent writer; a crashed
    // claim with no durable outcome is fail-closed PROVIDER_OUTCOME_UNKNOWN.
    let waited = 0;
    while (record.provider_outcome === null && waited < MAX_OUTCOME_WAIT_YIELDS) {
      await yieldEventLoopTurn();
      const next = await deps.store.load(workflowId);
      if (next === null) {
        throw new Error(
          "belief decision influence relation workflow: store corruption — record vanished while waiting"
        );
      }
      record = next;
      waited += 1;
    }
    if (record.provider_outcome === null) {
      return {
        kind: "FAILED",
        code: "PROVIDER_OUTCOME_UNKNOWN",
        detail:
          "provider call claimed but no durable outcome checkpointed — fail closed; no recall, no retry, no automatic continuation",
        provider_calls: 0
      };
    }
  }

  return replayDurableOutcome({ record, request, prepared });
}

/** Steps 15-24 for the sole claim holder: provider once → checkpoint → project. */
async function runClaimedProviderOnce(args: {
  readonly store: BeliefDecisionInfluenceRelationWorkflowStoreV0;
  readonly provider: CognitionRelationProviderV1;
  readonly workflowId: IdentifierV0;
  readonly requestFingerprint: HashV1;
  readonly request: BeliefDecisionInfluenceRelationRequestV0;
  readonly prepared: Awaited<ReturnType<typeof prepareCognitionRelationAdmissionV1>>;
}): Promise<BeliefDecisionInfluenceRelationWorkflowResultV0> {
  const { store, provider, workflowId, requestFingerprint, request, prepared } = args;

  let outcome: BeliefDecisionInfluenceRelationProviderOutcomeV0;
  let accepted: AcceptedCognitionProposalV1 | null = null;
  try {
    // The ONE external provider call for this workflow identity.
    const raw = await provider.propose(prepared.provider_input);
    try {
      accepted = await admitCognitionRelationProviderPayloadV1({
        binding: prepared.binding,
        projection: request.projection,
        canonical_actions: prepared.canonical_actions,
        raw_payload: raw
      });
      outcome = {
        schema_version: BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION,
        kind: "ACCEPTED",
        proposal: accepted.proposal,
        accepted_proposal_fingerprint: accepted.accepted_proposal_fingerprint
      };
    } catch (error) {
      outcome = toRejectedOutcome(error);
    }
  } catch (error) {
    // Transport/provider failure after claim: stable rejection, no retry/repair.
    outcome = toRejectedOutcome(error);
  }

  const save = await store.saveProviderOutcome(workflowId, requestFingerprint, outcome);
  if (save !== "SAVED") {
    throw new Error(`belief decision influence relation workflow: outcome save failure (${save})`);
  }

  if (outcome.kind === "REJECTED" || accepted === null) {
    const rejected = outcome as Extract<
      BeliefDecisionInfluenceRelationProviderOutcomeV0,
      { kind: "REJECTED" }
    >;
    return {
      kind: "PROVIDER_REJECTED",
      code: rejected.code,
      detail: rejected.detail,
      provider_calls: 1,
      replayed: false
    };
  }
  const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(
    accepted,
    prepared.binding
  );
  return { kind: "ACCEPTED", projection, accepted, provider_calls: 1, replayed: false };
}

function toRejectedOutcome(error: unknown): BeliefDecisionInfluenceRelationProviderOutcomeV0 {
  if (error instanceof CognitionRelationRejectionErrorV1) {
    return {
      schema_version: BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION,
      kind: "REJECTED",
      code: error.code,
      detail: error.message
    };
  }
  return {
    schema_version: BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION,
    kind: "REJECTED",
    code: "PROVIDER_REJECTED",
    detail: `provider failure: ${(error as Error).message}`
  };
}

/** Zero-provider-call replay of a durable outcome (revalidate/remint/reproject). */
async function replayDurableOutcome(args: {
  readonly record: BeliefDecisionInfluenceRelationWorkflowRecordV0;
  readonly request: BeliefDecisionInfluenceRelationRequestV0;
  readonly prepared: Awaited<ReturnType<typeof prepareCognitionRelationAdmissionV1>>;
}): Promise<BeliefDecisionInfluenceRelationWorkflowResultV0> {
  const { record, request, prepared } = args;
  const outcome = record.provider_outcome;
  if (outcome === null) {
    throw new Error(
      "belief decision influence relation workflow: checkpointed record with null outcome (corruption)"
    );
  }
  if (outcome.kind === "REJECTED") {
    return {
      kind: "PROVIDER_REJECTED",
      code: outcome.code,
      detail: outcome.detail,
      provider_calls: 0,
      replayed: true
    };
  }
  try {
    // Revalidate the CURRENT bound projection/action universe, reconstruct the
    // normalized accepted proposal, recompute the accepted fingerprint, remint
    // the process-local capability — then recompute the projection.
    const accepted = await replayAcceptedCognitionProposalV1({
      stored_proposal: outcome.proposal,
      stored_accepted_proposal_fingerprint: outcome.accepted_proposal_fingerprint,
      binding: prepared.binding,
      projection: request.projection,
      canonical_actions: prepared.canonical_actions
    });
    const projection = await produceBeliefDecisionInfluenceRelationProjectionV0(
      accepted,
      prepared.binding
    );
    return { kind: "ACCEPTED", projection, accepted, provider_calls: 0, replayed: true };
  } catch (error) {
    if (error instanceof CognitionRelationRejectionErrorV1) {
      return {
        kind: "PROVIDER_REJECTED",
        code: error.code,
        detail: error.message,
        provider_calls: 0,
        replayed: true
      };
    }
    throw error;
  }
}
