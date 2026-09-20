/** PERSISTENCE_R2_SCALABILITY_V0 — lossless thin store representation. */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  InteractiveSubjectSnapshotV0,
  SessionStoreImageV0
} from "@characteros-next/runtime";

import {
  SESSION_STORE_IMAGE_R2_SCHEMA_VERSION,
  decodeSessionStoreImageAnyV0,
  encodeSessionStoreImageR2V0
} from "./persistence-r2-store-image.js";
import {
  FileInteractiveSnapshotStoreV0,
  InteractiveSnapshotCorruptErrorV0
} from "./persistent-snapshot-store.js";
import {
  ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION,
  EnvironmentCheckpointCorruptErrorV0,
  FileEnvironmentCheckpointStoreV0,
  type EnvironmentCheckpointDocumentV0
} from "./environment-checkpoint-store.js";
import {
  FileSharedSubjectSourceStoreV0,
  SharedSubjectSourceCorruptErrorV0
} from "./shared-subject-source.js";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "characteros-r2-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

function snapshot(revision: number, entries: readonly string[]) {
  return {
    schema_version: "subject-state-v4",
    identity: { subject_id: "subject-a" },
    memory_state: { repository_revision: `R${String(revision)}`, working_refs: entries.slice(-2) },
    beliefs: [],
    relationships: [],
    affect: { valence: revision / 10, activation: 0.5 },
    trace_window: {
      trace_window_schema_version: "trace-window-v1",
      capacity: 3,
      cursor: revision,
      entries: entries.map((trace_id) => ({ trace_id, revision }))
    },
    runtime_metadata: { state_revision: revision, logical_time: revision }
  };
}

function bundle(revision: number, nextSnapshot: ReturnType<typeof snapshot>) {
  return {
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    commit_ref: `commit:${String(revision)}`,
    previous_record_checksum: revision === 1 ? null : `checksum:${String(revision - 1)}`,
    next_snapshot: nextSnapshot,
    logical_time_before: revision - 1,
    logical_time_after: revision,
    trace_entry: { trace_id: `trace:${String(revision)}` },
    trace_window: nextSnapshot.trace_window,
    mutation_history_link: { current_trace_ref: `trace:${String(revision)}` },
    record_checksum: `checksum:${String(revision)}`
  };
}

function storeImage(): SessionStoreImageV0 {
  const snapshots = [
    snapshot(1, ["t1"]),
    snapshot(2, ["t1", "t2"]),
    snapshot(3, ["t1", "t2", "t3"]),
    snapshot(4, ["t2", "t3", "t4"])
  ];
  return {
    schema_version: "subject-session-store-image-v0",
    revisions: [
      { repository_revision: "R0", manifest: { record_hashes: [] }, payloads: [] },
      { repository_revision: "R1", manifest: { record_hashes: [] }, payloads: [] }
    ],
    committed_bundles: snapshots.map((item, index) => bundle(index + 1, item))
  } as unknown as SessionStoreImageV0;
}

function interactiveSnapshot(store: SessionStoreImageV0): InteractiveSubjectSnapshotV0 {
  return {
    schema_version: "interactive-subject-snapshot-v0",
    session_id: "session-a",
    subject_id: "subject-a",
    subject: { subject_id: "subject-a", display_name: "A", identity_anchors: [] },
    next_turn_index: 4,
    pending_behavior_outcome: null,
    durable: {
      schema_version: "subject-session-durable-state-v0",
      identity: { subject_head: { commit_ref: "commit:4" } }
    },
    store,
    saved_at: "2026-01-01T00:00:00.000Z"
  } as unknown as InteractiveSubjectSnapshotV0;
}

describe("PERSISTENCE_R2 store image codec", () => {
  it("P2/P4/P5: reconstructs the exact complete old-format value", () => {
    const old = storeImage();
    const encoded = encodeSessionStoreImageR2V0(old);
    expect(encoded.schema_version).toBe(SESSION_STORE_IMAGE_R2_SCHEMA_VERSION);
    expect(decodeSessionStoreImageAnyV0(encoded)).toEqual(old);
  });

  it("physically omits repeated next_snapshot and outer trace_window values", () => {
    const encoded = encodeSessionStoreImageR2V0(storeImage());
    expect(encoded.committed_bundles[0]?.next_snapshot.kind).toBe("FULL");
    expect(encoded.committed_bundles[1]?.next_snapshot.kind).toBe("DELTA");
    for (const item of encoded.committed_bundles) {
      expect(item.fields).not.toHaveProperty("next_snapshot");
      expect(item.fields).not.toHaveProperty("trace_window");
    }
    expect(encoded.committed_bundles[3]?.next_snapshot).toMatchObject({ kind: "DELTA" });
  });

  it("P1: reads an existing complete v0 image without conversion", () => {
    const old = storeImage();
    expect(decodeSessionStoreImageAnyV0(old)).toBe(old);
  });

  it("P12: corrupt deltas fail closed", () => {
    const encoded = JSON.parse(JSON.stringify(encodeSessionStoreImageR2V0(storeImage()))) as {
      committed_bundles: { next_snapshot: Record<string, unknown> }[];
    };
    const corruptBundle = encoded.committed_bundles[1];
    expect(corruptBundle).toBeDefined();
    if (corruptBundle === undefined) throw new Error("fixture bundle missing");
    corruptBundle.next_snapshot = {
      kind: "DELTA",
      delta: { op: "array-window", drop_prefix: 999, keep: 999, append: [] }
    };
    expect(() => decodeSessionStoreImageAnyV0(encoded)).toThrow(/non-array base|bounds invalid/);
  });

  it("rejects a bundle whose duplicated trace_window is not identical", () => {
    const old = storeImage() as unknown as { committed_bundles: Record<string, unknown>[] };
    const corruptBundle = old.committed_bundles[2];
    expect(corruptBundle).toBeDefined();
    if (corruptBundle === undefined) throw new Error("fixture bundle missing");
    corruptBundle["trace_window"] = { different: true };
    expect(() => encodeSessionStoreImageR2V0(old as unknown as SessionStoreImageV0)).toThrow(
      /trace_window is not identical/
    );
  });
});

describe("PERSISTENCE_R2 file compatibility", () => {
  it("P2/P3: writes R2 and loads a complete interactive snapshot", async () => {
    const root = tempRoot();
    const store = new FileInteractiveSnapshotStoreV0(root, "subject-a");
    const expected = interactiveSnapshot(storeImage());
    await store.save(expected);
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as Record<string, unknown>;
    expect((raw["store"] as Record<string, unknown>)["schema_version"]).toBe(
      SESSION_STORE_IMAGE_R2_SCHEMA_VERSION
    );
    await expect(store.load()).resolves.toEqual({ kind: "SNAPSHOT", snapshot: expected });
  });

  it("P1: loads an old R1 snapshot containing the complete v0 store", async () => {
    const root = tempRoot();
    const store = new FileInteractiveSnapshotStoreV0(root, "subject-a");
    const expected = interactiveSnapshot(storeImage());
    writeFileSync(store.location(), JSON.stringify(expected), "utf8");
    await expect(store.load()).resolves.toEqual({ kind: "SNAPSHOT", snapshot: expected });
  });

  it("P12: a corrupt thin snapshot is classified as corrupt", async () => {
    const root = tempRoot();
    const store = new FileInteractiveSnapshotStoreV0(root, "subject-a");
    const expected = interactiveSnapshot(storeImage());
    await store.save(expected);
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as {
      store: { committed_bundles: { next_snapshot: Record<string, unknown> }[] };
    };
    const corruptBundle = raw.store.committed_bundles[1];
    expect(corruptBundle).toBeDefined();
    if (corruptBundle === undefined) throw new Error("fixture bundle missing");
    corruptBundle.next_snapshot = { kind: "UNKNOWN" };
    writeFileSync(store.location(), JSON.stringify(raw), "utf8");
    await expect(store.load()).rejects.toBeInstanceOf(InteractiveSnapshotCorruptErrorV0);
  });

  it("writes/reads the shared authority as R2 while exposing the legacy complete type", async () => {
    const root = tempRoot();
    const store = new FileSharedSubjectSourceStoreV0(root, "subject-a");
    const snapshotValue = interactiveSnapshot(storeImage());
    const saved = await store.save(
      {
        subject_id: "subject-a",
        durable: snapshotValue.durable,
        store: snapshotValue.store,
        updated_at: "2026-01-01T00:00:00.000Z"
      },
      null
    );
    expect(saved.kind).toBe("SAVED");
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as Record<string, unknown>;
    expect((raw["store"] as Record<string, unknown>)["schema_version"]).toBe(
      SESSION_STORE_IMAGE_R2_SCHEMA_VERSION
    );
    const loaded = await store.load();
    expect(loaded.kind).toBe("DOCUMENT");
    if (loaded.kind === "DOCUMENT") expect(loaded.document.store).toEqual(snapshotValue.store);
  });

  it("corrupt shared R2 authority fails closed", async () => {
    const root = tempRoot();
    const store = new FileSharedSubjectSourceStoreV0(root, "subject-a");
    const value = interactiveSnapshot(storeImage());
    await store.save(
      {
        subject_id: "subject-a",
        durable: value.durable,
        store: value.store,
        updated_at: "2026-01-01T00:00:00.000Z"
      },
      null
    );
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as {
      store: Record<string, unknown>;
    };
    raw.store["committed_bundles"] = "missing";
    writeFileSync(store.location(), JSON.stringify(raw), "utf8");
    await expect(store.load()).rejects.toBeInstanceOf(SharedSubjectSourceCorruptErrorV0);
  });

  function checkpointDocument(): EnvironmentCheckpointDocumentV0 {
    return {
      schema_version: ENVIRONMENT_CHECKPOINT_DOCUMENT_SCHEMA_VERSION,
      environment_id: "env-a",
      base_revision: 7,
      checkpoint: { schema_version: "subject-session-checkpoint-v0" },
      store: storeImage()
    } as unknown as EnvironmentCheckpointDocumentV0;
  }

  it("writes/reads the environment checkpoint as R2 while exposing the legacy complete type", async () => {
    const root = tempRoot();
    const store = new FileEnvironmentCheckpointStoreV0(root, "subject-a", "env-a");
    const expected = checkpointDocument();
    await store.save(expected);
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as Record<string, unknown>;
    expect((raw["store"] as Record<string, unknown>)["schema_version"]).toBe(
      SESSION_STORE_IMAGE_R2_SCHEMA_VERSION
    );
    await expect(store.load()).resolves.toEqual({ kind: "DOCUMENT", document: expected });
  });

  it("a missing environment checkpoint is a first launch, not corruption", async () => {
    const store = new FileEnvironmentCheckpointStoreV0(tempRoot(), "subject-a", "env-a");
    await expect(store.load()).resolves.toEqual({ kind: "NONE" });
  });

  it("loads an old R1 environment checkpoint file unchanged", async () => {
    const root = tempRoot();
    const store = new FileEnvironmentCheckpointStoreV0(root, "subject-a", "env-a");
    const expected = checkpointDocument();
    writeFileSync(store.location(), JSON.stringify(expected), "utf8");
    await expect(store.load()).resolves.toEqual({ kind: "DOCUMENT", document: expected });
  });

  it("corrupt environment checkpoint fails closed", async () => {
    const root = tempRoot();
    const store = new FileEnvironmentCheckpointStoreV0(root, "subject-a", "env-a");
    await store.save(checkpointDocument());
    const raw = JSON.parse(readFileSync(store.location(), "utf8")) as {
      store: { committed_bundles: { next_snapshot: Record<string, unknown> }[] };
    };
    const corruptBundle = raw.store.committed_bundles[1];
    expect(corruptBundle).toBeDefined();
    if (corruptBundle === undefined) throw new Error("fixture bundle missing");
    corruptBundle.next_snapshot = { kind: "DELTA", delta: { op: "unknown-op" } };
    writeFileSync(store.location(), JSON.stringify(raw), "utf8");
    await expect(store.load()).rejects.toBeInstanceOf(EnvironmentCheckpointCorruptErrorV0);
  });
});
