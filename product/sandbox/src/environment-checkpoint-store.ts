/**
 * SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 — product persistence adapter for
 * the long-horizon environment session.
 *
 * ONE authoritative restart bundle = the existing `SessionCheckpointV0`
 * (subject durable state + environment state, already one logical atomic unit
 * with a content-addressed `checkpoint_ref`) PLUS the existing
 * `SessionStoreImageV0` (immutable Memory revisions + committed canonical
 * bundles) that a fresh process needs to rebuild a store face before
 * authoritative restore.
 *
 * Nothing canonical is re-schematized here: both members are the frozen
 * runtime artifacts, wrapped in one minimal versioned product document. A
 * missing file is a first launch; a corrupt or unsupported-version document
 * fails closed and never silently becomes a new subject.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionCheckpointV0, SessionStoreImageV0 } from "@characteros-next/runtime";
import { writeJsonAtomicV0 } from "./atomic-json-file.js";

export const ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION =
  "subject-environment-checkpoint-document-v0" as const;

export interface EnvironmentCheckpointDocumentV0 {
  readonly schema_version: typeof ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION;
  /**
   * SUBJECT_CROSS_CONTEXT_PRODUCT_BRIDGE_V0 — product-level environment
   * identity binding (the frozen `SessionCheckpointV0` has none). A sidecar may
   * only be restored by the declared environment adapter.
   */
  readonly environment_id: string;
  /**
   * Shared canonical subject revision this sidecar was written against. The
   * sidecar is NEVER subject authority: under the bridge the canonical subject
   * is read from the shared source and this value is only cross-checked.
   */
  readonly base_revision: number | null;
  readonly checkpoint: SessionCheckpointV0;
  readonly store: SessionStoreImageV0;
}

export type EnvironmentCheckpointLoadResultV0 =
  | { readonly kind: "NONE" }
  | { readonly kind: "DOCUMENT"; readonly document: EnvironmentCheckpointDocumentV0 };

export interface EnvironmentCheckpointStoreV0 {
  location(): string | null;
  load(): Promise<EnvironmentCheckpointLoadResultV0>;
  save(document: EnvironmentCheckpointDocumentV0): Promise<void>;
}

export class EnvironmentCheckpointCorruptErrorV0 extends Error {
  constructor(readonly path: string, detail: string) {
    super(
      `Environment session checkpoint at ${path} is unreadable (${detail}). Refusing to start a new subject.`
    );
    this.name = "EnvironmentCheckpointCorruptErrorV0";
  }
}

/** Validates the minimal document identity before any restore is attempted. */
export function validateEnvironmentCheckpointDocumentV0(
  value: unknown
): EnvironmentCheckpointDocumentV0 {
  if (typeof value !== "object" || value === null) {
    throw new Error("checkpoint document: expected object");
  }
  const document = value as Record<string, unknown>;
  if (document["schema_version"] !== ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION) {
    throw new Error(
      `checkpoint document: unsupported schema_version ${String(document["schema_version"])}`
    );
  }
  if (typeof document["environment_id"] !== "string" || document["environment_id"].length === 0) {
    throw new Error("checkpoint document: environment_id required");
  }
  const checkpoint = document["checkpoint"] as Record<string, unknown> | undefined;
  const store = document["store"] as Record<string, unknown> | undefined;
  if (typeof checkpoint !== "object" || checkpoint === null || checkpoint["schema_version"] !== "subject-session-checkpoint-v0") {
    throw new Error("checkpoint document: missing subject-session-checkpoint-v0");
  }
  if (typeof store !== "object" || store === null || store["schema_version"] !== "subject-session-store-image-v0") {
    throw new Error("checkpoint document: missing subject-session-store-image-v0");
  }
  return value as EnvironmentCheckpointDocumentV0;
}

/** In-memory store for deterministic tests. */
export class InMemoryEnvironmentCheckpointStoreV0 implements EnvironmentCheckpointStoreV0 {
  private document: EnvironmentCheckpointDocumentV0 | null = null;
  location(): string | null {
    return null;
  }
  async load(): Promise<EnvironmentCheckpointLoadResultV0> {
    return this.document === null ? { kind: "NONE" } : { kind: "DOCUMENT", document: this.document };
  }
  async save(document: EnvironmentCheckpointDocumentV0): Promise<void> {
    this.document = document;
  }
}

/** Test-only corrupt store: always yields an unreadable document. */
export class CorruptEnvironmentCheckpointStoreV0 implements EnvironmentCheckpointStoreV0 {
  location(): string | null {
    return "corrupt";
  }
  async load(): Promise<EnvironmentCheckpointLoadResultV0> {
    return {
      kind: "DOCUMENT",
      document: { schema_version: ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION } as never
    };
  }
  async save(): Promise<void> {
    /* no-op */
  }
}

function checkpointFileName(subjectId: string, environmentId: string): string {
  // Keyed by (subject, environment): two environments for one subject never
  // collide and a wrong environment never selects another's sidecar.
  return `subject-${subjectId}.environment-${environmentId}.checkpoint.json`;
}

/** Atomic JSON file store; fail closed on corruption or unknown version. */
export class FileEnvironmentCheckpointStoreV0 implements EnvironmentCheckpointStoreV0 {
  private readonly path: string;
  constructor(rootDir: string, subjectId: string, environmentId: string) {
    this.path = join(rootDir, checkpointFileName(subjectId, environmentId));
  }
  location(): string {
    return this.path;
  }
  async load(): Promise<EnvironmentCheckpointLoadResultV0> {
    if (!existsSync(this.path)) return { kind: "NONE" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
    } catch (error) {
      throw new EnvironmentCheckpointCorruptErrorV0(
        this.path,
        error instanceof Error ? error.message : String(error)
      );
    }
    try {
      return { kind: "DOCUMENT", document: validateEnvironmentCheckpointDocumentV0(parsed) };
    } catch (error) {
      throw new EnvironmentCheckpointCorruptErrorV0(
        this.path,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  async save(document: EnvironmentCheckpointDocumentV0): Promise<void> {
    writeJsonAtomicV0(this.path, document);
  }
}
