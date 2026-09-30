/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 REVISION 1.1e MECHANICAL AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-causal-path-d2/a1-state-scorer-audit.ts <outdir>
 *
 * The audit calls the FROZEN `classifyA1StateExperimentV0` on synthetic datasets; it does not
 * re-implement the scorer, so it cannot pass while the shipped scorer disagrees. It also proves that
 * the identities frozen in the contract are the identities of the frozen schedule artifact.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import { D2_HASH_PROJECTION_V0 } from "./contract-rev1.ts";
import {
  D2A1_STATE_SCHEDULE_IDENTITIES,
  D2A1_TREATMENT_RECOVERY_POLICY,
  classifyA1StateExperimentV0,
  deriveD2Rev11eManifestV0
} from "./contract-rev1-1e-a1-state-scoring.ts";

const FREEZE_DIR = "research/experiments/belief-causal-path-d2/evidence/run-001/a1-characteros-request-freeze" as const;
const PILOT_DIR = "research/experiments/belief-causal-path-d2/evidence/run-001/a1-neutral-pilot" as const;

const S = "SUPPORTS_PARAPHRASED_PRINCIPLE";
const U = "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE";
const O = "OPPOSES_PARAPHRASED_PRINCIPLE";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Builds a 12-record dataset whose identities come from the frozen schedule identities. */
function mk(high: readonly (string | null)[], low: readonly (string | null)[]) {
  const highIds = D2A1_STATE_SCHEDULE_IDENTITIES.filter((e) => e.arm === "HIGH");
  const lowIds = D2A1_STATE_SCHEDULE_IDENTITIES.filter((e) => e.arm === "LOW");
  return [
    ...high.map((token, index) => ({ trial_id: highIds[index]?.trial_id as string, arm: "HIGH" as const, parsed_stance_token: token })),
    ...low.map((token, index) => ({ trial_id: lowIds[index]?.trial_id as string, arm: "LOW" as const, parsed_stance_token: token }))
  ];
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-state-scorer-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- A. synthetic datasets through the frozen scorer -----------------------------------------
  const cases: {
    readonly id: string;
    readonly description: string;
    readonly records: ReturnType<typeof mk>;
    readonly expect_class: "POSITIVE" | "NULL" | "INCONCLUSIVE";
    readonly expect_verdict: string;
    readonly expect_b: boolean;
  }[] = [
    {
      id: "case_1_perfect_predicted",
      description: "HIGH SUPPORTS x6, LOW OPPOSES x6",
      records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]),
      expect_class: "POSITIVE",
      expect_verdict: "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE",
      expect_b: true
    },
    {
      id: "case_2_same_token_both_arms",
      description: "HIGH SUPPORTS x6, LOW SUPPORTS x6",
      records: mk([S, S, S, S, S, S], [S, S, S, S, S, S]),
      expect_class: "NULL",
      expect_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
      expect_b: false
    },
    {
      id: "case_3_valid_opposite_direction",
      description: "HIGH OPPOSES x6, LOW SUPPORTS x6 — a real direction, opposite to the prediction",
      records: mk([O, O, O, O, O, O], [S, S, S, S, S, S]),
      expect_class: "NULL",
      expect_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
      expect_b: false
    },
    {
      id: "case_4_high_tie",
      description: "HIGH SUPPORTS x3 + UNCERTAIN x3, LOW OPPOSES x6",
      records: mk([S, S, S, U, U, U], [O, O, O, O, O, O]),
      expect_class: "NULL",
      expect_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
      expect_b: false
    },
    {
      id: "case_5_one_invalid",
      description: "HIGH 5 legal + 1 invalid, LOW 6 legal",
      records: mk([S, S, S, S, S, null], [O, O, O, O, O, O]),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
      expect_b: false
    },
    {
      id: "case_6_all_invalid",
      description: "every trial invalid",
      records: mk([null, null, null, null, null, null], [null, null, null, null, null, null]),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
      expect_b: false
    },
    {
      id: "case_7_duplicate_trial_identity",
      description: "two records share a trial identity",
      records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]).map((r, i) => (i === 1 ? { ...r, trial_id: D2A1_STATE_SCHEDULE_IDENTITIES[0]?.trial_id as string } : r)),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      expect_b: false
    },
    {
      id: "case_8_missing_trial_identity",
      description: "one scheduled identity absent",
      records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]).slice(0, 11),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      expect_b: false
    },
    {
      id: "case_9_out_of_vocabulary_token",
      description: "a token from another instrument's vocabulary",
      records: mk([S, S, S, S, S, "ENDORSES_STRONGLY"], [O, O, O, O, O, O]),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
      expect_b: false
    },
    {
      id: "case_10_arm_mismatch",
      description: "a record's arm contradicts the frozen schedule identity",
      records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]).map((r, i) => (i === 0 ? { ...r, arm: "LOW" as const } : r)),
      expect_class: "INCONCLUSIVE",
      expect_verdict: "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      expect_b: false
    }
  ];

  const results = cases.map((c) => {
    const outcome = classifyA1StateExperimentV0({ records: c.records, schedule: D2A1_STATE_SCHEDULE_IDENTITIES });
    const pass =
      outcome.outcome_class === c.expect_class && outcome.verdict === c.expect_verdict && outcome.d2_b_authorised === c.expect_b;
    return {
      case: c.id,
      description: c.description,
      expected_class: c.expect_class,
      expected_verdict: c.expect_verdict,
      expected_b_authorised: c.expect_b,
      observed_class: outcome.outcome_class,
      observed_verdict: outcome.verdict,
      observed_b_authorised: outcome.d2_b_authorised,
      collection_integrity: outcome.collection_integrity,
      invalid_count: outcome.invalid_count,
      scientific_scoring_executed: outcome.scientific_scoring_executed,
      high_unique_modal: outcome.high_unique_modal,
      low_unique_modal: outcome.low_unique_modal,
      high_modal_tie: outcome.high_modal_tie,
      high_counts: outcome.high_counts,
      low_counts: outcome.low_counts,
      positive_predicate: outcome.positive_predicate,
      pass
    };
  });
  if (results.some((r) => !r.pass)) fail("D2_A1_STATE_SCORER_AUDIT_FAILED", JSON.stringify(results.filter((r) => !r.pass)));

  // Null must never be reported where the run was inconclusive, and vice versa.
  const nullCase = results.find((r) => r.case === "case_2_same_token_both_arms") as (typeof results)[number];
  const invalidCase = results.find((r) => r.case === "case_5_one_invalid") as (typeof results)[number];
  const classesAreDistinct =
    nullCase.observed_class === "NULL" &&
    invalidCase.observed_class === "INCONCLUSIVE" &&
    nullCase.scientific_scoring_executed &&
    !invalidCase.scientific_scoring_executed &&
    invalidCase.high_unique_modal === null &&
    invalidCase.low_unique_modal === null;
  if (!classesAreDistinct) fail("D2_A1_NULL_AND_INCONCLUSIVE_NOT_DISTINCT", JSON.stringify({ nullCase, invalidCase }));

  // A supplied schedule that is not the frozen one must be refused. Note the first attempt at this
  // check was NOT a tamper: the value it substituted happened to equal the frozen identity for that
  // position, so it passed — a test that cannot fail is not a test.
  const frozenPosition12 = D2A1_STATE_SCHEDULE_IDENTITIES[11] as { position: number; trial_id: string; arm: "HIGH" | "LOW" };
  const tamperedArm: "HIGH" | "LOW" = frozenPosition12.arm === "HIGH" ? "LOW" : "HIGH";
  const tampered = classifyA1StateExperimentV0({
    records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]),
    schedule: [...D2A1_STATE_SCHEDULE_IDENTITIES.slice(0, 11), { position: 12, trial_id: frozenPosition12.trial_id, arm: tamperedArm }]
  });
  if (tampered.verdict !== "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE") {
    fail("D2_A1_TAMPERED_SCHEDULE_NOT_REFUSED", tampered.verdict);
  }

  // ---- B. the contract's identities ARE the frozen schedule artifact's identities --------------
  const scheduleDoc = JSON.parse(await readFile(join(PILOT_DIR, "A1_STATE_EXPERIMENT_SCHEDULE.json"), "utf8")) as {
    r_confirm_A1: number;
    total_calls: number;
    trials: { position: number; arm: "HIGH" | "LOW"; request_hash: string }[];
  };
  const manifest = JSON.parse(await readFile(join(FREEZE_DIR, "A1_CHARACTEROS_REQUEST_SET_MANIFEST.json"), "utf8")) as Record<string, unknown>;
  const identityParity = scheduleDoc.trials.map((entry, index) => {
    const frozen = D2A1_STATE_SCHEDULE_IDENTITIES[index];
    const expectedHash = entry.arm === "HIGH" ? manifest["high_final_request_hash"] : manifest["low_final_request_hash"];
    return {
      position: entry.position,
      position_matches: frozen?.position === entry.position,
      arm_matches: frozen?.arm === entry.arm,
      request_hash_matches_the_frozen_request_set: entry.request_hash === expectedHash
    };
  });
  const scheduleIdentityHolds =
    scheduleDoc.trials.length === 12 &&
    scheduleDoc.r_confirm_A1 === D2A1_TREATMENT_RECOVERY_POLICY.high_planned &&
    scheduleDoc.total_calls === D2A1_TREATMENT_RECOVERY_POLICY.planned_trials &&
    identityParity.every((p) => p.position_matches && p.arm_matches && p.request_hash_matches_the_frozen_request_set);
  if (!scheduleIdentityHolds) fail("D2_A1_SCHEDULE_IDENTITY_MISMATCH", JSON.stringify({ scheduleDoc, identityParity }));

  const audit = {
    stage: "D2_A1_STATE_EXPERIMENT",
    model_calls: 0,
    frozen_scorer_called_not_reimplemented: true,
    synthetic_cases: results,
    all_cases_passed: true,
    outcome_classes: {
      POSITIVE: "valid data and the preregistered prediction holds",
      NULL: "valid data and the preregistered prediction does not hold",
      INCONCLUSIVE: "collection integrity or invalid provider/parser data makes a scientific verdict impossible",
      null_is_not_inconclusive: true
    },
    null_and_inconclusive_are_distinct: classesAreDistinct,
    tampered_schedule_refused: true,
    reversed_direction_is_a_null_not_a_reversed_effect:
      "the positive predicate is unmet, and the frozen prediction admits no direction other than the preregistered one",
    no_threshold_added: true,
    schedule_identity_parity: identityParity,
    schedule_identities_equal_the_frozen_artifact: scheduleIdentityHolds,
    recovery_policy: D2A1_TREATMENT_RECOVERY_POLICY,
    verdict: "D2_A1_STATE_SCORER_AND_POLICY_PROVEN"
  };
  await write("a1-state-scorer-audit.json", audit);

  const rev11e = await deriveD2Rev11eManifestV0();
  await write("contract-rev1-1e-manifest.json", rev11e);
  const verdictHash = await write("A1_REV11E_MANIFEST.json", {
    stage: "D2_A1_STATE_EXPERIMENT",
    model_calls_this_round: 0,
    amendment: {
      file: "contract-rev1-1e-a1-state-scoring.ts",
      version: rev11e.version,
      manifest_hash: rev11e.manifest_hash,
      supersedes_scope: rev11e.supersedes_scope,
      revision_1_1d_manifest_hash_preserved: rev11e.revision_1_1d_manifest_hash_preserved,
      model_calls_before_amendment_for_a1_treatment: rev11e.model_calls_before_amendment_for_a1_treatment,
      a1_state_outputs_seen_before_amendment: rev11e.a1_state_outputs_seen_before_amendment,
      a1_requests_modified: rev11e.a1_requests_modified,
      a1_schedule_modified: rev11e.a1_schedule_modified,
      a1_prediction_modified: rev11e.a1_prediction_modified,
      scientific_positive_criterion_changed: rev11e.scientific_positive_criterion_changed,
      null_localization_changed: rev11e.null_localization_changed
    },
    synthetic_audit: { cases: results.length, all_passed: true, verdict: audit.verdict },
    verdicts: [
      "D2_PREREGISTRATION_FINALIZED_REV1_1E",
      "D2_A1_STATE_EXPERIMENT_AUTHORISED",
      "D2_A1_STATE_EXPERIMENT_NOT_STARTED"
    ],
    a1_high_low_calls_executed_this_round: 0,
    d2_model_calls_total: 42
  });
  process.stdout.write(
    `${audit.verdict}\n${results.length} synthetic cases passed\nschedule identities equal the frozen artifact: ${String(scheduleIdentityHolds)}\n${rev11e.manifest_hash}\n${verdictHash}\nD2_MODEL_CALLS = 42 (0 this round)\n`
  );
}

await main();
