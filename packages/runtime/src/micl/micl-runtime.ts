/**
 * P2.4 — MiclRuntime: the first real MINIMAL INTERNAL CONTINUITY LOOP
 * (micl-design.md §5–§8, §31–§33; p2-runtime-plan.md §11 P2.4).
 *
 *   SubjectState(t) → TimeTransition → ObservationTransition
 *     → InternalExperience handoff (refs-only candidate)
 *     → LearningTransition → SubjectState(t+1)
 *
 * Orchestration ONLY — the runtime is NOT a canonical mutator (§16): every
 * stage keeps its own canonical SubjectCore commit boundary via the frozen
 * executors. Workflow failure NEVER rolls back valid canonical history (§31).
 *
 * Admission (§8/§32): micl_id + request fingerprint. Same id + same fingerprint
 * resumes/replays (committed stages are never re-run); same id + different
 * fingerprint returns the separate frozen MICLAdmissionErrorResultV1
 * REJECTED/MICL_ID_REUSE/MICL-RESUME-001 — never a MICLResult status.
 *
 * Boundedness (§19): explicit finite stage progression Time → Observation →
 * Learning with no unbounded retry loop of any kind. Learning keeps its own
 * frozen MAX_AUTOMATIC_REBUILD=1; MICL adds no retry layer (M9 delegates the
 * frozen REBASE_REQUIRED terminal verbatim).
 *
 * LLM independence (§17): fully executable with the deterministic/reference
 * providers; no network LLM anywhere.
 */

import type {
  AtomicCommitBundleV1,
  CanonicalRefV0,
  HashV1,
  LogicalTimeV0,
  MICLAdmissionErrorResultV1,
  MiclStageKey,
  StateRevisionV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { CommitReservedOutcome } from "@characteros-next/subject-core";
import type { RuntimeDependencyContainer } from "../types/runtime-dependency-container.js";
import type { RuntimeContext } from "../types/runtime-context.js";
import { stageFailure, TransitionStageFailure } from "../transitions/common.js";
import { TimeTransitionExecutor } from "../transitions/time/time-transition-executor.js";
import { ObservationTransitionExecutor } from "../transitions/observation/observation-transition-executor.js";
import { LearningTransitionExecutor } from "../transitions/learning/learning-transition-executor.js";
import { deriveLearningTransitionId } from "../transitions/learning/learning-identity.js";
import type { MiclResultV0, MiclStageCheckpointV0, MiclWorkflowRecordV0, MICLRequestV0 } from "./micl-types.js";
import { validateMiclRequest } from "./micl-types.js";
import { deriveMiclRequestFingerprint } from "./micl-identity.js";
import type { MiclWorkflowStore } from "./micl-workflow-store.js";
import {
  createMiclStageMinter,
  miclWorkflowBinding
} from "./micl-capabilities.js";

const MICL_ID_REUSE_RESULT_PROJECTION = "characteros-next/micl/admission-result/v1" as const;

/** MICL run result: the four-status MICLResult OR the separate admission error. */
export type MiclRunResult = MiclResultV0 | MICLAdmissionErrorResultV1;

function isRebaseRequired(
  outcome: unknown
): outcome is { readonly kind: "REBASE_REQUIRED"; readonly failure: { readonly error_code: string } } {
  return (
    typeof outcome === "object" &&
    outcome !== null &&
    (outcome as { kind?: unknown }).kind === "REBASE_REQUIRED"
  );
}

export class MiclRuntime {
  constructor(
    private readonly deps: RuntimeDependencyContainer,
    private readonly workflowStore: MiclWorkflowStore
  ) {}

  async run(request: MICLRequestV0): Promise<MiclRunResult> {
    // ---- admission: closed shape + request fingerprint ---------------------------
    const checked = validateMiclRequest(request);
    if (!checked.ok) {
      throw stageFailure("TIME", checked.error.error_code, checked.error.reason, checked.error.detail);
    }
    const req = checked.value;
    const fingerprint = await deriveMiclRequestFingerprint(req);

    const snapshot0 = await this.deps.subjectCore.readCurrentSnapshot(req.subject_id);
    if (snapshot0 === null) {
      return this.failedResult(req, fingerprint, {
        status: "FAILED_BEFORE_STATE_CHANGE",
        failure_stage: "TIME",
        failure_reason: "UNKNOWN_SUBJECT",
        initial: null
      });
    }
    const record = await this.workflowStore.loadOrCreate({
      micl_id: req.micl_id,
      subject_id: req.subject_id,
      request_fingerprint: fingerprint,
      initial_state_revision: snapshot0.runtime_metadata.state_revision as StateRevisionV0,
      initial_logical_time: snapshot0.runtime_metadata.logical_time as LogicalTimeV0
    });

    // Same micl_id + changed request fingerprint ⇒ separate frozen admission
    // error (MICL_ID_REUSE / MICL-RESUME-001); no transition identity, no
    // audit event, no trace, audit_refs=[] (freeze §7.5/A10.11).
    if (record.request_fingerprint !== fingerprint) {
      const digest = await hashEnvelope(MICL_ID_REUSE_RESULT_PROJECTION, {
        micl_id: req.micl_id,
        stored_request_fingerprint: record.request_fingerprint,
        attempted_request_fingerprint: fingerprint
      });
      const result: MICLAdmissionErrorResultV1 = {
        schema_version: "micl-admission-error-result-v1",
        status: "REJECTED",
        micl_id: req.micl_id,
        subject_id: req.subject_id,
        stored_request_fingerprint: record.request_fingerprint,
        attempted_request_fingerprint: fingerprint,
        error_code: "MICL_ID_REUSE",
        reason: "MICL-RESUME-001",
        audit_refs: [],
        result_ref: `workflow:${digest.replace(/^sha256:/, "")}` as CanonicalRefV0
      };
      return result;
    }

    // Byte-for-byte replay of a fully completed workflow (A10.11 vector a).
    if (record.terminal_result !== null) {
      return record.terminal_result;
    }

    // ==== finite stage progression: TIME → OBSERVATION → LEARNING (§19) =========

    // ---- stage TIME ---------------------------------------------------------------
    let timeCheckpoint = record.stages["TIME"];
    if (timeCheckpoint === undefined) {
      // Crash reconciliation (§32/M2): a lost checkpoint after a durable commit
      // is rebuilt from the prepared record + authoritative bundle — the stage
      // is never re-run once its canonical commit is proven.
      const reconciledTime = await this.reconcileStage(req, fingerprint, "TIME", "Time");
      if (reconciledTime !== null) {
        timeCheckpoint = reconciledTime;
        await this.workflowStore.putStageCheckpoint(req.micl_id, timeCheckpoint);
      }
    }
    if (timeCheckpoint === undefined) {
      const current = await this.deps.subjectCore.readCurrentSnapshot(req.subject_id);
      if (current === null) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "TIME",
          failure_reason: "UNKNOWN_SUBJECT",
          initial: record
        });
      }
      const elapsed =
        (req.observation.occurrence_logical_time as number) -
        (current.runtime_metadata.logical_time as number);
      // §9: out-of-order historical observation is NOT SUPPORTED IN MICL V0 —
      // explicit deferred policy; no time rollback, no pre-proposal identity.
      if (elapsed < 0) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "TIME",
          failure_reason: "OUT_OF_ORDER_OBSERVATION",
          initial: record
        });
      }
      const anchored = anchorOf(current);
      const minter = createMiclStageMinter(
        this.deps.subjectCore,
        this.workflowStore,
        miclWorkflowBinding(req.micl_id, fingerprint, "TIME")
      );
      const stageDeps = { ...this.deps, subjectCore: minter.core() };
      const executor = new TimeTransitionExecutor(stageDeps);
      const capabilities = minter.capabilities(await this.repositoryBindings(current));
      let outcome: CommitReservedOutcome;
      try {
        outcome = await executor.execute(anchored, { elapsed_ticks: elapsed }, capabilities);
      } catch (error) {
        // §33: EVERY Time failure (pre-proposal or post-reservation reject) is
        // FAILED_BEFORE_STATE_CHANGE (no successful commit in this MICL yet).
        return this.failedResult(req, fingerprint, {
          status: "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "TIME",
          failure_reason: stageReason(error, "TIME"),
          initial: record
        });
      }
      const nextTime = checkpointFromOutcome(
        "TIME",
        outcome,
        anchored.subject_id as string,
        anchored.state_revision as number,
        anchored.current_logical_time as number
      );
      if (nextTime === null) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "TIME",
          failure_reason: failureCodeOf(outcome),
          initial: record
        });
      }
      timeCheckpoint = nextTime;
      await this.workflowStore.putStageCheckpoint(req.micl_id, timeCheckpoint);
    }

    // ---- stage OBSERVATION ----------------------------------------------------------
    let observationCheckpoint = record.stages["OBSERVATION"];
    if (observationCheckpoint === undefined) {
      const reconciledObservation = await this.reconcileStage(req, fingerprint, "OBSERVATION", "Observation");
      if (reconciledObservation !== null) {
        observationCheckpoint = reconciledObservation;
        await this.workflowStore.putStageCheckpoint(req.micl_id, observationCheckpoint);
      }
    }
    if (observationCheckpoint === undefined) {
      const current = await this.deps.subjectCore.readCurrentSnapshot(req.subject_id);
      if (current === null) {
        return this.failedResult(req, fingerprint, {
          status: timeCheckpoint.logical_status === "COMMITTED"
            ? "FAILED_AFTER_TIME"
            : "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "OBSERVATION",
          failure_reason: "UNKNOWN_SUBJECT",
          initial: record
        });
      }
      const anchored = anchorOf(current);
      const minter = createMiclStageMinter(
        this.deps.subjectCore,
        this.workflowStore,
        miclWorkflowBinding(req.micl_id, fingerprint, "OBSERVATION")
      );
      const stageDeps = { ...this.deps, subjectCore: minter.core() };
      const executor = new ObservationTransitionExecutor(stageDeps);
      const capabilities = minter.capabilities(await this.repositoryBindings(current));
      let outcome: CommitReservedOutcome;
      try {
        outcome = await executor.execute(anchored, req.observation, capabilities);
      } catch (error) {
        // §33: Observation pre-proposal failure AFTER a committed Time is
        // FAILED_AFTER_TIME; with Time NO_OP (or absent) it stays
        // FAILED_BEFORE_STATE_CHANGE ("no successful commit in this MICL").
        return this.failedResult(req, fingerprint, {
          status: timeCheckpoint.logical_status === "COMMITTED"
            ? "FAILED_AFTER_TIME"
            : "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "OBSERVATION",
          failure_reason: stageReason(error, "OBSERVATION"),
          initial: record
        });
      }
      const nextObservation = checkpointFromOutcome(
        "OBSERVATION",
        outcome,
        anchored.subject_id as string,
        anchored.state_revision as number,
        anchored.current_logical_time as number
      );
      if (nextObservation === null) {
        return this.failedResult(req, fingerprint, {
          status: timeCheckpoint.logical_status === "COMMITTED"
            ? "FAILED_AFTER_TIME"
            : "FAILED_BEFORE_STATE_CHANGE",
          failure_stage: "OBSERVATION",
          failure_reason: failureCodeOf(outcome),
          initial: record
        });
      }
      observationCheckpoint = nextObservation;
      await this.workflowStore.putStageCheckpoint(req.micl_id, observationCheckpoint);
    }

    // ---- stage LEARNING (InternalExperience handoff) --------------------------------
    let learningCheckpoint = record.stages["LEARNING"];
    if (learningCheckpoint === undefined) {
      const reconciledLearning = await this.reconcileStage(req, fingerprint, "LEARNING", "Learning");
      if (reconciledLearning !== null) {
        learningCheckpoint = reconciledLearning;
        await this.workflowStore.putStageCheckpoint(req.micl_id, learningCheckpoint);
      }
    }
    if (learningCheckpoint === undefined) {
      const current = await this.deps.subjectCore.readCurrentSnapshot(req.subject_id);
      if (current === null || observationCheckpoint.result_ref === null) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_AFTER_OBSERVATION",
          failure_stage: "LEARNING",
          failure_reason: "INVALID_STAGE_DEPENDENCY",
          initial: record
        });
      }
      const anchored = anchorOf(current);
      const candidate = await this.buildInternalExperienceHandoff(
        observationCheckpoint.transition_id,
        req
      );
      if (candidate === null) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_AFTER_OBSERVATION",
          failure_stage: "LEARNING",
          failure_reason: "INVALID_STAGE_DEPENDENCY",
          initial: record
        });
      }
      // Durable stage-prepared marker BEFORE the executor runs (§32/M6): the
      // frozen Learning executor owns its prepared record inline, so the
      // workflow ledger records its deterministic identity for crash
      // reconciliation (rebuilt from the authoritative bundle, never re-run).
      const learningTransitionId = await deriveLearningTransitionId(
        {
          subject_id: req.subject_id,
          source_transition_id: observationCheckpoint.transition_id as unknown as Parameters<
            typeof deriveLearningTransitionId
          >[0]["source_transition_id"]
        },
        { expected_state_revision: anchored.state_revision as number, rebuild_ordinal: 0 }
      );
      await this.workflowStore.putStagePreparedMarker(
        miclWorkflowBinding(req.micl_id, fingerprint, "LEARNING"),
        {
          transition_id: learningTransitionId,
          prepared_result_ref: `workflow:w-learn-${learningTransitionId.replace("t-learn-", "")}`
        }
      );
      const executor = new LearningTransitionExecutor(this.deps);
      // Learning owns its frozen A12/A13 semantics internally (§13): MICL adds
      // no retry layer and maps the outcomes verbatim below.
      let outcome: Awaited<ReturnType<LearningTransitionExecutor["execute"]>>;
      try {
        outcome = await executor.execute(anchored, { candidate: candidate as never });
      } catch (error) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_AFTER_OBSERVATION",
          failure_stage: "LEARNING",
          failure_reason: stageReason(error, "LEARNING"),
          initial: record
        });
      }
      if (isRebaseRequired(outcome)) {
        // §13: the ONLY failure_reason literal REBASE_REQUIRED — no automatic
        // restart of Time/Observation, no MICL-level retry.
        return this.failedResult(req, fingerprint, {
          status: "FAILED_AFTER_OBSERVATION",
          failure_stage: "LEARNING",
          failure_reason: "REBASE_REQUIRED",
          initial: record
        });
      }
      const nextLearning = checkpointFromOutcome(
        "LEARNING",
        outcome as CommitReservedOutcome,
        anchored.subject_id as string,
        anchored.state_revision as number,
        anchored.current_logical_time as number
      );
      if (nextLearning === null) {
        return this.failedResult(req, fingerprint, {
          status: "FAILED_AFTER_OBSERVATION",
          failure_stage: "LEARNING",
          failure_reason: failureCodeOf(outcome as CommitReservedOutcome),
          initial: record
        });
      }
      learningCheckpoint = nextLearning;
      await this.workflowStore.putStageCheckpoint(req.micl_id, learningCheckpoint);
    }

    // ---- terminal: all three stages have authoritative checkpoints ------------------
    const stageViews = {
      time: timeCheckpoint,
      observation: observationCheckpoint,
      learning: learningCheckpoint
    };
    const result = this.completedResult(req, record, stageViews);
    await this.workflowStore.putTerminalResult(req.micl_id, result);
    return result;
  }

  /**
   * §32/M6 reconciliation: rebuild an exact committed stage checkpoint from the
   * durable prepared record + the authoritative committed bundle, without
   * re-running the committed stage. null = stage never durably prepared.
   */
  private async reconcileStage(
    request: MICLRequestV0,
    fingerprint: HashV1,
    stage: MiclStageKey,
    expectedType: "Time" | "Observation" | "Learning"
  ): Promise<MiclStageCheckpointV0 | null> {
    const sourceAuthority = this.deps.learningSourceAuthority;
    if (sourceAuthority === null) return null;
    const prepared = await this.workflowStore.findPreparedRecord(
      miclWorkflowBinding(request.micl_id, fingerprint, stage)
    );
    if (prepared === null) return null;
    const bundle = await sourceAuthority.readCommittedBundle(prepared.transition_id);
    if (bundle === null || bundle.subject_id !== request.subject_id) return null;
    if (bundle.transition_type !== expectedType) return null;
    return checkpointFromBundle(stage, bundle);
  }

  /**
   * §9/§25 — InternalExperience handoff: construct the EXACT refs-only Learning
   * candidate from authoritative committed Observation evidence (the committed
   * bundle), never from caller assertions. No runtime trust capability is
   * persisted or reconstructed — the Learning executor re-runs its own durable
   * trusted-source validation (§9 of the task; P2.3.5 trust boundary intact).
   */
  private async buildInternalExperienceHandoff(
    observationTransitionId: string,
    request: MICLRequestV0
  ): Promise<Record<string, unknown> | null> {
    const sourceAuthority = this.deps.learningSourceAuthority;
    if (sourceAuthority === null) return null;
    const bundle = await sourceAuthority.readCommittedBundle(observationTransitionId);
    if (bundle === null) return null;
    if (bundle.subject_id !== request.subject_id) return null;
    const observationRef = bundle.trace_entry.cause_refs.find((ref) =>
      ref.startsWith("observation:")
    );
    if (observationRef === undefined) return null;
    const committed = bundle.next_snapshot;
    const appraisalRefs = committed.affect.active_channels
      .map((channel) => channel.source_appraisal_ref)
      .sort();
    return {
      subject_id: bundle.subject_id,
      source_transition_id: bundle.transition_id,
      observation_ref: observationRef,
      entity_refs: [...request.observation.entity_refs],
      event_refs: request.observation.source_refs
        .filter((ref) => ref.startsWith("event:"))
        .sort(),
      occurrence_logical_time: bundle.logical_time_after,
      appraisal_ref: appraisalRefs.length > 0 ? appraisalRefs[0] : null,
      scene: committed.context.scene,
      focus_refs: [...committed.context.focus_refs],
      environment_refs: [...committed.context.environment_refs],
      declared_salience: request.declared_salience
    };
  }

  /** Current-revision repository binding proof (verdict-only via the repository). */
  private async repositoryBindings(
    snapshot: SubjectStateV0
  ): Promise<ReadonlyArray<{ repository_revision: string; repository_revision_hash: string }>> {
    const repository = this.deps.memory.repository;
    const revision = snapshot.memory_state.repository_revision as string;
    const manifest = await repository.readManifest(revision as never);
    if (manifest === null) {
      throw stageFailure(
        "TIME",
        "SERVICE_UNAVAILABLE",
        "FAIL-PREPARE-001",
        `repository cannot prove a manifest for revision ${revision} (genesis R0 is a host duty)`
      );
    }
    return [
      {
        repository_revision: revision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ];
  }

  private completedResult(
    request: MICLRequestV0,
    record: MiclWorkflowRecordV0,
    stages: {
      readonly time: MiclStageCheckpointV0;
      readonly observation: MiclStageCheckpointV0;
      readonly learning: MiclStageCheckpointV0;
    }
  ): MiclResultV0 {
    const lastCommitted = [stages.time, stages.observation, stages.learning]
      .filter((c) => c.logical_status === "COMMITTED")
      .at(-1);
    return {
      micl_id: request.micl_id,
      status: "COMPLETED",
      initial_state_revision: record.initial_state_revision,
      final_state_revision: (lastCommitted?.next_revision ?? record.initial_state_revision) as StateRevisionV0,
      initial_logical_time: record.initial_logical_time,
      final_logical_time: stages.learning.logical_time_after,
      time_transition_ref: stages.time.transition_id,
      observation_transition_ref: stages.observation.transition_id,
      learning_transition_ref: stages.learning.transition_id,
      retrieval_result_ref: null,
      interpretation_result_ref: null,
      appraisal_result_ref: null,
      internal_experience_ref: null,
      final_state_hash: lastCommitted?.snapshot_hash_after ?? null,
      failure_stage: null,
      failure_reason: null,
      audit_refs: []
    };
  }

  private async failedResult(
    request: MICLRequestV0,
    fingerprint: HashV1,
    params: {
      readonly status: "FAILED_BEFORE_STATE_CHANGE" | "FAILED_AFTER_TIME" | "FAILED_AFTER_OBSERVATION";
      readonly failure_stage: MiclStageKey;
      readonly failure_reason: string;
      readonly initial: MiclWorkflowRecordLike | null;
    }
  ): Promise<MiclResultV0> {
    void fingerprint;
    // Re-read the FRESH durable record: stage checkpoints written by this run
    // must be reflected in the partial-completion accounting (never a stale view).
    let record: MiclWorkflowRecordLike | null = params.initial;
    if (record !== null) {
      const fresh = await this.workflowStore.loadOrCreate({
        micl_id: request.micl_id,
        subject_id: request.subject_id,
        request_fingerprint: fingerprint,
        initial_state_revision: record.initial_state_revision,
        initial_logical_time: record.initial_logical_time
      });
      record = fresh;
    }
    const lastCommitted = (record?.stages ?? {})
      ? Object.values(record?.stages ?? {})
          .filter((c): c is MiclStageCheckpointV0 => c !== undefined && c.logical_status === "COMMITTED")
          .at(-1) ?? null
      : null;
    return {
      micl_id: request.micl_id,
      status: params.status,
      initial_state_revision: record?.initial_state_revision ?? null,
      final_state_revision: (lastCommitted?.next_revision ?? record?.initial_state_revision ?? null) as StateRevisionV0 | null,
      initial_logical_time: record?.initial_logical_time ?? null,
      final_logical_time: lastCommitted?.logical_time_after ?? record?.initial_logical_time ?? null,
      time_transition_ref: record?.stages["TIME"]?.transition_id ?? null,
      observation_transition_ref: record?.stages["OBSERVATION"]?.transition_id ?? null,
      learning_transition_ref: record?.stages["LEARNING"]?.transition_id ?? null,
      retrieval_result_ref: null,
      interpretation_result_ref: null,
      appraisal_result_ref: null,
      internal_experience_ref: null,
      final_state_hash: lastCommitted?.snapshot_hash_after ?? null,
      failure_stage: params.failure_stage,
      failure_reason: params.failure_reason,
      audit_refs: []
    };
  }
}

interface MiclWorkflowRecordLike {
  readonly initial_state_revision: StateRevisionV0;
  readonly initial_logical_time: LogicalTimeV0;
  readonly stages: Readonly<Partial<Record<MiclStageKey, MiclStageCheckpointV0>>>;
}

function anchorOf(snapshot: SubjectStateV0): RuntimeContext {
  return {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  } as unknown as RuntimeContext;
}

/** §33 — stable failure reason from a typed stage failure or any throw. */
function stageReason(error: unknown, fallbackStage: MiclStageKey): string {
  if (error instanceof TransitionStageFailure) return error.error_code as string;
  void fallbackStage;
  return "FAIL-SERVICE-001";
}

/** Frozen failure code from a rejected/aborted outcome; fail-closed default. */
function failureCodeOf(outcome: CommitReservedOutcome): string {
  if (outcome.kind === "REJECTED" || outcome.kind === "ABORTED") {
    return outcome.failure.error_code as string;
  }
  return "FAIL-PRECOMMIT-001";
}

/** Checkpoint from a terminal logical outcome; null = nothing to checkpoint. */
function checkpointFromBundle(stage: MiclStageKey, bundle: AtomicCommitBundleV1): MiclStageCheckpointV0 {
  return {
    stage_key: stage,
    transition_id: bundle.transition_id,
    logical_status: "COMMITTED",
    next_revision: bundle.next_revision as StateRevisionV0,
    logical_time_after: bundle.logical_time_after as LogicalTimeV0,
    snapshot_hash_after: bundle.canonical_result.snapshot_hash_after,
    result_ref: bundle.canonical_result.result_ref,
    trace_ref: bundle.canonical_result.trace_ref
  };
}

function checkpointFromOutcome(
  stage: MiclStageKey,
  outcome: CommitReservedOutcome,
  subjectId: string,
  anchoredRevision: number,
  anchoredLogicalTime: number
): MiclStageCheckpointV0 | null {
  if (outcome.kind === "COMMITTED") {
    return checkpointFromBundle(stage, outcome.bundle);
  }
  if (outcome.kind === "NO_OP") {
    // Durable Time NO_OP (elapsed=0): no canonical mutation; identity is the
    // deterministic zero-elapsed Time proposal id for the anchored revision.
    return {
      stage_key: stage,
      // Deterministic zero-elapsed Time proposal id (timeTransitionId shape):
      // `t-time-<subject>-r<revision>-e0`.
      transition_id: `t-time-${subjectId}-r${anchoredRevision}-e0`,
      logical_status: "NO_OP",
      next_revision: null,
      logical_time_after: anchoredLogicalTime as LogicalTimeV0,
      snapshot_hash_after: null,
      result_ref: null,
      trace_ref: null
    };
  }
  return null;
}
