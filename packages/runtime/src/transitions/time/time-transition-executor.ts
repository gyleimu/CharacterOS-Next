/**
 * P2.3.2 (P0-1/P0-6 remediated) — TimeTransitionExecutor.
 * Source: freeze §5.2, §7.1–§7.2, §13.3–§13.4, §14; docs/implementation/p2-3-runtime-plan.md §§3–5.
 *
 * Orchestration ONLY, over the two-call SubjectCorePort:
 *   reserveAndRoute → (host capabilities) → commitReserved | terminalizeReservedNoOp
 * Runtime never supplies authoritative facts; capabilities are host-minted and
 * verified verdict-only by subject-core. Failures are typed TransitionStageFailure.
 * elapsed=0 becomes a DURABLE terminal NO_OP record (never a bare early return).
 */

import type {
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0
} from "@characteros-next/subject-core";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import { admitElapsedTicks, anchorContext, stageFailure, TransitionStageFailure } from "../common.js";

export interface TimeTransitionInputV0 {
  /** Raw elapsed ticks in `tick` timebase; nonnegative safe integer. */
  readonly elapsed_ticks: number;
}

export type TimeExecutionResult = CommitReservedOutcome;

/** Host-minted trusted capabilities passed beside every proposal (verified by core). */
export type {
  TransitionCapabilities
} from "../../ports/subject-core-port.js";

/** Deterministic opaque transition id for Time runs (globally unique by construction). */
export function timeTransitionId(subjectId: string, revision: number, ticks: number): string {
  return `t-time-${subjectId}-r${revision}-e${ticks}`;
}

/**
 * Exact canonical Time proposal for a zero-elapsed durable NO_OP (single source of
 * truth: executor and host capability minting must assemble the byte-identical
 * proposal so the prepared binding fingerprint can be authoritative).
 */
export function buildTimeNoOpProposal(
  subjectId: string,
  stateRevision: number
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: timeTransitionId(subjectId, stateRevision, 0),
    subject_id: subjectId,
    transition_type: "Time",
    expected_state_revision: stateRevision,
    time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

/**
 * Exact canonical Time proposal for a positive elapsed run (raw-ASCII domain order:
 * affect < regulation). Single source of truth shared with host capability minting.
 */
export function buildTimeProposal(
  subjectId: string,
  stateRevision: number,
  ticks: number,
  affectDelta: DomainDeltaV0,
  regulationDelta: DomainDeltaV0
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: timeTransitionId(subjectId, stateRevision, ticks),
    subject_id: subjectId,
    transition_type: "Time",
    expected_state_revision: stateRevision,
    time_input: {
      kind: "ELAPSED",
      elapsed_time: { value: ticks, unit: "tick" }
    },
    cause_refs: [],
    // raw-ASCII domain order: affect < regulation
    domain_deltas: [affectDelta, regulationDelta],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

const STAGE = "TIME" as const;

export class TimeTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: TimeTransitionInputV0,
    capabilities: TransitionCapabilities
  ): Promise<TimeExecutionResult> {
    admitElapsedTicks(STAGE, input.elapsed_ticks);

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);

    // ---- elapsed = 0 → durable terminal NO_OP ------------------------------------
    if (input.elapsed_ticks === 0) {
      const zeroProposal = buildTimeNoOpProposal(anchored.subject_id, anchored.state_revision);
      const reserved = await this.deps.subjectCore.reserveAndRoute(zeroProposal);
      switch (reserved.kind) {
        case "CONTINUE":
          return this.deps.subjectCore.terminalizeReservedNoOp({
            proposal: zeroProposal,
            continuation: reserved.continuation,
            producerAuthorization: this.deps.producerAuthorizationIssuer.issue([]),
            preparedBinding: capabilities.preparedBinding
          });
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
        case "ALREADY_COMMITTED":
          return { kind: "COMMITTED", bundle: reserved.bundle, result: reserved.bundle.canonical_result };
      }
    }

    // ---- producers (affect first, then regulation; deterministic order) ----------
    const affectProducer = this.deps.affectProducer;
    if (affectProducer === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "affectProducer not wired");
    }
    const regulationProducer = this.deps.regulationProducer;
    if (regulationProducer === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "regulationProducer not wired");
    }

    let affectDelta: DomainDeltaV0;
    try {
      affectDelta = await affectProducer.produceAffectDelta({
        context: anchored,
        snapshot,
        transition_type: "Time",
        appraisal: null
      });
    } catch (error) {
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "affect producer failed (fail closed)",
        { cause: error }
      );
    }
    let regulationDelta: DomainDeltaV0;
    try {
      regulationDelta = await regulationProducer.produceRegulationDelta({
        context: anchored,
        snapshot,
        transition_type: "Time"
      });
    } catch (error) {
      throw new TransitionStageFailure(
        STAGE,
        "SERVICE_UNAVAILABLE",
        "FAIL-SERVICE-001",
        "regulation producer failed (fail closed)",
        { cause: error }
      );
    }

    const proposal = buildTimeProposal(
      anchored.subject_id,
      anchored.state_revision,
      input.elapsed_ticks,
      affectDelta,
      regulationDelta
    );

    // ---- first call: reservation -------------------------------------------------
    const reserved = await this.deps.subjectCore.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") {
      switch (reserved.kind) {
        case "ALREADY_COMMITTED":
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
    }

    // ---- second call: semantic pipeline + single CAS ------------------------------
    return this.deps.subjectCore.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "affect", domain: "affect" },
        { producer: "regulation", domain: "regulation" }
      ]),
      preparedBinding: capabilities.preparedBinding,
      repository_bindings: capabilities.repository_bindings as never
    });
  }
}
