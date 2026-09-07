/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — the v4 Time affect producer.
 * Tiny adapter over the PURE advanceAffectTimeV0: consumes the canonical
 * current affect + elapsed ticks, emits the canonical /affect replacement.
 * No Appraisal, no eligibility, no provider, no journal scanning.
 */

import type { DomainDeltaV0, CanonicalAffectV0, IdentifierV0 } from "@characteros-next/subject-core";
import { advanceAffectTimeV0 } from "@characteros-next/affect";
import type { CanonicalAffectTimeProducerPortV0 } from "../ports/canonical-affect-time-producer-port-v0.js";

export class BoundedAffectTimeProducerV0 implements CanonicalAffectTimeProducerPortV0 {
  async produceCanonicalAffectTimeDelta(input: {
    readonly current_affect: CanonicalAffectV0;
    readonly elapsed_ticks: number;
  }): Promise<DomainDeltaV0> {
    const next = advanceAffectTimeV0(input.current_affect, input.elapsed_ticks);
    return {
      producer: "affect" as IdentifierV0,
      domain: "affect",
      expected_repository_revision: null,
      operations: [
        { path: "/affect", value: next }
      ],
      provenance_refs: []
    };
  }
}
