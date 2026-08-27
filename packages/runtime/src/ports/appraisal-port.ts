/**
 * P2.3.1/P2.3.3 (P0-6 §19 remediated) — AppraisalPort with the frozen SIX-FIELD
 * AppraisalV0. Proposal-only: an appraisal NEVER produces deltas and never touches
 * canonical state. No relationship_significance, no emotion label, no unapproved
 * fields (freeze §19/§20 and p2-runtime-plan §8.2 stage matrix).
 */

import type { CanonicalRefV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import type { ControlledProjectionViewV0, InterpretationProposalDraftV0 } from "./interpretation-port.js";

/**
 * P2.3.5.0b — Attribution representation per the committed semantic resolution
 * (docs/implementation/p2-3-5-appraisal-attribution-resolution.md, commit aa2847a):
 * DOMINANT ATTRIBUTION LOCUS — closed categorical enum. The retired numeric
 * representation (`UnitIntervalV0`) carries NO committed mapping to these
 * literals and MUST NOT be reintroduced or aliased (no coercion, no trimming,
 * no lowercasing, no aliases). A TypeScript union alone is not the trust
 * boundary: runtime fail-closed validation lives at the provider boundary.
 */
export type AppraisalAttributionV0 = "self" | "other" | "situation";

/**
 * AppraisalV0 — exactly the six frozen fields (p1-5 acceptance contract §26
 * field list; P2.3.5.0a categorical attribution resolution): relevance,
 * goal_congruence, attribution, controllability, uncertainty, intensity.
 * Five dimensions are `UnitIntervalV0`; `attribution` is the closed
 * categorical locus enum above. `appraisal_ref` is the deterministic evidence
 * pointer and `evidence_refs` must ⊆ the allowed evidence set (A4.3).
 */
export interface AppraisalProposalDraftV0 {
  readonly schema_version: "appraisal-v0";
  readonly appraisal_ref: CanonicalRefV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly relevance: UnitIntervalV0;
  readonly goal_congruence: UnitIntervalV0;
  readonly attribution: AppraisalAttributionV0;
  readonly controllability: UnitIntervalV0;
  readonly uncertainty: UnitIntervalV0;
  readonly intensity: UnitIntervalV0;
}

export interface AppraisalPort {
  appraise(
    request: ControlledProjectionViewV0,
    interpretation: InterpretationProposalDraftV0
  ): Promise<AppraisalProposalDraftV0>;
}
