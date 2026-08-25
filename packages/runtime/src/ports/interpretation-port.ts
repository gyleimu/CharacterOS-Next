/**
 * P2.3.1 — InterpretationPort (DRAFT seam; proposal-only, fixed providers in P2.3).
 *
 * Stage authority (p2-runtime-plan §8.2): Interpretation MAY be a proposal provider;
 * in P2.3 it is a FIXED deterministic provider — never a live LLM. Its proposal payload
 * schema lands with the appraisal-package contract slice; this port freezes only the
 * wiring shape: controlled projection view in, draft proposal out.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import type { MemoryRetrievalResultV0 } from "@characteros-next/memory";

/** Minimum controlled read-model handed to interpretation (§8.3 subset). */
export interface ControlledProjectionViewV0 {
  /** Content-addressed pointer of the assembled projection. */
  readonly projection_ref: CanonicalRefV0;
  /** Retrieval evidence the projection was allowed to cite. */
  readonly retrieval_result: MemoryRetrievalResultV0;
  /** Current canonical scene label (refs-only view; never a SubjectState dump). */
  readonly context_scene: string;
}

/** DRAFT interpretation output — schema finalizes with the appraisal package slice. */
export interface InterpretationProposalDraftV0 {
  readonly interpretation_ref: CanonicalRefV0;
}

export interface InterpretationPort {
  interpret(request: ControlledProjectionViewV0): Promise<InterpretationProposalDraftV0>;
}
