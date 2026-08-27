/**
 * P2.3.5.3c/3d — LearningTransitionExecutor: the full LearningTransition V0
 * lifecycle over the committed contract
 * docs/implementation/p2-3-5-learning-v0-reference-contract.md (§5–§20, §11–§12):
 *
 *   untrusted candidate → validateTrustedLearningExperience (3a)
 *     → deterministic prepare identity (§9, rebuild_ordinal)
 *     → ExperienceEncoderV0 (3b) → ONE EpisodicMemoryRecordV0
 *     → MemoryPreparationAuthority storePayload + prepareRevisionForIntent
 *     → candidate revision R1 (≠ R0)
 *     → ONE memory-content delta (/memory_state/repository_revision → R1)
 *     → ONE SubjectCore canonical commit binding R1
 *     → markAdopted(R1) (§2, ONLY after the canonical bind)
 *
 * Trust boundary: the entrypoint accepts the UNTRUSTED candidate; there is no
 * overload or pathway that lets external callers bypass 3a durable source
 * validation. Source validation happens BEFORE any MemoryRepository write, and
 * is RE-RUN after a stale (never reusing the old trusted object — §13).
 *
 * Ownership: producer = "memory", domain = "memory-content", transition =
 * "Learning" (frozen ownership.ts). Only Learning-owned memory-content paths
 * are written; exactly-one record per valid Learning (WRITE_CARDINALITY_V0).
 *
 * Cross-store atomicity: CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES
 * — prepare may leave candidate revisions physically present but non-canonical;
 * canonical retrieval follows the SubjectState-bound revision only.
 *
 * A12 (§5, §11): same transition identity + same fingerprint replays the
 * original committed result (ALREADY_COMMITTED, +0 revision/trace/record);
 * changed fingerprint fails closed (TRANSITION_ID_REUSE); repository intent
 * idempotency recovers the crash window C2 (prepare succeeded, commit did not
 * happen) by reusing the SAME prepared revision — never a new orphan.
 *
 * A13 (§12, bounded): a core stale rejection (`REJECTED / STALE_STATE_REVISION`)
 * triggers EXACTLY ONE runtime-owned six-step rebase — reload latest canonical
 * state → revalidate the experience from durable evidence → revalidate the
 * repository base → ownership/composition revalidated by the frozen proposal
 * admission → revalidate old-prepared attachability (§12.1 predicate) → safe:
 * rebuild with ordinal+1 and a NEW deterministic identity, unsafe: frozen
 * terminal `LearningRebaseRequiredResultV1`. A second stale is terminal — there
 * is NO retry loop (§20). Stale rejections are never "expected-revision swap
 * and retry".
 *
 * Post-commit adoption reconciliation (§9): an ALREADY_COMMITTED replay whose
 * committed bundle proves the exact Learning transition bound the revision, but
 * whose adoption marker is missing, reconciles `markAdopted` with canonical +0.
 * Repository prepare failures/conflicts normalize into the frozen
 * FAIL-PREPARE-001 family (raw repository messages survive only as
 * non-canonical `cause`). No schema changes upstream (§37); no MICL (§38).
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

/**
 * Frozen `LearningRebaseRequiredResultV1` (transition-contracts §7.4): emitted
 * by the Learning runtime ONLY after an underlying core stale rejection when
 * the A13 six-step workflow cannot prove a safe rebuild. No canonical mutation.
 */
export interface LearningRebaseRequiredResultV1 {
  readonly kind: "REBASE_REQUIRED";
  readonly failure: {
    readonly error_code: "STALE_STATE_REVISION";
    readonly reason: "REBASE-STALE-001";
    readonly detail: string;
  };
}

export type LearningExecutionResult =
  | CommitReservedOutcome
  | LearningRebaseRequiredResultV1;

/** Internal single-attempt outcome: terminal result, or the stale handoff. */
type AttemptOutcome =
  | { readonly kind: "DONE"; readonly result: LearningExecutionResult }
  | {
      readonly kind: "STALE";
      readonly preparedRevision: string | null;
    };

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

    // ---- initial attempt: rebuild_ordinal = 0 (§4) --------------------------------
    const first = await this.runAttempt(ctx, input.candidate, 0, null);
    if (first.kind === "DONE") return first.result;

    // ==== A13 §12 — stale after prepare: the runtime-owned six-step workflow ======
    // Bounded V0 policy: EXACTLY ONE rebuild attempt; a second stale is the
    // frozen terminal REBASE_REQUIRED. No while/retry loop (§20).

    // Step 1: reload the latest canonical SubjectState (old revision is
    // FORBIDDEN_TO_REUSE — reload mandatory, never the caller's stale view).
    const reloaded = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (reloaded === null) {
      return rebaseRequired("canonical subject state unavailable after stale rejection");
    }
    const rebaseCtx: RuntimeContext = {
      subject_id: ctx.subject_id,
      current_logical_time: reloaded.runtime_metadata.logical_time,
      state_revision: reloaded.runtime_metadata.state_revision
    } as unknown as RuntimeContext;
    const reanchored = anchorContext(rebaseCtx, reloaded, STAGE);

    // Step 2 (+§13): revalidate the experience from durable evidence — a FRESH
    // validation; the old trusted object is never reused as proof.
    const rechecked = await validateTrustedLearningExperience(sourceAuthority, reanchored, input.candidate);
    if (!rechecked.ok) {
      return rebaseRequired(`experience revalidation failed after stale: ${rechecked.error.reason}`);
    }

    // Step 3: repository base revalidation — the reloaded SubjectState-bound
    // revision is the ONLY parent authority (never repository-latest/highest).
    // Step 4: ownership/composition revalidation is enforced by the frozen
    // proposal admission on the rebuilt proposal (same ownership matrix).
    // Step 5: old prepared candidate attachability (§12.1 predicate).
    const reusePrepared = await this.attachablePreparedRevision(
      first.preparedRevision,
      reloaded.memory_state.repository_revision as string,
      adoptionAuthority
    );

    // Step 6: SAFE → rebuild with ordinal+1 and a NEW deterministic identity
    // (new intent_id, new transition_id, new fingerprint); the rebuild runs
    // against the reloaded canonical basis and current logical time.
    const rebuilt = await this.runAttempt(rebaseCtx, input.candidate, 1, reusePrepared);
    if (rebuilt.kind === "DONE") return rebuilt.result;

    // Second stale: frozen terminal result — deterministically bounded, no loop.
    return rebaseRequired("second stale rejection after the single permitted rebuild");
  }

  /**
   * §12.1 attachability predicate over an old prepared revision: reuse is legal
   * ONLY if the manifest exists AND its parent chain still matches the current
   * bound revision AND the revision is unadopted AND every record payload hash
   * still recomputes from repository-owned payloads. Any failure ⇒ not reusable.
   */
  private async attachablePreparedRevision(
    preparedRevision: string | null,
    currentBoundRevision: string,
    adoptionAuthority: LearningAdoptionAuthority
  ): Promise<string | null> {
    if (preparedRevision === null) return null;
    const repository = this.deps.memory.repository;
    const manifest = await repository.readManifest(preparedRevision as never);
    if (manifest === null) return null;
    if ((manifest.parent_revision as string) !== currentBoundRevision) return null;
    if (adoptionAuthority.isAdopted(preparedRevision as never)) return null;
    for (const record of manifest.record_hashes) {
      let owned;
      try {
        owned = await repository.payloadHashOf(record.ref);
      } catch {
        return null;
      }
      if (owned !== record.payload_hash) return null;
    }
    return preparedRevision;
  }

  /**
   * ONE deterministic attempt at `rebuild_ordinal`. Encodes, prepares (unless a
   * still-attachable old revision is supplied), binds, commits and — after a
   * successful canonical bind — records adoption. A core stale rejection is
   * returned as a STALE handoff (never retried inside the attempt); every other
   * outcome is terminal for the attempt.
   */
  private async runAttempt(
    ctx: RuntimeContext,
    candidate: LearningExperienceCandidateV0,
    rebuildOrdinal: number,
    reusePreparedRevision: string | null
  ): Promise<AttemptOutcome> {
    const sourceAuthority = this.deps.learningSourceAuthority;
    const adoptionAuthority = this.deps.learningAdoptionAuthority;
    if (sourceAuthority === null || adoptionAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning authorities not wired");
    }

    // ---- one authoritative canonical basis (§4): subject/SR0/T0/R0 ---------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);
    const basis = {
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: rebuildOrdinal
    };

    // ---- trusted source FIRST (§5): zero repository writes before this gate ------
    const trustedChecked = await validateTrustedLearningExperience(sourceAuthority, anchored, candidate);
    if (!trustedChecked.ok) {
      throw new TransitionStageFailure(
        STAGE,
        trustedChecked.error.error_code,
        trustedChecked.error.reason,
        trustedChecked.error.detail
      );
    }
    const trusted: TrustedLearningExperienceV0 = trustedChecked.value;

    // ---- repository payload + intent-driven prepare (§10–§12) --------------------
    const repository = this.deps.memory.repository;
    let prepared;
    if (reusePreparedRevision !== null) {
      // §12.1/§18: the old prepared revision passed the exact attachability
      // predicate — reuse it; a new intent/prepare would mint a second orphan.
      const manifest = await repository.readManifest(reusePreparedRevision as never);
      if (manifest === null) {
        throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision vanished");
      }
      prepared = { repository_revision: reusePreparedRevision, manifest } as never;
    } else {
      // ---- deterministic intent identity (§9, 3c owns the derivation) ------------
      const intentIdentity = await deriveLearningIntentId(trusted, basis);
      // ---- deterministic record (3b encoder is the sole owner of record logic) ---
      let record;
      let payloadHash;
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
    }
    if ((prepared.repository_revision as string) === (snapshot.memory_state.repository_revision as string)) {
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
      ...new Set([snapshot.memory_state.repository_revision as string, prepared.repository_revision as string])
    ].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision as never);
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
      case "ALREADY_COMMITTED": {
        // A12 replay: same identity + same fingerprint ⇒ original result, +0
        // revision/trace/record (§5). Post-commit adoption reconciliation (§9):
        // the committed bundle IS the durable canonical proof that the exact
        // Learning transition bound this revision — if the adoption marker is
        // missing (commit succeeded, markAdopted lost), reconcile here with
        // canonical +0. Never adopted merely on intent/existence/recency.
        const bundle = reserved.bundle;
        const boundRevision = bundle.next_snapshot.memory_state.repository_revision as string;
        const bundleProvesLearningBinding =
          bundle.subject_id === (anchored.subject_id as never) &&
          bundle.transition_type === "Learning" &&
          bundle.repository_revision_bindings.some(
            (b) => (b.repository_revision as string) === boundRevision
          );
        if (bundleProvesLearningBinding && !adoptionAuthority.isAdopted(boundRevision as never)) {
          adoptionAuthority.markAdopted(boundRevision as never);
        }
        return {
          kind: "DONE",
          result: { kind: "COMMITTED", bundle, result: bundle.canonical_result }
        };
      }
      case "TERMINAL_NO_OP":
        return { kind: "DONE", result: { kind: "NO_OP" } };
      case "REUSE_CONFLICT":
        return {
          kind: "DONE",
          result: {
            kind: "REJECTED",
            failure: {
              error_code: "TRANSITION_ID_REUSE",
              reason: "IDEM-REUSE-001",
              detail: "transition id reuse with changed payload"
            }
          }
        };
    }

    // SubjectCore independently validates the adoption (R2-H verdict-only
    // validator wired at facade composition; repository bindings beside commit).
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
    // failure above leaves R1 unadopted (non-canonical orphan). A stale
    // rejection here hands off to the bounded A13 workflow — the OLD prepared
    // revision stays durable for the §12.1 attachability decision.
    if (outcome.kind === "COMMITTED") {
      adoptionAuthority.markAdopted(prepared.repository_revision);
      return { kind: "DONE", result: outcome };
    }
    if (
      outcome.kind === "REJECTED" &&
      outcome.failure.error_code === "STALE_STATE_REVISION"
    ) {
      return { kind: "STALE", preparedRevision: prepared.repository_revision as string };
    }
    return { kind: "DONE", result: outcome };
  }
}

function rebaseRequired(detail: string): LearningRebaseRequiredResultV1 {
  return {
    kind: "REBASE_REQUIRED",
    failure: {
      error_code: "STALE_STATE_REVISION",
      reason: "REBASE-STALE-001",
      detail
    }
  };
}
