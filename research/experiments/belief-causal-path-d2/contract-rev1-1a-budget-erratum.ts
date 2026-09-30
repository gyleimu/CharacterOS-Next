/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1a — CALL-BUDGET ERRATUM. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * Scope: call-budget LABELS ONLY. The scientific design is unchanged — the causal graph, the
 * A0/A1/B contracts, the fixtures, the transformers, the qualification criteria, the neutral-pilot
 * rule, the r_confirm mapping, the localisation matrix, the verdict vocabulary and the claim scope
 * are all untouched.
 *
 * What was wrong in REVISION 1.1: the sequential figures were correct, but their LABELS conflated
 * three different stop points. "minimum 27" describes a path in which every A0 step succeeded, yet
 * a qualification failure is itself a legitimate stop and is therefore cheaper. The labels are
 * corrected here; the numbers are unchanged, and the superseded labels are recorded rather than
 * silently overwritten.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { D2_HASH_PROJECTION_V0 } from "./contract-rev1.ts";

export const D2_VERSION_REV1_1A = "belief-causal-path-localization-d2-rev1.1a" as const;

/** REVISION 1.1's manifest hash, PRESERVED and never silently overwritten. */
export const D2_REVISION_1_1_MANIFEST_HASH =
  "sha256:e3ff9366242d05d434addc038e0e92fa56ebf811525adb942cb426377250a63e" as const;

/** REVISION 1's hash, carried forward unchanged through both revisions. */
export const D2_REVISION_1_MANIFEST_HASH_CARRIED =
  "sha256:af836f0ab074f91e513cc179c296c78ece3fe91a4e53566743fe228304e64afc" as const;

// =============================================================================================
// FROZEN BUDGET VOCABULARY
// =============================================================================================

/**
 * Named stop points. Each name states WHICH STEPS SUCCEEDED, so a figure can never again be read
 * as "the cheapest possible run" when it actually describes a run that completed earlier stages.
 */
export const D2_BUDGET_VOCABULARY_REV1_1A = Object.freeze({
  /** A0 qualification fails: 9 qualification calls, nothing else is ever spent. */
  ABSOLUTE_MINIMUM: 9,
  /** A0 qualification passes, the A0 neutral pilot fails: 9 + 6. */
  A0_PILOT_STOP_MINIMUM: 15,
  /** A0 qualification and pilot both pass and the A0 state experiment runs to completion at r = 6: 9 + 6 + 12. */
  MINIMUM_COMPLETED_A0_STATE_EXPERIMENT: 27,
  /** A0 stage fully complete at r = 6, then A1 qualification fails: 27 + 9. */
  A1_QUALIFICATION_STOP_AFTER_A0_R6: 36,
  /** A0 stage fully complete, A1 qualification passes, the A1 pilot fails: 27 + 9 + 6. */
  A1_PILOT_STOP_AFTER_A0_R6: 42,
  /** A0 and A1 state experiments BOTH run to completion at r = 6 and A1's state result does not qualify: 27 + 27. */
  A0_AND_A1_STATE_EXPERIMENTS_COMPLETE_A1_NOT_QUALIFYING_R6: 54,
  /** A0 + A1 fully qualifying at r = 6, then B qualification fails: 54 + 9. */
  B_QUALIFICATION_STOP_AFTER_A0_A1_R6: 63,
  /** A0 + A1 fully qualifying, B qualification passes, the B pilot fails: 54 + 9 + 6. */
  B_PILOT_STOP_AFTER_A0_A1_R6: 69,
  /** Every stage qualifies and every state experiment completes, all pilots at modal_count = 6. */
  FULL_PIPELINE_ALL_R6: 93,
  /** Every stage at r = 20: 55 + 55 + 95. */
  ABSOLUTE_MAXIMUM: 205
});

/** Per-stage figures, unchanged from REVISION 1.1. */
export const D2_PER_STAGE_BUDGET_REV1_1A = Object.freeze({
  A0: { formula: "9 + 6 + 2r", r6: 27, r14: 43, r20: 55 },
  A1: { formula: "9 + 6 + 2r", r6: 27, r14: 43, r20: 55 },
  B: { formula: "9 + 6 + 4r", r6: 39, r14: 71, r20: 95 }
});

export const D2_BUDGET_CORRECTION_REV1_1A = Object.freeze({
  what_changed: "the LABELS attached to the sequential figures",
  what_did_not_change: [
    "every numeric figure",
    "the per-stage formulas",
    "the causal graph",
    "the A0 / A1 / B contracts",
    "the fixtures",
    "the transformers",
    "the qualification criteria",
    "the neutral pilot rule",
    "the r_confirm mapping",
    "the localisation matrix",
    "the verdict vocabulary",
    "the claim scope"
  ],
  superseded_labels: [
    { label: "minimum overall = 27", replaced_by: "MINIMUM_COMPLETED_A0_STATE_EXPERIMENT = 27", why: "it describes a path in which the A0 qualification and pilot both succeeded, so it is not the minimum" },
    { label: "A0 passes, A1 fails = 54", replaced_by: "A0_AND_A1_STATE_EXPERIMENTS_COMPLETE_A1_NOT_QUALIFYING_R6 = 54", why: "it did not say whether A1 failed at qualification, at the pilot, or at the state experiment" }
  ],
  absolute_minimum_derivation:
    "a qualification failure is itself a legitimate stop, so the cheapest possible D2 run is the A0 qualification alone: 3 state-blind fixtures x 3 replicates = 9 calls",
  design_changed: false,
  d2_model_calls_before_erratum: 0,
  d1_untouched: true,
  revision_1_1_manifest_hash_preserved: D2_REVISION_1_1_MANIFEST_HASH,
  revision_1_manifest_hash_preserved: D2_REVISION_1_MANIFEST_HASH_CARRIED,
  revisions_modified: false
});

export interface D2BudgetErratumV0 {
  readonly version: typeof D2_VERSION_REV1_1A;
  readonly vocabulary: typeof D2_BUDGET_VOCABULARY_REV1_1A;
  readonly per_stage: typeof D2_PER_STAGE_BUDGET_REV1_1A;
  readonly correction: typeof D2_BUDGET_CORRECTION_REV1_1A;
  readonly manifest_hash: HashV1;
}

export async function deriveD2BudgetErratumV0(): Promise<D2BudgetErratumV0> {
  const body = {
    version: D2_VERSION_REV1_1A,
    vocabulary: D2_BUDGET_VOCABULARY_REV1_1A,
    per_stage: D2_PER_STAGE_BUDGET_REV1_1A,
    correction: D2_BUDGET_CORRECTION_REV1_1A
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}
