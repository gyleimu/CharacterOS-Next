/**
 * P2.3.1 — RegulationProducerPort (DRAFT seam).
 *
 * Minimal deterministic regulation delta production for Time (and later
 * CognitionAction). No homeostasis model expansion, no canonical writes.
 */

import type { DomainDeltaV0, SubjectStateV0, TransitionType } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";

export interface RegulationProducerInputV0 {
  readonly context: RuntimeContext;
  readonly snapshot: SubjectStateV0;
  readonly transition_type: Extract<TransitionType, "Time" | "CognitionAction">;
}

export interface RegulationProducerPort {
  produceRegulationDelta(input: RegulationProducerInputV0): Promise<DomainDeltaV0>;
}
