/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — Phase D0 qualification fixtures and protocol constants. RESEARCH-ONLY.
 *
 * D0 answers one question: can this instrument DISCRIMINATE the three decisions at all?
 * It is deliberately independent of CharacterOS lived history: every fixture's expected
 * decision is derivable from the observation text alone, so a GENESIS subject (no
 * episodes, no formed belief, no adapted state) is sufficient. No belief adaptation, no
 * formation, and no durable history is used or required by D0.
 *
 * The fixtures are frozen: `D0_FIXTURES` is `Object.freeze`d, the expectations are
 * pre-registered here (not chosen after seeing answers), and the fixture set hash is
 * recorded in every D0 evidence bundle.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import type { DecisionProbeDecisionV0 } from "./contract.js";

export const D0_FIXTURE_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe/d0-fixtures/v0" as const;

export interface DecisionProbeD0FixtureV0 {
  readonly fixture_id: string;
  /** Fed to the subject as the current observation (user turn) to obtain the production request. */
  readonly observation_text: string;
  /** PRE-REGISTERED before any call. Never adjusted after seeing answers. */
  readonly expected_decision: DecisionProbeDecisionV0;
  /** Why the expected decision is derivable from the observation ALONE (no lived history). */
  readonly determinant: string;
}

export const D0_FIXTURES: readonly DecisionProbeD0FixtureV0[] = Object.freeze([
  Object.freeze({
    fixture_id: "D0-A-OBVIOUS-ACCEPT",
    observation_text:
      "Workshop note. A colleague says the thicknesser's extraction hose is 100 mm. " +
      "You can see the hose's collar in front of you and it is stamped \"100 MM\". " +
      "The claim and the visible stamp agree. Given this, what should be done with the claim?",
    expected_decision: "ACCEPT",
    determinant:
      "The observation itself states that an available, directly inspected fact agrees with the claim, so no further checking can change the decision."
  }),
  Object.freeze({
    fixture_id: "D0-B-OBVIOUS-REJECT",
    observation_text:
      "Workshop note. A colleague says the bandsaw blade is on the shelf above the bench. " +
      "You can see the shelf above the bench and it is empty; the blade is visible on the floor " +
      "beside the saw. The claim and the visible fact disagree. Given this, what should be done " +
      "with the claim?",
    expected_decision: "REJECT",
    determinant:
      "The observation itself states that an available, directly inspected fact contradicts the claim, so the claim should not be accepted or acted on."
  }),
  Object.freeze({
    fixture_id: "D0-C-AMBIGUOUS-VERIFY",
    observation_text:
      "Workshop note. A colleague says their plane iron takes a 25 degree bevel. " +
      "You cannot see their plane and you have no record of it either way. " +
      "Their sharpening jig is on the bench in front of you and it takes one minute to check. " +
      "Given this, what should be done with the claim?",
    expected_decision: "VERIFY",
    determinant:
      "Nothing available determines the claim, and an independent check is stated to be available and cheap, so the lawful action is to check before acting."
  })
]);

/** Frozen D0 protocol constants. Changing any of these is a new preregistration. */
export const D0_PROTOCOL_V0 = Object.freeze({
  /** Replicates per (fixture, mode) in the pilot. Deliberately minimal. */
  r_pilot: 3,
  /** Absolute ceiling if the pilot is unstable; never exceeded silently. */
  r_pilot_max: 6,
  /** A fixture passes when its MODAL decision equals the pre-registered expectation. */
  fixture_passes_when: "MODAL_DECISION_EQUALS_EXPECTED" as const,
  /** Minimum agreement among replicates for a passing fixture (2 of 3). */
  min_agreement_fraction: 2 / 3,
  /** Qualification requires every fixture to pass in the primary mode. */
  qualify_requires_all_fixtures: true,
  /** Primary mode. `PURE_SUBSTITUTION` is measured as the fidelity control. */
  primary_mode: "SUBSTITUTION_WITH_OVERRIDE" as const,
  fidelity_control_mode: "PURE_SUBSTITUTION" as const,
  /** An executor is UNQUALIFIED when the schema-rejection rate exceeds this over D0. */
  max_schema_rejection_rate: 0.5
});

export async function deriveD0FixtureSetHashV0(): Promise<HashV1> {
  return await hashEnvelope(D0_FIXTURE_HASH_PROJECTION_V0, { fixtures: D0_FIXTURES });
}
