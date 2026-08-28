/**
 * P2-next — OutcomeReintegrationRunnerV0 (task §3/§12/§14–§18).
 *
 * Closes the first factual experience loop WITHOUT granting external execution
 * any canonical authority:
 *
 *   authoritative OutcomeV0 (read back from the execution ledger)
 *     → OutcomeObservationAdapterV0
 *       → frozen ObservationTransitionExecutor  (canonical commit #1)
 *         → refs-only Learning handoff
 *           → frozen LearningTransitionExecutor (canonical commit #2; trusted
 *             source revalidation + A12/A13 fully intact)
 *
 * Outcome authority: outcomes are consumed ONLY from the ActionExecutionLedgerV0.
 * A caller-declared outcome that differs from the recorded one fails closed
 * (altered factual record); an unknown execution_id is rejected (no fabricated
 * facts). The runner holds NO canonical write authority.
 *
 * Replay/idempotency (reintegration ledger, same pattern as the MICL store):
 *   R1 crash before Observation commit   → clean retry
 *   R2 crash after Observation commit    → resume Learning only
 *   R3 crash during Learning prepare     → A12 idempotent prepare on retry
 *   R4 crash after Learning commit       → reconciled from prepared marker +
 *                                          authoritative bundle, +0
 *   R5 fully completed replay            → terminal checkpoint, +0 everything
 */

import type {
  AtomicCommitBundleV1,
  HashV1,
  MiclStageKey,
  StateRevisionV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import type { RuntimeDependencyContainer } from "../types/runtime-dependency-container.js";
import type { RuntimeContext } from "../types/runtime-context.js";
import { stageFailure, TransitionStageFailure } from "../transitions/common.js";
import { ObservationTransitionExecutor } from "../transitions/observation/observation-transition-executor.js";
import { LearningTransitionExecutor } from "../transitions/learning/learning-transition-executor.js";
import { deriveLearningTransitionId } from "../transitions/learning/learning-identity.js";
import { createMiclStageMinter, miclWorkflowBinding } from "../micl/micl-capabilities.js";
import type { MiclWorkflowStore } from "../micl/micl-workflow-store.js";
import type { MiclStageCheckpointV0 } from "../micl/micl-types.js";
import type { ActionExecutionLedgerV0 } from "./action-executor-port.js";
import type { ActionOutcomeV0 } from "./types.js";
import { adaptOutcomeToObservation } from "./outcome-observation-adapter.js";

const OUTCOME_FINGERPRINT_PROJECTION =
  "characteros-next/actions/outcome-fingerprint/v1" as const;

function anchorOf(snapshot: SubjectStateV0): RuntimeContext {
  return {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  } as unknown as RuntimeContext;
}

/** Observable terminal results of one reintegration attempt. */
export type OutcomeReintegrationResultV0 =
  | { readonly kind: "REJECTED_UNRECORDED"; readonly detail: string }
  | { readonly kind: "REJECTED_ALTERED_OUTCOME"; readonly detail: string }
  | {
      readonly kind: "REINTEGRATED";
      readonly observation_transition_id: string;
      readonly learning_transition_id: string;
    }
  | {
      readonly kind: "FAILED_AFTER_OBSERVATION";
      readonly detail: string;
    };

async function outcomeFingerprint(outcome: ActionOutcomeV0): Promise<HashV1> {
  return hashEnvelope(OUTCOME_FINGERPRINT_PROJECTION, outcome as unknown as Record<string, unknown>);
}

export class OutcomeReintegrationRunnerV0 {
  constructor(
    private readonly deps: RuntimeDependencyContainer,
    private readonly workflowStore: MiclWorkflowStore,
    private readonly executionAuthority: ActionExecutionLedgerV0
  ) {}

  async run(params: {
    readonly execution_id: string;
    readonly subject_id: string;
    readonly cognition_transition_id: string;
    readonly declared_salience: number;
    /** Optional caller-declared outcome; MUST match the recorded one exactly. */
    readonly declaredOutcome?: ActionOutcomeV0;
  }): Promise<OutcomeReintegrationResultV0> {
    // ---- outcome authority: only LEDGER-recorded executions are facts ----------
    const recorded = await this.executionAuthority.lookup(params.execution_id);
    if (recorded === null) {
      return {
        kind: "REJECTED_UNRECORDED",
        detail: `execution ${params.execution_id} has no recorded outcome (no fabricated facts)`
      };
    }
    if (
      params.declaredOutcome !== undefined &&
      JSON.stringify(params.declaredOutcome) !== JSON.stringify(recorded.outcome)
    ) {
      // Altered factual Outcome under the same execution identity ⇒ fail closed.
      return {
        kind: "REJECTED_ALTERED_OUTCOME",
        detail: `declared outcome does not match the recorded outcome for ${params.execution_id}`
      };
    }
    const outcome = recorded.outcome;
    const fingerprint = await outcomeFingerprint(outcome);
    const reintegrationId = `reint-${params.execution_id.replace(/^x-act-/, "")}` as never;

    const record = await this.workflowStore.loadOrCreate({
      micl_id: reintegrationId,
      subject_id: params.subject_id as never,
      request_fingerprint: fingerprint,
      initial_state_revision: 0 as never,
      initial_logical_time: 0 as never
    });

    // ---- stage OBSERVATION ----------------------------------------------------
    let observationCheckpoint = record.stages["OBSERVATION"];
    if (observationCheckpoint === undefined) {
      const reconciled = await this.reconcileStage(
        reintegrationId,
        fingerprint,
        "OBSERVATION",
        "Observation",
        params.subject_id
      );
      if (reconciled !== null) {
        observationCheckpoint = reconciled;
        await this.workflowStore.putStageCheckpoint(reintegrationId, reconciled);
      }
    }
    if (observationCheckpoint === undefined) {
      const snapshot = await this.requireSnapshot(params.subject_id);
      const anchored = anchorOf(snapshot);
      const mapping = await adaptOutcomeToObservation(outcome, params.subject_id);
      const minter = createMiclStageMinter(
        this.deps.subjectCore,
        this.workflowStore,
        miclWorkflowBinding(reintegrationId, fingerprint, "OBSERVATION")
      );
      const executor = new ObservationTransitionExecutor({
        ...this.deps,
        subjectCore: minter.core()
      });
      const stageOutcome = await executor.execute(
        anchored,
        mapping.input,
        minter.capabilities(await this.repositoryBindings(snapshot))
      );
      if (stageOutcome.kind !== "COMMITTED") {
        throw new TransitionStageFailure(
          "OBSERVATION",
          "INVALID_SCHEMA",
          "SS-SCHEMA-001",
          `outcome observation did not commit (${stageOutcome.kind})`
        );
      }
      observationCheckpoint = checkpointFromBundle("OBSERVATION", stageOutcome.bundle);
      await this.workflowStore.putStageCheckpoint(reintegrationId, observationCheckpoint);
    }

    // ---- stage LEARNING ---------------------------------------------------------
    let learningCheckpoint = record.stages["LEARNING"];
    if (learningCheckpoint === undefined) {
      const reconciled = await this.reconcileStage(
        reintegrationId,
        fingerprint,
        "LEARNING",
        "Learning",
        params.subject_id
      );
      if (reconciled !== null) {
        learningCheckpoint = reconciled;
        await this.workflowStore.putStageCheckpoint(reintegrationId, reconciled);
      }
    }
    if (learningCheckpoint === undefined) {
      const snapshot = await this.requireSnapshot(params.subject_id);
      const anchored = anchorOf(snapshot);
      // Deterministic Learning prepared marker BEFORE the executor runs (R4):
      // the frozen executor owns its prepared record inline; the ledger records
      // the derived identity so crash reconciliation can rebuild from the
      // authoritative bundle without re-running the committed stage.
      const learningTransitionId = await deriveLearningTransitionId(
        {
          subject_id: params.subject_id as never,
          source_transition_id: observationCheckpoint.transition_id as unknown as Parameters<
            typeof deriveLearningTransitionId
          >[0]["source_transition_id"]
        },
        { expected_state_revision: anchored.state_revision as number, rebuild_ordinal: 0 }
      );
      await this.workflowStore.putStagePreparedMarker(
        miclWorkflowBinding(reintegrationId, fingerprint, "LEARNING"),
        {
          transition_id: learningTransitionId,
          prepared_result_ref: `workflow:w-learn-${learningTransitionId.replace("t-learn-", "")}`
        }
      );

      const candidate = await this.buildLearningCandidate(
        observationCheckpoint.transition_id,
        params
      );
      if (candidate === null) {
        return {
          kind: "REJECTED_ALTERED_OUTCOME",
          detail: "committed Observation evidence vanished before Learning (fail closed)"
        };
      }
      const executor = new LearningTransitionExecutor(this.deps);
      let learningOutcome: Awaited<ReturnType<LearningTransitionExecutor["execute"]>>;
      try {
        learningOutcome = await executor.execute(anchored, { candidate: candidate as never });
      } catch (error) {
        if (error instanceof TransitionStageFailure) throw error;
        throw new TransitionStageFailure(
          "LEARNING",
          "SERVICE_UNAVAILABLE",
          "FAIL-SERVICE-001",
          `learning stage failed: ${(error as Error).message}`,
          { cause: error }
        );
      }
      if (isRebaseRequired(learningOutcome)) {
        // Frozen A13 terminal surfaced verbatim; no runner-level retry.
        return {
          kind: "FAILED_AFTER_OBSERVATION",
          detail: "REBASE_REQUIRED"
        };
      }
      const asCommit = learningOutcome as { kind: string; bundle?: AtomicCommitBundleV1 };
      if (asCommit.kind !== "COMMITTED" || asCommit.bundle === undefined) {
        throw new TransitionStageFailure(
          "LEARNING",
          "INVALID_SCHEMA",
          "SS-SCHEMA-001",
          `learning did not commit (${asCommit.kind})`
        );
      }
      learningCheckpoint = checkpointFromBundle("LEARNING", asCommit.bundle);
      await this.workflowStore.putStageCheckpoint(reintegrationId, learningCheckpoint);
    }

    return {
      kind: "REINTEGRATED",
      observation_transition_id: observationCheckpoint.transition_id,
      learning_transition_id: learningCheckpoint.transition_id
    };
  }

  private async requireSnapshot(subjectId: string) {
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(subjectId as never);
    if (snapshot === null) {
      throw stageFailure("OBSERVATION", "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${subjectId} not found`);
    }
    return snapshot;
  }

  /**
   * Crash reconciliation: rebuild a committed stage checkpoint from the
   * prepared marker + the authoritative committed bundle, without re-running
   * the committed stage.
   */
  private async reconcileStage(
    reintegrationId: string,
    fingerprint: HashV1,
    stage: MiclStageKey,
    expectedType: "Observation" | "Learning",
    subjectId: string
  ): Promise<MiclStageCheckpointV0 | null> {
    const sourceAuthority = this.deps.learningSourceAuthority;
    if (sourceAuthority === null) return null;
    const prepared = await this.workflowStore.findPreparedRecord(
      miclWorkflowBinding(reintegrationId as never, fingerprint, stage)
    );
    if (prepared === null) return null;
    const bundle = await sourceAuthority.readCommittedBundle(prepared.transition_id);
    if (bundle === null || bundle.subject_id !== (subjectId as never)) return null;
    if (bundle.transition_type !== expectedType) return null;
    return checkpointFromBundle(stage, bundle);
  }

  private async buildLearningCandidate(
    observationTransitionId: string,
    params: { subject_id: string; declared_salience: number }
  ): Promise<Record<string, unknown> | null> {
    const sourceAuthority = this.deps.learningSourceAuthority;
    if (sourceAuthority === null) return null;
    const bundle = await sourceAuthority.readCommittedBundle(observationTransitionId);
    if (bundle === null || bundle.subject_id !== params.subject_id) return null;
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
      entity_refs: [...committed.context.active_entity_refs],
      event_refs: [],
      occurrence_logical_time: bundle.logical_time_after,
      appraisal_ref: appraisalRefs.length > 0 ? appraisalRefs[0] : null,
      scene: committed.context.scene,
      focus_refs: [...committed.context.focus_refs],
      environment_refs: [...committed.context.environment_refs],
      declared_salience: params.declared_salience
    };
  }

  private async repositoryBindings(
    snapshot: SubjectStateV0
  ): Promise<ReadonlyArray<{ repository_revision: string; repository_revision_hash: string }>> {
    const repository = this.deps.memory.repository;
    const revision = snapshot.memory_state.repository_revision as string;
    const manifest = await repository.readManifest(revision as never);
    if (manifest === null) {
      throw stageFailure(
        "OBSERVATION",
        "SERVICE_UNAVAILABLE",
        "FAIL-PREPARE-001",
        `repository cannot prove manifest ${revision}`
      );
    }
    return [
      {
        repository_revision: revision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ];
  }
}



function checkpointFromBundle(
  stage: MiclStageKey,
  bundle: AtomicCommitBundleV1
): MiclStageCheckpointV0 {
  return {
    stage_key: stage,
    transition_id: bundle.transition_id,
    logical_status: "COMMITTED",
    next_revision: bundle.next_revision as StateRevisionV0,
    logical_time_after: bundle.logical_time_after as never,
    snapshot_hash_after: bundle.canonical_result.snapshot_hash_after,
    result_ref: bundle.canonical_result.result_ref,
    trace_ref: bundle.canonical_result.trace_ref
  };
}

function isRebaseRequired(outcome: unknown): boolean {
  return (
    typeof outcome === "object" &&
    outcome !== null &&
    (outcome as { kind?: unknown }).kind === "REBASE_REQUIRED"
  );
}
