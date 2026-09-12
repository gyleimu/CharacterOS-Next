/**
 * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — the ONE authoritative persisted
 * canonical subject source per subject.
 *
 * This is PRODUCT persistence composition, not new ontology: the document holds
 * exactly the existing canonical substrate both hosts already restore
 * (`SessionDurableStateV0` + `SessionStoreImageV0`) plus a monotonic product
 * `base_revision` used for stale-write rejection. Context-specific lifecycle
 * state (human turn bookkeeping, environment state/index) lives in sidecars and
 * is never canonical authority.
 *
 * Concurrency guarantee (no overclaim): single-writer expected-base compare
 * followed by an atomic temp-file rename. Two hosts that both persist the same
 * revision: the first wins, the second is rejected as a stale write. There is no
 * cross-process lock and no distributed transaction.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionDurableStateV0, SessionStoreImageV0 } from "@characteros-next/runtime";
import { writeJsonAtomicV0 } from "./atomic-json-file.js";

export const SHARED_SUBJECT_SOURCE_SCHEMA_VERSION = "shared-canonical-subject-document-v0" as const;

export interface SharedSubjectSourceDocumentV0 {
  readonly schema_version: typeof SHARED_SUBJECT_SOURCE_SCHEMA_VERSION;
  readonly subject_id: string;
  /** Monotonic product revision of the shared canonical subject (starts at 1). */
  readonly base_revision: number;
  readonly durable: SessionDurableStateV0;
  readonly store: SessionStoreImageV0;
  readonly updated_at: string;
}

export type SharedSubjectSourceLoadResultV0 =
  | { readonly kind: "NONE" }
  | { readonly kind: "DOCUMENT"; readonly document: SharedSubjectSourceDocumentV0 };

export type SharedSubjectSaveResultV0 =
  | { readonly kind: "SAVED"; readonly document: SharedSubjectSourceDocumentV0 }
  | { readonly kind: "STALE_BASE"; readonly current_revision: number };

export interface SharedSubjectSourceStoreV0 {
  location(): string | null;
  load(): Promise<SharedSubjectSourceLoadResultV0>;
  /**
   * Compare-and-set write. `expectedBaseRevision` must equal the currently
   * persisted `base_revision`; `null` means "no document must exist yet".
   */
  save(
    document: Omit<SharedSubjectSourceDocumentV0, "base_revision" | "schema_version">,
    expectedBaseRevision: number | null
  ): Promise<SharedSubjectSaveResultV0>;
}

export class SharedSubjectSourceCorruptErrorV0 extends Error {
  constructor(readonly path: string, detail: string) {
    super(`Shared canonical subject source at ${path} is unreadable (${detail}). Refusing to start.`);
    this.name = "SharedSubjectSourceCorruptErrorV0";
  }
}

/** Typed legacy conflict: two pre-bridge artifacts disagree about the head. */
export class CrossContextExistingLineageConflictErrorV0 extends Error {
  constructor(detail: string) {
    super(`CROSS_CONTEXT_EXISTING_LINEAGE_CONFLICT: ${detail}`);
    this.name = "CrossContextExistingLineageConflictErrorV0";
  }
}

export function validateSharedSubjectDocumentV0(value: unknown): SharedSubjectSourceDocumentV0 {
  if (typeof value !== "object" || value === null) throw new Error("expected object");
  const document = value as Record<string, unknown>;
  if (document["schema_version"] !== SHARED_SUBJECT_SOURCE_SCHEMA_VERSION) {
    throw new Error(`unsupported schema_version ${String(document["schema_version"])}`);
  }
  if (typeof document["subject_id"] !== "string" || document["subject_id"].length === 0) {
    throw new Error("subject_id required");
  }
  if (!Number.isInteger(document["base_revision"]) || (document["base_revision"] as number) < 1) {
    throw new Error("base_revision must be a positive integer");
  }
  const durable = document["durable"] as Record<string, unknown> | undefined;
  if (typeof durable !== "object" || durable === null || durable["schema_version"] !== "subject-session-durable-state-v0") {
    throw new Error("durable: subject-session-durable-state-v0 required");
  }
  const store = document["store"] as Record<string, unknown> | undefined;
  if (typeof store !== "object" || store === null || store["schema_version"] !== "subject-session-store-image-v0") {
    throw new Error("store: subject-session-store-image-v0 required");
  }
  return value as SharedSubjectSourceDocumentV0;
}

/** In-memory store for deterministic tests (single-writer CAS). */
export class InMemorySharedSubjectSourceStoreV0 implements SharedSubjectSourceStoreV0 {
  private document: SharedSubjectSourceDocumentV0 | null = null;
  location(): string | null {
    return null;
  }
  async load(): Promise<SharedSubjectSourceLoadResultV0> {
    return this.document === null ? { kind: "NONE" } : { kind: "DOCUMENT", document: this.document };
  }
  async save(
    document: Omit<SharedSubjectSourceDocumentV0, "base_revision" | "schema_version">,
    expectedBaseRevision: number | null
  ): Promise<SharedSubjectSaveResultV0> {
    const current = this.document?.base_revision ?? null;
    if (current !== expectedBaseRevision) {
      return { kind: "STALE_BASE", current_revision: current ?? 0 };
    }
    this.document = {
      schema_version: SHARED_SUBJECT_SOURCE_SCHEMA_VERSION,
      base_revision: (current ?? 0) + 1,
      ...document
    };
    return { kind: "SAVED", document: this.document };
  }
}

function sharedFileName(subjectId: string): string {
  return `subject-${subjectId}.shared-subject.json`;
}

/** Atomic file-backed store; corrupt/unsupported documents fail closed. */
export class FileSharedSubjectSourceStoreV0 implements SharedSubjectSourceStoreV0 {
  private readonly path: string;
  constructor(rootDir: string, subjectId: string) {
    this.path = join(rootDir, sharedFileName(subjectId));
  }
  location(): string {
    return this.path;
  }
  async load(): Promise<SharedSubjectSourceLoadResultV0> {
    if (!existsSync(this.path)) return { kind: "NONE" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
    } catch (error) {
      throw new SharedSubjectSourceCorruptErrorV0(this.path, error instanceof Error ? error.message : String(error));
    }
    try {
      return { kind: "DOCUMENT", document: validateSharedSubjectDocumentV0(parsed) };
    } catch (error) {
      throw new SharedSubjectSourceCorruptErrorV0(this.path, error instanceof Error ? error.message : String(error));
    }
  }
  async save(
    document: Omit<SharedSubjectSourceDocumentV0, "base_revision" | "schema_version">,
    expectedBaseRevision: number | null
  ): Promise<SharedSubjectSaveResultV0> {
    const loaded = await this.load();
    const current = loaded.kind === "DOCUMENT" ? loaded.document.base_revision : null;
    if (current !== expectedBaseRevision) {
      return { kind: "STALE_BASE", current_revision: current ?? 0 };
    }
    const next: SharedSubjectSourceDocumentV0 = {
      schema_version: SHARED_SUBJECT_SOURCE_SCHEMA_VERSION,
      base_revision: (current ?? 0) + 1,
      ...document
    };
    writeJsonAtomicV0(this.path, next);
    return { kind: "SAVED", document: next };
  }
}
