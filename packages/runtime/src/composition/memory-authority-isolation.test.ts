/**
 * P2.3 Trust-Boundary Surgical Closure Round 3 — B2 runtime memory authority
 * isolation regressions.
 *
 * Red-team finding (BLOCKER B2): RuntimeCompositionRoot typed
 * `memory.repository` as MemoryPreparationAuthority, but at runtime it retained
 * the ORIGINAL concrete repository object, so JavaScript callers could still
 * reach `dependencies().memory.repository.prepareRevision` — bypassing intent
 * identity, payload fingerprint, idempotency and the sanctioned preparation
 * authority. TypeScript interface narrowing is NOT a runtime capability boundary.
 *
 * Required property: the runtime-facing handle is a NEW frozen wrapper object
 * exposing only the sanctioned operations; the raw revision-minting surface is
 * unreachable through the dependency container, while honest intent-based
 * preparation keeps working end to end.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import { RuntimeCompositionRoot } from "./runtime-composition-root.js";

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

function payload(episodeId: string, body: string) {
  return { schema_version: "episodic-memory-record-v0", episode_id: episodeId, body };
}

/**
 * Host-side composition: the concrete repository legitimately holds the raw
 * revision-minting surface (infrastructure duty — genesis minting, tests). The
 * runtime container must project it away.
 */
async function buildRootWithConcreteRepository() {
  const concrete = new InMemoryMemoryRepository();
  // Genesis R0 is a host/infrastructure duty (raw surface, outside runtime).
  await concrete.prepareRevision({ parent_revision: null, records: [] });

  const assembly = createInMemorySubjectCoreFacade({
    preparedResultValidator: async () => true
  });
  const root = new RuntimeCompositionRoot({
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
    memoryRepository: concrete,
    retrieval: emptyRetrieval
  });
  return { root, concrete };
}

describe("round 3 — B2 runtime memory authority isolation", () => {
  it("B2.1: the runtime handle never exposes raw prepareRevision (plain JS runtime check)", async () => {
    const { root, concrete } = await buildRootWithConcreteRepository();
    const handle = root.dependencies().memory.repository;

    // Actual JavaScript runtime checks — NOT satisfied via @ts-expect-error.
    expect("prepareRevision" in (handle as object)).toBe(false);
    expect(typeof (handle as unknown as Record<string, unknown>)["prepareRevision"]).toBe("undefined");

    // A NEW wrapper object, never the concrete repository itself.
    expect(handle).not.toBe(concrete);
    expect(Object.isFrozen(handle)).toBe(true);

    // Exactly the sanctioned surface — no extra members smuggled through.
    expect(Object.keys(handle).sort()).toEqual([
      "payloadHashOf",
      "prepareRevisionForIntent",
      "readManifest",
      "storePayload",
      "validateRefsBelong",
      "validateRevisionBinding"
    ]);
  });

  it("B2.2: safe intent-based prepare still works through the sanctioned runtime handle", async () => {
    const { root, concrete } = await buildRootWithConcreteRepository();
    const handle = root.dependencies().memory.repository;

    const hash = await handle.storePayload("episode:e-b2" as CanonicalRefV0, payload("e-b2", "body"));
    const prepared = await handle.prepareRevisionForIntent({
      intent_id: "intent-i-b2" as never,
      parent_revision: "R0" as never,
      records: [{ ref: "episode:e-b2" as CanonicalRefV0, payload_hash: hash }]
    });
    expect(prepared.repository_revision).not.toBe("R0");
    // The honest prepare lands in the underlying repository infrastructure.
    expect(await concrete.readManifest(prepared.repository_revision)).not.toBeNull();
  });

  it("B2.3: same intent + same fingerprint stays idempotent through the handle", async () => {
    const { root } = await buildRootWithConcreteRepository();
    const handle = root.dependencies().memory.repository;

    const hash = await handle.storePayload("episode:e-b3" as CanonicalRefV0, payload("e-b3", "body"));
    const intent = {
      intent_id: "intent-i-b3" as never,
      parent_revision: "R0" as never,
      records: [{ ref: "episode:e-b3" as CanonicalRefV0, payload_hash: hash }]
    };
    const first = await handle.prepareRevisionForIntent(intent);
    const second = await handle.prepareRevisionForIntent(intent);
    expect(second.repository_revision).toBe(first.repository_revision);
  });

  it("B2.4: same intent + changed fingerprint conflicts through the handle", async () => {
    const { root } = await buildRootWithConcreteRepository();
    const handle = root.dependencies().memory.repository;

    const hash = await handle.storePayload("episode:e-b4" as CanonicalRefV0, payload("e-b4", "body"));
    await handle.prepareRevisionForIntent({
      intent_id: "intent-i-b4" as never,
      parent_revision: "R0" as never,
      records: [{ ref: "episode:e-b4" as CanonicalRefV0, payload_hash: hash }]
    });

    const otherHash = await handle.storePayload(
      "episode:e-b4-other" as CanonicalRefV0,
      payload("e-b4-other", "different")
    );
    await expect(
      handle.prepareRevisionForIntent({
        intent_id: "intent-i-b4" as never,
        parent_revision: "R0" as never,
        records: [{ ref: "episode:e-b4-other" as CanonicalRefV0, payload_hash: otherHash }]
      })
    ).rejects.toThrow(/MEMORY_PREPARE_CONFLICT/);
  });
});
