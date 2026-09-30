/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C0a NOISE/STABILITY IMPLEMENTATION AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-cross-expression-d4/d4c0a-noise-implementation.ts <qualificationDir> <outdir>
 *
 * 1. the frozen-decision audit, extracted from the frozen modules rather than recalled;
 * 2. the selected noise request, resolved by the frozen rule and verified against the QUALIFICATION-era
 *    frozen bytes (reuse, never re-render);
 * 3. the prior-exposure record;
 * 4. the classifier's conformance, including the hard rule that correctess is not stability;
 * 5. a mutation harness that FIRST proves each mutation changed the intended bytes/value, and only then
 *    asserts the gate behaves differently;
 * 6. the synthetic matrix, the compatibility report, the implementation manifest and the trial plan.
 *
 * NO PROVIDER CALL IS MADE. The trial plan and its hash are frozen so that a later round executes it.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ARMS,
  D4C0A_NOISE_GATE,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0
} from "./contract.ts";
import { D4C0A_REV1_NOISE_DIVISION_OF_LABOUR, D4C0A_REV1_R6_TABLE, scoreD4C0ARev1V0 } from "./contract-rev1-directional-majority.ts";
import {
  D4C0A_NOISE_CLASSIFIER,
  D4C0A_NOISE_EVIDENCE_CLASS,
  D4C0A_NOISE_FROZEN_DECISION_AUDIT,
  D4C0A_NOISE_SELECTION_RESOLUTION,
  D4C0A_NOISE_TARGET_AUTHORISATION,
  deriveD4Rev3ManifestV0
} from "./contract-rev3-noise-executable.ts";
import {
  D4C0A_NOISE_INTEGRITY_REQUIREMENTS,
  classifyD4C0ANoiseStabilityV0,
  type D4C0ANoiseTrialV0
} from "./noise-classifier-d4c0a.ts";
import { buildD4C0ABaseRequestV0, buildD4C0AStanceTransferRequestV0 } from "./transformer-d4c0a.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const CLASSIFIER_SOURCE = "research/experiments/belief-cross-expression-d4/noise-classifier-d4c0a.ts";
const NOISE_TRIAL_IDS = ["NOISE-001", "NOISE-002", "NOISE-003", "NOISE-004", "NOISE-005", "NOISE-006"] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

const sixOf = (token: string | null) => Array.from({ length: 6 }, () => token);

async function main(): Promise<void> {
  const qualificationDir = process.argv[2];
  const outdir = process.argv[3];
  if (qualificationDir === undefined || outdir === undefined) fail("D4_C0A_NOISE_USAGE", "usage: <qualificationDir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the frozen-decision audit ---------------------------------------------------------------
  const decisionAudit = {
    ...D4C0A_NOISE_FROZEN_DECISION_AUDIT,
    extraction_method: "read from the frozen modules; no recollection of any earlier line's implementation",
    verdict:
      D4C0A_NOISE_FROZEN_DECISION_AUDIT.scientific_decisions_not_frozen.length === 0
        ? "D4_C0A_NOISE_SCIENTIFIC_DECISIONS_ALL_FROZEN"
        : "D4_C0A_NOISE_DESIGN_BLOCKED_BY_MISSING_FROZEN_DECISION"
  };
  if (decisionAudit.verdict !== "D4_C0A_NOISE_SCIENTIFIC_DECISIONS_ALL_FROZEN") {
    fail("D4_C0A_NOISE_DESIGN_BLOCKED_BY_MISSING_FROZEN_DECISION", JSON.stringify(decisionAudit));
  }
  await write("frozen-noise-decision-audit.json", decisionAudit);

  // ---- 3. selected noise request: reuse the frozen qualification bytes ----------------------------
  const fixture = D4C0A_QUALIFICATION_FIXTURES[0] as unknown as {
    fixture_id: string;
    binding: Parameters<typeof buildD4C0ABaseRequestV0>[0];
    expected_token: string;
  };
  const letters = ["A", "B", "C"];
  const artifactName = `qualification-request-${letters[0] as string}.json`;
  const artifact = JSON.parse(await readFile(join(qualificationDir, artifactName), "utf8")) as {
    fixture_id: string;
    request_hash: string;
    request: ModelTransportRequestV0;
  };
  const recomputed = String(await hashEnvelope(REQUEST_HASH_PROJECTION, artifact.request as unknown));
  // the frozen selection resolves to this fixture by manifest order, and the qualification-era hash must match
  const rebuild = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(fixture.binding));
  const rebuiltHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, rebuild as unknown));
  const selectedRequest = {
    rule: D4C0A_NOISE_SELECTION_RESOLUTION.rule,
    resolved_fixture_id: D4C0A_NOISE_SELECTION_RESOLUTION.resolved_fixture_id,
    artifact: artifactName,
    fixture_id_in_the_artifact: artifact.fixture_id,
    qualification_era_request_hash: artifact.request_hash,
    recomputed_from_the_frozen_artifact_bytes: recomputed,
    deterministic_rebuild_hash: rebuiltHash,
    reuse_matches_the_qualification_identity: recomputed === artifact.request_hash,
    a_deterministic_rebuild_reproduces_the_same_bytes: rebuiltHash === artifact.request_hash,
    re_rendered_as_a_new_request: false,
    is_a_treatment_request: false,
    is_the_canonical_pair: false,
    verdict: "D4_C0A_NOISE_REQUEST_RESOLVED_AND_REUSABLE"
  };
  if (!selectedRequest.reuse_matches_the_qualification_identity || !selectedRequest.a_deterministic_rebuild_reproduces_the_same_bytes) {
    fail("D4_C0A_NOISE_REQUEST_IDENTITY_MISMATCH", JSON.stringify(selectedRequest));
  }
  if (selectedRequest.is_a_treatment_request || selectedRequest.is_the_canonical_pair) {
    fail("D4_C0A_NOISE_REQUEST_IS_NOT_NON_TARGET", JSON.stringify(selectedRequest));
  }
  await write("selected-noise-request-audit.json", selectedRequest);

  // the target request hash, needed by the integrity check (built offline; NOT called)
  const targetRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_SUPPORT.binding));
  const targetHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, targetRequest as unknown));

  // ---- prior exposure ----------------------------------------------------------------------------
  const qualificationDataset = JSON.parse(await readFile(join(qualificationDir, "qualification-dataset.json"), "utf8")) as {
    trials: { fixture_id: string }[];
  };
  const priorCalls = qualificationDataset.trials.filter((t) => t.fixture_id === fixture.fixture_id).length;
  const exposure = {
    same_request_was_called_during_qualification: priorCalls > 0,
    prior_call_count: priorCalls,
    prior_calls_belong_only_to: "D4-C0a qualification evidence",
    prior_outputs_enter_the_noise_dataset: false,
    prior_outputs_affect_the_stability_classification: false,
    new_noise_batch_denominator: D4C0A_NOISE_GATE.planned_calls,
    the_stimulus_has_been_seen_before: true,
    may_not_be_described_as_never_seen: true,
    what_this_does_not_undermine:
      "the gate reads agreement among the six NEW calls; prior exposure cannot make six identical answers more or less agreeing than they are"
  };
  await write("prior-exposure-report.json", exposure);

  // ---- 4. classifier conformance ------------------------------------------------------------------
  const good = sixOf("SEMANTICALLY_UNRELATED_OK".replace("SEMANTICALLY_UNRELATED_OK", "UNCERTAIN_B"));
  const mkNoise = (tokens: readonly (string | null)[]) =>
    tokens.map((token, i) => ({ trial_id: NOISE_TRIAL_IDS[i] as string, request_hash: artifact.request_hash, parsed_token: token }));
  const baselineTrials: D4C0ANoiseTrialV0[] = mkNoise(good);
  const runGate = (trials: readonly D4C0ANoiseTrialV0[]) =>
    classifyD4C0ANoiseStabilityV0({ trials, selected_noise_request_hash: artifact.request_hash, target_request_hash: targetHash });
  const baselineOutcome = runGate(baselineTrials);
  if (baselineOutcome.outcome !== "PASS") fail("D4_C0A_NOISE_BASELINE_NOT_PASS", JSON.stringify(baselineOutcome));
  await write("noise-classifier-conformance.json", {
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    input_was_the_reused_frozen_request_identity: true,
    baseline: baselineOutcome,
    integrity_requirements: D4C0A_NOISE_INTEGRITY_REQUIREMENTS,
    reads_only: D4C0A_NOISE_CLASSIFIER.may_read,
    verdict: "D4_C0A_NOISE_CLASSIFIER_CONFORMANT"
  });

  // ---- 5. mutation harness: prove the mutation changed bytes, THEN that the gate changed ----------
  /**
   * Rows are of two kinds, and the distinction matters:
   *   FALSIFYING      — must change the intended value AND must change the gate's result;
   *   POSITIVE_CONTROL — must change the intended value AND must NOT change the gate's result, because
   *                      the change is exactly the one the frozen design says must be irrelevant.
   * The all-same-different-token row is the second kind: it demonstrates that stability does not depend
   * on WHICH legal token the six calls agree on.
   */
  const mutationRows: {
    mutation: string;
    kind: "FALSIFYING" | "POSITIVE_CONTROL";
    changed_intended_value: boolean;
    baseline_value: unknown;
    mutated_value: unknown;
    gate_before: string;
    gate_after: string;
    gate_changed: boolean;
    expected_to_change_the_gate: boolean;
    pass: boolean;
  }[] = [];
  const recordRow = (
    kind: "FALSIFYING" | "POSITIVE_CONTROL",
    mutation: string,
    mutated: readonly D4C0ANoiseTrialV0[],
    describe: (before: readonly D4C0ANoiseTrialV0[], after: readonly D4C0ANoiseTrialV0[]) => { changed: boolean; before: unknown; after: unknown }
  ) => {
    const before = baselineTrials;
    const observed = describe(before, mutated);
    const after = runGate(mutated);
    const gateChanged = after.outcome !== baselineOutcome.outcome || after.gate_verdict !== baselineOutcome.gate_verdict;
    const shouldChange = kind === "FALSIFYING";
    mutationRows.push({
      mutation,
      kind,
      changed_intended_value: observed.changed,
      baseline_value: observed.before,
      mutated_value: observed.after,
      gate_before: baselineOutcome.outcome,
      gate_after: after.outcome,
      gate_changed: gateChanged,
      expected_to_change_the_gate: shouldChange,
      pass: observed.changed && gateChanged === shouldChange
    });
  };
  const recordMutation = (mutation: string, mutated: readonly D4C0ANoiseTrialV0[], describe: (before: readonly D4C0ANoiseTrialV0[], after: readonly D4C0ANoiseTrialV0[]) => { changed: boolean; before: unknown; after: unknown }) =>
    recordRow("FALSIFYING", mutation, mutated, describe);

  recordMutation("wrong_request_hash", baselineTrials.map((t, i) => (i === 0 ? { ...t, request_hash: "sha256:0000" } : t)), (b, a) => ({
    changed: a[0]?.request_hash !== b[0]?.request_hash,
    before: b[0]?.request_hash,
    after: a[0]?.request_hash
  }));
  recordMutation("target_hash_substituted", baselineTrials.map((t, i) => (i === 1 ? { ...t, request_hash: targetHash } : t)), (b, a) => ({
    changed: a[1]?.request_hash === targetHash && a[1]?.request_hash !== b[1]?.request_hash,
    before: b[1]?.request_hash,
    after: a[1]?.request_hash
  }));
  recordMutation("missing_trial", baselineTrials.slice(0, 5), (b, a) => ({ changed: a.length !== b.length, before: b.length, after: a.length }));
  recordMutation("duplicate_identity", baselineTrials.map((t, i) => (i === 1 ? { ...t, trial_id: NOISE_TRIAL_IDS[0] as string } : t)), (b, a) => ({
    changed: new Set(a.map((t) => t.trial_id)).size !== new Set(b.map((t) => t.trial_id)).size,
    before: new Set(b.map((t) => t.trial_id)).size,
    after: new Set(a.map((t) => t.trial_id)).size
  }));
  recordMutation("extra_trial", [...baselineTrials, { trial_id: "NOISE-007", request_hash: artifact.request_hash, parsed_token: "UNCERTAIN_B" }], (b, a) => ({
    changed: a.length !== b.length,
    before: b.length,
    after: a.length
  }));
  recordMutation("one_invalid", baselineTrials.map((t, i) => (i === 4 ? { ...t, parsed_token: null } : t)), (b, a) => ({
    changed: a[4]?.parsed_token !== b[4]?.parsed_token && a[4]?.parsed_token === null,
    before: b[4]?.parsed_token,
    after: a[4]?.parsed_token
  }));
  recordMutation("one_different_legal_token", baselineTrials.map((t, i) => (i === 3 ? { ...t, parsed_token: "SUPPORTS_B" } : t)), (b, a) => ({
    changed: a[3]?.parsed_token !== b[3]?.parsed_token,
    before: b[3]?.parsed_token,
    after: a[3]?.parsed_token
  }));
  const allSupport = mkNoise(sixOf("SUPPORTS_B"));
  recordRow("POSITIVE_CONTROL", "all_same_but_a_different_legal_token", allSupport, (b, a) => ({
    changed: new Set(a.map((t) => t.parsed_token)).size === 1 && a[0]?.parsed_token !== b[0]?.parsed_token,
    before: b[0]?.parsed_token,
    after: a[0]?.parsed_token
  }));
  recordMutation("out_of_vocabulary_token", baselineTrials.map((t, i) => (i === 2 ? { ...t, parsed_token: "ENDORSES_STRONGLY" } : t)), (b, a) => ({
    changed: a[2]?.parsed_token === "ENDORSES_STRONGLY" && a[2]?.parsed_token !== b[2]?.parsed_token,
    before: b[2]?.parsed_token,
    after: a[2]?.parsed_token
  }));

  const mutationsThatDidNotChange = mutationRows.filter((r) => !r.changed_intended_value).map((r) => r.mutation);
  const rowsThatBehavedWrongly = mutationRows.filter((r) => !r.pass).map((r) => ({ mutation: r.mutation, kind: r.kind, gate_changed: r.gate_changed }));
  if (mutationsThatDidNotChange.length > 0) fail("D4_C0A_MUTATION_DID_NOT_MUTATE", JSON.stringify(mutationsThatDidNotChange));
  if (rowsThatBehavedWrongly.length > 0) fail("D4_C0A_MUTATION_ROW_BEHAVED_WRONGLY", JSON.stringify(rowsThatBehavedWrongly));
  await write("mutation-falsifiability-audit.json", {
    method:
      "each mutation is applied, then FIRST verified to have changed the intended bytes or value, and only then checked to change the gate's result — because a mutation that mutates nothing proves nothing",
    mutations: mutationRows,
    every_row_changed_the_intended_value: true,
    falsifying_mutations_changed_the_gate: mutationRows.filter((r) => r.kind === "FALSIFYING").every((r) => r.gate_changed),
    positive_controls_did_not_change_the_gate: mutationRows.filter((r) => r.kind === "POSITIVE_CONTROL").every((r) => !r.gate_changed),
    positive_control_meaning:
      "the all-same-different-token row must NOT change the gate's result: that is the evidence that stability does not depend on WHICH legal token the six calls agree on",
    forbidden_patterns_avoided: [
      "self-comparison",
      "impossible type comparison",
      "a mutation that does not actually mutate",
      "a single-occurrence String.replace where several occurrences exist"
    ],
    verdict: "D4_C0A_MUTATIONS_ARE_REAL_AND_FALSIFYING"
  });

  // ---- 13. the synthetic matrix, including correctness-is-not-stability ----------------------------
  const cases: { readonly id: string; readonly tokens: readonly (string | null)[]; readonly expect: "PASS" | "STOP" }[] = [
    { id: "six_identical_token_A", tokens: sixOf("SUPPORTS_B"), expect: "PASS" },
    { id: "six_identical_token_B", tokens: sixOf("OPPOSES_B"), expect: "PASS" },
    { id: "six_identical_token_C", tokens: sixOf("UNCERTAIN_B"), expect: "PASS" },
    { id: "five_plus_one_legal", tokens: ["UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "SUPPORTS_B"], expect: "STOP" },
    { id: "four_plus_two", tokens: ["UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "SUPPORTS_B", "OPPOSES_B"], expect: "STOP" },
    { id: "three_three_tie", tokens: ["UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B"], expect: "STOP" },
    { id: "one_invalid", tokens: ["UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B", null], expect: "STOP" },
    { id: "all_invalid", tokens: sixOf(null), expect: "STOP" }
  ];
  const matrix = cases.map((c) => {
    const outcome = runGate(mkNoise(c.tokens));
    return {
      case: c.id,
      expected: c.expect,
      observed: outcome.outcome,
      verdict: outcome.gate_verdict,
      modal: outcome.unique_modal,
      modal_count: outcome.modal_count,
      matched_the_fixture_expected: outcome.modal_token_matched_the_fixture_expected,
      target_authorised: outcome.target_authorised,
      pass: outcome.outcome === c.expect
    };
  });
  const integrityCase = runGate(baselineTrials.slice(0, 5));
  // The selected fixture D4C0A-QF-A-SUPPORT-TRANSFER expects SUPPORTS_B, so that row MATCHES and proves
  // nothing about correctness-independence. The rows that do are the other two: identical legal tokens
  // that are NOT the fixture's expected token and still PASS.
  const mismatchRowsStillPassing = matrix.filter(
    (m) => m.observed === "PASS" && m.matched_the_fixture_expected === false
  );
  const correctnessIsNotStability = mismatchRowsStillPassing.length >= 2;
  if (matrix.some((m) => !m.pass)) fail("D4_C0A_NOISE_MATRIX_FAILED", JSON.stringify(matrix.filter((m) => !m.pass)));
  if (!correctnessIsNotStability) fail("D4_C0A_CORRECTNESS_LEAKED_INTO_STABILITY", JSON.stringify(matrix));
  const reachableR = new Set(matrix.map(() => D4C0A_NOISE_TARGET_AUTHORISATION.r_after_the_gate));
  await write("synthetic-noise-classifier-audit.json", {
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    cases: matrix,
    integrity_failure_case: { observed: integrityCase.outcome, verdict: integrityCase.gate_verdict, integrity_ok: integrityCase.integrity_ok },
    correctness_is_not_stability: {
      demonstrated: true,
      rows: mismatchRowsStillPassing.map((m) => m.case),
      detail:
        "the selected fixture D4C0A-QF-A-SUPPORT-TRANSFER expects SUPPORTS_B, so the SUPPORTS_B row matches and is uninformative here; the OPPOSES_B and UNCERTAIN_B rows have modals that are NOT the fixture's expected token and they still PASS, which is the evidence",
      why: "qualification owns correctness; this gate owns stability"
    },
    reachable_r_values: [...reachableR],
    adaptive_replication_present: false,
    verdict: "D4_C0A_NOISE_CLASSIFIER_MATRIX_PROVEN"
  });

  // ---- compatibility with the target scorer --------------------------------------------------------
  const six = (t: string) => Array.from({ length: 6 }, () => t);
  const targetRow = scoreD4C0ARev1V0({
    trials: [
      ...six("SUPPORTS_B").map((t, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as const, parsed_token: t })),
      ...six("OPPOSES_B").map((t, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as const, parsed_token: t }))
    ],
    r_per_arm: 6
  });
  await write("noise-target-scorer-compatibility.json", {
    noise_gate_measures: D4C0A_NOISE_EVIDENCE_CLASS.measures,
    target_scorer_measures: D4C0A_REV1_NOISE_DIVISION_OF_LABOUR.target_scorer_task,
    thresholds_may_differ_because: D4C0A_REV1_NOISE_DIVISION_OF_LABOUR.why_the_target_allows_two_deviations_when_the_gate_demands_six_agreeing_calls,
    gate_can_set_r: false,
    r_before_the_gate: 6,
    r_after_the_gate: D4C0A_NOISE_TARGET_AUTHORISATION.r_after_the_gate,
    target_planned_calls: D4C0A_REV1_R6_TABLE.target_calls,
    target_scorer_reference_row: { pattern: "perfect polar transfer", outcome: targetRow.outcome_class, predicted_counts: targetRow.arm_predicted_counts },
    budget_unchanged: D4C0A_REV1_R6_TABLE.budget_unchanged_by_this_revision,
    verdict: "D4_C0A_NOISE_GATE_IS_SCORER_COMPATIBLE"
  });

  // ---- 14. implementation identity -----------------------------------------------------------------
  const classifierSourceHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { source: await readFile(CLASSIFIER_SOURCE, "utf8") }));
  const rev3 = await deriveD4Rev3ManifestV0();
  const implementationManifest = {
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    classifier_source_hash: classifierSourceHash,
    selected_noise_request_hash: artifact.request_hash,
    selected_fixture_id: fixture.fixture_id,
    invalid_policy_identity: D4C0A_NOISE_GATE.invalid_verdict,
    collection_integrity_checker_identity: D4C0A_NOISE_INTEGRITY_REQUIREMENTS,
    target_authorisation_identity: D4C0A_NOISE_TARGET_AUTHORISATION.rule,
    rev3_manifest_hash: rev3.manifest_hash,
    revision_2_manifest_hash_preserved: rev3.revision_2_manifest_hash_preserved,
    revision_0_manifest_hash_preserved: rev3.revision_0_manifest_hash_preserved,
    noise_outputs_seen_before_implementation_freeze: false,
    target_outputs_seen_before_noise_implementation_freeze: false,
    implementation_frozen: true
  };
  await write("noise-implementation-manifest.json", implementationManifest);
  await write("contract-rev3-manifest.json", rev3);

  // ---- 15. the frozen trial plan ---------------------------------------------------------------------
  const schedule = {
    stage: "D4_C0A_NOISE_STABILITY",
    planned_calls: D4C0A_NOISE_GATE.planned_calls,
    all_six_reference_the_same_request_hash: artifact.request_hash,
    fixture_id: fixture.fixture_id,
    is_a_treatment_request: false,
    trials: NOISE_TRIAL_IDS.map((trial_id, index) => ({ position: index + 1, trial_id, request_hash: artifact.request_hash })),
    replicate_ordinal_in_the_model_facing_bytes: false,
    not_yet_executed: true
  };
  await writeFile(join(outdir, "D4_C0A_NOISE_SCHEDULE.json"), `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
  const scheduleContent = await readFile(join(outdir, "D4_C0A_NOISE_SCHEDULE.json"), "utf8");
  const scheduleHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C0A_NOISE_SCHEDULE.json", content: scheduleContent }));
  await write("d4-c0a-noise-schedule-hash.json", {
    schedule_hash: scheduleHash,
    planned_calls: D4C0A_NOISE_GATE.planned_calls,
    selected_noise_request_hash: artifact.request_hash,
    all_trials_share_one_request_hash: new Set(schedule.trials.map((t) => t.request_hash)).size === 1
  });
  await write("D4_C0A_NOISE_IMPLEMENTATION_VERDICT.json", {
    stage: "D4_C0a-noise-implementation",
    model_calls: 0,
    final_states: [
      "D4_C0A_NOISE_STABILITY_IMPLEMENTED",
      "D4_C0A_NOISE_STABILITY_EXECUTION_AUTHORISED",
      "D4_C0A_TARGET_NOT_EXECUTED",
      "D4_C0B_NOT_PREREGISTERED",
      "LINK_4_REMAINS_LOCKED",
      "CHARACTEROS_UNMODIFIED"
    ],
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    classifier_source_hash: classifierSourceHash,
    selected_noise_request: { fixture_id: fixture.fixture_id, request_hash: artifact.request_hash },
    schedule_hash: scheduleHash,
    token_vocabulary: D4C0A_TOKENS,
    reachable_r_values: [6],
    target_authorisation_rule: D4C0A_NOISE_TARGET_AUTHORISATION.rule,
    next_round_may_only: "execute the six frozen noise calls, freeze the dataset before classification, and classify with the frozen classifier",
    next_round_may_not: ["call the target", "design or run C0b", "change r", "modify CharacterOS", "modify the classifier or its rule"]
  });

  process.stdout.write(
    `D4_C0A_NOISE_STABILITY_IMPLEMENTED | D4_C0A_NOISE_STABILITY_EXECUTION_AUTHORISED | D4_C0A_TARGET_NOT_EXECUTED\n` +
      `scientific decisions frozen: ${String(D4C0A_NOISE_FROZEN_DECISION_AUDIT.scientific_decisions_extracted.length)}/7, missing: 0\n` +
      `noise request reused from qualification: ${artifact.request_hash}\n` +
      `matrix: ${String(matrix.length)} cases pass; correctness-is-not-stability demonstrated: ${String(correctnessIsNotStability)}\n` +
      `mutations: ${String(mutationRows.length)}, each verified to change the value before being checked: true\n` +
      `reachable r: [6] | schedule ${scheduleHash}\nMODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
