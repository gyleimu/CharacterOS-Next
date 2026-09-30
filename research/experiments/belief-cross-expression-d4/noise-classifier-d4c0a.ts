/**
 * D4-C0a — THE FROZEN NOISE/STABILITY CLASSIFIER, AS A CALLABLE PURE FUNCTION.
 *
 * Implements `D4C0A_NOISE_GATE` (contract.ts, frozen at revision 0) exactly, under the executable name
 * frozen at revision 3: `classifyD4C0ANoiseStabilityV0`.
 *
 * The gate measures IDENTICAL-REQUEST MEASUREMENT-PATH SELF-CONSISTENCY. It reads only the supplied
 * records, the frozen token vocabulary, the frozen invalid policy, the frozen integrity requirements and
 * the selected request hash. It never reads qualification correctness, target outputs, an arm, latency,
 * provider metadata, a clock or a human label.
 *
 * THE HARD RULE: correctness is not stability. If all six calls return the SAME legal token, the gate
 * PASSES — even when that token is not the fixture's expected qualification token — because agreement is
 * a property of the executor while correctness is qualification's job. Adding a correctness requirement
 * here would fuse two constructs into one.
 */

import { D4C0A_NOISE_GATE, D4C0A_TOKENS, D4C0A_QUALIFICATION_FIXTURES } from "./contract.ts";
import { D4C0A_NOISE_CLASSIFIER, D4C0A_NOISE_TARGET_AUTHORISATION } from "./contract-rev3-noise-executable.ts";

export interface D4C0ANoiseTrialV0 {
  readonly trial_id: string;
  readonly request_hash: string;
  readonly parsed_token: string | null;
}

export interface D4C0ANoiseOutcomeV0 {
  readonly outcome: "PASS" | "STOP";
  readonly integrity_ok: boolean;
  readonly integrity_failures: readonly string[];
  readonly counts: Readonly<Record<string, number>> | null;
  readonly unique_modal: string | null;
  readonly modal_count: number | null;
  readonly tie: boolean;
  readonly invalid_count: number;
  readonly scientific_stability_scoring_executed: boolean;
  readonly gate_verdict: string;
  /** The token's identity is reported for transparency and is NEVER a pass condition. */
  readonly modal_token_matched_the_fixture_expected: boolean | null;
  readonly modal_token_identity_used_as_a_pass_condition: false;
  readonly target_authorised: boolean;
  readonly r_after_the_gate: 6;
  readonly r_changed_by_the_gate: false;
  readonly evidence_class: "INSTRUMENT_STABILITY";
}

/**
 * The frozen integrity requirements (contract-rev3 §10 of the round brief). Read from frozen constants,
 * never from a caller's assertion.
 */
export const D4C0A_NOISE_INTEGRITY_REQUIREMENTS = Object.freeze({
  planned_count: D4C0A_NOISE_GATE.planned_calls,
  unique_trial_identities: true,
  no_missing: true,
  no_extra: true,
  every_request_hash_equals_the_selected_noise_request: true,
  no_target_request_hash_may_appear: true
});

export function classifyD4C0ANoiseStabilityV0(input: {
  readonly trials: readonly D4C0ANoiseTrialV0[];
  readonly selected_noise_request_hash: string;
  readonly target_request_hash: string;
}): D4C0ANoiseOutcomeV0 {
  const fixture = D4C0A_QUALIFICATION_FIXTURES[0] as { expected_token: string };
  const failures: string[] = [];
  const ids = input.trials.map((t) => t.trial_id);
  if (input.trials.length !== D4C0A_NOISE_INTEGRITY_REQUIREMENTS.planned_count) {
    failures.push(`records ${input.trials.length} != planned ${D4C0A_NOISE_INTEGRITY_REQUIREMENTS.planned_count}`);
  }
  if (ids.length - new Set(ids).size > 0) failures.push("duplicate trial identity");
  const wrongHash = input.trials.filter((t) => t.request_hash !== input.selected_noise_request_hash).length;
  if (wrongHash > 0) failures.push(`${wrongHash} records whose request hash is not the selected noise request`);
  const targetHashPresent = input.trials.filter((t) => t.request_hash === input.target_request_hash).length;
  if (targetHashPresent > 0) failures.push(`${targetHashPresent} records carrying the target request hash`);

  const invalid = input.trials.filter(
    (t) => t.parsed_token === null || !(D4C0A_TOKENS as readonly string[]).includes(t.parsed_token)
  ).length;

  const stop = (integrityOk: boolean, integrityFailures: readonly string[], verdict: string, invalidCount: number): D4C0ANoiseOutcomeV0 =>
    Object.freeze({
      outcome: "STOP" as const,
      integrity_ok: integrityOk,
      integrity_failures: Object.freeze([...integrityFailures]),
      counts: null,
      unique_modal: null,
      modal_count: null,
      tie: false,
      invalid_count: invalidCount,
      scientific_stability_scoring_executed: false,
      gate_verdict: verdict,
      modal_token_matched_the_fixture_expected: null,
      modal_token_identity_used_as_a_pass_condition: false as const,
      target_authorised: false,
      r_after_the_gate: D4C0A_NOISE_TARGET_AUTHORISATION.r_after_the_gate,
      r_changed_by_the_gate: false as const,
      evidence_class: "INSTRUMENT_STABILITY" as const
    });

  if (failures.length > 0) {
    return stop(false, failures, "D4C0A_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE", invalid);
  }
  if (invalid > 0) {
    return stop(true, [], D4C0A_NOISE_GATE.invalid_verdict, invalid);
  }

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
    scientific_stability_scoring_executed: true,
    gate_verdict: passes ? D4C0A_NOISE_GATE.pass_verdict : D4C0A_NOISE_GATE.self_noise_verdict,
    modal_token_matched_the_fixture_expected: tie ? null : top[0] === fixture.expected_token,
    modal_token_identity_used_as_a_pass_condition: false as const,
    target_authorised: passes,
    r_after_the_gate: D4C0A_NOISE_TARGET_AUTHORISATION.r_after_the_gate,
    r_changed_by_the_gate: false as const,
    evidence_class: "INSTRUMENT_STABILITY" as const
  });
}

/** Exposed so an audit can show the frozen rules the classifier implements. */
export const D4C0A_NOISE_CLASSIFIER_FROZEN_RULES = Object.freeze({
  classifier: D4C0A_NOISE_CLASSIFIER.name,
  gate: D4C0A_NOISE_GATE,
  authorisation: D4C0A_NOISE_TARGET_AUTHORISATION,
  integrity: D4C0A_NOISE_INTEGRITY_REQUIREMENTS
});
