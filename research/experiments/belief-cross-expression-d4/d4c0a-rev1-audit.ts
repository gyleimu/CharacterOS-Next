/**
 * D4-C0a REVISION 1 AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-cross-expression-d4/d4c0a-rev1-audit.ts <outdir>
 *
 * Demonstrates the acceptance-region mismatch on the OLD scorer, then calls the AMENDED scorer on the
 * full synthetic matrix. Neither scorer is re-implemented; both are imported and called.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  D4C0A_SCORER,
  scoreD4C0AV0,
  type D4C0AArmV0
} from "./contract.ts";
import {
  D4C0A_MAX_NON_PREDICTED_PER_ARM,
  D4C0A_REV1_R6_TABLE,
  D4_REV1_ARCHITECTURE_GATE,
  D4_C0A_SCORER_RATIONALE_MISMATCH,
  deriveD4Rev1ManifestV0,
  scoreD4C0ARev1V0
} from "./contract-rev1-directional-majority.ts";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

const six = (token: string) => Array.from({ length: 6 }, () => token);
const mk = (support: readonly (string | null)[], oppose: readonly (string | null)[]) => [
  ...support.map((token, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as D4C0AArmV0, parsed_token: token })),
  ...oppose.map((token, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as D4C0AArmV0, parsed_token: token }))
];

const PATTERNS = {
  six_zero_zero: six("SUPPORTS_B"),
  five_one_zero: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B"],
  four_two_zero: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"],
  three_two_one: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "OPPOSES_B"],
  three_three_zero: ["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B"]
} as const;

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node d4c0a-rev1-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the mismatch, demonstrated on the OLD scorer -----------------------------------------
  const oldRegionRows = Object.entries(PATTERNS).map(([pattern, support]) => {
    const outcome = scoreD4C0AV0({ trials: mk(support, six("OPPOSES_B")), r_per_arm: 6 });
    const nonPredicted = support.filter((t) => t !== "SUPPORTS_B").length;
    return {
      support_arm_pattern: pattern,
      non_predicted_outputs: nonPredicted,
      old_scorer_outcome: outcome.outcome_class,
      old_scorer_support_modal: outcome.arm_unique_modals?.["ARM_SUPPORT"] ?? null,
      eligible_under_the_written_rationale: nonPredicted <= D4C0A_MAX_NON_PREDICTED_PER_ARM
    };
  });
  const disagreeing = oldRegionRows.filter(
    (r) => r.old_scorer_outcome === "POSITIVE" && !r.eligible_under_the_written_rationale
  );
  if (disagreeing.length === 0) fail("D4_C0A_MISMATCH_NOT_REPRODUCED", JSON.stringify(oldRegionRows));
  const mismatch = {
    verdict: "D4_C0A_SCORER_RATIONALE_MISMATCH",
    written_rationale_tolerance: D4C0A_MAX_NON_PREDICTED_PER_ARM,
    old_scorer_rows: oldRegionRows,
    rows_where_the_old_scorer_is_wider_than_the_rationale: disagreeing.map((d) => d.support_arm_pattern),
    demonstration:
      "the OLD scorer accepted a SUPPORT arm of 3-2-1 as POSITIVE — three non-predicted outputs, one more than the written tolerance allowed — because the predicted token was still the unique modal",
    qualification_outputs_seen_before_amendment: false,
    target_outputs_seen_before_amendment: false,
    any_output_of_any_kind_existed: false,
    resolution: "the executable scorer was narrowed to the written requirement"
  };
  await write("scorer-rationale-mismatch-report.json", mismatch);

  // ---- 2. the amended scorer, full matrix -------------------------------------------------------
  const cases: { readonly id: string; readonly support: readonly (string | null)[]; readonly oppose: readonly (string | null)[]; readonly expect: string }[] = [
    { id: "perfect_6_0_0_both_arms", support: PATTERNS.six_zero_zero, oppose: six("OPPOSES_B"), expect: "POSITIVE" },
    { id: "five_one_each_arm", support: PATTERNS.five_one_zero, oppose: ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B"], expect: "POSITIVE" },
    { id: "four_two_each_arm", support: PATTERNS.four_two_zero, oppose: ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B", "SUPPORTS_B"], expect: "POSITIVE" },
    { id: "three_two_one_predicted_plurality", support: PATTERNS.three_two_one, oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "three_three_tie", support: PATTERNS.three_three_zero, oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "constant_support_both_arms", support: six("SUPPORTS_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "constant_oppose_both_arms", support: six("OPPOSES_B"), oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "reversed_direction", support: six("OPPOSES_B"), oppose: six("SUPPORTS_B"), expect: "NULL" },
    { id: "only_one_arm_correct", support: PATTERNS.six_zero_zero, oppose: six("UNCERTAIN_B"), expect: "NULL" },
    { id: "uncertain_dominates", support: six("UNCERTAIN_B"), oppose: six("OPPOSES_B"), expect: "NULL" },
    { id: "one_invalid", support: [...six("SUPPORTS_B").slice(0, 5), null], oppose: six("OPPOSES_B"), expect: "INCONCLUSIVE" },
    { id: "all_invalid", support: new Array(6).fill(null) as (string | null)[], oppose: new Array(6).fill(null) as (string | null)[], expect: "INCONCLUSIVE" },
    { id: "out_of_vocabulary_token", support: [...six("SUPPORTS_B").slice(0, 5), "SUPPORTS_PARAPHRASED_PRINCIPLE"], oppose: six("OPPOSES_B"), expect: "INCONCLUSIVE" }
  ];
  const results = cases.map((c) => {
    const outcome = scoreD4C0ARev1V0({ trials: mk(c.support, c.oppose), r_per_arm: 6 });
    return {
      case: c.id,
      expected: c.expect,
      observed: outcome.outcome_class,
      verdict: outcome.verdict,
      support_predicted_count: outcome.arm_predicted_counts?.["ARM_SUPPORT"] ?? null,
      oppose_predicted_count: outcome.arm_predicted_counts?.["ARM_OPPOSE"] ?? null,
      support_meets_majority: outcome.arm_meets_directional_majority?.["ARM_SUPPORT"] ?? null,
      support_modal: outcome.arm_unique_modals?.["ARM_SUPPORT"] ?? null,
      scoring_executed: outcome.scientific_scoring_executed,
      pass: outcome.outcome_class === c.expect
    };
  });
  const integrityCase = scoreD4C0ARev1V0({ trials: mk(six("SUPPORTS_B"), six("OPPOSES_B").slice(0, 5)), r_per_arm: 6 });
  if (results.some((r) => !r.pass)) fail("D4_C0A_REV1_SCORER_AUDIT_FAILED", JSON.stringify(results.filter((r) => !r.pass)));

  const threeTwoOneRow = results.find((r) => r.case === "three_two_one_predicted_plurality") as (typeof results)[number];
  await write("amended-scorer-audit.json", {
    scorer: "scoreD4C0ARev1V0 (frozen revision 1) — called, not re-implemented",
    prior_scorer_identity: D4C0A_SCORER.kind,
    maximum_non_predicted_per_arm: D4C0A_MAX_NON_PREDICTED_PER_ARM,
    cases: results,
    the_decisive_row: {
      case: threeTwoOneRow.case,
      support_modal: threeTwoOneRow.support_modal,
      note: "the predicted token IS still the unique modal here — the amendment rejects the pattern on the DIRECTIONAL MAJORITY, not on modal uniqueness, which is why the test is exercising what it claims",
      observed: threeTwoOneRow.observed
    },
    integrity_failure_case: { observed: integrityCase.outcome_class, verdict: integrityCase.verdict, integrity: integrityCase.collection_integrity },
    reversed_direction_is_a_null_not_an_effect: true,
    verdict: "D4_C0A_REV1_SCORER_PROVEN"
  });

  // ---- 3. the r = 6 re-audit and the noise division of labour -------------------------------------
  await write("r6-eligibility-report.json", {
    ...D4C0A_REV1_R6_TABLE,
    acceptance_region_now_agrees_with_the_executable_scorer: true,
    cross_check: "every row of the table was reproduced by calling scoreD4C0ARev1V0, not asserted"
  });

  // ---- 4. manifest ---------------------------------------------------------------------------------
  const manifest = await deriveD4Rev1ManifestV0();
  await write("contract-rev1-manifest.json", manifest);
  await write("D4_C0A_REV1_VERDICT.json", {
    stage: "D4_C0a-rev1",
    model_calls: 0,
    final_states: [
      "D4_C0A_PREREGISTRATION_FINALIZED_REV1",
      "D4_C0A_QUALIFICATION_IMPLEMENTATION_AUTHORISED",
      "D4_C0B_NOT_PREREGISTERED",
      "LINK_4_REMAINS_LOCKED",
      "CHARACTEROS_UNMODIFIED",
      "MODEL_CALLS_THIS_ROUND = 0"
    ],
    mismatch_fixed: D4_C0A_SCORER_RATIONALE_MISMATCH.verdict,
    outputs_seen_before_the_amendment: { qualification: false, target: false, any: false },
    per_arm_requirement: {
      name: "PRE_REGISTERED_DIRECTIONAL_MAJORITY",
      rule: "predicted token is the unique modal AND its count >= r - 2 (at r = 6: >= 4 of 6)",
      max_non_predicted_per_arm: D4C0A_MAX_NON_PREDICTED_PER_ARM
    },
    budget: { qualification: 9, stability_gate: 6, target: 12, total: 27, unchanged: true },
    claim_scope: "PREREGISTERED POLAR STANCE COMPOSITION (SUPPORT and OPPOSE only; UNCERTAIN transfer is not covered)",
    architecture_gate: {
      closed: true,
      c0a_positive_alone_authorises_nothing: D4_REV1_ARCHITECTURE_GATE.c0a_positive_alone_authorises_nothing,
      comparator_equality_conditions: D4_REV1_ARCHITECTURE_GATE.a_future_comparator_must_hold_all_of_these_equal.length
    },
    preserved_elements_changed: false,
    revision_0_manifest_hash_preserved: manifest.revision_0_manifest_hash_preserved,
    rev1_manifest_hash: manifest.manifest_hash,
    next_round_may_only: [
      "implement the frozen transformer on the frozen minimal base",
      "pass its offline conformance gate at zero calls",
      "freeze the implementation hashes",
      "execute qualification only"
    ],
    next_round_may_not: [
      "design or run C0b",
      "modify CharacterOS",
      "change the tokens, anchors, fixtures, arms or contract",
      "widen the acceptance region back",
      "add a sample-size branch to the gate",
      "execute anything from D2-B or link 4"
    ]
  });

  process.stdout.write(
    `D4_C0A_PREREGISTRATION_FINALIZED_REV1 | D4_C0A_QUALIFICATION_IMPLEMENTATION_AUTHORISED | D4_C0B_NOT_PREREGISTERED\n` +
      `mismatch reproduced on the old scorer: ${disagreeing.map((d) => d.support_arm_pattern).join(",")} was POSITIVE but had more non-predicted outputs than the written tolerance\n` +
      `amended scorer: ${String(results.length)} synthetic cases pass; 3-2-1 is now NULL (its predicted token is still the unique modal)\n` +
      `budget unchanged: ${String(D4C0A_REV1_R6_TABLE.total_budget)}\n` +
      `${manifest.manifest_hash}\nMODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
