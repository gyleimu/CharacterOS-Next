/**
 * PHASE0-RUN-3 CONTRACT.
 *
 * Run-3 is a NEW, INDEPENDENT EXECUTION of the SAME FROZEN SCIENTIFIC DESIGN. It reuses, verbatim:
 * the target proposition, baseline credence, trajectory A and B, the VALENCE_TABLE, event wording
 * and ordering, five scientific turns per arm, the predicted directions, the scorer, the invalid
 * policy and the stop rule. Nothing is re-derived and no stimulus is adjusted.
 *
 * In particular, run-1's partial observations (arm A tending to SUPPORTS, arm B producing
 * CONTRADICTS at its first differing event) did NOT influence any character of this design.
 */

import { R2_SCIENTIFIC_POLICY, R2_VERDICT_TOKENS } from "../rerun/contract-r2.ts";

// ---------------------------------------------------------------------------------------------
// §3 FRESH SUBJECTS — opaque, non-semantic, no arm information in the model-visible identifier
// ---------------------------------------------------------------------------------------------

/**
 * The frozen policy is `MODEL_VISIBLE_SUBJECT_ID_POLICY = OPAQUE_NON_SEMANTIC`: the production
 * cognition prompt renders `subject_id` (conversation-cognition-provider-v2.ts:256), so the
 * identifier must carry ZERO arm information. Both ids share a stem and differ only in a 4-digit
 * suffix with no order or valence meaning. Arm membership exists only in this file and in
 * experiment-side metadata.
 */
export const R3_SUBJECT_1_ID = "subject-r3-7p4n-2185";
export const R3_SUBJECT_2_ID = "subject-r3-7p4n-9047";
export const R3_QUAL_SUBJECT_ID = "subject-r3-2wq9-6631";
export const R3_SUBJECT_DISPLAY_NAME = "Wren";

/** Experiment-side only. Never model-visible. */
export const R3_ARM_MAPPING = Object.freeze({
  ARM_A: R3_SUBJECT_1_ID,
  ARM_B: R3_SUBJECT_2_ID
});
export const R3_LINEAGE_LABEL = Object.freeze({ ARM_A: "Alice-A-R3", ARM_B: "Alice-B-R3" });

/** Forbidden in any model-visible identity or request byte. */
export const R3_FORBIDDEN_MODEL_VISIBLE_TOKENS = Object.freeze([
  "arm a",
  "arm b",
  "positive",
  "negative",
  "trusted",
  "betrayed",
  "support",
  "contradict",
  "condition",
  "alice-a",
  "alice-b"
]);

// ---------------------------------------------------------------------------------------------
// §6 EXACT SCIENTIFIC SCHEDULE — distinct concepts, never merged
// ---------------------------------------------------------------------------------------------

export const R3_SCIENTIFIC_TURNS_PER_ARM = 5 as const;
export const R3_SCIENTIFIC_TURNS_PLANNED = 10 as const;
export const R3_BOOTSTRAP_OPERATIONS = 1 as const;

export const R3_ACCOUNTING_LAW =
  "scientific_subject_turn, runtime_operation, provider_attempt and bootstrap_operation are four DIFFERENT units and are never merged into one `turns` field. A bootstrap/admission operation carries scientific_turn = false and never enters the scientific denominator." as const;

// ---------------------------------------------------------------------------------------------
// §12/§13/§14 SCIENTIFIC POLICY — frozen in the remediation round, reused verbatim
// ---------------------------------------------------------------------------------------------

export const R3_SCIENTIFIC_POLICY = R2_SCIENTIFIC_POLICY;
export const R3_POLICY_PROVENANCE =
  "frozen in the run-2 round and reused verbatim; not re-derived, not relaxed, and not tightened. In particular the first invalid required turn ends the run INCONCLUSIVE and the other arm is NOT finished." as const;

// ---------------------------------------------------------------------------------------------
// §20/§22/§23 VERDICT TOKENS
// ---------------------------------------------------------------------------------------------

export const R3_VERDICT_TOKENS = Object.freeze({
  positive: R2_VERDICT_TOKENS.positive,
  valid_null: R2_VERDICT_TOKENS.valid_null,
  /** Round-specific inconclusive token, per the brief. */
  inconclusive: ["HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE"] as const
});

export const R3_EVIDENCE_LEVEL_BEFORE = "L1" as const;
export const R3_EVIDENCE_LEVEL_AFTER_POSITIVE = "L2" as const;
export const R3_EVIDENCE_LEVEL_CEILING = "L2" as const;

// ---------------------------------------------------------------------------------------------
// §21/§22 EXPLICIT NON-CLAIMS AND THE MEANING OF A POSITIVE
// ---------------------------------------------------------------------------------------------

export const R3_POSITIVE_MEANS =
  "under the frozen controlled trajectories, lived experience processed through the real production runtime produced the preregistered directional divergence in canonical persistent belief state" as const;

export const R3_FORBIDDEN_POSITIVE_CLAIMS = Object.freeze([
  "Alice has been shaped by life",
  "History Internalization is established",
  "state causes behaviour",
  "a cognition difference is established",
  "a decision difference is established",
  "the north star chain is complete"
]);

export const R3_WHY =
  "Experience -> State is only the FIRST critical edge of the North Star causal chain." as const;
