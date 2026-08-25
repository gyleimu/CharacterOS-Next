/**
 * P2.3.2 — TimeTransitionExecutor (first runtime transition executor).
 * Source: p2-runtime-plan.md §6.2/§11-P2.3; p2-1-contract-freeze.md §5.2, §7.1–§7.2,
 * §13.3–§13.4, §14; docs/implementation/p2-3-runtime-plan.md §§3–5.
 *
 * Orchestration ONLY: admits raw elapsed ticks, re-anchors the context to the
 * authoritative snapshot, invokes the affect/regulation producer ports, assembles ONE
 * sorted CanonicalTransitionProposalV1 and delegates every bit of authority to
 * SubjectCorePort.commit. Hard guarantees:
 * - elapsed=0 with zero deltas routes as NO_OP (subject-core owns the terminal;
 *   a stale revision still yields the ordinary rejection, never a fake NO_OP);
 * - Time touches NO memory capability, NO retrieval, NO appraisal, NO LLM;
 * - producers are invoked through their ports only; their failures propagate
 *   fail-closed BEFORE any commit attempt (nothing partially applied);
 * - the canonical SubjectState is never mutated here — snapshots are read-only views.
 */

import type {
  CanonicalRefV0,
  CommitTransitionInput,
  CommitTransitionOutcome,
  DomainDeltaV0,
  HashV1,
  RepositoryRevisionBindingV1,
  SubjectStateV0,
  TransitionType
} from "@characteros-next/subject-core";
import type { AuthoritativeTransitionRecordV1 } from "@characteros-next/subject-core";
import type { ReferenceValidatorCapability } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import { anchorContext, preProposalError } from "../common.js";

export interface TimeTransitionInputV0 {
  /** Raw elapsed ticks in `tick` timebase; nonnegative safe integer. */
  readonly elapsed_ticks: number;
}

/**
 * Trusted per-transition session facts owned outside this executor (journal header,
 * prepared-record binding, prior chain position). P2.3.1 ports do not include a real
 * journal yet, so composition/tests inject these values explicitly.
 */
export interface TransitionSessionFacts {
  readonly identity_record_version_before: number;
  readonly first_seen_sequence: number;
  readonly prior_attempts: AuthoritativeTransitionRecordV1["attempts"];
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  readonly prepared_result_ref: CanonicalRefV0;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
  readonly reference_validator?: ReferenceValidatorCapability;
}

export type TimeExecutionResult = CommitTransitionOutcome | { readonly kind: "NO_OP" };

/** Raw elapsed admission before any proposal exists (freeze §7.1 pre-proposal rules). */
function admitElapsedTicks(elapsedTicks: number): void {
  if (typeof elapsedTicks !== "number" || !Number.isFinite(elapsedTicks) || !Number.isInteger(elapsedTicks)) {
    throw preProposalError("INVALID_SCHEMA", "SS-SCHEMA-001", "elapsed_ticks must be an integer");
  }
  if (elapsedTicks < 0) {
    throw preProposalError("INVALID_LOGICAL_TIME", "TIME-ADVANCE-001", "elapsed_ticks must be >= 0");
  }
  if (elapsedTicks > Number.MAX_SAFE_INTEGER) {
    throw preProposalError("INVALID_LOGICAL_TIME", "TIME-ADVANCE-001", "elapsed_ticks overflows safe integer domain");
  }
}

/** Deterministic opaque transition id for Time runs (globally unique by construction). */
export function timeTransitionId(subjectId: string, revision: number, ticks: number): string {
  return `t-time-${subjectId}-r${revision}-e${ticks}`;
}

export class TimeTransitionExecutor {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    input: TimeTransitionInputV0,
    session: TransitionSessionFacts
  ): Promise<TimeExecutionResult> {
    admitElapsedTicks(input.elapsed_ticks);

    // Authoritative anchor: read current immutable snapshot through the port.
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw preProposalError("UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot);

    // ---- elapsed = 0 → zero-delta NO_OP routing ---------------------------------
    if (input.elapsed_ticks === 0) {
      const zeroProposal: CanonicalTransitionProposalV0Shape = {
        schema_version: "canonical-transition-proposal-v1" as never,
        transition_id: timeTransitionId(anchored.subject_id, anchored.state_revision, 0) as never,
        subject_id: anchored.subject_id as never,
        transition_type: "Time" as never,
        expected_state_revision: anchored.state_revision as never,
        time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } } as never,
        cause_refs: [] as never,
        domain_deltas: [] as never,
        external_refs: [] as never
      };
      return await this.deps.subjectCore.commit(
        commitInput(zeroProposal as never, snapshot, session)
      );
    }

    // ---- producers (affect first, then regulation; deterministic order) ----------
    const affectProducer = this.deps.affectProducer;
    if (affectProducer === null) {
      throw new Error("composition error: affectProducer not wired");
    }
    const regulationProducer = this.deps.regulationProducer;
    if (regulationProducer === null) {
      throw new Error("composition error: regulationProducer not wired");
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
      throw new Error(`affect producer failed (fail closed): ${(error as Error).message}`, {
        cause: error
      });
    }
    let regulationDelta: DomainDeltaV0;
    try {
      regulationDelta = await regulationProducer.produceRegulationDelta({
        context: anchored,
        snapshot,
        transition_type: "Time"
      });
    } catch (error) {
      throw new Error(`regulation producer failed (fail closed): ${(error as Error).message}`, {
        cause: error
      });
    }

    // Sorted by raw ASCII domain: "affect" < "regulation".
    const proposal: CanonicalTransitionProposalV0Shape = {
      schema_version: "canonical-transition-proposal-v1" as never,
      transition_id: timeTransitionId(anchored.subject_id, anchored.state_revision, input.elapsed_ticks) as never,
      subject_id: anchored.subject_id as never,
      transition_type: "Time" as never,
      expected_state_revision: anchored.state_revision as never,
      time_input: {
        kind: "ELAPSED",
        elapsed_time: { value: input.elapsed_ticks, unit: "tick" }
      } as never,
      cause_refs: [] as never,
      domain_deltas: [affectDelta, regulationDelta] as never,
      external_refs: [] as never
    };

    const outcome = await this.deps.subjectCore.commit(
      commitInput(proposal as never, snapshot, session)
    );
    return outcome;
  }
}

// Local structural view of the frozen canonical proposal (avoids importing the full
// interface with branded fields while keeping assembly shape-checked at the seam).
interface CanonicalTransitionProposalV0Shape {
  readonly schema_version: string;
  readonly transition_id: string;
  readonly subject_id: string;
  readonly transition_type: TransitionType;
  readonly expected_state_revision: number;
  readonly time_input:
    | { readonly kind: "ELAPSED"; readonly elapsed_time: { readonly value: number; readonly unit: "tick" } }
    | { readonly kind: "OCCURRENCE"; readonly occurrence_logical_time: number };
  readonly cause_refs: readonly string[];
  readonly domain_deltas: readonly DomainDeltaV0[];
  readonly external_refs: readonly string[];
}

function commitInput(
  proposal: unknown,
  currentState: SubjectStateV0,
  session: TransitionSessionFacts
): CommitTransitionInput {
  return {
    proposal: proposal as never,
    currentState,
    identity_record_version_before: session.identity_record_version_before,
    first_seen_sequence: session.first_seen_sequence,
    prior_attempts: session.prior_attempts,
    previous_commit_ref: session.previous_commit_ref,
    previous_record_checksum: session.previous_record_checksum,
    prepared_result_ref: session.prepared_result_ref,
    repository_bindings: session.repository_bindings,
    ...(session.reference_validator !== undefined
      ? { reference_validator: session.reference_validator }
      : {})
  };
}
