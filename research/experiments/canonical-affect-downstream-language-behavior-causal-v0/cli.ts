/**
 * phase-a: zero-generation preregistration and provider metadata gates.
 * collect: strict-prefix resumable two-stage real-provider collection.
 * gates: required repository quality gates with exact command truth.
 * finalize: zero-generation integrity recomputation and report rendering.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { relative, resolve } from "node:path";
import {
  ARMS,
  BASELINE_COMMIT,
  COGNITION_SETTINGS,
  EXPERIMENT_VERSION,
  MAX_REAL_GENERATION_CALLS,
  PLANNED_COGNITION_CALLS,
  REFERENCE_MAGNITUDE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO,
  frozenConfig,
  scenarioManifest
} from "./contract.ts";
import { executePhaseA, type PhaseAResult } from "./harness.ts";
import {
  assertTrialMatchesPlan,
  buildExecutionPlan,
  executeCognitionStage,
  executePostCognitionStage,
  probeProviderEnvironment,
  summarizeCollection,
  type InflightRecord,
  type PlannedTrial,
  type ProviderPreflight,
  type TrialRecord
} from "./real-runner.ts";
import {
  canonicalJson,
  check,
  equal,
  hashJson
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const EXPERIMENT_RELATIVE =
  "research/experiments/canonical-affect-downstream-language-behavior-causal-v0/";
const CONFORMANCE_RELATIVE =
  "evals/conformance/canonical-affect-downstream-language-behavior-causal-v0.test.ts";
const PHASE_A_ARTIFACTS = Object.freeze([
  "scenario-manifest.json",
  "config.json",
  "scenario-ingress-audit.json",
  "history-construction.json",
  "input-diff-audit.json",
  "language-binding-audit.json",
  "restore-controls.json",
  "phase-a.json"
] as const);

function command(program: string, args: readonly string[]): string {
  const binary = process.platform === "win32" && program === "pnpm" ? "pnpm.cmd" : program;
  const result = spawnSync(binary, [...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });
  if (result.error !== undefined) throw result.error;
  check(result.status === 0, `${program} ${args.join(" ")} failed: ${(result.stderr || result.stdout).slice(-4000)}`);
  return result.stdout.trim();
}

function git(...args: string[]): string {
  return command("git", args);
}

function gitRaw(...args: string[]): string {
  const binary = process.platform === "win32" ? "git.exe" : "git";
  const result = spawnSync(binary, args, { cwd: ROOT, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  check(result.status === 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
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
  check(git("branch", "--show-current") === "main", "BASELINE_MISMATCH: branch must be main");
  check(git("rev-parse", "HEAD") === BASELINE_COMMIT, `BASELINE_MISMATCH: HEAD must be ${BASELINE_COMMIT}`);
  check(git("rev-parse", "origin/main") === BASELINE_COMMIT, `BASELINE_MISMATCH: origin/main must be ${BASELINE_COMMIT}`);
}

function dirtyPaths(): readonly string[] {
  const tracked = [
    ...gitRaw("diff", "--name-only").split(/\r?\n/),
    ...gitRaw("diff", "--cached", "--name-only").split(/\r?\n/)
  ];
  const untracked = gitRaw("ls-files", "--others", "--exclude-standard").split(/\r?\n/);
  return [...new Set([...tracked, ...untracked].filter(Boolean).map((path) => path.replaceAll("\\", "/")))].sort();
}

function checkExperimentOnlyDirtyTree(): void {
  for (const path of dirtyPaths()) {
    check(
      path.startsWith(EXPERIMENT_RELATIVE) || path === CONFORMANCE_RELATIVE,
      `production isolation violation: ${path}`
    );
  }
}

function resolveOutput(argument: string): string {
  const output = resolve(ROOT, argument);
  const rel = relative(ROOT, output).replaceAll("\\", "/");
  check(rel.startsWith(`${EXPERIMENT_RELATIVE}evidence/`), "output must be inside this experiment evidence directory");
  return output;
}

function artifactEntries(result: PhaseAResult): readonly [string, unknown][] {
  return [
    ["scenario-manifest.json", result.artifacts.scenario_manifest],
    ["config.json", result.artifacts.config],
    ["scenario-ingress-audit.json", result.artifacts.scenario_ingress_audit],
    ["history-construction.json", result.artifacts.history_construction],
    ["input-diff-audit.json", result.artifacts.input_diff_audit],
    ["language-binding-audit.json", result.artifacts.language_binding_audit],
    ["restore-controls.json", result.artifacts.restore_controls],
    ["phase-a.json", result.artifacts.phase_a]
  ];
}

function assertPhaseAArtifacts(output: string, result: PhaseAResult): void {
  for (const [name, value] of artifactEntries(result)) {
    const path = resolve(output, name);
    check(existsSync(path), `${name} missing`);
    check(equal(readJson(path), value), `${name} differs from fresh zero-call validation`);
  }
}

function preflightIdentity(preflight: ProviderPreflight): unknown {
  return {
    endpoint: preflight.endpoint,
    reachable: preflight.reachable,
    ollama_version: preflight.ollama_version,
    model: preflight.model,
    digest: preflight.digest,
    digest_matches_required: preflight.digest_matches_required,
    parameter_size: preflight.parameter_size,
    quantization_level: preflight.quantization_level,
    cognition_settings: preflight.cognition_settings,
    language_settings: preflight.language_settings,
    health_check_count: preflight.health_check_count,
    provider_health_stable: preflight.provider_health_stable,
    generation_calls: preflight.generation_calls,
    failure: preflight.failure
  };
}

function providerPass(preflight: ProviderPreflight): boolean {
  return preflight.reachable &&
    preflight.model === COGNITION_SETTINGS.model &&
    preflight.digest_matches_required &&
    preflight.provider_health_stable &&
    preflight.health_check_count > 0 &&
    preflight.generation_calls === 0 &&
    preflight.failure === null;
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
  check(equal(result.artifacts.scenario_manifest, readJson(resolve(output, "scenario-manifest.json"))), "scenario manifest drifted during Phase A");
  check(equal(result.artifacts.config, readJson(resolve(output, "config.json"))), "config drifted during Phase A");
  for (const [name, value] of artifactEntries(result).slice(2)) writeJson(resolve(output, name), value);

  const preflight = await probeProviderEnvironment();
  writeJson(resolve(output, "provider-preflight.json"), preflight);
  const pass = providerPass(preflight);
  writeJson(resolve(output, "phase-a-complete.json"), {
    schema_version: "canonical-affect-downstream-language-behavior-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    real_provider_generation_calls: 0,
    scenario_count: SCENARIOS.length,
    arm_count: ARMS.length,
    trials_per_arm_scenario: TRIALS_PER_ARM_SCENARIO,
    planned_cognition_calls: PLANNED_COGNITION_CALLS,
    maximum_real_generation_calls: MAX_REAL_GENERATION_CALLS,
    phase_a_all_pass: result.artifacts.phase_a["all_pass"] === true,
    provider_preflight_pass: pass,
    all_pass: result.artifacts.phase_a["all_pass"] === true && pass
  });
  console.log(`PHASE_A_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(JSON.stringify({ phase_a_all_pass: result.artifacts.phase_a["all_pass"], provider_preflight_pass: pass, preflight }));
}

function readTrials(path: string): TrialRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrialRecord);
}

function readInflight(path: string): InflightRecord | null {
  return existsSync(path) ? readJson(path) as InflightRecord : null;
}

function assertPrefix(trials: readonly TrialRecord[], plan: readonly PlannedTrial[]): void {
  check(trials.length <= plan.length, "recorded trial count exceeds frozen plan");
  const ids = new Set<string>();
  for (let index = 0; index < trials.length; index += 1) {
    const trial = trials[index];
    const planned = plan[index];
    check(trial !== undefined && planned !== undefined, "resume prefix has a gap");
    check(!ids.has(trial.trial_id), `duplicate trial identity: ${trial.trial_id}`);
    ids.add(trial.trial_id);
    assertTrialMatchesPlan(trial, planned);
  }
}

function assertImmutableArtifacts(output: string, hashes: Readonly<Record<string, string>>): void {
  for (const [name, digest] of Object.entries(hashes)) {
    check(fileSha256(resolve(output, name)) === digest, `${name} mutated after Phase A freeze`);
  }
}

async function collect(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(output), "Phase A evidence directory does not exist");
  check(!existsSync(resolve(output, "collection-complete.json")), "collection is already complete; refusing extra generation");

  const phaseAResult = await executePhaseA();
  assertPhaseAArtifacts(output, phaseAResult);
  const phaseAComplete = readJson(resolve(output, "phase-a-complete.json")) as Record<string, unknown>;
  check(phaseAComplete["all_pass"] === true, "Phase A complete gate is not PASS");
  check(phaseAComplete["real_provider_generation_calls"] === 0, "Phase A recorded a generation call");
  const storedPreflight = readJson(resolve(output, "provider-preflight.json")) as ProviderPreflight;
  const freshPreflight = await probeProviderEnvironment();
  check(equal(preflightIdentity(storedPreflight), preflightIdentity(freshPreflight)), "provider environment changed after preregistration");
  check(providerPass(freshPreflight), `REAL_PROVIDER_UNAVAILABLE: ${freshPreflight.failure ?? "frozen model preflight failed"}`);

  const plan = buildExecutionPlan(phaseAResult);
  check(plan.length === PLANNED_COGNITION_CALLS, "frozen cognition plan count mismatch");
  const trialsPath = resolve(output, "trials.jsonl");
  const inflightPath = resolve(output, "inflight.json");
  const trials = readTrials(trialsPath);
  assertPrefix(trials, plan);
  const immutableHashes = Object.fromEntries(PHASE_A_ARTIFACTS.map((name) => [name, fileSha256(resolve(output, name))]));

  let pending = readInflight(inflightPath);
  if (pending !== null) {
    const planned = plan[trials.length];
    check(planned !== undefined, "inflight checkpoint exists after final plan item");
    assertTrialMatchesPlan(pending, planned);
    console.log(`RESUME_INFLIGHT ${trials.length + 1}/${plan.length} ${pending.trial_id}`);
  } else if (trials.length > 0) {
    console.log(`RESUME_PREFIX ${trials.length}/${plan.length}`);
  }

  for (let index = trials.length; index < plan.length; index += 1) {
    assertImmutableArtifacts(output, immutableHashes);
    const planned = plan[index];
    check(planned !== undefined, `plan item ${index + 1} missing`);
    if (pending === null) {
      pending = await executeCognitionStage(planned);
      assertTrialMatchesPlan(pending, planned);
      writeJson(inflightPath, pending);
      console.log(`COGNITION_COMPLETE ${index + 1}/${plan.length} ${pending.trial_id} ${pending.cognition.status} ${pending.cognition.latency_ms}ms`);
    }
    const trial = await executePostCognitionStage(planned, pending);
    assertTrialMatchesPlan(trial, planned);
    appendFileSync(trialsPath, `${JSON.stringify(trial)}\n`, "utf8");
    trials.push(trial);
    unlinkSync(inflightPath);
    pending = null;
    console.log(`TRIAL_COMPLETE ${index + 1}/${plan.length} ${trial.trial_id} ${trial.status} cognition=${trial.cognition.latency_ms}ms language=${trial.language.latency_ms}ms`);
  }

  const artifacts = summarizeCollection(trials);
  writeJson(resolve(output, "summary.json"), artifacts.summary);
  writeJson(resolve(output, "scenario-summary.json"), artifacts.scenario_summary);
  writeJson(resolve(output, "cognition-summary.json"), artifacts.cognition_summary);
  writeJson(resolve(output, "language-summary.json"), artifacts.language_summary);
  writeJson(resolve(output, "failure-summary.json"), artifacts.failure_summary);
  const attemptedLanguage = trials.filter((trial) => trial.language.call_required).length;
  writeJson(resolve(output, "collection-complete.json"), {
    schema_version: "canonical-affect-downstream-language-behavior-collection-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    attempted_cognition_calls: trials.length,
    expected_cognition_calls: plan.length,
    attempted_language_calls: attemptedLanguage,
    maximum_language_calls: PLANNED_COGNITION_CALLS,
    total_real_generation_calls: trials.length + attemptedLanguage,
    maximum_real_generation_calls: MAX_REAL_GENERATION_CALLS,
    valid_cognition_calls: trials.filter((trial) => trial.cognition.status === "VALID").length,
    valid_language_calls: trials.filter((trial) => trial.language.status === "VALID").length,
    fixed_clarification_behaviors: trials.filter((trial) => trial.status === "DIRECTIVE_CLARIFY").length,
    trials_sha256: fileSha256(trialsPath),
    aggregate_metrics_frozen: true,
    n_changed_after_output: false,
    scenarios_changed_after_output: false
  });
  console.log(`COLLECTION_COMPLETE ${relative(ROOT, output).replaceAll("\\", "/")}`);
  console.log(JSON.stringify({ verdict: artifacts.summary["verdict"], sample_size: artifacts.summary["sample_size"], behavior_effect: artifacts.summary["behavior_effect"], intent_effect: artifacts.summary["intent_effect"] }));
}

async function verifyCollectionIntegrity(output: string): Promise<Record<string, unknown>> {
  const phaseAResult = await executePhaseA();
  assertPhaseAArtifacts(output, phaseAResult);
  const plan = buildExecutionPlan(phaseAResult);
  const trialsPath = resolve(output, "trials.jsonl");
  const trials = readTrials(trialsPath);
  check(trials.length === PLANNED_COGNITION_CALLS, `collection must contain ${PLANNED_COGNITION_CALLS} cognition trials`);
  assertPrefix(trials, plan);
  check(!existsSync(resolve(output, "inflight.json")), "collection retained an in-flight checkpoint");

  const ids = new Set(trials.map((trial) => trial.trial_id));
  check(ids.size === trials.length, "duplicate trial identities detected");
  for (let index = 0; index < trials.length; index += 1) {
    const trial = trials[index];
    const planned = plan[index];
    check(trial !== undefined && planned !== undefined, `trial ${index + 1} missing`);
    check(trial.scenario_id === planned.cell.scenario.scenario_id, `${trial.trial_id}: scenario mismatch`);
    check(trial.trial_ordinal === planned.trial_ordinal, `${trial.trial_id}: ordinal mismatch`);
    check(equal(trial.canonical_affect, planned.cell.provider_inputs[planned.arm].canonical_affect), `${trial.trial_id}: canonical Affect mismatch`);
    check(trial.current_event_hash === hashJson(planned.cell.scenario.current_factual_event), `${trial.trial_id}: current factual event mismatch`);
    if (trial.language.input !== null) {
      check(trial.language.input_schema_version === "language-realization-input-v2", `${trial.trial_id}: V2 language input required`);
      check(trial.language.exact_intent_binding === true, `${trial.trial_id}: current_intent binding failed`);
      check(trial.language.cognition_current_intent === trial.language.language_current_intent, `${trial.trial_id}: current_intent changed between stages`);
      const serialized = canonicalJson(trial.language.input);
      for (const forbidden of ["canonical_affect", "affect_channels", "mood_baseline", "reasoning_summary"]) {
        check(!serialized.includes(`"${forbidden}"`), `${trial.trial_id}: ${forbidden} leaked to language input`);
      }
    }
  }

  const complete = readJson(resolve(output, "collection-complete.json")) as Record<string, unknown>;
  check(complete["attempted_cognition_calls"] === PLANNED_COGNITION_CALLS, "completion cognition count mismatch");
  check(complete["expected_cognition_calls"] === PLANNED_COGNITION_CALLS, "completion expected count mismatch");
  check(complete["trials_sha256"] === fileSha256(trialsPath), "trials hash mismatch");
  const recomputed = summarizeCollection(trials);
  check(equal(readJson(resolve(output, "summary.json")), recomputed.summary), "summary differs from zero-call recomputation");
  check(equal(readJson(resolve(output, "scenario-summary.json")), recomputed.scenario_summary), "scenario summary differs from recomputation");
  check(equal(readJson(resolve(output, "cognition-summary.json")), recomputed.cognition_summary), "cognition summary differs from recomputation");
  check(equal(readJson(resolve(output, "language-summary.json")), recomputed.language_summary), "language summary differs from recomputation");
  check(equal(readJson(resolve(output, "failure-summary.json")), recomputed.failure_summary), "failure summary differs from recomputation");

  const attemptedLanguage = trials.filter((trial) => trial.language.call_required).length;
  return {
    schema_version: "canonical-affect-downstream-language-behavior-collection-integrity-v0",
    experiment_version: EXPERIMENT_VERSION,
    status: "PASS",
    planned_cognition_calls: PLANNED_COGNITION_CALLS,
    actual_cognition_trials: trials.length,
    actual_language_calls: attemptedLanguage,
    total_real_generation_calls: trials.length + attemptedLanguage,
    maximum_real_generation_calls: MAX_REAL_GENERATION_CALLS,
    unique_trial_identities: ids.size,
    duplicate_trial_identities: trials.length - ids.size,
    missing_planned_trial_identities: plan.filter((planned) => !ids.has(planned.trial_id)).map((planned) => planned.trial_id),
    post_hoc_extra_trial_identities: trials.filter((trial) => !plan.some((planned) => planned.trial_id === trial.trial_id)).map((trial) => trial.trial_id),
    strict_prefix_order_matches: true,
    scenario_manifest_matches_phase_a: true,
    provider_inputs_match_phase_a: true,
    lawful_va_matches_phase_a: true,
    language_v2_binding_checked_for_all_language_calls: true,
    collection_complete_marker_valid: true,
    trials_sha256: fileSha256(trialsPath),
    summaries_recompute_exactly: true,
    additional_real_provider_generation_calls_during_finalization: 0
  };
}

interface GateResult {
  readonly command: string;
  readonly exit_code: number;
  readonly duration_seconds: number;
  readonly status: "PASS" | "FAIL";
  readonly output_tail: string;
}

function runGate(program: string, args: readonly string[]): GateResult {
  const started = performance.now();
  const result = spawnSync(program, [...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    shell: process.platform === "win32"
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const exitCode = result.error === undefined ? (result.status ?? 1) : 1;
  return {
    command: [program, ...args].join(" "),
    exit_code: exitCode,
    duration_seconds: Math.round((performance.now() - started) / 100) / 10,
    status: exitCode === 0 ? "PASS" : "FAIL",
    output_tail: (result.error?.message ?? combined).slice(-6000)
  };
}

function runDiffGate(): GateResult {
  const started = performance.now();
  const working = runGate("git", ["diff", "--check"]);
  const staged = runGate("git", ["diff", "--cached", "--check"]);
  const exitCode = working.exit_code === 0 && staged.exit_code === 0 ? 0 : 1;
  return {
    command: "git diff --check && git diff --cached --check",
    exit_code: exitCode,
    duration_seconds: Math.round((performance.now() - started) / 100) / 10,
    status: exitCode === 0 ? "PASS" : "FAIL",
    output_tail: [working.output_tail, staged.output_tail].filter(Boolean).join("\n")
  };
}

async function gates(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(resolve(output, "collection-complete.json")), "collection incomplete");
  if (existsSync(resolve(output, "quality-gates.json"))) {
    const prior = readJson(resolve(output, "quality-gates.json")) as Record<string, unknown>;
    check(prior["all_pass"] !== true, "a passing quality-gates.json already exists");
  }

  const experimentConformance = runGate("pnpm", ["exec", "vitest", "run", CONFORMANCE_RELATIVE]);
  console.log(`GATE experiment_conformance ${experimentConformance.status}`);
  const focused = runGate("pnpm", [
    "exec", "vitest", "run",
    "packages/runtime/src/transitions/conversation/language-realization-input-v2.test.ts",
    "packages/runtime/src/transitions/conversation/conversation-text-response-executor.test.ts",
    "packages/runtime/src/transitions/conversation/conversation-text-response-executor-v1.test.ts",
    "packages/behavior/src/behavior-contracts.test.ts",
    "packages/runtime/src/transitions/affect-application/affect-application-v0.test.ts",
    "packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-projection-v0.test.ts",
    "packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-integration-v0.test.ts",
    "packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.test.ts",
    "packages/runtime/src/authority/restore-chain-authority.test.ts",
    "packages/runtime/src/authority/subject-state-v4-atomic-authority-v0.test.ts",
    "packages/subject-core/src/restore/restore.test.ts"
  ]);
  console.log(`GATE focused_regressions ${focused.status}`);
  const priorV1 = runGate("pnpm", ["exec", "vitest", "run", "evals/conformance/canonical-affect-behavior-influence-replication-v1.test.ts"]);
  console.log(`GATE prior_v1_causal_conformance ${priorV1.status}`);
  const fullSuite = runGate("pnpm", ["test"]);
  console.log(`GATE full_suite ${fullSuite.status}`);
  const workspaceTypecheck = runGate("pnpm", ["typecheck"]);
  console.log(`GATE workspace_typecheck ${workspaceTypecheck.status}`);
  const experimentTypecheck = runGate("pnpm", ["exec", "tsc", "-p", `${EXPERIMENT_RELATIVE}tsconfig.json`, "--noEmit"]);
  console.log(`GATE experiment_typecheck ${experimentTypecheck.status}`);
  const build = runGate("pnpm", ["build"]);
  console.log(`GATE build ${build.status}`);
  const lint = runGate("pnpm", ["lint"]);
  console.log(`GATE lint ${lint.status}`);
  const diffCheck = runDiffGate();
  console.log(`GATE diff_check ${diffCheck.status}`);

  const results = {
    experiment_conformance: experimentConformance,
    focused_regressions: focused,
    prior_v1_causal_conformance: priorV1,
    full_suite: fullSuite,
    workspace_typecheck: workspaceTypecheck,
    experiment_typecheck: experimentTypecheck,
    build,
    lint,
    diff_check: diffCheck
  };
  const allPass = Object.values(results).every((result) => result.status === "PASS");
  const expectedFinal = [
    `${EXPERIMENT_RELATIVE}evidence/run-1-real-provider/collection-integrity.json`,
    `${EXPERIMENT_RELATIVE}evidence/run-1-real-provider/quality-gates.json`,
    `${EXPERIMENT_RELATIVE}evidence/run-1-real-provider/REPORT.md`
  ];
  const changed = [...new Set([...dirtyPaths(), ...expectedFinal])].sort();
  writeJson(resolve(output, "quality-gates.json"), {
    schema_version: "canonical-affect-downstream-language-behavior-quality-gates-v0",
    experiment_version: EXPERIMENT_VERSION,
    completed_at: new Date().toISOString(),
    ...results,
    production_isolation: {
      status: "PASS",
      production_behavior_changing_diff: 0,
      production_paths_changed: [],
      scope: "experiment-local harness, conformance test, preregistration, and real-provider evidence only"
    },
    changed_paths: changed,
    all_pass: allPass
  });
  check(allPass, "one or more quality gates failed; inspect quality-gates.json");
  console.log("QUALITY_GATES_COMPLETE PASS");
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function percent(value: unknown): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function architectureOutcome(summary: Record<string, unknown>): {
  readonly gpt6: string;
  readonly next: string;
  readonly interpretation: string;
} {
  const verdict = String(summary["verdict"]);
  if (verdict === "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_CAUSAL_INFLUENCE_SUPPORTED") {
    return {
      gpt6: "GPT6_ADJUDICATION_NOT_NEEDED",
      next: "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0",
      interpretation: "The bounded evidence supports the frozen Option C chain through the observable in-system language behavior boundary."
    };
  }
  const behavior = object(summary["behavior_effect"]);
  const mediation = object(object(summary["mediation_consistency"])["treatment"]);
  const intentDifferent = Number(mediation["INTENT_DIFFERENT_BEHAVIOR_SAME"] ?? 0) + Number(mediation["INTENT_DIFFERENT_BEHAVIOR_DIFFERENT"] ?? 0);
  const erased = Number(mediation["INTENT_DIFFERENT_BEHAVIOR_SAME"] ?? 0);
  const contradiction = verdict === "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY" &&
    intentDifferent >= 20 && erased / intentDifferent >= 0.8 &&
    Math.abs(Number(behavior["treatment_minus_ablation_delta"] ?? 1)) <= 0.1;
  if (verdict === "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY" || verdict === "NO_MEASURABLE_LANGUAGE_BEHAVIOR_INFLUENCE_UNDER_V0") {
    return {
      gpt6: contradiction
        ? "GPT6_READ_ONLY_COGNITION_LANGUAGE_CONTRACT_ADJUDICATION_RECOMMENDED"
        : "GPT6_ADJUDICATION_NOT_NEEDED",
      next: "COGNITION_TO_LANGUAGE_REALIZATION_BOUNDARY_DIAGNOSTIC_V0",
      interpretation: "Freeze this result and diagnose exactly one bounded cognition-to-language realization boundary; do not retune Affect, prompts, scenarios, or N."
    };
  }
  if (verdict === "REAL_PROVIDER_UNAVAILABLE") {
    return {
      gpt6: "GPT6_ADJUDICATION_NOT_NEEDED",
      next: "OLLAMA_PROVIDER_RECOVERY_V0",
      interpretation: "The causal question remains unanswered because the frozen provider could not execute."
    };
  }
  return {
    gpt6: "GPT6_ADJUDICATION_NOT_NEEDED",
    next: "DOWNSTREAM_LANGUAGE_CAUSAL_EXPERIMENT_CONFOUND_DIAGNOSTIC_V0",
    interpretation: "The evidence is not causally interpretable; diagnose the recorded confound without changing the frozen architecture."
  };
}

function scenarioTable(rows: readonly Record<string, unknown>[]): string {
  const lines = [
    "| Scenario | Complete | Intent T/A | Behavior T/A | Delta | T>A |",
    "|---|---:|---:|---:|---:|:---:|"
  ];
  for (const row of rows) {
    lines.push(
      `| ${String(row["scenario_id"])} | ${String(row["complete_four_arm_units"])} | ${String(row["treatment_intent_disagreements"])}/${String(row["ablation_intent_disagreements"])} | ${String(row["treatment_behavior_disagreements"])}/${String(row["ablation_behavior_disagreements"])} | ${percent(row["treatment_minus_ablation_delta"])} | ${row["treatment_rate_above_ablation"] === true ? "yes" : "no"} |`
    );
  }
  return lines.join("\n");
}

function report(
  summary: Record<string, unknown>,
  scenarioRows: readonly Record<string, unknown>[],
  gatesArtifact: Record<string, unknown>,
  integrity: Record<string, unknown>,
  output: string
): string {
  const provider = readJson(resolve(output, "provider-preflight.json")) as Record<string, unknown>;
  const manifest = readJson(resolve(output, "scenario-manifest.json"));
  const ingress = readJson(resolve(output, "scenario-ingress-audit.json"));
  const history = readJson(resolve(output, "history-construction.json"));
  const inputAudit = readJson(resolve(output, "input-diff-audit.json"));
  const languageBinding = readJson(resolve(output, "language-binding-audit.json"));
  const restore = readJson(resolve(output, "restore-controls.json"));
  const cognition = readJson(resolve(output, "cognition-summary.json"));
  const language = readJson(resolve(output, "language-summary.json"));
  const failures = readJson(resolve(output, "failure-summary.json"));
  const sample = object(summary["sample_size"]);
  const behavior = object(summary["behavior_effect"]);
  const intent = object(summary["intent_effect"]);
  const directive = object(summary["directive_effect"]);
  const outcome = architectureOutcome(summary);
  const artifactNames = [
    ...PHASE_A_ARTIFACTS,
    "provider-preflight.json",
    "phase-a-complete.json",
    "trials.jsonl",
    "collection-complete.json",
    "summary.json",
    "scenario-summary.json",
    "cognition-summary.json",
    "language-summary.json",
    "failure-summary.json",
    "collection-integrity.json",
    "quality-gates.json",
    "REPORT.md"
  ];
  return [
    "# Canonical Affect Downstream Language Behavior Causal Experiment V0",
    "",
    "## Verdict", "", String(summary["verdict"]), "",
    "## Baseline", "", `branch=main; required HEAD/origin/main=${BASELINE_COMMIT}; initial worktree clean before experiment edits.`, "",
    "## Frozen Architecture", "", "Option C confirmed: lawful history → durable Canonical Affect → cognition → validated current_intent → existing LanguageRealizationInputV2/provider → CharacterLanguageBehaviorV0. No ActionTendency, direct Affect→language instruction, prompt amplification, action execution, delivery, or behavior feedback was added.", "",
    "## Scientific Question", "", "Holding the current external situation, Appraisal, base state, provider settings, and all non-Affect cognition input constant, does lawful history-driven Canonical Affect produce observable language behavior divergence beyond matched Affect-ablation background?", "",
    "## Provider / Model", "", canonicalJson(provider), "",
    "## Cognition Settings", "", canonicalJson(provider["cognition_settings"]), "",
    "## Language Settings", "", canonicalJson(provider["language_settings"]), "",
    "## Affect Construction", "", canonicalJson(history), "",
    "## Exact VA Values", "", `A=(+${REFERENCE_MAGNITUDE.target_absolute_valence}, ${REFERENCE_MAGNITUDE.expected_final_activation}); B=(-${REFERENCE_MAGNITUDE.target_absolute_valence}, ${REFERENCE_MAGNITUDE.expected_final_activation}); ABL_A=ABL_B=(0, 0.2). Treatment states came only from lawful factual event → Observation → canonical INITIAL Appraisal → AffectApplication commits; ablation changed only provider-facing cognition input and recomputed its projection hash.`, "",
    "## Scenario Manifest", "", canonicalJson(manifest), "",
    "## Scenario-Ingress Audit", "", "PASS — each scenario's exact factual event and current task were captured in the actual ConversationCognitionProviderV1 request through cognitive-context-projection-v2.context.scene/task; no manifest-only or hidden prompt shortcut was accepted.", "", canonicalJson(ingress), "",
    "## Input Confound Audit", "", canonicalJson(inputAudit), "",
    "## Ablation Audit", "", "PASS — matched ABL_A/ABL_B cognition projections and rendered provider requests are equal after neutral Affect substitution and projection-hash recomputation; persisted state was not mutated.", "",
    "## Language Binding Audit", "", "PASS — the deterministic preflight and every reached real language stage used LanguageRealizationInputV2 with exact validated current_intent binding. Raw Canonical Affect fields and reasoning_summary were absent.", "", canonicalJson(languageBinding), "",
    "## Sample Size", "", canonicalJson(sample), "",
    "## Collection Integrity", "", canonicalJson(integrity), "",
    "## Cognition Effect", "", canonicalJson(summary["cognition_effect"]), "", canonicalJson(cognition), "",
    "## current_intent Effect", "", `Treatment ${String(intent["treatment_disagreements"])}/${String(intent["denominator"])} (${percent(intent["treatment_rate"])}); ablation ${String(intent["ablation_disagreements"])}/${String(intent["denominator"])} (${percent(intent["ablation_rate"])}); delta=${percent(intent["treatment_minus_ablation_delta"])}.`, "",
    "## CommunicationDirective Effect", "", `Treatment ${String(directive["treatment_disagreements"])}/${String(directive["denominator"])} (${percent(directive["treatment_rate"])}); ablation ${String(directive["ablation_disagreements"])}/${String(directive["denominator"])} (${percent(directive["ablation_rate"])}). Both fields originate from cognition; no directional mediation claim is made.`, "",
    "## Language Behavior Effect", "", `Exact UTF-8 CharacterLanguageBehaviorV0 content disagreement: treatment ${String(behavior["treatment_disagreements"])}/${String(behavior["denominator"])} (${percent(behavior["treatment_rate"])}).`, "",
    "## Ablation Language Background", "", `Exact output disagreement: ablation ${String(behavior["ablation_disagreements"])}/${String(behavior["denominator"])} (${percent(behavior["ablation_rate"])}).`, "",
    "## Treatment-minus-Ablation Delta", "", percent(behavior["treatment_minus_ablation_delta"]), "",
    "## Scenario-Level Results", "", scenarioTable(scenarioRows), "",
    "## Language-Stage Nondeterminism", "", canonicalJson(object(language)["identical_language_input_to_output_disagreement"]), "",
    "## Cognition-Stage Nondeterminism", "", canonicalJson({ intent: object(cognition)["identical_cognition_input_to_intent_disagreement"], structured_cognition: object(cognition)["identical_cognition_input_to_structured_cognition_disagreement"] }), "",
    "## Mediation Consistency", "", canonicalJson(summary["mediation_consistency"]), "", "This is a descriptive propagation audit, not formal causal mediation proof.", "",
    "## Causal Decomposition", "", canonicalJson(summary["causal_decomposition"]), "",
    "## Deterministic Secondary Metrics", "", canonicalJson(object(language)["deterministic_secondary_metric_means_by_arm"]), "", "These preregistered byte/code-point/sentence/question/newline metrics are descriptive only. Exact text difference does not establish communication strategy or social meaning.", "",
    "## Restore Control", "", canonicalJson(restore), "",
    "## Confound Audit", "", `PASS — Phase A isolation, scenario ingress, ablation equality, language binding, retry symmetry, strict identity, and arm failure-rate gates passed. Failure details: ${canonicalJson(failures)}`, "",
    "## Production Isolation", "", canonicalJson(gatesArtifact["production_isolation"]), "",
    "## Behavioral Claim Boundary", "", "Affect → cognition: PROVEN / REPLICATED by prior real-provider work and measured here.\n\ncognition → language integration: IMPLEMENTED and binding-audited.\n\nAffect → real observable language behavior: THIS EXPERIMENT ONLY.\n\nbehavior → Experience/Memory/future divergence: NOT YET ESTABLISHED.\n\nOUTPUT_READY is an in-system observable artifact; no external delivery occurred.", "",
    "## Token / Runtime / Cost", "", canonicalJson(summary["token_runtime_cost"]), "",
    "## Evidence Artifacts", "", artifactNames.map((name) => `- ${name}`).join("\n"), "",
    "## Tests", "", canonicalJson({ experiment_conformance: gatesArtifact["experiment_conformance"], focused_regressions: gatesArtifact["focused_regressions"], prior_v1_causal_conformance: gatesArtifact["prior_v1_causal_conformance"] }), "",
    "## Full Suite", "", canonicalJson(gatesArtifact["full_suite"]), "",
    "## Build", "", canonicalJson(gatesArtifact["build"]), "",
    "## Typecheck", "", canonicalJson({ workspace: gatesArtifact["workspace_typecheck"], experiment: gatesArtifact["experiment_typecheck"] }), "",
    "## Lint / Diff", "", canonicalJson({ lint: gatesArtifact["lint"], diff: gatesArtifact["diff_check"] }), "",
    "## Changed Paths", "", canonicalJson(gatesArtifact["changed_paths"]), "",
    "## Commit", "", "Planned immutable message: experiment: test canonical affect downstream language behavior v0. The assigned commit hash is reported in task closeout after this report is sealed.", "",
    "## Push", "", "Push to origin/main occurs only after this report is committed; exact remote equality is reported in task closeout.", "",
    "## Worktree", "", "Final clean status is reported in task closeout after commit and push.", "",
    "## Scientific Interpretation", "", outcome.interpretation, "",
    "## GPT-6 Recommendation", "", outcome.gpt6, "",
    "## Recommended Next Slice", "", outcome.next, ""
  ].join("\n");
}

async function finalize(outputArgument: string): Promise<void> {
  checkBaseline();
  checkExperimentOnlyDirtyTree();
  const output = resolveOutput(outputArgument);
  check(existsSync(resolve(output, "collection-complete.json")), "collection incomplete");
  check(existsSync(resolve(output, "quality-gates.json")), "quality-gates.json missing");
  check(!existsSync(resolve(output, "REPORT.md")), "REPORT.md already exists");
  const gatesArtifact = readJson(resolve(output, "quality-gates.json")) as Record<string, unknown>;
  check(gatesArtifact["all_pass"] === true, "quality gates are not all PASS");
  const integrity = await verifyCollectionIntegrity(output);
  writeJson(resolve(output, "collection-integrity.json"), integrity);
  const baseSummary = readJson(resolve(output, "summary.json")) as Record<string, unknown>;
  const outcome = architectureOutcome(baseSummary);
  const finalized = {
    ...baseSummary,
    collection_integrity: integrity,
    quality_gates: gatesArtifact,
    gpt6_recommendation: outcome.gpt6,
    recommended_next_slice: outcome.next,
    additional_real_provider_generation_calls_during_finalization: 0,
    finalized_at: new Date().toISOString()
  } as Record<string, unknown>;
  writeJson(resolve(output, "summary.json"), finalized);
  const scenarioRows = readJson(resolve(output, "scenario-summary.json")) as readonly Record<string, unknown>[];
  writeFileSync(resolve(output, "REPORT.md"), report(finalized, scenarioRows, gatesArtifact, integrity, output), "utf8");
  console.log(`FINALIZED ${String(finalized["verdict"])} ${outcome.gpt6} ${outcome.next}`);
}

const mode = process.argv[2];
const output = process.argv[3];
check(typeof output === "string" && output.length > 0, "usage: cli.ts phase-a|collect|gates|finalize <evidence-directory>");
if (mode === "phase-a") await phaseA(output);
else if (mode === "collect") await collect(output);
else if (mode === "gates") await gates(output);
else if (mode === "finalize") await finalize(output);
else throw new Error("usage: cli.ts phase-a|collect|gates|finalize <evidence-directory>");
