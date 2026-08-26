/**
 * P2.1.3 — canonical commit engine orchestrator (pure coordination, injected store).
 * Source: docs/implementation/p2-1-contract-freeze.md §7.2 pipeline steps 6–16,
 * §13.3–§13.4 semantic guards, plan §7.
 *
 * Deterministic guard order per input: envelope re-validation (P2.1.2 layer) →
 * subject match → expected-state-revision precheck → time resolution (NO_OP routing /
 * checked advance / occurrence equality) → required composition → immutable candidate
 * construction → StateHash before/after → TraceEntry + window projection → SnapshotHash
 * both sides → repository binding set validation (verdict-only capability) → bundle
 * assembly → single compareAndCommit CAS. The engine holds NO state itself; all writes
 * go through the injected AtomicCommitStorePort and producers never touch state
 * directly (Producer != Mutator).
 *
 * Slice boundary (unchanged contracts, external owners): identity journal header
 * (`identity_record_version_before`, `first_seen_sequence`, prior attempts), trusted
 * prepared-record ref, and repository manifests enter as validated inputs/capabilities;
 * OUTCOME_UNKNOWN stays unresolved exactly per §15.2.
 */

import type { AtomicCommitBundleV1, RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { CanonicalCommitResultV1 } from "../types/result.js";
import type { AuthoritativeTransitionRecordV1 } from "../types/identity.js";
import type { HashV1, HistorySequenceV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { validateProposal } from "../validation/proposal.js";
import { validateSubjectState } from "../validation/subject-state.js";
import { validateHash } from "../validation/scalars.js";
import type { ValidationFailure } from "../validation/result.js";
import {
  applyDeltaOperations,
  cloneStateForCandidate,
  deriveRuntimeMetadata,
  freezeCandidate,
  withDerivedRuntimeMetadata,
  type CandidateDraft
} from "../candidate/candidate.js";
import { stateHash, proposalRef, snapshotHash } from "../canonical/projections.js";
import { buildTraceEntry, lastTraceRef, nextTraceWindow } from "../trace/trace.js";
import { validateProposalComposition } from "./composition.js";
import { assembleCommitBundle } from "./bundle.js";
import type { AtomicCommitStorePort } from "./store.js";

/** Verdict-only inverted capability (§15.1): existence/hash of one immutable revision. */
export type ReferenceValidatorCapability = (
  binding: RepositoryRevisionBindingV1
) => boolean | Promise<boolean>;

export interface CommitTransitionInput {
  /** Complete canonical proposal; syntax is re-validated defensively. */
  readonly proposal: CanonicalTransitionProposalV1;
  /** Current authoritative immutable snapshot (trusted read). */
  readonly currentState: SubjectStateV0;
  /** Exact OPEN journal record version consumed for this attempt (§14.1). */
  readonly identity_record_version_before: number;
  /** Journal-local first-seen sequence of this transition identity (§14.2). */
  readonly first_seen_sequence: number;
  /** Prior durable attempts of the OPEN record (append-only successor semantics). */
  readonly prior_attempts: AuthoritativeTransitionRecordV1["attempts"];
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  /** Trusted prepared-record `workflow:` ref minted outside subject-core (§7.6). */
  readonly prepared_result_ref: CanonicalRefV0;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
  readonly reference_validator?: ReferenceValidatorCapability;
}

export type CommitTransitionOutcome =
  | {
      readonly kind: "COMMITTED";
      readonly bundle: AtomicCommitBundleV1;
      readonly result: CanonicalCommitResultV1;
    }
  | {
      /** Time elapsed=0 with zero deltas; terminalization is runtime-owned (§5.2). */
      readonly kind: "NO_OP";
    }
  | { readonly kind: "REJECTED"; readonly failure: ValidationFailure }
  | { readonly kind: "ABORTED"; readonly failure: ValidationFailure }
  | { readonly kind: "UNRESOLVED" };

function rejected(failure: ValidationFailure): CommitTransitionOutcome {
  return { kind: "REJECTED", failure };
}

const SERVICE_UNAVAILABLE: ValidationFailure = {
  error_code: "SERVICE_UNAVAILABLE",
  reason: "FAIL-PRECOMMIT-001",
  detail: "atomic commit failed definite-not-committed"
};

/**
 * §15.2 equality 12: bindings are exactly the sorted distinct union of current/next
 * snapshot repository + autobiographical revisions plus non-null memory-delta
 * expected revisions; every entry validates through the verdict-only capability.
 */
async function validateRepositoryBindings(
  currentState: SubjectStateV0,
  candidate: SubjectStateV0,
  proposal: CanonicalTransitionProposalV1,
  bindings: readonly RepositoryRevisionBindingV1[],
  referenceValidator?: ReferenceValidatorCapability
): Promise<ValidationFailure | null> {
  const MEM_REV: ValidationFailure = {
    error_code: "INVALID_MEMORY_REVISION",
    reason: "MEM-REV-001",
    detail: ""
  };
  const expected = new Set<string>([
    currentState.memory_state.repository_revision,
    candidate.memory_state.repository_revision
  ]);
  for (const state of [currentState, candidate]) {
    const auto = state.memory_state.autobiographical_index_revision;
    if (auto !== null) expected.add(auto);
  }
  for (const delta of proposal.domain_deltas) {
    if (delta.expected_repository_revision !== null) {
      expected.add(delta.expected_repository_revision);
    }
  }
  let previous: string | undefined;
  for (const binding of bindings) {
    const hashCheck = validateHash(binding.repository_revision_hash, "repository_revision_hash");
    if (!hashCheck.ok) {
      return { ...MEM_REV, detail: `binding ${binding.repository_revision}: malformed hash` };
    }
    if (previous !== undefined && !(binding.repository_revision > previous)) {
      return {
        ...MEM_REV,
        detail: `bindings must be unique and sorted by repository_revision (${previous} -> ${binding.repository_revision})`
      };
    }
    if (!expected.has(binding.repository_revision)) {
      return {
        ...MEM_REV,
        detail: `unrelated binding ${binding.repository_revision} is not part of the transition revision set`
      };
    }
    if (referenceValidator !== undefined) {
      const verdict = await referenceValidator(binding);
      if (verdict !== true) {
        return { ...MEM_REV, detail: `reference validator rejected ${binding.repository_revision}` };
      }
    }
    previous = binding.repository_revision;
  }
  for (const id of expected) {
    if (!bindings.some((binding) => binding.repository_revision === id)) {
      return { ...MEM_REV, detail: `missing binding for ${id}` };
    }
  }
  return null;
}

export interface CommitEngine {
  commitTransition(input: CommitTransitionInput): Promise<CommitTransitionOutcome>;
}

export function createCommitEngine(deps: {
  readonly store: AtomicCommitStorePort;
}): CommitEngine {
  return {
    async commitTransition(input: CommitTransitionInput): Promise<CommitTransitionOutcome> {
      // Layer 1 (defensive re-validation of the complete envelope).
      const syntax = validateProposal(input.proposal);
      if (!syntax.ok) return rejected(syntax.error);
      const p = input.proposal;
      const cur = input.currentState;
      const rm = cur.runtime_metadata;

      // Pre-context guards (§13.4 layers 2/4).
      if (p.subject_id !== cur.identity.subject_id) {
        return rejected({
          error_code: "UNKNOWN_SUBJECT",
          reason: "SS-AUTH-001",
          detail: `proposal subject ${p.subject_id} does not match authoritative ${cur.identity.subject_id}`
        });
      }
      if (p.expected_state_revision !== rm.state_revision) {
        return rejected({
          error_code: "STALE_STATE_REVISION",
          reason: "SS-REVISION-001",
          detail: `expected ${p.expected_state_revision} != current ${rm.state_revision}`
        });
      }

      // Time resolution + NO_OP routing (runtime-owned classification surfaced here).
      if (p.transition_type === "Time") {
        if (p.time_input.kind !== "ELAPSED") {
          return rejected({
            error_code: "INVALID_LOGICAL_TIME",
            reason: "TIME-ADVANCE-001",
            detail: "Time transitions require ELAPSED time input"
          });
        }
        if (p.time_input.elapsed_time.value === 0) {
          if (p.domain_deltas.length === 0) {
            return { kind: "NO_OP" };
          }
          const zeroDeltaComposition = validateProposalComposition(p);
          if (!zeroDeltaComposition.ok) return rejected(zeroDeltaComposition.error);
        }
      }

      const timing =
        p.time_input.kind === "ELAPSED"
          ? ({ kind: "ELAPSED", ticks: p.time_input.elapsed_time.value } as const)
          : ({ kind: "OCCURRENCE", occurrence: p.time_input.occurrence_logical_time } as const);
      const derived = deriveRuntimeMetadata(rm, p.transition_type, timing);
      if (!derived.ok) return rejected(derived.error);

      // Layer 7: required composition.
      const composition = validateProposalComposition(p);
      if (!composition.ok) return rejected(composition.error);

      // Step 9: deterministic candidate on a deep clone (current snapshot untouched).
      const draft: CandidateDraft = cloneStateForCandidate(cur);
      applyDeltaOperations(draft, p);
      withDerivedRuntimeMetadata(draft, derived.value);
      const nextRevision = derived.value.state_revision;

      // Steps 11–12: hashes and trace/window projection.
      const stateHashBefore = await stateHash(cur);
      const stateHashAfter = await stateHash(draft as unknown as SubjectStateV0);
      const pref = await proposalRef(p);
      const traceEntry = await buildTraceEntry({
        proposal: p,
        proposal_ref: pref,
        revision_before: rm.state_revision,
        revision_after: nextRevision,
        logical_time: derived.value.logical_time,
        state_hash_before: stateHashBefore,
        state_hash_after: stateHashAfter,
        memory_revision_before: cur.memory_state.repository_revision,
        memory_revision_after: (draft["memory_state"] as Record<string, unknown>)[
          "repository_revision"
        ] as string
      });
      const nextWindow = nextTraceWindow(cur.trace_window, traceEntry, nextRevision);
      draft["trace_window"] = nextWindow;
      const candidate = freezeCandidate(draft);

      // P0-3: FULL candidate validation before any authority computation. Individually
      // valid deltas that compose into a whole-state violation (timestamps past
      // logical_time, cross-field inconsistency, readonly drift, trace/cursor
      // corruption) must NEVER be hashed and committed as authoritative truth.
      const candidateValidation = validateSubjectState(candidate);
      if (!candidateValidation.ok) return rejected(candidateValidation.error);

      // Memory-content adoption sanity: an adopted revision must be NEW (§7.2).
      const touchesContentRevision = p.domain_deltas.some((delta) =>
        delta.operations.some((operation) => operation.path === "/memory_state/repository_revision")
      );
      if (
        touchesContentRevision &&
        candidate.memory_state.repository_revision === cur.memory_state.repository_revision
      ) {
        return rejected({
          error_code: "INVALID_MEMORY_REVISION",
          reason: "MEM-REV-001",
          detail: "adopted repository revision must differ from the current revision"
        });
      }

      // Snapshot hashes bind state to exact trace positions (§8.4).
      const snapshotHashBefore = await snapshotHash({
        state_hash: stateHashBefore,
        subject_id: cur.identity.subject_id,
        state_revision: rm.state_revision,
        trace_cursor: cur.trace_window.cursor,
        last_trace_ref: lastTraceRef(cur.trace_window)
      });
      const snapshotHashAfter = await snapshotHash({
        state_hash: stateHashAfter,
        subject_id: cur.identity.subject_id,
        state_revision: nextRevision,
        trace_cursor: nextWindow.cursor,
        last_trace_ref: traceEntry.trace_id
      });

      // Layer 9-equivalent: repository binding set + verdict-only capability.
      const bindingFailure = await validateRepositoryBindings(
        cur,
        candidate,
        p,
        input.repository_bindings,
        input.reference_validator
      );
      if (bindingFailure !== null) return rejected(bindingFailure);

      // Steps 12–14: full bundle assembly (deep-frozen evidence).
      const bundle = await assembleCommitBundle({
        proposal: p,
        currentState: cur,
        candidate,
        state_hash_before: stateHashBefore,
        state_hash_after: stateHashAfter,
        snapshot_hash_before: snapshotHashBefore,
        snapshot_hash_after: snapshotHashAfter,
        trace_entry: traceEntry,
        expected_revision: rm.state_revision,
        next_revision: nextRevision,
        identity_record_version_before: input.identity_record_version_before,
        first_seen_sequence: input.first_seen_sequence as unknown as HistorySequenceV0,
        prior_attempts: input.prior_attempts,
        previous_commit_ref: input.previous_commit_ref,
        previous_record_checksum: input.previous_record_checksum,
        prepared_result_ref: input.prepared_result_ref,
        repository_revision_bindings: input.repository_bindings
      });

      // Step 15–16: single atomic authority point; outcomes map verbatim (§15.2).
      const outcome = await deps.store.compareAndCommit(rm.state_revision, input.identity_record_version_before, bundle);
      switch (outcome.outcome) {
        case "COMMITTED":
          return { kind: "COMMITTED", bundle: outcome.bundle, result: outcome.bundle.canonical_result };
        case "CONFLICT":
          return rejected({
            error_code: "COMMIT_CONFLICT",
            reason: "FAIL-CAS-001",
            detail: "compare-and-commit lost at the authority point"
          });
        case "FAILURE":
          if (outcome.certainty === "OUTCOME_UNKNOWN") {
            return { kind: "UNRESOLVED" };
          }
          return { kind: "ABORTED", failure: SERVICE_UNAVAILABLE };
        default: {
          const exhaustive: never = outcome;
          void exhaustive;
          return { kind: "UNRESOLVED" };
        }
      }
    }
  };
}

/** Re-export for typed consumers assembling their own record views. */
export type { AuthoritativeTransitionRecordV1 };
