/**
 * InfluenceEvidenceAggregateV0 — domain-neutral quantitative shape of an
 * explicit multi-memory evidence set.
 *
 * Authority layering (frozen):
 *   EpisodicMemoryRecord → MemoryInfluenceProjectionV0 → THIS aggregation.
 * This package consumes frozen MemoryInfluenceProjectionV0 records ONLY; it
 * never recomputes decay and never re-reads episodic records.
 *
 * NO AUTOMATIC GROUPING (V0 boundary): the caller supplies the exact evidence
 * set; this package never decides what memories "mean" or which domain they
 * belong to. Membership selection belongs to future domain-specific producers.
 * Pure producer/read model: no repository, SubjectState, SubjectCore, canonical
 * transition, revision, or trace surface of any kind.
 */

import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";

export class InfluenceEvidenceErrorV0 extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "InfluenceEvidenceErrorV0";
    this.code = code;
  }
}

export interface InfluenceEvidenceAggregateV0 {
  /** Exact members used; deterministic raw-ASCII ascending order. No hidden/dropped/synthetic refs. */
  readonly member_refs: readonly string[];
  readonly member_count: number;
  /** Raw accumulated activation; MAY exceed 1 (no implicit saturation in V0). */
  readonly total_activation: number;
  /** [0, 1]. */
  readonly mean_activation: number;
  /** [0, 1]. */
  readonly max_activation: number;
  /** [0, 1]. */
  readonly min_activation: number;
  /** Largest member age_logical (0 for empty set). */
  readonly oldest_age_logical: number;
  /** Smallest member age_logical (0 for empty set). */
  readonly newest_age_logical: number;
  /** oldest − newest member age span (0 for empty/single-member sets). */
  readonly logical_span: number;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Aggregate the exact supplied projection set into quantitative metrics.
 * Duplicate memory_ref input fails closed (DUPLICATE_MEMORY_REF).
 * Empty input is a legal aggregate with member_count = 0 and zero metrics
 * (no synthetic refs). Input projections are never mutated; input iteration
 * order never affects the result (member_refs are canonically re-sorted).
 */
export function aggregateInfluenceEvidence(
  projections: readonly MemoryInfluenceProjectionV0[]
): InfluenceEvidenceAggregateV0 {
  const seen = new Set<string>();
  for (const p of projections) {
    if (seen.has(p.memory_ref)) {
      throw new InfluenceEvidenceErrorV0(
        "DUPLICATE_MEMORY_REF",
        `memory_ref ${p.memory_ref} appears more than once in the evidence set`
      );
    }
    seen.add(p.memory_ref);
  }
  const memberRefs = projections
    .map((p) => p.memory_ref)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (projections.length === 0) {
    return {
      member_refs: [],
      member_count: 0,
      total_activation: 0,
      mean_activation: 0,
      max_activation: 0,
      min_activation: 0,
      oldest_age_logical: 0,
      newest_age_logical: 0,
      logical_span: 0
    };
  }
  const activations = projections.map((p) => p.activation_strength);
  const total = round4(activations.reduce((s, a) => s + a, 0));
  const ages = projections.map((p) => p.age_logical);
  const oldest = Math.max(...ages);
  const newest = Math.min(...ages);
  return {
    member_refs: memberRefs,
    member_count: projections.length,
    total_activation: total,
    mean_activation: round4(total / projections.length),
    max_activation: round4(Math.max(...activations)),
    min_activation: round4(Math.min(...activations)),
    oldest_age_logical: oldest,
    newest_age_logical: newest,
    logical_span: oldest - newest
  };
}
