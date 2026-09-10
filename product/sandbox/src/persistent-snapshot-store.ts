/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product snapshot store.
 *
 * Durable, atomic, file-backed persistence of the interactive runtime snapshot.
 * A load either returns the exact recorded snapshot, reports NONE (first
 * launch), or FAILS CLOSED — a missing/corrupt/incompatible snapshot never
 * silently becomes a new subject.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { InteractiveSubjectSnapshotV0 } from "@characteros-next/runtime";

export type SnapshotLoadResultV0 =
  | { readonly kind: "NONE" }
  | { readonly kind: "SNAPSHOT"; readonly snapshot: InteractiveSubjectSnapshotV0 };

export interface InteractiveSnapshotStoreV0 {
  /** Absolute path shown to operators; null for non-file stores. */
  location(): string | null;
  load(): Promise<SnapshotLoadResultV0>;
  save(snapshot: InteractiveSubjectSnapshotV0): Promise<void>;
}

export class InteractiveSnapshotCorruptErrorV0 extends Error {
  constructor(readonly path: string, detail: string) {
    super(`Subject snapshot at ${path} is unreadable: ${detail}. Refusing to start a new subject.`);
    this.name = "InteractiveSnapshotCorruptErrorV0";
  }
}

/** In-memory store for deterministic tests. */
export class InMemoryInteractiveSnapshotStoreV0 implements InteractiveSnapshotStoreV0 {
  private snapshot: InteractiveSubjectSnapshotV0 | null = null;
  location(): string | null {
    return null;
  }
  async load(): Promise<SnapshotLoadResultV0> {
    return this.snapshot === null ? { kind: "NONE" } : { kind: "SNAPSHOT", snapshot: this.snapshot };
  }
  async save(snapshot: InteractiveSubjectSnapshotV0): Promise<void> {
    this.snapshot = snapshot;
  }
}

function snapshotFileName(subjectId: string): string {
  return `subject-${subjectId}.snapshot.json`;
}

/**
 * Atomic JSON file store: the snapshot is written to a temporary sibling file
 * and renamed over the target, so a crash mid-write can never leave a
 * half-written snapshot in place.
 */
export class FileInteractiveSnapshotStoreV0 implements InteractiveSnapshotStoreV0 {
  private readonly path: string;
  constructor(private readonly rootDir: string, subjectId: string) {
    this.path = join(rootDir, snapshotFileName(subjectId));
  }
  location(): string {
    return this.path;
  }
  async load(): Promise<SnapshotLoadResultV0> {
    if (!existsSync(this.path)) return { kind: "NONE" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
    } catch (error) {
      throw new InteractiveSnapshotCorruptErrorV0(this.path, error instanceof Error ? error.message : String(error));
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new InteractiveSnapshotCorruptErrorV0(this.path, "expected a JSON object");
    }
    const record = parsed as Record<string, unknown>;
    if (record["schema_version"] !== "interactive-subject-snapshot-v0") {
      throw new InteractiveSnapshotCorruptErrorV0(this.path, `unsupported schema_version ${String(record["schema_version"])}`);
    }
    return { kind: "SNAPSHOT", snapshot: parsed as InteractiveSubjectSnapshotV0 };
  }
  async save(snapshot: InteractiveSubjectSnapshotV0): Promise<void> {
    mkdirSync(this.rootDir, { recursive: true });
    const tempPath = `${this.path}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.path);
  }
}
