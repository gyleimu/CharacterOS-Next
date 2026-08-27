/**
 * P2.3.1 — AffectProducerPort (DRAFT seam).
 *
 * The FAST+EMA reference producer (P2.3.4) will implement this port. It receives the
 * authoritative read-only snapshot view plus the accepted appraisal draft and emits a
 * complete affect-domain delta (/mood + /affect). It NEVER commits and NEVER mutates
 * the snapshot; emotion theory stays out — this is an engineering bridge only.
 */

import type { DomainDeltaV0, SubjectStateV0, TransitionType } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { AppraisalProposalDraftV0 } from "./appraisal-port.js";

export interface AffectProducerInputV0 {
  readonly context: RuntimeContext;
  /** Authoritative immutable snapshot (read-only view; producers never mutate). */
  readonly snapshot: SubjectStateV0;
  readonly transition_type: Extract<TransitionType, "Time" | "Observation">;
  /** Accepted appraisal draft for Observation; null for Time evolution. */
  readonly appraisal: AppraisalProposalDraftV0 | null;
  /**
   * Canonical elapsed ticks of the enclosing Time transition (the proposal
   * `time_input` truth); null for Observation. The producer can never derive
   * elapsed from any other surface, so the DRAFT seam is closed here (P2.3.4.1).
   */
  readonly elapsed_ticks: number | null;
}

export interface AffectProducerPort {
  produceAffectDelta(input: AffectProducerInputV0): Promise<DomainDeltaV0>;
}
