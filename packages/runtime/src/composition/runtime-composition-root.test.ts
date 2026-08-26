/**
 * P2.3.1 (P0-1/P0-2 remediated) — composition root smoke tests (boundary layer only;
 * NO transitions). Proves: required-capability enforcement, frozen container shell,
 * explicit not-yet-wired seams, and that the root executes nothing.
 */

import { describe, expect, it } from "vitest";

import type { MemoryRepository, MemoryRetrievalResultV0 } from "@characteros-next/memory";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import type { RuntimeCompositionOptions } from "./runtime-composition-root.js";
import { RuntimeCompositionRoot } from "./runtime-composition-root.js";
import { ReferenceContextProducer, ReferenceRetrievalMetadataProducer } from "../ports/index.js";

class MemoryRepositoryStub implements MemoryRepository {
  async prepareRevision(): Promise<never> {
    throw new Error("not used in composition test");
  }
  async readManifest(): Promise<null> {
    return null;
  }
  async validateRevisionBinding(): Promise<boolean> {
    return true;
  }
  async validateRefsBelong(): Promise<boolean> {
    return true;
  }
  readonly repository = Object.freeze({});
}

const emptyRetrieval = {
  retrieve: async (): Promise<MemoryRetrievalResultV0> =>
    ({
      schema_version: "memory-retrieval-result-v0",
      subject_id: "subject-s0",
      selected_memory_refs: [],
      evidence: [],
      retrieval_trace_ref: null,
      deterministic_metadata: {
        repository_revision: "R0",
        candidate_count: 0,
        computed_under_config: "MEMORY_RETRIEVAL_V0",
        query_fingerprint: `sha256:${"0".repeat(64)}`
      }
    }) as unknown as MemoryRetrievalResultV0
};

function buildRoot() {
  const assembly = createInMemorySubjectCoreFacade();
  const root = new RuntimeCompositionRoot({
    subjectCore: assembly.facade,
    memoryRepository: new MemoryRepositoryStub(),
    retrieval: emptyRetrieval,
    contextProducer: new ReferenceContextProducer(),
    retrievalMetadataProducer: new ReferenceRetrievalMetadataProducer()
  });
  return { root };
}

describe("RuntimeCompositionRoot", () => {
  it("assembles a frozen dependency view with explicit not-yet-wired seams", () => {
    const { root } = buildRoot();
    const deps = root.dependencies();
    expect(deps.subjectCore).toBeDefined();
    expect(deps.memory.repository).toBeDefined();
    expect(deps.retrieval).toBeDefined();
    expect(deps.contextProducer).not.toBeNull();
    expect(deps.retrievalMetadataProducer).not.toBeNull();
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
          memoryRepository: new MemoryRepositoryStub(),
          retrieval: emptyRetrieval
        } as unknown as RuntimeCompositionOptions)
    ).toThrow(/subjectCore/);

    expect(
      () =>
        new RuntimeCompositionRoot({
          subjectCore: createInMemorySubjectCoreFacade().facade,
          retrieval: emptyRetrieval
        } as unknown as RuntimeCompositionOptions)
    ).toThrow(/memoryRepository/);
  });

  it("exposes no execution surface beyond dependencies()", () => {
    const { root } = buildRoot();
    expect(Object.keys(root).sort()).toEqual(["container"]);
  });
});
