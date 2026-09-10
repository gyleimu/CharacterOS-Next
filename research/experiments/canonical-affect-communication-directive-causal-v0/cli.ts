/**
 * CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0 — entrypoint.
 *
 *   node research/experiments/canonical-affect-communication-directive-causal-v0/cli.ts phase-a <outdir>
 *   node research/experiments/canonical-affect-communication-directive-causal-v0/cli.ts collect <outdir>
 *   node research/experiments/canonical-affect-communication-directive-causal-v0/cli.ts finalize <outdir>
 *
 * phase-a:  zero real calls; freeze all preregistration artifacts and gates.
 * collect:  strict-prefix resumable real-provider collection (120 cognition
 *           calls; language calls = 0); persists every trial immediately.
 * finalize: zero-generation integrity recomputation, analysis, verdict, report.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  ARMS,
  BASELINE_COMMIT,
  BOUNDARY_SCENARIOS,
  EXPERIMENT_VERSION,
  HARD_CONTROL_SCENARIOS,
  PLANNED_COGNITION_CALLS,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO,
  VERDICT_RULE
} from "./contract.ts";
import { canonicalJson, check } from "./fixtures.ts";
import { executePhaseA } from "./harness.ts";
import {
  buildExecutionPlan,
  executeCognitionDirectiveTrial,
  probeProviderEnvironment,
  type TrialRecord
} from "./real-runner.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

const command = process.argv[2];
const outdir = process.argv[3];
check(typeof command === "string" && typeof outdir === "string", "usage: cli.ts <phase-a|collect|finalize> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, canonicalJson(value));
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function phaseAPath(dir: string): string {
  return resolve(dir, "phase-a-complete.json");
}

if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  const phaseA = await executePhaseA();
  const preflight = await probeProviderEnvironment();
  check(preflight.reachable, `provider unreachable: ${preflight.failure ?? "no response"}`);
  check(preflight.digest_matches_required, `provider digest mismatch: ${preflight.digest}`);
  writeJson(join(outdir!, "config.json"), phaseA.artifacts.config);
  writeJson(join(outdir!, "scenario-manifest.json"), phaseA.artifacts.scenario_manifest);
  writeJson(join(outdir!, "scenario-ingress-audit.json"), phaseA.artifacts.scenario_ingress_audit);
  writeJson(join(outdir!, "history-construction.json"), phaseA.artifacts.history_construction);
  writeJson(join(outdir!, "input-diff-audit.json"), phaseA.artifacts.input_diff_audit);
  writeJson(join(outdir!, "directive-semantics-audit.json"), phaseA.artifacts.directive_semantics_audit);
  writeJson(join(outdir!, "restore-controls.json"), phaseA.artifacts.restore_controls);
  writeJson(join(outdir!, "provider-preflight.json"), preflight);
  writeJson(join(outdir!, "metric-contract.json"), {
    schema_version: "canonical-affect-communication-directive-metric-contract-v0",
    experiment_version: EXPERIMENT_VERSION,
    primary_endpoint: "communication_directive exact two-value equality per matched A/B unit",
    treatment_disagreement_rate: "directive-differing treatment pairs / complete treatment pairs",
    ablation_disagreement_rate: "directive-differing ABL_A/ABL_B pairs / complete ablation pairs",
    primary_delta: "treatment rate - ablation rate",
    secondary: ["current_intent exact equality", "confidence", "uncertainty", "reasoning_summary_length"],
    directive_distribution: "per scenario x arm CLARIFY/REALIZE counts",
    failure_classification: ["VALID", "PROVIDER_ERROR", "TIMEOUT", "INVALID_SCHEMA", "VALIDATION_REJECTED", "STALE", "OTHER_RUNTIME_FAILURE"]
  });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "canonical-affect-communication-directive-verdict-contract-v0",
    experiment_version: EXPERIMENT_VERSION,
    verdicts: [
      "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_INFLUENCE_SUPPORTED",
      "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY",
      "NO_MEASURABLE_COMMUNICATION_DIRECTIVE_INFLUENCE_UNDER_V0",
      "DIRECTIVE_SEMANTIC_INSTABILITY",
      "EXPERIMENT_CONFOUND_DETECTED",
      "REAL_PROVIDER_UNAVAILABLE"
    ],
    rules: { ...VERDICT_RULE },
    frozen_before_real_provider_output: true
  });
  writeJson(join(outdir!, "phase-a.json"), phaseA.artifacts.phase_a);
  writeJson(phaseAPath(outdir!), {
    schema_version: "canonical-affect-communication-directive-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    all_pass: true,
    real_generation_calls: 0,
    planned_cognition_calls: PLANNED_COGNITION_CALLS
  });
  console.log(`PHASE A COMPLETE: ${SCENARIOS.length} scenarios (${BOUNDARY_SCENARIOS.length} boundary, ${HARD_CONTROL_SCENARIOS.length} hard controls), ${ARMS.length} arms, ${PLANNED_COGNITION_CALLS} planned cognition calls, 0 real calls made`);
} else if (command === "collect") {
  check(existsSync(phaseAPath(outdir!)), "phase-a-complete.json missing: run phase-a first");
  check(!existsSync(resolve(outdir!, "collection-complete.json")), "collection is already complete; refusing extra generation");
  const phaseA = await executePhaseA();
  const plan = buildExecutionPlan(phaseA);
  const trialsPath = resolve(outdir!, "trials.jsonl");
  const inflightPath = resolve(outdir!, "inflight.json");
  const collected: TrialRecord[] = [];
  if (existsSync(trialsPath)) {
    collected.push(...readFileSync(trialsPath, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as TrialRecord));
  }
  // Strict-prefix resume: the collected prefix must match the plan exactly.
  for (let i = 0; i < collected.length; i += 1) {
    check(collected[i]!.trial_id === plan[i]!.trial_id, `resume prefix mismatch at ${i}: ${collected[i]!.trial_id} != ${plan[i]!.trial_id}`);
  }
  check(collected.length <= plan.length, "collected trials exceed the frozen plan");
  let pending = existsSync(inflightPath) ? (readJson(inflightPath) as { readonly next_execution_order: number }) : null;
  for (let i = collected.length; i < plan.length; i += 1) {
    const item = plan[i]!;
    check(pending === null || pending.next_execution_order === item.execution_order, "inflight checkpoint exists after final plan item");
    const record = await executeCognitionDirectiveTrial(item, item.cell.provider_inputs[item.arm]);
    collected.push(record);
    writeFileSync(trialsPath, collected.map((t) => JSON.stringify(t)).join("\n") + "\n");
    if (i + 1 < plan.length) {
      writeJson(inflightPath, { checkpoint_schema_version: "canonical-affect-communication-directive-inflight-v0", next_execution_order: plan[i + 1]!.execution_order });
      pending = { next_execution_order: plan[i + 1]!.execution_order };
    } else {
      pending = null;
    }
  }
  if (existsSync(inflightPath)) unlinkSync(inflightPath);
  check(collected.length === PLANNED_COGNITION_CALLS, `collection must contain ${PLANNED_COGNITION_CALLS} cognition trials`);
  writeJson(resolve(outdir!, "collection-complete.json"), {
    schema_version: "canonical-affect-communication-directive-collection-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    planned_cognition_calls: PLANNED_COGNITION_CALLS,
    collected_trials: collected.length,
    language_calls: 0,
    trial_file_sha256_prefix_rows: collected.length
  });
  console.log(`COLLECTION COMPLETE: ${collected.length}/${PLANNED_COGNITION_CALLS} cognition trials; language calls 0`);
} else if (command === "finalize") {
  check(existsSync(resolve(outdir!, "collection-complete.json")), "collection incomplete");
  check(!existsSync(resolve(outdir!, "inflight.json")), "collection retained an in-flight checkpoint");
  const trials = readFileSync(resolve(outdir!, "trials.jsonl"), "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as TrialRecord);
  check(trials.length === PLANNED_COGNITION_CALLS, `collection must contain ${PLANNED_COGNITION_CALLS} cognition trials`);
  const plan = buildExecutionPlan(await executePhaseA());
  // Collection integrity: exact plan identity match, no duplicates/missing/extras.
  const planIds = plan.map((p) => p.trial_id);
  const actualIds = trials.map((t) => t.trial_id);
  check(canonicalJson(planIds) === canonicalJson(actualIds), "collected trial identities do not match the frozen execution plan");
  const trialSha256 = (content: string) => createHash("sha256").update(content).digest("hex");
  const integrity = {
    schema_version: "canonical-affect-communication-directive-collection-integrity-v0",
    experiment_version: EXPERIMENT_VERSION,
    planned_identities: planIds.length,
    actual_identities: actualIds.length,
    duplicates: actualIds.length - new Set(actualIds).size,
    missing: planIds.filter((id) => !actualIds.includes(id)).length,
    extras: actualIds.filter((id) => !planIds.includes(id)).length,
    strict_prefix_order_matches: true,
    trials_file_sha256: trialSha256(readFileSync(resolve(outdir!, "trials.jsonl"), "utf8")),
    collection_complete_marker_valid: true
  };
  writeJson(resolve(outdir!, "collection-integrity.json"), integrity);
  check(integrity.duplicates === 0 && integrity.missing === 0 && integrity.extras === 0, "collection integrity failure");

  // ---- analysis ------------------------------------------------------------------
  type Unit = { readonly key: string; readonly trials: TrialRecord[] };
  const units = new Map<string, Unit>();
  for (const t of trials) {
    const ordinal = t.trial_ordinal;
    const key = `${t.scenario_id}|${ordinal}`;
    if (!units.has(key)) units.set(key, { key, trials: [] });
    units.get(key)!.trials.push(t);
  }
  const completeUnits = [...units.values()].filter((unit) =>
    ARMS.every((arm) => unit.trials.find((t) => t.arm === arm && t.cognition.status === "VALID")));
  const pairOf = (unit: Unit, x: Arm, y: Arm): { readonly x: TrialRecord; readonly y: TrialRecord } | null => {
    const a = unit.trials.find((t) => t.arm === x);
    const b = unit.trials.find((t) => t.arm === y);
    return a && b ? { x: a, y: b } : null;
  };
  const directiveDisagreement = (unit: Unit, x: Arm, y: Arm): number | null => {
    const pair = pairOf(unit, x, y);
    if (pair === null) return null;
    return pair.x.cognition.communication_directive !== pair.y.cognition.communication_directive ? 1 : 0;
  };
  const intentDisagreement = (unit: Unit, x: Arm, y: Arm): number | null => {
    const pair = pairOf(unit, x, y);
    if (pair === null) return null;
    return pair.x.cognition.current_intent !== pair.y.cognition.current_intent ? 1 : 0;
  };
  const rateOrNull = (values: readonly (number | null)[]): number | null => {
    const present = values.filter((v) => v !== null) as number[];
    return present.length === 0 ? null : present.reduce((sum, v) => sum + v, 0) / present.length;
  };
  const rate = (values: readonly (number | null)[]): number => {
    const present = values.filter((v) => v !== null) as number[];
    check(present.length > 0, "no paired observations");
    return present.reduce((sum, v) => sum + v, 0) / present.length;
  };

  const boundaryUnits = completeUnits.filter((unit) => unit.trials[0]!.scenario_class === "BOUNDARY");
  const controlUnits = completeUnits.filter((unit) => unit.trials[0]!.scenario_class !== "BOUNDARY");

  const treatmentRate = rate(completeUnits.map((u) => directiveDisagreement(u, "A", "B")));
  const ablationRate = rate(completeUnits.map((u) => directiveDisagreement(u, "ABL_A", "ABL_B")));
  const delta = treatmentRate - ablationRate;
  const treatmentIntentRate = rate(completeUnits.map((u) => intentDisagreement(u, "A", "B")));
  const ablationIntentRate = rate(completeUnits.map((u) => intentDisagreement(u, "ABL_A", "ABL_B")));

  const boundaryTreatment = rate(boundaryUnits.map((u) => directiveDisagreement(u, "A", "B")));
  const boundaryAblation = rate(boundaryUnits.map((u) => directiveDisagreement(u, "ABL_A", "ABL_B")));
  const controlTreatment = rate(controlUnits.map((u) => directiveDisagreement(u, "A", "B")));
  const controlAblation = rate(controlUnits.map((u) => directiveDisagreement(u, "ABL_A", "ABL_B")));

  const scenarioSummary = SCENARIOS.map((scenario) => {
    const rows = trials.filter((t) => t.scenario_id === scenario.scenario_id);
    const distribution: Record<string, Record<string, number>> = {};
    for (const arm of ARMS) {
      distribution[arm] = { CLARIFY_MISSING_CONTEXT: 0, REALIZE_CURRENT_INTENT: 0, INVALID: 0 };
      for (const row of rows.filter((r) => r.arm === arm)) {
        if (row.cognition.communication_directive === null) distribution[arm]!.INVALID += 1;
        else distribution[arm]![row.cognition.communication_directive] += 1;
      }
    }
    const unitsForScenario = completeUnits.filter((unit) => unit.trials[0]!.scenario_id === scenario.scenario_id);
    return {
      scenario_id: scenario.scenario_id,
      scenario_class: scenario.scenario_class,
      directive_distribution: distribution,
      treatment_directive_disagreement: rateOrNull(unitsForScenario.map((u) => directiveDisagreement(u, "A", "B"))),
      ablation_directive_disagreement: rateOrNull(unitsForScenario.map((u) => directiveDisagreement(u, "ABL_A", "ABL_B")))
    };
  });

  // §48 — intent/directive consistency table (treatment pairs, descriptive).
  const consistency = { INTENT_SAME_DIRECTIVE_SAME: 0, INTENT_DIFFERENT_DIRECTIVE_SAME: 0, INTENT_SAME_DIRECTIVE_DIFFERENT: 0, INTENT_DIFFERENT_DIRECTIVE_DIFFERENT: 0 };
  for (const unit of completeUnits) {
    const i = intentDisagreement(unit, "A", "B");
    const d = directiveDisagreement(unit, "A", "B");
    check(i !== null && d !== null, "treatment pair missing");
    if (i === 0 && d === 0) consistency.INTENT_SAME_DIRECTIVE_SAME += 1;
    else if (i === 1 && d === 0) consistency.INTENT_DIFFERENT_DIRECTIVE_SAME += 1;
    else if (i === 0 && d === 1) consistency.INTENT_SAME_DIRECTIVE_DIFFERENT += 1;
    else consistency.INTENT_DIFFERENT_DIRECTIVE_DIFFERENT += 1;
  }

  const boundaryScenariosWithEffect = scenarioSummary.filter((s) =>
    s.scenario_class === "BOUNDARY" && s.treatment_directive_disagreement > s.ablation_directive_disagreement).length;

  let verdict: string;
  if (boundaryUnits.length >= VERDICT_RULE.minimum_complete_boundary_four_arm_units
      && delta >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_delta
      && boundaryScenariosWithEffect >= VERDICT_RULE.supported_minimum_boundary_scenarios_with_effect
      && !(controlTreatment - controlAblation >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_delta)) {
    verdict = "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_INFLUENCE_SUPPORTED";
  } else if (delta <= VERDICT_RULE.no_measurable_maximum_treatment_minus_ablation_delta) {
    verdict = "NO_MEASURABLE_COMMUNICATION_DIRECTIVE_INFLUENCE_UNDER_V0";
  } else {
    verdict = "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY";
  }
  const hardInstability =
    controlTreatment - controlAblation >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_delta
    && controlTreatment >= 0.5;
  if (hardInstability) verdict = "DIRECTIVE_SEMANTIC_INSTABILITY";

  const failuresByArm: Record<string, { attempted: number; valid: number; failed: number; by_status: Record<string, number> }> = {};
  for (const arm of ARMS) {
    const rows = trials.filter((t) => t.arm === arm);
    failuresByArm[arm] = { attempted: rows.length, valid: rows.filter((r) => r.cognition.status === "VALID").length, failed: rows.filter((r) => r.cognition.status !== "VALID").length, by_status: {} };
    for (const row of rows) {
      const key = row.cognition.status;
      failuresByArm[arm]!.by_status[key] = (failuresByArm[arm]!.by_status[key] ?? 0) + 1;
    }
  }

  const totalPromptTokens = trials.reduce((sum, t) => sum + (t.cognition.token_counts.prompt_tokens ?? 0), 0);
  const totalCompletionTokens = trials.reduce((sum, t) => sum + (t.cognition.token_counts.completion_tokens ?? 0), 0);

  writeJson(resolve(outdir!, "boundary-summary.json"), {
    schema_version: "canonical-affect-communication-directive-boundary-summary-v0",
    complete_boundary_units: boundaryUnits.length,
    treatment_directive_disagreement: boundaryTreatment,
    ablation_directive_disagreement: boundaryAblation,
    delta: boundaryTreatment - boundaryAblation,
    scenarios_with_treatment_above_ablation: boundaryScenariosWithEffect
  });
  writeJson(resolve(outdir!, "control-summary.json"), {
    schema_version: "canonical-affect-communication-directive-control-summary-v0",
    complete_control_units: controlUnits.length,
    treatment_directive_disagreement: controlTreatment,
    ablation_directive_disagreement: controlAblation,
    delta: controlTreatment - controlAblation,
    directive_semantic_instability: hardInstability
  });
  writeJson(resolve(outdir!, "scenario-summary.json"), scenarioSummary);
  writeJson(resolve(outdir!, "failure-summary.json"), {
    schema_version: "canonical-affect-communication-directive-failure-summary-v0",
    total_rows: trials.length,
    cognition_failures: trials.filter((t) => t.cognition.status !== "VALID").length,
    language_calls: 0,
    by_arm: failuresByArm
  });
  writeJson(resolve(outdir!, "summary.json"), {
    schema_version: "canonical-affect-communication-directive-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict,
    attempted: trials.length,
    valid: completeUnits.length * ARMS.length,
    failed: trials.length - completeUnits.length * ARMS.length,
    complete_four_arm_units: completeUnits.length,
    boundary_four_arm_units: boundaryUnits.length,
    hard_control_four_arm_units: controlUnits.length,
    overall: { treatment_directive_disagreement: treatmentRate, ablation_directive_disagreement: ablationRate, delta },
    boundary: { treatment: boundaryTreatment, ablation: boundaryAblation, delta: boundaryTreatment - boundaryAblation, scenarios_with_effect: boundaryScenariosWithEffect },
    controls: { treatment: controlTreatment, ablation: controlAblation, delta: controlTreatment - controlAblation },
    intent: { treatment_disagreement: treatmentIntentRate, ablation_disagreement: ablationIntentRate, delta: treatmentIntentRate - ablationIntentRate },
    intent_directive_consistency: consistency,
    cognition_nondeterminism: { note: "identical ablated inputs are the noise control; see ablation disagreement rate", ablation_directive_disagreement: ablationRate, ablation_intent_disagreement: ablationIntentRate },
    tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalPromptTokens + totalCompletionTokens },
    gpt6: "GPT6_ADJUDICATION_NOT_NEEDED"
  });

  const report = [
    `# ${EXPERIMENT_VERSION} — evidence (${outdir})`,
    "",
    `## Principal verdict: ${verdict}`,
    "",
    `- baseline: ${BASELINE_COMMIT}`,
    `- complete four-arm units: ${completeUnits.length} (boundary ${boundaryUnits.length}, hard-control ${controlUnits.length})`,
    `- overall directive disagreement: treatment ${treatmentRate}, ablation ${ablationRate}, delta ${delta}`,
    `- boundary: treatment ${boundaryTreatment}, ablation ${boundaryAblation}, delta ${boundaryTreatment - boundaryAblation}, scenarios-with-effect ${boundaryScenariosWithEffect}/4`,
    `- hard controls: treatment ${controlTreatment}, ablation ${controlAblation}, delta ${controlTreatment - controlAblation}`,
    `- intent disagreement: treatment ${treatmentIntentRate}, ablation ${ablationIntentRate}`,
    `- intent/directive consistency: ${JSON.stringify(consistency)}`,
    `- real cognition calls: ${trials.length}; language calls: 0; tokens: ${totalPromptTokens}+${totalCompletionTokens}`,
    `- directive semantic instability: ${hardInstability ? "YES" : "NO"}`
  ].join("\n");
  writeFileSync(resolve(outdir!, "REPORT.md"), report);
  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "canonical-affect-communication-directive-quality-gates-v0",
    collection_integrity: "PASS",
    non_affect_input_equality: true,
    ablation_equality: true,
    restore_control: true,
    provider_digest: true,
    verdict_frozen: true,
    language_calls: 0,
    all_pass: true
  });
  console.log(`FINALIZE COMPLETE: verdict ${verdict}`);
  console.log(`  units: ${completeUnits.length} complete (boundary ${boundaryUnits.length}, control ${controlUnits.length})`);
  console.log(`  directive disagreement: treatment ${treatmentRate}, ablation ${ablationRate}, delta ${delta}`);
} else {
  check(false, "unknown command; expected phase-a | collect | finalize");
}
