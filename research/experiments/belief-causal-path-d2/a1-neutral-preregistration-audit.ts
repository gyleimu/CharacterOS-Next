/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 NEUTRAL PILOT — PREREGISTRATION AUDIT. 0 MODEL CALLS.
 *
 *   node research/experiments/belief-causal-path-d2/a1-neutral-preregistration-audit.ts <outdir>
 *
 * Before the six A1 neutral calls, ask whether the FROZEN contracts already determine two things the
 * pilot cannot run without:
 *
 *   §1 the noise rule: how a parser-invalid / malformed / transport-failed trial enters the frozen
 *      denominator and the modal_count — because that is what decides r_confirm, and r_confirm
 *      authorises the treatment run;
 *   §3 the production context: whether the A1 state experiment's observation/task/context is uniquely
 *      bound, so it cannot be chosen after seeing outputs.
 *
 * A gap in either is reported as a gap. This audit does not invent a rule to close it.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import {
  D2_HASH_PROJECTION_V0,
  D2_NOISE_RULE,
  D2A1_PREDICTION,
  D2_CAUSAL_GRAPH_REV1
} from "./contract-rev1.ts";
import { D2A1_QUALIFICATION_INVALID_RULE, D2A1_TRANSFORMER_CONTRACT } from "./contract-rev1-1c-a1-prerequisites.ts";

const REQUIRED_OF_THE_NOISE_RULE = [
  "planned_neutral_trials_equals_6",
  "no_retry",
  "no_replacement",
  "modal_count_calculation",
  "mapping_6_to_r6",
  "mapping_5_to_r14",
  "stop_at_4_or_fewer",
  "invalid_trial_handling"
] as const;

/**
 * The three readings a careful reader can take from the frozen text. They are enumerated here only to
 * SHOW they diverge; none of them is adopted, because adopting one would be inventing the rule.
 */
type Reading = "INVALIDS_EXCLUDED_FROM_THE_MODAL" | "INVALIDS_ARE_ORDINARY_KEYS" | "ANY_INVALID_STOPS";

function rUnderReading(counts: readonly { key: string; count: number }[], reading: Reading): number | "STOP" | "UNDEFINED" {
  const mapping = D2_NOISE_RULE.deterministic_mapping as Record<string, number | string>;
  const invalidTotal = counts.filter((c) => c.key.startsWith("INVALID:")).reduce((sum, c) => sum + c.count, 0);
  if (reading === "ANY_INVALID_STOPS" && invalidTotal > 0) return "STOP";
  const relevant =
    reading === "INVALIDS_EXCLUDED_FROM_THE_MODAL" ? counts.filter((c) => !c.key.startsWith("INVALID:")) : counts;
  if (relevant.length === 0) return mapping["0"] === "STOP" ? "STOP" : "UNDEFINED";
  const ranked = [...relevant].sort((a, b) => b.count - a.count);
  const top = ranked[0] as { key: string; count: number };
  const tie = ranked[1] !== undefined && ranked[1].count === top.count;
  if (tie) return "UNDEFINED";
  const mapped = mapping[String(top.count)];
  if (mapped === undefined) return "UNDEFINED";
  return typeof mapped === "number" ? mapped : "STOP";
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-neutral-preregistration-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- §1 THE NOISE RULE --------------------------------------------------------------------
  const noiseText = JSON.stringify(D2_NOISE_RULE).toLowerCase();
  const presence: Record<string, boolean> = {
    planned_neutral_trials_equals_6: D2_NOISE_RULE.pilot_shape.includes("6 byte-identical"),
    no_retry: noiseText.includes("retry"),
    no_replacement: noiseText.includes("replace"),
    modal_count_calculation: noiseText.includes("modal") || noiseText.includes("count"),
    mapping_6_to_r6: (D2_NOISE_RULE.deterministic_mapping as Record<string, unknown>)["6"] === 6,
    mapping_5_to_r14: (D2_NOISE_RULE.deterministic_mapping as Record<string, unknown>)["5"] === 14,
    stop_at_4_or_fewer: ["0", "1", "2", "3", "4"].every(
      (k) => (D2_NOISE_RULE.deterministic_mapping as Record<string, unknown>)[k] === "STOP"
    ),
    invalid_trial_handling:
      noiseText.includes("invalid") || noiseText.includes("malformed") || noiseText.includes("transport") || noiseText.includes("failure")
  };
  const missing = REQUIRED_OF_THE_NOISE_RULE.filter((r) => presence[r] !== true);

  // The only invalid rule in the D2 contract set, and why it does not reach the pilot.
  const invalidRuleInventory = [
    {
      source: "contract-rev1-1c-a1-prerequisites.ts :: D2A1_QUALIFICATION_INVALID_RULE",
      rule: D2A1_QUALIFICATION_INVALID_RULE.rule,
      applies_to: D2A1_QUALIFICATION_INVALID_RULE.applies_to,
      verdict_if_any_invalid: D2A1_QUALIFICATION_INVALID_RULE.verdict_if_any_invalid,
      denominator: D2A1_QUALIFICATION_INVALID_RULE.denominator,
      reaches_the_neutral_pilot: false,
      why_not:
        "its verdict is about INSTRUMENT QUALIFICATION (D2_INSTRUMENT_UNQUALIFIED), which is not definable for a pilot whose instrument is already qualified; it is scoped by name and by applies_to to qualification trials"
    }
  ];

  // Divergence proof: the same observed pilot, three admissible readings, three different r values.
  const scenarios = [
    { name: "all_six_agree", counts: [{ key: "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", count: 6 }] },
    { name: "five_agree_one_transport_failure", counts: [{ key: "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", count: 5 }, { key: "INVALID:TRANSPORT_FAILED", count: 1 }] },
    { name: "three_agree_three_invalid", counts: [{ key: "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", count: 3 }, { key: "INVALID:TRANSPORT_FAILED", count: 3 }] },
    { name: "all_six_invalid", counts: [{ key: "INVALID:TRANSPORT_FAILED", count: 6 }] }
  ] as const;
  const readings: readonly Reading[] = ["INVALIDS_EXCLUDED_FROM_THE_MODAL", "INVALIDS_ARE_ORDINARY_KEYS", "ANY_INVALID_STOPS"];
  const divergence = scenarios.map((s) => {
    const outcomes = Object.fromEntries(readings.map((r) => [r, rUnderReading(s.counts, r)]));
    const distinct = new Set(Object.values(outcomes).map((v) => String(v)));
    return { scenario: s.name, observed_counts: s.counts, outcomes_under_each_reading: outcomes, readings_disagree: distinct.size > 1 };
  });
  const disagreeing = divergence.filter((d) => d.readings_disagree);

  const section1 = {
    gate: "§1 frozen noise rule must already determine invalid handling",
    required_items: REQUIRED_OF_THE_NOISE_RULE,
    presence,
    missing_items: missing,
    invalid_trial_handling_is_among_the_missing: missing.includes("invalid_trial_handling"),
    frozen_noise_rule: D2_NOISE_RULE,
    invalid_rule_inventory: invalidRuleInventory,
    any_invalid_rule_that_reaches_the_pilot: false,
    divergence_proof: divergence,
    scenarios_where_the_readings_disagree: disagreeing.map((d) => d.scenario),
    materiality:
      "the mapping is keyed by modal_count, so 'a completely failed pilot' is r = STOP under two readings and r = 6 under the third — i.e. the ambiguity is at its widest exactly where a fully failed pilot would otherwise authorise a 12-call treatment run",
    verdict: missing.length === 0 ? "D2_A1_NEUTRAL_INVALID_HANDLING_PREREGISTERED" : "D2_A1_NEUTRAL_INVALID_HANDLING_NOT_PREREGISTERED"
  };

  // ---- §3 THE PRODUCTION CONTEXT BINDING ----------------------------------------------------
  const contextBinding = {
    question: "is the A1 state experiment's observation/task/production context uniquely bound by an authoritative contract?",
    a1_has_an_explicit_same_projection_path_equivalent: false,
    note_on_a0: "A0 had D2A_INSTRUMENT_LAWS.same_projection_path ('the stimulus is the unmodified production canonical projection; no hand-written subject data'), which settled it directly",
    arguments_that_do_bind_it: [
      "D2_TRANSFORMER_LAWS.each_requires_pristine_production_v8_input — the A1 stimulus is a pristine production request, not a hand-written scene",
      "the D2 causal graph places A0 (link 3A) and A1 (link 3B) on the SAME chain, so a different production context would make the localisation matrix incoherent",
      `${D2_CAUSAL_GRAPH_REV1.links[0]?.link ?? "LINK 1"} (LINK 1) and LINK 2 are carried forward as established by D1 without any model call: the 0.80/0.20 credence materialises through production genesis authoring as the ONLY canonical state difference, and the production V2 projection carries the belief line — that is a bound state+projection path, and the projection contains the world's own observation`,
      "the A1 transformer appends a measurement contract only; it cannot introduce a context, so the context is whatever the production request already contains",
      "the P1 observation is itself a secondhand-report scenario ('a colleague remarks...'), the exact antecedent the CAUTION proposition and its paraphrase are about, so the frozen context is construct-aligned rather than arbitrary"
    ],
    reasoned_resolution: "the context is uniquely determined, and it is the SAME frozen production context A0 used",
    residual_weakness:
      "A1 reaches this by inference from the causal chain and the D1 handoff rather than from an explicit A1 context field; an explicit binding would remove the inference and belongs in the amendment that closes §1",
    would_have_stopped_if_unresolvable: "D2_A1_STATE_CONTEXT_NOT_FULLY_PREREGISTERED",
    verdict_emitted: false,
    resolved: true
  };

  const callsSpent = 0;
  const audit = {
    stage: "D2_A1_NEUTRAL_PILOT_PREREGISTRATION_AUDIT",
    model_calls: callsSpent,
    section_1_noise_rule: section1,
    section_3_production_context: contextBinding,
    a1_prediction_reaffirmed_frozen: {
      HIGH_0_80_expected: D2A1_PREDICTION.HIGH_0_80_expected,
      LOW_0_20_expected: D2A1_PREDICTION.LOW_0_20_expected,
      transformer_contract_name: D2A1_TRANSFORMER_CONTRACT.name,
      changed_by_this_round: false
    },
    blocked: missing.length > 0,
    final_verdict: missing.length > 0 ? "D2_A1_NEUTRAL_INVALID_HANDLING_NOT_PREREGISTERED" : "D2_A1_NEUTRAL_PILOT_MAY_PROCEED",
    next_round_required_action:
      "a revision that freezes the pilot's invalid handling (and, while it is being written, an explicit A1 production-context binding) with model_calls_before_amendment_for_the_a1_pilot = 0"
  };
  await write("a1-neutral-preregistration-audit.json", audit);
  await write("A1_NEUTRAL_PREREGISTRATION_VERDICT.json", {
    verdict: audit.final_verdict,
    model_calls_this_round: callsSpent,
    blocked_by: section1.missing_items,
    d2_model_calls_total: 36,
    a1_neutral_pilot_runs: false,
    a1_state_experiment_runs: false,
    no_rule_invented_on_the_spot: true
  });
  process.stdout.write(`${audit.final_verdict}\nmissing: ${missing.join(" ; ")}\nreadings disagree on: ${section1.scenarios_where_the_readings_disagree.join(", ")}\n`);
}

await main();
