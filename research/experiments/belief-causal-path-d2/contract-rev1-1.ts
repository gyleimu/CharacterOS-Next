/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1 — EXECUTION-SEMANTICS CLARIFICATION. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * Nothing about D2 is redesigned here. This file freezes three execution semantics that were
 * ambiguous in REVISION 1:
 *
 *   FIX 1  instrument qualification follows STAGE GATING — each instrument is qualified inside its
 *          own stage, never all three up front
 *   FIX 2  the call budget is recalculated per stage from that gating
 *   FIX 3  the D2-A1 claim scope is narrowed to the PREREGISTERED PARAPHRASE
 *
 * REVISION 1's machine-readable file is NOT modified; its manifest hash is preserved verbatim.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import {
  D2_BUDGET_REV1,
  D2_HASH_PROJECTION_V0,
  D2_REVISION_1_PROVENANCE,
  D2A1_PARAPHRASE
} from "./contract-rev1.ts";

export const D2_VERSION_REV1_1 = "belief-causal-path-localization-d2-rev1.1" as const;

/** REVISION 1's manifest hash, PRESERVED and never silently overwritten. */
export const D2_REVISION_1_MANIFEST_HASH =
  "sha256:af836f0ab074f91e513cc179c296c78ece3fe91a4e53566743fe228304e64afc" as const;

// =============================================================================================
// FIX 1 — STAGE-GATED QUALIFICATION
// =============================================================================================

export interface D2StageV0 {
  readonly stage: "A0" | "A1" | "B";
  readonly instrument: string;
  readonly qualification_calls: number;
  readonly unlocks_after_qualification: string;
  readonly unlocks_after_pilot: string;
  readonly unlocks_after_treatment: string;
}

/**
 * Frozen execution order. Each stage owns its own instrument qualification; an instrument is never
 * qualified before its stage begins, and no later stage's calls may be spent early.
 */
export const D2_STAGE_GATING_REV1_1 = Object.freeze({
  stage_order: ["A0", "A1", "B"] as const,
  all_three_instruments_qualified_up_front: false,
  each_stage_qualification_calls: 9,
  stages: [
    {
      stage: "A0" as const,
      instrument: "buildD2StructuralReadoutRequestV0",
      qualification_calls: 9,
      unlocks_after_qualification: "A0 neutral pilot (6 calls)",
      unlocks_after_pilot: "A0 HIGH/LOW treatment (2r_A0)",
      unlocks_after_treatment: "stage A1, and only if A0 reaches its frozen positive verdict"
    },
    {
      stage: "A1" as const,
      instrument: "buildD2SemanticReadoutRequestV0",
      qualification_calls: 9,
      unlocks_after_qualification: "A1 neutral pilot (6 calls)",
      unlocks_after_pilot: "A1 HIGH/LOW treatment (2r_A1)",
      unlocks_after_treatment: "stage B, and only if A1 reaches its frozen positive verdict"
    },
    {
      stage: "B" as const,
      instrument: "buildD2AppraisalRequestV0",
      qualification_calls: 9,
      unlocks_after_qualification: "B neutral pilot (6 calls)",
      unlocks_after_pilot: "B P1/P2 HIGH/LOW treatment (4r_B)",
      unlocks_after_treatment: "nothing further in D2"
    }
  ] satisfies readonly D2StageV0[],
  law: "a failed qualification ends the run; a failed pilot ends the stage; a null treatment result does NOT unlock the next stage",
  first_calls_authorised_in_the_next_round: "A0 instrument qualification, exactly 9 calls"
});

// =============================================================================================
// FIX 2 — RECALCULATED BUDGET
// =============================================================================================

export const D2_BUDGET_REV1_1 = Object.freeze({
  per_stage: {
    A0: { formula: "9 + 6 + 2r", r6: 27, r14: 43, r20: 55 },
    A1: { formula: "9 + 6 + 2r", r6: 27, r14: 43, r20: 55 },
    B: { formula: "9 + 6 + 4r", r6: 39, r14: 71, r20: 95 }
  },
  sequential_totals: {
    a0_fails_at_r6: 27,
    a0_passes_a1_fails_at_r6: 54,
    full_pipeline_all_pilots_perfect: 27 + 27 + 39,
    maximum_all_stages_r20: 55 + 55 + 95
  },
  minimum: 27,
  expected: 54,
  maximum: 205,
  /** REVISION 1's figures are VOID, not silently rewritten. */
  superseded_revision_1_figures: { minimum: D2_BUDGET_REV1.minimum, expected: D2_BUDGET_REV1.expected, maximum: D2_BUDGET_REV1.maximum },
  superseded_figures_voided: ["minimum 45", "expected 63"],
  maximum_unchanged: { value: 205, still_valid: true },
  why_minimum_changed:
    "REVISION 1 assumed all three instruments were qualified before stage A0; stage gating means a failure at A0 costs only that stage's 9 qualification calls, 6 pilot calls and 2r treatment calls, so the true floor is 27, not 45",
  d1_calls_reused: false
});

// =============================================================================================
// FIX 3 — NARROWED A1 CLAIM SCOPE
// =============================================================================================

export const D2A1_SCOPE_REV1_1 = Object.freeze({
  paraphrase_bytes_unchanged: D2A1_PARAPHRASE,
  additional_paraphrases_added: 0,
  what_the_probe_is: "a preregistered near-semantic-transfer probe from the canonical CAUTION proposition",
  calibration_statement:
    "it is semantically close to the canonical proposition but is NOT a logically exhaustive equivalent of `information I have not seen myself`",
  positive_verdict: "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE",
  null_interpretation:
    "semantic uptake was not established for the PREREGISTERED PARAPHRASE transfer",
  null_may_NOT_be_extended_to: [
    "the proposition is globally semantically unreadable",
    "the canonical proposition cannot be read in any formulation",
    "semantic uptake is absent in general"
  ],
  localization_matrix_breakpoint_remains: "representation -> proposition-semantic transfer",
  claim_scope_limitation_must_appear_in_the_final_report: true
});

// =============================================================================================
// Revision provenance
// =============================================================================================

export const D2_REVISION_1_1_PROVENANCE = Object.freeze({
  supersedes_scope: [
    "qualification scheduling",
    "call budget",
    "A1 claim scope",
    "documentation synchronization"
  ],
  does_not_supersede: [
    "the six-link causal graph",
    "the A0 / A1 split",
    "the three transformer identities",
    "per-endpoint neutral pilots",
    "the localization matrix",
    "the verdict vocabulary (one verdict string is narrowed, see D2A1_SCOPE_REV1_1)"
  ],
  d2_model_calls_before_amendment: 0,
  d1_untouched: true,
  revision_1_manifest_hash_preserved: D2_REVISION_1_MANIFEST_HASH,
  revision_1_file_modified: false,
  revision_1_provenance_carried_forward: D2_REVISION_1_PROVENANCE
});

export interface D2ManifestRev11V0 {
  readonly version: typeof D2_VERSION_REV1_1;
  readonly stage_gating: typeof D2_STAGE_GATING_REV1_1;
  readonly budget: typeof D2_BUDGET_REV1_1;
  readonly a1_scope: typeof D2A1_SCOPE_REV1_1;
  readonly provenance: typeof D2_REVISION_1_1_PROVENANCE;
  readonly manifest_hash: HashV1;
}

export async function deriveD2ManifestRev11V0(): Promise<D2ManifestRev11V0> {
  const body = {
    version: D2_VERSION_REV1_1,
    stage_gating: D2_STAGE_GATING_REV1_1,
    budget: D2_BUDGET_REV1_1,
    a1_scope: D2A1_SCOPE_REV1_1,
    provenance: D2_REVISION_1_1_PROVENANCE
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}
