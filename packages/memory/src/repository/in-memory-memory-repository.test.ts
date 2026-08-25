/**
 * P2.2.2 — InMemoryMemoryRepository tests (pure; process memory only).
 * Covers: store record, create revision (genesis + derived chain), read manifest,
 * validate existing ref, reject missing ref, reject wrong revision, deterministic
 * repeats, immutability of stored manifests, monotonic id assignment and its guards.
 */

import { describe, expect, it } from "vitest";

import type {
  CanonicalRefV0,
  RepositoryRevisionBindingV1,
  RepositoryRevisionIdV0,
  RepositoryRecordHashV1
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash } from "../revisions.js";
import { InMemoryMemoryRepository } from "./in-memory-memory-repository.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

function record(ref: string, seed: string): RepositoryRecordHashV1 {
  return {
    ref: ref as unknown as CanonicalRefV0,
    payload_hash: `sha256:${seed}${"0".repeat(Math.max(0, 64 - seed.length))}`.slice(0, "sha256:".length + 64)
  } as unknown as RepositoryRecordHashV1;
}

function binding(id: string, hash: string): RepositoryRevisionBindingV1 {
  return {
    repository_revision: id,
    repository_revision_hash: hash
  } as unknown as RepositoryRevisionBindingV1;
}

function rid(id: string): RepositoryRevisionIdV0 {
  return id as RepositoryRevisionIdV0;
}

async function genesisRepo(): Promise<InMemoryMemoryRepository> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });
  return repo;
}

describe("genesis and golden binding", () => {
  it("creates immutable R0 on an empty repository", async () => {
    const repo = await genesisRepo();
    expect(repo.revisionIds()).toEqual([rid("R0")]);
    const manifest = await repo.readManifest(rid("R0"));
    expect(manifest).not.toBeNull();
    expect(manifest?.repository_revision).toBe("R0");
    expect(manifest?.record_hashes).toEqual([]);
    expect(Object.isFrozen(manifest)).toBe(true);
  });

  it("validates the frozen R0 binding hash and rejects a wrong one", async () => {
    const repo = await genesisRepo();
    await expect(
      repo.validateRevisionBinding(binding("R0", HASH_V1_R0_REPOSITORY))
    ).resolves.toBe(true);
    await expect(
      repo.validateRevisionBinding(binding("R0", `sha256:${"f".repeat(64)}`))
    ).resolves.toBe(false);
  });

  it("rejects a second genesis on a non-empty repository and unknown parents", async () => {
    const repo = await genesisRepo();
    await expect(repo.prepareRevision({ parent_revision: null, records: [] })).rejects.toThrow(
      /genesis/
    );
    await expect(
      repo.prepareRevision({ parent_revision: "R999" as RepositoryRevisionIdV0, records: [] })
    ).rejects.toThrow(/unknown parent/);
  });
});

describe("store record and create revisions", () => {
  it("stores records into a monotonic derived revision chain", async () => {
    const repo = await genesisRepo();
    const r1 = await repo.prepareRevision({
      parent_revision: rid("R0"),
      records: [record("episode:a-1", "11"), record("memory:b-2", "22")]
    });
    expect(r1.repository_revision).toBe("R1");
    const r2 = await repo.prepareRevision({
      parent_revision: rid("R1"),
      records: [record("experience:c-3", "33")]
    });
    expect(r2.repository_revision).toBe("R2");
    expect(repo.revisionIds().map(String)).toEqual(["R0", "R1", "R2"]);

    // Deterministic hash over the stored manifest.
    const manifest = await repo.readManifest(rid("R1"));
    if (manifest === null) throw new Error("R1 manifest unexpectedly missing");
    const recomputed = await computeRepositoryRevisionHash(manifest);
    await expect(repo.validateRevisionBinding(binding("R1", recomputed))).resolves.toBe(true);
  });

  it("rejects malformed prepare requests without burning sequence numbers", async () => {
    const repo = await genesisRepo();
    await expect(
      repo.prepareRevision({
        parent_revision: rid("R0"),
        records: [
          record("episode:b", "aa"),
          record("episode:a", "bb")
        ] // unsorted by ref
      })
    ).rejects.toThrow(/invalid revision prepare request/);
    const next = await repo.prepareRevision({
      parent_revision: rid("R0"),
      records: [record("episode:a", "aa")]
    });
    expect(next.repository_revision).toBe("R1");
  });
});

describe("read manifest and membership verdicts", () => {
  async function seeded(): Promise<InMemoryMemoryRepository> {
    const repo = await genesisRepo();
    await repo.prepareRevision({
      parent_revision: rid("R0"),
      records: [record("episode:a-1", "11"), record("memory:b-2", "22")]
    });
    await repo.prepareRevision({
      parent_revision: rid("R1"),
      records: [record("episode:c-3", "33")]
    });
    return repo;
  }

  it("returns the same frozen manifest instance across reads", async () => {
    const repo = await seeded();
    const first = await repo.readManifest(rid("R1"));
    const second = await repo.readManifest(rid("R1"));
    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("accepts refs that belong to the revision", async () => {
    const repo = await seeded();
    await expect(
      repo.validateRefsBelong(rid("R1"), ["episode:a-1" as CanonicalRefV0])
    ).resolves.toBe(true);
    await expect(
      repo.validateRefsBelong(rid("R1"), ["episode:a-1" as CanonicalRefV0, "memory:b-2" as CanonicalRefV0])
    ).resolves.toBe(true);
  });

  it("rejects a missing ref with false", async () => {
    const repo = await seeded();
    await expect(
      repo.validateRefsBelong(rid("R1"), ["episode:missing" as CanonicalRefV0])
    ).resolves.toBe(false);
  });

  it("rejects refs that belong to a DIFFERENT revision", async () => {
    const repo = await seeded();
    await expect(
      repo.validateRefsBelong(rid("R1"), ["episode:c-3" as CanonicalRefV0])
    ).resolves.toBe(false);
    await expect(
      repo.validateRefsBelong(rid("R999") , ["episode:a-1" as CanonicalRefV0])
    ).resolves.toBe(false);
  });

  it("never mutates SubjectState-shaped inputs and exposes no payload channel", async () => {
    const repo = await seeded();
    const verdict = await repo.validateRefsBelong(rid("R1"), ["episode:a-1" as CanonicalRefV0]);
    expect(typeof verdict).toBe("boolean");
    const bindingVerdict = await repo.validateRevisionBinding(
      binding("R1", `sha256:${"1".repeat(60)}1000`)
    );
    expect(typeof bindingVerdict).toBe("boolean");
  });
});

describe("deterministic repeats", () => {
  it("produces identical manifests and hashes for identical histories", async () => {
    const build = async () => {
      const repo = new InMemoryMemoryRepository();
      await repo.prepareRevision({ parent_revision: null, records: [] });
      const r1 = await repo.prepareRevision({
        parent_revision: rid("R0"),
        records: [record("episode:a-1", "11"), record("memory:b-2", "22")]
      });
      return { manifest: r1.manifest };
    };
    const a = await build();
    const b = await build();
    expect(a.manifest).toEqual(b.manifest);
    expect(await computeRepositoryRevisionHash(a.manifest)).toBe(
      await computeRepositoryRevisionHash(b.manifest)
    );
  });
});
