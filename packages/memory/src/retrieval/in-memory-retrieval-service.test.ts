/**
 * P2.2.4 — InMemoryRetrievalService tests (pure; declarative fixtures only).
 * Covers: deterministic same-input/same-output, legal empty retrieval,
 * revision-mismatch reject, invalid fixture reject, evidence alignment, fingerprint
 * recomputation, frozen output and query validation.
 */

import { describe, expect, it } from "vitest";

import type { RetrievalRehearsalV0 } from "./types.js";
import { InMemoryRetrievalService } from "./in-memory-retrieval-service.js";

function rehearsal(overrides: Partial<RetrievalRehearsalV0> = {}): RetrievalRehearsalV0 {
  return {
    repository_revision: "R1" as never,
    semantic_reference: "observation:o-77" as never,
    selected_memory_refs: ["episode:e-1", "episode:e-2"] as never,
    evidence: [
      {
        episode_ref: "episode:e-1",
        reasons: [
          { dimension: "CONTEXT", score: 0.8 },
          { dimension: "TEMPORAL", score: 0.5 }
        ]
      },
      {
        episode_ref: "episode:e-2",
        reasons: [{ dimension: "SALIENCE", score: 0.9 }]
      }
    ] as never,
    candidate_count: 5,
    retrieval_trace_ref: "retrieval-trace:rt-1" as never,
    ...overrides
  };
}

function query(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: "subject-s0",
    repository_revision: "R1",
    semantic_reference: "observation:o-77",
    temporal: { now_logical_time: 90, window_start: 10 },
    entity_refs: ["entity:n1"],
    relationship_refs: [],
    current_context_refs: ["environment:room-9"],
    salience_constraints: { min_declared_score: null, max_candidates: 16 },
    ...overrides
  };
}

describe("InMemoryRetrievalService", () => {
  it("replays a matched rehearsal deterministically (same input, same bytes)", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: [rehearsal()] });
    const q = query() as never;
    const a = await service.retrieve(q);
    const b = await service.retrieve(q);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.isFrozen(a)).toBe(true);

    // Declared content replayed verbatim.
    expect(a.selected_memory_refs).toEqual(["episode:e-1", "episode:e-2"]);
    expect(a.evidence[0]?.reasons).toEqual([
      { dimension: "CONTEXT", score: 0.8 },
      { dimension: "TEMPORAL", score: 0.5 }
    ]);
    expect(a.deterministic_metadata.candidate_count).toBe(5);
    expect(a.retrieval_trace_ref).toBe("retrieval-trace:rt-1");
  });

  it("embeds the recomputed query fingerprint in deterministic metadata", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: [rehearsal()] });
    const q = query() as never;
    const r = await service.retrieve(q);
    // validateMemoryRetrievalResult already recomputes internally inside retrieve;
    // here we assert the value is a well-formed hash distinct per changed input.
    expect(r.deterministic_metadata.query_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    const other = await service.retrieve(
      query({ salience_constraints: { min_declared_score: 0.5, max_candidates: 16 } }) as never
    );
    expect(other.deterministic_metadata.query_fingerprint).not.toBe(
      r.deterministic_metadata.query_fingerprint
    );
  });

  it("returns LEGAL EMPTY RETRIEVAL for an unmatched anchor on a known revision", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: [rehearsal()] });
    const emptyQuery = query({ semantic_reference: "observation:o-unmatched" }) as never;
    const empty = await service.retrieve(emptyQuery);
    expect(empty.selected_memory_refs).toEqual([]);
    expect(empty.evidence).toEqual([]);
    expect(empty.deterministic_metadata.candidate_count).toBe(0);
    expect(empty.retrieval_trace_ref).toBeNull();
  });

  it("rejects queries naming an unknown repository revision", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: [rehearsal()] });
    await expect(service.retrieve(query({ repository_revision: "R999" }) as never)).rejects.toThrow(
      /INVALID_MEMORY_REVISION/
    );
  });

  it("rejects malformed queries before any lookup", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: [rehearsal()] });
    await expect(service.retrieve(query({ schema_version: "v9" }) as never)).rejects.toThrow(
      /INVALID_SCHEMA/
    );
  });

  it("rejects invalid fixtures at construction: misaligned evidence", () => {
    const misaligned = rehearsal({
      evidence: [
        {
          episode_ref: "episode:e-2",
          reasons: [{ dimension: "SALIENCE", score: 0.9 }]
        },
        {
          episode_ref: "episode:e-1",
          reasons: [{ dimension: "CONTEXT", score: 0.8 }]
        }
      ] as never
    });
    expect(() => new InMemoryRetrievalService({ rehearsals: [misaligned] })).toThrow(
      /invalid retrieval fixture/
    );
  });

  it("rejects invalid fixtures at construction: out-of-range reason score", () => {
    const badScore = rehearsal({
      evidence: [
        {
          episode_ref: "episode:e-1",
          reasons: [{ dimension: "CONTEXT", score: 1.75 }]
        },
        {
          episode_ref: "episode:e-2",
          reasons: [{ dimension: "SALIENCE", score: 0.9 }]
        }
      ] as never
    });
    expect(() => new InMemoryRetrievalService({ rehearsals: [badScore] })).toThrow(
      /invalid retrieval fixture/
    );
  });

  it("rejects fixtures whose candidate_count is below the selection count", () => {
    const lowCount = rehearsal({ candidate_count: 1 });
    expect(() => new InMemoryRetrievalService({ rehearsals: [lowCount] })).toThrow(
      /candidate_count/
    );
  });

  it("rejects duplicate rehearsal keys at construction", () => {
    expect(() =>
      new InMemoryRetrievalService({ rehearsals: [rehearsal(), rehearsal()] })
    ).toThrow(/duplicate rehearsal/);
  });

  it("supports anchor-null rehearsals for anchorless queries", async () => {
    const anchorless = rehearsal({
      semantic_reference: null,
      selected_memory_refs: ["episode:e-9"] as never,
      evidence: [
        { episode_ref: "episode:e-9", reasons: [{ dimension: "RECENCY" as never, score: 0.6 }] }
      ] as never,
      candidate_count: 2,
      retrieval_trace_ref: null
    });
    // "RECENCY" is not a frozen V0 dimension — construction must fail closed.
    expect(() => new InMemoryRetrievalService({ rehearsals: [anchorless] })).toThrow(
      /invalid retrieval fixture/
    );

    const validAnchorless = rehearsal({
      semantic_reference: null,
      selected_memory_refs: ["episode:e-9"] as never,
      evidence: [
        { episode_ref: "episode:e-9", reasons: [{ dimension: "TEMPORAL", score: 0.6 }] }
      ] as never,
      candidate_count: 2,
      retrieval_trace_ref: null
    });
    const service = new InMemoryRetrievalService({ rehearsals: [validAnchorless] });
    const q = query({ semantic_reference: null }) as never;
    const r = await service.retrieve(q);
    expect(r.selected_memory_refs).toEqual(["episode:e-9"]);
  });
});
