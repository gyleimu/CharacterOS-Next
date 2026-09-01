/**
 * P2.2.5 — Memory ↔ Subject-Core conformance integration (pure; in-process only).
 *
 * Wires the REAL memory adapters (InMemoryMemoryRepository, InMemoryRetrievalService)
 * against subject-core's PUBLIC contracts through the installed workspace link:
 * - §11 repository binding-set rules satisfied by memory-produced bindings
 * - manifest conformance + deterministic revision hashes (incl. R0 golden parity)
 * - retrieval results conforming to the frozen contract with fingerprint recomputation
 * - LEGAL EMPTY RETRIEVAL semantics
 * - evidence alignment enforcement
 * - deterministic replay across isolated stacks
 * - invalid-reference rejection mapped to INVALID_MEMORY_REFERENCE semantics
 * - restore-pipeline interop: the repository acts as subject-core's verdict-only
 *   ReferenceValidator capability inside createPersistenceEnvelope/restoreFromEnvelope
 *
 * NO database/filesystem, NO embedding/vector-db, NO ranking/search algorithm, NO LLM,
 * NO consolidation/auto-encoding, NO MICL workflow, NO runtime involvement.
 */

import { describe, expect, it } from "vitest";

// subject-core public root — consumed ONLY here in tests; production code direction
// remains subject-core ← nothing from memory.
import {
  canonicalJsonString,
  createPersistenceEnvelope,
  restoreFromEnvelope,
  validateRepositoryBindingSet,
  type RepositoryRevisionBindingV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";

import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  prepareRevisionManifest,
  validateRepositoryManifest,
  retrievalQueryFingerprint,
  validateMemoryRetrievalQuery,
  validateMemoryRetrievalResult,
  type MemoryRetrievalQueryV0,
  type RetrievalRehearsalV0
} from "./index.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

function record(ref: string, seed: string): { ref: string; payload_hash: string } {
  const suffix = seed.slice(0, 4).padStart(4, "0");
  return { ref, payload_hash: `sha256:${"a".repeat(60)}${suffix}` };
}

function binding(id: string, hash: string): RepositoryRevisionBindingV1 {
  return { repository_revision: id, repository_revision_hash: hash } as unknown as RepositoryRevisionBindingV1;
}

function rid(id: string): Parameters<InMemoryMemoryRepository["readManifest"]>[0] {
  return id as never;
}

/** Minimal S0-shaped snapshot whose memory_state points at a chosen revision id. */
function snapshotReferencing(revisionId: string): SubjectStateV0 {
  return JSON.parse(
    JSON.stringify({
      schema_version: "subject-state-v3",
      identity: {
        subject_id: "subject-s0",
        display_name: "",
        origin_metadata: { creation_source: null, seed_version: null },
        identity_anchors: [],
        self_schema_seed_refs: []
      },
      traits_seed: { dimensions: {} },
      personality: { schema_version: "personality-state-v0", dimensions: [] },
      memory_state: {
        working_refs: ["episode:e-1", "episode:e-2"],
        active_episode_refs: [],
        autobiographical_index_revision: null,
        repository_revision: revisionId,
        consolidation_cursor: null,
        retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
        recent_retrieval_trace: [],
        lifecycle_metadata: {},
        pending_encoding_refs: [],
        last_retrieval_at: null
      },
      beliefs: { schema_version: "belief-state-v0", items: [] },
      relationships: { schema_version: "relationship-state-v0", counterparts: [] },
      mood: { baseline: 0, generated_under_profile: null, last_update: null },
      affect: { active_channels: [], generated_under_profile: null, updated_at: null },
      regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
      context: {
        scene: "idle",
        task: null,
        focus_refs: [],
        active_entity_refs: [],
        environment_refs: [],
        current_observation_ref: null
      },
      mechanism_config: {
        affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
        legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
        feature_flags: {},
        thresholds: {}
      },
      trace_window: {
        trace_window_schema_version: "trace-window-v1",
        capacity: 64,
        cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
        entries: []
      },
      runtime_metadata: {
        subject_version: "subject-v0",
        state_revision: 0,
        logical_time: 0,
        last_transition_time: null,
        last_transition_type: null,
        created_at: 0,
        updated_at: 0
      }
    })
  ) as SubjectStateV0;
}

async function seededRepo(): Promise<InMemoryMemoryRepository> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] }); // R0 genesis
  await repo.prepareRevision({
    parent_revision: rid("R0"),
    records: [record("episode:e-1", "11"), record("episode:e-2", "22")] as never
  });
  return repo;
}

function queryFor(revisionId: string, anchor: string | null): MemoryRetrievalQueryV0 {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: "subject-s0" as never,
    repository_revision: revisionId as never,
    semantic_reference: (anchor ?? null) as never,
    temporal: { now_logical_time: 90 as never, window_start: 10 as never },
    entity_refs: ["entity:n1"] as never,
    relationship_refs: [] as never,
    current_context_refs: ["environment:room-9"] as never,
    salience_constraints: { min_declared_score: null, max_candidates: 16 }
  };
}

function rehearsals(): RetrievalRehearsalV0[] {
  return [
    {
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
        { episode_ref: "episode:e-2", reasons: [{ dimension: "SALIENCE", score: 0.9 }] }
      ] as never,
      candidate_count: 7,
      retrieval_trace_ref: "retrieval-trace:rt-42" as never
    }
  ];
}

describe("repository revision binding conformance", () => {
  it("produces an R0 genesis whose hash equals the §9.3 golden vector", async () => {
    const repo = await seededRepo();
    const manifest = await repo.readManifest(rid("R0"));
    if (manifest === null) throw new Error("R0 missing");
    expect(validateRepositoryManifest(manifest).ok).toBe(true);
    await expect(computeRepositoryRevisionHash(manifest)).resolves.toBe(HASH_V1_R0_REPOSITORY);
    await expect(repo.validateRevisionBinding(binding("R0", HASH_V1_R0_REPOSITORY))).resolves.toBe(true);
  });

  it("memory-produced bindings satisfy subject-core §11 binding-set rules", async () => {
    const repo = await seededRepo();
    const manifest = await repo.readManifest(rid("R1"));
    if (manifest === null) throw new Error("R1 missing");
    const hash = await computeRepositoryRevisionHash(manifest);
    const snapshot = snapshotReferencing("R1");
    // Snapshot references R1 and its working refs belong to it per the repository.
    await expect(repo.validateRefsBelong(rid("R1"), snapshot.memory_state.working_refs)).resolves.toBe(true);
    expect(validateRepositoryBindingSet(snapshot, [binding("R1", hash)]).ok).toBe(true);

    // A foreign revision id violates subject-core's set rules.
    expect(validateRepositoryBindingSet(snapshot, [binding("R999", hash)]).ok).toBe(false);
  });
});

describe("manifest validation and determinism", () => {
  it("validates derived manifests and hashes them deterministically across repos", async () => {
    const a = await seededRepo();
    const b = await seededRepo();
    const ma = await a.readManifest(rid("R1"));
    if (ma === null) throw new Error("R1 missing in repo A");
    const mb = await b.readManifest(rid("R1"));
    if (mb === null) throw new Error("R1 missing in repo B");
    expect(ma).toEqual(mb);
    expect(canonicalJsonString(ma)).toBe(canonicalJsonString(mb));
    expect(await computeRepositoryRevisionHash(ma)).toBe(await computeRepositoryRevisionHash(mb));
    const prepared = prepareRevisionManifest("RX" as never, {
      parent_revision: null,
      records: [record("experience:x-9", "99")] as never
    });
    if (!prepared.ok) throw new Error(prepared.error.detail);
    expect(validateRepositoryManifest(prepared.value.manifest).ok).toBe(true);
  });
});

describe("retrieval contract compliance", () => {
  it("emits conforming aligned evidence with recomputable fingerprints", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: rehearsals() });
    const q = queryFor("R1", "observation:o-77");
    const queryChecked = validateMemoryRetrievalQuery(q);
    expect(queryChecked.ok).toBe(true);
    const result = await service.retrieve(q);
    const checked = await validateMemoryRetrievalResult(result, q);
    expect(checked.ok).toBe(true);
    // Fingerprint embedded == independent recomputation over the same query.
    await expect(retrievalQueryFingerprint(q)).resolves.toBe(
      result.deterministic_metadata.query_fingerprint
    );
    // Evidence order-aligned one-to-one with selections.
    expect(result.evidence.map((entry) => entry.episode_ref)).toEqual(result.selected_memory_refs);
  });

  it("returns LEGAL EMPTY RETRIEVAL for unmatched anchors on a known revision", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: rehearsals() });
    const empty = await service.retrieve(queryFor("R1", "observation:o-none"));
    expect(empty.selected_memory_refs).toEqual([]);
    expect(empty.evidence).toEqual([]);
    expect(empty.deterministic_metadata.candidate_count).toBe(0);
    const checked = await validateMemoryRetrievalResult(empty, queryFor("R1", "observation:o-none"));
    expect(checked.ok).toBe(true);
  });

  it("rejects queries against revisions unknown to the adapter", async () => {
    const service = new InMemoryRetrievalService({ rehearsals: rehearsals() });
    await expect(service.retrieve(queryFor("R777", "observation:o-77"))).rejects.toThrow(
      /INVALID_MEMORY_REVISION/
    );
  });

  it("replays deterministically across isolated stacks", async () => {
    const run = async () => {
      const service = new InMemoryRetrievalService({ rehearsals: rehearsals() });
      return service.retrieve(queryFor("R1", "observation:o-77"));
    };
    const a = await run();
    const b = await run();
    expect(canonicalJsonString(a)).toBe(canonicalJsonString(b));
  });
});

describe("invalid reference rejection and restore interop", () => {
  it("maps missing references to a false membership verdict", async () => {
    const repo = await seededRepo();
    await expect(repo.validateRefsBelong(rid("R1"), ["episode:ghost" as never])).resolves.toBe(false);
  });

  it("interop with subject-core restore via the verdict-only capability", async () => {
    const repo = await seededRepo();
    const r1Manifest = await repo.readManifest(rid("R1"));
    if (r1Manifest === null) throw new Error("R1 missing");
    const hash = await computeRepositoryRevisionHash(r1Manifest);
    const snapshot = snapshotReferencing("R1");
    const bindings = [binding("R1", hash)];

    // Creation accepts memory-produced bindings.
    const created = await createPersistenceEnvelope({
      snapshot,
      repository_bindings: bindings
    });
    if (!created.ok) throw new Error(created.error.detail);

    // Restore consults the repository as its ReferenceValidator capability.
    const restored = await restoreFromEnvelope(JSON.parse(JSON.stringify(created.value)), {
      referenceValidator: async (candidate) => repo.validateRevisionBinding(candidate)
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.snapshot.memory_state.repository_revision).toBe("R1");
      expect(Object.isFrozen(restored.snapshot)).toBe(true);
    }

    // Corrupting the stored hash fails closed with INVALID_MEMORY_REFERENCE semantics
    // mapped through the capability verdict (§11 step 5/6 → MEM-REV-001 family).
    const corruptedRepo = new InMemoryMemoryRepository();
    await corruptedRepo.prepareRevision({ parent_revision: null, records: [] });
    await corruptedRepo.prepareRevision({
      parent_revision: rid("R0"),
      records: [record("episode:e-1", "ff")] as never
    });
    const denied = await restoreFromEnvelope(JSON.parse(JSON.stringify(created.value)), {
      referenceValidator: async (candidate) =>
        (await corruptedRepo.validateRevisionBinding(candidate)) &&
        (await corruptedRepo.validateRefsBelong(
          candidate.repository_revision,
          snapshot.memory_state.working_refs
        ))
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(["INVALID_MEMORY_REVISION", "INVALID_MEMORY_REFERENCE"]).toContain(
        denied.failure.error_code
      );
    }
  });
});
