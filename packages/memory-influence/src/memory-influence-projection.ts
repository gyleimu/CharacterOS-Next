/**
 * MemoryInfluenceProjectionV0 — domain-neutral, read-only influence projection
 * over immutable EpisodicMemoryRecordV0 content.
 *
 * Provenance: adapted from the legacy reference implementation
 * (research/legacy-characteros/memory/memory-influence-projection.ts,
 * ENGINEERING_REFERENCE_V0), rebuilt around the CURRENT main memory record
 * shape. The legacy pipeline ended at personality mutation; this projection
 * STOPS at read-only signals — future consumers (Personality/Belief/
 * Relationship producers, salience systems) decide what, if anything, moves.
 *
 * Legacy input availability matrix (task §6):
 *   logical_timestamp            → AVAILABLE_DIRECTLY           (occurrence_logical_time)
 *   declared_importance          → AVAILABLE_DIRECTLY           (salience.declared_score)
 *   repetition_count             → UNAVAILABLE → omitted from V0 (records carry no repetition field)
 *   emotion_label / emotion bonus→ UNAVAILABLE → omitted from V0 (affect_snapshot_ref is a pointer only)
 *   personality_relevance_vector → UNAVAILABLE + FORBIDDEN      (domain-neutral contract, task §7)
 *   associated_cluster_key       → UNAVAILABLE → omitted from V0 (no cluster concept in V0)
 *
 * Activation semantics (narrow, task §10): a deterministic READ-TIME influence
 * weight derived from immutable record metadata, logical age, and the explicit
 * policy. It is NOT importance truth, emotional truth, personality truth, or
 * belief truth. No LLM, no wall clock, no free-text inference.
 *
 * The projection never mutates records, the repository, MemoryState, or
 * SubjectState, and exposes no repository APIs.
 */

import type { EpisodeRef, EpisodicMemoryRecordV0 } from "@characteros-next/memory";
import type { LogicalTimeV0, UnitIntervalV0 } from "@characteros-next/subject-core";

import type { MemoryInfluencePolicyV0 } from "./memory-influence-policy.js";

/** Domain-neutral read-only influence projection of one episodic record. */
export interface MemoryInfluenceProjectionV0 {
  /** Content-addressed ref of the projected record (verbatim passthrough). */
  readonly memory_ref: EpisodeRef;
  /** Logical ticks since occurrence; integer >= 0 (negative input fails closed). */
  readonly age_logical: number;
  /** Exponential recency decay factor over logical age, [0, 1]. 1 at age 0. */
  readonly decay_factor: UnitIntervalV0;
  /** Deterministic read-time activation weight, [0, 1]. NOT a truth claim. */
  readonly activation_strength: UnitIntervalV0;
}

export class MemoryInfluenceProjectionErrorV0 extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "MemoryInfluenceProjectionErrorV0";
    this.code = code;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Exponential recency decay over logical age (Ebbinghaus-form reference
 * function; ENGINEERING_REFERENCE_V0 — not psychological truth).
 * Same algorithm as the legacy reference: value x exp(-rate x age).
 */
export function logicalDecayFactor(ageLogical: number, baseDecayRate: number): UnitIntervalV0 {
  if (ageLogical <= 0) return 1 as UnitIntervalV0;
  return round4(clamp01(Math.exp(-baseDecayRate * ageLogical))) as UnitIntervalV0;
}

/**
 * Project the read-only influence of one immutable episodic record at a given
 * canonical logical time. Pure function — the record is never modified.
 * Negative logical age fails closed (time semantics: records cannot occur in
 * the future relative to the querying tick).
 */
export function projectMemoryInfluence(
  record: EpisodicMemoryRecordV0,
  currentLogicalTime: LogicalTimeV0,
  policy: MemoryInfluencePolicyV0
): MemoryInfluenceProjectionV0 {
  const age = currentLogicalTime - record.occurrence_logical_time;
  if (!Number.isSafeInteger(age) || age < 0) {
    throw new MemoryInfluenceProjectionErrorV0(
      "NEGATIVE_LOGICAL_AGE",
      `record ${record.episode_ref}: current logical time ${String(
        currentLogicalTime
      )} precedes occurrence ${String(record.occurrence_logical_time)}`
    );
  }
  const decayFactor = logicalDecayFactor(age, policy.baseDecayRate);
  const activation = round4(
    clamp01(decayFactor * policy.recencyWeight + record.salience.declared_score * policy.importanceWeight)
  );
  return {
    memory_ref: record.episode_ref,
    age_logical: age,
    decay_factor: decayFactor,
    activation_strength: activation as UnitIntervalV0
  };
}

/**
 * Project many records with deterministic output ordering: activation_strength
 * descending, ties broken by raw-ASCII ascending memory_ref. No iteration-order
 * authority: the input array order never affects the output order.
 */
export function projectMemoryInfluences(
  records: readonly EpisodicMemoryRecordV0[],
  currentLogicalTime: LogicalTimeV0,
  policy: MemoryInfluencePolicyV0
): readonly MemoryInfluenceProjectionV0[] {
  return records
    .map((r) => projectMemoryInfluence(r, currentLogicalTime, policy))
    .sort((a, b) => {
      if (b.activation_strength !== a.activation_strength) {
        return b.activation_strength - a.activation_strength;
      }
      return a.memory_ref < b.memory_ref ? -1 : a.memory_ref > b.memory_ref ? 1 : 0;
    });
}
