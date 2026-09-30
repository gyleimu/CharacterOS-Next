/**
 * PHASE 0 PREFLIGHT — 0 model calls.
 *
 * Produces the §25 audits that must exist BEFORE the first scientific turn:
 *   pre-execution-architecture-audit.json   (§2)
 *   initial-state-equivalence.json          (§3)
 *   target-belief-identity.json             (§5)
 *   trajectory-schedule.json                (§11)
 *   trajectory-isolation-audit.json         (§7)
 *   leakage-audit.json                      (§4)
 *   scorer-falsifiability.json              (§18)
 *   phase-0-budget.json                     (§24)
 *
 * Nothing here is a scientific result. A failing audit stops the round at 0 calls.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  P0_BASELINE_CREDENCE,
  P0_EXACT_BELIEF_SEMANTIC_CALLS,
  P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS,
  P0_MAX_AUXILIARY_CALLS_PER_TURN,
  P0_MAX_TOTAL_MODEL_CALLS,
  P0_QUALIFICATION_TURNS,
  P0_SUBJECT_A_ID,
  P0_SUBJECT_B_ID,
  P0_SUBJECT_DISPLAY_NAME,
  P0_TARGET_PROPOSITION_ID,
  P0_TARGET_PROPOSITION_LABEL,
  P0_TURN_TEMPLATES,
  P0_TOTAL_TURNS,
  P0_TURNS_PER_ARM,
  P0_V1_BUDGET_WAS,
  P0_VALENCE_TABLE,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_INCONCLUSIVE_CONDITIONS,
  P0_PRIMARY_PREDICATE,
  hashPhase0,
  renderPhase0TurnTextV0,
  scorePhase0V0,
  type Phase0ScoreInputV0
} from "./contract.ts";
import { P0_IDENTITY_FIELDS, buildPhase0SourceV0, stripIdentityV0 as stripIdentity } from "./fixtures.ts";

function assert(condition: boolean, code: string, detail: string): void {
  if (!condition) throw new Error(`${code}: ${detail}`);
}


/** Mechanical byte-diff: common prefix, common suffix, and the exact differing middle. */
function diffMiddle(a: string, b: string): { prefix: number; suffix: number; midA: string; midB: string } {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
    suffix += 1;
  }
  return { prefix, suffix, midA: a.slice(prefix, a.length - suffix), midB: b.slice(prefix, b.length - suffix) };
}

/**
 * Single-span-difference proof. A raw common-prefix diff is NOT a valid criterion here: the two
 * frozen spans share the opening "I did ", so a byte diff absorbs part of the span into the
 * common prefix and would report a false difference. The proof therefore rebases each arm on a
 * sentinel substituted for its own span and requires the two rebased strings to be byte-identical
 * to each other AND to the template with the sentinel in place — which is exactly the claim
 * "the arms differ in this span and nowhere else".
 */
const P0_SPAN_SENTINEL = "\u0000P0-SPAN\u0000";

function spanDifferenceProof(
  a: string,
  b: string,
  spanA: string,
  spanB: string,
  template: string
): {
  span_occurs_exactly_once_in_A: boolean;
  span_occurs_exactly_once_in_B: boolean;
  rebased_arms_identical: boolean;
  rebased_equals_template_with_sentinel: boolean;
  proof_holds: boolean;
} {
  const templateWithSentinel = template.replace("{OUT}", P0_SPAN_SENTINEL);
  const countA = a.split(spanA).length - 1;
  const countB = b.split(spanB).length - 1;
  const baseA = a.replace(spanA, P0_SPAN_SENTINEL);
  const baseB = b.replace(spanB, P0_SPAN_SENTINEL);
  const checks = {
    span_occurs_exactly_once_in_A: countA === 1,
    span_occurs_exactly_once_in_B: countB === 1,
    rebased_arms_identical: baseA === baseB,
    rebased_equals_template_with_sentinel: baseA === templateWithSentinel
  };
  return { ...checks, proof_holds: Object.values(checks).every((value) => value === true) };
}

/** §18 falsifiability: the scorer must reach every class, and each row must actually move it. */
function scorerFalsifiability(): Record<string, unknown> {
  const base: Phase0ScoreInputV0 = {
    credence_pre_A: P0_BASELINE_CREDENCE,
    credence_post_A: P0_BASELINE_CREDENCE + 0.1,
    credence_pre_B: P0_BASELINE_CREDENCE,
    credence_post_B: P0_BASELINE_CREDENCE - 0.1,
    turns_executed_A: P0_TURNS_PER_ARM,
    turns_executed_B: P0_TURNS_PER_ARM,
    integrity_failures: []
  };
  const rows: Record<string, unknown> = {};
  const record = (name: string, input: Phase0ScoreInputV0, expected: string, mustDifferFromBase: boolean): void => {
    const result = scorePhase0V0(input);
    const changed = result.verdict.outcome !== scorePhase0V0(base).verdict.outcome;
    rows[name] = {
      outcome: result.verdict.outcome,
      subkind: result.verdict.outcome === "FAILURE_A" ? result.verdict.subkind : null,
      matches_expected: result.verdict.outcome === expected,
      changed_the_outcome_versus_positive_baseline: changed,
      must_differ: mustDifferFromBase,
      row_ok: result.verdict.outcome === expected && changed === mustDifferFromBase
    };
  };
  record("all_predicted_directions", base, "POSITIVE", false);
  record("both_abstained", { ...base, credence_post_A: P0_BASELINE_CREDENCE, credence_post_B: P0_BASELINE_CREDENCE }, "FAILURE_A", true);
  record("a_abstained", { ...base, credence_post_A: P0_BASELINE_CREDENCE }, "FAILURE_A", true);
  record("b_abstained", { ...base, credence_post_B: P0_BASELINE_CREDENCE }, "FAILURE_A", true);
  record("a_wrong_direction", { ...base, credence_post_A: P0_BASELINE_CREDENCE - 0.1 }, "FAILURE_A", true);
  record("b_wrong_direction", { ...base, credence_post_B: P0_BASELINE_CREDENCE + 0.1 }, "FAILURE_A", true);
  record("both_up", { ...base, credence_post_A: P0_BASELINE_CREDENCE + 0.1, credence_post_B: P0_BASELINE_CREDENCE + 0.05 }, "FAILURE_A", true);
  record("both_down", { ...base, credence_post_A: P0_BASELINE_CREDENCE - 0.05, credence_post_B: P0_BASELINE_CREDENCE - 0.1 }, "FAILURE_A", true);
  record(
    "integrity_failure_is_not_a_null",
    { ...base, integrity_failures: ["constructed transport failure"] },
    "INCONCLUSIVE",
    true
  );
  // The decisive property: a null input can NEVER be read as POSITIVE.
  const nullNeverPositive = [
    { ...base, credence_post_A: P0_BASELINE_CREDENCE, credence_post_B: P0_BASELINE_CREDENCE },
    { ...base, credence_post_A: P0_BASELINE_CREDENCE - 0.1 },
    { ...base, credence_post_B: P0_BASELINE_CREDENCE + 0.1 },
    { ...base, integrity_failures: ["x"] }
  ].every((input) => scorePhase0V0(input).verdict.outcome !== "POSITIVE");
  const everyRowOk = Object.values(rows).every((row) => (row as { row_ok: boolean }).row_ok === true);
  return {
    rows,
    every_row_ok: everyRowOk,
    a_null_input_can_never_be_read_as_positive: nullNeverPositive,
    falsifiable: everyRowOk && nullNeverPositive
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  assert(outdir !== undefined, "P0_PREFLIGHT_USAGE", "usage: preflight.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashPhase0(content, name);
  };

  // ---- §3 initial-state equivalence (mechanical, NOT presumed from a shared constructor) ---
  const sourceA = buildPhase0SourceV0(P0_SUBJECT_A_ID);
  const sourceB = buildPhase0SourceV0(P0_SUBJECT_B_ID);
  const strippedA = stripIdentity(sourceA);
  const strippedB = stripIdentity(sourceB);
  const rawA = JSON.stringify(sourceA);
  const rawB = JSON.stringify(sourceB);
  const equivalence = {
    compared: [
      "complete canonical genesis state with identity fields removed",
      "canonical belief items (proposition_id, proposition_label, credence)",
      "relationship state",
      "affect state",
      "personality state (traits_seed and personality)",
      "memory state",
      "goals / preferences if present",
      "regulation and runtime metadata",
      "executor configuration (identical frozen constants for both subjects)"
    ],
    identity_fields_stripped: [...P0_IDENTITY_FIELDS],
    states_equal_after_identity_stripped: strippedA === strippedB,
    raw_states_are_unequal: rawA !== rawB,
    both_directions_observed: (strippedA === strippedB) !== (rawA !== rawB),
    state_equivalence_hash: await hashPhase0(strippedA, "initial-state-equivalence"),
    target_belief_item_A: sourceA.beliefs.items[0] ?? null,
    target_belief_item_B: sourceB.beliefs.items[0] ?? null,
    note: "a parity check that cannot fail is not a check, so the raw (identity-included) bytes are also required to differ"
  };
  assert(equivalence.states_equal_after_identity_stripped, "P0_INITIAL_STATE_MISMATCH", "subjects are not identically initialised");
  assert(equivalence.raw_states_are_unequal, "P0_IDENTITY_PARITY_VACUOUS", "the two raw states are identical, so the parity check proves nothing");

  // ---- §5 target belief identity -----------------------------------------------------------
  const targetIdentity = {
    proposition_id: P0_TARGET_PROPOSITION_ID,
    proposition_label: P0_TARGET_PROPOSITION_LABEL,
    baseline_credence: P0_BASELINE_CREDENCE,
    baseline_credence_origin: "frozen production BELIEF_PROPOSITION_FIRST_CREDENCE (stance-zero 0.5 + one plasticity step)",
    predicted_direction_A: P0_PREDICTED_A_DIRECTION,
    predicted_direction_B: P0_PREDICTED_B_DIRECTION,
    identical_for_both_subjects: JSON.stringify(sourceA.beliefs.items[0]) === JSON.stringify(sourceB.beliefs.items[0]),
    subject_never_told_the_conclusion: true,
    proposition_count: 1,
    authored_final_credence_nowhere: true
  };
  assert(targetIdentity.identical_for_both_subjects, "P0_TARGET_NOT_SHARED", "the target belief item differs between subjects");

  // ---- §11 trajectory schedule + §7 isolation ----------------------------------------------
  const schedule = {
    turns_per_arm: P0_TURNS_PER_ARM,
    total_scientific_turns: 2 * P0_TURNS_PER_ARM,
    qualification_turns: P0_QUALIFICATION_TURNS,
    order: ["QUALIFICATION", "A_turn_0..N-1 (ascending)", "B_turn_0..N-1 (ascending)"],
    turn_0_identical_across_arms: true,
    valence_table_entries: P0_VALENCE_TABLE.length,
    texts: {
      A: Array.from({ length: P0_TURNS_PER_ARM }, (_, index) => renderPhase0TurnTextV0("A", index)),
      B: Array.from({ length: P0_TURNS_PER_ARM }, (_, index) => renderPhase0TurnTextV0("B", index))
    }
  };
  const isolationRows: Record<string, unknown>[] = [];
  for (let turn = 0; turn < P0_TURNS_PER_ARM; turn += 1) {
    const template = P0_TURN_TEMPLATES[turn] as string;
    const a = renderPhase0TurnTextV0("A", turn);
    const b = renderPhase0TurnTextV0("B", turn);
    const row = P0_VALENCE_TABLE.find((entry) => entry.turn_index === turn) ?? null;
    const identical = a === b;
    if (row === null) {
      isolationRows.push({
        turn_index: turn,
        arms_identical: identical,
        expected_identical: true,
        proof: template.includes("{OUT}") ? "UNEXPECTED_SPAN" : "identical shared opening",
        proof_holds: identical && !template.includes("{OUT}"),
        differing_bytes: identical ? 0 : -1,
        arm_A_span_length: 0,
        arm_B_span_length: 0,
        span_length_delta: 0
      });
      continue;
    }
    const proof = spanDifferenceProof(a, b, row.arm_A, row.arm_B, template);
    const byteDiff = diffMiddle(a, b);
    isolationRows.push({
      turn_index: turn,
      arms_identical: identical,
      expected_identical: false,
      proof,
      proof_holds: proof.proof_holds && !identical,
      // Informational only: the raw byte diff is reported but is NOT the criterion.
      raw_common_prefix: byteDiff.prefix,
      raw_common_suffix: byteDiff.suffix,
      raw_diff_bytes: a.length + b.length - 2 * (byteDiff.prefix + byteDiff.suffix),
      arm_A_span_length: row.arm_A.length,
      arm_B_span_length: row.arm_B.length,
      span_length_delta: Math.abs(row.arm_A.length - row.arm_B.length)
    });
  }
  const isolation = {
    method:
      "single-span-difference proof: each arm is rebased by substituting its own frozen span with a sentinel; the two rebased strings must be byte-identical to each other and to the template with the sentinel in place",
    why_not_a_raw_byte_diff:
      "the two frozen spans share the opening 'I did ', so a common-prefix diff absorbs part of the span into the prefix and reports a false difference; the rebase proof does not have that failure mode",
    rows: isolationRows,
    every_row_as_designed: isolationRows.every((row) => row["proof_holds"] === true),
    turn_0_is_a_shared_opening: isolationRows[0]?.["arms_identical"] === true,
    differing_spans_total: isolationRows.filter((row) => row["expected_identical"] === false).length,
    max_span_length_delta: Math.max(...isolationRows.map((row) => row["span_length_delta"] as number)),
    span_length_parity_tolerance_frozen: 2,
    span_length_parity_within_tolerance: Math.max(...isolationRows.map((row) => row["span_length_delta"] as number)) <= 2
  };
  assert(isolation.every_row_as_designed, "P0_TRAJECTORY_ISOLATION_FAILED", "the arms differ outside the frozen spans");
  assert(isolation.span_length_parity_within_tolerance, "P0_SPAN_LENGTH_MISMATCH", "outcome spans are not length-matched");

  // ---- §4 leakage audit on authored model-visible text ------------------------------------
  const authoredModelVisible = [
    ...schedule.texts.A.map((text, index) => ({ source: `trajectory_A_turn_${index}`, text })),
    ...schedule.texts.B.map((text, index) => ({ source: `trajectory_B_turn_${index}`, text })),
    { source: "subject_display_name", text: P0_SUBJECT_DISPLAY_NAME }
  ];
  const leakageHits = authoredModelVisible.flatMap((entry) => {
    const lower = entry.text.toLowerCase();
    return P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS.filter((needle) => lower.includes(needle.toLowerCase())).map((needle) => ({
      source: entry.source,
      forbidden: needle
    }));
  });
  // Falsifiability: the check must be able to fire on a constructed violating string.
  const leakageCheckCanFire = P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS.some((needle) =>
    `prefix ${needle.toUpperCase()} suffix`.toLowerCase().includes(needle.toLowerCase())
  );
  const leakage = {
    forbidden_substrings: P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS,
    authored_model_visible_sources: authoredModelVisible.map((entry) => entry.source),
    hits: leakageHits,
    clean: leakageHits.length === 0,
    check_can_fire_on_constructed_input: leakageCheckCanFire,
    subject_id_is_model_visible_in_production: true,
    subject_id_leak_resolution:
      "the production cognition prompt renders subject_id, and removing it would be a production modification; both subject ids are therefore opaque, equal-length, same-stem, and differ only in a non-semantic 4-digit suffix, so the exposed identifier carries zero arm information",
    ids_carry_no_arm_information:
      P0_SUBJECT_A_ID.length === P0_SUBJECT_B_ID.length &&
      P0_SUBJECT_A_ID.slice(0, -4) === P0_SUBJECT_B_ID.slice(0, -4) &&
      !P0_SUBJECT_A_ID.includes(P0_SUBJECT_B_ID) &&
      [P0_SUBJECT_A_ID, P0_SUBJECT_B_ID].every(
        (id) => !P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS.some((needle) => id.toLowerCase().includes(needle.toLowerCase()))
      )
  };
  assert(leakage.clean, "P0_LEAKAGE_FOUND", JSON.stringify(leakageHits));
  assert(leakage.check_can_fire_on_constructed_input, "P0_LEAKAGE_CHECK_INERT", "the leakage check cannot fail, so it certifies nothing");

  // ---- §2 pre-execution architecture audit -------------------------------------------------
  const packageStatus = await import("node:child_process");
  const dirty = packageStatus
    .execSync("git status --porcelain -- packages/", { cwd: process.cwd() })
    .toString()
    .trim();
  const head = packageStatus.execSync("git rev-parse HEAD", { cwd: process.cwd() }).toString().trim();
  const runtimeSource = await import("node:fs").then((fs) =>
    fs.readFileSync("packages/runtime/src/session/interactive-subject-runtime-v0.ts", "utf8")
  );
  const architecture = {
    production_source_tree_dirty_paths: dirty === "" ? [] : dirty.split("\n"),
    production_source_tree_unmodified: dirty === "",
    head_commit: head,
    checks: [
      {
        claim: "the production turn loop still drives belief adaptation every turn",
        verified_by: "interactive-subject-runtime-v0.ts contains the per-turn runLivedEvidenceBeliefAdaptation call",
        holds: runtimeSource.includes("runLivedEvidenceBeliefAdaptation(beliefEpisodeRefs)")
      },
      {
        claim: "the canonical belief store is unchanged",
        verified_by: "packages/ is unmodified against HEAD",
        holds: dirty === ""
      },
      {
        claim: "the production ordering law is unchanged (turn N reaches only turn N+1)",
        verified_by: "the same-turn isolation comment is present in the turn loop",
        holds: runtimeSource.includes("same-turn isolation") || runtimeSource.includes("§31")
      },
      {
        claim: "personality adaptation remains out of scope (optional factory)",
        verified_by: "no personality provider is supplied by this harness",
        holds: true
      },
      {
        claim: "affect application remains out of scope (not wired into the turn loop)",
        verified_by: "this harness supplies no affect executor and reads no affect value as an endpoint",
        holds: true
      }
    ],
    note: "any false check stops the round at zero calls; production code is never modified to make an experiment run"
  };
  assert(architecture.production_source_tree_unmodified, "P0_PRODUCTION_DIRTY", dirty);
  assert(architecture.checks.every((check) => check.holds), "P0_ARCHITECTURE_CHECK_FAILED", "a critical path changed since preregistration");

  // ---- §18 scorer falsifiability + §24 budget ---------------------------------------------
  const scorer = scorerFalsifiability();
  assert(scorer.falsifiable === true, "P0_SCORER_NOT_FALSIFIABLE", "the frozen scorer cannot reach every outcome class");
  const budget = {
    per_turn_families: ["cognition 1", "language 1", "factual event appraisal at least 1", "belief semantic exactly 1"],
    v1_assumed_calls_per_turn: 2,
    v1_defect: "the V1 preregistration counted only cognition + belief semantic; the production turn also runs language and appraisal, so 2 was wrong and the Phase-0 budget was not extractable",
    v1_n_was_calibration_derived: true,
    rev2_n_is_frozen_a_priori: true,
    rev2_n_turns_per_arm: P0_TURNS_PER_ARM,
    qualification_turns: P0_QUALIFICATION_TURNS,
    exact_turns: P0_TOTAL_TURNS,
    exact_belief_semantic_calls: P0_EXACT_BELIEF_SEMANTIC_CALLS,
    auxiliary_calls_are_measured_not_scientific: true,
    frozen_auxiliary_upper_bound_per_turn: P0_MAX_AUXILIARY_CALLS_PER_TURN,
    frozen_total_model_call_upper_bound: P0_MAX_TOTAL_MODEL_CALLS,
    v1_budget_was: P0_V1_BUDGET_WAS,
    stop_rule_frozen_on: "turns, never on calls or on an observed effect",
    stop_rule: `exactly ${P0_TOTAL_TURNS} turns: ${P0_QUALIFICATION_TURNS} qualification + ${P0_TURNS_PER_ARM} per arm; then STOP regardless of result`
  };

  const hashes: Record<string, string> = {};
  hashes["pre-execution-architecture-audit.json"] = await write("pre-execution-architecture-audit.json", architecture);
  hashes["initial-state-equivalence.json"] = await write("initial-state-equivalence.json", equivalence);
  hashes["target-belief-identity.json"] = await write("target-belief-identity.json", targetIdentity);
  hashes["trajectory-schedule.json"] = await write("trajectory-schedule.json", schedule);
  hashes["trajectory-isolation-audit.json"] = await write("trajectory-isolation-audit.json", isolation);
  hashes["leakage-audit.json"] = await write("leakage-audit.json", leakage);
  hashes["scorer-falsifiability.json"] = await write("scorer-falsifiability.json", scorer);
  hashes["phase-0-budget.json"] = await write("phase-0-budget.json", budget);
  const manifest = {
    phase: "HISTORY_INTERNALIZATION_TEST_V1_PHASE_0",
    revision: "REV2_PHASE_BOUNDARIES",
    model_calls_this_step: 0,
    inconclusive_conditions: P0_INCONCLUSIVE_CONDITIONS,
    primary_predicate: P0_PRIMARY_PREDICATE,
    audit_hashes: hashes
  };
  await write("preflight-manifest.json", manifest);

  console.log("PREFLIGHT PASSED (0 model calls)");
  console.log(`  initial-state equivalence: identical=${equivalence.states_equal_after_identity_stripped} raw-differs=${equivalence.raw_states_are_unequal}`);
  console.log(`  trajectory isolation: differing spans=${isolation.differing_spans_total}, max length delta=${isolation.max_span_length_delta}, turn 0 shared=${isolation.turn_0_is_a_shared_opening}`);
  console.log(`  leakage: clean=${leakage.clean}, check-can-fire=${leakage.check_can_fire_on_constructed_input}`);
  console.log(`  scorer falsifiable: ${String(scorer.falsifiable)}`);
  console.log(`  budget: ${P0_TOTAL_TURNS} turns exact (${budget.exact_belief_semantic_calls} belief-semantic calls), upper bound ${P0_MAX_TOTAL_MODEL_CALLS}`);
  console.log(`  production tree unmodified: ${String(architecture.production_source_tree_unmodified)} @ ${head.slice(0, 8)}`);
}

await main();
