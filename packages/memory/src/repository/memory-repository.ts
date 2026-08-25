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
  RepositoryRevisionBindingV1,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import type {
  PreparedRevisionV0,
  RevisionPrepareRequestV0
} from "../revisions.js";

export interface MemoryRepository {
  /**
   * Prepares (but never adopts) one new immutable revision derived from
   * `parent_revision`. Deterministic per request; failure rejects.
   */
  prepareRevision(request: RevisionPrepareRequestV0): Promise<PreparedRevisionV0>;

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
