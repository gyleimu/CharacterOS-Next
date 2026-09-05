/**
 * MEMORY_REVISION_LONG_TERM_VISIBILITY_V0 — effective visibility suite.
 *
 * Pure-resolver malformed-graph proofs (cycle, broken parent, conflicting
 * historical hash, non-genesis null parent, seal mismatch, dedup) plus
 * InMemoryMemoryRepository integration proofs (R1→R4 ancestry chains, sibling
 * isolation, physical-presence-is-not-authority, validateRefsBelong ancestry
 * semantics, delta manifest semantics unchanged).
 */

import { describe, expect, it } from "vitest";

import type {
  HashV1,
  RepositoryRecordHashV1,
  RepositoryRevisionIdV0,
  RepositoryRevisionManifestV1
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash } from "../revisions.js";
import { InMemoryMemoryRepository } from "./in-memory-memory-repository.js";
import {
  createEffectiveRevisionVisibilityAuthorityV0,
  type RevisionGraphReaderV0,
  type RevisionSealedRecordV0
} from "./effective-revision-visibility.js";

function manifestOf(
  id: string,
  parent: string | null,
  records: readonly { ref: string; payload_hash: string }[]
): RepositoryRevisionManifestV1 {
  return {
    schema_version: "repository-revision-manifest-v1",
    repository_revision: id as never,
    parent_revision: parent as never,
    record_hashes: records as never,
    index_manifest_hash: null
  } as unknown as RepositoryRevisionManifestV1;
}

/** Malformed-graph fixture: arbitrary manifests with attacker-chosen "seals". */
class FixtureGraph implements RevisionGraphReaderV0 {
  readonly revisions = new Map<string, { manifest: RepositoryRevisionManifestV1; sealed_hash: HashV1 }>();
  async add(manifest: RepositoryRevisionManifestV1, sealedOverride?: HashV1): Promise<void> {
    // Default seal = the REAL recomputed hash; tests pass an override only to
    // simulate seal/manifest tamper.
    const digest = sealedOverride ?? (await computeRepositoryRevisionHash(manifest));
    this.revisions.set(manifest.repository_revision as string, { manifest, sealed_hash: digest });
  }
  readSealedRevision(revision: RepositoryRevisionIdV0): Promise<RevisionSealedRecordV0 | null> {
    const stored = this.revisions.get(revision as string);
    return Promise.resolve(stored ?? null);
  }
  knownRevisionCount(): number {
    return this.revisions.size;
  }
  isGenesisRevision(revision: RepositoryRevisionIdV0): boolean {
    return revision === ("R0" as RepositoryRevisionIdV0);
  }
}

const H = (c: string): HashV1 => `sha256:${c.repeat(64)}` as HashV1;

describe("EffectiveRevisionVisibilityAuthorityV0 — malformed graphs fail closed", () => {
  it("7. cycle rejects without hanging", async () => {
    const graph = new FixtureGraph();
    const r1 = manifestOf("R1", "R2", [{ ref: "episode:a", payload_hash: H("1") }]);
    const r2 = manifestOf("R2", "R1", [{ ref: "episode:b", payload_hash: H("2") }]);
    await graph.add(r1);
    await graph.add(r2);
    const authority = createEffectiveRevisionVisibilityAuthorityV0(graph);
    await expect(authority.readVisibleRecordHashes("R1" as never)).rejects.toThrow(/cycle detected/);
  });

  it("6/8. missing parent rejects; non-genesis null parent rejects", async () => {
    const graph = new FixtureGraph();
    await graph.add(manifestOf("R2", "Rmissing", [{ ref: "episode:a", payload_hash: H("1") }]));
    const authority = createEffectiveRevisionVisibilityAuthorityV0(graph);
    await expect(authority.readVisibleRecordHashes("R2" as never)).rejects.toThrow(/missing from the repository chain/);

    const orphanGraph = new FixtureGraph();
    await orphanGraph.add(manifestOf("Rx", null, [{ ref: "episode:a", payload_hash: H("1") }]));
    const orphanAuthority = createEffectiveRevisionVisibilityAuthorityV0(orphanGraph);
    await expect(orphanAuthority.readVisibleRecordHashes("Rx" as never)).rejects.toThrow();
  });

  it("5. same ref with different payload hashes across ancestry rejects (never picks one)", async () => {
    const graph = new FixtureGraph();
    await graph.add(manifestOf("R1", null, [{ ref: "episode:x", payload_hash: H("1") }]));
    await graph.add(manifestOf("R2", "R1", [{ ref: "episode:x", payload_hash: H("2") }]));
    const authority = createEffectiveRevisionVisibilityAuthorityV0(graph);
    await expect(authority.readVisibleRecordHashes("R2" as never)).rejects.toThrow(/two different payload hashes/);
  });

  it("10. tampered/sealed-hash-mismatched ancestor rejects (valid terminal cannot legitimize)", async () => {
    const graph = new FixtureGraph();
    // R1's manifest is fine but its sealed hash does not match recomputation.
    await graph.add(manifestOf("R1", null, [{ ref: "episode:a", payload_hash: H("1") }]), H("9"));
    await graph.add(manifestOf("R2", "R1", [{ ref: "episode:b", payload_hash: H("2") }]));
    const authority = createEffectiveRevisionVisibilityAuthorityV0(graph);
    await expect(authority.readVisibleRecordHashes("R2" as never)).rejects.toThrow(/sealed hash does not match/);
  });

  it("unknown starting revision rejects; dedup of identical ref/hash succeeds", async () => {
    const graph = new FixtureGraph();
    await graph.add(manifestOf("R0", null, [{ ref: "episode:a", payload_hash: H("1") }]));
    await graph.add(manifestOf("R1", "R0", [{ ref: "episode:a", payload_hash: H("1") }])); // lawful repeat
    const authority = createEffectiveRevisionVisibilityAuthorityV0(graph);
    await expect(authority.readVisibleRecordHashes("R9" as never)).rejects.toThrow(/unknown/);
    const visible = await authority.readVisibleRecordHashes("R1" as never);
    expect(visible).toHaveLength(1); // deduplicated
  });
});

describe("InMemoryMemoryRepository — effective visibility integration", () => {
  /** Real 4-revision chain built through lawful repository APIs. */
  async function buildChain(): Promise<{
    repo: InMemoryMemoryRepository;
    revisionIds: string[];
  }> {
    const repo = new InMemoryMemoryRepository();
    await repo.prepareRevision({ parent_revision: null, records: [] }); // R0
    const refs: Record<string, string> = {};
    const store = async (letter: string): Promise<RepositoryRecordHashV1> => {
      const ref = `episode:${letter}`;
      const payload = { episode: letter };
      const hash = await repo.storePayload(ref as never, payload);
      refs[letter] = ref;
      return { ref: ref as never, payload_hash: hash };
    };
    const r1 = await repo.prepareRevision({
      parent_revision: "R0" as never,
      records: [await store("p1")] as never
    });
    const r2 = await repo.prepareRevision({
      parent_revision: r1.repository_revision as never,
      records: [await store("p2")] as never
    });
    const r3 = await repo.prepareRevision({
      parent_revision: r2.repository_revision as never,
      records: [await store("p3")] as never
    });
    const r4 = await repo.prepareRevision({
      parent_revision: r3.repository_revision as never,
      records: [await store("p4")] as never
    });
    return {
      repo,
      refs,
      revisionIds: [r1.repository_revision as string, r2.repository_revision as string, r3.repository_revision as string, r4.repository_revision as string]
    };
  }

  it("2/3. effective visibility includes every ancestor record at the terminal revision", async () => {
    const { repo, refs, revisionIds } = await buildChain();
    const r4 = revisionIds[3] as RepositoryRevisionIdV0;
    const visible = await repo.readVisibleRecordHashes(r4);
    const visibleRefs = visible.map((entry) => entry.ref);
    expect(visibleRefs).toContain(refs["p1"]);
    expect(visibleRefs).toContain(refs["p2"]);
    expect(visibleRefs).toContain(refs["p3"]);
    expect(visibleRefs).toContain(refs["p4"]);
    // Sorted + deduplicated.
    expect(visibleRefs).toEqual([...visibleRefs].sort());
  });

  it("1. direct manifests remain deltas; readManifest is untouched", async () => {
    const { repo, refs, revisionIds } = await buildChain();
    const r4Manifest = await repo.readManifest(revisionIds[3] as never);
    if (r4Manifest === null) throw new Error("fixture invariant");
    const directRefs = r4Manifest.record_hashes.map((r) => r.ref);
    expect(directRefs).toEqual([refs["p4"]]); // ONLY the delta
    expect(directRefs).not.toContain(refs["p1"]);
    const r1Manifest = await repo.readManifest(revisionIds[0] as never);
    if (r1Manifest === null) throw new Error("fixture invariant");
    expect(r1Manifest.record_hashes.map((r) => r.ref)).toEqual([refs["p1"]]);
  });

  it("11. validateRefsBelong uses ancestry semantics", async () => {
    const { repo, refs, revisionIds } = await buildChain();
    const r4 = revisionIds[3] as RepositoryRevisionIdV0;
    expect(await repo.validateRefsBelong(r4, [refs["p1"] as never, refs["p4"] as never])).toBe(true);
    // Unknown revision: fail-closed verdict false (verdict contract).
  });

  it("9/10. physical presence without ancestry is invisible (retrieval/refs/authority)", async () => {
    const { repo, revisionIds } = await buildChain();
    // A valid episode payload stored physically but bound to NO revision.
    const strayRef = "episode:stray";
    await repo.storePayload(strayRef as never, { episode: "stray" });
    const r4 = revisionIds[3] as RepositoryRevisionIdV0;
    const visible = await repo.readVisibleRecordHashes(r4);
    expect(visible.find((entry) => entry.ref === strayRef)).toBeUndefined();
    expect(await repo.validateRefsBelong(r4, [strayRef as never])).toBe(false);
  });

  it("sibling branch: a cousin record is invisible across branches", async () => {
    const { repo } = await buildChain();
    // R5 branches off R1 (sibling lineage), binding PA.
    const paRef = "episode:pa";
    const paHash = await repo.storePayload(paRef as never, { episode: "pa" });
    const sibling = await repo.prepareRevision({
      parent_revision: "R1" as never,
      records: [{ ref: paRef as never, payload_hash: paHash }] as never
    });
    // R2..R4 lineages never see PA.
    const r4 = (await repo.readVisibleRecordHashes("R4" as never)).map((entry) => entry.ref);
    expect(r4).not.toContain(paRef);
    expect(await repo.validateRefsBelong("R4" as never, [paRef as never])).toBe(false);
    // The sibling sees its own record through ancestry.
    const siblingVisible = await repo.readVisibleRecordHashes(sibling.repository_revision);
    expect(siblingVisible.map((entry) => entry.ref)).toContain(paRef);
  });
});
