/**
 * MemoryInfluenceProjectionV0 acceptance suite (M1–M26).
 *
 * Deterministic and offline: no LLM, no network, no wall clock, no random.
 * Proves the projection is a pure, bounded, domain-neutral read model over the
 * CURRENT main EpisodicMemoryRecordV0 shape.
 */

import { describe, expect, it } from "vitest";

import {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import type { LogicalTimeV0 } from "@characteros-next/subject-core";
const t = (n: number): LogicalTimeV0 => n as LogicalTimeV0;

import {
  ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY,
  logicalDecayFactor,
  MemoryInfluenceProjectionErrorV0,
  projectMemoryInfluence,
  projectMemoryInfluences,
  validateMemoryInfluencePolicy,
  type MemoryInfluencePolicyV0
} from "./index.js";

const EPISODE_A = "episode:b7a0d91e171ee47470324bc8bfe02ac2b307018f56b9e03e76d946298636c05d";
const EPISODE_B = "episode:c81e728d9d4c2f636f067f89cc14862c00000000000000000000000000000000";
const EPISODE_C = "episode:eccbc87e4b5ce2fe28308fd9f2a7baf30000000000000000000000000000000";

const POLICY = ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY;

interface RecordOverrides {
  readonly episode_ref?: string;
  readonly occurrence_logical_time?: number;
  readonly declared_score?: number;
  readonly scene?: string;
}

/** Build and VALIDATE a record against the frozen main record contract (M20). */
function makeRecord(overrides: RecordOverrides = {}): EpisodicMemoryRecordV0 {
  const draft = {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: overrides.episode_ref ?? EPISODE_A,
    occurrence_logical_time: overrides.occurrence_logical_time ?? 0,
    recorded_at_logical_time: overrides.occurrence_logical_time ?? 0,
    provenance: {
      transition_id: "t-learning-fixture",
      producer: "memory",
      cause_refs: []
    },
    references: [],
    context: {
      scene: overrides.scene ?? "fixture scene",
      focus_refs: [],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: {
      declared_score: overrides.declared_score ?? 0.8,
      source: SALIENCE_SOURCE_ENCODING_DECLARED
    }
  };
  const checked = validateEpisodicMemoryRecord(draft);
  if (!checked.ok) throw new Error(`fixture record invalid: ${checked.error.detail}`);
  return checked.value;
}

describe("MemoryInfluenceProjectionV0", () => {
  it("M1/M11/M13/M14: deterministic projection; exactly four domain-neutral keys; no invented legacy fields", () => {
    const record = makeRecord({ occurrence_logical_time: 5, declared_score: 0.6 });
    const a = projectMemoryInfluence(record, t(25), POLICY);
    const b = projectMemoryInfluence(record, t(25), POLICY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a).sort()).toEqual([
      "activation_strength",
      "age_logical",
      "decay_factor",
      "memory_ref"
    ]);
    // No personality_pressure / cluster_key / repetition / emotion fields.
    const serialized = JSON.stringify(a);
    for (const banned of [
      "personality",
      "cluster",
      "repetition",
      "emotion",
      "traits_seed",
      "belief",
      "relationship"
    ]) {
      expect(serialized.includes(banned)).toBe(false);
    }
  });

  it("M2/M15: input record is never mutated (frozen input accepted, JSON identical)", () => {
    const record = Object.freeze(makeRecord({ occurrence_logical_time: 3 }));
    const before = JSON.stringify(record);
    const projection = projectMemoryInfluence(record, t(30), POLICY);
    expect(JSON.stringify(record)).toBe(before);
    expect(projection.memory_ref).toBe(record.episode_ref);
  });

  it("M3/M16: projection exposes no repository/mutation surface and is repeatable", () => {
    const record = Object.freeze(makeRecord());
    const p = projectMemoryInfluence(record, t(1), POLICY);
    // Pure data projection: no methods, no handles, only the four contract keys.
    expect(Object.values(p).every((v) => typeof v !== "function")).toBe(true);
    // Frozen record ARRAY: sorting must not mutate caller input.
    const frozen = Object.freeze([Object.freeze(makeRecord()), Object.freeze(makeRecord({ episode_ref: EPISODE_B }))]) as readonly EpisodicMemoryRecordV0[];
    expect(() => projectMemoryInfluences(frozen, t(9), POLICY)).not.toThrow();
  });

  it("M4: age 0 handled correctly (decay factor exactly 1)", () => {
    const record = makeRecord({ occurrence_logical_time: 7 });
    const p = projectMemoryInfluence(record, t(7), POLICY);
    expect(p.age_logical).toBe(0);
    expect(p.decay_factor).toBe(1);
    expect(p.activation_strength).toBe(0.9); // 0.5*1 + 0.5*0.8
  });

  it("M5: positive logical age uses reference exponential decay over logical ticks", () => {
    const record = makeRecord({ occurrence_logical_time: 0, declared_score: 1 });
    const p = projectMemoryInfluence(record, t(10), POLICY);
    expect(p.age_logical).toBe(10);
    expect(p.decay_factor).toBe(0.7408); // round4(exp(-0.03*10))
    expect(p.activation_strength).toBe(0.8704); // round4(0.5*0.7408 + 0.5*1)
  });

  it("M6: negative logical age fails closed with typed error", () => {
    const record = makeRecord({ occurrence_logical_time: 5 });
    expect(() => projectMemoryInfluence(record, t(4), POLICY)).toThrow(
      MemoryInfluenceProjectionErrorV0
    );
    try {
      projectMemoryInfluence(record, t(4), POLICY);
      expect.unreachable();
    } catch (e) {
      expect((e as MemoryInfluenceProjectionErrorV0).code).toBe("NEGATIVE_LOGICAL_AGE");
    }
  });

  it("M7: decay is non-increasing with increasing logical age (reference policy)", () => {
    let previous = 1;
    for (let age = 0; age <= 200; age += 10) {
      const d = logicalDecayFactor(age, POLICY.baseDecayRate);
      expect(d).toBeLessThanOrEqual(previous);
      previous = d;
    }
  });

  it("M8: all outputs stay inside the declared [0,1] bounds across a policy/age/salience grid", () => {
    const policies: readonly MemoryInfluencePolicyV0[] = [
      POLICY,
      { baseDecayRate: 1, recencyWeight: 0, importanceWeight: 1 },
      { baseDecayRate: 0.001, recencyWeight: 1, importanceWeight: 0 },
      { baseDecayRate: 0.5, recencyWeight: 0.3, importanceWeight: 0.3 }
    ];
    for (const policy of policies) {
      for (const age of [0, 1, 5, 33, 100, 10000]) {
        for (const salience of [0, 0.25, 0.8, 1]) {
          const p = projectMemoryInfluence(
            makeRecord({ occurrence_logical_time: 0, declared_score: salience }),
            t(age),
            policy
          );
          expect(p.decay_factor).toBeGreaterThanOrEqual(0);
          expect(p.decay_factor).toBeLessThanOrEqual(1);
          expect(p.activation_strength).toBeGreaterThanOrEqual(0);
          expect(p.activation_strength).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("M9: equivalent independent records project equivalently", () => {
    const r1 = makeRecord({ occurrence_logical_time: 2, declared_score: 0.55 });
    const r2 = makeRecord({ occurrence_logical_time: 2, declared_score: 0.55 });
    expect(r1).not.toBe(r2);
    expect(JSON.stringify(projectMemoryInfluence(r1, t(40), POLICY))).toBe(
      JSON.stringify(projectMemoryInfluence(r2, t(40), POLICY))
    );
  });

  it("M10: deterministic ordering — activation desc, ties broken by memory_ref; input order has no authority", () => {
    const high = makeRecord({ episode_ref: EPISODE_A, declared_score: 1, occurrence_logical_time: 0 });
    const midB = makeRecord({ episode_ref: EPISODE_B, declared_score: 0.5 });
    const midC = makeRecord({ episode_ref: EPISODE_C, declared_score: 0.5 });
    const forward = projectMemoryInfluences([high, midB, midC], t(10), POLICY);
    const shuffled = projectMemoryInfluences([midC, high, midB], t(10), POLICY);
    const refsOf = (rs: readonly { memory_ref: string }[]) => rs.map((r) => r.memory_ref);
    expect(refsOf(forward)).toEqual(refsOf(shuffled));
    expect(refsOf(forward)).toEqual([EPISODE_A, EPISODE_B, EPISODE_C]);
  });

  it("M12: no free-text semantic inference — scene text changes never affect the projection", () => {
    const a = makeRecord({ scene: "person-x accepted the request" });
    const b = makeRecord({ scene: "totally different words entirely unrelated" });
    expect(JSON.stringify(projectMemoryInfluence(a, t(12), POLICY))).toBe(
      JSON.stringify(projectMemoryInfluence(b, t(12), POLICY))
    );
  });

  it("M17/M18/M19: empty, single, and multi record sets are all legal", () => {
    expect(projectMemoryInfluences([], t(5), POLICY)).toEqual([]);
    const one = projectMemoryInfluences([makeRecord()], t(5), POLICY);
    expect(one).toHaveLength(1);
    const many = projectMemoryInfluences(
      [makeRecord(), makeRecord({ episode_ref: EPISODE_B, declared_score: 0.2 }), makeRecord({ episode_ref: EPISODE_C, occurrence_logical_time: 4 })],
      t(9),
      POLICY
    );
    expect(many).toHaveLength(3);
  });

  it("M20: compatibility with the CURRENT main EpisodicMemoryRecordV0 contract is proven", () => {
    const draft = makeRecord({ occurrence_logical_time: 3, declared_score: 0.7 });
    // makeRecord already ran validateEpisodicMemoryRecord; re-assert explicitly:
    const checked = validateEpisodicMemoryRecord(draft);
    if (!checked.ok) throw new Error("record contract regression");
    const p = projectMemoryInfluence(checked.value, t(3), POLICY);
    expect(p.memory_ref).toBe(draft.episode_ref);
  });

  it("policy contract fails closed: unknown keys, out-of-range and non-numeric values rejected", () => {
    expect(validateMemoryInfluencePolicy(POLICY).ok).toBe(true);
    expect(
      validateMemoryInfluencePolicy({ ...POLICY, extra: 1 } as unknown).ok
    ).toBe(false);
    expect(validateMemoryInfluencePolicy({ baseDecayRate: 0, recencyWeight: 0.5, importanceWeight: 0.5 }).ok).toBe(false);
    expect(validateMemoryInfluencePolicy({ baseDecayRate: 1.5, recencyWeight: 0.5, importanceWeight: 0.5 }).ok).toBe(false);
    expect(validateMemoryInfluencePolicy({ baseDecayRate: 0.03, recencyWeight: 1.5, importanceWeight: 0.5 }).ok).toBe(false);
    expect(validateMemoryInfluencePolicy({ baseDecayRate: 0.03, recencyWeight: 0.5, importanceWeight: "x" } as unknown).ok).toBe(false);
  });

  it("M25/M26: no simulation authority — repeated calls are bit-identical and no retry loops exist", () => {
    const record = makeRecord({ occurrence_logical_time: 6, declared_score: 0.4 });
    const runs = [1, 2, 3].map(() => JSON.stringify(projectMemoryInfluence(record, t(60), POLICY)));
    expect(new Set(runs).size).toBe(1);
    // Batch projection over a frozen input is single-pass: identical result to
    // per-record projection concatenated and re-sorted by the same contract.
    const r2 = makeRecord({ episode_ref: EPISODE_B, occurrence_logical_time: 1 });
    const batch = projectMemoryInfluences([record, r2], t(60), POLICY);
    const manual = [projectMemoryInfluence(record, t(60), POLICY), projectMemoryInfluence(r2, t(60), POLICY)].sort(
      (a, b) =>
        b.activation_strength - a.activation_strength ||
        (a.memory_ref < b.memory_ref ? -1 : 1)
    );
    expect(JSON.stringify(batch)).toBe(JSON.stringify(manual));
  });
});
