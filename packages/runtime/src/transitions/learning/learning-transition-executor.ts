/**
 * P2.3.5.3c — LearningTransitionExecutor (happy path): the first real
 * LearningTransition V0 lifecycle, implementing the committed contract
 * docs/implementation/p2-3-5-learning-v0-reference-contract.md (§5–§20):
 *
 *   untrusted candidate → validateTrustedLearningExperience (3a)
 *     → derive deterministic prepare identity (§9, rebuild_ordinal = 0)
 *     → ExperienceEncoderV0 (3b) → ONE EpisodicMemoryRecordV0
 *     → MemoryPreparationAuthority storePayload + prepareRevisionForIntent
 *     → candidate revision R1 (≠ R0)
 *     → ONE memory-content delta (/memory_state/repository_revision → R1)
 *     → ONE SubjectCore canonical commit binding R1
 *
 * Trust boundary: the entrypoint accepts the UNTRUSTED candidate; there is no
 * overload or pathway that lets external callers bypass 3a durable source
 * validation. Source validation happens BEFORE any MemoryRepository write.
 *
 * Ownership: producer = "memory", domain = "memory-content", transition =
 * "Learning" (frozen ownership.ts). Only Learning-owned memory-content paths
 * are written; exactly-one record per valid Learning (WRITE_CARDINALITY_V0).
 *
 * Cross-store atomicity: CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES
 * — prepare may leave candidate revisions physically present but non-canonical;
 * canonical retrieval follows the SubjectState-bound revision only.
 *
 * Scope (3c): successful prepare + adoption + basic failure atomicity. Stale
 * rejections are SURFACED unchanged (no reload/retry/rebuild/ordinal
 * advancement — A13 orchestration belongs to P2.3.5.3d); full A12 crash/resume
 * state machine belongs to P2.3.5.3d. Repository prepare failures/conflicts
 * normalize into the frozen FAIL-PREPARE-001 family (raw repository messages
 * survive only as non-canonical `cause`).
 */

import type {
  CanonicalRefV0,
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0
} from "@characteros-next/subject-core";
import { proposalFingerprint } from "@characteros-next/subject-core";
import type { MemoryPrepareIntentV1 } from "@characteros-next/memory";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { LearningAdoptionAuthority } from "./learning-adoption-authority.js";
import type { LearningExperienceCandidateV0 } from "./learning-candidate.js";
import {
  validateTrustedLearningExperience,
  type TrustedLearningExperienceV0
} from "./learning-source-authority.js";
import { ExperienceEncoderV0 } from "./experience-encoder-v0.js";
import {
  deriveLearningIntentId,
  deriveLearningTransitionId
} from "./learning-identity.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../common.js";

const STAGE = "LEARNING" as const;

/** Minimal Learning runtime input: the UNTRUSTED candidate (3a validates it). */
export interface LearningTransitionInputV0 {
  readonly candidate: LearningExperienceCandidateV0;
}

export type LearningExecutionResult = CommitReservedOutcome;

/**
 * Deterministic Learning proposal (single source of truth for the canonical
 * identity): transition id = shared frozen §13 derivation (identical to
 * `EpisodicMemoryRecordV0.provenance.transition_id`), Learning OCCURRENCE time
 * basis, one memory-content delta in raw-ASCII order.
 */
export function buildLearningProposal(params: {
  readonly learningTransitionId: string;
  readonly subjectId: string;
  readonly stateRevision: number;
  readonly occurrenceLogicalTime: number;
  readonly observationRef: CanonicalRefV0;
  readonly memoryDelta: DomainDeltaV0;
}): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: params.learningTransitionId,
    subject_id: params.subjectId,
    transition_type: "Learning",
    expected_state_revision: params.stateRevision,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: params.occurrenceLogicalTime
    },
    cause_refs: [params.observationRef],
    domain_deltas: [params.memoryDelta],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

export class LearningTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: LearningTransitionInputV0
  ): Promise<LearningExecutionResult> {
    // ---- wiring gate -------------------------------------------------------------
    const sourceAuthority = this.deps.learningSourceAuthority;
    if (sourceAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning source authority not wired");
    }
    const adoptionAuthority: LearningAdoptionAuthority | null =
      this.deps.learningAdoptionAuthority;
    if (adoptionAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning adoption authority not wired");
    }

    // ---- one authoritative canonical basis (§4): subject/SR0/T0/R0 ---------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);
    const basis = {
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: 0 // initial attempt only; ordinal advancement belongs to 3d
    };

    // ---- trusted source FIRST (§5): zero repository writes before this gate ------
    const trustedChecked = await validateTrustedLearningExperience(sourceAuthority, anchored, input.candidate);
    if (!trustedChecked.ok) {
      throw new TransitionStageFailure(
        STAGE,
        trustedChecked.error.error_code,
        trustedChecked.error.reason,
        trustedChecked.error.detail
      );
    }
    const trusted: TrustedLearningExperienceV0 = trustedChecked.value;

    // ---- deterministic intent identity (§9, 3c owns the derivation) --------------
    const intentIdentity = await deriveLearningIntentId(trusted, basis);

    // ---- deterministic record (3b encoder is the sole owner of record logic) -----
    let record;
    try {
      record = await new ExperienceEncoderV0().encode(trusted, {
        current_logical_time: anchored.current_logical_time,
        expected_state_revision: anchored.state_revision,
        rebuild_ordinal: basis.rebuild_ordinal,
        intent_identity: intentIdentity
      });
    } catch (error) {
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "experience encoder failed (fail closed)",
        { cause: error }
      );
    }

    // ---- repository payload + intent-driven prepare (§10–§12) --------------------
    const repository = this.deps.memory.repository;
    let payloadHash;
    let prepared;
    try {
      payloadHash = await repository.storePayload(record.episode_ref, record);
      const intent: MemoryPrepareIntentV1 = {
        intent_id: intentIdentity as never,
        parent_revision: snapshot.memory_state.repository_revision,
        records: [{ ref: record.episode_ref, payload_hash: payloadHash }]
      };
      prepared = await repository.prepareRevisionForIntent(intent);
    } catch (error) {
      // Frozen contract §10 mapping: repository prepare failure/conflict →
      // ABORTED / SERVICE_UNAVAILABLE / FAIL-PREPARE-001 (raw repository
      // message survives only as non-canonical cause).
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-PREPARE-001",
        "learning repository prepare failed (fail closed)",
        { cause: error }
      );
    }
    if (prepared.repository_revision === snapshot.memory_state.repository_revision) {
      throw stageFailure(
        STAGE,
        "INVALID_MEMORY_REVISION",
        "MEM-REV-001",
        "prepared candidate revision must differ from the currently bound revision"
      );
    }

    // §15.2 equality 12: repository bindings are exactly the sorted distinct
    // union of the CURRENT and NEXT snapshot revisions — the canonical gate
    // verifies every entry through the verdict-only reference capability.
    const bindingRevisions = [
      ...new Set([snapshot.memory_state.repository_revision, prepared.repository_revision])
    ].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision);
      if (manifest === null) {
        throw stageFailure(
          STAGE,
          "SERVICE_UNAVAILABLE",
          "FAIL-PREPARE-001",
          `repository cannot prove a manifest for revision ${revision} (genesis R0 is a host duty)`
        );
      }
      repositoryBindings.push({
        repository_revision: revision as never,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      });
    }

    // ---- Learning-owned memory-content delta (§14: exactly the binding change) ---
    const memoryDelta: DomainDeltaV0 = {
      producer: "memory",
      domain: "memory-content",
      expected_repository_revision: snapshot.memory_state.repository_revision as never,
      operations: [
        { path: "/memory_state/repository_revision", value: prepared.repository_revision as never }
      ],
      provenance_refs: []
    } as unknown as DomainDeltaV0;

    // ---- canonical proposal + reservation + single atomic adoption (§16–§17) -----
    const learningTransitionId = await deriveLearningTransitionId(trusted, basis);
    const proposal = buildLearningProposal({
      learningTransitionId,
      subjectId: anchored.subject_id,
      stateRevision: anchored.state_revision as number,
      occurrenceLogicalTime: anchored.current_logical_time as number,
      observationRef: trusted.observation_ref,
      memoryDelta
    });
    const payloadFingerprint = await proposalFingerprint(proposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(proposal);
    switch (reserved.kind) {
      case "CONTINUE":
        break;
      case "ALREADY_COMMITTED":
        // A12 replay: same identity + same fingerprint ⇒ original result, no +1.
        return { kind: "COMMITTED", bundle: reserved.bundle, result: reserved.bundle.canonical_result };
      case "TERMINAL_NO_OP":
        return { kind: "NO_OP" };
      case "REUSE_CONFLICT":
        return {
          kind: "REJECTED",
          failure: {
            error_code: "TRANSITION_ID_REUSE",
            reason: "IDEM-REUSE-001",
            detail: "transition id reuse with changed payload"
          }
        };
    }

    // SubjectCore independently validates the adoption (R2-H verdict-only
    // validator wired at facade composition; repository bindings beside commit).
    // A stale rejection surfaces UNCHANGED — no reload/retry/rebuild (3d owns
    // the A13 orchestration).
    const outcome = await this.deps.subjectCore.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "memory", domain: "memory-content" }
      ]),
      preparedBinding: {
        prepared_result_ref: `workflow:w-learn-${learningTransitionId.replace("t-learn-", "")}` as never,
        transition_id: proposal.transition_id,
        subject_id: proposal.subject_id,
        transition_type: proposal.transition_type,
        payload_fingerprint: payloadFingerprint
      },
      repository_bindings: repositoryBindings as never
    });
    // §2/§3 frozen lifecycle completion: the candidate revision is marked
    // adopted ONLY after the canonical SubjectState has bound it. A canonical
    // failure above leaves R1 unadopted (non-canonical orphan). The post-commit
    // crash window (bind succeeded, adoption not yet recorded) remains owned by
    // P2.3.5.3d — no rollback/retry/compensation here (§4/§8).
    if (outcome.kind === "COMMITTED") {
      adoptionAuthority.markAdopted(prepared.repository_revision);
    }
    return outcome;
  }
}
