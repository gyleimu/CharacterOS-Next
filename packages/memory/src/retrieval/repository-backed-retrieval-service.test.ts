/**
 * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 — repository-backed
 * retrieval suite (memory package unit level).
 *
 * Proves: factual episode selection via entity overlap; tampered/malformed
 * payloads ignored (repository payload is authority); deterministic ranking
 * and top-K stability; existing query/result schemas unchanged (results pass
 * the frozen validator); invalid bindings fail closed. Revision manifests are
 * deltas: candidates are enumerated from the queried revision's OWN records.
 */

import { describe, expect, it } from "vitest";

import type { EpisodicMemoryRecordV0 } from "../records/episodic-record.js";
import { InMemoryMemoryRepository } from "../repository/in-memory-memory-repository.js";
import { computeMemoryRecordPayloadHash } from "../record-payload-hash.js";
import { retrievalQueryFingerprint, type MemoryRetrievalQueryV0 } from "./types.js";
import { validateMemoryRetrievalResult } from "./validation.js";
import { RepositoryBackedMemoryRetrievalServiceV0 } from "./repository-backed-retrieval-service.js";

const SUBJECT_ID = "subject-s0";

/** Host-side fixture episode record (memory-package unit level). */
function episodeRecord(overrides: Record<string, unknown> = {}): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: "episode:placeholder",
    occurrence_logical_time: 1,
    recorded_at_logical_time: 2,
    provenance: {
      transition_id: "t-learn-fixture",
      producer: "memory",
      cause_refs: ["entity:alice", "observation:o-1"]
    },
    references: ["entity:alice", "observation:o-1"],
    context: { scene: "conversation-feedback-v0", focus_refs: ["entity:alice"], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.6, source: "ENCODING_DECLARED_V0" },
    ...overrides
  } as unknown as EpisodicMemoryRecordV0;
}

/** One delta revision binding exactly the given records (parent = previous). */
async function prepareRevisionWith(
  repo: InMemoryMemoryRepository,
  parentRevision: string,
  records: readonly EpisodicMemoryRecordV0[]
): Promise<string> {
  const entries = [];
  for (const record of records) {
    const payloadHash = await repo.storePayload(record.episode_ref as never, record);
    const recomputed = await computeMemoryRecordPayloadHash(record);
    if (payloadHash !== recomputed) throw new Error("fixture invariant: payload hash must recompute");
    entries.push({ ref: record.episode_ref as never, payload_hash: payloadHash });
  }
  entries.sort((a, b) => (a.ref < b.ref ? -1 : 1));
  const prepared = await repo.prepareRevision({
    parent_revision: parentRevision as never,
    records: entries as never
  });
  return prepared.repository_revision as string;
}

function baseQuery(revision: string, overrides: Record<string, unknown> = {}): MemoryRetrievalQueryV0 {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: SUBJECT_ID as never,
    repository_revision: revision as never,
    semantic_reference: null,
    temporal: { now_logical_time: 10, window_start: null },
    entity_refs: ["entity:alice", "subject:s0"] as never,
    relationship_refs: [] as never,
    current_context_refs: [] as never,
    salience_constraints: { min_declared_score: null, max_candidates: 16 },
    ...overrides
  } as unknown as MemoryRetrievalQueryV0;
}

/** World: ONE revision binding the feedback-shaped episode + an unrelated one. */
async function buildWorldWithEpisodes(): Promise<{
  repo: InMemoryMemoryRepository;
  service: RepositoryBackedMemoryRetrievalServiceV0;
  feedbackEpisodeRef: string;
  otherEpisodeRef: string;
  revision: string;
}> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });
  const feedback = episodeRecord({ episode_ref: `episode:${"a".repeat(64)}` });
  const other = episodeRecord({
    episode_ref: `episode:${"b".repeat(64)}` as never,
    occurrence_logical_time: 5,
    references: ["observation:o-2"],
    context: { scene: "other-scene", focus_refs: [], environment_refs: [] }
  });
  const revision = await prepareRevisionWith(repo, "R0", [feedback, other]);
  return {
    repo,
    service: new RepositoryBackedMemoryRetrievalServiceV0(repo),
    feedbackEpisodeRef: feedback.episode_ref,
    otherEpisodeRef: other.episode_ref,
    revision
  };
}

describe("RepositoryBackedMemoryRetrievalServiceV0", () => {
  it("1. finds the factual feedback episode by entity overlap (no injected refs)", async () => {
    const { service, feedbackEpisodeRef, otherEpisodeRef, revision } = await buildWorldWithEpisodes();
    const result = await service.retrieve(baseQuery(revision));
    // Only the alice-overlapping episode matches; the unrelated one has no hit.
    expect(result.selected_memory_refs).toEqual([feedbackEpisodeRef]);
    expect(result.selected_memory_refs).not.toContain(otherEpisodeRef);
    const evidence = result.evidence[0];
    if (evidence === undefined) throw new Error("expected evidence");
    expect(evidence.episode_ref).toBe(feedbackEpisodeRef);
    expect(evidence.reasons.map((r) => r.dimension)).toContain("ENTITY");
    expect(result.deterministic_metadata.candidate_count).toBe(2);
  });

  it("2. ignores tampered episode payloads (repository payload is authority)", async () => {
    const { repo, service } = await buildWorldWithEpisodes();
    // A record whose MANIFEST hash is wrong (simulated post-commit tamper).
    const tampered = episodeRecord({
      episode_ref: `episode:${"c".repeat(64)}` as never,
      references: ["entity:alice"]
    });
    await repo.storePayload(tampered.episode_ref as never, tampered);
    const wrongHash = `sha256:${"f".repeat(64)}` as never;
    const tamperedRevision = await repo.prepareRevision({
      parent_revision: "R1" as never,
      records: [{ ref: tampered.episode_ref as never, payload_hash: wrongHash }] as never
    });
    const result = await service.retrieve(
      baseQuery((tamperedRevision as { repository_revision: string }).repository_revision)
    );
    expect(result.selected_memory_refs).not.toContain(tampered.episode_ref);
    // The tampered record is still COUNTED as examined.
    expect(result.deterministic_metadata.candidate_count).toBe(1);
  });

  it("3/4. deterministic ranking and stable top-K (salience precedence)", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.prepareRevision({ parent_revision: null, records: [] });
    const high = episodeRecord({
      episode_ref: `episode:${"d".repeat(64)}` as never,
      salience: { declared_score: 0.9, source: "ENCODING_DECLARED_V0" }
    });
    const mid = episodeRecord(); // 0.6 (default)
    const low = episodeRecord({
      episode_ref: `episode:${"e".repeat(64)}` as never,
      salience: { declared_score: 0.1, source: "ENCODING_DECLARED_V0" }
    });
    const revision = await prepareRevisionWith(repo, "R0", [high, mid, low]);
    const service = new RepositoryBackedMemoryRetrievalServiceV0(repo);
    const query = baseQuery(revision, {
      salience_constraints: { min_declared_score: null, max_candidates: 2 }
    });
    const first = await service.retrieve(query);
    const second = await service.retrieve(query);
    // Top-2 by salience among {0.9, 0.6, 0.1} — stable and without the lowest.
    expect(first.selected_memory_refs).toHaveLength(2);
    expect(first.selected_memory_refs).toContain(high.episode_ref);
    expect(first.selected_memory_refs).toContain(mid.episode_ref);
    expect(first.selected_memory_refs).not.toContain(low.episode_ref);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // Sorted at the contract boundary (raw-ASCII), evidence order-aligned.
    const sorted = [...first.selected_memory_refs].sort();
    expect(first.selected_memory_refs).toEqual(sorted);
    // Existing result schema unchanged: passes the FROZEN validator.
    expect(await validateMemoryRetrievalResult(first, query)).toMatchObject({ ok: true });
  });

  it("5/34. existing schemas unchanged; invalid bindings fail closed", async () => {
    const { service, feedbackEpisodeRef, revision } = await buildWorldWithEpisodes();
    const result = await service.retrieve(baseQuery(revision));
    const checked = await validateMemoryRetrievalResult(result, baseQuery(revision));
    expect(checked.ok).toBe(true);
    expect(result.schema_version).toBe("memory-retrieval-result-v0");
    expect(result.deterministic_metadata.computed_under_config).toBe("MEMORY_RETRIEVAL_V0");
    expect(result.deterministic_metadata.query_fingerprint).toBe(
      await retrievalQueryFingerprint(baseQuery(revision))
    );
    expect(result.subject_id).toBe(SUBJECT_ID);
    // Unknown revision fails closed.
    await expect(service.retrieve(baseQuery("R999"))).rejects.toThrow(/INVALID_MEMORY_REVISION/);
    // Constraint enforcement: salience floor excludes the 0.6 episode when the
    // floor is 0.8 (a wrong-revision candidate can never be selected — the
    // service enumerates ONLY the queried revision's own manifest).
    const floored = await service.retrieve(
      baseQuery(revision, { salience_constraints: { min_declared_score: 0.8, max_candidates: 16 } })
    );
    expect(floored.selected_memory_refs).not.toContain(feedbackEpisodeRef);
    expect(floored.selected_memory_refs).toHaveLength(0);
  });
});
