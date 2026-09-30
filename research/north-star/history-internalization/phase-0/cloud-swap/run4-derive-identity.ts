/**
 * RUN-4 — DECLARED POST-RUN DERIVATION of `target-belief-identity.json` (0 model calls).
 *
 *   npx tsx phase-0/cloud-swap/run4-derive-identity.ts <run-dir>
 *
 * WHY THIS EXISTS, stated plainly: `cloud-execute.ts` under-produced artifacts relative to the frozen
 * scorer's contract. `score.ts` reads exactly six files and one of them — `target-belief-identity.json`
 * — was not written, so the frozen scorer could not be called. That is a defect in MY program, not in
 * the science, and it is recorded as such in `RUN4_INSTRUMENTATION_GAP.json`.
 *
 * WHY DERIVING IT IS LAWFUL HERE: the file contains NO measurement. Every field is either a frozen
 * constant from `../contract.ts` or a declarative provenance statement, and the single field that is
 * derived (`proposition_count`) is read from the run's ALREADY-FROZEN pre-state. The program refuses to
 * write anything unless the frozen pre-states agree with the frozen constants, so the derivation cannot
 * paper over a discrepancy. It cannot move an endpoint: the endpoint is read by `score.ts` from the
 * frozen pre/post states, which this program never writes.
 *
 * WHY `score.ts` IS NOT EDITED INSTEAD: the scorer is frozen. The correct direction of conformance is
 * the program conforming to the frozen scorer, never the reverse.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  P0_BASELINE_CREDENCE,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_TARGET_PROPOSITION_ID,
  P0_TARGET_PROPOSITION_LABEL
} from "../contract.ts";

interface BeliefItem {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

function beliefsOf(state: unknown): readonly BeliefItem[] {
  return (
    (state as { canonical_state_view?: { beliefs?: readonly BeliefItem[] } }).canonical_state_view?.beliefs ?? []
  );
}

function main(): void {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("RUN4_DERIVE_USAGE: usage: run4-derive-identity.ts <run-dir>");

  const address = (name: string): string => join(dir, name);
  // Refuse to overwrite: a declared derivation is written once, not revised.
  const guard = (name: string): void => {
    try {
      readFileSync(address(name), "utf8");
      throw new Error(`RUN4_DERIVE_REFUSES_TO_OVERWRITE: ${name} already exists`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("RUN4_DERIVE_REFUSES_TO_OVERWRITE")) throw error;
    }
  };
  guard("target-belief-identity.json");
  guard("RUN4_INSTRUMENTATION_GAP.json");

  const preA = JSON.parse(readFileSync(address("pre-state-A.json"), "utf8")) as { scored?: boolean; state: unknown };
  const preB = JSON.parse(readFileSync(address("pre-state-B.json"), "utf8")) as { scored?: boolean; state: unknown };

  // ---- cross-check the frozen constants against the run's own frozen pre-states -------------------
  const problems: string[] = [];
  if (preA.scored !== false) problems.push("pre-state-A.json was not frozen with scored:false");
  if (preB.scored !== false) problems.push("pre-state-B.json was not frozen with scored:false");
  const itemsA = beliefsOf(preA.state);
  const itemsB = beliefsOf(preB.state);
  if (itemsA.length !== 1) problems.push(`pre-state-A has ${String(itemsA.length)} beliefs, expected exactly 1`);
  if (itemsB.length !== 1) problems.push(`pre-state-B has ${String(itemsB.length)} beliefs, expected exactly 1`);
  const a = itemsA[0];
  const b = itemsB[0];
  if (a === undefined || b === undefined) problems.push("a pre-state is missing its belief item");
  if (a !== undefined && a.proposition_id !== P0_TARGET_PROPOSITION_ID) {
    problems.push(`pre-state-A proposition_id ${a.proposition_id} != frozen ${P0_TARGET_PROPOSITION_ID}`);
  }
  if (b !== undefined && b.proposition_id !== P0_TARGET_PROPOSITION_ID) {
    problems.push(`pre-state-B proposition_id ${b.proposition_id} != frozen ${P0_TARGET_PROPOSITION_ID}`);
  }
  if (a !== undefined && a.credence !== P0_BASELINE_CREDENCE) {
    problems.push(`pre-state-A credence ${String(a.credence)} != frozen baseline ${String(P0_BASELINE_CREDENCE)}`);
  }
  if (b !== undefined && b.credence !== P0_BASELINE_CREDENCE) {
    problems.push(`pre-state-B credence ${String(b.credence)} != frozen baseline ${String(P0_BASELINE_CREDENCE)}`);
  }
  if (a !== undefined && b !== undefined && a.credence !== b.credence) {
    problems.push("the two pre-states do not share the same baseline credence");
  }
  if (problems.length > 0) {
    writeFileSync(
      address("RUN4_DERIVE_REFUSED.json"),
      `${JSON.stringify({ artifact: "RUN4_DERIVE_REFUSED", problems, derivation_written: false }, null, 2)}\n`,
      "utf8"
    );
    throw new Error(`RUN4_DERIVE_REFUSED: ${problems.join("; ")}`);
  }

  const derived = {
    proposition_id: P0_TARGET_PROPOSITION_ID,
    proposition_label: P0_TARGET_PROPOSITION_LABEL,
    baseline_credence: P0_BASELINE_CREDENCE,
    baseline_credence_origin: "frozen production BELIEF_PROPOSITION_FIRST_CREDENCE (stance-zero 0.5 + one plasticity step)",
    predicted_direction_A: P0_PREDICTED_A_DIRECTION,
    predicted_direction_B: P0_PREDICTED_B_DIRECTION,
    identical_for_both_subjects: true,
    subject_never_told_the_conclusion: true,
    proposition_count: itemsA.length,
    authored_final_credence_nowhere: true,
    // --- provenance of THIS file (absent from run-1's copy, which was written by the run itself) ---
    produced_by: "run4-derive-identity.ts",
    produced_after_the_run: true,
    contains_no_measurement: true,
    every_field_is_either_a_frozen_constant_or_a_cross_checked_derivation: true,
    cross_checked_against: ["pre-state-A.json", "pre-state-B.json"]
  };
  writeFileSync(address("target-belief-identity.json"), `${JSON.stringify(derived, null, 2)}\n`, "utf8");

  writeFileSync(
    address("RUN4_INSTRUMENTATION_GAP.json"),
    `${JSON.stringify(
      {
        artifact: "RUN4_INSTRUMENTATION_GAP",
        defect: "cloud-execute.ts did not write target-belief-identity.json",
        consequence:
          "the frozen scorer (`score.ts`) reads exactly six files and this one was missing, so scoring could not proceed until it existed",
        classification: "DEFECT IN THE RUN PROGRAM, NOT IN THE SCIENCE",
        what_was_NOT_done: [
          "score.ts was NOT edited (the scorer is frozen; the program conforms to the scorer, never the reverse)",
          "no frozen artifact was rewritten",
          "no measurement, credence, turn record or integrity failure was changed"
        ],
        what_was_done: [
          "target-belief-identity.json was derived by run4-derive-identity.ts from ../contract.ts frozen constants",
          "the derivation cross-checks both frozen pre-states and REFUSES to write on any disagreement",
          "the missing field is a declaration of which proposition the scorer must read; it contains no measurement"
        ],
        fix_for_future_runs: "cloud-execute.ts now writes this artifact itself",
        provider_calls: 0
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  process.stdout.write(`derived target-belief-identity.json for ${dir}\n`);
  process.stdout.write(`  proposition_id: ${P0_TARGET_PROPOSITION_ID}\n`);
  process.stdout.write(`  baseline_credence: ${String(P0_BASELINE_CREDENCE)} (cross-checked against both pre-states)\n`);
  process.stdout.write("  instrumentation gap recorded in RUN4_INSTRUMENTATION_GAP.json\n");
}

main();
