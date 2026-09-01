/**
 * Tests for Belief Semantic Candidate / Target Resolution V0.
 * All providers here are TEST-LOCAL deterministic fakes —none are exported
 * from production. Covers catalog, evidence, decisions, forbidden authority,
 * labels, bindings, capability, provider execution, and zero canonical effect.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { SubjectStateV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  validateBeliefMutationProposal
} from "./belief-mutation-proposal.js";
import {
  BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS,
  BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES,
  BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION,
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  isAuthorizedBeliefSemanticTargetResolutionV0,
  runBeliefSemanticTargetResolutionV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";

const ALICE = "entity:alice";

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string) {
  return raw as never;
}
const EP_A = "episode:e-0001";
const EP_B = "episode:e-0002";
const PROPOSITION_ID_A = "belief-aaa";
const PROPOSITION_ID_B = "belief-bbb";
const PROPOSITION_LABEL_A = "Alice can be relied on for joint plans";
const PROPOSITION_LABEL_B = "Bob prefers written summaries";

/** TEST-LOCAL deterministic episode record fixture (no production export). */
function recordFixture(
  episodeRef: string,
  scene: string,
  occurrenceLogicalTime = 1
): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time:
      occurrenceLogicalTime as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time:
      (occurrenceLogicalTime + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${episodeRef.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE] as unknown as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

/** TEST-LOCAL canonical snapshot with registered propositions + bound revision. */
async function fixtureWorld(): Promise<{
  repository: InMemoryMemoryRepository;
  records: EpisodicMemoryRecordV0[];
  state: SubjectStateV0;
}> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] as never });
  const records = [
    recordFixture(EP_A, "Alice kept the plan we made and arrived early.", 1),
    recordFixture(EP_B, "Bob sent the written summary before the meeting.", 2)
  ];
  const sorted = [...records].sort((a, b) =>
    a.episode_ref < b.episode_ref ? -1 : a.episode_ref > b.episode_ref ? 1 : 0
  );
  const hashes = [];
  for (const record of sorted) {
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
  }
  const prepared = await repository.prepareRevision({
    parent_revision: "R0" as never,
    records: hashes as never
  });
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: prepared.repository_revision },
    beliefs: {
      schema_version: "belief-state-v0",
      items: [
        { proposition_id: PROPOSITION_ID_A, proposition_label: PROPOSITION_LABEL_A, credence: 0.5 },
        { proposition_id: PROPOSITION_ID_B, proposition_label: PROPOSITION_LABEL_B, credence: 0.2 }
      ]
    },
    runtime_metadata: { ...base.runtime_metadata, logical_time: 10, state_revision: 4 }
  };
  return { repository, records, state: state as SubjectStateV0 };
}

/** TEST-LOCAL echo provider: echoes host fingerprints; override merges fields. */
function echoProvider(
  overrides: Record<string, unknown>,
  captured: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = {
    input: null,
    calls: 0
  }
): BeliefSemanticTargetResolutionProviderV0 {
  return {
    async propose(input) {
      captured.calls += 1;
      captured.input = input;
      return {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        candidate_catalog_fingerprint: input.candidate_catalog_fingerprint,
        ...overrides
      };
    }
  };
}

function throwingProvider(): BeliefSemanticTargetResolutionProviderV0 {
  return {
    async propose() {
      throw new Error("provider exploded");
    }
  };
}

const VALID_LABEL = "Team offsites work better with a written agenda";

describe("Belief Semantic Target Resolution V0", () => {
  it("catalog: empty lawful; nonempty lawful; labels from canonical only; order-independent; credence not exposed", async () => {
    const empty = await fixtureWorld();
    const capturedEmpty: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    const emptyRun = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: empty.repository as unknown as MemoryPreparationAuthority },
      { subjectState: empty.state, proposition_ids: [], selected_episodes: empty.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedEmpty) }
    );
    expect(emptyRun.ok).toBe(true);
    expect(capturedEmpty.input?.catalog.propositions).toEqual([]);

    const world = await fixtureWorld();
    const captured: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    const run = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      {
        subjectState: world.state,
        proposition_ids: [PROPOSITION_ID_B, PROPOSITION_ID_A] as never,
        selected_episodes: world.records,
        provider: echoProvider({ kind: "NO_BEARING" }, captured)
      }
    );
    expect(run.ok).toBe(true);
    // Input order does NOT affect canonical raw-ASCII catalog order.
    expect(captured.input?.catalog.propositions).toEqual([
      { proposition_id: PROPOSITION_ID_A, proposition_label: PROPOSITION_LABEL_A },
      { proposition_id: PROPOSITION_ID_B, proposition_label: PROPOSITION_LABEL_B }
    ]);
    // Catalog exposes id+label only —NO credence.
    for (const candidate of captured.input?.catalog.propositions ?? []) {
      expect(Object.keys(candidate)).toEqual(["proposition_id", "proposition_label"]);
    }
  });

  it("catalog gates: duplicate/unregistered/over-cap ids reject BEFORE provider call", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const provider = echoProvider({ kind: "NO_BEARING" });
    const dup = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A, PROPOSITION_ID_A] as never, selected_episodes: world.records, provider }
    );
    expect(dup).toMatchObject({ ok: false, code: "INVALID_CANDIDATE_IDS", providerCalls: 0 });
    const unregistered = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: ["belief-zzz"] as never, selected_episodes: world.records, provider }
    );
    expect(unregistered).toMatchObject({ ok: false, code: "UNREGISTERED_PROPOSITION_ID", providerCalls: 0 });
    const overCap = Array.from({ length: BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS + 1 }, (_, i) => `belief-k${i}`);
    const cap = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: overCap as never, selected_episodes: world.records, provider }
    );
    expect(cap).toMatchObject({ ok: false, code: "INVALID_CANDIDATE_IDS", providerCalls: 0 });
  });

  it("catalog fingerprint: deterministic; changes with id or label; credence-only change does NOT change it", async () => {
    const world = await fixtureWorld();
    const capturedA: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedA) }
    );
    const capturedB: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedB) }
    );
    const base = capturedA.input?.candidate_catalog_fingerprint;
    expect(base).toBe(capturedB.input?.candidate_catalog_fingerprint);

    // credence-only change (0.5 -> 0.9) keeps the SAME catalog fingerprint
    const credenceWorld = await fixtureWorld();
    const credenceState = structuredClone(credenceWorld.state);
    (credenceState.beliefs.items[0] as { credence: number }).credence = 0.9;
    const capturedCred: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: credenceWorld.repository as unknown as MemoryPreparationAuthority },
      { subjectState: credenceState, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: credenceWorld.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedCred) }
    );
    expect(capturedCred.input?.candidate_catalog_fingerprint).toBe(base);

    // label change CHANGES the catalog fingerprint
    const labelWorld = await fixtureWorld();
    const labelState = structuredClone(labelWorld.state);
    (labelState.beliefs.items[0] as { proposition_label: string }).proposition_label = "Relabeled proposition";
    const capturedLabel: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: labelWorld.repository as unknown as MemoryPreparationAuthority },
      { subjectState: labelState, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: labelWorld.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedLabel) }
    );
    expect(capturedLabel.input?.candidate_catalog_fingerprint).not.toBe(base);
  });

  it("evidence: valid bound set accepted in full, sorted, deterministic; provider cannot widen", async () => {
    const world = await fixtureWorld();
    const epA = world.records[0];
    const epB = world.records[1];
    if (epA === undefined || epB === undefined) throw new Error("fixture records missing");
    const captured: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    const run = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [], selected_episodes: [epB, epA], provider: echoProvider({ kind: "NO_BEARING" }, captured) }
    );
    expect(run.ok).toBe(true);
    // provider receives the ENTIRE exact validated set, canonical-sorted by episode_ref
    expect(captured.input?.evidence.evidence.map((entry) => entry.episode_ref)).toEqual([EP_A, EP_B]);
    const captured2: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }, captured2) }
    );
    expect(captured2.input?.semantic_context_fingerprint).toBe(captured.input?.semantic_context_fingerprint);
    // resolution evidence binding equals the host-built sorted member set
    if (run.ok) {
      expect(run.resolution.evidence_binding.member_refs).toEqual([EP_A, EP_B]);
    }
  });

  it("evidence gates: empty/over-cap/duplicate/missing/newer-unbound/forged/revision-mismatch reject", async () => {
    const world = await fixtureWorld();
    const recA = world.records[0];
    if (recA === undefined) throw new Error("fixture records missing");
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const provider = echoProvider({ kind: "NO_BEARING" });
    const runArgs = (episodes: readonly EpisodicMemoryRecordV0[]) => ({
      subjectState: world.state,
      proposition_ids: [],
      selected_episodes: episodes,
      provider
    });
    expect(
      await runBeliefSemanticTargetResolutionV0({ memoryRepository: repository }, runArgs([]))
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
    const overCap = Array.from({ length: BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES + 1 }, (_, i) =>
      recordFixture(`episode:cap-${i}`, "overflow")
    );
    expect(
      await runBeliefSemanticTargetResolutionV0({ memoryRepository: repository }, runArgs(overCap))
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
    expect(
      await runBeliefSemanticTargetResolutionV0({ memoryRepository: repository }, runArgs([recA, recA]))
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
    const unbound = recordFixture("episode:e-9999", "not in bound revision", 3);
    expect(
      await runBeliefSemanticTargetResolutionV0({ memoryRepository: repository }, runArgs([unbound]))
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
    // forged payload: content altered after payload hashing →hash mismatch
    const forged = structuredClone(recA);
    (forged.context as { scene: string }).scene = "Tampered scene after hashing";
    expect(
      await runBeliefSemanticTargetResolutionV0({ memoryRepository: repository }, runArgs([forged]))
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
    // revision mismatch: state points at an unknown repository revision
    const staleState = structuredClone(world.state);
    (staleState.memory_state as { repository_revision: string }).repository_revision = "R-MISSING";
    expect(
      await runBeliefSemanticTargetResolutionV0(
        { memoryRepository: repository },
        { subjectState: staleState, proposition_ids: [], selected_episodes: world.records, provider }
      )
    ).toMatchObject({ ok: false, code: "INVALID_EVIDENCE", providerCalls: 0 });
  });

  it("decisions: SUPPORTS, CONTRADICTS, NO_BEARING, and valid NEW candidate accepted with exact bindings", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const args = { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A, PROPOSITION_ID_B] as never, selected_episodes: world.records };
    const supports = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS" }) }
    );
    expect(supports.ok).toBe(true);
    if (supports.ok) {
      expect(supports.resolution.decision).toEqual({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS" });
      expect(supports.resolution.subject_id).toBe(world.state.identity.subject_id);
      expect(supports.resolution.state_revision).toBe(4);
      expect(supports.resolution.repository_revision).toBe(world.state.memory_state.repository_revision);
    }
    const contradicts = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_B, relation: "CONTRADICTS" }) }
    );
    expect(contradicts.ok).toBe(true);
    const noBearing = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "NO_BEARING" }) }
    );
    expect(noBearing.ok).toBe(true);
    if (noBearing.ok) expect(noBearing.resolution.decision).toEqual({ kind: "NO_BEARING" });
    const fresh = await fixtureWorld();
    const newCandidate = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: fresh.repository as unknown as MemoryPreparationAuthority },
      { subjectState: fresh.state, proposition_ids: [], selected_episodes: fresh.records, provider: echoProvider({ kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: VALID_LABEL }) }
    );
    expect(newCandidate.ok).toBe(true);
    if (newCandidate.ok) {
      expect(newCandidate.resolution.decision).toEqual({ kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: VALID_LABEL });
      // accepted resolution is deeply frozen
      expect(Object.isFrozen(newCandidate.resolution)).toBe(true);
      expect(Object.isFrozen(newCandidate.resolution.decision)).toBe(true);
      expect(Object.isFrozen(newCandidate.resolution.evidence_binding)).toBe(true);
    }
  });

  it("decisions gates: invented/out-of-catalog/empty-catalog ids, unknown relation/kind, extra fields, conflicting shape reject (no repair)", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const args = { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: world.records };
    const invented = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: "belief-invented", relation: "SUPPORTS" }) }
    );
    expect(invented).toMatchObject({ ok: false, code: "INVENTED_PROPOSITION_ID", providerCalls: 1 });
    const emptyCatalog = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS" }) }
    );
    expect(emptyCatalog).toMatchObject({ ok: false, code: "INVENTED_PROPOSITION_ID", providerCalls: 1 });
    const unknownRelation = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "WEAKLY_SUPPORTS" }) }
    );
    expect(unknownRelation).toMatchObject({ ok: false, code: "INVALID_PROVIDER_OUTPUT", providerCalls: 1 });
    const unknownKind = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "EVERYTHING_OK" }) }
    );
    expect(unknownKind).toMatchObject({ ok: false, code: "INVALID_PROVIDER_OUTPUT", providerCalls: 1 });
    // numeric authority attempts (credence/next_credence/initial_credence/confidence) = extra keys →reject
    for (const extra of ["credence", "next_credence", "initial_credence", "confidence"]) {
      const attempt = await runBeliefSemanticTargetResolutionV0(
        { memoryRepository: repository },
        { ...args, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS", [extra]: 0.9 }) }
      );
      expect(attempt).toMatchObject({ ok: false, code: "INVALID_PROVIDER_OUTPUT", providerCalls: 1 });
    }
    // identity authority attempts in NEW output →extra keys →reject
    for (const extra of ["proposition_key", "proposition_id", "proposition_identity"]) {
      const attempt = await runBeliefSemanticTargetResolutionV0(
        { memoryRepository: repository },
        { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: VALID_LABEL, [extra]: "model-supplied" }) }
      );
      expect(attempt).toMatchObject({ ok: false, code: "INVALID_PROVIDER_OUTPUT", providerCalls: 1 });
    }
  });

  it("label gates: frozen Belief label semantics —reject, never normalize/repair", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const runNew = (proposed_label: string) =>
      runBeliefSemanticTargetResolutionV0(
        { memoryRepository: repository },
        { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NEW_PROPOSITION_CANDIDATE", proposed_label }) }
      );
    expect((await runNew(VALID_LABEL)).ok).toBe(true);
    expect(await runNew("")).toMatchObject({ ok: false, code: "INVALID_PROPOSED_LABEL" });
    expect(await runNew("   ")).toMatchObject({ ok: false, code: "INVALID_PROPOSED_LABEL" });
    expect(await runNew("  padded label  ")).toMatchObject({ ok: false, code: "INVALID_PROPOSED_LABEL" });
    // non-NFC: é as e + combining acute
    expect(await runNew("cafe\u0301 proposition")).toMatchObject({ ok: false, code: "INVALID_PROPOSED_LABEL" });
    expect(await runNew("a".repeat(513))).toMatchObject({ ok: false, code: "INVALID_PROPOSED_LABEL" });
    expect((await runNew("a".repeat(512))).ok).toBe(true);
  });

  it("bindings: fingerprint echoes must match exactly; stale echoes reject", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const args = { subjectState: world.state, proposition_ids: [], selected_episodes: world.records };
    const staleContext = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "NO_BEARING", semantic_context_fingerprint: ("sha256:" + "0".repeat(64)) as never }) }
    );
    expect(staleContext).toMatchObject({ ok: false, code: "STALE_SEMANTIC_CONTEXT", providerCalls: 1 });
    const staleCatalog = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { ...args, provider: echoProvider({ kind: "NO_BEARING", candidate_catalog_fingerprint: ("sha256:" + "0".repeat(64)) as never }) }
    );
    expect(staleCatalog).toMatchObject({ ok: false, code: "STALE_CANDIDATE_CATALOG", providerCalls: 1 });
  });

  it("capability: host-minted only —JSON clone, structural clone, and raw provider output all FAIL", async () => {
    const world = await fixtureWorld();
    const run = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }) }
    );
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const resolution = run.resolution;
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(resolution)).toBe(true);
    const jsonClone = JSON.parse(JSON.stringify(resolution));
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(jsonClone)).toBe(false);
    const structuralClone: typeof resolution = {
      schema_version: resolution.schema_version,
      subject_id: resolution.subject_id,
      state_revision: resolution.state_revision,
      repository_revision: resolution.repository_revision,
      semantic_context_fingerprint: resolution.semantic_context_fingerprint,
      candidate_catalog_fingerprint: resolution.candidate_catalog_fingerprint,
      evidence_binding: resolution.evidence_binding,
      decision: resolution.decision
    };
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(structuralClone)).toBe(false);
    const raw = await echoProvider({ kind: "NO_BEARING" }).propose({
      schema_version: BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION,
      subject_id: world.state.identity.subject_id,
      state_revision: 4,
      repository_revision: world.state.memory_state.repository_revision as never,
      evidence: { schema_version: "belief-semantic-evidence-projection-v0", evidence: [] },
      catalog: { schema_version: "belief-semantic-proposition-catalog-v0", propositions: [] },
      semantic_context_fingerprint: ("sha256:" + "1".repeat(64)) as never,
      candidate_catalog_fingerprint: ("sha256:" + "2".repeat(64)) as never
    });
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(raw)).toBe(false);
  });

  it("provider execution: exactly once on success; zero on pre-provider failure; throw stays failure; no retry", async () => {
    const world = await fixtureWorld();
    const repository = world.repository as unknown as MemoryPreparationAuthority;
    const capturedOk: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    const ok = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedOk) }
    );
    expect(ok.ok).toBe(true);
    expect(capturedOk.calls).toBe(1);
    const capturedFail: { input: BeliefSemanticTargetResolutionProviderInputV0 | null; calls: number } = { input: null, calls: 0 };
    const preFail = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A, PROPOSITION_ID_A] as never, selected_episodes: world.records, provider: echoProvider({ kind: "NO_BEARING" }, capturedFail) }
    );
    expect(preFail.ok).toBe(false);
    expect(capturedFail.calls).toBe(0);
    const thrown = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: repository },
      { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: throwingProvider() }
    );
    // provider exception remains a PROVIDER FAILURE —never NO_BEARING
    expect(thrown).toMatchObject({ ok: false, code: "PROVIDER_FAILURE", providerCalls: 1 });
    if (!thrown.ok) expect(thrown.code).not.toBe("NO_BEARING");
  });

  it("zero canonical effect: accepted runs leave SubjectState byte-identical (revision/hash/trace/time/beliefs/all domains)", async () => {
    const world = await fixtureWorld();
    const before = structuredClone(world.state);
    const run = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
      { subjectState: world.state, proposition_ids: [PROPOSITION_ID_A] as never, selected_episodes: world.records, provider: echoProvider({ kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS" }) }
    );
    expect(run.ok).toBe(true);
    expect(world.state).toEqual(before);
    expect(world.state.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
    expect(world.state.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    expect(world.state.beliefs.items).toEqual(before.beliefs.items);
    expect(world.state.personality).toEqual(before.personality);
    expect(world.state.relationships).toEqual(before.relationships);
    expect(world.state.memory_state).toEqual(before.memory_state);
    // accepted NEW candidate is NOT a BeliefMutationProposalV0 INSERT: it lacks
    // proposition_key/initial_credence, and a mutation derived from it alone is rejected.
    if (run.ok && run.resolution.decision.kind === "EXISTING_PROPOSITION") {
      const newRun = await runBeliefSemanticTargetResolutionV0(
        { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
        { subjectState: world.state, proposition_ids: [], selected_episodes: world.records, provider: echoProvider({ kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: VALID_LABEL }) }
      );
      expect(newRun.ok).toBe(true);
      if (!newRun.ok) return;
      const decision = newRun.resolution.decision;
      if (decision.kind !== "NEW_PROPOSITION_CANDIDATE") throw new Error("expected NEW candidate");
      const derivedInsert = {
        schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
        subject_id: newRun.resolution.subject_id,
        state_revision: newRun.resolution.state_revision,
        mutation: { kind: "INSERT", proposition_label: decision.proposed_label }
      };
      expect(validateBeliefMutationProposal(derivedInsert).ok).toBe(false);
      expect(Object.keys(decision)).toEqual(["kind", "proposed_label"]);
    }
  });
});
