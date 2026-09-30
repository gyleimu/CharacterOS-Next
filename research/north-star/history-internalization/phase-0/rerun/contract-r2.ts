/**
 * HISTORY_INTERNALIZATION_V1_PHASE0_RERUN — frozen contract (R2).
 *
 * Frozen BEFORE the first provider call. Nothing here may be revised after the first call, and
 * nothing here is derived from run-1's observed pattern.
 *
 * This is a NEW INDEPENDENT EXECUTION of the SAME FROZEN SCIENTIFIC DESIGN. It is not a
 * continuation of run-1, and run-1's subjects, states, outputs and partial observations are not
 * reused, not re-scored and not admitted to any denominator.
 */

// ---------------------------------------------------------------------------------------------
// §1/§2 REMEDIATION CLAIMS — frozen wording
// ---------------------------------------------------------------------------------------------

export const R2_REMEDIATION_CLAIMS = Object.freeze({
  EXECUTOR_SCHEMA_INVALID: "UNFIXED_MODEL_RELIABILITY_RISK",
  FAIL_CLOSED_SESSION_POISONING: "CONTAINED_AND_RECOVERABLE_AT_HOST_LAYER",
  FAILED_TURN_TRANSACTIONAL_ROLLBACK: "NOT_ESTABLISHED",
  /**
   * Why the third token must stay NOT_ESTABLISHED: a FAILED turn CAN still change canonical
   * revision/state (measured: revision 6 → 10 across the failing stub turn). It is therefore
   * forbidden to claim that a failed turn leaves no state mutation.
   */
  forbidden_claim: "failed turn leaves no state mutation"
});

export const R2_HOST_CONTRACT_CLASSIFICATION = Object.freeze({
  classification: ["NOT_A_RUNTIME_CORE_CONTRACT_BUG", "HOST_CONTRACT_ENFORCEMENT_DEFECT"],
  runtime_obligation:
    "the FAILED branch states that the host must surface this and stop, or restore the last durable snapshot",
  prior_defect: "no host enforcement of that obligation existed",
  remedy: "RecoveredSessionV0 implements exactly that contract at the host layer",
  production_modified: false
});

// ---------------------------------------------------------------------------------------------
// §8 FRESH SUBJECTS
// ---------------------------------------------------------------------------------------------

/**
 * The brief names the fresh subjects `Alice-A-R2` / `Alice-B-R2`. Those literal identifiers are
 * NOT used as `subject_id`, and the reason is a measured production fact rather than a preference:
 * the cognition prompt renders `[identity] subject_id=...` (conversation-cognition-provider-v2.ts),
 * so `subject_id` IS model-visible. A bare `A`/`B` in a model-visible field is exactly the
 * arm-identifier exposure the frozen design forbids, and it would be a REGRESSION against run-1's
 * ids, which were deliberately opaque and non-semantic.
 *
 * The brief's intent is preserved: these are fresh R2-lineage subjects, distinct from run-1's,
 * with a shared `r2` lineage marker and no reuse of run-1 identities. Only the arm letter is
 * replaced by a non-semantic suffix, so the exposed identifier still carries ZERO arm information.
 */
export const R2_SUBJECT_A_ID = "subject-r2-k7q2-4103";
export const R2_SUBJECT_B_ID = "subject-r2-k7q2-8267";
export const R2_SUBJECT_DISPLAY_NAME = "Wren";
/** Non-model-visible lineage labels, for human-facing reports only. */
export const R2_LINEAGE_LABEL_A = "Alice-A-R2";
export const R2_LINEAGE_LABEL_B = "Alice-B-R2";
export const R2_QUAL_SUBJECT_ID = "subject-r2-q0v8-3319";
export const RUN1_SUBJECT_IDS = Object.freeze(["subject-k7q2-4103", "subject-k7q2-8267", "subject-q0v8-3319"]);

// ---------------------------------------------------------------------------------------------
// §12 EXACT SCIENTIFIC SCHEDULE
// ---------------------------------------------------------------------------------------------

/**
 * Separate concepts, never merged into one vague "turns" number:
 *   - REQUIRED SCIENTIFIC SUBJECT TURNS = 10 (arm A 5 + arm B 5)
 *   - the qualification turn is a NON-SCIENTIFIC bootstrap operation, counted separately
 */
export const R2_SCIENTIFIC_TURNS_PER_ARM = 5 as const;
export const R2_REQUIRED_SCIENTIFIC_TURNS = 10 as const;
export const R2_QUALIFICATION_TURNS = 1 as const;
export const R2_NON_SCIENTIFIC_BOOTSTRAP_TURNS = R2_QUALIFICATION_TURNS;

// ---------------------------------------------------------------------------------------------
// §3/§4/§17 SCIENTIFIC POLICY (overrides engineering recoverability)
// ---------------------------------------------------------------------------------------------

export const R2_INVALID_TRIGGERS = Object.freeze([
  "a required scientific turn reports FAILED",
  "a required scientific turn reports DEGRADED",
  "an executor schema/semantics rejection occurs on a required scientific turn",
  "a transport or provider failure occurs on a required scientific turn",
  "a required result is missing from a required scientific turn",
  "any frozen invalid policy condition is met"
]);

export const R2_SCIENTIFIC_POLICY = Object.freeze({
  law: "ENGINEERING RECOVERABILITY IS NOT SCIENTIFIC RECOVERABILITY",
  on_invalid:
    "the current scientific run immediately becomes INCONCLUSIVE; no restore-and-continue, no retry, no turn replacement, no event replay, no continued later trajectory turns for scoring, no increase of N",
  even_though_recoverable:
    "RecoveredSessionV0 can technically restore the session; the scientific run still stops",
  quarantine_token: "SCIENTIFICALLY_QUARANTINED_AFTER_INVALID_TURN",
  quarantined_state_may_not_enter: [
    "canonical post-state endpoint",
    "state-delta scorer",
    "arm-divergence scorer",
    "restart persistence evidence",
    "Phase-0 positive predicate",
    "downstream Phase-1 authorisation"
  ],
  quarantined_state_may_be_used_as: "diagnostic evidence only",
  do_not_finish_the_other_arm:
    "once the frozen protocol's complete paired contrast has become impossible, STOP; completing the other arm merely to collect more data is forbidden"
});

// ---------------------------------------------------------------------------------------------
// §21/§22/§23 VERDICT TOKENS
// ---------------------------------------------------------------------------------------------

export const R2_VERDICT_TOKENS = Object.freeze({
  positive: ["LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED", "HISTORY_INTERNALIZATION_V1_PHASE_1_AUTHORISED", "HISTORY_INTERNALIZATION_NOT_YET_ESTABLISHED"],
  valid_null: ["HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED"],
  inconclusive: ["HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_INCONCLUSIVE"]
});

export const R2_HIERARCHY_AFTER_POSITIVE = "L2" as const;
export const R2_HIERARCHY_CEILING = "L2" as const;

export const R2_EXPLICIT_NON_CLAIMS = Object.freeze([
  "that persistent belief alters cognition in a new scenario with the history removed (L3)",
  "that it alters decision or behaviour (L4; D1 measured a null on an authored difference)",
  "that it survives restart (L5)",
  "that it separates from a summary baseline (L6)",
  "that the subject has been shaped by its life, or that history internalization works",
  "that a failed turn leaves no state mutation (it can, and does)",
  "that the executor schema-invalid risk is fixed (it is not)",
  "anything about the model's own dispositions: the LLM is an executor; the subject is the canonical state"
]);

// ---------------------------------------------------------------------------------------------
// §11 MODEL-FACING INVARIANCE
// ---------------------------------------------------------------------------------------------

export const R2_MODEL_FACING_INVARIANCE = Object.freeze({
  structured_output_constraint_added: false,
  schema_changed: false,
  prompt_changed: false,
  reminder_added: false,
  retry_added: false,
  semantic_repair_added: false,
  provider_changed: false,
  model_changed: false,
  note:
    "the run-1 executor schema failure is known, and NOTHING is changed in response to it. No constraint mode is switched on, no schema or prompt is edited, no reminder or retry or repair is added."
});
