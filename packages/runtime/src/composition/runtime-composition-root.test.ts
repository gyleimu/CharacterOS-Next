/**
 * P2.3.1 (P0-1/P0-2 remediated) — composition root smoke tests (boundary layer only;
 * NO transitions). Proves: required-capability enforcement, frozen container shell,
 * explicit not-yet-wired seams, and that the root executes nothing.
 */

import { describe, expect, it } from "vitest";

import type { MemoryPreparationAuthority, MemoryRetrievalResultV0 } from "@characteros-next/memory";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import type { RuntimeCompositionOptions } from "./runtime-composition-root.js";
import { RuntimeCompositionRoot } from "./runtime-composition-root.js";
import { ReferenceContextProducer, ReferenceRetrievalMetadataProducer } from "../ports/index.js";

class MemoryRepositoryStub implements MemoryPreparationAuthority {
  async storePayload(): Promise<never> {
    throw new Error("not used in composition test");
  }
  async payloadHashOf(): Promise<null> {
    return null;
  }
  async prepareRevisionForIntent(): Promise<never> {
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
  const assembly = createInMemorySubjectCoreFacade({
    // Composition smoke tests run no transitions; the gate must still be explicit.
    preparedResultValidator: async () => true
  });
  const root = new RuntimeCompositionRoot({
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
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

    const facadeAssembly = createInMemorySubjectCoreFacade({
      preparedResultValidator: async () => true
    });
    expect(
      () =>
        new RuntimeCompositionRoot({
          subjectCore: facadeAssembly.facade,
          retrieval: emptyRetrieval
        } as unknown as RuntimeCompositionOptions)
    ).toThrow(/producerAuthorizationIssuer/);

    expect(
      () =>
        new RuntimeCompositionRoot({
          subjectCore: facadeAssembly.facade,
          producerAuthorizationIssuer: facadeAssembly.producerAuthorizationIssuer,
          retrieval: emptyRetrieval
        } as unknown as RuntimeCompositionOptions)
    ).toThrow(/memoryRepository/);
  });

  it("exposes no execution surface beyond dependencies()", () => {
    const { root } = buildRoot();
    expect(Object.keys(root).sort()).toEqual(["container"]);
  });
});
