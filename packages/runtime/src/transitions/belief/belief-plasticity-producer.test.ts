/**
 * Tests for BeliefPlasticityProducer V0. Every valid plasticity run consumes a
 * GENUINELY host-minted semantic result issued through the frozen semantic
 * runner (§32 — the semantic WeakSet is never bypassed with fabricated
 * objects). Covers the update law, numeric canonicalization, saturation,
 * authority gates, stale bindings, caller-numeric rejection, capability,
 * fingerprints, repeated-evidence purity, and zero canonical effect.
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
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  runBeliefSemanticTargetResolutionV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type BeliefSemanticTargetResolutionV0
} from "./belief-semantic-target-resolution.js";
import {
  BELIEF_PLASTICITY_POLICY_VERSION,
  BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION,
  BELIEF_PLASTICITY_STEP,
  isAuthorizedBeliefPlasticityResultV0,
  produceBeliefPlasticityV0,
  type BeliefPlasticityProducerInputV0
} from "./belief-plasticity-producer.js";

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
const PROPOSITION_LABEL_A = "Alice can be relied on for joint plans";

const EXACT_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

function hashHex(n: number): string {
  return `sha256:${n.toString().padStart(64, "0")}`;
}

/** TEST-LOCAL fully valid TraceEntryV1 at history position `seq` (§10.2). */
function traceEntry(seq: number): Record<string, unknown> {
  return {
    trace_schema_version: "trace-v1",
    trace_id: `trace:t${seq}`,
    history_sequence: seq,
    transition_id: `t-${seq}`,
    transition_type: "Observation",
    subject_id: "subject-s0",
    subject_revision_before: seq - 1,
    subject_revision_after: seq,
    logical_time: seq,
    rule_ids: [...EXACT_RULE_IDS],
    cause_refs: [],
    proposal_ref: `proposal:p${seq}`,
    domain_mutations: [
      {
        producer: "context",
        domain: "context",
        layers: ["context"],
        field_changes: [{ path: "/context", operation: "SET" }]
      }
    ],
    state_hash_before: hashHex(seq),
    state_hash_after: hashHex(seq * 10 + 1),
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
}

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

/**
 * TEST-LOCAL canonical snapshot (revision 0 ⇒ trace-window linkage invariants
 * hold) with one registered proposition + repository-bound revision.
 */
async function fixtureWorld(credence = 0.5): Promise<{
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
      items: [{ proposition_id: PROPOSITION_ID_A, proposition_label: PROPOSITION_LABEL_A, credence }]
    }
  };
  return { repository, records, state: state as SubjectStateV0 };
}

/** TEST-LOCAL valid revision-1 state (trace entry + metadata linkage). */
function revisionOneState(world: { state: SubjectStateV0 }): SubjectStateV0 {
  const cloned = structuredClone(world.state) as unknown as Record<string, unknown>;
  cloned["runtime_metadata"] = {
    subject_version: "subject-v0",
    state_revision: 1,
    logical_time: 3,
    last_transition_time: 3,
    last_transition_type: "Observation",
    created_at: 0,
    updated_at: 3
  };
  cloned["trace_window"] = {
    trace_window_schema_version: "trace-window-v1",
    capacity: 64,
    cursor: { last_history_sequence: 1, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
    entries: [traceEntry(1)]
  };
  return cloned as unknown as SubjectStateV0;
}

type DecisionOverride = Record<string, unknown>;

/**
 * TEST-LOCAL minter: issues a GENUINE host-authorized semantic capability by
 * running the FROZEN semantic runner (never fabricates WeakSet membership).
 */
async function mintSemantic(
  world: { repository: InMemoryMemoryRepository; records: EpisodicMemoryRecordV0[]; state: SubjectStateV0 },
  decisionOverride: DecisionOverride = {},
  episodes?: readonly EpisodicMemoryRecordV0[]
): Promise<BeliefSemanticTargetResolutionV0> {
  // A `kind` override REPLACES the default EXISTING decision wholesale (closed-key
  // shapes differ per branch); otherwise the override merges into it.
  const decision: DecisionOverride =
    decisionOverride["kind"] === undefined
      ? { kind: "EXISTING_PROPOSITION", proposition_id: PROPOSITION_ID_A, relation: "SUPPORTS", ...decisionOverride }
      : decisionOverride;
  const provider: BeliefSemanticTargetResolutionProviderV0 = {
    async propose(input) {
      return {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        candidate_catalog_fingerprint: input.candidate_catalog_fingerprint,
        ...decision
      };
    }
  };
  const run = await runBeliefSemanticTargetResolutionV0(
    { memoryRepository: world.repository as unknown as MemoryPreparationAuthority },
    {
      subjectState: world.state,
      proposition_ids: [PROPOSITION_ID_A] as never,
      selected_episodes: episodes ?? world.records,
      provider
    }
  );
  if (!run.ok) throw new Error(`semantic mint failed: ${run.code} ${run.detail}`);
  return run.resolution;
}

function producerInput(
  state: SubjectStateV0,
  semantic_capability: unknown
): BeliefPlasticityProducerInputV0 {
  return { current_subject_state: state, semantic_capability } as BeliefPlasticityProducerInputV0;
}

describe("BeliefPlasticityProducer V0", () => {
  it("accepts authorized SUPPORTS: +0.05 law, direction, exact bindings, deep freeze, exact policy/schema", async () => {
    const world = await fixtureWorld(0.5);
    const semantic = await mintSemantic(world);
    const run = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const result = run.result;
    expect(result.schema_version).toBe(BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION);
    expect(result.policy_version).toBe(BELIEF_PLASTICITY_POLICY_VERSION);
    expect(result.policy_version).toBe("belief-plasticity-policy-v0");
    expect(result.subject_id).toBe(world.state.identity.subject_id);
    expect(result.state_revision).toBe(world.state.runtime_metadata.state_revision);
    expect(result.repository_revision).toBe(world.state.memory_state.repository_revision);
    expect(result.proposition_id).toBe(PROPOSITION_ID_A);
    expect(result.relation).toBe("SUPPORTS");
    // Current credence comes ONLY from canonical BeliefState.
    expect(result.current_credence).toBe(0.5);
    expect(result.outcome).toEqual({ kind: "CREDENCE_CHANGE", next_credence: 0.5 + BELIEF_PLASTICITY_STEP });
    if (result.outcome.kind === "CREDENCE_CHANGE") {
      // Directional invariant: non-saturated SUPPORTS strictly increases.
      expect(result.outcome.next_credence).toBeGreaterThan(result.current_credence);
    }
    expect(result.evidence_binding.member_refs).toEqual([EP_A, EP_B]);
    expect(result.semantic_context_fingerprint).toBe(semantic.semantic_context_fingerprint);
    expect(result.candidate_catalog_fingerprint).toBe(semantic.candidate_catalog_fingerprint);
    expect(result.output_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.outcome)).toBe(true);
    expect(Object.isFrozen(result.evidence_binding)).toBe(true);
  });

  it("accepts authorized CONTRADICTS: exact -0.05 IEEE law with NO final rounding", async () => {
    const world = await fixtureWorld(0.6);
    const semantic = await mintSemantic(world, { relation: "CONTRADICTS" });
    const run = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const result = run.result;
    expect(result.relation).toBe("CONTRADICTS");
    expect(result.current_credence).toBe(0.6);
    // IEEE_754_SINGLE_SIGNED_ADD_CLAMP_VALIDATE_JCS_NO_FINAL_ROUND: 0.6 - 0.05
    // lawfully remains 0.5499999999999999 — never rounded/quantized.
    expect(result.outcome).toEqual({ kind: "CREDENCE_CHANGE", next_credence: 0.5499999999999999 });
    if (result.outcome.kind === "CREDENCE_CHANGE") {
      expect(result.outcome.next_credence).toBe(0.6 - BELIEF_PLASTICITY_STEP);
      expect(result.outcome.next_credence).toBeLessThan(result.current_credence);
      expect(result.outcome.next_credence).not.toBe(Number(result.outcome.next_credence.toFixed(2)));
    }
  });

  it("rejects authorized NO_BEARING and NEW_PROPOSITION_CANDIDATE as INELIGIBLE_SEMANTIC_KIND", async () => {
    const world = await fixtureWorld();
    const noBearing = await mintSemantic(world, { kind: "NO_BEARING" });
    expect(await produceBeliefPlasticityV0(producerInput(world.state, noBearing))).toMatchObject({
      ok: false,
      code: "INELIGIBLE_SEMANTIC_KIND"
    });
    const freshNew = await fixtureWorld();
    const newCandidate = await mintSemantic(
      freshNew,
      {
        kind: "NEW_PROPOSITION_CANDIDATE",
        proposed_label: "Team offsites work better with a written agenda"
      },
      freshNew.records
    );
    expect(
      await produceBeliefPlasticityV0(producerInput(freshNew.state, newCandidate))
    ).toMatchObject({ ok: false, code: "INELIGIBLE_SEMANTIC_KIND" });
  });

  it("capability gate: JSON clone, structural reconstruction, and raw values all UNTRUSTED", async () => {
    const world = await fixtureWorld();
    const semantic = await mintSemantic(world);
    const jsonClone = JSON.parse(JSON.stringify(semantic));
    expect(await produceBeliefPlasticityV0(producerInput(world.state, jsonClone))).toMatchObject({
      ok: false,
      code: "UNTRUSTED_SEMANTIC_CAPABILITY"
    });
    const structuralClone = { ...semantic };
    expect(
      await produceBeliefPlasticityV0(producerInput(world.state, structuralClone))
    ).toMatchObject({ ok: false, code: "UNTRUSTED_SEMANTIC_CAPABILITY" });
    expect(await produceBeliefPlasticityV0(producerInput(world.state, null))).toMatchObject({
      ok: false,
      code: "UNTRUSTED_SEMANTIC_CAPABILITY"
    });
  });

  it("binding gates: wrong subject, stale state revision, stale repository revision all reject without rebase", async () => {
    const world = await fixtureWorld();
    const semantic = await mintSemantic(world);
    const wrongSubject = structuredClone(world.state) as unknown as Record<string, unknown>;
    wrongSubject["identity"] = { ...(wrongSubject["identity"] as object), subject_id: "subject-s1" };
    expect(
      await produceBeliefPlasticityV0(producerInput(wrongSubject as unknown as SubjectStateV0, semantic))
    ).toMatchObject({ ok: false, code: "SEMANTIC_SUBJECT_MISMATCH" });
    // Same subject, later (valid) revision ⇒ semantic capability is STALE.
    const newer = revisionOneState(world);
    expect(await produceBeliefPlasticityV0(producerInput(newer, semantic))).toMatchObject({
      ok: false,
      code: "STALE_STATE_REVISION"
    });
    const staleRepo = structuredClone(world.state) as unknown as Record<string, unknown>;
    staleRepo["memory_state"] = {
      ...(staleRepo["memory_state"] as object),
      repository_revision: "R-OTHER"
    };
    expect(
      await produceBeliefPlasticityV0(producerInput(staleRepo as unknown as SubjectStateV0, semantic))
    ).toMatchObject({ ok: false, code: "STALE_REPOSITORY_REVISION" });
  });

  it("target gate: missing proposition rejects; malformed NaN-credence state rejects upstream validation", async () => {
    const world = await fixtureWorld();
    const semantic = await mintSemantic(world);
    const emptied = structuredClone(world.state) as unknown as Record<string, unknown>;
    emptied["beliefs"] = { schema_version: "belief-state-v0", items: [] };
    expect(
      await produceBeliefPlasticityV0(producerInput(emptied as unknown as SubjectStateV0, semantic))
    ).toMatchObject({ ok: false, code: "TARGET_PROPOSITION_MISSING" });
    // NaN credence is not a finite UnitIntervalV0 ⇒ authoritative state validation rejects.
    const corrupt = structuredClone(world.state) as unknown as Record<string, unknown>;
    ((corrupt["beliefs"] as { items: { credence: number }[] }).items[0] as { credence: number }).credence =
      Number.NaN;
    expect(
      await produceBeliefPlasticityV0(producerInput(corrupt as unknown as SubjectStateV0, semantic))
    ).toMatchObject({ ok: false, code: "INVALID_CURRENT_SUBJECT_STATE" });
  });

  it("saturation: 1.0+SUPPORTS and 0.0+CONTRADICTS give explicit NO_CHANGE/SATURATED (never fabricated change)", async () => {
    const top = await fixtureWorld(1);
    const topSemantic = await mintSemantic(top);
    const topRun = await produceBeliefPlasticityV0(producerInput(top.state, topSemantic));
    expect(topRun.ok).toBe(true);
    if (topRun.ok) {
      expect(topRun.result.outcome).toEqual({ kind: "NO_CHANGE", reason: "SATURATED" });
      expect(topRun.result.current_credence).toBe(1);
    }
    const bottom = await fixtureWorld(0);
    const bottomSemantic = await mintSemantic(bottom, { relation: "CONTRADICTS" });
    const bottomRun = await produceBeliefPlasticityV0(producerInput(bottom.state, bottomSemantic));
    expect(bottomRun.ok).toBe(true);
    if (bottomRun.ok) {
      expect(bottomRun.result.outcome).toEqual({ kind: "NO_CHANGE", reason: "SATURATED" });
      expect(bottomRun.result.current_credence).toBe(0);
    }
  });

  it("numeric law: exact ±0.05, upper clamp, lower clamp — no other factor ever", async () => {
    // Upper clamp: non-saturated 0.98 + 0.05 = 1.03 ⇒ clamps to exactly 1.
    const upper = await fixtureWorld(0.98);
    const upperSemantic = await mintSemantic(upper);
    const upperRun = await produceBeliefPlasticityV0(producerInput(upper.state, upperSemantic));
    expect(upperRun.ok).toBe(true);
    if (upperRun.ok) {
      expect(upperRun.result.outcome).toEqual({ kind: "CREDENCE_CHANGE", next_credence: 1 });
    }
    // Lower clamp: non-saturated 0.02 - 0.05 = -0.03 ⇒ clamps to exactly 0.
    const lower = await fixtureWorld(0.02);
    const lowerSemantic = await mintSemantic(lower, { relation: "CONTRADICTS" });
    const lowerRun = await produceBeliefPlasticityV0(producerInput(lower.state, lowerSemantic));
    expect(lowerRun.ok).toBe(true);
    if (lowerRun.ok) {
      expect(lowerRun.result.outcome).toEqual({ kind: "CREDENCE_CHANGE", next_credence: 0 });
    }
    // Exact-law symmetry: same magnitude in both directions.
    expect(BELIEF_PLASTICITY_STEP).toBe(0.05);
    const mid = await fixtureWorld(0.5);
    const midSemantic = await mintSemantic(mid);
    const midRun = await produceBeliefPlasticityV0(producerInput(mid.state, midSemantic));
    if (midRun.ok && midRun.result.outcome.kind === "CREDENCE_CHANGE") {
      expect(midRun.result.outcome.next_credence).toBe(0.5 + BELIEF_PLASTICITY_STEP);
    } else {
      throw new Error("expected CREDENCE_CHANGE outcome");
    }
  });

  it("evidence count never scales the step: 1 vs 2 episodes give identical numerics but distinct bindings/fingerprints", async () => {
    const world = await fixtureWorld(0.5);
    const recA = world.records[0];
    if (recA === undefined) throw new Error("fixture records missing");
    const single = await mintSemantic(world, {}, [recA]);
    const singleRun = await produceBeliefPlasticityV0(producerInput(world.state, single));
    const double = await mintSemantic(world);
    const doubleRun = await produceBeliefPlasticityV0(producerInput(world.state, double));
    expect(singleRun.ok).toBe(true);
    expect(doubleRun.ok).toBe(true);
    if (!singleRun.ok || !doubleRun.ok) return;
    expect(singleRun.result.current_credence).toBe(doubleRun.result.current_credence);
    expect(singleRun.result.outcome).toEqual(doubleRun.result.outcome);
    // Different evidence sets change ONLY the evidence binding + output fingerprint.
    expect(singleRun.result.evidence_binding.member_refs).toEqual([EP_A]);
    expect(doubleRun.result.evidence_binding.member_refs).toEqual([EP_A, EP_B]);
    expect(singleRun.result.evidence_binding.member_set_fingerprint).not.toBe(
      doubleRun.result.evidence_binding.member_set_fingerprint
    );
    expect(singleRun.result.output_fingerprint).not.toBe(doubleRun.result.output_fingerprint);
  });

  it("purity: same input ⇒ same output/fingerprint; capability reusable; repeated historical evidence never rejected", async () => {
    const world = await fixtureWorld(0.5);
    const semantic = await mintSemantic(world);
    const first = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    const second = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.result).toEqual(first.result);
    expect(second.result.output_fingerprint).toBe(first.result.output_fingerprint);
    // A NEWLY authorized capability reusing the EXACT same historical evidence is
    // accepted again — the producer is pure and performs NO history dedup.
    const reminted = await mintSemantic(world);
    const third = await produceBeliefPlasticityV0(producerInput(world.state, reminted));
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.result).toEqual(first.result);
    expect(third.result.output_fingerprint).toBe(first.result.output_fingerprint);
    // Semantic capability is REUSABLE (not consumed) and both mints stay authorized.
    expect(isAuthorizedBeliefPlasticityResultV0(first.result)).toBe(true);
    expect(isAuthorizedBeliefPlasticityResultV0(third.result)).toBe(true);
  });

  it("output fingerprint: deterministic over every bound field; any bound-field change changes it", async () => {
    const world = await fixtureWorld(0.5);
    const semantic = await mintSemantic(world);
    const a = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    const b = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.result.output_fingerprint).toBe(b.result.output_fingerprint);
    // Changing one bound field (current credence) changes the fingerprint.
    const other = await fixtureWorld(0.7);
    const otherSemantic = await mintSemantic(other);
    const c = await produceBeliefPlasticityV0(producerInput(other.state, otherSemantic));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.result.output_fingerprint).not.toBe(a.result.output_fingerprint);
  });

  it("result capability: host-minted PASS; JSON clone and structural reconstruction FAIL", async () => {
    const world = await fixtureWorld(0.5);
    const semantic = await mintSemantic(world);
    const run = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(isAuthorizedBeliefPlasticityResultV0(run.result)).toBe(true);
    const jsonClone = JSON.parse(JSON.stringify(run.result));
    expect(isAuthorizedBeliefPlasticityResultV0(jsonClone)).toBe(false);
    const structuralClone = { ...run.result };
    expect(isAuthorizedBeliefPlasticityResultV0(structuralClone)).toBe(false);
    // Mutation attempts on the frozen result fail.
    expect(() => {
      (run.result as { relation: string }).relation = "CONTRADICTS";
    }).toThrow();
  });

  it("caller numeric authority: NONE — extra current_credence/next_credence/delta/step/confidence keys reject", async () => {
    const world = await fixtureWorld(0.5);
    const semantic = await mintSemantic(world);
    for (const extra of ["current_credence", "next_credence", "delta", "step", "confidence", "score", "weight"]) {
      const attempt = await produceBeliefPlasticityV0({
        current_subject_state: world.state,
        semantic_capability: semantic,
        [extra]: 0.9
      } as unknown as BeliefPlasticityProducerInputV0);
      expect(attempt).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    expect(
      await produceBeliefPlasticityV0({ current_subject_state: world.state } as unknown as BeliefPlasticityProducerInputV0)
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("zero canonical effect + non-proposal boundary: state byte-identical; result is NOT a BeliefMutationProposal", async () => {
    const world = await fixtureWorld(0.5);
    const before = structuredClone(world.state);
    const semantic = await mintSemantic(world);
    const run = await produceBeliefPlasticityV0(producerInput(world.state, semantic));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    // Revision / StateHash / trace / logical-time / beliefs / personality /
    // relationship / memory binding: all unchanged (no commit ever happens).
    expect(world.state).toEqual(before);
    expect(world.state.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
    expect(world.state.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    expect(world.state.trace_window).toEqual(before.trace_window);
    expect(world.state.beliefs.items).toEqual(before.beliefs.items);
    expect(world.state.personality).toEqual(before.personality);
    expect(world.state.relationships).toEqual(before.relationships);
    expect(world.state.memory_state).toEqual(before.memory_state);
    // The plasticity result itself cannot validate as a BeliefMutationProposalV0.
    expect(validateBeliefMutationProposal(run.result as unknown).ok).toBe(false);
    const reshaped = {
      ...run.result,
      schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION
    };
    expect(validateBeliefMutationProposal(reshaped as unknown).ok).toBe(false);
  });
});
