/**
 * Episode Content Reader V0 — security acceptance suite
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 §27).
 *
 * Every required check fails closed; no silent omission for requested evidence:
 *   valid current episode ref      → content available
 *   non-episode / receipt ref      → REF_INVALID
 *   ref not in revision            → REF_NOT_IN_REVISION
 *   unbound revision               → REVISION_UNBOUND
 *   payload hash mismatch          → PAYLOAD_HASH_MISMATCH
 *   missing payload                → PAYLOAD_MISSING
 *   payload schema violation       → PAYLOAD_SCHEMA_INVALID
 */

import { describe, expect, it } from "vitest";

import { computeMemoryRecordPayloadHash } from "../record-payload-hash.js";
import type { HashV1 } from "@characteros-next/subject-core";
import { InMemoryMemoryRepository } from "../repository/in-memory-memory-repository.js";
import { createEpisodeContentReaderV0 } from "./episode-content-reader.js";

const REVISION = "rev-test-1" as never;
const ALICE = "entity:alice";

function episodeFixture(ref: string, scene: string): Record<string, unknown> {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: ref,
    occurrence_logical_time: 1,
    recorded_at_logical_time: 1,
    provenance: { transition_id: "t-enc", producer: "memory", cause_refs: [] },
    references: [ALICE],
    context: { scene, focus_refs: [ALICE], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5, source: "ENCODING_DECLARED_V0" }
  };
}

async function composedRepo(
  episodes: readonly { ref: string; scene: string }[]
): Promise<{ repo: InMemoryMemoryRepository; revision: string }> {
  const repo = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (const episode of episodes) {
    const stored = await repo.storePayload(episode.ref as never, episodeFixture(episode.ref, episode.scene));
    records.push({ ref: episode.ref as never, payload_hash: stored } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: "intent-reader-test" as never,
    parent_revision: null,
    records
  });
  return { repo, revision: prepared.repository_revision };
}

describe("Episode Content Reader V0 security", () => {
  it("returns validated content for a lawful current episode ref", async () => {
    const { repo, revision } = await composedRepo([
      { ref: "episode:alice-01", scene: "Alice asked for concise, factual updates." }
    ]);
    const reader = createEpisodeContentReaderV0(repo);
    const read = await reader.read({ repository_revision: revision as never, refs: ["episode:alice-01"] as never });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.contents).toHaveLength(1);
      expect(read.contents[0]?.ref).toBe("episode:alice-01");
      expect(read.contents[0]?.scene).toBe("Alice asked for concise, factual updates.");
      expect(read.contents[0]?.payload_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("rejects non-episode, receipt and authority refs", async () => {
    const { repo, revision } = await composedRepo([{ ref: "episode:alice-01", scene: "s" }]);
    const reader = createEpisodeContentReaderV0(repo);
    for (const bad of [
      "entity:alice",
      "appraisal:1111111111111111111111111111111111111111111111111111111111111111",
      "commit:2222222222222222222222222222222222222222222222222222222222222222",
      "workflow:3333333333333333333333333333333333333333333333333333333333333333"
    ]) {
      const read = await reader.read({ repository_revision: revision as never, refs: [bad] as never });
      expect(read.ok, bad).toBe(false);
      if (!read.ok) expect(read.code).toBe("REF_INVALID");
    }
  });

  it("rejects refs outside the bound revision and unbound revisions", async () => {
    const { repo, revision } = await composedRepo([{ ref: "episode:alice-01", scene: "s" }]);
    const reader = createEpisodeContentReaderV0(repo);
    // structurally valid episode ref that is NOT a member of the revision
    const outside = await reader.read({
      repository_revision: revision as never,
      refs: ["episode:other-subject-secret"] as never
    });
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.code).toBe("REF_NOT_IN_REVISION");

    const unbound = await reader.read({
      repository_revision: "rev-unknown" as never,
      refs: ["episode:alice-01"] as never
    });
    expect(unbound.ok).toBe(false);
    if (!unbound.ok) expect(unbound.code).toBe("REVISION_UNBOUND");
  });

  it("rejects payload hash tampering and missing payloads", async () => {
    const { repo, revision } = await composedRepo([{ ref: "episode:alice-01", scene: "s" }]);
    const reader = createEpisodeContentReaderV0(repo);
    // tamper with the stored payload behind the repo's back: hash mismatch
    const tamperedPayload = episodeFixture("episode:alice-01", "TAMPERED SCENE");
    (repo as unknown as { payloads: Map<string, unknown> }).payloads.set(
      "episode:alice-01" as never,
      tamperedPayload
    );
    const tampered = await reader.read({ repository_revision: revision as never, refs: ["episode:alice-01"] as never });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.code).toBe("PAYLOAD_HASH_MISMATCH");

    // payload removed entirely
    (repo as unknown as { payloads: Map<string, unknown> }).payloads.delete("episode:alice-01" as never);
    const missing = await reader.read({ repository_revision: revision as never, refs: ["episode:alice-01"] as never });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("PAYLOAD_MISSING");
  });

  it("rejects payloads violating the closed EpisodicMemoryRecordV0 schema", async () => {
    // The manifest hash is overridden to match the broken payload exactly, so
    // ONLY the schema check can reject — isolating the schema gate.
    const brokenPayload = {
      ...episodeFixture("episode:alice-01", "s"),
      schema_version: "episodic-memory-record-v9",
      extra_forbidden_field: true
    };
    const brokenHash = await computeMemoryRecordPayloadHash(brokenPayload);
    class SchemaBrokenRepo extends InMemoryMemoryRepository {
      override readStoredPayload(): unknown {
        return brokenPayload;
      }
      override async payloadHashOf(): Promise<HashV1> {
        return brokenHash as never;
      }
      override async readManifest(): Promise<never> {
        return {
          schema_version: "repository-revision-manifest-v1",
          repository_revision: REVISION,
          parent_revision: null,
          record_hashes: [{ ref: "episode:alice-01", payload_hash: brokenHash }],
          index_manifest_hash: null
        } as never;
      }
      override async validateRefsBelong(): Promise<boolean> {
        return true;
      }
    }
    const reader = createEpisodeContentReaderV0(new SchemaBrokenRepo());
    const schemaBroken = await reader.read({
      repository_revision: REVISION,
      refs: ["episode:alice-01"] as never
    });
    expect(schemaBroken.ok).toBe(false);
    if (!schemaBroken.ok) expect(schemaBroken.code).toBe("PAYLOAD_SCHEMA_INVALID");
  });
});
