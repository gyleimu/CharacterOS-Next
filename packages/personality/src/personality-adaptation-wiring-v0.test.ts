/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production wiring acceptance.
 *
 * Deterministic, offline: real V4 atomic authority + canonical Memory history.
 * Proves the complete evidence→channel→producer→V4-commit chain, idempotent
 * replay (same evidence set applies at most once), new-evidence progression,
 * empty-Personality fail-closed, and provider-failure non-mutation.
 *
 * P0 values are EXPERIMENT FIXTURE ONLY and are never defaults.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  validateHash,
  validateRepositoryRevision,
  type SubjectStateV0,
  type SubjectStateV4,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  InMemoryMemoryRepository,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import { createInteractiveSubjectSeedV0 } from "@characteros-next/runtime";

import { InMemoryPersonalityAdaptationStoreV0 } from "./personality-adaptation-store-v0.js";
import {
  PersonalityAdaptationWiringV0,
  type PersonalityAdaptationReportV0
} from "./personality-adaptation-wiring-v0.js";
import type { PersonalitySemanticChannelProviderV0 } from "./personality-semantic-channel.js";

const SUBJECT_ID = "subject-s0";
const EP_A = `episode:${"a".repeat(64)}`;
const EP_B = `episode:${"b".repeat(64)}`;
const EP_C = `episode:${"c".repeat(64)}`;
const EP_D = `episode:${"d".repeat(64)}`;
const P0 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.5 } as const;

function requireBrand<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(`fixture brand invalid: ${result.error.detail}`);
  return result.value;
}

class FixedProvider implements PersonalitySemanticChannelProviderV0 {
  calls = 0;
  constructor(private readonly mode: { kind: "CHANNEL"; channel_id: string } | { kind: "ABSTAIN" } | { kind: "THROW" }) {}
  async propose(input: Parameters<PersonalitySemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    if (this.mode.kind === "THROW") throw new Error("personality provider offline");
    if (this.mode.kind === "ABSTAIN") {
      return {
        kind: "ABSTAIN",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        catalog_fingerprint: input.catalog_fingerprint
      };
    }
    return {
      kind: "CHANNEL",
      channel_id: this.mode.channel_id,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

function episode(ref: string): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: ref,
    occurrence_logical_time: 0,
    recorded_at_logical_time: 1,
    provenance: {
      transition_id: `learning_${ref.slice(-4)}`,
      producer: "memory",
      cause_refs: []
    },
    references: [],
    context: {
      scene: "The subject willingly engaged a novel unfamiliar option and reinterpreted it.",
      focus_refs: [],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.8, source: SALIENCE_SOURCE_ENCODING_DECLARED }
  } as unknown as EpisodicMemoryRecordV0;
}

function v3Source(withPrior: boolean, revision: string): SubjectStateV0 {
  const seed = withPrior
    ? createInteractiveSubjectSeedV0(SUBJECT_ID, "", [], {
        schema_version: "personality-genesis-prior-v0",
        dimensions: P0 as never
      })
    : createInteractiveSubjectSeedV0(SUBJECT_ID, "", []);
  return {
    ...seed,
    memory_state: { ...seed.memory_state, repository_revision: revision }
  } as SubjectStateV0;
}

async function buildWorld(options: { withPrior: boolean; provider: PersonalitySemanticChannelProviderV0 }) {
  const memory = new InMemoryMemoryRepository();
  await memory.prepareRevision({ parent_revision: null, records: [] }); // R0
  let parent = "R0";
  for (const ref of [EP_A, EP_B, EP_C, EP_D]) {
    const record = episode(ref);
    const payloadHash = await memory.storePayload(record.episode_ref, record);
    const prepared = await memory.prepareRevision({
      parent_revision: parent as never,
      records: [{ ref: record.episode_ref, payload_hash: payloadHash }] as never
    });
    parent = prepared.repository_revision as string;
  }
  const revision = requireBrand(validateRepositoryRevision(parent, "wiring.r4.revision"));
  const revisionHash = requireBrand(validateHash(`sha256:${"a".repeat(64)}` as never, "wiring.r4.hash"));
  const binding = { repository_revision: revision, repository_revision_hash: revisionHash };
  const genesis = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0",
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
      v3_source: v3Source(options.withPrior, parent),
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async () => true
  } as never);
  if (!genesis.ok) throw new Error(`v4 genesis failed: ${genesis.code} ${genesis.detail}`);
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, genesis.state as never]]),
    seedBundles: [],
    referenceValidator: async () => true,
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  });
  const store = new InMemoryPersonalityAdaptationStoreV0();
  const wiring = new PersonalityAdaptationWiringV0({
    subjectCore: assembly.facade as never,
    memoryRepository: memory,
    producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
    readEpisodePayload: async (ref: string) =>
      (memory as unknown as { readStoredPayload(r: string): unknown }).readStoredPayload(ref) ?? null,
    semanticProvider: options.provider,
    store
  });
  const read = () => assembly.facade.readCurrentSnapshot(SUBJECT_ID as never) as Promise<SubjectStateV4 | null>;
  return { wiring, read, provider: options.provider, parent };
}

function openness(report: PersonalityAdaptationReportV0 | null): number | null {
  return report?.next_value ?? null;
}

describe("PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — wiring", () => {
  it("accumulates distinct historical episodes, commits at ≥3 members, and does not replay", async () => {
    const provider = new FixedProvider({ kind: "CHANNEL", channel_id: "personality.openness.increase" });
    const world = await buildWorld({ withPrior: true, provider });

    const first = await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_A, EP_B, EP_C] });
    expect(first.terminal).toBe("COMMITTED");
    expect(provider.calls).toBe(1);
    expect(first.evidence_member_count).toBe(3);
    expect(first.channel_id).toBe("personality.openness.increase");
    expect(first.prior_value).toBe(P0.openness);
    expect(openness(first)).toBeCloseTo(P0.openness + 0.05, 4);
    expect((first as { detail?: string }).detail ?? null).toBeNull();

    // Replay of the SAME evidence set: no second step, no provider call.
    const replay = await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_A, EP_B, EP_C] });
    expect(replay.status).toBe("SKIPPED_ALREADY_CONSUMED");

    // A genuinely new committed episode enables a later lawful step P1 → P2.
    const second = await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_D] });
    expect(second.terminal).toBe("COMMITTED");
    expect(second.prior_value).toBeCloseTo(P0.openness + 0.05, 4);
    expect(openness(second)).toBeCloseTo(P0.openness + 0.1, 4);

    const snapshot = await world.read();
    if (snapshot === null) throw new Error("snapshot missing");
    // traits_seed is the immutable authored P0; only openness changed.
    expect(snapshot.traits_seed.dimensions).toEqual(P0);
    const byId = new Map(snapshot.personality.dimensions.map((d) => [d.dimension_id as string, d.value as number]));
    expect(byId.get("openness")).toBeCloseTo(P0.openness + 0.1, 4);
    for (const dimension of ["agreeableness", "conscientiousness", "extraversion"] as const) {
      expect(byId.get(dimension)).toBe(P0[dimension]);
    }
  });

  it("a single episode is insufficient", async () => {
    const provider = new FixedProvider({ kind: "CHANNEL", channel_id: "personality.openness.increase" });
    const world = await buildWorld({ withPrior: true, provider });
    const report = await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_A] });
    expect(report.terminal).toBe("NOT_ELIGIBLE");
    expect(report.next_value).toBeNull();
  });

  it("empty Personality fails closed with zero provider calls", async () => {
    const provider = new FixedProvider({ kind: "CHANNEL", channel_id: "personality.openness.increase" });
    const world = await buildWorld({ withPrior: false, provider });
    const report = await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_A, EP_B, EP_C] });
    expect(report.status).toBe("SKIPPED_EMPTY_PERSONALITY");
    expect(provider.calls).toBe(0);
  });

  it("provider ABSTAIN and provider failure both leave Personality unchanged", async () => {
    const abstain = new FixedProvider({ kind: "ABSTAIN" });
    const worldAbstain = await buildWorld({ withPrior: true, provider: abstain });
    const abstained = await worldAbstain.wiring.runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EP_A, EP_B, EP_C]
    });
    expect(abstained.terminal).toBe("ABSTAIN");
    const snapshotAbstain = await worldAbstain.read();
    expect(
      snapshotAbstain?.personality.dimensions.find((d) => d.dimension_id === "openness")?.value
    ).toBe(P0.openness);

    const failing = new FixedProvider({ kind: "THROW" });
    const worldFail = await buildWorld({ withPrior: true, provider: failing });
    const failed = await worldFail.wiring.runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EP_A, EP_B, EP_C]
    });
    expect(failed.terminal).toBe("REJECTED");
    expect(failed.rejection_code).toBe("INVALID_PROVIDER_OUTPUT");
    const snapshotFail = await worldFail.read();
    expect(
      snapshotFail?.personality.dimensions.find((d) => d.dimension_id === "openness")?.value
    ).toBe(P0.openness);
  });

  it("does not consume the evidence set on a transient rejection (provider can succeed later)", async () => {
    const failing = new FixedProvider({ kind: "THROW" });
    const world = await buildWorld({ withPrior: true, provider: failing });
    await world.wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EP_A, EP_B, EP_C] });
    // Same wiring but a working provider would run again because nothing was consumed.
    expect(world.wiring.exportState()).toMatchObject({ records: [] });
  });
});
