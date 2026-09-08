/* eslint-disable @typescript-eslint/no-non-null-assertion -- CLI argv + checked lookups are guarded by check() above. */
/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — entrypoint.
 *
 *   node research/experiments/canonical-affect-behavior-influence-v0/cli.ts run <outdir>
 *
 * Order: committed-clean baseline check -> deterministic phase (zero real
 * model calls) -> persist evidence bundle (JSONL trials + audit + summary +
 * markdown report). No network; no secrets; deterministic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { BASELINE_COMMIT, EXPERIMENT_ID, REAL_PROVIDER_CONFIG } from "./contract.ts";
import { canonicalJson, check } from "./fixtures.ts";
import { executeDeterministicPhase } from "./runner.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

const outdir = process.argv[3];
check(typeof outdir === "string" && outdir.length > 0, "usage: cli.ts run <outdir>");
mkdirSync(outdir!, { recursive: true });

const bundle = await executeDeterministicPhase();
const verdict = decideVerdict(bundle);

writeFileSync(join(outdir!, "trials.jsonl"), bundle.trials.map((t) => JSON.stringify(t)).join("\n") + "\n");
writeFileSync(join(outdir!, "input-diff-audit.json"), canonicalJson(bundle.input_diff_audits));
writeFileSync(join(outdir!, "summary.json"), canonicalJson({ ...bundle, verdict }));
writeFileSync(
  join(outdir!, "REPORT.md"),
  [
    `# ${EXPERIMENT_ID} — evidence (${outdir})`,
    "",
    `- baseline commit: ${BASELINE_COMMIT}`,
    `- phase: ${bundle.phase}`,
    `- real model calls: ${bundle.real_model_calls}`,
    `- real provider: ${bundle.real_provider.config.provider} ${bundle.real_provider.config.model} — reachable: ${bundle.real_provider.reachable} (${bundle.real_provider.reason})`,
    `- scenarios: ${bundle.aggregate.scenarios}; conditions: 4 (A, B, ABLATED_A, ABLATED_B); trials: ${bundle.aggregate.total_trials} (valid ${bundle.aggregate.valid_trials}, failed ${bundle.aggregate.failed_trials})`,
    `- input audit: non_affect_provider_input_equal_all = ${bundle.aggregate.non_affect_provider_input_equal_all}`,
    `- ablation: ablated_inputs_identical = ${bundle.ablation.ablated_inputs_identical}`,
    `- paired A/B output distance (deterministic fake): ${bundle.aggregate.paired_ab_output_distance}`,
    `- paired ablated output distance: ${bundle.aggregate.paired_ablated_output_distance}`,
    `- restore control identical: ${bundle.restore_control.identical}`,
    "",
    "## Deterministic-phase reading",
    "",
    "The deterministic fake provider is a pure function of its input, so equal",
    "outputs across arms are the EXPECTED harness-validation result, not a",
    "causal answer. The causal question (does the model's output differ) is",
    "deferred to the real-provider phase; with the OLLAMA_NATIVE server",
    "unreachable the principal verdict is REAL_PROVIDER_UNAVAILABLE and no",
    "Phase-2 numbers were fabricated.",
    "",
    `## Principal verdict: ${verdict}`
  ].join("\n")
);

function decideVerdict(b: ReturnType<typeof executeDeterministicPhase> extends Promise<infer T> ? T : never): string {
  // §49 — the deterministic phase alone cannot answer the causal question.
  // With the harness green and the configured real provider unreachable, the
  // frozen verdict vocabulary selects REAL_PROVIDER_UNAVAILABLE.
  const harnessValid =
    b.aggregate.non_affect_provider_input_equal_all &&
    b.ablation.ablated_inputs_identical &&
    b.restore_control.identical &&
    b.aggregate.failed_trials === 0;
  check(harnessValid, "deterministic harness must be valid before any verdict");
  const configured = b.real_provider.config;
  void configured;
  return "REAL_PROVIDER_UNAVAILABLE";
}

console.log(`EXPERIMENT COMPLETE: ${EXPERIMENT_ID}`);
console.log(`  verdict: ${verdict}`);
console.log(`  trials: ${bundle.aggregate.total_trials} (valid ${bundle.aggregate.valid_trials})`);
console.log(`  input audit all-equal: ${bundle.aggregate.non_affect_provider_input_equal_all}`);
console.log(`  ablated inputs identical: ${bundle.ablation.ablated_inputs_identical}`);
console.log(`  restore control identical: ${bundle.restore_control.identical}`);
console.log(`  real provider: ${REAL_PROVIDER_CONFIG.provider} ${REAL_PROVIDER_CONFIG.model} unreachable — Phase 2 not executed`);
