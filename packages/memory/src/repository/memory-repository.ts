/**
 * P2.2.1 — MemoryRepository infrastructure contract (types-only port).
 * Source: docs/implementation/p2-1-contract-freeze.md §15.1 (ReferenceValidator),
 * §16 (retrieval ownership chain), plan §3 (`persistence-ports` / `validation/references`).
 *
 * ARCHITECTURE (unchanged):
 * - MemoryRepository is INFRASTRUCTURE. Adapters choose storage; this contract never
 *   selects a database, filesystem, vector index or any vendor.
 * - Subject Core does NOT depend on memory: it consumes inverted verdict-only
 *   capabilities. This package implements those verdicts — existence/hash of a
 *   revision and membership of bound refs — and returns no payload through them.
 * - Memory does not own SubjectState: it prepares immutable revisions and returns
 *   refs only; adoption into canonical state happens exclusively via subject-core
 *   commits (Producer != Mutator: the memory producer computes deltas, subject-core
 *   remains the sole canonical mutator).
 * - Retrieval algorithms/ranking are OUT OF SCOPE here (later phase owns them); this
 *   contract deliberately exposes no query surface.
 */

import type {
  CanonicalRefV0,
  HashV1,
  RepositoryRevisionBindingV1,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import type {
  MemoryPrepareIntentV1,
  PreparedRevisionV0,
  RevisionPrepareRequestV0
} from "../revisions.js";

/**
 * P2.3 Round 2 (ATTACK F / R2-G): the SANCTIONED Learning-facing memory authority.
 * Preparation is intent-driven only (`prepareRevisionForIntent` — intent identity,
 * payload fingerprint, parent revision, repository-owned payloads). It never exposes
 * the raw revision-minting path, so intent-level idempotency cannot be bypassed
 * through the runtime-facing boundary.
 */
export interface MemoryPreparationAuthority {
  /** Registers repository-owned immutable content for one ref (content-hash verdict). */
  storePayload(ref: CanonicalRefV0, payload: unknown): Promise<HashV1>;

  /** Recomputed content hash of a stored payload, or null when absent. */
  payloadHashOf(ref: CanonicalRefV0): Promise<HashV1 | null>;

  /**
   * Idempotent intent-driven prepare: same intent_id + same fingerprint resolves to
   * the SAME prepared revision; a changed fingerprint under the same intent_id is a
   * conflict. Every declared payload_hash is verified against repository-owned
   * immutable content before any revision is minted.
   */
  prepareRevisionForIntent(intent: MemoryPrepareIntentV1): Promise<PreparedRevisionV0>;

  /** Reads the immutable manifest of one revision, or null when absent. */
  readManifest(revision: RepositoryRevisionIdV0): Promise<RepositoryRevisionManifestV1 | null>;

  /**
   * §15.1 ReferenceValidator verdict: does this binding's revision exist AND match its
   * recorded hash? Verdict only — no manifest payload crosses this boundary.
   */
  validateRevisionBinding(binding: RepositoryRevisionBindingV1): Promise<boolean>;

  /**
   * §11 step-6 verdict: does EVERY supplied ref belong to the given revision?
   * One false covers any miss; callers map it to INVALID_MEMORY_REFERENCE.
   */
  validateRefsBelong(revision: RepositoryRevisionIdV0, refs: readonly CanonicalRefV0[]): Promise<boolean>;
}

/**
 * P2.3 Round 2 (ATTACK F / R2-G): LOW-LEVEL INFRASTRUCTURE ONLY. Raw revision
 * minting without intent identity/fingerprint enforcement. It is NEVER the
 * sanctioned Learning-facing authority and must not be exposed through the
 * runtime-facing MemoryPort.
 */
export interface MemoryRevisionStoreInternal {
  /**
   * Prepares (but never adopts) one new immutable revision derived from
   * `parent_revision`. Deterministic per request; failure rejects.
   */
  prepareRevision(request: RevisionPrepareRequestV0): Promise<PreparedRevisionV0>;
}

/**
 * Infrastructure composition view: adapters that also host the raw store (tests,
 * in-process reference infrastructure) implement both surfaces. Runtime/Learning
 * consumers must type against MemoryPreparationAuthority only.
 */
export interface MemoryRepository
  extends MemoryPreparationAuthority,
    MemoryRevisionStoreInternal {}

/**
 * P2.3 Round 3 (BLOCKER B2): TRUE RUNTIME PROJECTION of the memory authority.
 * TypeScript interface narrowing is compile-time only — a concrete repository
 * object still carries the raw revision-minting surface at runtime, reachable
 * by any JavaScript caller. This factory returns a NEW frozen wrapper exposing
 * exactly the sanctioned operations, so runtime/Learning code can never reach
 * MemoryRevisionStoreInternal through the dependency container. Host and
 * infrastructure composition keep the concrete object for legitimate duties.
 */
export function createMemoryPreparationAuthority(
  source: MemoryPreparationAuthority
): MemoryPreparationAuthority {
  const handle: MemoryPreparationAuthority = {
    storePayload: (ref, payload) => source.storePayload(ref, payload),
    payloadHashOf: (ref) => source.payloadHashOf(ref),
    prepareRevisionForIntent: (intent) => source.prepareRevisionForIntent(intent),
    readManifest: (revision) => source.readManifest(revision),
    validateRevisionBinding: (binding) => source.validateRevisionBinding(binding),
    validateRefsBelong: (revision, refs) => source.validateRefsBelong(revision, refs)
  };
  return Object.freeze(handle);
}
