/**
 * P2.2.2 — InMemoryMemoryRepository: reference implementation of the MemoryRepository
 * port (pure in-process; the ONLY state holder in this package by design).
 * Source: docs/implementation/p2-1-contract-freeze.md §8.5, §9.3, §15.1, §16.
 *
 * Guarantees:
 * - IMMUTABLE REVISIONS/MANIFESTS: manifests are produced through
 *   `prepareRevisionManifest` (deep-frozen) and stored as-is; `readManifest` hands back
 *   the same frozen instance. Nothing in this class ever mutates a stored manifest.
 * - DETERMINISTIC HASHES: binding validation recomputes the frozen
 *   RepositoryRevisionHash over the manifest and compares wire values.
 * - MONOTONIC REVISIONS: ids are assigned from a strictly increasing counter — genesis
 *   `R0` (empty records, empty parent) only on an empty repository, then `R1`, `R2`, …
 *   every derived revision must name an EXISTING parent.
 * - MEMBERSHIP VERDICTS ONLY: `validateRevisionBinding` / `validateRefsBelong` return
 *   booleans and never expose payload bytes or manifest internals beyond the manifest
 *   itself. SubjectState is unknown to this class; runtime is never imported.
 *
 * Storage is process memory exclusively: no database, no filesystem, no vector index,
 * no embedding, no retrieval/search/ranking, no consolidation.
 */

import type {
  CanonicalRefV0,
  RepositoryRevisionBindingV1,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash, prepareRevisionManifest } from "../revisions.js";
import type {
  MemoryRepository
} from "./memory-repository.js";
import type { PreparedRevisionV0, RevisionPrepareRequestV0 } from "../revisions.js";

interface StoredRevision {
  readonly manifest: RepositoryRevisionManifestV1;
  readonly memberRefs: ReadonlySet<string>;
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly revisions = new Map<RepositoryRevisionIdV0, StoredRevision>();
  private counter = 0;

  /** Creation-order revision ids (diagnostics/tests projection). */
  revisionIds(): RepositoryRevisionIdV0[] {
    return [...this.revisions.keys()];
  }

  async prepareRevision(request: RevisionPrepareRequestV0): Promise<PreparedRevisionV0> {
    let id: RepositoryRevisionIdV0;
    if (request.parent_revision === null) {
      if (this.revisions.size !== 0) {
        throw new Error("genesis revision (null parent) is allowed only on an empty repository");
      }
      id = "R0" as RepositoryRevisionIdV0;
      this.counter = 0;
    } else {
      if (!this.revisions.has(request.parent_revision)) {
        throw new Error(`unknown parent revision ${request.parent_revision}`);
      }
      this.counter += 1;
      // Strictly monotonic assignment; skip defensively even if an id ever existed.
      while (this.revisions.has(`R${this.counter}` as RepositoryRevisionIdV0)) {
        this.counter += 1;
      }
      id = `R${this.counter}` as RepositoryRevisionIdV0;
    }

    const prepared = prepareRevisionManifest(id, request);
    if (!prepared.ok) {
      // Reset counter side effects so failed prepares never burn sequence numbers.
      if (request.parent_revision === null) this.counter = 0;
      else this.counter -= 1;
      throw new Error(`invalid revision prepare request: ${prepared.error.detail}`);
    }

    const memberRefs = new Set<string>(
      prepared.value.manifest.record_hashes.map((record) => record.ref)
    );
    this.revisions.set(id, { manifest: prepared.value.manifest, memberRefs });
    return prepared.value;
  }

  async readManifest(revision: RepositoryRevisionIdV0): Promise<RepositoryRevisionManifestV1 | null> {
    return this.revisions.get(revision)?.manifest ?? null;
  }

  async validateRevisionBinding(binding: RepositoryRevisionBindingV1): Promise<boolean> {
    const stored = this.revisions.get(binding.repository_revision);
    if (stored === undefined) return false;
    return (await computeRepositoryRevisionHash(stored.manifest)) === binding.repository_revision_hash;
  }

  async validateRefsBelong(
    revision: RepositoryRevisionIdV0,
    refs: readonly CanonicalRefV0[]
  ): Promise<boolean> {
    const stored = this.revisions.get(revision);
    if (stored === undefined) return false;
    return refs.every((ref) => stored.memberRefs.has(ref));
  }
}
