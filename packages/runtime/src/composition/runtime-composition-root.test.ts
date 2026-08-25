/**
 * P2.3.1 — composition root smoke tests (boundary layer only; NO transitions).
 * Proves: required-capability enforcement, frozen read-only container, and that the
 * root executes nothing (dependencies() is the sole surface).
 */

import { describe, expect, it } from "vitest";

import {
  InMemoryMemoryRepository,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import type {
  CommitTransitionInput,
  CommitTransitionOutcome,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { RuntimeCompositionRoot } from "./runtime-composition-root.js";

const stubRepo = new InMemoryMemoryRepository();

const stubCore = {
  commit: async (_input: CommitTransitionInput): Promise<CommitTransitionOutcome> => {
    throw new Error("transitions are not part of P2.3.1");
  },
  readCurrentSnapshot: async (_subjectId: string): Promise<SubjectStateV0 | null> => null
};

function buildRoot(): RuntimeCompositionRoot {
  return new RuntimeCompositionRoot({
    subjectCore: stubCore,
    memoryRepository: stubRepo,
    retrieval: {
      retrieve: async (query: MemoryRetrievalQueryV0) =>
        ({
          schema_version: "memory-retrieval-result-v0",
          subject_id: query.subject_id,
          selected_memory_refs: [],
          evidence: [],
          retrieval_trace_ref: null,
          deterministic_metadata: {
            repository_revision: query.repository_revision,
            candidate_count: 0,
            computed_under_config: "MEMORY_RETRIEVAL_V0",
            query_fingerprint: `sha256:${"0".repeat(64)}`
          }
        }) as unknown as MemoryRetrievalResultV0
    }
  });
}

describe("RuntimeCompositionRoot", () => {
  it("assembles a frozen dependency view with explicit not-yet-wired seams", () => {
    const deps = buildRoot().dependencies();
    expect(deps.subjectCore).toBe(stubCore);
    expect(deps.memory.repository).toBe(stubRepo);
    expect(deps.interpretation).toBeNull();
    expect(deps.appraisal).toBeNull();
    expect(deps.affectProducer).toBeNull();
    expect(deps.regulationProducer).toBeNull();
    expect(Object.isFrozen(deps)).toBe(true);
    expect(Object.isFrozen(deps.memory)).toBe(true);
  });

  it("rejects missing required capabilities", () => {
    expect(
      () =>
        new RuntimeCompositionRoot({
          memoryRepository: stubRepo,
          retrieval: { retrieve: async (q: MemoryRetrievalQueryV0) => q as never }
        } as never)
    ).toThrow(/subjectCore/);

    expect(
      () =>
        new RuntimeCompositionRoot({
          subjectCore: stubCore,
          retrieval: { retrieve: async (q: MemoryRetrievalQueryV0) => q as never }
        } as never)
    ).toThrow(/memoryRepository/);
  });

  it("exposes no execution surface beyond dependencies()", () => {
    const root = buildRoot() as unknown as Record<string, unknown>;
    const ownKeys = Object.keys(root).sort();
    expect(ownKeys).toEqual(["container"]);
  });
});
