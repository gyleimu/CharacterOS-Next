/**
 * P2.2.1 — memory contract conformance tests (pure).
 * Proves: R0 golden-vector hash parity (freeze §9.3), manifest closed-schema rules,
 * kind-scoped reference guards, EpisodicMemoryRecordV0 draft acceptance/rejection
 * matrix, and MemoryRepository interface satisfiability. No storage, no retrieval.
 */

import { describe, expect, it } from "vitest";

import {
  computeRepositoryRevisionHash,
  isMemoryBoundRefKind,
  parseAppraisalRef,
  parseEpisodeRef,
  parseMemoryBoundRef,
  prepareRevisionManifest,
  validateEpisodicMemoryRecord,
  validateRepositoryManifest,
  type MemoryRepository
} from "./index.js";
import type {
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1,
  RepositoryRecordHashV1
} from "@characteros-next/subject-core";

const GOLDEN_R0_HASH = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

const R0_MANIFEST: RepositoryRevisionManifestV1 = {
  schema_version: "repository-revision-manifest-v1",
  repository_revision: "R0",
  parent_revision: null,
  record_hashes: [],
  index_manifest_hash: null
} as unknown as RepositoryRevisionManifestV1;

function episodicRecord(): Record<string, unknown> {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: "episode:e-0001",
    occurrence_logical_time: 12,
    recorded_at_logical_time: 15,
    provenance: {
      transition_id: "t-0007",
      producer: "memory",
      cause_refs: ["observation:o-0009"]
    },
    references: ["entity:n-x", "event:e-v2"],
    context: {
      scene: "lab",
      focus_refs: ["entity:n-x"],
      environment_refs: ["environment:room-1"]
    },
    appraisal_ref: "appraisal:ap-3",
    affect_snapshot_ref: "snapshot:snap-7",
    salience: { declared_score: 0.42, source: "ENCODING_DECLARED_V0" }
  };
}

describe("repository revision manifest", () => {
  it("accepts the genesis R0 manifest and reproduces the §9.3 golden hash", async () => {
    const checked = validateRepositoryManifest(R0_MANIFEST);
    expect(checked.ok).toBe(true);
    await expect(computeRepositoryRevisionHash(R0_MANIFEST)).resolves.toBe(GOLDEN_R0_HASH);
  });

  it("rejects unknown keys, wrong kinds, duplicates and unsorted records", () => {
    const extra = { ...R0_MANIFEST, payload: {} };
    expect(validateRepositoryManifest(extra).ok).toBe(false);

    const badKind = {
      ...R0_MANIFEST,
      record_hashes: [{ ref: "appraisal:a1", payload_hash: `sha256:${"a".repeat(64)}` }]
    };
    expect(validateRepositoryManifest(badKind).ok).toBe(false);

    const dup = {
      ...R0_MANIFEST,
      record_hashes: [
        { ref: "episode:b", payload_hash: `sha256:${"a".repeat(64)}` },
        { ref: "episode:b", payload_hash: `sha256:${"b".repeat(64)}` }
      ]
    };
    expect(validateRepositoryManifest(dup).ok).toBe(false);

    const unsorted = {
      ...R0_MANIFEST,
      record_hashes: [
        { ref: "episode:c", payload_hash: `sha256:${"a".repeat(64)}` },
        { ref: "episode:b", payload_hash: `sha256:${"b".repeat(64)}` }
      ]
    };
    expect(validateRepositoryManifest(unsorted).ok).toBe(false);
  });

  it("prepareRevisionManifest freezes the manifest and hashes deterministically", async () => {
    const prepared = prepareRevisionManifest("R1" as unknown as RepositoryRevisionIdV0, {
      parent_revision: "R0" as unknown as RepositoryRevisionIdV0,
      records: [
        { ref: "episode:a", payload_hash: `sha256:${"1".repeat(64)}` } as unknown as RepositoryRecordHashV1,
        { ref: "memory:b", payload_hash: `sha256:${"2".repeat(64)}` } as unknown as RepositoryRecordHashV1
      ]
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(Object.isFrozen(prepared.value.manifest)).toBe(true);
    const h1 = await computeRepositoryRevisionHash(prepared.value.manifest);
    const h2 = await computeRepositoryRevisionHash(prepared.value.manifest);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(GOLDEN_R0_HASH);
  });
});

describe("memory reference guards", () => {
  it("accepts the four memory-bound kinds and rejects others", () => {
    for (const [kind, ref] of [
      ["memory", "memory:m1"],
      ["episode", "episode:e1"],
      ["event", "event:v1"],
      ["experience", "experience:x1"]
    ] as const) {
      expect(isMemoryBoundRefKind(kind)).toBe(true);
      const parsed = parseMemoryBoundRef(ref, "t");
      expect(parsed.ok).toBe(true);
    }
    expect(isMemoryBoundRefKind("appraisal")).toBe(false);
    const appraisalAsBound = parseMemoryBoundRef("appraisal:a1", "t");
    expect(appraisalAsBound.ok).toBe(false);
  });

  it("kind-specific guards reject foreign kinds", () => {
    expect(parseEpisodeRef("memory:m1", "t").ok).toBe(false);
    expect(parseEpisodeRef("episode:e1", "t").ok).toBe(true);
    expect(parseAppraisalRef("episode:e1", "t").ok).toBe(false);
    expect(parseAppraisalRef("appraisal:ap9", "t").ok).toBe(true);
  });
});

describe("EpisodicMemoryRecordV0 draft schema", () => {
  it("accepts a fully populated record and narrows branded fields", () => {
    const r = validateEpisodicMemoryRecord(episodicRecord());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.provenance.producer).toBe("memory");
    expect(r.value.occurrence_logical_time).toBe(12);
    expect(r.value.appraisal_ref).toBe("appraisal:ap-3");
    expect(r.value.affect_snapshot_ref).toBe("snapshot:snap-7");
    expect(r.value.salience.declared_score).toBe(0.42);
  });

  it("supports null appraisal/affect pointers", () => {
    const bare = episodicRecord();
    bare["appraisal_ref"] = null;
    bare["affect_snapshot_ref"] = null;
    expect(validateEpisodicMemoryRecord(bare).ok).toBe(true);
  });

  it("rejects out-of-domain occurrence and inverted encoding order", () => {
    const negativeOccurrence = episodicRecord();
    negativeOccurrence["occurrence_logical_time"] = -1;
    let r = validateEpisodicMemoryRecord(negativeOccurrence);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_SCHEMA");

    const inverted = episodicRecord();
    inverted["recorded_at_logical_time"] = 11;
    r = validateEpisodicMemoryRecord(inverted);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVARIANT_VIOLATION");
  });

  it("rejects salience scores outside [0,1] (declared metadata only)", () => {
    const high = episodicRecord();
    (high["salience"] as Record<string, unknown>)["declared_score"] = 1.5;
    const r = validateEpisodicMemoryRecord(high);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_VALUE_RANGE");
  });

  it("rejects duplicate/unsorted sets and foreign producer identity", () => {
    const dupCause = episodicRecord();
    (dupCause["provenance"] as Record<string, unknown>)["cause_refs"] = [
      "observation:o9",
      "observation:o9"
    ];
    expect(validateEpisodicMemoryRecord(dupCause).ok).toBe(false);

    const unsortedRefs = episodicRecord();
    unsortedRefs["references"] = ["event:e-v2", "entity:n-x"];
    expect(validateEpisodicMemoryRecord(unsortedRefs).ok).toBe(false);

    const foreignProducer = episodicRecord();
    (foreignProducer["provenance"] as Record<string, unknown>)["producer"] = "llm";
    const r = validateEpisodicMemoryRecord(foreignProducer);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("UNAUTHORIZED_PRODUCER");
  });

  it("enforces ref kinds for appraisal/affect-snapshot pointers", () => {
    const wrongAppraisal = episodicRecord();
    wrongAppraisal["appraisal_ref"] = "episode:not-appraisal";
    expect(validateEpisodicMemoryRecord(wrongAppraisal).ok).toBe(false);

    const wrongSnapshot = episodicRecord();
    wrongSnapshot["affect_snapshot_ref"] = "mood:angry";
    expect(validateEpisodicMemoryRecord(wrongSnapshot).ok).toBe(false);
  });

  it("enforces canonical NFC nonempty context scenes and closed objects", () => {
    const emptyScene = episodicRecord();
    (emptyScene["context"] as Record<string, unknown>)["scene"] = "";
    const empty = validateEpisodicMemoryRecord(emptyScene);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.error_code).toBe("INVALID_VALUE_RANGE");

    const decomposed = episodicRecord();
    (decomposed["context"] as Record<string, unknown>)["scene"] = "\u006c\u0061\u0301\u0062";
    expect(validateEpisodicMemoryRecord(decomposed).ok).toBe(false);

    const extraKey = episodicRecord();
    extraKey["retrieval_hint"] = "sneaky";
    expect(validateEpisodicMemoryRecord(extraKey).ok).toBe(false);
  });
});

describe("MemoryRepository contract shape", () => {
  it("is satisfiable by an infrastructure adapter without any storage engine", async () => {
    const manifests = new Map<string, RepositoryRevisionManifestV1>();
    const repo: MemoryRepository = {
      async prepareRevision(request) {
        const id = (request.parent_revision === null ? "R0" : "R1") as unknown as RepositoryRevisionIdV0;
        const prepared = prepareRevisionManifest(id, request);
        if (!prepared.ok) throw new Error(prepared.error.detail);
        manifests.set(id, prepared.value.manifest);
        return prepared.value;
      },
      async readManifest(revision) {
        return manifests.get(revision) ?? null;
      },
      async storePayload() {
        throw new Error("contract shape stub has no storage engine");
      },
      async payloadHashOf() {
        return null;
      },
      async prepareRevisionForIntent() {
        throw new Error("contract shape stub has no storage engine");
      },
      async validateRevisionBinding() {
        return true;
      },
      async validateRefsBelong() {
        return true;
      }
    };
    const prepared = await repo.prepareRevision({ parent_revision: null, records: [] });
    expect(await repo.readManifest(prepared.repository_revision)).toBe(prepared.manifest);
    expect(await repo.validateRefsBelong(prepared.repository_revision, [])).toBe(true);
  });
});
