/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — the v4 Time producer port.
 * Pure adapter between the v4 Time executor and the pure dynamics module:
 * input = CanonicalAffectV0 + elapsed_ticks; output = canonical /affect
 * replacement only. No Appraisal, no eligibility, no provider, no journal.
 */

import type { DomainDeltaV0 } from "@characteros-next/subject-core";
import type { CanonicalAffectV0 } from "@characteros-next/subject-core";

export interface CanonicalAffectTimeProducerPortV0 {
  /** Produces the canonical /affect replacement for one positive Time stage. */
  produceCanonicalAffectTimeDelta(input: {
    readonly current_affect: CanonicalAffectV0;
    readonly elapsed_ticks: number;
  }): Promise<DomainDeltaV0>;
}
