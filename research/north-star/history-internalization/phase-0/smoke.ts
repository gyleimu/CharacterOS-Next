/**
 * PHASE 0 SMOKE TEST — 0 model calls.
 *
 * Exercises the EXACT SAME schedule mechanics as `execute.ts` against deterministic stub
 * transports, so a wiring error is found here instead of after real calls have been spent.
 * This is the repository's live-adjudication law: probe the live wiring with stub transports
 * before spending real calls.
 *
 * The stub provider set was extracted to `stubs.ts` so that more than one offline consumer can
 * build the SAME bundle rather than a near-copy. Behaviour here is unchanged.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { P0_SUBJECT_A_ID, P0_SUBJECT_B_ID, hashPhase0, scorePhase0V0 } from "./contract.ts";
import { buildPhase0SourceV0 } from "./fixtures.ts";
import { instrumentPhase0BundleV0, runPhase0ScheduleV0 } from "./harness.ts";
import { buildPhase0StubBundleV0 } from "./stubs.ts";

async function main(): Promise<void> {
  const bundle = buildPhase0StubBundleV0();
  const tally = bundle.tally;

  const instrumented = instrumentPhase0BundleV0(bundle);
  const result = await runPhase0ScheduleV0({
    bundle: instrumented,
    sourceA: buildPhase0SourceV0(P0_SUBJECT_A_ID),
    sourceB: buildPhase0SourceV0(P0_SUBJECT_B_ID),
    log: () => {}
  });

  const checks: Record<string, boolean> = {
    qualification_passed: result.qualificationPassed,
    eleven_turns_executed: result.turns.length === 11,
    five_turns_arm_A: result.turns.filter((t) => t.arm === "A").length === 5,
    five_turns_arm_B: result.turns.filter((t) => t.arm === "B").length === 5,
    pre_state_A_target_found: result.itemPreA !== null,
    pre_state_B_target_found: result.itemPreB !== null,
    post_state_A_target_found: result.itemPostA !== null,
    post_state_B_target_found: result.itemPostB !== null,
    pre_states_share_the_same_baseline:
      result.itemPreA?.credence === 0.55 && result.itemPreB?.credence === 0.55,
    arm_A_moved_up: (result.itemPostA?.credence ?? 0) > (result.itemPreA?.credence ?? 0),
    arm_B_moved_down: (result.itemPostB?.credence ?? 1) < (result.itemPreB?.credence ?? 1),
    executed_leakage_clean: result.executedLeakage["clean"] === true,
    executed_leakage_can_fire: result.executedLeakage["check_can_fire"] === true,
    no_integrity_failures: result.integrityFailures.length === 0,
    // Added with the subject-id parameterisation: the DEFAULT path must still be the frozen one.
    default_subject_ids_are_the_frozen_ones:
      result.qualification["subject_id"] === "subject-q0v8-3319" &&
      result.turns.filter((t) => t.arm === "A").length === 5 &&
      result.turns.filter((t) => t.arm === "B").length === 5
  };

  const score = scorePhase0V0({
    credence_pre_A: result.itemPreA?.credence ?? 0,
    credence_post_A: result.itemPostA?.credence ?? 0,
    credence_pre_B: result.itemPreB?.credence ?? 0,
    credence_post_B: result.itemPostB?.credence ?? 0,
    turns_executed_A: 5,
    turns_executed_B: 5,
    integrity_failures: result.integrityFailures
  });
  checks["scorer_reaches_POSITIVE_on_the_stub_chain"] = score.verdict.outcome === "POSITIVE";
  checks["scorer_would_report_the_observed_deltas"] = score.delta_A > 0 && score.delta_B < 0;

  // ---- §3 instrumentation: every attempt of every family, attributed to a turn ----------------
  const families = new Set(instrumented.attempts.map((attempt) => attempt.family));
  const attemptsByFamily = Object.fromEntries(
    ["cognition", "language", "appraisal", "belief_semantic"].map((family) => [
      family,
      instrumented.attempts.filter((attempt) => attempt.family === family).length
    ])
  );
  checks["instrumentation_records_all_four_families"] = families.size === 4;
  checks["every_attempt_carries_a_turn_label"] = instrumented.attempts.every(
    (attempt) => attempt.turn !== "PRE" && attempt.turn.includes(":turn_")
  );
  checks["every_attempt_carries_a_request_hash"] = instrumented.attempts.every((attempt) =>
    attempt.request_hash.startsWith("sha256:")
  );
  checks["every_attempt_carries_a_result_status"] = instrumented.attempts.every((attempt) => attempt.result_status.length > 0);

  const outdir = mkdtempSync(join(tmpdir(), "p0-smoke-"));
  const content = `${JSON.stringify({ smoke: true, checks, score, tally, attempts_by_family: attemptsByFamily, attempt_count: instrumented.attempts.length, turns: result.turns.map((t) => ({ arm: t.arm, turn: t.turn_index, status: t.status, failure: t.failure, terminal: t.belief_adaptation?.current?.terminal_kind ?? null })) }, null, 2)}\n`;
  writeFileSync(join(outdir, "smoke-result.json"), content, "utf8");
  const smokeHash = await hashPhase0(content, "smoke-result.json");

  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([name]) => name);
  console.log(`SMOKE (0 model calls) — ${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks passed`);
  console.log(`  turns: ${result.turns.map((t) => `${t.arm}:${t.turn_index}=${t.belief_adaptation?.current?.terminal_kind ?? "none"}`).join(" ")}`);
  console.log(`  pre A/B=${String(result.itemPreA?.credence)}/${String(result.itemPreB?.credence)}  post A/B=${String(result.itemPostA?.credence)}/${String(result.itemPostB?.credence)}`);
  console.log(`  scorer: ${score.verdict.outcome} delta_A=${score.delta_A} delta_B=${score.delta_B}`);
  console.log(`  stub calls: cognition=${tally.cognition} language=${tally.language} appraisal=${tally.appraisal} belief_semantic=${tally.belief_semantic}`);
  console.log(`  smoke hash: ${smokeHash}`);
  if (failed.length > 0) {
    console.log(`FAILED CHECKS: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

await main();
