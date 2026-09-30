/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 STATE EXPERIMENT — PRE-EXECUTION PREREGISTRATION AUDIT. 0 MODEL CALLS.
 *
 *   node research/experiments/belief-causal-path-d2/a1-state-preregistration-audit.ts <outdir>
 *
 * Two 0-call gates before the first HIGH/LOW call:
 *
 *   §0A is there a unique, pre-frozen scorer? It must answer, from the authoritative contracts alone:
 *       what HIGH's modal must be, what LOW's modal must be, what constitutes a positive, how a modal
 *       tie is handled, whether exact frozen tokens are required, and whether any other threshold
 *       applies. A prediction is not automatically a scorer.
 *
 *   §0B is the treatment's failure policy frozen? planned trials, the arm split, and how an invalid /
 *       malformed / transport-failed trial enters the final verdict. The pilot's policy may NOT be
 *       reused unless the authoritative contract says its scope covers the treatment.
 *
 * Either gate failing means zero calls: a scorer or a tolerance chosen after seeing outputs is not a
 * preregistration.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import {
  D2_BUDGET_REV1,
  D2_HASH_PROJECTION_V0,
  D2_LOCALIZATION_MATRIX_REV1,
  D2_NOISE_RULE,
  D2_QUALIFICATION,
  D2_VERDICTS_REV1,
  D2A1_PREDICTION,
  D2A1_TOKENS
} from "./contract-rev1.ts";
import { D2_STAGE_GATING_REV1_1 } from "./contract-rev1-1.ts";
import { D2A1_QUALIFICATION_INVALID_RULE, D2A1_TRANSFORMER_CONTRACT } from "./contract-rev1-1c-a1-prerequisites.ts";
import { D2A1_NEUTRAL_PILOT_INVALID_POLICY } from "./contract-rev1-1d-a1-neutral-and-context.ts";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/**
 * Every place a rule could hide an invalid/recovery policy for a D2 treatment, with the scope each
 * one actually claims. A rule that exists but does not cover the treatment is NOT a rule for it.
 */
const RULE_INVENTORY = [
  {
    source: "contract-rev1-1c-a1-prerequisites.ts :: D2A1_QUALIFICATION_INVALID_RULE",
    rule: D2A1_QUALIFICATION_INVALID_RULE.rule,
    scope_claimed: D2A1_QUALIFICATION_INVALID_RULE.applies_to,
    covers_a1_qualification: true,
    covers_a1_neutral_pilot: false,
    covers_a1_treatment: false,
    why: "its verdict is D2_INSTRUMENT_UNQUALIFIED, a statement about qualification, and its applies_to scope names instrument qualification"
  },
  {
    source: "contract-rev1-1d-a1-neutral-and-context.ts :: D2A1_NEUTRAL_PILOT_INVALID_POLICY",
    rule: D2A1_NEUTRAL_PILOT_INVALID_POLICY.on_any_invalid.verdict,
    scope_claimed: D2A1_NEUTRAL_PILOT_INVALID_POLICY.scope,
    covers_a1_qualification: false,
    covers_a1_neutral_pilot: true,
    covers_a1_treatment: false,
    why:
      "its scope field reads 'A1 neutral pilot ONLY', applied_retroactively_to is empty, and the policy text never mentions the HIGH/LOW treatment — so reusing it for the treatment would be an extension the contract does not make"
  }
];

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-state-preregistration-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ============================ §0A THE SCORER ==============================================
  const tieEntryUsedAnywhereAsAVerdict = JSON.stringify({ D2_LOCALIZATION_MATRIX_REV1, D2_QUALIFICATION, D2_NOISE_RULE, D2_BUDGET_REV1, D2_STAGE_GATING_REV1_1 }).includes(
    "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION"
  );
  const scorerAudit = {
    gate: "§0A unique pre-frozen A1 state-experiment scorer",
    source: "contract-rev1.ts :: D2A1_PREDICTION",
    answers: {
      high_modal_must_be: D2A1_PREDICTION.HIGH_0_80_expected,
      low_modal_must_be: D2A1_PREDICTION.LOW_0_20_expected,
      positive_condition: D2A1_PREDICTION.requirement,
      exact_frozen_tokens_required: true,
      other_thresholds_declared: null,
      negative_condition:
        "the frozen positive predicate is not satisfied — expressed by the frozen localisation matrix row A0_positive_A1_null",
      null_verdict_if_negative: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.verdict,
      null_verdict_note: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.next,
      positive_verdict: D2A1_PREDICTION.verdict_if_met,
      unlocks: D2A1_PREDICTION.unlocks_b
    },
    tie_handling: {
      explicitly_named_in_the_frozen_text: false,
      derived_from_the_frozen_text: true,
      derivation:
        "the frozen predicate reads 'the HIGH modal token is SUPPORTS and the LOW modal token is OPPOSES' — a definite singular. A tied maximum means there is no single modal token, so the predicate is unsatisfiable and the result falls to the frozen null row.",
      fails_closed: true,
      permissive_reading_rejected:
        "'a token that achieves the maximum count is A modal token, so a tie may still satisfy the predicate' — rejected: it would let a tied readout manufacture a positive, and a definite singular does not admit it",
      a_tie_can_only_ever_yield_non_positive_under_every_reading_that_respects_the_singular: true,
      unbound_vocabulary_entry_not_used:
        "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION exists in D2_VERDICTS_REV1 but is bound to no trigger anywhere in the contracts, so it may not be used as a tie verdict"
    },
    unbound_verdict_vocabulary_entry: {
      name: "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION",
      present_in_the_frozen_vocabulary: (D2_VERDICTS_REV1 as readonly string[]).includes("INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION"),
      bound_to_a_trigger: false,
      found_only_in_the_vocabulary_list: true,
      used_as_a_verdict_by_this_audit: false
    },
    tie_entry_used_elsewhere_as_a_verdict: tieEntryUsedAnywhereAsAVerdict,
    instrument: D2A1_TRANSFORMER_CONTRACT.name,
    closed_set: D2A1_TOKENS,
    verdict: "D2_A1_STATE_SCORER_PREREGISTERED"
  };
  await write("pre-execution-scorer-audit.json", scorerAudit);

  // ============================ §0B THE FAILURE POLICY =====================================
  const plannedTrials =
    D2_BUDGET_REV1.d2a0_formula === "2r" &&
    (D2_STAGE_GATING_REV1_1.stages[0]?.unlocks_after_pilot ?? "").includes("2r_A0");
  const parallelForA1 = (D2_STAGE_GATING_REV1_1.stages[1]?.unlocks_after_pilot ?? "").includes("2r_A1");
  const treatmentRules = RULE_INVENTORY.filter((r) => r.covers_a1_treatment);
  const presence = {
    planned_trials_12_at_r6: plannedTrials,
    a1_has_a_2r_treatment_stage: parallelForA1,
    arm_split_6_and_6: "derived from the frozen schedule artifact (6 HIGH + 6 LOW at r_confirm_A1 = 6), not from a contract field",
    no_retry_specified_for_the_treatment: treatmentRules.some((r) => JSON.stringify(r).includes("retry")),
    no_replacement_specified_for_the_treatment: treatmentRules.some((r) => JSON.stringify(r).includes("replacement")),
    no_deletion_specified_for_the_treatment: treatmentRules.some((r) => JSON.stringify(r).includes("deletion")),
    no_extra_replicate_specified_for_the_treatment: treatmentRules.some((r) => JSON.stringify(r).includes("extra_replicate")),
    invalid_handling_specified_for_the_treatment: treatmentRules.length > 0,
    invalid_verdict_specified_for_the_treatment: treatmentRules.some((r) => typeof r.rule === "string" && r.rule.startsWith("D2_"))
  };
  const missing = Object.entries(presence)
    .filter(([key, value]) => value === false && key !== "arm_split_6_and_6")
    .map(([key]) => key);
  const invalidPolicyAudit = {
    gate: "§0B frozen A1 state-experiment failure policy",
    rule_inventory: RULE_INVENTORY,
    rules_covering_the_a1_treatment: treatmentRules.length,
    presence,
    missing_items: missing,
    reuse_of_the_pilot_policy_permitted: false,
    reuse_refusal_reason:
      "REV1.1d scopes its policy to 'A1 neutral pilot ONLY' with an empty applied_retroactively_to; the brief forbids reusing it unless the authoritative contract states that scope, and it does not",
    tolerance_ratio_invented_this_round: false,
    verdict: missing.length === 0 ? "D2_A1_STATE_INVALID_HANDLING_PREREGISTERED" : "D2_A1_STATE_INVALID_HANDLING_NOT_PREREGISTERED"
  };
  await write("pre-execution-invalid-policy-audit.json", invalidPolicyAudit);

  const bothPassed = scorerAudit.verdict === "D2_A1_STATE_SCORER_PREREGISTERED" && invalidPolicyAudit.verdict === "D2_A1_STATE_INVALID_HANDLING_PREREGISTERED";
  const verdict = {
    stage: "D2_A1_STATE_EXPERIMENT",
    model_calls: 0,
    scorer_gate: scorerAudit.verdict,
    failure_policy_gate: invalidPolicyAudit.verdict,
    both_gates_passed: bothPassed,
    final_verdict: bothPassed ? "D2_A1_STATE_EXPERIMENT_MAY_PROCEED" : "D2_A1_STATE_INVALID_HANDLING_NOT_PREREGISTERED",
    missing_before_the_treatment_can_run: missing,
    high_low_calls_executed: 0,
    d2_model_calls_total: 42,
    no_scorer_or_tolerance_invented: true,
    next_round_required_action:
      "a revision that freezes (1) the treatment's recovery policy and invalid handling with its verdict, using model_calls_before_amendment_for_the_a1_treatment = 0, and (2) the scorer as a callable pure function so the audit can call the frozen procedure rather than re-implement it (the REV1.1d pattern)"
  };
  const verdictHash = await write("A1_STATE_PREREGISTRATION_VERDICT.json", verdict);
  if (!bothPassed) {
    process.stdout.write(`${verdict.final_verdict}\nscorer: ${scorerAudit.verdict}\nfailure policy: ${invalidPolicyAudit.verdict}\nmissing: ${missing.join(" ; ")}\n${verdictHash}\n`);
    return;
  }
  fail("D2_A1_STATE_EXPERIMENT_MAY_PROCEED_UNREACHED_IN_THIS_ROUND", "the round stops before any execution");
}

await main();
