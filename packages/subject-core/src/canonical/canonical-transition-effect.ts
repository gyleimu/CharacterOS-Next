/**
 * Shared canonical transition-effect primitives (V0)
 * (CHARACTEROS_ATOMIC_COMMIT_CHAIN_VALIDATOR_V0,
 * V2_TRANSITION_APPLICATION_REUSE_STRATEGY = ONE_SHARED_IMPLEMENTATION).
 *
 * The deterministic transition-effect law — proposal admission guards, runtime
 * metadata derivation, delta application onto a deep-cloned draft, canonical
 * hashes, trace entry + bounded window projection, successor freezing and
 * snapshot hashes — exists HERE exactly once. The production V1 commit engine
 * and the pure V2 chain replay both call these SAME primitives; there is no
 * second copy of the transition law.
 *
 * Deliberately NOT part of the effect: live-process authority gates (repository
 * reference validation, memory-adoption verdicts, capability checks, journal
 * reservation) — those stay in the production engine in their frozen order and
 * are NOT replayed by chain validation. Bundle assembly likewise stays
 * engine-side.
 *
 * All functions are pure: no store, no model, no network, no host verdict, no
 * mutation of inputs, no wall clock.
 */

import type { HashV1, RepositoryRevisionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import {
  readSubjectStateSchemaVersion,
  type SubjectStateAnyVersionV0
} from "../types/subject-state-v4.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { TraceEntryV1, TraceWindowV1 } from "../types/trace.js";
import type { ValidationFailure } from "../validation/result.js";
import {
  applyDeltaOperations,
  cloneStateForCandidate,
  deriveRuntimeMetadata,
  freezeCandidate,
  withDerivedRuntimeMetadata,
  type CandidateDraft,
  type DerivedRuntimeMetadata
} from "../candidate/candidate.js";
import { validateProposal } from "../validation/proposal.js";
import {
  validateOrdinaryStateSchemaContinuityV0,
  validateProposalCompatibilityWithPredecessorV0,
  validateSubjectStateAnyVersionV0
} from "../validation/subject-state-any-version.js";
import { validateProposalCompositionForStateVersion } from "../commit/composition.js";
import { proposalRef, snapshotHashAnyVersion, stateHashAnyVersion } from "./projections.js";
import { buildTraceEntry, lastTraceRef, nextTraceWindow } from "../trace/trace.js";

// ---- prepare -----------------------------------------------------------------------

/** The pre-trace canonical candidate plus its derived core-owned metadata. */
export interface PreparedCanonicalTransitionEffectV0<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> {
  /** Unfrozen deep-cloned draft with deltas + derived metadata applied. */
  readonly draft: CandidateDraft<TState>;
  readonly derived: DerivedRuntimeMetadata;
}

export type PrepareCanonicalTransitionEffectOutcomeV0<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> =
  | { readonly kind: "PREPARED"; readonly effect: PreparedCanonicalTransitionEffectV0<TState> }
  | {
      /** Time elapsed=0 with zero deltas — terminalization is runtime-owned. */
      readonly kind: "NO_OP";
    }
  | { readonly kind: "REJECTED"; readonly failure: ValidationFailure };

/**
 * Deterministic pre-trace effect: envelope re-validation, subject/revision
 * guards, time resolution (incl. the elapsed-0/zero-delta NO_OP routing),
 * required composition, deep-cloned draft with delta operations and derived
 * core-owned runtime metadata. Whole-state validation of the draft stays with
 * the caller so live-process gates keep their frozen position between draft
 * construction and canonical hash/trace work.
 */
export async function prepareCanonicalTransitionEffectV0<TState extends SubjectStateAnyVersionV0>(input: {
  readonly predecessor: TState;
  readonly proposal: CanonicalTransitionProposalV1;
}): Promise<PrepareCanonicalTransitionEffectOutcomeV0<TState>> {
  const syntax = validateProposal(input.proposal);
  if (!syntax.ok) return { kind: "REJECTED", failure: syntax.error };
  const p = input.proposal;
  const cur = input.predecessor;
  const rm = cur.runtime_metadata;

  if (readSubjectStateSchemaVersion(cur) === null) {
    return {
      kind: "REJECTED",
      failure: {
        error_code: "INVALID_SCHEMA",
        reason: "SS-SCHEMA-001",
        detail: "predecessor schema_version is unsupported"
      }
    };
  }
  const compatibility = validateProposalCompatibilityWithPredecessorV0(cur, p);
  if (!compatibility.ok) return { kind: "REJECTED", failure: compatibility.error };

  if (p.subject_id !== cur.identity.subject_id) {
    return {
      kind: "REJECTED",
      failure: {
        error_code: "UNKNOWN_SUBJECT",
        reason: "SS-AUTH-001",
        detail: `proposal subject ${p.subject_id} does not match authoritative ${cur.identity.subject_id}`
      }
    };
  }
  if (p.expected_state_revision !== rm.state_revision) {
    return {
      kind: "REJECTED",
      failure: {
        error_code: "STALE_STATE_REVISION",
        reason: "SS-REVISION-001",
        detail: `expected ${p.expected_state_revision} != current ${rm.state_revision}`
      }
    };
  }

  if (p.transition_type === "Time") {
    if (p.time_input.kind !== "ELAPSED") {
      return {
        kind: "REJECTED",
        failure: {
          error_code: "INVALID_LOGICAL_TIME",
          reason: "TIME-ADVANCE-001",
          detail: "Time transitions require ELAPSED time input"
        }
      };
    }
    if (p.time_input.elapsed_time.value === 0) {
      if (p.domain_deltas.length === 0) {
        return { kind: "NO_OP" };
      }
      const zeroDeltaComposition = validateProposalCompositionForStateVersion(cur, p);
      if (!zeroDeltaComposition.ok) {
        return { kind: "REJECTED", failure: zeroDeltaComposition.error };
      }
    }
  }

  const timing =
    p.time_input.kind === "ELAPSED"
      ? ({ kind: "ELAPSED", ticks: p.time_input.elapsed_time.value } as const)
      : ({ kind: "OCCURRENCE", occurrence: p.time_input.occurrence_logical_time } as const);
  const derived = deriveRuntimeMetadata(rm, p.transition_type, timing);
  if (!derived.ok) return { kind: "REJECTED", failure: derived.error };
  const composition = validateProposalCompositionForStateVersion(cur, p);
  if (!composition.ok) return { kind: "REJECTED", failure: composition.error };

  const draft = cloneStateForCandidate(cur);
  applyDeltaOperations(draft, p);
  withDerivedRuntimeMetadata(draft, derived.value);
  return { kind: "PREPARED", effect: { draft, derived: derived.value } };
}

// ---- finalize ----------------------------------------------------------------------

/** The complete committed canonical effect of one transition. */
export interface FinalizedCanonicalTransitionEffectV0<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> {
  /** Frozen, trace-complete successor snapshot (revision N+1). */
  readonly successor: TState;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_entry: TraceEntryV1;
  readonly trace_window: TraceWindowV1;
  /** lastTraceRef(predecessor.trace_window) — mutation-history continuity data. */
  readonly previous_trace_ref: CanonicalRefV0 | null;
  readonly logical_time_before: number;
  readonly logical_time_after: number;
  readonly revision_before: number;
  readonly revision_after: number;
}

export type FinalizeCanonicalTransitionEffectOutcomeV0<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> =
  | { readonly kind: "FINALIZED"; readonly effect: FinalizedCanonicalTransitionEffectV0<TState> }
  | { readonly kind: "REJECTED"; readonly failure: ValidationFailure };

/**
 * Deterministic canonical hash/trace/finalization of an already-gated
 * pre-trace candidate: StateHash both sides, proposal ref, committed trace
 * entry, bounded window projection onto the draft, deep freeze, defensive
 * full successor re-validation and SnapshotHash both sides. MUST be called
 * only after every live-process authority gate has passed (engine) or in pure
 * replay (chain validation).
 */
export async function finalizeCanonicalTransitionEffectV0<TState extends SubjectStateAnyVersionV0>(input: {
  readonly predecessor: TState;
  readonly proposal: CanonicalTransitionProposalV1;
  readonly draft: CandidateDraft<TState>;
  readonly derived: DerivedRuntimeMetadata;
}): Promise<FinalizeCanonicalTransitionEffectOutcomeV0<TState>> {
  const cur = input.predecessor;
  const p = input.proposal;
  const draft = input.draft;
  const derived = input.derived;
  const nextRevision = derived.state_revision;

  const preTraceValidation = validateSubjectStateAnyVersionV0(draft, {
    preTraceWindowRevision: cur.runtime_metadata.state_revision
  });
  if (!preTraceValidation.ok) {
    return { kind: "REJECTED", failure: preTraceValidation.error };
  }
  const stateHashBefore = await stateHashAnyVersion(cur);
  const stateHashAfter = await stateHashAnyVersion(preTraceValidation.value);
  const pref = await proposalRef(p);
  const traceEntry = await buildTraceEntry({
    proposal: p,
    proposal_ref: pref,
    revision_before: cur.runtime_metadata.state_revision,
    revision_after: nextRevision,
    logical_time: derived.logical_time,
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    memory_revision_before: cur.memory_state.repository_revision,
    memory_revision_after: draft.memory_state.repository_revision as RepositoryRevisionIdV0
  });
  const nextWindow = nextTraceWindow(cur.trace_window, traceEntry, nextRevision);
  draft["trace_window"] = nextWindow;
  const candidate = freezeCandidate(draft);

  const continuity = validateOrdinaryStateSchemaContinuityV0(cur, candidate);
  if (!continuity.ok) return { kind: "REJECTED", failure: continuity.error };
  const finalValidation = validateSubjectStateAnyVersionV0(candidate);
  if (!finalValidation.ok) return { kind: "REJECTED", failure: finalValidation.error };

  const snapshotHashBefore = await snapshotHashAnyVersion(cur, {
    state_hash: stateHashBefore,
    subject_id: cur.identity.subject_id,
    state_revision: cur.runtime_metadata.state_revision,
    trace_cursor: cur.trace_window.cursor,
    last_trace_ref: lastTraceRef(cur.trace_window)
  });
  const snapshotHashAfter = await snapshotHashAnyVersion(candidate, {
    state_hash: stateHashAfter,
    subject_id: cur.identity.subject_id,
    state_revision: nextRevision,
    trace_cursor: nextWindow.cursor,
    last_trace_ref: traceEntry.trace_id
  });

  return {
    kind: "FINALIZED",
    effect: {
      successor: candidate,
      state_hash_before: stateHashBefore,
      state_hash_after: stateHashAfter,
      snapshot_hash_before: snapshotHashBefore,
      snapshot_hash_after: snapshotHashAfter,
      trace_entry: traceEntry,
      trace_window: nextWindow,
      previous_trace_ref: lastTraceRef(cur.trace_window),
      logical_time_before: cur.runtime_metadata.logical_time,
      logical_time_after: derived.logical_time,
      revision_before: cur.runtime_metadata.state_revision,
      revision_after: nextRevision
    }
  };
}

// ---- replay ------------------------------------------------------------------------

export type ReplayCanonicalTransitionEffectOutcomeV0<
  TState extends SubjectStateAnyVersionV0 = SubjectStateV0
> =
  | { readonly kind: "REPLAYED"; readonly effect: FinalizedCanonicalTransitionEffectV0<TState> }
  | { readonly kind: "REJECTED"; readonly failure: ValidationFailure };

/**
 * Pure V2 chain replay: prepared effect + whole-state draft validation +
 * finalization, from a validated predecessor and the PERSISTED canonical
 * proposal. No store access, no model, no network, no host verdict, no input
 * mutation. NO_OP outcomes cannot occur on a committed chain (a NO_OP never
 * produced a bundle); if the persisted proposal classifies as NO_OP the replay
 * fails closed.
 */
export async function replayCanonicalTransitionEffectV0<TState extends SubjectStateAnyVersionV0>(input: {
  readonly predecessor: TState;
  readonly proposal: CanonicalTransitionProposalV1;
}): Promise<ReplayCanonicalTransitionEffectOutcomeV0<TState>> {
  const prepared = await prepareCanonicalTransitionEffectV0({
    predecessor: input.predecessor,
    proposal: input.proposal
  });
  if (prepared.kind === "REJECTED") return prepared;
  if (prepared.kind === "NO_OP") {
    return {
      kind: "REJECTED",
      failure: {
        error_code: "INVALID_SCHEMA",
        reason: "SS-SCHEMA-001",
        detail:
          "persisted canonical proposal classifies as NO_OP; committed chains never contain NO_OP records"
      }
    };
  }
  const draftValidation = validateSubjectStateAnyVersionV0(prepared.effect.draft, {
    preTraceWindowRevision: input.predecessor.runtime_metadata.state_revision
  });
  if (!draftValidation.ok) return { kind: "REJECTED", failure: draftValidation.error };
  const finalized = await finalizeCanonicalTransitionEffectV0({
    predecessor: input.predecessor,
    proposal: input.proposal,
    draft: prepared.effect.draft,
    derived: prepared.effect.derived
  });
  if (finalized.kind === "REJECTED") return finalized;
  return { kind: "REPLAYED", effect: finalized.effect };
}
