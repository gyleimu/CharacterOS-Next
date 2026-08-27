/**
 * P2.3.4.2b — RegulationProducerPort (REGULATION_V0 reference seam).
 *
 * Closes the P2.3.1 DRAFT `OVERBROAD_PORT_SURFACE`: the producer input is a
 * closed least-privilege surface (contract
 * docs/implementation/p2-3-4-regulation-v0-reference-contract.md §4) — the full
 * `SubjectStateV0` MUST NOT be passed merely for convenience.
 *
 * Minimal deterministic regulation delta production for Time only.
 * CognitionAction regulation dynamics are DEFERRED (contract §5): if that scope
 * ever arrives, the input shape must be widened through a versioned contract,
 * never silently.
 *
 * No homeostasis model expansion, no canonical writes (SubjectCore stays the
 * sole canonical mutator; Producer != Mutator).
 */

import type { DomainDeltaV0, RegulatoryStateV0 } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";

/** Closed least-privilege intake (REGULATION_V0 contract §4): parameter-free. */
export interface RegulationProducerInputV0 {
  /** Narrow immutable read model: subject_id / current_logical_time / state_revision. */
  readonly context: RuntimeContext;
  /** Pre-transition authoritative RegulatoryStateV0 copy. */
  readonly regulation: RegulatoryStateV0;
  /** Canonical elapsed ticks of the enclosing Time transition (non-negative safe integer). */
  readonly elapsed_ticks: number;
}

export interface RegulationProducerPort {
  produceRegulationDelta(input: RegulationProducerInputV0): Promise<DomainDeltaV0>;
}
