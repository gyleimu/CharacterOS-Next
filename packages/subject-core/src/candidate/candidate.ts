/**
 * P2.1.3 — immutable candidate state construction (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.2 (successor arithmetic),
 * §6.2 (runtime metadata derivation table), plan §7.2 step 9.
 *
 * The authoritative current snapshot is never touched: a `structuredClone` draft is
 * materialized, validated non-overlapping delta operations are applied by exact path,
 * core-owned runtime metadata is derived from the frozen transition table, and the
 * caller freezes the finished candidate. Until frozen the draft is not canonical and
 * is never exposed as such. No domain formulas, no Producer authority: producers only
 * mint deltas; subject-core remains the sole canonical mutator.
 */

import type { LogicalTimeV0, StateRevisionV0 } from "../types/scalars.js";
import type { RuntimeMetadataV0, SubjectStateV0 } from "../types/subject-state.js";
import type { TransitionType } from "../types/enums.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { fail, ok, type ValidationResult } from "../validation/result.js";

const TIME_ADV = "TIME-ADVANCE-001";

/** Writable path → containing top-level field / direct field on the root object. */
function applyOperation(root: Record<string, unknown>, path: string, value: unknown): void {
  if (path.startsWith("/memory_state/")) {
    const field = path.slice("/memory_state/".length);
    (root["memory_state"] as Record<string, unknown>)[field] = value;
    return;
  }
  root[path.slice(1)] = value;
}

/** Unfrozen working copy of a snapshot; not canonical until freezeCandidate. */
export type CandidateDraft = Record<string, unknown>;

/** Materializes an unfrozen deep clone of the current authoritative snapshot. */
export function cloneStateForCandidate(state: SubjectStateV0): CandidateDraft {
  return structuredClone(state) as unknown as CandidateDraft;
}

/**
 * Applies one domain delta's operations to the draft in given order. Callers must
 * pass deltas sorted by `(domain,producer)` with operations sorted by path, exactly
 * as validated by the P2.1.2 layer; application is plain assignment — no merging,
 * no last-wins across paths (uniqueness was already enforced upstream).
 */
export function applyDeltaOperations(
  draft: CandidateDraft,
  proposal: CanonicalTransitionProposalV1
): void {
  const root = draft as unknown as Record<string, unknown>;
  for (const delta of proposal.domain_deltas) {
    for (const operation of delta.operations) {
      applyOperation(root, operation.path, operation.value);
    }
  }
}

export interface DerivedRuntimeMetadata {
  readonly state_revision: StateRevisionV0;
  readonly logical_time: LogicalTimeV0;
  readonly last_transition_time: LogicalTimeV0;
  readonly last_transition_type: TransitionType;
  readonly updated_at: LogicalTimeV0;
}

/**
 * §6.2 derivation table for one successful commit:
 * - Time elapsed d>0 → logical_time += d, last_transition_time = updated_at = next.
 * - Observation/CognitionAction/Learning → occurrence must EQUAL current logical time;
 *   logical_time unchanged; last_transition_time = updated_at = current logical time.
 * `state_revision` always advances exactly +1; `created_at` is untouched.
 */
export function deriveRuntimeMetadata(
  current: RuntimeMetadataV0,
  transitionType: TransitionType,
  timing:
    | { readonly kind: "ELAPSED"; readonly ticks: number }
    | { readonly kind: "OCCURRENCE"; readonly occurrence: number }
): ValidationResult<DerivedRuntimeMetadata> {
  const nextRevision = current.state_revision + 1;
  if (!Number.isSafeInteger(nextRevision)) {
    return fail("INVARIANT_VIOLATION", "SS-REVISION-001", "state_revision successor not representable");
  }
  if (transitionType === "Time") {
    if (timing.kind !== "ELAPSED") {
      return fail("INVALID_LOGICAL_TIME", TIME_ADV, "Time transitions require ELAPSED time input");
    }
    if (!Number.isSafeInteger(timing.ticks) || timing.ticks < 1) {
      return fail("INVALID_LOGICAL_TIME", TIME_ADV, "committed Time requires elapsed ticks >= 1");
    }
    if (current.logical_time > Number.MAX_SAFE_INTEGER - timing.ticks) {
      return fail("INVALID_LOGICAL_TIME", TIME_ADV, "logical_time advance overflows safe integer domain");
    }
    const nextLogicalTime = current.logical_time + timing.ticks;
    return ok({
      state_revision: nextRevision as StateRevisionV0,
      logical_time: nextLogicalTime as LogicalTimeV0,
      last_transition_time: nextLogicalTime as LogicalTimeV0,
      last_transition_type: "Time",
      updated_at: nextLogicalTime as LogicalTimeV0
    });
  }
  if (timing.kind !== "OCCURRENCE") {
    return fail("INVALID_LOGICAL_TIME", TIME_ADV, `${transitionType} transitions require OCCURRENCE time input`);
  }
  if (timing.occurrence !== current.logical_time) {
    return fail(
      "INVALID_LOGICAL_TIME",
      TIME_ADV,
      `proposal occurrence ${timing.occurrence} must equal current logical_time ${current.logical_time}`
    );
  }
  return ok({
    state_revision: nextRevision as StateRevisionV0,
    logical_time: current.logical_time,
    last_transition_time: current.logical_time,
    last_transition_type: transitionType,
    updated_at: current.logical_time
  });
}

/** Writes derived core-owned runtime metadata onto the draft (created_at untouched). */
export function withDerivedRuntimeMetadata(
  draft: CandidateDraft,
  derived: DerivedRuntimeMetadata
): void {
  const current = structuredClone(draft["runtime_metadata"]) as RuntimeMetadataV0;
  draft["runtime_metadata"] = {
    ...current,
    subject_version: "subject-v0",
    ...derived
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  if (Array.isArray(value)) {
    for (const element of value) deepFreeze(element);
  }
}

/** Freezes the candidate deeply; after this call it is an immutable revision N+1 body. */
export function freezeCandidate(draft: CandidateDraft): SubjectStateV0 {
  deepFreeze(draft);
  return draft as unknown as SubjectStateV0;
}
