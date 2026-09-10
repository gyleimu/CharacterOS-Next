/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — durable subject-store image.
 *
 * A host that must survive a REAL process restart cannot rely on the live
 * in-memory repository/commit store that `LongHorizonSubjectSessionV0.restore`
 * uses in-process. This module captures the two durable infrastructure
 * artifacts that authoritative restore needs — the immutable Memory repository
 * revisions (manifests + repository-owned payloads) and the committed canonical
 * bundles — as a plain, serializable image, and rebuilds an equivalent store
 * face from that image in a fresh process.
 *
 * SCOPE: persistence composition ONLY. No psychological semantics, no schema
 * change, no new authority. The image is a faithful copy of already-canonical
 * data; every hash/binding is re-derived by the existing restore chain, so a
 * tampered image fails closed exactly as a tampered live store would.
 */

import type {
  AtomicCommitBundleAnyVersion,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import { InMemoryMemoryRepository } from "@characteros-next/memory";
import type { MemoryRepository } from "@characteros-next/memory";

/** One immutable Memory repository revision: manifest + its own record payloads. */
export interface SessionRepositoryRevisionImageV0 {
  readonly repository_revision: string;
  readonly manifest: RepositoryRevisionManifestV1;
  readonly payloads: readonly { readonly ref: string; readonly payload: unknown }[];
}

/** Serializable image of the durable memory-repository + commit-chain state. */
export interface SessionStoreImageV0 {
  readonly schema_version: "subject-session-store-image-v0";
  /** Revision-graph order (R0, R1, …), each manifest plus its own delta payloads. */
  readonly revisions: readonly SessionRepositoryRevisionImageV0[];
  /** Committed canonical bundles in authority order. */
  readonly committed_bundles: readonly unknown[];
}

/** Concrete-only repository surface this image needs (never exposed as a port). */
interface RepositoryImageReader {
  revisionIds(): readonly string[];
  readStoredPayload(ref: string): unknown;
}

/**
 * Captures a serializable image of the durable store. Payloads/manifests/
 * bundles are handed back as-is (not copied): the caller owns serialization.
 * Reads only; never mutates the live store.
 */
export async function captureSessionStoreImageV0(source: {
  readonly repo: MemoryRepository;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
}): Promise<SessionStoreImageV0> {
  const reader = source.repo as unknown as RepositoryImageReader;
  const revisions: SessionRepositoryRevisionImageV0[] = [];
  for (const revision of reader.revisionIds()) {
    const manifest = await source.repo.readManifest(revision as RepositoryRevisionIdV0);
    if (manifest === null) {
      throw new Error(`session store image: manifest ${revision} missing`);
    }
    const payloads: { ref: string; payload: unknown }[] = [];
    for (const record of manifest.record_hashes) {
      const payload = reader.readStoredPayload(record.ref);
      if (payload === undefined) {
        throw new Error(`session store image: payload ${record.ref} missing`);
      }
      payloads.push({ ref: record.ref, payload });
    }
    revisions.push({ repository_revision: revision, manifest, payloads });
  }
  return {
    schema_version: "subject-session-store-image-v0",
    revisions,
    committed_bundles: [...source.bundles]
  };
}

export interface RebuiltSessionStoreSourceV0 {
  readonly repo: InMemoryMemoryRepository;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
}

/**
 * Rebuilds an equivalent store face from a captured image by replaying
 * payload storage and revision preparation in recorded order. The rebuilt
 * revision ids must match the image exactly (a mismatch means a corrupted or
 * reordered image and fails closed).
 */
export async function rebuildSessionStoreSourceV0(
  image: SessionStoreImageV0
): Promise<RebuiltSessionStoreSourceV0> {
  if (image.schema_version !== "subject-session-store-image-v0") {
    throw new Error("session store image: unsupported schema_version");
  }
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  for (const revision of image.revisions) {
    if (revision.repository_revision === "R0") continue;
    const entries: { ref: string; payload_hash: string }[] = [];
    for (const entry of revision.payloads) {
      const payloadHash = await repo.storePayload(entry.ref as never, entry.payload);
      entries.push({ ref: entry.ref, payload_hash: payloadHash });
    }
    const prepared = await repo.prepareRevision({
      parent_revision: revision.manifest.parent_revision as never,
      records: entries as never
    });
    if (prepared.repository_revision !== revision.repository_revision) {
      throw new Error(
        `session store image: revision replay mismatch (expected ${revision.repository_revision}, got ${prepared.repository_revision})`
      );
    }
  }
  return {
    repo,
    bundles: [...image.committed_bundles] as unknown as readonly AtomicCommitBundleAnyVersion[]
  };
}
