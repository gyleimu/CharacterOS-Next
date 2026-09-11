/**
 * PERSONALITY_V4_TRANSITION_ADMISSION_V0 — production V4 commit acceptance.
 *
 * Proves the established Personality transition now commits through the REAL
 * explicit-v4 atomic authority (not the v3 facade), with exact /personality
 * replacement, immutable traits_seed, target-dimension-only change, and the
 * unchanged unknown-dimension fail-closed law.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  validateHash,
  validateIdentifier,
  validateLogicalTime,
  validateRepositoryRevision,
  validateStateRevision,
  validateSubjectStateV4,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  parseEpisodeRef,
  type EpisodeRef
} from "@characteros-next/memory";

import { s0 } from "../observation/observation-fixtures.js";
import { deriveEvidenceMemberSetFingerprint } from "./personality-update-proposal.js";
import { PersonalityTransitionExecutor } from "./personality-transition-executor.js";

const SUBJECT_ID = "subject-s0";
const EPISODE_A = `episode:${"b".repeat(64)}`;
const P0_DIMENSIONS = [
  { dimension_id: "agreeableness", value: 0.5 },
  { dimension_id: "conscientiousness", value: 0.5 },
  { dimension_id: "extraversion", value: 0.5 },
  { dimension_id: "openness", value: 0.5 }
] as const;

function requireBrand<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(`fixture brand invalid: ${result.error.detail}`);
  return result.value;
}

function episodeRef(raw: string): EpisodeRef {
  return requireBrand(parseEpisodeRef(raw, "fixture.episode_ref"));
}

function v3Source(): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  return {
    ...base,
    traits_seed: {
      dimensions: { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.5 }
    },
    personality: {
      schema_version: "personality-state-v0",
      dimensions: P0_DIMENSIONS.map((d) => ({ dimension_id: d.dimension_id, value: d.value }))
    },
    memory_state: { ...(base["memory_state"] as Record<string, unknown>), repository_revision: "R1" }
  } as unknown as SubjectStateV0;
}

async function buildWorld() {
  const memory = new InMemoryMemoryRepository();
  await memory.prepareRevision({ parent_revision: null, records: [] }); // R0
  await memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [{ ref: EPISODE_A, payload_hash: `sha256:${"b".repeat(60)}0001` }] as never
  }); // R1
  const revision = requireBrand(validateRepositoryRevision("R1", "v4.r0.revision"));
  const revisionHash = requireBrand(validateHash(`sha256:${"a".repeat(64)}` as never, "v4.r0.hash"));
  const binding = { repository_revision: revision, repository_revision_hash: revisionHash };
  const genesis = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0",
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
      v3_source: v3Source(),
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async () => true
  } as never);
  if (!genesis.ok) throw new Error(`v4 genesis failed: ${genesis.code} ${genesis.detail}`);
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, genesis.state as never]]),
    seedBundles: [],
    referenceValidator: async (b) => memory.validateRevisionBinding(b as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  });
  const executor = new PersonalityTransitionExecutor({
    subjectCore: assembly.facade as never,
    issuer: assembly.producerAuthorizationIssuer,
    memoryRepository: memory
  });
  const ctx = {
    subject_id: requireBrand(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireBrand(validateLogicalTime(0, "ctx.current_logical_time")),
    state_revision: requireBrand(validateStateRevision(0, "ctx.state_revision"))
  };
  return { memory, executor, ctx };
}

async function proposal(updates: { dimension_id: string; next_value: number }[]) {
  return {
    schema_version: "personality-update-proposal-v0",
    subject_id: SUBJECT_ID,
    expected_state_revision: 0,
    updates,
    evidence_binding: {
      member_refs: [EPISODE_A],
      member_set_fingerprint: await deriveEvidenceMemberSetFingerprint([episodeRef(EPISODE_A)])
    }
  };
}

describe("PERSONALITY_V4_TRANSITION_ADMISSION_V0 — explicit v4 atomic authority", () => {
  it("commits a valid Personality transition through the v4 foundation", async () => {
    const world = await buildWorld();
    const result = await world.executor.execute(
      world.ctx,
      await proposal([{ dimension_id: "openness", next_value: 0.55 }])
    );
    expect(result.kind, JSON.stringify(result)).toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const next = result.bundle.next_snapshot;
    // The committed v4 successor remains a valid v4 state.
    expect(validateSubjectStateV4(next).ok).toBe(true);
    // Exact /personality replacement: only the target dimension changed.
    const byId = new Map(
      next.personality.dimensions.map((d) => [d.dimension_id as string, d.value as number])
    );
    expect(byId.get("openness")).toBe(0.55);
    for (const dimension of ["agreeableness", "conscientiousness", "extraversion"] as const) {
      expect(byId.get(dimension)).toBe(0.5);
    }
    // traits_seed firewall: immutable P0 is byte-identical before/after.
    expect(next.traits_seed).toEqual({
      dimensions: { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.5 }
    });
  });

  it("rejects an unregistered target dimension (no admission-driven weakening)", async () => {
    const world = await buildWorld();
    const result = await world.executor.execute(
      world.ctx,
      await proposal([{ dimension_id: "neuroticism", next_value: 0.6 }])
    );
    expect(result.kind).toBe("REJECTED_UNKNOWN_DIMENSION");
  });

  it("keeps the empty-Personality default valid (admission creates no dimensions)", async () => {
    const memory = new InMemoryMemoryRepository();
    await memory.prepareRevision({ parent_revision: null, records: [] });
    const revision = requireBrand(validateRepositoryRevision("R0", "v4.r0.revision"));
    const revisionHash = requireBrand(validateHash(`sha256:${"a".repeat(64)}` as never, "v4.r0.hash"));
    const binding = { repository_revision: revision, repository_revision_hash: revisionHash };
    const base = s0() as unknown as Record<string, unknown>;
    const emptyV3 = {
      ...base,
      traits_seed: { dimensions: {} },
      personality: { schema_version: "personality-state-v0", dimensions: [] }
    } as unknown as SubjectStateV0;
    const genesis = await materializeSubjectStateV4V0({
      mode: "EXPLICIT_V4_FOUNDATION_V0",
      seed: {
        schema_version: "subject-state-v4-genesis-seed-v0",
        subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
        v3_source: emptyV3,
        r0_binding: binding
      },
      r0_binding: binding,
      reference_validator: async () => true
    } as never);
    if (!genesis.ok) throw new Error(`v4 genesis failed: ${genesis.code} ${genesis.detail}`);
    expect(genesis.state.personality.dimensions).toEqual([]);
    expect(validateSubjectStateV4(genesis.state).ok).toBe(true);
  });
});
