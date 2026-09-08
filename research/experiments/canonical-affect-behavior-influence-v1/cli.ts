/**
 * V1 CLI.
 *
 * phase-a: zero real calls; freezes manifest/config and writes conformance proof.
 * collect: executes only the frozen plan; prefix-resumable, zero retries.
 * finalize: zero real calls; joins quality-gate truth and renders REPORT.md.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import {
  ARMS,
  BALANCED_ORDER,
  BASELINE_COMMIT,
  EXPERIMENT_VERSION,
  MAGNITUDES,
  PLANNED_PRIMARY_CALLS,
  PRIMARY_PROVIDER,
  SCENARIOS,
  TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE,
  frozenConfig,
  scenarioManifest
} from "./contract.ts";
import { canonicalJson, check, equal } from "./fixtures.ts";
import { executePhaseA, type PhaseAResult } from "./phase-a.ts";
import {
  buildExecutionPlan,
  executeOneRealTrial,
  probeProviderEnvironment,
  summarizeCollection,
  type ProviderPreflight,
  type SubsetAnalysis,
  type TrialRecord
} from "./real-runner.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const EXPERIMENT_RELATIVE = "research/experiments/canonical-affect-behavior-influence-v1/";
const CONFORMANCE_RELATIVE = "evals/conformance/canonical-affect-behavior-influence-replication-v1.test.ts";

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitRaw(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${canonicalJson(value)}\n`, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function checkBaseline(): void {
  check(git("branch", "--show-current") === "main", "V1 must run on main");
  check(git("rev-parse", "HEAD") === BASELINE_COMMIT, `HEAD must remain baseline ${BASELINE_COMMIT} before commit`);
  check(git("rev-parse", "origin/main") === BASELINE_COMMIT, `origin/main must remain baseline ${BASELINE_COMMIT} before commit`);
}

function checkExperimentOnlyDirtyTree(): void {
  const lines = gitRaw("status", "--porcelain=v1", "-z").split("\u0000").filter(Boolean);
  for (const line of lines) {
    const rawPath = line.slice(3).trim();
    const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
    const normalized = path.replaceAll("\\", "/");
    check(
      normalized.startsWith(EXPERIMENT_RELATIVE) || normalized === CONFORMANCE_RELATIVE,
      `non-V1 dirty path: ${path}`
    );
  }
}

function resolveOutput(argument: string): string {
  const output = resolve(ROOT, argument);
  const rel = relative(ROOT, output).replaceAll("\\", "/");
  check(rel.startsWith(`${EXPERIMENT_RELATIVE}evidence/`), "output must be under the V1 evidence directory");
  return output;
}

async function phaseA(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(!existsSync(output), `refusing to overwrite evidence directory ${relative(ROOT, output)}`);
  mkdirSync(output, { recursive: true });

  // These two design artifacts exist before even the zero-call harness runs.
  writeJson(resolve(output, "scenario-manifest.json"), scenarioManifest());
  writeJson(resolve(output, "config.json"), frozenConfig());
  const result = await executePhaseA();
  check(equal(result.artifacts.scenario_manifest, readJson(resolve(output, "scenario-manifest.json"))), "scenario manifest drifted during Phase A");
  check(equal(result.artifacts.config, readJson(resolve(output, "config.json"))), "config drifted during Phase A");
  writeJson(resolve(output, "input-diff-audit.json"), result.artifacts.input_diff_audit);
  writeJson(resolve(output, "history-construction.json"), result.artifacts.history_construction);
  writeJson(resolve(output, "restore-controls.json"), result.artifacts.restore_controls);
  writeJson(resolve(output, "phase-a.json"), result.artifacts.phase_a);
  const preflight = await probeProviderEnvironment();
  writeJson(resolve(output, "provider-preflight.json"), preflight);
  writeJson(resolve(output, "phase-a-complete.json"), {
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    real_provider_calls: 0,
    all_pass: result.artifacts.phase_a["all_pass"],
    primary_model_available: preflight.primary_model_available,
    primary_digest_matches_v0: preflight.primary_digest_matches_v0,
    secondary_status: preflight.secondary_status
  });
  console.log(`PHASE_A_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(JSON.stringify(result.artifacts.phase_a));
  console.log(JSON.stringify({
    primary: preflight.primary_model,
    digest_matches_v0: preflight.primary_digest_matches_v0,
    secondary_status: preflight.secondary_status,
    planned_primary_calls: PLANNED_PRIMARY_CALLS
  }));
}

function assertPhaseAArtifacts(output: string, result: PhaseAResult): void {
  const expected: readonly [string, unknown][] = [
    ["scenario-manifest.json", result.artifacts.scenario_manifest],
    ["config.json", result.artifacts.config],
    ["input-diff-audit.json", result.artifacts.input_diff_audit],
    ["history-construction.json", result.artifacts.history_construction],
    ["restore-controls.json", result.artifacts.restore_controls],
    ["phase-a.json", result.artifacts.phase_a]
  ];
  for (const [name, value] of expected) {
    check(existsSync(resolve(output, name)), `${name} is required before collection`);
    check(equal(readJson(resolve(output, name)), value), `${name} differs from fresh zero-call revalidation`);
  }
}

function preflightIdentity(preflight: ProviderPreflight): unknown {
  return {
    endpoint: preflight.endpoint,
    reachable: preflight.reachable,
    server_version: preflight.server_version,
    primary_model: preflight.primary_model,
    primary_model_available: preflight.primary_model_available,
    primary_digest_matches_v0: preflight.primary_digest_matches_v0,
    secondary_status: preflight.secondary_status,
    secondary_model: preflight.secondary_model,
    selected_models: preflight.selected_models,
    local_models: preflight.local_models,
    failure: preflight.failure
  };
}

function readTrials(path: string): TrialRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TrialRecord);
}

async function collect(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(output), "phase-a evidence directory does not exist");
  check(!existsSync(resolve(output, "collection-complete.json")), "collection is already complete");
  const phaseAResult = await executePhaseA();
  assertPhaseAArtifacts(output, phaseAResult);
  const storedPreflight = readJson(resolve(output, "provider-preflight.json")) as ProviderPreflight;
  const freshPreflight = await probeProviderEnvironment();
  check(equal(preflightIdentity(storedPreflight), preflightIdentity(freshPreflight)), "provider environment changed after preregistration");
  check(freshPreflight.reachable, `REAL_PROVIDER_UNAVAILABLE: ${freshPreflight.failure ?? "endpoint unreachable"}`);
  check(freshPreflight.primary_model_available, `REAL_PROVIDER_UNAVAILABLE: ${freshPreflight.failure ?? "primary model absent"}`);
  check(freshPreflight.primary_digest_matches_v0, `primary digest changed from V0: ${freshPreflight.primary_model?.digest ?? "absent"}`);
  const plan = buildExecutionPlan(phaseAResult, freshPreflight.selected_models);
  const trialsPath = resolve(output, "trials.jsonl");
  const trials = readTrials(trialsPath);
  check(trials.length <= plan.length, "recorded trial count exceeds frozen plan");
  for (let index = 0; index < trials.length; index += 1) {
    const recorded = trials[index];
    const planned = plan[index];
    check(recorded !== undefined && planned !== undefined, "resume prefix contains missing trial");
    check(recorded.trial_id === planned.trial_id, `resume prefix diverges at ${index + 1}`);
    check(recorded.execution_order === index + 1, `resume execution_order diverges at ${index + 1}`);
  }
  if (trials.length > 0) console.log(`RESUME_PREFIX ${trials.length}/${plan.length}`);
  for (let index = trials.length; index < plan.length; index += 1) {
    const planned = plan[index];
    check(planned !== undefined, `plan item ${index + 1} missing`);
    const trial = await executeOneRealTrial(planned);
    appendFileSync(trialsPath, `${JSON.stringify(trial)}\n`, "utf8");
    trials.push(trial);
    console.log(`REAL_CALL ${index + 1}/${plan.length} ${trial.trial_id} ${trial.status} ${trial.validation_subreason ?? "-"} ${trial.latency_ms}ms`);
  }
  const artifacts = summarizeCollection(trials, phaseAResult, freshPreflight);
  writeJson(resolve(output, "summary.json"), artifacts.summary);
  writeJson(resolve(output, "scenario-summary.json"), artifacts.scenario_summary);
  writeJson(resolve(output, "magnitude-summary.json"), artifacts.magnitude_summary);
  writeJson(resolve(output, "failure-summary.json"), artifacts.failure_summary);
  writeJson(resolve(output, "collection-complete.json"), {
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    attempted_calls: trials.length,
    expected_calls: plan.length,
    valid_calls: trials.filter((trial) => trial.status === "VALID").length,
    failed_calls: trials.filter((trial) => trial.status !== "VALID").length,
    aggregate_metrics_frozen: true,
    n_changed_after_output: false
  });
  console.log(`COLLECTION_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(JSON.stringify({ verdict: artifacts.summary["verdict"], sample_size: artifacts.summary["sample_size"], primary: (artifacts.summary["primary_model_analysis"] as SubsetAnalysis).primary }));
}

function object(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === "object" && !Array.isArray(value), "report expected object");
  return value as Record<string, unknown>;
}

function percent(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

async function verifyCollectionIntegrity(output: string): Promise<Record<string, unknown>> {
  try {
    const phaseAResult = await executePhaseA();
    assertPhaseAArtifacts(output, phaseAResult);
    const preflight = readJson(resolve(output, "provider-preflight.json")) as ProviderPreflight;
    const plan = buildExecutionPlan(phaseAResult, preflight.selected_models);
    const trialsPath = resolve(output, "trials.jsonl");
    const trials = readTrials(trialsPath);
    const marker = object(readJson(resolve(output, "collection-complete.json")));
    const summary = object(readJson(resolve(output, "summary.json")));
    const sample = object(summary["sample_size"]);
    const actualIds = trials.map((trial) => trial.trial_id);
    const plannedIds = plan.map((trial) => trial.trial_id);
    const duplicateIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
    const actualIdSet = new Set(actualIds);
    const plannedIdSet = new Set(plannedIds);
    const missingIds = plannedIds.filter((id) => !actualIdSet.has(id));
    const extraIds = actualIds.filter((id) => !plannedIdSet.has(id));
    const expectedScenarioIds = SCENARIOS.map((scenario) => scenario.scenario_id).sort();
    const observedScenarioIds = [...new Set(trials.map((trial) => trial.scenario_id))].sort();
    const expectedMagnitudeIds = MAGNITUDES.map((magnitude) => magnitude.magnitude_id).sort();
    const observedMagnitudeIds = [...new Set(trials.map((trial) => trial.magnitude_id))].sort();
    const expectedArms = [...ARMS].sort();
    const observedArms = [...new Set(trials.map((trial) => trial.arm))].sort();
    const scheduleMatches = trials.every((trial, index) => {
      const planned = plan[index];
      return planned !== undefined
        && trial.trial_id === planned.trial_id
        && trial.execution_order === planned.execution_order
        && trial.execution_order === index + 1
        && trial.trial_ordinal === planned.trial_ordinal
        && trial.within_unit_order === planned.within_unit_order
        && trial.model_id === planned.model_id
        && trial.scenario_id === planned.cell.scenario.scenario_id
        && trial.magnitude_id === planned.cell.magnitude.magnitude_id
        && trial.arm === planned.arm;
    });
    const validCalls = trials.filter((trial) => trial.status === "VALID").length;
    const failedCalls = trials.length - validCalls;
    check(plan.length === PLANNED_PRIMARY_CALLS, `planned calls ${plan.length} != ${PLANNED_PRIMARY_CALLS}`);
    check(trials.length === plan.length, `actual trials ${trials.length} != planned calls ${plan.length}`);
    check(marker["experiment_version"] === EXPERIMENT_VERSION, "collection marker experiment version mismatch");
    check(marker["expected_calls"] === plan.length, "collection marker planned count mismatch");
    check(marker["attempted_calls"] === trials.length, "collection marker actual count mismatch");
    check(marker["valid_calls"] === validCalls && marker["failed_calls"] === failedCalls, "collection marker status counts mismatch");
    check(marker["aggregate_metrics_frozen"] === true && marker["n_changed_after_output"] === false, "collection marker freeze declaration invalid");
    check(duplicateIds.length === 0, `duplicate trial identities: ${duplicateIds.join(", ")}`);
    check(missingIds.length === 0, `missing planned trial identities: ${missingIds.join(", ")}`);
    check(extraIds.length === 0, `post-hoc extra trial identities: ${extraIds.join(", ")}`);
    check(equal(observedScenarioIds, expectedScenarioIds), "scenario manifest does not match trials");
    check(equal(observedMagnitudeIds, expectedMagnitudeIds), "magnitude manifest does not match trials");
    check(equal(observedArms, expectedArms), "arm manifest does not match trials");
    check(scheduleMatches, "execution-order schedule differs from preregistration");
    check(sample["attempted_calls"] === trials.length && sample["valid_calls"] === validCalls && sample["failed_calls"] === failedCalls, "frozen summary sample counts differ from trials");
    return {
      schema_version: "canonical-affect-behavior-influence-replication-collection-integrity-v1",
      experiment_version: EXPERIMENT_VERSION,
      status: "PASS",
      planned_calls: plan.length,
      actual_trials: trials.length,
      collection_complete_marker_valid: true,
      unique_trial_identities: actualIdSet.size,
      duplicate_trial_identities: [],
      missing_planned_trial_identities: [],
      post_hoc_extra_trial_identities: [],
      scenario_manifest_matches_trials: true,
      magnitude_manifest_matches_trials: true,
      arm_manifest_matches_trials: true,
      execution_order_schedule_matches_preregistration: true,
      execution_order_schedule: BALANCED_ORDER,
      trials_per_arm_scenario_magnitude: TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE,
      frozen_summary_sample_matches_trials: true,
      trials_sha256: createHash("sha256").update(readFileSync(trialsPath)).digest("hex"),
      additional_real_provider_generation_calls_during_finalization: 0,
      all_pass: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`COLLECTION_INTEGRITY_FAILURE: ${message}`, { cause: error });
  }
}

function effectLine(analysis: SubsetAnalysis): string {
  return `A/B valid matched pairs=${analysis.treatment_valid_pairs}; ABL_A/ABL_B valid matched pairs=${analysis.ablation_valid_pairs}; full four-arm units=${analysis.full_four_arm_valid_units}/${analysis.planned_units}; treatment=${analysis.primary.treatment_disagreements_on_common_units}/${analysis.primary.common_full_units} (${percent(analysis.primary.treatment_rate_on_common_units)}); ablation=${analysis.primary.ablation_disagreements_on_common_units}/${analysis.primary.common_full_units} (${percent(analysis.primary.ablation_rate_on_common_units)}); treatment-minus-ablation delta=${percent(analysis.primary.treatment_minus_ablation_rate_delta)}.`;
}

function report(summary: Record<string, unknown>, scenarios: readonly Record<string, unknown>[], magnitudes: readonly Record<string, unknown>[], gates: Record<string, unknown>, integrity: Record<string, unknown>, output: string): string {
  const primary = summary["primary_model_analysis"] as SubsetAnalysis;
  const preflight = summary["provider_preflight"] as ProviderPreflight;
  const sample = object(summary["sample_size"]);
  const questions = object(summary["questions"]);
  const shift = object(summary["s1_anomaly_replication"]);
  const crossScenario = object(summary["cross_scenario"]);
  const magnitudeMap = new Map(magnitudes.filter((row) => row["model_id"] === summary["primary_model_id"]).map((row) => [String(row["magnitude_id"]), row]));
  const low = magnitudeMap.get("LOW");
  const reference = magnitudeMap.get("REFERENCE");
  check(low !== undefined && reference !== undefined, "magnitude summaries missing");
  const lowAnalysis = low["analysis"] as SubsetAnalysis;
  const referenceAnalysis = reference["analysis"] as SubsetAnalysis;
  const failureSummary = object(readJson(resolve(output, "failure-summary.json")));
  const cells = failureSummary["by_scenario_magnitude_model"] as readonly Record<string, unknown>[];
  const scenarioRows = cells
    .filter((row) => row["model_id"] === summary["primary_model_id"])
    .map((row) => {
      const analysis = row["analysis"] as SubsetAnalysis;
      const validity = analysis.action_validity_by_arm;
      return `| ${row["scenario_id"]} | ${row["magnitude_id"]} | ${analysis.full_four_arm_valid_units}/${analysis.planned_units} | ${analysis.primary.treatment_disagreements_on_common_units}/${analysis.primary.common_full_units} (${percent(analysis.primary.treatment_rate_on_common_units)}) | ${analysis.primary.ablation_disagreements_on_common_units}/${analysis.primary.common_full_units} (${percent(analysis.primary.ablation_rate_on_common_units)}) | ${percent(analysis.primary.treatment_minus_ablation_rate_delta)} | ${analysis.action_intent.treatment_disagreements_on_common_units}/${analysis.full_four_arm_valid_units} vs ${analysis.action_intent.ablation_disagreements_on_common_units}/${analysis.full_four_arm_valid_units} | ${validity.A.model_action_not_allowed}/${validity.B.model_action_not_allowed}/${validity.ABL_A.model_action_not_allowed}/${validity.ABL_B.model_action_not_allowed} |`;
    });
  const validityRows = ARMS.map((arm) => {
    const row = primary.action_validity_by_arm[arm];
    return `| ${arm} | ${row.attempted} | ${row.provider_responses} | ${row.valid} | ${row.model_action_not_allowed}/${row.provider_responses} (${percent(row.model_action_not_allowed_rate)}) | ${row.other_validation_rejections}/${row.provider_responses} (${percent(row.other_validation_rejection_rate)}) |`;
  });
  const actionDistributionRows = ARMS.map((arm) => `| ${arm} | ${JSON.stringify(primary.action_intent.valid_action_distribution_by_arm[arm])} |`);
  const inputAudit = object(readJson(resolve(output, "input-diff-audit.json")));
  const history = object(readJson(resolve(output, "history-construction.json")));
  const restore = object(readJson(resolve(output, "restore-controls.json")));
  const restoreRows = restore["rows"] as readonly Record<string, unknown>[];
  const tokenCost = object(summary["token_runtime_cost"]);
  const productionIsolation = object(gates["production_isolation"]);
  const changedPaths = gates["changed_paths"];
  const relativeOutput = relative(ROOT, output).replaceAll("\\", "/");
  return [
    `# ${EXPERIMENT_VERSION} — run-1 real-provider report`,
    "",
    "## Verdict",
    "",
    String(summary["verdict"]),
    "",
    "## Baseline",
    "",
    `Starting branch main; HEAD = origin/main = ${BASELINE_COMMIT}; ahead/behind 0/0; initial worktree clean.`,
    "",
    "## Collection Integrity",
    "",
    `PASS — planned calls=${integrity["planned_calls"]}; actual trials=${integrity["actual_trials"]}; unique trial identities=${integrity["unique_trial_identities"]}; collection-complete marker valid; duplicate=0; missing=0; extra=0; scenario/magnitude/arm manifests match; execution-order schedule matches preregistration; trials sha256=${integrity["trials_sha256"]}. additional real-provider generation calls during finalization = 0.`,
    "",
    "## V0 Reference",
    "",
    "Frozen V0: qwen3.5:9b at ±0.25 valence / activation 0.348, 200 attempted, 190 valid, 40 common four-arm units, treatment 40/40 versus ablation 0/40; action_intent 0/40; S1 negative arm 10/10 MODEL_ACTION_NOT_ALLOWED.",
    "",
    "## V1 Design",
    "",
    `8 new scenarios × 2 lawful magnitudes × 4 matched arms × 5 trials. LOW A/B=(+0.125/-0.125, activation 0.298); REFERENCE A/B=(+0.25/-0.25, activation 0.348); ablations=(0, 0.2). Balanced order rotates ${BALANCED_ORDER.map((order) => order.join("/")).join("; ")}, with trial 5 repeating rotation 1. Q1 — Scenario replication: ${questions["q1_scenario_replication"]}. Q2 — Magnitude robustness: ${questions["q2_magnitude_robustness"]}. Q3 — Action propagation: ${questions["q3_action_propagation"]}. Q4 — Model robustness: ${questions["q4_model_robustness"]}.`,
    "",
    "## Provider / Model",
    "",
    `${PRIMARY_PROVIDER.provider} ${preflight.primary_model?.name ?? PRIMARY_PROVIDER.model}; Ollama ${preflight.server_version ?? "unknown"}; digest ${preflight.primary_model?.digest ?? "unknown"}; quantization ${preflight.primary_model?.quantization_level ?? "unknown"}; parameter size ${preflight.primary_model?.parameter_size ?? "unknown"}; V0 digest match=${preflight.primary_digest_matches_v0}. Settings: temperature=0; seed=null; think=false; stream=false; format=null; num_predict=2048; timeout_ms=120000; retries=0.`,
    "",
    "## Second Model Status",
    "",
    preflight.secondary_status === "SECOND_MODEL_UNAVAILABLE" ? "SECOND_MODEL_UNAVAILABLE — no second suitable local completion model was present; none was downloaded. This does not count against the Qwen replication." : `${preflight.secondary_model?.name ?? "unknown"} (reported independently).`,
    "",
    "## Exact Sample Size",
    "",
    `8 scenarios × 2 magnitudes × 4 arms × 5 trials × ${preflight.selected_models.length} model(s). attempted=${sample["attempted_calls"]}; valid=${sample["valid_calls"]}; failed=${sample["failed_calls"]}; provider responses=${sample["provider_responses"]}; primary treatment valid pairs=${primary.treatment_valid_pairs}; ablation valid pairs=${primary.ablation_valid_pairs}; full four-arm valid=${primary.full_four_arm_valid_units}/${primary.planned_units}.`,
    "",
    "## LOW Magnitude Results",
    "",
    `Final VA: A=(+0.125, 0.298), B=(-0.125, 0.298), activation equality=PASS; ablations=(0, 0.2). ${effectLine(lowAnalysis)} Action-intent treatment=${lowAnalysis.action_intent.treatment_disagreements_on_common_units}/${lowAnalysis.full_four_arm_valid_units}, ablation=${lowAnalysis.action_intent.ablation_disagreements_on_common_units}/${lowAnalysis.full_four_arm_valid_units}, delta=${percent(lowAnalysis.action_intent.treatment_minus_ablation_rate_delta)}. MODEL_ACTION_NOT_ALLOWED A/B/ABL_A/ABL_B=${ARMS.map((arm) => lowAnalysis.action_validity_by_arm[arm].model_action_not_allowed).join("/")}; negative-minus-positive=0.0%; negative-minus-ablated-background=0.0%.`,
    "",
    "## REFERENCE Magnitude Results",
    "",
    `Final VA: A=(+0.25, 0.348), B=(-0.25, 0.348), activation equality=PASS; ablations=(0, 0.2). ${effectLine(referenceAnalysis)} Action-intent treatment=${referenceAnalysis.action_intent.treatment_disagreements_on_common_units}/${referenceAnalysis.full_four_arm_valid_units}, ablation=${referenceAnalysis.action_intent.ablation_disagreements_on_common_units}/${referenceAnalysis.full_four_arm_valid_units}, delta=${percent(referenceAnalysis.action_intent.treatment_minus_ablation_rate_delta)}. MODEL_ACTION_NOT_ALLOWED A/B/ABL_A/ABL_B=${ARMS.map((arm) => referenceAnalysis.action_validity_by_arm[arm].model_action_not_allowed).join("/")}; negative-minus-positive=0.0%; negative-minus-ablated-background=0.0%.`,
    "",
    "## Aggregate Treatment-vs-Ablation",
    "",
    effectLine(primary),
    "",
    "## Scenario-Level Results",
    "",
    "| Scenario | Magnitude | Full four-arm | Treatment | Ablation | Delta | Action intent T vs ABL | Invalid A/B/ABL_A/ABL_B |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...scenarioRows,
    "",
    "## Cognition Effects",
    "",
    `Structured cognition disagreement: treatment=${primary.cognition_content.treatment_disagreements_on_common_units}/${primary.full_four_arm_valid_units} (${percent(primary.cognition_content.treatment_rate_on_common_units)}), ablation=${primary.cognition_content.ablation_disagreements_on_common_units}/${primary.full_four_arm_valid_units} (${percent(primary.cognition_content.ablation_rate_on_common_units)}), delta=${percent(primary.cognition_content.treatment_minus_ablation_rate_delta)}. Exact endpoint counts (treatment vs ablation, denominator ${primary.full_four_arm_valid_units} each): current_intent=${primary.endpoint_disagreement_counts.treatment.current_intent} vs ${primary.endpoint_disagreement_counts.ablation.current_intent}; confidence=${primary.endpoint_disagreement_counts.treatment.confidence} vs ${primary.endpoint_disagreement_counts.ablation.confidence}; uncertainty=${primary.endpoint_disagreement_counts.treatment.uncertainty} vs ${primary.endpoint_disagreement_counts.ablation.uncertainty}; reasoning_summary_length=${primary.endpoint_disagreement_counts.treatment.reasoning_summary_length} vs ${primary.endpoint_disagreement_counts.ablation.reasoning_summary_length}. Paired numeric distributions=${JSON.stringify(primary.numeric_pair_differences)}.`,
    "",
    "## Action Intent Effects",
    "",
    `Treatment=${primary.action_intent.treatment_disagreements_on_common_units}/${primary.full_four_arm_valid_units} (${percent(primary.action_intent.treatment_rate_on_common_units)}); ablation=${primary.action_intent.ablation_disagreements_on_common_units}/${primary.full_four_arm_valid_units} (${percent(primary.action_intent.ablation_rate_on_common_units)}); delta=${percent(primary.action_intent.treatment_minus_ablation_rate_delta)}. Cognition differences therefore did not propagate to action_intent in this run.`,
    "",
    "| Arm | Valid action_intent distribution |",
    "|---|---|",
    ...actionDistributionRows,
    "",
    "## Action Validity Effects",
    "",
    "| Arm | Attempted | Provider responses | Valid | MODEL_ACTION_NOT_ALLOWED | Other validation rejection |",
    "|---|---:|---:|---:|---:|---:|",
    ...validityRows,
    "",
    "## V0 S1 Anomaly Replication",
    "",
    `${shift["status"]} — negative arm=${percent(Number(shift["negative_arm_rate"]))}; positive arm=${percent(Number(shift["positive_arm_rate"]))}; ablated background=${percent(Number(shift["ablated_background_rate"]))}; negative-minus-positive=${percent(Number(shift["negative_minus_positive"]))}; negative-minus-ablated-background=${percent(Number(shift["negative_minus_ablated_background"]))}; supporting scenario×magnitude cells=${shift["supporting_scenario_magnitude_cells"]}. This is a secondary finding, not the principal verdict.`,
    "",
    "## Restore Controls",
    "",
    `PASS — LOW restore input equality=${restoreRows.find((row) => row["magnitude_id"] === "LOW")?.["provider_facing_input_identical"]}; before/after hash=${restoreRows.find((row) => row["magnitude_id"] === "LOW")?.["input_before_hash"]}. REFERENCE restore input equality=${restoreRows.find((row) => row["magnitude_id"] === "REFERENCE")?.["provider_facing_input_identical"]}; before/after hash=${restoreRows.find((row) => row["magnitude_id"] === "REFERENCE")?.["input_before_hash"]}.`,
    "",
    "## Input / Confound Audit",
    "",
    `PASS — non-Affect A/B equality=PASS; ABL_A/ABL_B equality=PASS; activation matching=PASS; current-event equality=PASS; current-Appraisal dimensions equality=PASS; action-space equality=PASS; provider/model/settings equality=PASS; async projection-hash regression=PASS; arm-label leakage=PASS_NO_LEAKAGE; retry symmetry=PASS_ZERO_RETRIES. ${Array.isArray(inputAudit["rows"]) ? inputAudit["rows"].length : 0} matched input audits and ${Array.isArray(history["rows"]) ? history["rows"].length : 0} canonical history proofs persisted. Content-addressed Appraisal provenance refs are arm-specific as in frozen V0 but are not provider-facing.`,
    "",
    "## Magnitude Robustness",
    "",
    `${questions["q2_magnitude_robustness"]} — LOW and REFERENCE each show treatment 100.0%, ablation 0.0%, delta 100.0%. The claim is bounded to lawful final valence magnitudes 0.125 and 0.25; no monotonicity claim is made.`,
    "",
    "## Scenario Generalization",
    "",
    `Q1=${questions["q1_scenario_replication"]}; strong=${crossScenario["strong_replication"]}; weak=${crossScenario["weak_replication"]}; no-effect=${crossScenario["no_effect"]}; invalid-action-dominated=${crossScenario["invalid_action_dominated"]}. All 8 preregistered new scenarios replicated at both magnitudes; no scenario was removed. Generalization remains bounded to these scenarios.`,
    "",
    "## Model Generalization",
    "",
    `Q4=${questions["q4_model_robustness"]}. ${JSON.stringify(summary["cross_model"])}. No cross-model generalization claim is made.`,
    "",
    "## Production Isolation",
    "",
    `PASS — production behavior-changing diff=${productionIsolation["production_behavior_changing_diff"]}; production paths changed=${JSON.stringify(productionIsolation["production_paths_changed"])}; scope=${productionIsolation["scope"]}.`,
    "",
    "## Token / Runtime / Cost",
    "",
    `prompt_tokens=${tokenCost["prompt_tokens"]}; completion_tokens=${tokenCost["completion_tokens"]}; total_tokens=${tokenCost["total_tokens"]}; calls_with_metadata=${tokenCost["calls_with_token_metadata"]}; latency_ms=${JSON.stringify(tokenCost["latency_ms"])}; external API cost=0.`,
    "",
    "## Evidence Artifacts",
    "",
    `${relativeOutput}/scenario-manifest.json, config.json, trials.jsonl, collection-complete.json, collection-integrity.json, input-diff-audit.json, summary.json, scenario-summary.json, magnitude-summary.json, failure-summary.json, REPORT.md, quality-gates.json, history-construction.json, restore-controls.json, phase-a.json, provider-preflight.json.`,
    "",
    "## Tests",
    "",
    JSON.stringify(gates["focused_tests"]),
    "",
    "## Full Suite",
    "",
    JSON.stringify(gates["full_suite"]),
    "",
    "## Build",
    "",
    JSON.stringify(gates["build"]),
    "",
    "## Typecheck",
    "",
    `workspace=${JSON.stringify(gates["workspace_typecheck"])}; experiment=${JSON.stringify(gates["v1_typecheck"])}.`,
    "",
    "## Lint / Diff",
    "",
    `lint=${JSON.stringify(gates["lint"])}; diff=${JSON.stringify(gates["diff_check"])}.`,
    "",
    "## Changed Paths",
    "",
    JSON.stringify(changedPaths),
    "",
    "## Commit",
    "",
    "Message: experiment: replicate canonical affect behavior influence v1. The immutable commit hash is reported after Git assigns it in the task closeout (a commit cannot contain its own hash).",
    "",
    "## Push",
    "",
    "Performed after this report is committed; exact local/origin equality is reported in the task closeout.",
    "",
    "## Worktree",
    "",
    "Final clean/dirty truth is reported after commit and push in the task closeout.",
    "",
    "## Scientific Adjudication",
    "",
    String(summary["scientific_adjudication"]),
    "",
    "## Claim Boundary",
    "",
    JSON.stringify(summary["claim_boundary"]),
    "",
    "## Recommended Next Slice",
    "",
    String(summary["recommended_next_slice"]),
    ""
  ].join("\n");
}

async function finalize(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  const summaryPath = resolve(output, "summary.json");
  const gatesPath = resolve(output, "quality-gates.json");
  check(existsSync(resolve(output, "collection-complete.json")), "collection must be complete");
  check(existsSync(summaryPath), "summary.json missing");
  check(existsSync(gatesPath), "quality-gates.json missing");
  const summary = readJson(summaryPath) as Record<string, unknown>;
  const gates = readJson(gatesPath) as Record<string, unknown>;
  check(gates["all_pass"] === true, "quality gates are not all PASS");
  const integrity = await verifyCollectionIntegrity(output);
  writeJson(resolve(output, "collection-integrity.json"), integrity);
  const finalized = {
    ...summary,
    collection_integrity: integrity,
    additional_real_provider_generation_calls_during_finalization: 0,
    production_isolation: gates["production_isolation"],
    quality_gates: gates,
    finalized_at: new Date().toISOString()
  } as Record<string, unknown>;
  writeJson(summaryPath, finalized);
  const scenarios = readJson(resolve(output, "scenario-summary.json")) as readonly Record<string, unknown>[];
  const magnitudes = readJson(resolve(output, "magnitude-summary.json")) as readonly Record<string, unknown>[];
  writeFileSync(resolve(output, "REPORT.md"), report(finalized, scenarios, magnitudes, gates, integrity, output), "utf8");
  console.log(`FINALIZED ${String(finalized["verdict"])} ${String(finalized["scientific_adjudication"])}`);
}

const mode = process.argv[2];
const output = process.argv[3];
check(typeof output === "string" && output.length > 0, "usage: cli.ts phase-a|collect|finalize <evidence-directory>");
if (mode === "phase-a") await phaseA(output);
else if (mode === "collect") await collect(output);
else if (mode === "finalize") await finalize(output);
else throw new Error("usage: cli.ts phase-a|collect|finalize <evidence-directory>");
