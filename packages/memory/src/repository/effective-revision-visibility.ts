/**
 * MEMORY_REVISION_LONG_TERM_VISIBILITY_V0 — EffectiveRevisionVisibilityAuthorityV0.
 *
 * Architecture decision (frozen): EFFECTIVE_ANCESTOR_VISIBILITY_IMPLEMENTATION.
 * Memory revision manifests are DELTAS: `manifest.record_hashes` continues to mean
 * exactly "records directly introduced by this revision". Long-term visibility is a
 * READ-TIME authority concept derived from the bound revision's ancestry:
 *
 *   D(R) = direct record_hashes of manifest R
 *   A(R) = R, parent(R), parent(parent(R)), …, genesis
 *   V(R) = canonical union of D(X) for all X in A(R)
 *
 * V(R) is the EFFECTIVE VISIBLE RECORD SET. It is never persisted as a synthetic
 * manifest, never rewrites historical manifests, and does not touch revision hash
 * law. Additive Learning keeps V(Rn) ⊆ V(Rn+1); V0 implements no forgetting.
 *
 * INTEGRITY LAW (§10): an effective history is only as trustworthy as its ancestor
 * chain. EVERY traversed revision is re-validated (closed schema, revision-ID match,
 * canonical/sorted records, duplicate rules) and its sealed revision hash is
 * verified against recomputation. A valid terminal revision cannot legitimize
 * corrupted ancestry.
 *
 * DUPLICATE LAW (§7): same canonical ref + same payload hash deduplicates
 * deterministically; same canonical ref + DIFFERENT payload hash is an integrity
 * violation — fail closed, never newest/oldest selection.
 *
 * TERMINATION/CYCLE LAW (§8/§9): only genesis may terminate with a null parent;
 * missing parents, unknown revisions, repeated revision ids (cycles) and hops
 * beyond the known revision count all fail closed. Visibility follows ancestry
 * only — the repository's full revision map is never scanned.
 *
 * External error semantics stay in the existing INVALID_MEMORY_REVISION/MEM-REV-001
 * family (§38); detailed causes live in the message text only.
 */

import type {
  CanonicalRefV0,
  HashV1,
  RepositoryRecordHashV1,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash, validateRepositoryManifest } from "../revisions.js";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";

const ERROR_FAMILY = "INVALID_MEMORY_REVISION/MEM-REV-001";

/** One stored revision as the resolver may lawfully observe it: manifest + seal. */
export interface RevisionSealedRecordV0 {
  readonly manifest: RepositoryRevisionManifestV1;
  /** The repository-sealed revision hash captured at prepare time. */
  readonly sealed_hash: HashV1;
}

/**
 * Narrow read-only graph face over the concrete repository's stored revisions.
 * Implementations must expose ONLY sealed, prepare-time-frozen state.
 */
export interface RevisionGraphReaderV0 {
  readSealedRevision(revision: RepositoryRevisionIdV0): Promise<RevisionSealedRecordV0 | null>;
  /** Deterministic hop bound: the number of revisions the store knows about. */
  knownRevisionCount(): number;
  /** Genesis law: only the designated genesis revision may have a null parent. */
  isGenesisRevision(revision: RepositoryRevisionIdV0): boolean;
}

function visibilityFailure(detail: string): Error {
  return new Error(`${ERROR_FAMILY}: ${detail}`);
}

/**
 * Shared ancestry visibility resolver. ONE repository-level implementation —
 * consumers (validateRefsBelong, retrieval, content readers) delegate here and
 * never walk parents themselves.
 */
export class EffectiveRevisionVisibilityAuthorityV0 {
  constructor(private readonly graph: RevisionGraphReaderV0) {
    if (graph === undefined || graph === null) {
      throw visibilityFailure("visibility authority requires a revision graph reader");
    }
  }

  async readVisibleRecordHashes(
    repository_revision: RepositoryRevisionIdV0
  ): Promise<readonly RepositoryRecordHashV1[]> {
    const requested = typeof repository_revision === "string" ? repository_revision : "";
    if (requested.length === 0) {
      throw visibilityFailure("effective visibility requires a revision id");
    }
    const combined = new Map<string, RepositoryRecordHashV1>();
    const visited = new Set<string>();
    const hopBound = this.graph.knownRevisionCount() + 1;
    let cursor = requested;

    while (true) {
      // ---- cycle protection (§9): repeated id or hop bound exceeded ----------
      if (visited.has(cursor)) {
        throw visibilityFailure(`revision cycle detected at ${cursor} while resolving effective visibility of ${requested}`);
      }
      visited.add(cursor);
      if (visited.size > hopBound) {
        throw visibilityFailure(`ancestry hop bound exceeded while resolving effective visibility of ${requested}`);
      }

      // ---- load + validate the exact revision (§6.1–§6.3, §10) ---------------
      const sealed = await this.graph.readSealedRevision(cursor as never);
      if (sealed === null) {
        if (cursor === requested) {
          throw visibilityFailure(`revision ${cursor} is unknown`);
        }
        throw visibilityFailure(`ancestor revision ${cursor} is missing from the repository chain of ${requested}`);
      }
      const manifest = sealed.manifest;
      if (manifest === null || typeof manifest !== "object") {
        throw visibilityFailure(`revision ${cursor} manifest is malformed`);
      }
      if (manifest.repository_revision !== cursor) {
        throw visibilityFailure(`revision lookup ${cursor} returned manifest for ${manifest.repository_revision}`);
      }
      const schemaChecked = validateRepositoryManifest(manifest);
      if (!schemaChecked.ok) {
        throw visibilityFailure(`revision ${cursor} manifest violates the manifest schema (${schemaChecked.error.detail})`);
      }
      // Stored/sealed revision hash must match recomputation (§10).
      const recomputed = await computeRepositoryRevisionHash(manifest);
      if (recomputed !== sealed.sealed_hash) {
        throw visibilityFailure(`revision ${cursor} sealed hash does not match recomputation (manifest tamper)`);
      }
      // Non-genesis null parent fails closed (§8).
      const parent = manifest.parent_revision;

      // ---- collect direct record entries with duplicate law (§7) -------------
      for (const entry of manifest.record_hashes) {
        const existing = combined.get(entry.ref);
        if (existing === undefined) {
          combined.set(entry.ref, entry);
        } else if (existing.payload_hash !== entry.payload_hash) {
          throw visibilityFailure(
            `record ${entry.ref} appears in ancestry of ${requested} with two different payload hashes (${existing.payload_hash} vs ${entry.payload_hash}) — historical identity conflict`
          );
        }
        // Same ref + same payload hash: deterministic dedup (no-op).
      }

      // ---- follow parent / genesis termination (§6.5–§6.6, §8) ---------------
      if (parent === null) {
        if (!this.graph.isGenesisRevision(cursor as never)) {
          throw visibilityFailure(`non-genesis revision ${cursor} has a null parent (ancestry termination law)`);
        }
        break; // genesis terminates lawfully
      }
      cursor = parent;
    }

    const visible = [...combined.values()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
    return Object.freeze(visible);
  }
}

/** Composition factory for the narrow visibility read authority. */
export function createEffectiveRevisionVisibilityAuthorityV0(
  graph: RevisionGraphReaderV0
): EffectiveRevisionVisibilityAuthorityV0 {
  return new EffectiveRevisionVisibilityAuthorityV0(graph);
}

/** Internal helper re-exported for repository self-checks (verdict shape). */
export function visibleEntryFor(
  visible: readonly RepositoryRecordHashV1[],
  ref: CanonicalRefV0
): ValidationResult<RepositoryRecordHashV1> {
  const entry = visible.find((candidate) => candidate.ref === ref);
  if (entry === undefined) {
    return fail("INVALID_MEMORY_REVISION", "MEM-REV-001", `ref ${ref} is not visible at the requested revision`);
  }
  return ok(entry);
}
