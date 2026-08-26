/**
 * P2.2.3 — retrieval contract conformance tests (pure; NO algorithm).
 * Proves closed-shape acceptance/rejection for query and result, deterministic
 * fingerprint behavior, alignment/normalization rules and interface satisfiability.
 */

import { describe, expect, it } from "vitest";

import {
  MEMORY_RETRIEVAL_CONFIG_V0,
  RETRIEVAL_REASON_DIMENSIONS,
  retrievalQueryFingerprint
} from "./types.js";
import {
  validateMemoryRetrievalQuery,
  validateMemoryRetrievalResult
} from "./validation.js";
import type { MemoryRetrievalService } from "./memory-retrieval-service.js";

function query(): Record<string, unknown> {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: "subject-s0",
    repository_revision: "R3",
    semantic_reference: "observation:o-77",
    temporal: { now_logical_time: 90, window_start: 10 },
    entity_refs: ["entity:n1", "entity:n2"],
    relationship_refs: ["relationship:r1"],
    current_context_refs: ["environment:room-9", "subject:s0"],
    salience_constraints: { min_declared_score: 0.25, max_candidates: 16 }
  };
}

function result(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "memory-retrieval-result-v0",
    subject_id: "subject-s0",
    selected_memory_refs: ["episode:e-1", "episode:e-2"],
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
    ],
    retrieval_trace_ref: "retrieval-trace:rt-1",
    deterministic_metadata: {
      repository_revision: "R3",
      candidate_count: 5,
      computed_under_config: "MEMORY_RETRIEVAL_V0",
      query_fingerprint: `sha256:${"3".repeat(64)}`
    },
    ...overrides
  };
}

describe("MemoryRetrievalQueryV0 conformance", () => {
  it("accepts a fully populated closed query", () => {
    const r = validateMemoryRetrievalQuery(query());
    expect(r.ok).toBe(true);
  });

  it("rejects unknown keys and wrong literals (closed object)", () => {
    const extra = query();
    extra["ranking_mode"] = "neural";
    expect(validateMemoryRetrievalQuery(extra).ok).toBe(false);

    const wrongVersion = query();
    wrongVersion["schema_version"] = "memory-retrieval-query-v9";
    expect(validateMemoryRetrievalQuery(wrongVersion).ok).toBe(false);
  });

  it("enforces kind allowlists and set ordering on reference groups", () => {
    const badRelationship = query();
    badRelationship["relationship_refs"] = ["entity:not-a-relationship"];
    let r = validateMemoryRetrievalQuery(badRelationship);
    expect(r.ok).toBe(false);

    const unsortedEntities = query();
    unsortedEntities["entity_refs"] = ["entity:n2", "entity:n1"];
    r = validateMemoryRetrievalQuery(unsortedEntities);
    expect(r.ok).toBe(false);
  });

  it("requires max_candidates to be a positive safe integer", () => {
    const zero = query();
    (zero["salience_constraints"] as Record<string, unknown>)["max_candidates"] = 0;
    const r = validateMemoryRetrievalQuery(zero);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_VALUE_RANGE");
  });

  it("fingerprint is deterministic and input-sensitive", async () => {
    const q = validateMemoryRetrievalQuery(query());
    if (!q.ok) throw new Error("fixture query invalid");
    const f1 = await retrievalQueryFingerprint(q.value);
    const f2 = await retrievalQueryFingerprint(q.value);
    expect(f1).toBe(f2);
    const changed = validateMemoryRetrievalQuery(
      query()
    );
    if (!changed.ok) throw new Error("fixture query invalid");
    (changed.value.salience_constraints as { min_declared_score: number | null }).min_declared_score =
      null;
    const f3 = await retrievalQueryFingerprint(changed.value);
    expect(f3).not.toBe(f1);
  });
});

describe("MemoryRetrievalResultV0 conformance", () => {
  it("accepts an aligned result and recomputes the embedded fingerprint", async () => {
    const q = query();
    const qChecked = validateMemoryRetrievalQuery(q);
    if (!qChecked.ok) throw new Error("fixture query invalid");
    const fingerprint = await retrievalQueryFingerprint(qChecked.value);
    const r = result({
      deterministic_metadata: {
        repository_revision: "R3",
        candidate_count: 5,
        computed_under_config: MEMORY_RETRIEVAL_CONFIG_V0,
        query_fingerprint: fingerprint
      }
    });
    const checked = await validateMemoryRetrievalResult(r, q);
    expect(checked.ok).toBe(true);
  });

  it("rejects misaligned evidence", async () => {
    const misaligned = result();
    const evidence = misaligned["evidence"] as Array<Record<string, unknown>>;
    (evidence[0] as Record<string, unknown>)["episode_ref"] = "episode:e-2";
    const r = await validateMemoryRetrievalResult(misaligned);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_SCHEMA");
  });

  it("enforces set-like ordering (unique, raw-ASCII-sorted) on selections", async () => {
    const unsorted = result();
    unsorted["selected_memory_refs"] = ["episode:e-2", "episode:e-1"];
    unsorted["evidence"] = [
      { episode_ref: "episode:e-2", reasons: [{ dimension: "SALIENCE", score: 0.9 }] },
      { episode_ref: "episode:e-1", reasons: [{ dimension: "CONTEXT", score: 0.8 }] }
    ];
    const r = await validateMemoryRetrievalResult(unsorted);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_SCHEMA");
  });

  it("enforces reason normalization and sorted unique dimensions", async () => {
    const outOfRange = result();
    const outEvidence = outOfRange["evidence"] as Array<Record<string, unknown>>;
    const outEntry = outEvidence[0] as Record<string, unknown>;
    const outReasons = outEntry["reasons"] as Array<Record<string, unknown>>;
    outReasons[0] = { dimension: "CONTEXT", score: 1.25 };
    let r = await validateMemoryRetrievalResult(outOfRange);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_VALUE_RANGE");

    const dupDim = result();
    const dupEvidence = dupDim["evidence"] as Array<Record<string, unknown>>;
    const dupEntry = dupEvidence[0] as Record<string, unknown>;
    const dupReasons = dupEntry["reasons"] as Array<Record<string, unknown>>;
    dupReasons[1] = { dimension: "CONTEXT", score: 0.1 };
    r = await validateMemoryRetrievalResult(dupDim);
    expect(r.ok).toBe(false);
  });

  it("requires candidate_count to be a nonnegative safe integer", async () => {
    const negative = result();
    (negative["deterministic_metadata"] as Record<string, unknown>)["candidate_count"] = -3;
    const r = await validateMemoryRetrievalResult(negative);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_VALUE_RANGE");
  });

  it("exposes exactly the frozen V0 evidence dimensions", () => {
    expect(RETRIEVAL_REASON_DIMENSIONS).toEqual([
      "CONTEXT",
      "ENTITY",
      "RELATIONSHIP",
      "SALIENCE",
      "SEMANTIC",
      "TEMPORAL"
    ]);
  });
});

describe("MemoryRetrievalService contract shape", () => {
  it("is satisfiable by a single-method deterministic port", async () => {
    // Contract stub only — proves the interface shape without any algorithm.
    const canned = result();
    const service: MemoryRetrievalService = {
      retrieve: async () => canned as never
    };
    expect(typeof service.retrieve).toBe("function");
    await expect(service.retrieve({} as never)).resolves.toBe(canned);
  });
});
