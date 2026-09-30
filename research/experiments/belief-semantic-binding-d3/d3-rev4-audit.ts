/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3 REVISION 4 AUDIT — THE STABILITY GATE. 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-semantic-binding-d3/d3-rev4-audit.ts <qualificationEvidenceDir> <outdir>
 *
 * Calls the NEW frozen gate classifier on the six required synthetic pilots, proves that no path yields
 * r = 14 and that only six mutually-agreeing calls authorise the target, confirms the noise request is
 * unchanged and still the frozen qualification request, and records the prior-exposure limitation.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import { D3_HASH_PROJECTION_V0, D3B_QUALIFICATION_FIXTURES } from "./contract.ts";
import {
  D3B_NOISE_STABILITY_GATE,
  D3_REV4_BUDGET,
  D3B_NOISE_REQUEST_PRIOR_EXPOSURE,
  deriveD3Rev4ManifestV0
} from "./contract-rev4-noise-stability-gate.ts";
import { classifyD3BNoiseStabilityV0, classifyD3BNoisePilotV0 } from "./scorers-d3b.ts";
import { selectNoiseFixtureIdV0 } from "./contract-rev3-noise-identity.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const FROZEN_NOISE_REQUEST_HASH = "sha256:82a8678e044fd802611f173ae4ae1f13702e636dcdfb3b53771c81995c46ca8a" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const qualificationDir = process.argv[2];
  const outdir = process.argv[3];
  if (qualificationDir === undefined || outdir === undefined) {
    throw new Error("usage: node d3-rev4-audit.ts <qualificationEvidenceDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  const S = "SEMANTICALLY_ALIGNED";
  const U = "SEMANTICALLY_UNRELATED";
  const O = "SEMANTICALLY_OPPOSED";
  const mk = (tokens: readonly (string | null)[]) =>
    tokens.map((relation, index) => ({ trial_id: `n${String(index)}`, relation, group: "D3B_NOISE" }));

  // ---- A. the gate, on the six required pilots -------------------------------------------------
  const cases: { readonly name: string; readonly tokens: readonly (string | null)[]; readonly expect_verdict: string; readonly expect_r: number | null }[] = [
    { name: "six_identical_legal", tokens: [S, S, S, S, S, S], expect_verdict: "D3_B_NOISE_STABILITY_GATE_PASS", expect_r: 6 },
    { name: "five_same_plus_one_different_legal", tokens: [S, S, S, S, S, U], expect_verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE", expect_r: null },
    { name: "four_same_plus_two_other", tokens: [S, S, S, S, U, O], expect_verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE", expect_r: null },
    { name: "unique_modal_tie", tokens: [S, S, S, U, U, U], expect_verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE", expect_r: null },
    { name: "one_invalid", tokens: [S, S, S, S, S, null], expect_verdict: "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS", expect_r: null },
    { name: "six_invalid", tokens: [null, null, null, null, null, null], expect_verdict: "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS", expect_r: null }
  ];
  const results = cases.map((c) => {
    const outcome = classifyD3BNoiseStabilityV0(mk(c.tokens));
    // widened to number | null so the "never 14" assertion is falsifiable rather than vacuous
    const observedR: number | null = outcome.r_confirm_B;
    return {
      case: c.name,
      expected_verdict: c.expect_verdict,
      observed_verdict: outcome.pilot_verdict,
      expected_r: c.expect_r,
      observed_r: observedR,
      target_authorised: outcome.target_authorised,
      modal_count: outcome.modal_count,
      tie: outcome.unique_modal_tie,
      pass: outcome.pilot_verdict === c.expect_verdict && outcome.r_confirm_B === c.expect_r
    };
  });
  if (results.some((r) => !r.pass)) fail("D3_REV4_GATE_AUDIT_FAILED", JSON.stringify(results.filter((r) => !r.pass)));
  const anyPathYieldsFourteen = results.some((r) => r.observed_r === 14);
  if (anyPathYieldsFourteen) fail("D3_REV4_A_PATH_STILL_YIELDS_R_14", JSON.stringify(results));
  const onlySixAuthorises = results.filter((r) => r.target_authorised).map((r) => r.case).join(",") === "six_identical_legal";
  if (!onlySixAuthorises) fail("D3_REV4_TARGET_AUTHORISED_BY_A_NON_PASSING_PILOT", JSON.stringify(results));

  // The superseded classifier still exists for the historical record, and still returns 14 — which is
  // exactly why the authoritative one had to change. Recorded so the difference is visible.
  const supersededOnFivePlusOne = classifyD3BNoisePilotV0(mk([S, S, S, S, S, U]));
  const gateOnFivePlusOne = classifyD3BNoiseStabilityV0(mk([S, S, S, S, S, U]));

  // ---- B. the noise request is unchanged -------------------------------------------------------
  const selectedId = selectNoiseFixtureIdV0();
  const fixtureIndex = D3B_QUALIFICATION_FIXTURES.findIndex((f) => f.fixture_id === selectedId);
  const artifactName = `fixture-${["A", "B", "C"][fixtureIndex]}-request.json`;
  const artifact = JSON.parse(await readFile(join(qualificationDir, artifactName), "utf8")) as { fixture_id: string; request_hash: string; request: unknown };
  const recomputedHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, artifact.request as never));
  const requestAudit = {
    artifact: artifactName,
    fixture_id: artifact.fixture_id,
    fixture_selection_changed_by_revision_4: false,
    recorded_hash: artifact.request_hash,
    recomputed_hash: recomputedHash,
    matches_the_revision_3_frozen_identity: recomputedHash === FROZEN_NOISE_REQUEST_HASH && artifact.request_hash === FROZEN_NOISE_REQUEST_HASH
  };
  if (!requestAudit.matches_the_revision_3_frozen_identity) fail("D3_REV4_NOISE_REQUEST_CHANGED", JSON.stringify(requestAudit));

  // ---- C. prior exposure -----------------------------------------------------------------------
  const dataset = JSON.parse(await readFile(join(qualificationDir, "qualification-dataset.json"), "utf8")) as { trials: { group: string }[] };
  const priorCallsOnThisRequest = dataset.trials.filter((t) => t.group === selectedId).length;
  const exposure = {
    same_request_was_called_during_qualification: priorCallsOnThisRequest > 0,
    prior_call_count_observed: priorCallsOnThisRequest,
    prior_call_count_frozen: D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_call_count,
    agrees_with_the_frozen_record: priorCallsOnThisRequest === D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_call_count,
    prior_calls_included_in_the_noise_pilot_dataset: false,
    prior_calls_are_target_evidence: false,
    new_six_calls_are_a_prospectively_frozen_independent_batch: true,
    limitation_stated_plainly: D3B_NOISE_REQUEST_PRIOR_EXPOSURE.limitation_stated_plainly
  };
  if (!exposure.agrees_with_the_frozen_record) fail("D3_REV4_PRIOR_EXPOSURE_MISRECORDED", JSON.stringify(exposure));

  const rev4 = await deriveD3Rev4ManifestV0();
  const audit = {
    stage: "D3_REVISION_4",
    model_calls: 0,
    section_a_stability_gate: {
      classifier: "classifyD3BNoiseStabilityV0 (frozen revision 4)",
      called_not_reimplemented: true,
      cases: results,
      any_path_yields_r_14: anyPathYieldsFourteen,
      only_six_mutually_agreeing_calls_authorise_the_target: onlySixAuthorises,
      r_values_reachable: D3B_NOISE_STABILITY_GATE.r_values_reachable,
      superseded_classifier_on_five_plus_one: supersededOnFivePlusOne.pilot_verdict,
      superseded_classifier_r: supersededOnFivePlusOne.r_confirm_B,
      gate_classifier_on_five_plus_one: gateOnFivePlusOne.pilot_verdict,
      gate_classifier_r: gateOnFivePlusOne.r_confirm_B,
      the_difference_is_the_point:
        "the superseded classifier funds fourteen further calls for a pilot that already fails a unanimity target; the gate declines to fund the target at all"
    },
    section_b_noise_request: requestAudit,
    section_c_prior_exposure: exposure,
    target_authorised_this_round: false,
    target_calls: 0,
    budget: D3_REV4_BUDGET,
    verdict: "D3_REV4_STABILITY_GATE_FROZEN"
  };
  await write("d3-rev4-audit.json", audit);
  await write("contract-rev4-manifest.json", rev4);
  await write("D3_REV4_VERDICT.json", {
    stage: "D3_REVISION_4",
    model_calls: 0,
    verdicts: [
      "D3_PREREGISTRATION_FINALIZED_REV4",
      "D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER",
      "D3_B_NON_TARGET_NOISE_PILOT_AUTHORISED",
      "D3_B_TARGET_NOT_EXECUTED"
    ],
    noise_rule: "stability gate; the only reachable r_confirm_B is 6, and only on six mutually agreeing calls",
    superseded: { branch: "5 -> r_confirm_B = 14", retired_prospectively: true, at: "SUPERSEDED_BEFORE_ANY_D3_B_NOISE_OR_TARGET_OUTPUT", history_retained: true },
    target_scientific_meaning_unchanged: true,
    target_calls: 0,
    target_not_executed: true,
    budget: { complete_success_path: 21, absolute_maximum: 21, stops_at_if_the_gate_fails: 15 },
    noise_fixture: selectedId,
    noise_request_hash: recomputedHash,
    prior_qualification_calls_on_that_request: priorCallsOnThisRequest,
    next_round_may_only:
      "run the six-call non-target noise pilot on the frozen noise request, freeze its dataset before scoring, and classify it with classifyD3BNoiseStabilityV0; on PASS, freeze the six target calls, otherwise stop",
    next_round_may_not: ["call the D3-B target request", "widen r beyond 6", "execute D3-A", "execute D2-B", "modify any frozen artifact"],
    revision_3_manifest_hash_preserved: rev4.revision_3_manifest_hash_preserved,
    rev4_manifest_hash: rev4.manifest_hash
  });

  process.stdout.write(
    `D3_PREREGISTRATION_FINALIZED_REV4 | D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER\n` +
      `gate: only-six-agreeing-calls authorises the target = ${String(onlySixAuthorises)} | any path yields r=14 = ${String(anyPathYieldsFourteen)}\n` +
      `superseded 5+1 -> r=${String(supersededOnFivePlusOne.r_confirm_B)} ; gate 5+1 -> ${gateOnFivePlusOne.pilot_verdict}\n` +
      `noise request unchanged: ${String(requestAudit.matches_the_revision_3_frozen_identity)} (${recomputedHash})\n` +
      `prior qualification calls on it: ${String(priorCallsOnThisRequest)} | budget max ${String(D3_REV4_BUDGET.absolute_maximum)}\n` +
      `${rev4.manifest_hash}\nD3_MODEL_CALLS = 9 (0 this round)\n`
  );
}

await main();
