/**
 * D4-C1 — THE FROZEN RECORD-FORM STABILITY CLASSIFIER.
 *
 * Implements the revision-1 rule under the name frozen at revision 1.1 (`classifyC1RecordStabilityV0`).
 *
 * It measures ONE thing: identical-request measurement-path self-consistency on one frozen NON-TARGET
 * record-form request. It reads only the supplied records, the frozen token vocabulary, the frozen
 * invalid policy, the frozen integrity requirements and the fixture request hash. It never reads
 * qualification correctness, comparator cell outputs, an arm, latency, provider metadata, a clock or a
 * human label, and it never sets the target sample size or touches the target schedule.
 *
 * CORRECTNESS IS NOT STABILITY: six identical legal tokens PASS even when the token is not the fixture's
 * expected one. Requiring correctness here would fuse instrument correctness (qualification's job) with
 * instrument stability (this gate's job).
 */

import { D4C0A_TOKENS } from "../belief-cross-expression-d4/contract.ts";
import { D4_C1_STABILITY_CLASSIFIER_NAME } from "./contract-rev1-1-stability-classifier-name.ts";

export interface D4C1StabilityTrialV0 {
  readonly trial_id: string;
  readonly request_hash: string;
  readonly parsed_token: string | null;
}

export interface D4C1StabilityOutcomeV0 {
  readonly outcome: "PASS" | "STOP";
  readonly integrity_ok: boolean;
  readonly integrity_failures: readonly string[];
  readonly counts: Readonly<Record<string, number>> | null;
  readonly unique_modal: string | null;
  readonly modal_count: number | null;
  readonly tie: boolean;
  readonly invalid_count: number;
  readonly scoring_executed: boolean;
  readonly gate_verdict: string;
  readonly target_authorised: boolean;
  readonly target_sample_size_set_by_this_gate: false;
  readonly target_schedule_modified: false;
  readonly evidence_class: "INSTRUMENT_STABILITY";
}

export const D4_C1_STABILITY_INTEGRITY_REQUIREMENTS = Object.freeze({
  planned_count: 6,
  unique_trial_identities: true,
  no_missing: true,
  no_extra: true,
  every_request_hash_equals_the_fixture_request: true,
  no_comparator_target_request_may_appear: true
});

export function classifyC1RecordStabilityV0(input: {
  readonly trials: readonly D4C1StabilityTrialV0[];
  readonly fixture_request_hash: string;
  readonly comparator_target_request_hashes: readonly string[];
}): D4C1StabilityOutcomeV0 {
  const failures: string[] = [];
  const ids = input.trials.map((t) => t.trial_id);
  if (input.trials.length !== D4_C1_STABILITY_INTEGRITY_REQUIREMENTS.planned_count) {
    failures.push(`records ${input.trials.length} != planned 6`);
  }
  if (ids.length - new Set(ids).size > 0) failures.push("duplicate trial identity");
  const wrongHash = input.trials.filter((t) => t.request_hash !== input.fixture_request_hash).length;
  if (wrongHash > 0) failures.push(`${wrongHash} records whose request hash is not the fixture request`);
  const targetUsed = input.trials.filter((t) => input.comparator_target_request_hashes.includes(t.request_hash)).length;
  if (targetUsed > 0) failures.push(`${targetUsed} records carrying a comparator target request hash`);

  const invalid = input.trials.filter(
    (t) => t.parsed_token === null || !(D4C0A_TOKENS as readonly string[]).includes(t.parsed_token)
  ).length;

  const stop = (integrityOk: boolean, integrityFailures: readonly string[], verdict: string, invalidCount: number): D4C1StabilityOutcomeV0 =>
    Object.freeze({
      outcome: "STOP" as const,
      integrity_ok: integrityOk,
      integrity_failures: Object.freeze([...integrityFailures]),
      counts: null,
      unique_modal: null,
      modal_count: null,
      tie: false,
      invalid_count: invalidCount,
      scoring_executed: false,
      gate_verdict: verdict,
      target_authorised: false,
      target_sample_size_set_by_this_gate: false as const,
      target_schedule_modified: false as const,
      evidence_class: "INSTRUMENT_STABILITY" as const
    });

  if (failures.length > 0) return stop(false, failures, "D4_C1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE", invalid);
  if (invalid > 0) return stop(true, [], "D4_C1_INCONCLUSIVE_BY_STABILITY_GATE_INVALID_OUTPUTS", invalid);

  const counts: Record<string, number> = {};
  for (const token of D4C0A_TOKENS) counts[token] = 0;
  for (const trial of input.trials) {
    const key = trial.parsed_token as string;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0] as [string, number];
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  const passes = !tie && top[1] === input.trials.length;

  return Object.freeze({
    outcome: passes ? ("PASS" as const) : ("STOP" as const),
    integrity_ok: true,
    integrity_failures: Object.freeze([]),
    counts: Object.freeze(counts),
    unique_modal: tie ? null : top[0],
    modal_count: top[1],
    tie,
    invalid_count: 0,
    scoring_executed: true,
    gate_verdict: passes ? "D4_C1_RECORD_STABILITY_GATE_PASS" : "D4_C1_INCONCLUSIVE_BY_RECORD_FORM_SELF_NOISE",
    target_authorised: passes,
    target_sample_size_set_by_this_gate: false as const,
    target_schedule_modified: false as const,
    evidence_class: "INSTRUMENT_STABILITY" as const
  });
}

/** Exposed so an audit can show the frozen rule the classifier implements. */
export const D4_C1_STABILITY_CLASSIFIER_FROZEN_RULES = Object.freeze({
  classifier: D4_C1_STABILITY_CLASSIFIER_NAME,
  integrity: D4_C1_STABILITY_INTEGRITY_REQUIREMENTS,
  pass_condition: "all six trials legal and mutually agreeing on one token",
  correctness_required: false,
  reachable_outcomes: ["PASS", "STOP"] as const
});
