/**
 * P2.3 Pre-Learning P0-1/P0-2 — SubjectCorePort: runtime's authorized view of the
 * subject-core facade (two-call protocol). Runtime NEVER supplies authoritative facts
 * (currentState, identity version, prior attempts, previous refs); it only passes the
 * proposal, the continuation minted by reserveAndRoute, a host-minted prepared
 * binding, and the producer authorization capability. SubjectCore verifies all of
 * them and reads authority itself.
 */

import type {
  CanonicalTransitionProposalV1,
  CommitReservedInput,
  CommitReservedOutcome,
  ReconcileOutcome,
  ReserveAndRouteOutcome,
  SubjectStateV0,
  TerminalizeNoOpInput
} from "@characteros-next/subject-core";
import type { HashV1, IdentifierV0, TransitionIdV0 } from "@characteros-next/subject-core";
import type { PreparedLogicalResultBindingV1 } from "@characteros-next/subject-core";

export interface SubjectCorePort {
  /** First call: syntax admission + durable identity reservation/routing. */
  reserveAndRoute(proposal: CanonicalTransitionProposalV1): Promise<ReserveAndRouteOutcome>;

  /** Second call: full semantic pipeline + single atomic CAS (authority re-read). */
  commitReserved(input: CommitReservedInput): Promise<CommitReservedOutcome>;

  /** Durable NO_OP terminalization (runtime-owned status, subject-core journaling). */
  terminalizeReservedNoOp(input: TerminalizeNoOpInput): Promise<CommitReservedOutcome>;

  /** Authoritative snapshot reads for orchestration and producers. */
  readCurrentSnapshot(subjectId: IdentifierV0): Promise<SubjectStateV0 | null>;

  /** OUTCOME_UNKNOWN resolution before any retry. */
  reconcile(
    transitionId: TransitionIdV0,
    subjectId: IdentifierV0,
    fingerprint: HashV1
  ): Promise<ReconcileOutcome>;
}

/** Host-minted trusted capabilities passed beside the proposal (never forged). */
export interface TransitionCapabilities {
  readonly preparedBinding: PreparedLogicalResultBindingV1;
  readonly repository_bindings: ReadonlyArray<{
    readonly repository_revision: string;
    readonly repository_revision_hash: string;
  }>;
}
