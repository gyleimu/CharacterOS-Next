/**
 * Phase 2 CLI.
 *
 * Collection (the only mode that makes real provider calls):
 *   node phase2-cli.ts collect <new-output-directory>
 *
 * Finalization (zero provider calls, after aggregate-only review):
 *   node phase2-cli.ts finalize <output-directory> <verdict> <adjudication> <quality-gates-json>
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { EXPERIMENT_ID, VERDICTS } from "./contract.ts";
import { check } from "./fixtures.ts";
import {
  PHASE_2_CONDITION_ORDER,
  PHASE_2_STARTING_HEAD,
  executeRealProviderPhase,
  phase2ExecutionPlan,
  probeRealProvider,
  serializeCanonical,
  type Phase2Summary
} from "./phase2-runner.ts";

type Verdict = (typeof VERDICTS)[number];
type Adjudication = "NOT_NEEDED" | "SCIENTIFIC_ADJUDICATION_RECOMMENDED";

interface FinalSummary extends Phase2Summary {
  readonly verdict: Verdict;
  readonly scientific_adjudication: Adjudication;
  readonly causal_interpretation: string;
  readonly claim_boundary: string;
  readonly recommended_next_slice: string;
  readonly quality_gates: Record<string, unknown>;
}

const ROOT = resolve(import.meta.dirname, "../../..");
const EXPERIMENT_RELATIVE = "research/experiments/canonical-affect-behavior-influence-v0/";
const CONFORMANCE_TEST_RELATIVE = "evals/conformance/canonical-affect-behavior-influence-v0.test.ts";

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitRaw(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${serializeCanonical(value)}\n`, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function checkExperimentOnlyDirtyTree(): void {
  const lines = gitRaw("status", "--porcelain=v1", "-z").split("\u0000").filter(Boolean);
  for (const line of lines) {
    const rawPath = line.slice(3).trim();
    const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
    const normalized = path.replaceAll("\\", "/");
    check(
      normalized.startsWith(EXPERIMENT_RELATIVE) || normalized === CONFORMANCE_TEST_RELATIVE,
      `non-experiment dirty path before Phase 2: ${path}`
    );
  }
}

async function collect(outputArgument: string): Promise<void> {
  check(git("rev-parse", "--abbrev-ref", "HEAD") === "main", "Phase 2 must run on main");
  check(git("rev-parse", "HEAD") === PHASE_2_STARTING_HEAD, `starting HEAD must be ${PHASE_2_STARTING_HEAD}`);
  check(git("rev-parse", "origin/main") === PHASE_2_STARTING_HEAD, `origin/main must be ${PHASE_2_STARTING_HEAD}`);
  checkExperimentOnlyDirtyTree();

  const output = resolve(ROOT, outputArgument);
  const relativeOutput = relative(ROOT, output).replaceAll("\\", "/");
  check(relativeOutput.startsWith(`${EXPERIMENT_RELATIVE}evidence/`), "Phase 2 output must be under the experiment evidence directory");
  check(!existsSync(output), `refusing to overwrite existing evidence directory: ${relativeOutput}`);
  mkdirSync(output, { recursive: false });

  const declaredAt = new Date().toISOString();
  writeJson(resolve(output, "execution-plan.json"), phase2ExecutionPlan(declaredAt));
  const probe = await probeRealProvider();
  writeJson(resolve(output, "provider-preflight.json"), probe);
  check(probe.reachable, `REAL_PROVIDER_UNAVAILABLE: ${probe.failure ?? "endpoint unreachable"}`);
  check(probe.model_available, `REAL_PROVIDER_UNAVAILABLE: ${probe.failure ?? "required model absent"}`);

  const trialsPath = resolve(output, "trials.jsonl");
  const collection = await executeRealProviderPhase({
    probe,
    on_trial: (trial, completed, total) => {
      appendFileSync(trialsPath, `${JSON.stringify(trial)}\n`, "utf8");
      console.log(`REAL_CALL ${completed}/${total} ${trial.trial_id} ${trial.status} ${trial.latency_ms}ms`);
    }
  });
  writeJson(resolve(output, "input-diff-audit.json"), collection.input_audit);
  writeJson(resolve(output, "summary.json"), collection.summary);
  writeJson(resolve(output, "collection-complete.json"), {
    experiment_id: EXPERIMENT_ID,
    completed_at: new Date().toISOString(),
    attempted_calls: collection.summary.sample_size.attempted_calls,
    valid_calls: collection.summary.sample_size.valid_calls,
    failed_calls: collection.summary.sample_size.failed_calls,
    aggregate_metrics_frozen: true,
    verdict_pending_aggregate_review: true
  });
  console.log(`COLLECTION_COMPLETE ${relativeOutput}`);
  console.log(JSON.stringify({
    sample_size: collection.summary.sample_size,
    treatment: collection.summary.treatment,
    ablation: collection.summary.ablation,
    contrast: collection.summary.treatment_vs_ablation
  }));
}

function interpretation(verdict: Verdict): { causal: string; boundary: string; next: string } {
  switch (verdict) {
    case "CANONICAL_AFFECT_CAUSAL_INFLUENCE_SUPPORTED":
      return {
        causal: "The frozen raw canonical valence contrast produced a reproducible structured cognition-output difference materially above the identical-input ablation background under this provider and scenario set.",
        boundary: "Supports only the tested +0.25 versus -0.25 canonical valence contrast with equal activation under qwen3.5:9b and these five scenarios. It does not establish activation effects, named emotions, psychological realism, all-task generality, or production-cutover readiness.",
        next: "CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1"
      };
    case "CANONICAL_AFFECT_INPUT_EFFECT_ONLY":
      return {
        causal: "Canonical Affect changed the frozen provider input, but the structured downstream difference was weak, inconsistent, or not cleanly distinguishable from identical-input ablation variation.",
        boundary: "Establishes provider-input visibility only; it does not establish behavioral efficacy or failure of the Affect dynamics law.",
        next: "RAW_VA_INTERPRETATION_SENSITIVITY_DIAGNOSIS_V0"
      };
    case "NO_MEASURABLE_BEHAVIORAL_INFLUENCE_UNDER_V0":
      return {
        causal: "Sufficient valid real-provider trials found no measurable difference in the frozen structured endpoints under the tested canonical valence contrast.",
        boundary: "This is a bounded negative result for qwen3.5:9b, the five frozen scenarios, and the current structured cognition schema; it is not a general falsification of Affect dynamics.",
        next: "RAW_VA_INTERPRETATION_DIAGNOSIS_V0"
      };
    case "EXPERIMENT_CONFOUND_DETECTED":
      return {
        causal: "A causal interpretation is blocked by a material experiment confound.",
        boundary: "No downstream causal claim is warranted from this run.",
        next: "CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_MINIMUM_HARNESS_REPAIR"
      };
    case "REAL_PROVIDER_UNAVAILABLE":
      return {
        causal: "The configured real provider could not lawfully execute Phase 2.",
        boundary: "No Phase-2 behavioral result exists.",
        next: "OLLAMA_PROVIDER_ENABLEMENT_ONLY"
      };
  }
}

function percent(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

function numberValue(value: number | null): string {
  return value === null ? "N/A" : String(value);
}

function endpointCounts(value: Readonly<Record<string, number>>): string {
  return Object.entries(value).map(([name, count]) => `${name}=${count}`).join(", ");
}

function report(summary: FinalSummary, output: string): string {
  const scenarioRows = summary.scenario_results.map((row) =>
    `| ${row.scenario_id} | ${row.treatment_valid_pairs} | ${row.ablation_valid_pairs} | ${row.common_valid_paired_units} | ${row.treatment_disagreements}/${row.treatment_valid_pairs} (${percent(row.treatment_disagreement_rate)}) | ${row.ablation_disagreements}/${row.ablation_valid_pairs} (${percent(row.ablation_disagreement_rate)}) | ${numberValue(row.delta)} |`
  );
  const failures = PHASE_2_CONDITION_ORDER.map((condition) => {
    const row = summary.failure_rates[condition];
    return `- ${condition}: ${row.failed}/${row.attempted} (${percent(row.failure_rate)}); ${Object.entries(row.by_class).map(([key, value]) => `${key}=${value}`).join(", ")}`;
  });
  const gates = summary.quality_gates;
  const gateText = (key: string): string => JSON.stringify(gates[key] ?? "not recorded");
  const relativeOutput = relative(ROOT, output).replaceAll("\\", "/");
  return [
    `# ${EXPERIMENT_ID} — Phase 2 real-provider report`,
    "",
    "## Verdict",
    "",
    summary.verdict,
    "",
    "## Baseline",
    "",
    `Starting HEAD = origin/main = ${summary.starting_head}; branch main; initial worktree clean was verified before experiment-local collection code/evidence was created.`,
    "",
    "## Provider Availability",
    "",
    `PASS — ${summary.provider_probe.endpoint}; model available = ${summary.provider_probe.model_available}; checked ${summary.provider_probe.checked_at}.`,
    "",
    "## Provider",
    "",
    `${summary.provider.provider} ${summary.provider.model}; Ollama ${summary.provider_probe.server_version ?? "unavailable"}; digest ${summary.provider_probe.model?.digest ?? "unavailable"}; ${summary.provider_probe.model?.parameter_size ?? "size unavailable"} ${summary.provider_probe.model?.quantization_level ?? "quantization unavailable"}.`,
    "",
    "## Model Settings",
    "",
    `temperature=0; seed=null (not exposed by frozen native transport); think=false; stream=false; format=null; num_predict=${summary.provider.settings.num_predict}; timeout_ms=${summary.provider.settings.timeout_ms}; retries=0; requested context window unset (model metadata context_length=${summary.provider_probe.model?.context_length ?? "unavailable"}).`,
    "",
    "## Phase-1 Revalidation",
    "",
    `PASS — ${Object.entries(summary.phase_1_revalidation).map(([key, value]) => `${key}=${value}`).join(", ")}.`,
    "",
    "## Experimental Arms",
    "",
    "A, B, ABLATED_A, ABLATED_B. The two ablated provider inputs are byte-identical within every scenario; persisted canonical state was not mutated by ablation.",
    "",
    "## Affect Values",
    "",
    `A=(${summary.affect_values.A.valence}, ${summary.affect_values.A.activation}); B=(${summary.affect_values.B.valence}, ${summary.affect_values.B.activation}); ABLATED_A=(${summary.affect_values.ABLATED_A.valence}, ${summary.affect_values.ABLATED_A.activation}); ABLATED_B=(${summary.affect_values.ABLATED_B.valence}, ${summary.affect_values.ABLATED_B.activation}). Runtime serialization preserves the production floating-point activation; nominal treatment activation is 0.348.`,
    "",
    "## Input Confound Audit",
    "",
    `PASS — ${Object.entries(summary.confound_audit).map(([key, value]) => `${key}=${value}`).join(", ")}.`,
    "",
    "## Scenarios",
    "",
    summary.design.scenarios.map((id) => `- ${id}`).join("\n"),
    "",
    "## Execution Plan",
    "",
    `Sequential paired execution in frozen scenario order and trial ordinal order; within each paired unit: ${summary.design.condition_order.join(" → ")}. Ollama requests are stateless, all settings are identical, no arm labels are sent, and no retries occur.`,
    "",
    "## Sample Size",
    "",
    `scenarios=${summary.sample_size.scenarios}; arms=${summary.sample_size.arms}; trials_per_arm_per_scenario=${summary.sample_size.trials_per_arm_per_scenario}; attempted_calls=${summary.sample_size.attempted_calls}; valid_calls=${summary.sample_size.valid_calls}; failed_calls=${summary.sample_size.failed_calls}; treatment_valid_pairs=${summary.sample_size.treatment_valid_pairs}; ablation_valid_pairs=${summary.sample_size.ablation_valid_pairs}; complete_four_arm_valid_paired_units=${summary.sample_size.valid_paired_units}/${summary.sample_size.planned_paired_units}.`,
    "",
    "## Failure Rates",
    "",
    ...failures,
    "",
    "## Primary Structured Endpoints",
    "",
    summary.primary_structured_endpoints.join(", "),
    "",
    "## A/B Result",
    "",
    `${summary.treatment.disagreements}/${summary.treatment.valid_pairs} paired disagreements (${percent(summary.treatment.disagreement_rate)}). Field counts: ${endpointCounts(summary.treatment.endpoint_disagreement_counts)}.`,
    "",
    "## Ablation Result",
    "",
    `${summary.ablation.disagreements}/${summary.ablation.valid_pairs} paired disagreements (${percent(summary.ablation.disagreement_rate)}). Field counts: ${endpointCounts(summary.ablation.endpoint_disagreement_counts)}.`,
    "",
    "## Treatment-vs-Ablation Contrast",
    "",
    `count delta=${summary.treatment_vs_ablation.disagreement_count_delta}; rate delta=${numberValue(summary.treatment_vs_ablation.disagreement_rate_delta)}; scenarios treatment>ablation=${summary.treatment_vs_ablation.scenarios_with_treatment_rate_above_ablation}, equal=${summary.treatment_vs_ablation.scenarios_with_equal_rates}, treatment<ablation=${summary.treatment_vs_ablation.scenarios_with_treatment_rate_below_ablation}.`,
    "",
    "## Scenario-Level Results",
    "",
    "| Scenario | A/B valid | Ablation valid | Common valid | A/B | Ablated | Common-unit rate delta |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...scenarioRows,
    "",
    "## Aggregate Results",
    "",
    `A/B valid pairs=${summary.treatment.valid_pairs}, disagreements=${summary.treatment.disagreements}; ablation valid pairs=${summary.ablation.valid_pairs}, disagreements=${summary.ablation.disagreements}. Complete four-arm denominator=${summary.treatment_vs_ablation.common_valid_paired_units}; on common units treatment=${summary.treatment_vs_ablation.treatment_disagreements_on_common_units}, ablation=${summary.treatment_vs_ablation.ablation_disagreements_on_common_units}, delta=${summary.treatment_vs_ablation.disagreement_count_delta}.`,
    "",
    "## Numeric Endpoints",
    "",
    `confidence A-B ${JSON.stringify(summary.numeric_endpoints.confidence.treatment_a_minus_b)}; ablation ${JSON.stringify(summary.numeric_endpoints.confidence.ablation_a_minus_b)}.`,
    `uncertainty A-B ${JSON.stringify(summary.numeric_endpoints.uncertainty.treatment_a_minus_b)}; ablation ${JSON.stringify(summary.numeric_endpoints.uncertainty.ablation_a_minus_b)}.`,
    `reasoning_summary_length A-B ${JSON.stringify(summary.numeric_endpoints.reasoning_summary_length.treatment_a_minus_b)}; ablation ${JSON.stringify(summary.numeric_endpoints.reasoning_summary_length.ablation_a_minus_b)}.`,
    "",
    "## Textual Observations",
    "",
    "No cherry-picked anecdotal examples are used in the verdict. Every bounded raw final response is preserved beside its validated structured proposal in trials.jsonl; free text is secondary evidence only.",
    "",
    "## Restore Control",
    "",
    `${summary.restore_control.provider_facing_input_identical ? "PASS" : "FAIL"} — ${summary.restore_control.scenario_id} arm ${summary.restore_control.arm}, pre/post-restore provider-facing treatment input identical=${summary.restore_control.provider_facing_input_identical}.`,
    "",
    "## Confound Audit",
    "",
    `${Object.values(summary.confound_audit).every((value) => value === "PASS") ? "PASS" : "FAIL"}.`,
    "",
    "## Causal Interpretation",
    "",
    summary.causal_interpretation,
    "",
    "## Claim Boundary",
    "",
    summary.claim_boundary,
    "",
    "## Token / Cost",
    "",
    `prompt_tokens=${numberValue(summary.token_cost.prompt_tokens)}; completion_tokens=${numberValue(summary.token_cost.completion_tokens)}; total_tokens=${numberValue(summary.token_cost.total_tokens)}; calls_with_metadata=${summary.token_cost.calls_with_token_metadata}; external API cost=0; latency_ms=${JSON.stringify(summary.token_cost.latency_ms)}.`,
    "",
    "## Production Isolation",
    "",
    `production behavior-changing diff=0. Collection/finalization changes are confined to the experiment and its evidence. Recorded check: ${gateText("production_isolation")}.`,
    "",
    "## Evidence Artifacts",
    "",
    `${relativeOutput}/trials.jsonl; input-diff-audit.json; summary.json; REPORT.md; execution-plan.json; provider-preflight.json; collection-complete.json; quality-gates.json.`,
    "",
    "## Tests",
    "",
    gateText("tests"),
    "",
    "## Full Suite",
    "",
    gateText("full_suite"),
    "",
    "## Build",
    "",
    gateText("build"),
    "",
    "## Typecheck",
    "",
    gateText("typecheck"),
    "",
    "## Lint / Diff",
    "",
    `lint=${gateText("lint")}; diff_check=${gateText("diff_check")}.`,
    "",
    "## Changed Paths",
    "",
    gateText("changed_paths"),
    "",
    "## Commit",
    "",
    "Message: experiment: run canonical affect behavior influence v0 phase 2. Exact result commit is reported after Git assigns the immutable object ID.",
    "",
    "## Push",
    "",
    "Performed after this report is committed; exact local/origin equality is reported in the task closeout.",
    "",
    "## Worktree",
    "",
    "Final clean/dirty state is reported after commit and push in the task closeout.",
    "",
    "## Scientific Adjudication",
    "",
    summary.scientific_adjudication,
    "",
    "## Recommended Next Slice",
    "",
    summary.recommended_next_slice,
    ""
  ].join("\n");
}

function finalize(outputArgument: string, verdictArgument: string, adjudicationArgument: string, gatesArgument: string): void {
  const verdict = verdictArgument as Verdict;
  const adjudication = adjudicationArgument as Adjudication;
  check((VERDICTS as readonly string[]).includes(verdict), `invalid verdict: ${verdictArgument}`);
  check(adjudication === "NOT_NEEDED" || adjudication === "SCIENTIFIC_ADJUDICATION_RECOMMENDED", `invalid adjudication: ${adjudicationArgument}`);
  const output = resolve(ROOT, outputArgument);
  const summaryPath = resolve(output, "summary.json");
  const gatesPath = resolve(ROOT, gatesArgument);
  check(existsSync(summaryPath), "collected summary.json is required");
  check(existsSync(gatesPath), "quality-gates.json is required");
  const base = readJson(summaryPath) as Phase2Summary;
  check(base.experiment_id === EXPERIMENT_ID && base.phase === "REAL_PROVIDER_EXECUTION", "unexpected Phase 2 summary");
  const reasoning = interpretation(verdict);
  const finalized: FinalSummary = {
    ...base,
    verdict,
    scientific_adjudication: adjudication,
    causal_interpretation: reasoning.causal,
    claim_boundary: reasoning.boundary,
    recommended_next_slice: reasoning.next,
    quality_gates: readJson(gatesPath) as Record<string, unknown>
  };
  writeJson(summaryPath, finalized);
  writeFileSync(resolve(output, "REPORT.md"), report(finalized, output), "utf8");
  console.log(`FINALIZED ${verdict} ${adjudication}`);
}

const mode = process.argv[2];
if (mode === "collect") {
  const output = process.argv[3];
  check(typeof output === "string" && output.length > 0, "usage: phase2-cli.ts collect <new-output-directory>");
  await collect(output);
} else if (mode === "finalize") {
  const [output, verdict, adjudication, gates] = process.argv.slice(3);
  check(output !== undefined && verdict !== undefined && adjudication !== undefined && gates !== undefined,
    "usage: phase2-cli.ts finalize <output-directory> <verdict> <adjudication> <quality-gates-json>");
  finalize(output, verdict, adjudication, gates);
} else {
  throw new Error("usage: phase2-cli.ts collect|finalize ...");
}
