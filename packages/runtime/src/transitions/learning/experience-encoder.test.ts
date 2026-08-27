/**
 * P2.3.5.3b — ExperienceEncoderV0 conformance matrix (E1–E20).
 *
 * Proves: mandatory runtime trust gate (structural fakes rejected BEFORE any
 * record construction); byte-deterministic mapping (same/equivalent trusted
 * inputs ⇒ byte-identical records, trust never leaks into durable identity);
 * exact contract-field mapping incl. provenance identities/logical time/
 * salience; produced-record self-validation against the canonical memory
 * schema; input immutability; ZERO repository / SubjectCore side effects.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleV1,
  CanonicalRefV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import {
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord
} from "@characteros-next/memory";
import { buildContextDelta } from "../../ports/context-producer-port.js";
import {
  buildObservationHarness,
  capabilitiesFor,
  observationInput
} from "../observation/observation-fixtures.js";
import { buildObservationProposal } from "../observation/observation-transition-executor.js";
import { ReferenceFastEmaAffectProducer } from "../../producers/reference-fast-ema-affect-producer.js";
import { ExperienceEncoderV0, type LearningEncodingContextV0 } from "./experience-encoder-v0.js";
import {
  isTrustedLearningExperience,
  validateTrustedLearningExperience,
  type TrustedLearningExperienceV0
} from "./learning-source-authority.js";

const OBSERVATION_ID = "observation:o-e77";
const SUBJECT_ID = "subject-s0";
/** Learning-time basis used throughout the fixture (after some elapsed time). */
const LEARNING_TIME = 5;
const EXPECTED_STATE_REVISION = 2;
const REBUILD_ORDINAL = 0;
/** Fixture prepare-identity value minted upstream by P2.3.5.3c (opaque here). */
const FIXTURE_INTENT_IDENTITY = "li-fixture-prepare-identity-0";

interface HarnessLike {
  storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleV1 | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleV1 | null;
    getCommittedBundles(): readonly AtomicCommitBundleV1[];
    currentRevision(subjectId: string): number | null;
  };
}

const encoder = new ExperienceEncoderV0();
let storeRead: HarnessLike["storeRead"];
let snapshotRead: ((subjectId: string) => Promise<SubjectStateV0 | null>) | undefined;
let memorySpy: { prepareCalls: number; readCalls: number };
let bundleA: AtomicCommitBundleV1;

function readAuthority(): Parameters<typeof validateTrustedLearningExperience>[0] {
  return {
    readCommittedBundle: async (id: string) => storeRead.readCommittedByTransitionId(id)
  };
}

function candidateFor(
  bundle: AtomicCommitBundleV1,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    subject_id: bundle.subject_id,
    source_transition_id: bundle.transition_id,
    observation_ref: bundle.trace_entry.cause_refs[0],
    entity_refs: ["entity:e-1", "subject:s0"],
    event_refs: ["event:v-2"],
    occurrence_logical_time: bundle.logical_time_after,
    appraisal_ref: null,
    scene: bundle.next_snapshot.context.scene,
    focus_refs: [...bundle.next_snapshot.context.focus_refs],
    environment_refs: [...bundle.next_snapshot.context.environment_refs],
    declared_salience: 0.42,
    ...overrides
  };
}

async function trustedFor(
  overrides: Record<string, unknown> = {}
): Promise<TrustedLearningExperienceV0> {
  const base = JSON.parse(JSON.stringify(candidateFor(bundleA))) as Record<string, unknown>;
  const checked = await validateTrustedLearningExperience(readAuthority(), {
    subject_id: SUBJECT_ID as never,
    current_logical_time: 0 as never,
    state_revision: 1 as never
  }, { ...base, ...overrides });
  if (!checked.ok) throw new Error(`fixture invariant: candidate should validate (${checked.error.detail})`);
  return checked.value;
}

/** Independently recomputed frozen derivation oracle (contract §13 + §6.1 with the fixture prepare-identity). */
async function expectedIdentities(): Promise<{
  transitionId: string;
  episodeRef: string;
}> {
  const strip = (digest: string) => digest.replace(/^sha256:/, "");
  const transitionId = `t-learn-${strip(await hashEnvelope("characteros-next/runtime/learning-transition-id/v1", {
    subject_id: SUBJECT_ID,
    expected_state_revision: EXPECTED_STATE_REVISION,
    source_transition_id: bundleA.transition_id,
    rebuild_ordinal: REBUILD_ORDINAL
  }))}`;
  // Contract §6.1 projection composed over the OPAQUE upstream-minted identity
  // (P2.3.5.3c owns its derivation; this file only verifies composition).
  const episodeRef = `episode:${strip(await hashEnvelope("characteros-next/memory/episode-ref/v1", {
    subject_id: SUBJECT_ID,
    source_transition_id: bundleA.transition_id,
    intent_id: FIXTURE_INTENT_IDENTITY
  }))}`;
  return { transitionId, episodeRef };
}

function encodingContext(
  overrides: Partial<LearningEncodingContextV0> = {}
): LearningEncodingContextV0 {
  return {
    current_logical_time: LEARNING_TIME as never,
    expected_state_revision: EXPECTED_STATE_REVISION as never,
    rebuild_ordinal: REBUILD_ORDINAL,
    intent_identity: FIXTURE_INTENT_IDENTITY,
    ...overrides
  };
}

beforeAll(async () => {
  // Commit one real Observation through the real executor and the REAL affect
  // producer so the committed snapshot durably carries source_appraisal_ref.
  const harness = buildObservationHarness({
    affectProducer: new ReferenceFastEmaAffectProducer()
  });
  storeRead = harness.core.storeRead;
  snapshotRead = (id) => harness.core.readCurrentSnapshot(id);
  memorySpy = harness.memory;

  const baseline = (await snapshotRead(SUBJECT_ID)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: baseline.runtime_metadata.logical_time as never,
    state_revision: baseline.runtime_metadata.state_revision as never
  };
  const observation = observationInput({ observation_id: OBSERVATION_ID });
  const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
    context: ctx,
    snapshot: baseline,
    transition_type: "Observation",
    appraisal: {
      schema_version: "appraisal-v0",
      appraisal_ref: `appraisal:ap-${OBSERVATION_ID.replace(":", "-")}`,
      evidence_refs: ["episode:e-9"],
      relevance: 0.9,
      goal_congruence: 0.9,
      attribution: "situation",
      controllability: 0.9,
      uncertainty: 0.9,
      intensity: 0.9
    } as never,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, baseline);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: baseline.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const outcome = await harness.executor.execute(ctx, observation, await capabilitiesFor(proposal));
  if (outcome.kind !== "COMMITTED") throw new Error("fixture invariant: expected COMMITTED source Observation");
  const committed = storeRead.readCommittedByTransitionId(outcome.bundle.transition_id);
  if (committed === null) throw new Error("fixture invariant: bundle must be readable by transition id");
  bundleA = committed;

  if (!isTrustedLearningExperience((await trustedFor()) satisfies TrustedExperienceMarker)) {
    throw new Error("fixture invariant: harness must produce runtime-trusted experiences");
  }
});
type TrustedExperienceMarker = TrustedLearningExperienceV0;

describe("P2.3.5.3b ExperienceEncoderV0 conformance", () => {
  let trustedNull: TrustedLearningExperienceV0;
  let trustedEvidenced: TrustedLearningExperienceV0;

  beforeAll(async () => {
    trustedNull = await trustedFor();
    const channel = bundleA.next_snapshot.affect.active_channels[0];
    if (channel === undefined) throw new Error("fixture invariant: expected one committed channel");
    trustedEvidenced = await trustedFor({ appraisal_ref: channel.source_appraisal_ref });
  });

  it("E1: one valid genuine trusted experience ⇒ ONE schema-valid EpisodicMemoryRecordV0", async () => {
    const record = await encoder.encode(trustedNull, encodingContext());
    expect(validateEpisodicMemoryRecord(record).ok).toBe(true);
    expect(record.schema_version).toBe("episodic-memory-record-v0");
  });

  it("E2: same trusted input encoded twice ⇒ byte-identical record", async () => {
    const r1 = await encoder.encode(trustedEvidenced, encodingContext());
    const r2 = await encoder.encode(trustedEvidenced, encodingContext());
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("E3: two independently validated equivalent trusted objects ⇒ byte-identical record", async () => {
    const t1 = await trustedFor();
    const t2 = await trustedFor(); // deterministic re-supply + fresh revalidation
    expect(t1).not.toBe(t2);
    expect(isTrustedLearningExperience(t1)).toBe(true);
    expect(isTrustedLearningExperience(t2)).toBe(true);
    const r1 = await encoder.encode(t1, encodingContext());
    const r2 = await encoder.encode(t2, encodingContext());
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("E4: episode_ref follows the frozen contract §6.1 composition exactly", async () => {
    const record = await encoder.encode(trustedNull, encodingContext());
    expect(record.episode_ref).toBe((await expectedIdentities()).episodeRef);
  });

  it("E4b: identity-relevant prepare-identity change changes the derived episode_ref", async () => {
    const base = await encoder.encode(trustedNull, encodingContext());
    const altered = await encoder.encode(
      trustedNull,
      encodingContext({ intent_identity: "li-fixture-prepare-identity-1" })
    );
    expect(altered.episode_ref).not.toBe(base.episode_ref);
    expect(altered.provenance.transition_id).toBe(base.provenance.transition_id);
  });

  it("E5: trusted input bytes are NEVER mutated by encoding", async () => {
    const beforeBytes = JSON.stringify(trustedEvidenced);
    await encoder.encode(trustedEvidenced, encodingContext());
    expect(JSON.stringify(trustedEvidenced)).toBe(beforeBytes);
    expect(Object.isFrozen(trustedEvidenced)).toBe(true);
  });

  it("E6/E7/E8: forged structural fakes rejected BEFORE record construction", async () => {
    const fakes: unknown[] = [
      { ...trustedEvidenced }, // spread
      JSON.parse(JSON.stringify(trustedEvidenced)), // JSON clone
      structuredClone(trustedEvidenced), // deep clone
      Object.defineProperties({}, Object.getOwnPropertyDescriptors(trustedEvidenced)), // descriptor copy
      Object.freeze(JSON.parse(JSON.stringify(trustedEvidenced))) // deep-frozen fake
    ];
    for (const fake of fakes) {
      expect(isTrustedLearningExperience(fake)).toBe(false);
      await expect(encoder.encode(fake, encodingContext())).rejects.toThrow(/trust gate/);
    }
  });

  it("E9: all required record refs/provenance exact (producer, identities, context)", async () => {
    const record = await encoder.encode(trustedEvidenced, encodingContext());
    const expected = await expectedIdentities();
    expect(record.provenance.producer).toBe("memory");
    expect(record.provenance.transition_id).toBe(expected.transitionId);
    expect(record.episode_ref).toBe(expected.episodeRef);
    const committed = bundleA.next_snapshot;
    expect(record.context.scene).toBe(committed.context.scene);
    expect(record.appraisal_ref).toBe(committed.affect.active_channels[0]?.source_appraisal_ref ?? null);
  });

  it("E10: cause_refs deterministic sorted uniqueness over {observation, appraisal?, entities, events}", async () => {
    const evidenced = await encoder.encode(trustedEvidenced, encodingContext());
    expect(evidenced.provenance.cause_refs).toEqual([
      "appraisal:ap-observation-o-e77",
      "entity:e-1",
      "event:v-2",
      "observation:o-e77",
      "subject:s0"
    ]);
    const plain = await encoder.encode(trustedNull, encodingContext());
    expect(plain.provenance.cause_refs).toEqual([
      "entity:e-1",
      "event:v-2",
      "observation:o-e77",
      "subject:s0"
    ]);
  });

  it("E11: references deterministic sorted uniqueness ({entities, events, observation})", async () => {
    const record = await encoder.encode(trustedEvidenced, encodingContext());
    expect(record.references).toEqual([
      "entity:e-1",
      "event:v-2",
      "observation:o-e77",
      "subject:s0"
    ]);
  });

  it("E12: logical-time mapping exact (occurrence pass-through; recorded_at = canonical encoding time)", async () => {
    const record = await encoder.encode(trustedNull, encodingContext());
    expect(record.occurrence_logical_time).toBe((bundleA.logical_time_after as unknown) as number);
    expect((record.recorded_at_logical_time as unknown) as number).toBe(LEARNING_TIME);
    expect(record.recorded_at_logical_time >= record.occurrence_logical_time).toBe(true);
  });

  it("E13: declared_salience exact pass-through (declared semantics, never computed)", async () => {
    const record = await encoder.encode(trustedNull, encodingContext());
    expect(record.salience.declared_score).toBe(0.42);
    expect(record.salience.source).toBe(SALIENCE_SOURCE_ENCODING_DECLARED);
  });

  it("E14: appraisal_ref exact pass-through / null semantics (refs only, never values)", async () => {
    const evidenced = await encoder.encode(trustedEvidenced, encodingContext());
    expect(evidenced.appraisal_ref).toBe(
      bundleA.next_snapshot.affect.active_channels[0]?.source_appraisal_ref ?? null
    );
    const plain = await encoder.encode(trustedNull, encodingContext());
    expect(plain.appraisal_ref).toBeNull();
  });

  it("E15: affect_snapshot_ref fixed null (contract forbids invented snapshot refs)", async () => {
    const record = await encoder.encode(trustedEvidenced, encodingContext());
    expect(record.affect_snapshot_ref).toBeNull();
  });

  it("E16: every produced record passes the canonical memory validator", async () => {
    for (const trusted of [trustedNull, trustedEvidenced]) {
      const record = await encoder.encode(trusted, encodingContext());
      expect(validateEpisodicMemoryRecord(record).ok).toBe(true);
    }
  });

  it("E17: no wall clock / randomness dependency during encoding", async () => {
    const dateNow = Date.now;
    const mathRandom = Math.random;
    Date.now = (() => {
      throw new Error("wall clock accessed");
    }) as typeof Date.now;
    Math.random = () => {
      throw new Error("randomness accessed");
    };
    try {
      const record = await encoder.encode(trustedNull, encodingContext());
      expect(validateEpisodicMemoryRecord(record).ok).toBe(true);
    } finally {
      Date.now = dateNow;
      Math.random = mathRandom;
    }
  });

  it("E18/E19: zero MemoryRepository writes and zero SubjectCore mutation", async () => {
    const prepareBefore = memorySpy.prepareCalls;
    const readBefore = memorySpy.readCalls;
    const bundlesBefore = storeRead.getCommittedBundles().length;
    const revisionBefore = storeRead.currentRevision(SUBJECT_ID);
    await encoder.encode(trustedNull, encodingContext());
    await encoder.encode(trustedEvidenced, encodingContext());
    expect(memorySpy.prepareCalls).toBe(prepareBefore);
    expect(memorySpy.readCalls).toBe(readBefore);
    expect(storeRead.getCommittedBundles().length).toBe(bundlesBefore);
    expect(storeRead.currentRevision(SUBJECT_ID)).toBe(revisionBefore);
  });

  it("E20: record construction does not expand schema (exact closed key surface)", async () => {
    const keys = Object.keys(
      (await encoder.encode(trustedNull, encodingContext())) as unknown as Record<string, unknown>
    ).sort();
    expect(keys).toEqual([
      "affect_snapshot_ref",
      "appraisal_ref",
      "context",
      "episode_ref",
      "occurrence_logical_time",
      "provenance",
      "recorded_at_logical_time",
      "references",
      "salience",
      "schema_version"
    ]);
    void (0 as unknown as CanonicalRefV0); // ref grammar covered by the canonical validator
  });

  it("trust gate + malformed contexts fail-closed", async () => {
    await expect(
      encoder.encode({ ...trustedNull }, encodingContext())
    ).rejects.toThrow(/trust gate/);
    await expect(
      encoder.encode(trustedNull, { ...encodingContext(), current_logical_time: Number.NaN as never })
    ).rejects.toThrow(/current_logical_time/);
    await expect(
      encoder.encode(trustedNull, { ...encodingContext(), rebuild_ordinal: -1 })
    ).rejects.toThrow(/rebuild_ordinal/);
    await expect(
      encoder.encode(trustedNull, { ...encodingContext(), intent_identity: "" })
    ).rejects.toThrow(/intent_identity/);
    await expect(
      encoder.encode(trustedNull, undefined as unknown as LearningEncodingContextV0)
    ).rejects.toThrow(/context required/);
  });
});
