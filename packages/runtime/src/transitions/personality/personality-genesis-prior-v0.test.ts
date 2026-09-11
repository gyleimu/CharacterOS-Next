/**
 * PERSONALITY_GENESIS_PRIOR_ADMISSION_V0 — explicit creation-time authoring.
 *
 * Deterministic, offline: no providers, no network, no wall clock, no random.
 * Levels: explicit prior validates (L1), creates canonical personality (L2),
 * empty genesis stays empty (L3), and acquired personality can later diverge
 * from the authored P0 through the existing frozen transition executor (L5).
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacade,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  parseEpisodeRef,
  type EpisodeRef,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";

import { createInteractiveSubjectSeedV0 } from "../../session/interactive-subject-runtime-v0.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { PERSONALITY_DIMENSION_IDS_V0 } from "./personality-dimension-registry-v0.js";
import {
  PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION,
  buildGenesisPersonalityFromPriorV0,
  traitsSeedFromPersonalityGenesisPriorV0,
  validatePersonalityGenesisPriorV0,
  type PersonalityGenesisPriorV0
} from "./personality-genesis-prior-v0.js";
import { deriveEvidenceMemberSetFingerprint } from "./personality-update-proposal.js";
import { PersonalityTransitionExecutor } from "./personality-transition-executor.js";

const SUBJECT_ID = "subject-s0";
const EPISODE_A = "episode:b7a0d91e171ee47470324bc8bfe02ac2b307018f56b9e03e76d946298636c05d";

/** TEST FIXTURE VALUES ONLY — never defaults, never promoted to production. */
const P0_A = Object.freeze({ agreeableness: 0.21, conscientiousness: 0.73, extraversion: 0.18, openness: 0.84 });
const P0_B = Object.freeze({ agreeableness: 0.66, conscientiousness: 0.34, extraversion: 0.77, openness: 0.29 });

function prior(values: Readonly<Record<string, number>>): PersonalityGenesisPriorV0 {
  return {
    schema_version: PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION,
    dimensions: values as unknown as PersonalityGenesisPriorV0["dimensions"]
  };
}

function seed(values?: Readonly<Record<string, number>>): SubjectStateV0 {
  return createInteractiveSubjectSeedV0(SUBJECT_ID, "", [], values === undefined ? undefined : prior(values));
}

function dimensionMap(state: SubjectStateV0): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dimension of state.personality.dimensions) {
    out[dimension.dimension_id as string] = dimension.value;
  }
  return out;
}

describe("PERSONALITY_GENESIS_PRIOR_ADMISSION_V0 — explicit authoring", () => {
  it("LEVEL 1 / A: an explicit prior validates, closed over the frozen registry", () => {
    const checked = validatePersonalityGenesisPriorV0(prior(P0_A));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.value.schema_version).toBe(PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION);
    expect(Object.keys(checked.value.dimensions).sort()).toEqual([...PERSONALITY_DIMENSION_IDS_V0].sort());
  });

  it("LEVEL 1 / B: invalid priors fail closed with no repair", () => {
    // Valid control.
    expect(validatePersonalityGenesisPriorV0(prior(P0_A)).ok).toBe(true);
    const invalids: unknown[] = [
      null,
      42,
      "prior",
      { ...prior(P0_A), schema_version: "personality-genesis-prior-v9" },
      { ...prior(P0_A), extra: 1 },
      { ...prior(P0_A), dimensions: {} },
      { ...prior(P0_A), dimensions: { ...P0_A, trust: 0.5 } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: undefined } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: 1.5 } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: -0.1 } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: Number.NaN } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: Number.POSITIVE_INFINITY } },
      { ...prior(P0_A), dimensions: { ...P0_A, openness: Number.NEGATIVE_INFINITY } }
    ];
    for (const bad of invalids) {
      expect(validatePersonalityGenesisPriorV0(bad).ok).toBe(false);
    }
  });

  it("LEVEL 3 / C: no prior ⇒ honest empty genesis (no 0.5, no default)", () => {
    const subject = seed();
    expect(subject.traits_seed.dimensions).toEqual({});
    expect(subject.personality.dimensions).toEqual([]);
  });

  it("LEVEL 2 / D: explicit prior ⇒ traits_seed = P0 and personality(t=0) = P0", () => {
    const subject = seed(P0_A);
    expect(subject.traits_seed.dimensions).toEqual(P0_A);
    expect(dimensionMap(subject)).toEqual(P0_A);
    expect(subject.personality.dimensions.map((d) => d.dimension_id)).toEqual([...PERSONALITY_DIMENSION_IDS_V0]);
    expect(subject.personality.schema_version).toBe("personality-state-v0");
  });

  it("E: two authored subjects differ only by their authored P0", () => {
    const a = seed(P0_A);
    const b = seed(P0_B);
    expect(a.traits_seed.dimensions).toEqual(P0_A);
    expect(b.traits_seed.dimensions).toEqual(P0_B);
    expect(dimensionMap(a)).toEqual(P0_A);
    expect(dimensionMap(b)).toEqual(P0_B);
    expect(a.identity).toEqual(b.identity);
    expect(a.memory_state).toEqual(b.memory_state);
    expect(a.beliefs).toEqual(b.beliefs);
    expect(a.relationships).toEqual(b.relationships);
  });

  it("F: explicit genesis creates no fake Memory/Experience/Belief/Relationship", () => {
    const subject = seed(P0_A);
    expect(subject.memory_state.working_refs).toEqual([]);
    expect(subject.memory_state.active_episode_refs).toEqual([]);
    expect(subject.memory_state.recent_retrieval_trace).toEqual([]);
    expect(subject.memory_state.pending_encoding_refs).toEqual([]);
    expect(subject.beliefs.items).toEqual([]);
    expect(subject.relationships.counterparts).toEqual([]);
  });

  it("G: the seed builder fails closed before creating any subject on an invalid prior", () => {
    const invalid = {
      schema_version: PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION,
      dimensions: { ...P0_A, openness: 2 }
    } as unknown as PersonalityGenesisPriorV0;
    expect(() => createInteractiveSubjectSeedV0(SUBJECT_ID, "", [], invalid)).toThrow(
      /PERSONALITY_GENESIS_PRIOR_INVALID/
    );
    expect(() => buildGenesisPersonalityFromPriorV0({ schema_version: "wrong" })).toThrow(
      /PERSONALITY_GENESIS_PRIOR_INVALID/
    );
  });

  it("H: derived traits_seed is canonical (registry-sorted) and independent of object ordering", () => {
    const shuffled = prior({ openness: 0.84, agreeableness: 0.21, extraversion: 0.18, conscientiousness: 0.73 });
    const seed = traitsSeedFromPersonalityGenesisPriorV0(shuffled);
    expect(Object.keys(seed.dimensions)).toEqual([...PERSONALITY_DIMENSION_IDS_V0]);
    expect(seed).toEqual(traitsSeedFromPersonalityGenesisPriorV0(prior(P0_A)));
  });

  it("LEVEL 5 / I: acquired personality can diverge from authored P0; traits_seed stays P0", async () => {
    const world = buildDivergenceWorld(seed(P0_A));
    const result = await world.executor.execute(personalityCtx(0), {
      schema_version: "personality-update-proposal-v0",
      subject_id: SUBJECT_ID,
      expected_state_revision: 0,
      updates: [{ dimension_id: "openness", next_value: 0.93 }],
      evidence_binding: {
        member_refs: [EPISODE_A],
        member_set_fingerprint: await deriveEvidenceMemberSetFingerprint([episodeRef(EPISODE_A)])
      }
    });
    expect(result.kind).toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const bundle = world.core.storeRead.readCurrentBundle(SUBJECT_ID);
    if (bundle === null) throw new Error("bundle missing");
    // Immutable P0 preserved; acquired personality diverged.
    expect(bundle.next_snapshot.traits_seed.dimensions).toEqual(P0_A);
    const after = dimensionMap(bundle.next_snapshot);
    expect(after["openness"]).toBe(0.93);
    expect(after["openness"]).not.toBe(P0_A.openness);
    expect(after).not.toEqual(P0_A);
    for (const id of ["agreeableness", "conscientiousness", "extraversion"] as const) {
      expect(after[id]).toBe(P0_A[id]);
    }
  });
});

// ---- deterministic test-level transition harness (mirrors personality.test.ts) ----

function requireBrand<T>(r: ValidationResult<T>): T {
  if (!r.ok) throw new Error(`fixture brand invalid: ${r.error.detail}`);
  return r.value;
}

function episodeRef(raw: string): EpisodeRef {
  return requireBrand(parseEpisodeRef(raw, "fixture.episode_ref"));
}

function personalityCtx(stateRevision: number): RuntimeContext {
  return {
    subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireBrand(validateLogicalTime(0, "ctx.current_logical_time")),
    state_revision: requireBrand(validateStateRevision(stateRevision, "ctx.state_revision"))
  };
}

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): { next_snapshot: SubjectStateV0 } | null;
  };
}

function buildDivergenceWorld(base: SubjectStateV0): { core: TestCore; executor: PersonalityTransitionExecutor } {
  const memory = new InMemoryMemoryRepository();
  void memory.prepareRevision({ parent_revision: null, records: [] });
  void memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [{ ref: EPISODE_A, payload_hash: `sha256:${"b".repeat(60)}0001` }] as never
  });
  const state: SubjectStateV0 = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: "R1" as never }
  };
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, state]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memory.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (adoption.next_repository_revision_hash === null) return false;
      return memory.validateRevisionBinding({
        repository_revision: adoption.next_repository_revision,
        repository_revision_hash: adoption.next_repository_revision_hash
      } as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]);
    }
  });
  const core: TestCore = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : state;
    },
    issuer: assembly.producerAuthorizationIssuer,
    storeRead: assembly.storeRead
  };
  const executor = new PersonalityTransitionExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { core, executor };
}
