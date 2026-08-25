/**
 * P2.3.1 — AppraisalPort (DRAFT seam; six-field AppraisalV0 arrives with the appraisal
 * package contract slice). Proposal-only: an appraisal NEVER produces deltas and never
 * touches canonical state.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import type { ControlledProjectionViewV0, InterpretationProposalDraftV0 } from "./interpretation-port.js";

/** DRAFT structured appraisal output — narrowed to AppraisalV0 by its owning package. */
export interface AppraisalProposalDraftV0 {
  readonly appraisal_ref: CanonicalRefV0;
}

export interface AppraisalPort {
  appraise(
    request: ControlledProjectionViewV0,
    interpretation: InterpretationProposalDraftV0
  ): Promise<AppraisalProposalDraftV0>;
}
