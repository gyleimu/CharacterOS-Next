/**
 * P2.1.3 — canonical commit engine orchestrator (pure coordination, injected store).
 * Source: docs/implementation/p2-1-contract-freeze.md §7.2 pipeline steps 6–16,
 * §13.3–§13.4 semantic guards, plan §7.
 *
 * Deterministic guard order per input: envelope re-validation (P2.1.2 layer) →
 * subject match → expected-state-revision precheck → time resolution (NO_OP routing /
 * checked advance / occurrence equality) → required composition → immutable candidate
 * construction → repository binding set validation + memory-adoption boundary (§13.4
 * layer 9) → FULL validateSubjectState over the pre-trace candidate (layer 10) →
 * StateHash before/after → TraceEntry + window projection → defensive FULL
 * re-validation of the frozen successor → SnapshotHash both sides → bundle
 * assembly → single compareAndCommit CAS (R2-J / ATTACK H: no invalid candidate ever
 * receives an authoritative-looking hash/trace/bundle). The engine holds NO state
 * itself; all writes
 * go through the injected AtomicCommitStorePort and producers never touch state
 * directly (Producer != Mutator).
 *
 * Slice boundary (unchanged contracts, external owners): identity journal header
 * (`identity_record_version_before`, `first_seen_sequence`, prior attempts), trusted
 * prepared-record ref, and repository manifests enter as validated inputs/capabilities;
 * OUTCOME_UNKNOWN stays unresolved exactly per §15.2.
 */

import type {
  RepositoryRevisionBindingV1
} from "../types/persistence.js";
import type {
  AtomicCommitBundleAnyVersion
} from "../types/persistence-v2.js";
import type { CanonicalCommitResultV1 } from "../types/result.js";
import type { AuthoritativeTransitionRecordV1 } from "../types/identity.js";
import type {
  HashV1,
  HistorySequenceV0,
  RepositoryRevisionIdV0
} from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { validateSubjectState } from "../validation/subject-state.js";
import { validateHash } from "../validation/scalars.js";
import type { ValidationFailure } from "../validation/result.js";
import {
  prepareCanonicalTransitionEffectV0,
  finalizeCanonicalTransitionEffectV0
} from "../canonical/canonical-transition-effect.js";
import { assembleCommitBundleV2 } from "./bundle-v2.js";
import { productionCommitTargetVersionV0 } from "./version-policy.js";
import { evaluateCommitBundleVersionStepV0 } from "../validation/atomic-commit-bundle.js";
import { validateAtomicCommitBundleV2 } from "../validation/atomic-commit-bundle.js";
import {
  detectReservedRelationshipTargetChangesV0,
  verifyPreparedGovernedWriterAuthorityTokenV0,
  type PreparedGovernedWriterAuthorityTokenV0
} from "./writer-authority-membrane.js";
import { proposalFingerprint, proposalRef } from "../canonical/projections.js";
import type { AtomicCommitStorePort } from "./store.js";

/** Verdict-only inverted capability (§15.1): existence/hash of one immutable revision. */
export type ReferenceValidatorCapability = (
  binding: RepositoryRevisionBindingV1
) => boolean | Promise<boolean>;

/**
 * Verdict-only inverted capability (R2-H / ATTACK F): a canonical memory-binding
 * change may be adopted ONLY when a trusted host proves (1) the revision exists,
 * (2) its manifest/repository hashes are correct, (3) its parent equals the current
 * canonical memory revision, (4) the candidate's memory-bound refs belong to it,
 * (5) payload/intent integrity holds, and (6) no stale/orphan revision is adopted.
 */
export type MemoryAdoptionValidatorCapability = (adoption: {
  readonly subject_id: string;
  readonly current_repository_revision: string;
  readonly next_repository_revision: string;
  readonly next_repository_revision_hash: HashV1 | null;
  readonly candidate_memory_refs: readonly CanonicalRefV0[];
}) => boolean | Promise<boolean>;

/**
 * Test/instrumentation seam (R2-J / ATTACK H): observes the frozen §13.4 pipeline
 * precedence. `authorityPreparation` marks the FIRST canonical hash/trace/bundle
 * computation; it must never fire before the reference/adoption and whole-state
 * gates run.
 */
export interface PipelineStageObserver {
  readonly referenceValidation?: () => void;
  readonly wholeStateValidation?: () => void;
  readonly authorityPreparation?: () => void;
}

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
  /**
   * Trusted current canonical predecessor bundle read (§6,
   * PREDECESSOR_BUNDLE_VERSION_SOURCE_V0 = TRUSTED_CURRENT_CANONICAL_BUNDLE_READ):
   * null exactly at revision 0; ref/checksum/version come from the SAME bundle
   * object. It must match the reread canonical state on subject/next_revision.
   */
  readonly previous_bundle: AtomicCommitBundleAnyVersion | null;
  /** Trusted prepared-record `workflow:` ref minted outside subject-core (§7.6). */
  readonly prepared_result_ref: CanonicalRefV0;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
  readonly reference_validator?: ReferenceValidatorCapability;
  /** R2-H: REQUIRED (fail-closed) whenever the proposal changes the canonical memory binding. */
  readonly memory_adoption_validator?: MemoryAdoptionValidatorCapability;
  /**
   * Governed path ONLY (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0):
   * an opaque, WeakSet-admitted prepared authority token minted by the
   * SubjectCore membrane. NOT a raw CanonicalWriterAuthorityRecordV0 — raw
   * record input is forbidden by construction. When the prepared effect
   * changes a reserved relationship_core_* target, a verified token whose
   * identity binds the EXACT proposal/revision/head is REQUIRED (fail closed
   * before CAS otherwise); ordinary non-governed transitions keep the exact
   * null-authority behavior and must NOT carry a token.
   */
  readonly prepared_governed_writer_authority?: PreparedGovernedWriterAuthorityTokenV0;
}

export type CommitTransitionOutcome =
  | {
      readonly kind: "COMMITTED";
      readonly bundle: AtomicCommitBundleAnyVersion;
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
  readonly pipelineObserver?: PipelineStageObserver;
}): CommitEngine {
  const observer = deps.pipelineObserver;
  return {
    async commitTransition(input: CommitTransitionInput): Promise<CommitTransitionOutcome> {
      // Layers 1–8 via the SHARED canonical transition-effect primitives
      // (ONE_SHARED_IMPLEMENTATION with V2 chain replay): envelope re-validation,
      // subject/revision guards, time resolution + NO_OP routing, required
      // composition, and the deep-cloned pre-trace candidate with deltas +
      // derived core-owned runtime metadata.
      const prepared = await prepareCanonicalTransitionEffectV0({
        predecessor: input.currentState,
        proposal: input.proposal
      });
      if (prepared.kind === "REJECTED") return rejected(prepared.failure);
      if (prepared.kind === "NO_OP") return { kind: "NO_OP" };
      const p = input.proposal;
      const cur = input.currentState;
      const rm = cur.runtime_metadata;
      const draft = prepared.effect.draft;
      const derived = prepared.effect.derived;
      const nextRevision = derived.state_revision;

      // §13.4 layer 9: repository binding set validation + verdict-only capability.
      observer?.referenceValidation?.();
      const bindingFailure = await validateRepositoryBindings(
        cur,
        draft as unknown as SubjectStateV0,
        p,
        input.repository_bindings,
        input.reference_validator
      );
      if (bindingFailure !== null) return rejected(bindingFailure);

      // Memory-content adoption sanity: an adopted revision must be NEW (§7.2).
      const touchesContentRevision = p.domain_deltas.some((delta) =>
        delta.operations.some((operation) => operation.path === "/memory_state/repository_revision")
      );
      if (
        touchesContentRevision &&
        (draft["memory_state"] as Record<string, unknown>)["repository_revision"] ===
          cur.memory_state.repository_revision
      ) {
        return rejected({
          error_code: "INVALID_MEMORY_REVISION",
          reason: "MEM-REV-001",
          detail: "adopted repository revision must differ from the current revision"
        });
      }

      // R2-H: memory adoption boundary. A canonical memory-binding change may only
      // be adopted when a trusted validator confirms it (verdict-only); a missing
      // validator fails closed. Proposals that do not change the binding never
      // touch this gate.
      const draftMemoryRevision = (draft["memory_state"] as Record<string, unknown>)[
        "repository_revision"
      ] as RepositoryRevisionIdV0;
      if (draftMemoryRevision !== cur.memory_state.repository_revision) {
        if (input.memory_adoption_validator === undefined) {
          return rejected({
            error_code: "INVALID_MEMORY_REVISION",
            reason: "MEM-REV-001",
            detail: "memory adoption requires a trusted adoption validator"
          });
        }
        const adoptedBinding = input.repository_bindings.find(
          (binding) => binding.repository_revision === draftMemoryRevision
        );
        const verdict = await input.memory_adoption_validator({
          subject_id: cur.identity.subject_id,
          current_repository_revision: cur.memory_state.repository_revision,
          next_repository_revision: draftMemoryRevision,
          next_repository_revision_hash: adoptedBinding?.repository_revision_hash ?? null,
          candidate_memory_refs: [
            ...((draft["memory_state"] as Record<string, unknown>)["working_refs"] as CanonicalRefV0[]),
            ...((draft["memory_state"] as Record<string, unknown>)[
              "active_episode_refs"
            ] as CanonicalRefV0[])
          ]
        });
        if (verdict !== true) {
          return rejected({
            error_code: "INVALID_MEMORY_REVISION",
            reason: "MEM-REV-001",
            detail: `memory adoption validator rejected ${draftMemoryRevision}`
          });
        }
      }

      // §13.4 layer 10 (R2-J / P0-3): FULL whole-state validation BEFORE any
      // canonical hash/trace/bundle authority work. Individually valid deltas that
      // compose into a whole-state violation (timestamps past logical_time,
      // cross-field inconsistency, readonly drift) must NEVER receive an
      // authoritative-looking projection. The §10.3 trace-linkage invariants tie to
      // the PREVIOUS revision here: the trace window projection is appended only
      // after this gate passes.
      observer?.wholeStateValidation?.();
      const candidateValidation = validateSubjectState(draft, {
        preTraceWindowRevision: rm.state_revision
      });
      if (!candidateValidation.ok) return rejected(candidateValidation.error);

      // §13.4 layer 11 via the SHARED finalize primitive: canonical hashes,
      // trace entry + bounded window projection, frozen successor, defensive
      // full re-validation and snapshot hashes.
      observer?.authorityPreparation?.();
      const finalized = await finalizeCanonicalTransitionEffectV0({
        predecessor: cur,
        proposal: p,
        draft,
        derived
      });
      if (finalized.kind === "REJECTED") return rejected(finalized.failure);
      const effect = finalized.effect;
      const stateHashBefore = effect.state_hash_before;
      const stateHashAfter = effect.state_hash_after;
      const snapshotHashBefore = effect.snapshot_hash_before;
      const snapshotHashAfter = effect.snapshot_hash_after;
      const traceEntry = effect.trace_entry;

      // Steps 12–14: full bundle assembly (deep-frozen evidence).
      // §6 predecessor-bundle consistency: ref/checksum/version come from the
      // SAME trusted current canonical bundle object, which must match the
      // reread canonical state on subject and next_revision. Fail closed
      // BEFORE assembly/CAS on missing/inconsistent positive predecessors.
      const previousBundle = input.previous_bundle;
      if (previousBundle === null) {
        if (rm.state_revision !== 0) {
          return rejected({
            error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
            reason: "SS-RESTORE-001",
            detail: `positive revision ${rm.state_revision} requires a trusted current canonical predecessor bundle`
          });
        }
      } else {
        if (previousBundle.subject_id !== cur.identity.subject_id) {
          return rejected({
            error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
            reason: "SS-RESTORE-001",
            detail: "predecessor bundle subject does not match the reread canonical state"
          });
        }
        if (previousBundle.next_revision !== rm.state_revision) {
          return rejected({
            error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
            reason: "SS-RESTORE-001",
            detail: `predecessor bundle next_revision ${previousBundle.next_revision} does not match canonical state revision ${rm.state_revision}`
          });
        }
        // §7: version monotonicity via the EXISTING version-step primitive —
        // never a copied law. Target is the forward-only production version.
        const step = evaluateCommitBundleVersionStepV0(
          previousBundle.commit_version,
          productionCommitTargetVersionV0()
        );
        if (step !== "ALLOWED") {
          return rejected({
            error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
            reason: "SS-RESTORE-001",
            detail: `version step ${previousBundle.commit_version} -> ${productionCommitTargetVersionV0()} is not allowed`
          });
        }
      }

      // RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §30: reserved-write
      // guard. A prepared effect that changes a reserved relationship_core_*
      // target REQUIRES a verified internal prepared authority token binding
      // the EXACT proposal/revision/head — fail closed BEFORE assembly/CAS.
      // Ordinary non-governed transitions keep the exact null-authority
      // behavior (GOVERNED_RESERVED_WRITE_WITHOUT_WRITER_AUTHORITY only fires
      // for reserved targets). Removal of a governed target is unsupported.
      const reservedChanges = detectReservedRelationshipTargetChangesV0(cur, effect.successor);
      if (!reservedChanges.ok) {
        return rejected({
          error_code: "INVALID_TRANSITION_COMPOSITION",
          reason: "FAIL-PREPARE-001",
          detail: `reserved-target detection failed: ${reservedChanges.detail}`
        });
      }
      let governedToken: PreparedGovernedWriterAuthorityTokenV0 | null = null;
      if (reservedChanges.changes.length > 0) {
        if (reservedChanges.changes.length > 1) {
          return rejected({
            error_code: "INVALID_TRANSITION_COMPOSITION",
            reason: "FAIL-PREPARE-001",
            detail: `governed target cardinality: exactly ONE governed Relationship target is supported, got ${reservedChanges.changes.length}`
          });
        }
        const change = reservedChanges.changes[0];
        if (change === undefined) {
          return rejected({
            error_code: "INVALID_TRANSITION_COMPOSITION",
            reason: "FAIL-PREPARE-001",
            detail: "governed target cardinality: change record missing"
          });
        }
        if (change.kind === "REMOVED") {
          return rejected({
            error_code: "FORBIDDEN_DIRECT_MUTATION",
            reason: "FAIL-PREPARE-001",
            detail: `governed feature removal is unsupported (${change.counterpart_ref} ${change.dimension_id})`
          });
        }
        if (p.domain_deltas.length !== 1 || p.domain_deltas[0]?.domain !== "relationship") {
          return rejected({
            error_code: "INVALID_TRANSITION_COMPOSITION",
            reason: "FAIL-PREPARE-001",
            detail: "a governed Relationship write requires exactly one relationship-domain delta (no cross-domain mix)"
          });
        }
        const governedDelta = p.domain_deltas[0];
        if (
          governedDelta === undefined ||
          governedDelta.operations.length !== 1 ||
          governedDelta.operations[0]?.path !== "/relationships"
        ) {
          return rejected({
            error_code: "INVALID_TRANSITION_COMPOSITION",
            reason: "FAIL-PREPARE-001",
            detail: "a governed Relationship write requires exactly one /relationships replacement operation"
          });
        }
        const token = input.prepared_governed_writer_authority;
        if (token === undefined) {
          return rejected({
            error_code: "FORBIDDEN_DIRECT_MUTATION",
            reason: "FAIL-PREPARE-001",
            detail: `governed reserved write without writer authority is forbidden (${change.counterpart_ref} ${change.dimension_id})`
          });
        }
        const admission = verifyPreparedGovernedWriterAuthorityTokenV0(token);
        if (!admission.ok) {
          return rejected({
            error_code: "FORBIDDEN_DIRECT_MUTATION",
            reason: "FAIL-PREPARE-001",
            detail: `prepared governed authority token rejected (${admission.code})`
          });
        }
        const [tokenProposalRef, tokenPayloadFingerprint] = await Promise.all([
          proposalRef(p),
          proposalFingerprint(p)
        ]);
        const expectedHeadRef = previousBundle?.commit_ref ?? null;
        const identityOk =
          admission.token.proposal_ref === tokenProposalRef &&
          admission.token.payload_fingerprint === tokenPayloadFingerprint &&
          admission.token.subject_id === cur.identity.subject_id &&
          admission.token.expected_revision === rm.state_revision &&
          admission.token.history_head_commit_ref === expectedHeadRef;
        if (!identityOk) {
          return rejected({
            error_code: "FORBIDDEN_DIRECT_MUTATION",
            reason: "FAIL-PREPARE-001",
            detail: "prepared governed authority token does not bind the exact proposal/subject/revision/head (stale, wrong proposal, or wrong head)"
          });
        }
        governedToken = admission.token;
      } else if (input.prepared_governed_writer_authority !== undefined) {
        return rejected({
          error_code: "FORBIDDEN_DIRECT_MUTATION",
          reason: "FAIL-PREPARE-001",
          detail: "a prepared governed authority token was supplied for a transition that changes no governed reserved target"
        });
      }

      // Forward-only production emission: EVERY new successful commit
      // assembles directly as AtomicCommitBundleV2 (writer_authority = null).
      // No V1 fallback: an invalid V2 assembly/validation fails closed.
      if (productionCommitTargetVersionV0() !== "atomic-commit-v2") {
        return rejected({
          error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
          reason: "SS-RESTORE-001",
          detail: "post-cutover production target must be atomic-commit-v2"
        });
      }
      const bundle = await assembleCommitBundleV2({
        proposal: p,
        currentState: cur,
        candidate: effect.successor,
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
        previous_commit_ref: previousBundle?.commit_ref ?? null,
        previous_record_checksum: previousBundle?.record_checksum ?? null,
        previous_trace_ref: effect.previous_trace_ref,
        prepared_result_ref: input.prepared_result_ref,
        repository_revision_bindings: input.repository_bindings,
        ...(governedToken !== null ? { writer_authority_token: governedToken } : {})
      });

      // §14: PRE-CAS closed V2 validation. An invalid production bundle never
      // reaches the store CAS and never falls back to V1 — fail closed.
      const preCas = await validateAtomicCommitBundleV2(bundle);
      if (!preCas.ok) {
        return rejected({
          error_code: "COMMIT_CHAIN_INTEGRITY_FAILURE",
          reason: "SS-RESTORE-001",
          detail: `pre-CAS V2 validation failed: ${preCas.error.detail}`
        });
      }

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
