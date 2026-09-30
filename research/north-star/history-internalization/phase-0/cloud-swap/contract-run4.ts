/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0, RUN-4 FROZEN CONTRACT (the swapped condition).
 *
 * Frozen BEFORE the first scientific call of the cloud condition. Nothing here may be revised after
 * that point without a REV amendment that says so in the open.
 *
 * WHAT RUN-4 IS: the SAME Phase-0 REV2 protocol, on the SAME frozen trajectories, with the SAME scorer
 * and predicate, executed on the SWAPPED executor (`EXECUTOR_SWAP_AMENDMENT.md`). The only scientific
 * inputs that differ from run-1/run-3 are the executor and — per rerun amendment §19 — the subject
 * identities, which must be fresh.
 *
 * WHAT IT IS NOT: it is not comparable to run-1/run-3, it does not re-open or overturn D1, and its
 * result is EXECUTOR-CONDITIONAL: a positive or a null is a statement about CharacterOS with
 * `deepseek-flash`, not about CharacterOS in general.
 *
 * Everything else is REUSED BY REFERENCE from `../contract.ts` (REV2). No trajectory text, budget,
 * predicate, scorer, threshold or proposition is restated here, because a second copy of a frozen value
 * is a second thing that can drift.
 */

import {
  P0_MAX_TOTAL_MODEL_CALLS,
  P0_QUALIFICATION_TURNS,
  P0_SCIENTIFIC_TURNS,
  P0_TOTAL_TURNS,
  P0_TURNS_PER_ARM
} from "../contract.ts";
import type { Phase0SubjectIdsV0 } from "../harness.ts";

// ---------------------------------------------------------------------------------------------
// §19 FRESH EXECUTION IDENTITY
// ---------------------------------------------------------------------------------------------

/**
 * Fresh identities for run-4. The §4 identity-leakage law is preserved: both ARM ids are opaque,
 * equal-length, non-semantic, share one stem, and differ only in a 4-digit suffix that carries no order
 * or valence meaning. The qualification subject uses a different stem, exactly as the frozen run did,
 * so a non-target subject is never confusable with an arm subject. Display name is the frozen one.
 */
export const P0_RUN4_SUBJECT_IDS: Phase0SubjectIdsV0 = Object.freeze({
  qualification: "subject-r4q7-6128",
  armA: "subject-r4h6-2903",
  armB: "subject-r4h6-7514",
  sessionQualification: "session-qualification-r4-0001",
  sessionA: "session-r4h6-2903-0001",
  sessionB: "session-r4h6-7514-0001"
});

/**
 * Identities that are CONSUMED and must never appear in run-4's bytes. `executed_leakage` keeps these
 * forbidden in every condition; this list exists so the audit's expectation is explicit.
 *
 * COMPLETENESS IS ENFORCED, NOT ASSERTED: `run4-contract.test.ts` derives the set of identities that
 * actually appear anywhere under `phase-0/evidence/` and requires every one of them to be listed here.
 * The first draft of this list named five ids when fifteen had been consumed — REV1's six single-turn
 * qualification subjects and run-2's and run-3's re-identified subjects were missing. That is exactly
 * the drift the derived check prevents from happening again.
 */
export const P0_RUN4_FORBIDDEN_INHERITED_IDS: readonly string[] = Object.freeze([
  // frozen run-1 identities
  "subject-k7q2-4103",
  "subject-k7q2-8267",
  "subject-q0v8-3319",
  // run-2 re-identified subjects
  "subject-r2-k7q2-4103",
  "subject-r2-k7q2-8267",
  "subject-r2-q0v8-3319",
  // run-3 fresh subjects
  "subject-r3-2wq9-6631",
  "subject-r3-7p4n-2185",
  "subject-r3-7p4n-9047",
  // REV1 single-turn contract-qualification subjects
  "subject-qcf-5213",
  "subject-qcf-7748",
  "subject-qcf-2091",
  "subject-qcf-8836",
  "subject-qcf-1457",
  "subject-qcf-6304"
]);

// ---------------------------------------------------------------------------------------------
// §19/§20 WHAT IS REUSED VERBATIM
// ---------------------------------------------------------------------------------------------

export const P0_RUN4_REUSED_BY_REFERENCE: Readonly<Record<string, string>> = Object.freeze({
  target_proposition: "P0_TARGET_PROPOSITION_ID / _LABEL — imported by the program from ../contract.ts",
  baseline_credence: "P0_BASELINE_CREDENCE",
  predicted_directions: "P0_PREDICTED_A_DIRECTION / _B_DIRECTION",
  turn_templates: "P0_TURN_TEMPLATES (rendered by renderPhase0TurnTextV0)",
  valence_table: "P0_VALENCE_TABLE",
  turns_per_arm: `P0_TURNS_PER_ARM (${String(P0_TURNS_PER_ARM)})`,
  schedule_shape: `${String(P0_QUALIFICATION_TURNS)} qualification + ${String(P0_SCIENTIFIC_TURNS)} scientific = ${String(P0_TOTAL_TURNS)} turns`,
  scorer: "scorePhase0V0",
  primary_predicate: "P0_PRIMARY_PREDICATE",
  invalid_policy: "P0_INCONCLUSIVE_CONDITIONS (unchanged; no retry, no substitution, no extension)",
  evidence_hierarchy: "P0_HIERARCHY_BEFORE -> AFTER_POSITIVE / AFTER_NULL (L1 -> L2 at most)",
  genesis: "buildPhase0SourceV0(subjectId) via ../fixtures.ts",
  family_budgets_and_timeouts: "CS_FAMILY_BUDGETS / CS_FAMILY_TIMEOUTS_MS from ./cloud-bundle.ts"
});

// ---------------------------------------------------------------------------------------------
// §22 BUDGET
// ---------------------------------------------------------------------------------------------

/** The same ceiling the REV2 contract froze for the run itself. */
export const P0_RUN4_MAX_TOTAL_MODEL_CALLS = P0_MAX_TOTAL_MODEL_CALLS;

/**
 * The executor-swap overhead that precedes run-4 and is NOT part of its scientific budget. Recorded so
 * the two are never conflated: qualification calls test the executor, not the hypothesis.
 */
export const P0_RUN4_SWAP_OVERHEAD_ALREADY_SPENT = Object.freeze({
  readiness_identity_requests: 1,
  readiness_probes: 3,
  contract_qualification_rev1_turns: 6,
  contract_qualification_rev2_turns: 6,
  scientific: false
});

// ---------------------------------------------------------------------------------------------
// §23 STOP RULES (frozen)
// ---------------------------------------------------------------------------------------------

export const P0_RUN4_STOP_RULES: readonly string[] = Object.freeze([
  "the in-run qualification turn is a pre-flight gate: if it does not reach COMPLETE with a lawful terminal, the round STOPS and no scientific turn runs",
  "any scientific turn that does not reach COMPLETE makes the run INCONCLUSIVE; there is no retry, no substitution and no extension",
  "the run executes exactly the frozen schedule; the turn count and order are never adjusted while running",
  "the post-state is frozen with `scored: false` BEFORE the scorer is run",
  "no request, prompt, scorer, predicate, timeout, budget or generation setting may change once the first scientific call is made"
]);

// ---------------------------------------------------------------------------------------------
// §21 FORBIDDEN CLAIMS (the ceiling is unchanged; these are the run-4-specific ones)
// ---------------------------------------------------------------------------------------------

export const P0_RUN4_FORBIDDEN_CLAIMS: readonly string[] = Object.freeze([
  "history internalization works",
  "the subject has been shaped by its life",
  "persistent belief influences cognition",
  "persistent belief influences decision or behaviour",
  "the CharacterOS north star is established",
  "personality or affect channels contribute",
  "run-4 is comparable to run-1 or run-3 (different executor condition)",
  "the local executor was the cause of the earlier inconclusive runs (not tested by run-4)",
  "the D1 null is overturned or re-opened (D1 is untouched; different executor condition)",
  "the swapped executor is contract-compliant in general (only the frozen non-target qualification was tested)"
]);
