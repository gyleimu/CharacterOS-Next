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
  RepositoryRevisionManifestV1,
  HashV1
} from "@characteros-next/subject-core";
import { computeMemoryRecordPayloadHash } from "../record-payload-hash.js";
import {
  computePrepareIntentFingerprint,
  computeRepositoryRevisionHash,
  prepareRevisionManifest,
  validatePrepareIntentBody
} from "../revisions.js";
import type {
  MemoryPrepareIntentV1,
  PreparedRevisionV0,
  RevisionPrepareRequestV0
} from "../revisions.js";
import type {
  MemoryRepository
} from "./memory-repository.js";

interface StoredRevision {
  readonly manifest: RepositoryRevisionManifestV1;
  readonly memberRefs: ReadonlySet<string>;
}

async function computePayloadHash(payload: unknown): Promise<string> {
  return computeMemoryRecordPayloadHash(payload);
}

function deepFreezePayload(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreezePayload((value as Record<string, unknown>)[key]);
  }
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly revisions = new Map<RepositoryRevisionIdV0, StoredRevision>();
  private counter = 0;
  /** P0-5: intent_id → {fingerprint, revision}; idempotent prepare registry. */
  private readonly intents = new Map<
    string,
    { fingerprint: string; revision: RepositoryRevisionIdV0; adopted: boolean }
  >();
  /** P0-5: repository-owned immutable payloads (ref → deep-frozen record object). */
  private readonly payloads = new Map<string, unknown>();

  /** Creation-order revision ids (diagnostics/tests projection). */
  revisionIds(): RepositoryRevisionIdV0[] {
    return [...this.revisions.keys()];
  }

  /**
   * P0-5 (ATTACK F closure): registers a repository-owned immutable payload for one
   * memory-bound ref and returns the recomputed content hash. The payload is
   * deep-frozen on ingest; the manifest's payload_hash must equal this recomputed
   * value at prepare time. Once a ref holds content, storing DIFFERENT content under
   * it is refused (MEMORY_PREPARE_CONFLICT); identical content is idempotent.
   */
  async storePayload(ref: CanonicalRefV0, payload: unknown): Promise<HashV1> {
    const frozen = structuredClone(payload) as unknown;
    deepFreezePayload(frozen);
    const hash = (await computePayloadHash(frozen)) as HashV1;
    const existing = this.payloads.get(ref);
    if (existing !== undefined) {
      const existingHash = await computeMemoryRecordPayloadHash(existing);
      if (existingHash !== hash) {
        throw new Error(
          `MEMORY_PREPARE_CONFLICT: ref ${ref} already stores different immutable content`
        );
      }
      return existingHash;
    }
    this.payloads.set(ref, frozen);
    return hash;
  }

  /** P0-5: recomputed content hash of a stored payload, or null when absent. */
  async payloadHashOf(ref: CanonicalRefV0): Promise<HashV1 | null> {
    const payload = this.payloads.get(ref);
    if (payload === undefined) return null;
    return computeMemoryRecordPayloadHash(payload);
  }

  /**
   * P0-5: idempotent intent-driven prepare. Same intent_id + same payload fingerprint
   * returns the SAME prepared revision; same intent_id + changed fingerprint rejects
   * (conflict). Every record's payload_hash is verified against the repository-owned
   * immutable payload before any revision is created.
   */
  async prepareRevisionForIntent(
    intent: MemoryPrepareIntentV1
  ): Promise<PreparedRevisionV0> {
    const checked = validatePrepareIntentBody(intent);
    if (!checked.ok) {
      throw new Error(`invalid prepare intent: ${checked.error.detail}`);
    }
    const existing = this.intents.get(intent.intent_id);
    const fingerprint =
      intent.payload_fingerprint ??
      ((await computePrepareIntentFingerprint(intent)) as HashV1);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(
          `MEMORY_PREPARE_CONFLICT: intent ${intent.intent_id} replayed with a changed payload`
        );
      }
      const prepared = this.revisions.get(existing.revision);
      if (prepared === undefined) {
        throw new Error("intent references a vanished revision");
      }
      return { repository_revision: existing.revision, manifest: prepared.manifest };
    }
    // Payload integrity: every declared hash must be recomputable from the owned payload.
    for (const record of intent.records) {
      const payload = this.payloads.get(record.ref);
      if (payload === undefined) {
        throw new Error(
          `MEMORY_PREPARE_CONFLICT: record ${record.ref} has no repository-owned payload`
        );
      }
      const recomputed = await computeMemoryRecordPayloadHash(payload);
      if (recomputed !== record.payload_hash) {
        throw new Error(`MEMORY_PREPARE_CONFLICT: payload hash mismatch for ${record.ref}`);
      }
    }
    const request: RevisionPrepareRequestV0 = {
      parent_revision: intent.parent_revision,
      records: intent.records.map((r) => ({ ref: r.ref, payload_hash: r.payload_hash }))
    };
    const prepared = await this.prepareRevision(request);
    this.intents.set(intent.intent_id, {
      fingerprint,
      revision: prepared.repository_revision,
      adopted: false
    });
    return prepared;
  }

  /** P0-5: adoption seam — marks a prepared revision as canonically adopted. */
  markAdopted(revision: RepositoryRevisionIdV0): void {
    for (const entry of this.intents.values()) {
      if (entry.revision === revision) entry.adopted = true;
    }
  }

  /** P0-5: verdict used by safe-adoption validation (stale reuse detection). */
  isAdopted(revision: RepositoryRevisionIdV0): boolean {
    return [...this.intents.values()].some(
      (entry) => entry.revision === revision && entry.adopted
    );
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
