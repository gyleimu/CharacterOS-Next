/**
 * phase-a: zero provider calls and immutable preregistration artifacts.
 * collect: strict-prefix resumable execution of exactly 160 cognition calls.
 * finalize: zero-call integrity verification and report rendering.
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
  ACTION_ORDERS,
  ARMS,
  BASELINE_COMMIT,
  EXPERIMENT_VERSION,
  PLANNED_REAL_CALLS,
  PRIMARY_PROVIDER,
  REFERENCE_MAGNITUDE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO_ORDER,
  actionTupleKey,
  frozenConfig,
  scenarioManifest
} from "./contract.ts";
import { executePhaseA, type PhaseAResult } from "./phase-a.ts";
import {
  buildExecutionPlan,
  executeOneRealTrial,
  probeProviderEnvironment,
  summarizeCollection,
  type PlannedTrial,
  type ProviderPreflight,
  type TrialRecord
} from "./real-runner.ts";
import {
  canonicalJson,
  equal,
  hashJson
} from "./metrics.ts";
import { check } from "../canonical-affect-behavior-influence-v1/fixtures.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const EXPERIMENT_RELATIVE =
  "research/experiments/canonical-affect-action-selection-sensitivity-v0/";
const CONFORMANCE_RELATIVE =
  "evals/conformance/canonical-affect-action-selection-sensitivity-v0.test.ts";
const PHASE_A_ARTIFACTS = Object.freeze([
  "scenario-manifest.json",
  "config.json",
  "input-diff-audit.json",
  "history-construction.json",
  "restore-controls.json",
  "phase-a.json"
] as const);

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

function fileSha256(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function checkBaseline(): void {
  check(git("branch", "--show-current") === "main", "experiment must run on main");
  check(
    git("rev-parse", "HEAD") === BASELINE_COMMIT,
    `HEAD must remain baseline ${BASELINE_COMMIT} before commit`
  );
  check(
    git("rev-parse", "origin/main") === BASELINE_COMMIT,
    `origin/main must remain baseline ${BASELINE_COMMIT} before commit`
  );
}

function checkExperimentOnlyDirtyTree(): void {
  const lines = gitRaw("status", "--porcelain=v1", "-z")
    .split("\u0000")
    .filter(Boolean);
  for (const line of lines) {
    const rawPath = line.slice(3).trim();
    const path = rawPath.includes(" -> ")
      ? rawPath.split(" -> ").at(-1) ?? rawPath
      : rawPath;
    const normalized = path.replaceAll("\\", "/");
    check(
      normalized.startsWith(EXPERIMENT_RELATIVE) ||
        normalized === CONFORMANCE_RELATIVE,
      `production isolation violation: ${path}`
    );
  }
}

function resolveOutput(argument: string): string {
  const output = resolve(ROOT, argument);
  const rel = relative(ROOT, output).replaceAll("\\", "/");
  check(
    rel.startsWith(`${EXPERIMENT_RELATIVE}evidence/`),
    "output must remain inside this experiment's evidence directory"
  );
  return output;
}

function artifactEntries(result: PhaseAResult): readonly [string, unknown][] {
  return [
    ["scenario-manifest.json", result.artifacts.scenario_manifest],
    ["config.json", result.artifacts.config],
    ["input-diff-audit.json", result.artifacts.input_diff_audit],
    ["history-construction.json", result.artifacts.history_construction],
    ["restore-controls.json", result.artifacts.restore_controls],
    ["phase-a.json", result.artifacts.phase_a]
  ];
}

function assertPhaseAArtifacts(output: string, result: PhaseAResult): void {
  for (const [name, value] of artifactEntries(result)) {
    const path = resolve(output, name);
    check(existsSync(path), `${name} is required before collection`);
    check(equal(readJson(path), value), `${name} differs from fresh zero-call validation`);
  }
}

function preflightIdentity(preflight: ProviderPreflight): unknown {
  return {
    endpoint: preflight.endpoint,
    reachable: preflight.reachable,
    ollama_version: preflight.ollama_version,
    primary_model: preflight.primary_model,
    primary_model_available: preflight.primary_model_available,
    primary_digest_matches_frozen: preflight.primary_digest_matches_frozen,
    selected_model: preflight.selected_model,
    settings: preflight.settings,
    failure: preflight.failure
  };
}

async function phaseA(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(!existsSync(output), `refusing to overwrite ${relative(ROOT, output)}`);
  mkdirSync(output, { recursive: true });

  writeJson(resolve(output, "scenario-manifest.json"), scenarioManifest());
  writeJson(resolve(output, "config.json"), frozenConfig());
  const result = await executePhaseA();
  check(
    equal(result.artifacts.scenario_manifest, readJson(resolve(output, "scenario-manifest.json"))),
    "scenario manifest drifted during Phase A"
  );
  check(
    equal(result.artifacts.config, readJson(resolve(output, "config.json"))),
    "config drifted during Phase A"
  );
  for (const [name, value] of artifactEntries(result).slice(2)) {
    writeJson(resolve(output, name), value);
  }
  const preflight = await probeProviderEnvironment();
  writeJson(resolve(output, "provider-preflight.json"), preflight);
  const providerPass =
    preflight.reachable &&
    preflight.primary_model_available &&
    preflight.primary_digest_matches_frozen &&
    preflight.selected_model === PRIMARY_PROVIDER.model;
  writeJson(resolve(output, "phase-a-complete.json"), {
    schema_version: "canonical-affect-action-selection-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    real_provider_calls: 0,
    scenario_count: SCENARIOS.length,
    action_order_count: ACTION_ORDERS.length,
    arm_count: ARMS.length,
    trials_per_arm_scenario_order: TRIALS_PER_ARM_SCENARIO_ORDER,
    planned_calls: PLANNED_REAL_CALLS,
    phase_a_all_pass: result.artifacts.phase_a["all_pass"],
    provider_preflight_pass: providerPass,
    all_pass: result.artifacts.phase_a["all_pass"] === true && providerPass
  });
  console.log(`PHASE_A_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(JSON.stringify(result.artifacts.phase_a));
  console.log(
    JSON.stringify({
      provider_preflight_pass: providerPass,
      ollama_version: preflight.ollama_version,
      primary_model: preflight.primary_model,
      planned_calls: PLANNED_REAL_CALLS,
      real_provider_calls: 0
    })
  );
}

function readTrials(path: string): TrialRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TrialRecord);
}

function assertTrialMatchesPlan(trial: TrialRecord, planned: PlannedTrial): void {
  check(trial.trial_id === planned.trial_id, `trial id mismatch at ${planned.execution_order}`);
  check(
    trial.execution_order === planned.execution_order,
    `execution order mismatch at ${planned.execution_order}`
  );
  check(trial.scenario_id === planned.cell.scenario.scenario_id, "scenario mismatch");
  check(trial.action_order_id === planned.cell.action_order_id, "action order mismatch");
  check(trial.arm === planned.arm, "arm mismatch");
  check(trial.trial_ordinal === planned.trial_ordinal, "trial ordinal mismatch");
  check(
    equal(trial.allowed_actions, planned.cell.allowed_actions),
    `${trial.trial_id}: allowed actions differ from frozen plan`
  );
  check(
    equal(trial.semantic_action_labels, planned.cell.semantic_action_labels),
    `${trial.trial_id}: semantic labels differ from frozen plan`
  );
  const frozenInput = planned.cell.provider_inputs[planned.arm];
  check(
    trial.provider_input_hash === hashJson(frozenInput),
    `${trial.trial_id}: provider input hash differs from Phase A`
  );
  check(
    trial.projection_hash ===
      (frozenInput as { readonly projection_hash: string }).projection_hash,
    `${trial.trial_id}: projection hash differs from Phase A`
  );
  check(
    equal(
      trial.canonical_affect,
      (frozenInput as { readonly canonical_affect: unknown }).canonical_affect
    ),
    `${trial.trial_id}: canonical Affect differs from Phase A`
  );
  if (trial.status === "VALID") {
    const allowedLabels = planned.cell.allowed_actions.map(actionTupleKey);
    check(
      trial.action_intent === null ||
        allowedLabels.includes(actionTupleKey(trial.action_intent)),
      `${trial.trial_id}: validated action is outside the frozen action space`
    );
  }
}

async function collect(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(output), "Phase A evidence directory does not exist");
  check(
    !existsSync(resolve(output, "collection-complete.json")),
    "collection is already complete; refusing extra generation"
  );
  const phaseAResult = await executePhaseA();
  assertPhaseAArtifacts(output, phaseAResult);
  const phaseAComplete = readJson(resolve(output, "phase-a-complete.json")) as Record<string, unknown>;
  check(phaseAComplete["all_pass"] === true, "Phase A complete gate is not PASS");
  check(phaseAComplete["real_provider_calls"] === 0, "Phase A recorded provider calls");
  const storedPreflight = readJson(
    resolve(output, "provider-preflight.json")
  ) as ProviderPreflight;
  const freshPreflight = await probeProviderEnvironment();
  check(
    equal(preflightIdentity(storedPreflight), preflightIdentity(freshPreflight)),
    "provider environment changed after preregistration"
  );
  check(
    freshPreflight.reachable,
    `REAL_PROVIDER_UNAVAILABLE: ${freshPreflight.failure ?? "endpoint unreachable"}`
  );
  check(
    freshPreflight.primary_model_available,
    `REAL_PROVIDER_UNAVAILABLE: ${PRIMARY_PROVIDER.model} is absent`
  );
  check(
    freshPreflight.primary_digest_matches_frozen,
    `model digest changed: ${freshPreflight.primary_model?.digest ?? "absent"}`
  );
  check(
    freshPreflight.selected_model === PRIMARY_PROVIDER.model,
    "provider model substitution is prohibited"
  );

  const plan = buildExecutionPlan(phaseAResult);
  check(plan.length === 160, "frozen plan must contain exactly 160 calls");
  const trialsPath = resolve(output, "trials.jsonl");
  const trials = readTrials(trialsPath);
  check(trials.length <= plan.length, "recorded trial count exceeds frozen plan");
  for (let index = 0; index < trials.length; index += 1) {
    const recorded = trials[index];
    const planned = plan[index];
    check(recorded !== undefined && planned !== undefined, "resume prefix has a gap");
    assertTrialMatchesPlan(recorded, planned);
  }
  if (trials.length > 0) {
    console.log(`RESUME_PREFIX ${trials.length}/${plan.length}`);
  }

  const immutableHashes = Object.fromEntries(
    ["scenario-manifest.json", "config.json"].map((name) => [
      name,
      fileSha256(resolve(output, name))
    ])
  );
  for (let index = trials.length; index < plan.length; index += 1) {
    for (const [name, digest] of Object.entries(immutableHashes)) {
      check(
        fileSha256(resolve(output, name)) === digest,
        `${name} mutated after Phase A freeze`
      );
    }
    const planned = plan[index];
    check(planned !== undefined, `plan item ${index + 1} missing`);
    const trial = await executeOneRealTrial(planned);
    assertTrialMatchesPlan(trial, planned);
    appendFileSync(trialsPath, `${JSON.stringify(trial)}\n`, "utf8");
    trials.push(trial);
    console.log(
      `REAL_CALL ${index + 1}/${plan.length} ${trial.trial_id} ${trial.status} ${trial.validation_reason ?? "-"} ${trial.latency_ms}ms action=${actionTupleKey(trial.action_intent)} semantic=${trial.semantic_selection ?? "-"} first=${String(trial.first_position_selected)}`
    );
  }
  const artifacts = summarizeCollection(trials, phaseAResult, storedPreflight);
  writeJson(resolve(output, "summary.json"), artifacts.summary);
  writeJson(resolve(output, "scenario-summary.json"), artifacts.scenario_summary);
  writeJson(resolve(output, "order-summary.json"), artifacts.order_summary);
  writeJson(resolve(output, "failure-summary.json"), artifacts.failure_summary);
  writeJson(resolve(output, "collection-complete.json"), {
    schema_version: "canonical-affect-action-selection-collection-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    attempted_calls: trials.length,
    expected_calls: plan.length,
    valid_calls: trials.filter((trial) => trial.status === "VALID").length,
    failed_calls: trials.filter((trial) => trial.status !== "VALID").length,
    trials_sha256: fileSha256(trialsPath),
    aggregate_metrics_frozen: true,
    n_changed_after_output: false,
    scenarios_changed_after_output: false
  });
  console.log(`COLLECTION_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(
    JSON.stringify({
      verdict: artifacts.summary["verdict"],
      sample_size: artifacts.summary["sample_size"],
      primary: artifacts.summary["primary_action_disagreement"],
      position_bias: artifacts.summary["position_bias"],
      semantic_action_shift: artifacts.summary["semantic_action_shift"]
    })
  );
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function percent(value: unknown): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

async function verifyCollectionIntegrity(
  output: string
): Promise<Record<string, unknown>> {
  const phaseAResult = await executePhaseA();
  assertPhaseAArtifacts(output, phaseAResult);
  const plan = buildExecutionPlan(phaseAResult);
  const trialsPath = resolve(output, "trials.jsonl");
  const trials = readTrials(trialsPath);
  check(trials.length === PLANNED_REAL_CALLS, "collection does not contain 160 trials");
  const ids = new Set(trials.map((trial) => trial.trial_id));
  check(ids.size === trials.length, "duplicate trial identities detected");
  for (let index = 0; index < plan.length; index += 1) {
    const trial = trials[index];
    const planned = plan[index];
    check(trial !== undefined && planned !== undefined, `trial ${index + 1} missing`);
    assertTrialMatchesPlan(trial, planned);
  }
  const complete = readJson(resolve(output, "collection-complete.json")) as Record<string, unknown>;
  check(complete["attempted_calls"] === PLANNED_REAL_CALLS, "completion count mismatch");
  check(complete["expected_calls"] === PLANNED_REAL_CALLS, "expected count mismatch");
  check(complete["trials_sha256"] === fileSha256(trialsPath), "trial file hash mismatch");
  const preflight = readJson(resolve(output, "provider-preflight.json")) as ProviderPreflight;
  const recomputed = summarizeCollection(trials, phaseAResult, preflight);
  check(
    equal(readJson(resolve(output, "summary.json")), recomputed.summary),
    "summary differs from zero-call recomputation"
  );
  check(
    equal(readJson(resolve(output, "scenario-summary.json")), recomputed.scenario_summary),
    "scenario summary differs from recomputation"
  );
  check(
    equal(readJson(resolve(output, "order-summary.json")), recomputed.order_summary),
    "order summary differs from recomputation"
  );
  check(
    equal(readJson(resolve(output, "failure-summary.json")), recomputed.failure_summary),
    "failure summary differs from recomputation"
  );
  return {
    schema_version: "canonical-affect-action-selection-collection-integrity-v0",
    experiment_version: EXPERIMENT_VERSION,
    status: "PASS",
    planned_calls: PLANNED_REAL_CALLS,
    actual_trials: trials.length,
    unique_trial_identities: ids.size,
    duplicate_trial_identities: trials.length - ids.size,
    missing_planned_trial_identities: plan
      .filter((planned) => !ids.has(planned.trial_id))
      .map((planned) => planned.trial_id),
    post_hoc_extra_trial_identities: trials
      .filter((trial) => !plan.some((planned) => planned.trial_id === trial.trial_id))
      .map((trial) => trial.trial_id),
    strict_prefix_order_matches: true,
    scenario_manifest_matches_phase_a: true,
    action_orders_match_phase_a: true,
    provider_inputs_match_phase_a: true,
    lawful_va_matches_phase_a: true,
    collection_complete_marker_valid: true,
    trials_sha256: fileSha256(trialsPath),
    summary_recomputation_matches: true,
    additional_real_provider_generation_calls_during_finalization: 0
  };
}

function architectureOutcome(summary: Record<string, unknown>): {
  readonly consequence: string;
  readonly gpt6: string;
  readonly next: string;
} {
  const verdict = String(summary["verdict"]);
  const currentIntent = object(summary["current_intent_secondary"]);
  const other = object(summary["other_cognition_secondary"]);
  const treatmentCognitionDisagreements =
    numberValue(object(currentIntent["treatment"])["disagreements"]) +
    numberValue(object(object(other["confidence"])["treatment"])["disagreements"]) +
    numberValue(object(object(other["uncertainty"])["treatment"])["disagreements"]) +
    numberValue(
      object(object(other["reasoning_summary_length"])["treatment"])["disagreements"]
    );
  if (verdict === "ACTION_SELECTION_SENSITIVITY_SUPPORTED") {
    return {
      consequence:
        "Do not add an action-tendency mechanism. The existing cognition pipeline already permits canonical Affect to influence structured action selection when the action space is genuinely ambiguous.",
      gpt6: "GPT6_ADJUDICATION_NOT_NEEDED",
      next: "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0"
    };
  }
  if (verdict === "ACTION_SELECTION_SENSITIVITY_NOT_SUPPORTED") {
    return {
      consequence:
        "Recommend a separate READ-ONLY semantic review of whether a minimal transient, advisory action-tendency projection is justified. No mechanism is implemented here.",
      gpt6:
        treatmentCognitionDisagreements > 0
          ? "GPT6_ACTION_SEMANTICS_ADJUDICATION_RECOMMENDED"
          : "GPT6_ADJUDICATION_NOT_NEEDED",
      next: "CANONICAL_AFFECT_ACTION_TENDENCY_SEMANTIC_REVIEW_V1"
    };
  }
  return {
    consequence:
      "Repair only the experimental ambiguity or position-bias issue. Do not change Affect or action architecture.",
    gpt6: "GPT6_ADJUDICATION_NOT_NEEDED",
    next: "CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_REPAIR_V0"
  };
}

function report(
  summary: Record<string, unknown>,
  scenarioRows: readonly Record<string, unknown>[],
  orderRows: readonly Record<string, unknown>[],
  gates: Record<string, unknown>,
  integrity: Record<string, unknown>,
  output: string
): string {
  const sample = object(summary["sample_size"]);
  const primary = object(summary["primary_action_disagreement"]);
  const position = object(summary["position_bias"]);
  const semantic = object(summary["semantic_action_shift"]);
  const provider = object(summary["provider"]);
  const tokenRuntime = object(summary["token_runtime_cost"]);
  const outcome = architectureOutcome(summary);
  const manifest = readJson(resolve(output, "scenario-manifest.json"));
  const inputAudit = readJson(resolve(output, "input-diff-audit.json"));
  const restore = readJson(resolve(output, "restore-controls.json"));
  const failures = readJson(resolve(output, "failure-summary.json"));
  const artifactNames = [
    ...PHASE_A_ARTIFACTS,
    "phase-a-complete.json",
    "provider-preflight.json",
    "trials.jsonl",
    "collection-complete.json",
    "summary.json",
    "scenario-summary.json",
    "order-summary.json",
    "failure-summary.json",
    "collection-integrity.json",
    "quality-gates.json",
    "REPORT.md"
  ];
  const lines = [
    "# Canonical Affect Action Selection Sensitivity Experiment V0",
    "",
    "## Verdict",
    "",
    String(summary["verdict"]),
    "",
    "## Baseline",
    "",
    `Required and executed baseline: branch main; HEAD/origin/main=${BASELINE_COMMIT}.`,
    "",
    "## Scientific Question",
    "",
    String(summary["scientific_question"]),
    "",
    "## Scenario Balance Audit",
    "",
    "PASS — all four preregistered scenarios document why X and Y are plausible and remove missing-information, safety, deadline, reversibility, correctness, policy, resource, and explicit-instruction dominance.",
    "",
    "## Scenario Manifest",
    "",
    canonicalJson(manifest),
    "",
    "## Provider / Model",
    "",
    canonicalJson(provider),
    "",
    "## Model Settings",
    "",
    canonicalJson(provider["settings"]),
    "",
    "## Affect Construction",
    "",
    "Lawful production histories only: factual event → Observation → canonical INITIAL Appraisal → AffectApplication → durable CanonicalAffectV0. No direct VA assignment and no gain changes.",
    "",
    "## Exact VA Values",
    "",
    `A=(+${REFERENCE_MAGNITUDE.target_absolute_valence}, ${REFERENCE_MAGNITUDE.expected_final_activation}); B=(-${REFERENCE_MAGNITUDE.target_absolute_valence}, ${REFERENCE_MAGNITUDE.expected_final_activation}); ABL_A=ABL_B=(0, 0.2).`,
    "",
    "## Activation Matching",
    "",
    "PASS — A and B activation are exactly matched at the frozen rounded value 0.348 in every prepared cell.",
    "",
    "## Action Pairs",
    "",
    SCENARIOS.map(
      (scenario) =>
        `- ${scenario.scenario_id}: ${actionTupleKey(scenario.semantic_action_x)} vs ${actionTupleKey(scenario.semantic_action_y)}`
    ).join("\n"),
    "",
    "## Action Orders",
    "",
    "Every semantic pair ran as ORIGINAL [X,Y] and REVERSED [Y,X]; semantic labels remain position-independent.",
    "",
    "## Input Confound Audit",
    "",
    canonicalJson(inputAudit),
    "",
    "## Ablation Audit",
    "",
    "PASS — ABL_A/ABL_B inputs are byte-semantically identical within every scenario/order cell; persisted canonical state is untouched.",
    "",
    "## Sample Size",
    "",
    canonicalJson(sample),
    "",
    "## Validity / Failures",
    "",
    canonicalJson(failures),
    "",
    "## Transport Recovery Disclosure",
    "",
    canonicalJson(gates["transport_recovery"]),
    "",
    "## Primary Action Disagreement",
    "",
    `Treatment=${String(primary["treatment_disagreements"])}/${String(primary["denominator_common_full_valid_units"])} (${percent(primary["treatment_rate"])}).`,
    "",
    "## Ablation Action Disagreement",
    "",
    `Ablation=${String(primary["ablation_disagreements"])}/${String(primary["denominator_common_full_valid_units"])} (${percent(primary["ablation_rate"])}).`,
    "",
    "## Treatment-minus-Ablation Delta",
    "",
    percent(primary["treatment_minus_ablation_delta"]),
    "",
    "## Semantic Selection by Scenario",
    "",
    ...scenarioRows.flatMap((row) => [
      `### ${String(row["scenario_id"])}`,
      "",
      canonicalJson(row),
      ""
    ]),
    "## Order Reversal Results",
    "",
    canonicalJson(orderRows),
    "",
    "## First-Position Bias",
    "",
    canonicalJson(position),
    "",
    "## Order-Invariant Scenario Count",
    "",
    `${String(semantic["order_invariant_scenario_count"])}/${String(semantic["scenario_count"])} (support requires ${String(semantic["required_for_support"])}).`,
    "",
    "## action_intent Results",
    "",
    canonicalJson(primary),
    "",
    "## current_intent Secondary Results",
    "",
    canonicalJson(summary["current_intent_secondary"]),
    "",
    "## Action Validity",
    "",
    canonicalJson({
      by_arm: summary["action_validity"],
      differential: summary["action_validity_differential"]
    }),
    "",
    "## Restore Control",
    "",
    canonicalJson(restore),
    "",
    "## Production Isolation",
    "",
    canonicalJson(gates["production_isolation"]),
    "",
    "## Token / Runtime / Cost",
    "",
    canonicalJson(tokenRuntime),
    "",
    "## Evidence Artifacts",
    "",
    [
      ...artifactNames.map((name) => `- ${name}`),
      "- ../run-1-real-provider/ (preserved transport-invalid attempt; excluded from scientific metrics)"
    ].join("\n"),
    "",
    "## Tests",
    "",
    canonicalJson(gates["focused_tests"]),
    "",
    "## Full Suite",
    "",
    canonicalJson(gates["full_suite"]),
    "",
    "## Build",
    "",
    canonicalJson(gates["build"]),
    "",
    "## Typecheck",
    "",
    canonicalJson({
      workspace: gates["workspace_typecheck"],
      experiment: gates["experiment_typecheck"]
    }),
    "",
    "## Lint / Diff",
    "",
    canonicalJson({ lint: gates["lint"], diff: gates["diff_check"] }),
    "",
    "## Changed Paths",
    "",
    canonicalJson(gates["changed_paths"]),
    "",
    "## Commit",
    "",
    "Message: experiment: test canonical affect action selection sensitivity v0. The immutable commit hash is reported after Git assigns it in task closeout.",
    "",
    "## Push",
    "",
    "Performed after this report is committed; exact local/origin equality is reported in task closeout.",
    "",
    "## Worktree",
    "",
    "Final clean/dirty truth is reported after commit and push in task closeout.",
    "",
    "## Claim Boundary",
    "",
    "Canonical Affect → cognition is already replicated by frozen V0/V1 evidence. Canonical Affect → structured action selection is adjudicated only by this experiment; no activation, cross-model, language, or executed-action generalization is made.",
    "",
    "## Architecture Consequence",
    "",
    outcome.consequence,
    "",
    "## GPT-6 Recommendation",
    "",
    outcome.gpt6,
    "",
    "## Recommended Next Slice",
    "",
    outcome.next,
    ""
  ];
  return lines.join("\n");
}

async function finalize(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(resolve(output, "collection-complete.json")), "collection incomplete");
  check(existsSync(resolve(output, "summary.json")), "summary.json missing");
  check(existsSync(resolve(output, "quality-gates.json")), "quality-gates.json missing");
  check(!existsSync(resolve(output, "REPORT.md")), "REPORT.md already exists");
  const gates = readJson(resolve(output, "quality-gates.json")) as Record<string, unknown>;
  check(gates["all_pass"] === true, "quality gates are not all PASS");
  const integrity = await verifyCollectionIntegrity(output);
  writeJson(resolve(output, "collection-integrity.json"), integrity);
  const summary = readJson(resolve(output, "summary.json")) as Record<string, unknown>;
  const outcome = architectureOutcome(summary);
  const finalized = {
    ...summary,
    collection_integrity: integrity,
    quality_gates: gates,
    architecture_consequence: outcome.consequence,
    gpt6_recommendation: outcome.gpt6,
    recommended_next_slice: outcome.next,
    additional_real_provider_generation_calls_during_finalization: 0,
    finalized_at: new Date().toISOString()
  } as Record<string, unknown>;
  writeJson(resolve(output, "summary.json"), finalized);
  const scenarioRows = readJson(resolve(output, "scenario-summary.json")) as readonly Record<string, unknown>[];
  const orderRows = readJson(resolve(output, "order-summary.json")) as readonly Record<string, unknown>[];
  writeFileSync(
    resolve(output, "REPORT.md"),
    report(finalized, scenarioRows, orderRows, gates, integrity, output),
    "utf8"
  );
  console.log(
    `FINALIZED ${String(finalized["verdict"])} ${outcome.gpt6} ${outcome.next}`
  );
}

const mode = process.argv[2];
const output = process.argv[3];
check(
  typeof output === "string" && output.length > 0,
  "usage: cli.ts phase-a|collect|finalize <evidence-directory>"
);
if (mode === "phase-a") await phaseA(output);
else if (mode === "collect") await collect(output);
else if (mode === "finalize") await finalize(output);
else throw new Error("usage: cli.ts phase-a|collect|finalize <evidence-directory>");
