/**
 * P2.3 Pre-Learning P0-5 — memory prepare-intent idempotency and payload integrity.
 * Regression matrix items: 10 (same intent ⇒ same revision), 11 (same intent +
 * changed payload ⇒ conflict), R6 (retry never mints a new revision), payload-hash
 * recomputation from repository-owned immutable payloads.
 */

import { describe, expect, it } from "vitest";

import type {
  CanonicalRefV0,
  RepositoryRecordHashV1
} from "@characteros-next/subject-core";
import type { PreparedRevisionV0 } from "./revisions.js";
import { computePrepareIntentFingerprint, validatePrepareIntentBody } from "./revisions.js";
import {
  InMemoryMemoryRepository
} from "./repository/in-memory-memory-repository.js";

interface EpisodicPayloadFixture {
  readonly schema_version: "episodic-memory-record-v0";
  readonly episode_id: string;
  readonly body: string;
}

function payload(episodeId: string, body: string): EpisodicPayloadFixture {
  return { schema_version: "episodic-memory-record-v0", episode_id: episodeId, body };
}

function recordOf(ref: string, hash: string): RepositoryRecordHashV1 {
  return { ref: ref as CanonicalRefV0, payload_hash: `sha256:${hash}${"0".repeat(Math.max(0, 64 - hash.length))}`.slice(0, 71) as never };
}

async function seeded(): Promise<{
  repo: InMemoryMemoryRepository;
  r1: PreparedRevisionV0;
}> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] }); // R0 genesis
  const hash = await repo.storePayload("episode:e-1" as CanonicalRefV0, payload("e-1", "body-1"));
  const r1 = await repo.prepareRevisionForIntent({
    intent_id: "intent-i-1" as never,
    parent_revision: "R0" as never,
    records: [recordOf("episode:e-1", hash.replace("sha256:", ""))] as never
  });
  return { repo, r1 };
}

describe("P0-5 memory prepare intent integrity", () => {
  it("10: same intent + same fingerprint returns the SAME prepared revision", async () => {
    const { repo, r1 } = await seeded();
    const storedHash = await repo.payloadHashOf("episode:e-1" as CanonicalRefV0);
    if (storedHash === null) throw new Error("stored payload missing");
    const replay = await repo.prepareRevisionForIntent({
      intent_id: "intent-i-1" as never,
      parent_revision: "R0" as never,
      records: [recordOf("episode:e-1", storedHash.replace("sha256:", ""))] as never
    });
    expect(replay.repository_revision).toBe(r1.repository_revision);
    expect(repo.revisionIds().map(String)).toEqual(["R0", "R1"]); // no duplicate revision minted
  });

  it("11: same intent + changed fingerprint is rejected as a conflict", async () => {
    const { repo } = await seeded();
    await expect(
      repo.prepareRevisionForIntent({
        intent_id: "intent-i-1" as never,
        parent_revision: "R0" as never,
        records: [recordOf("episode:e-CHANGED", "ff")] as never
      })
    ).rejects.toThrow(/MEMORY_PREPARE_CONFLICT/);
    expect(repo.revisionIds().map(String)).toEqual(["R0", "R1"]);
  });

  it("verifies declared hashes against repository-owned immutable payloads", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.prepareRevision({ parent_revision: null, records: [] });
    const realHash = (await repo.storePayload("episode:e-1" as CanonicalRefV0, payload("e-1", "body-1"))).replace(
      "sha256:",
      ""
    );
    // Forged declaration claims a different payload hash → rejected.
    await expect(
      repo.prepareRevisionForIntent({
        intent_id: "intent-forged" as never,
        parent_revision: "R0" as never,
        records: [recordOf("episode:e-1", "deadbeef")] as never
      })
    ).rejects.toThrow(/payload hash mismatch/);

    // Correct declaration succeeds and the stored payload is frozen.
    const ok = await repo.prepareRevisionForIntent({
      intent_id: "intent-ok" as never,
      parent_revision: "R0" as never,
      records: [recordOf("episode:e-1", realHash)] as never
    });
    expect(ok.repository_revision).toBe("R1");
  });

  it("computes a deterministic payload fingerprint over parent+records", async () => {
    const intent = {
      parent_revision: "R0" as never,
      records: [recordOf("episode:e-1", "11")] as never
    };
    const f1 = await computePrepareIntentFingerprint(intent);
    const f2 = await computePrepareIntentFingerprint(intent);
    expect(f1).toBe(f2);
    const f3 = await computePrepareIntentFingerprint({
      parent_revision: "R0" as never,
      records: [recordOf("episode:e-2", "22")] as never
    });
    expect(f3).not.toBe(f1);
  });

  it("validates the closed intent body", () => {
    expect(validatePrepareIntentBody({
      intent_id: "intent-x",
      parent_revision: null,
      records: []
    }).ok).toBe(true);
    expect(validatePrepareIntentBody({ intent_id: 5 }).ok).toBe(false);
  });

  it("adoption seam: markAdopted/isAdopted track canonical adoption state", async () => {
    const { repo, r1 } = await seeded();
    void r1;
    expect(repo.isAdopted("R1" as never)).toBe(false);
    repo.markAdopted("R1" as never);
    expect(repo.isAdopted("R1" as never)).toBe(true);
  });
});
