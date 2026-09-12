/**
 * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — canonical subject resolution.
 *
 * Decides, for ONE subject in ONE storage root, which persisted artifact is the
 * authoritative canonical subject:
 *
 *   1. the shared canonical subject source (authoritative when present);
 *   2. otherwise exactly ONE legacy product artifact (adopted after canonical
 *      validation) — the human snapshot or an environment checkpoint;
 *   3. otherwise a fresh subject (the caller creates genesis and persists it);
 *
 * Two legacy artifacts that disagree about the canonical head are NEVER merged:
 * they fail closed with a typed existing-lineage conflict. No timestamp
 * heuristic, no history synthesis.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SessionDurableStateV0, SessionStoreImageV0 } from "@characteros-next/runtime";
import {
  SharedSubjectSourceCorruptErrorV0,
  CrossContextExistingLineageConflictErrorV0,
  validateSharedSubjectDocumentV0,
  type SharedSubjectSourceStoreV0
} from "./shared-subject-source.js";

export interface CanonicalSubjectSnapshotV0 {
  readonly durable: SessionDurableStateV0;
  readonly store: SessionStoreImageV0;
  /** Shared product revision this snapshot was read/adopted at (1-based). */
  readonly base_revision: number;
  readonly provenance: "SHARED" | "ADOPTED_HUMAN" | "ADOPTED_ENVIRONMENT";
}

export type CanonicalResolutionV0 =
  | { readonly kind: "RESTORE"; readonly canonical: CanonicalSubjectSnapshotV0 }
  | { readonly kind: "CREATE_FRESH" };

export interface LegacyArtifactV0 {
  readonly provenance: "ADOPTED_HUMAN" | "ADOPTED_ENVIRONMENT";
  readonly source_path: string;
  readonly subject_id: string;
  readonly head_ref: string;
  readonly durable: SessionDurableStateV0;
  readonly store: SessionStoreImageV0;
}

type LegacyArtifact = LegacyArtifactV0;

export function humanSnapshotFileName(subjectId: string): string {
  return `subject-${subjectId}.snapshot.json`;
}

export function environmentCheckpointPrefix(subjectId: string): string {
  return `subject-${subjectId}.environment-`;
}

function readLegacyHuman(rootDir: string, subjectId: string): LegacyArtifact | null {
  const path = join(rootDir, humanSnapshotFileName(subjectId));
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const durable = parsed["durable"] as SessionDurableStateV0 | undefined;
  const store = parsed["store"] as SessionStoreImageV0 | undefined;
  if (durable === undefined || store === undefined) {
    throw new SharedSubjectSourceCorruptErrorV0(path, "legacy human snapshot missing durable/store");
  }
  return {
    provenance: "ADOPTED_HUMAN",
    source_path: path,
    subject_id: String(parsed["subject_id"] ?? ""),
    head_ref: durable.identity.subject_head.commit_ref,
    durable,
    store
  };
}

/** Finds environment checkpoint sidecars for a subject (any environment id). */
export function findLegacyEnvironment(rootDir: string, subjectId: string): LegacyArtifact[] {
  const prefix = environmentCheckpointPrefix(subjectId);
  if (!existsSync(rootDir)) return [];
  const artifacts: LegacyArtifact[] = [];
  for (const entry of readdirSync(rootDir)) {
    if (!entry.startsWith(prefix) || !entry.endsWith(".json") || entry.includes("shared-subject")) continue;
    const path = join(rootDir, entry);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const checkpoint = parsed["checkpoint"] as Record<string, unknown> | undefined;
    const store = parsed["store"] as SessionStoreImageV0 | undefined;
    const durable = checkpoint?.["durable"] as SessionDurableStateV0 | undefined;
    if (durable === undefined || store === undefined) {
      throw new SharedSubjectSourceCorruptErrorV0(path, "legacy environment checkpoint missing durable/store");
    }
    artifacts.push({
      provenance: "ADOPTED_ENVIRONMENT",
      source_path: path,
      subject_id: String(checkpoint?.["subject_id"] ?? ""),
      head_ref: durable.identity.subject_head.commit_ref,
      durable,
      store
    });
  }
  return artifacts;
}

function assertSubject(candidateSubjectId: string, expectedSubjectId: string, source: string): void {
  if (candidateSubjectId !== expectedSubjectId) {
    throw new CrossContextExistingLineageConflictErrorV0(
      `${source} belongs to subject ${candidateSubjectId}, not ${expectedSubjectId}`
    );
  }
}

/**
 * Resolves the canonical subject for `subjectId` in `storageRoot`.
 * Throws a typed conflict when two legacy artifacts disagree, and a corrupt
 * error when the shared source is unreadable.
 */
export async function resolveCanonicalSubjectV0(input: {
  readonly sharedStore: SharedSubjectSourceStoreV0 | null;
  readonly storageRoot: string;
  readonly subjectId: string;
  /**
   * The caller's OWN already-loaded legacy artifact (from its own store, which
   * may be in-memory). When absent, conventional legacy files are scanned so a
   * context can still discover the other context's artifact in a file-backed
   * product root.
   */
  readonly ownLegacy?: LegacyArtifactV0 | null;
}): Promise<CanonicalResolutionV0> {
  if (input.sharedStore !== null) {
    const loaded = await input.sharedStore.load();
    if (loaded.kind === "DOCUMENT") {
      assertSubject(loaded.document.subject_id, input.subjectId, "shared canonical subject source");
      return {
        kind: "RESTORE",
        canonical: {
          durable: loaded.document.durable,
          store: loaded.document.store,
          base_revision: loaded.document.base_revision,
          provenance: "SHARED"
        }
      };
    }
  }

  const legacies: LegacyArtifact[] = [];
  const own = input.ownLegacy ?? null;
  if (own !== null) {
    assertSubject(own.subject_id, input.subjectId, own.source_path);
    legacies.push(own);
  }
  // Discover the OTHER context's conventional artifact (never re-read our own).
  if (own === null || own.provenance === "ADOPTED_ENVIRONMENT") {
    const human = readLegacyHuman(input.storageRoot, input.subjectId);
    if (human !== null) {
      assertSubject(human.subject_id, input.subjectId, human.source_path);
      legacies.push(human);
    }
  }
  if (own === null || own.provenance === "ADOPTED_HUMAN") {
    for (const artifact of findLegacyEnvironment(input.storageRoot, input.subjectId)) {
      assertSubject(artifact.subject_id, input.subjectId, artifact.source_path);
      legacies.push(artifact);
    }
  }
  if (legacies.length === 0) return { kind: "CREATE_FRESH" };
  const distinctHeads = new Set(legacies.map((artifact) => artifact.head_ref));
  if (distinctHeads.size > 1) {
    throw new CrossContextExistingLineageConflictErrorV0(
      `subject ${input.subjectId} has ${legacies.length} legacy artifacts with divergent canonical heads ` +
        `(${legacies.map((artifact) => `${artifact.provenance}:${artifact.head_ref}`).join(", ")}); ` +
        `refusing to merge or guess — a manual decision is required`
    );
  }
  const adopted = legacies[0] as LegacyArtifact;
  return {
    kind: "RESTORE",
    canonical: {
      durable: adopted.durable,
      store: adopted.store,
      base_revision: 0,
      provenance: adopted.provenance
    }
  };
}

/** Persists/refreshes the shared canonical subject; stale base fails closed. */
export async function persistCanonicalSubjectV0(input: {
  readonly sharedStore: SharedSubjectSourceStoreV0;
  readonly subjectId: string;
  readonly durable: SessionDurableStateV0;
  readonly store: SessionStoreImageV0;
  readonly expectedBaseRevision: number | null;
  readonly updatedAt: string;
}): Promise<CanonicalSubjectSnapshotV0> {
  const result = await input.sharedStore.save(
    {
      subject_id: input.subjectId,
      durable: input.durable,
      store: input.store,
      updated_at: input.updatedAt
    },
    input.expectedBaseRevision
  );
  if (result.kind === "STALE_BASE") {
    throw new Error(
      `CROSS_CONTEXT_STALE_WRITE: shared canonical subject for ${input.subjectId} is at revision ` +
        `${result.current_revision}, expected base ${String(input.expectedBaseRevision)}`
    );
  }
  return {
    durable: result.document.durable,
    store: result.document.store,
    base_revision: result.document.base_revision,
    provenance: "SHARED"
  };
}

export { validateSharedSubjectDocumentV0 };
export type { SharedSubjectSourceStoreV0 };
