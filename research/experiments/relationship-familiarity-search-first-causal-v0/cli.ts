/**
 * RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — CLI.
 *
 *   node research/experiments/relationship-familiarity-causal-completion-v0/cli.ts prepare <dir>
 *   node research/experiments/relationship-familiarity-causal-completion-v0/cli.ts run <dir>
 *
 * `prepare` runs the zero-model preflight, freezes the fixture + manifest, and
 * verifies the provider identity/digest without any generation call. `run`
 * executes the bounded qualification exactly once per scheduled scene with no
 * retries. Nothing is tuned after the freeze.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CALL_BUDGET, EXPERIMENT_ID, MODEL, scheduledCallMaximum, scheduledScenes } from "./contract.ts";
import { preflight, type FrozenFixture } from "./preflight.ts";
import { runQualification } from "./runner.ts";
import { check, hashJson } from "./world.ts";

async function probeProvider(): Promise<{ model: string; digest: string; server_version: string; details: unknown }> {
  const response = await fetch(`${MODEL.base_url}/api/tags`, { signal: AbortSignal.timeout(10000) });
  check(response.ok, "provider tags reachable");
  const data = await response.json() as { models: { name: string; digest: string; details: unknown }[] };
  const model = data.models.find((entry) => entry.name === MODEL.model);
  check(model !== undefined, `pinned model present (${MODEL.model})`);
  check(model?.digest === MODEL.digest, "exact pinned local model digest; never pull/fallback");
  const versionResponse = await fetch(`${MODEL.base_url}/api/version`, { signal: AbortSignal.timeout(10000) });
  check(versionResponse.ok, "provider version reachable");
  const version = await versionResponse.json() as { version: string };
  check(version.version === MODEL.server_version, `frozen server version (${version.version})`);
  const resolved = model as { name: string; digest: string; details: unknown };
  return { model: resolved.name, digest: resolved.digest, server_version: version.version, details: resolved.details };
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function prepare(directory: string) {
  const head = git("rev-parse", "HEAD");
  const status = git("status", "--porcelain");
  const frozen = await preflight();
  const provider = await probeProvider();
  const manifest = {
    schema_version: "familiarity-completion-manifest-v0",
    experiment_id: EXPERIMENT_ID,
    harness_head: head,
    worktree_clean_at_freeze: status.length === 0,
    preflight_hash: frozen.fixture.preflight_hash,
    scheduled_scenes: scheduledScenes().length,
    scheduled_calls_maximum: scheduledCallMaximum(),
    call_budget: CALL_BUDGET,
    model: MODEL,
    provider,
    frozen_at: new Date().toISOString()
  };
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "frozen-fixture.json"), `${JSON.stringify(frozen.fixture, null, 2)}\n`, { flag: "wx" });
  writeFileSync(join(directory, "preflight.json"), `${JSON.stringify(frozen.evidence, null, 2)}\n`, { flag: "wx" });
  writeFileSync(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  writeFileSync(join(directory, "SUMMARY.md"), [
    "# RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — readiness",
    "",
    `EXPERIMENT_FROZEN_AND_READY (harness ${head}, preflight ${frozen.fixture.preflight_hash.slice(0, 18)}…)`,
    "",
    `Model: ${provider.model} digest ${provider.digest.slice(0, 12)}… server ${provider.server_version}.`,
    `Scheduled scenes: ${scheduledScenes().length}; maximum generation calls ${scheduledCallMaximum()} (budget ${CALL_BUDGET.max_total}).`,
    "Deterministic preflight: PASS with 0 model calls.",
    "Qualification: NOT STARTED. No tuning, no retries, no fallback.",
    ""
  ].join("\n"), { flag: "wx" });
  process.stdout.write(`FROZEN ${hashJson(manifest)}\n`);
}

async function run(readinessDir: string, outputDir: string) {
  const fixture = JSON.parse(readFileSync(join(readinessDir, "frozen-fixture.json"), "utf8")) as FrozenFixture;
  const manifest = JSON.parse(readFileSync(join(readinessDir, "manifest.json"), "utf8")) as { preflight_hash: string; harness_head: string };
  check(fixture.preflight_hash === manifest.preflight_hash, "frozen fixture matches the manifest");
  const provider = await probeProvider();
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "frozen-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const verdict = await runQualification(fixture, join(outputDir, "scenes"));
  writeFileSync(join(outputDir, "SUMMARY.md"), [
    "# RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — qualification",
    "",
    `**Principal verdict: \`${verdict.verdict}\`**`,
    "",
    `${verdict.detail}.`,
    "",
    `Scenes: ${verdict.observations}/${scheduledScenes().length}; host complete: ${String(verdict.host_complete)}.`,
    `Calls: cognition ${verdict.calls.cognition}, language ${verdict.calls.language} (maximum ${verdict.scheduled_calls_maximum}).`,
    `Paired directional (LOW vs HIGH): ${verdict.paired_directional}/${scheduledScenes().filter((scene) => scene.condition === "LOW" && scene.scenario.primary).length}.`,
    `Retrieval-mediator ablation returns toward LOW (HIGH vs HIGH_SEARCH_ABLATED): ${verdict.ablation_returns_toward_low}/${verdict.paired_total}.`,
    `Manipulation check: ${String(verdict.manipulation_ok)}; same corpus: ${String(verdict.same_corpus_ok)}; retrieval context differs: ${String(verdict.retrieval_context_differs)}.`,
    `Language authority clean: ${String(verdict.language_authority_clean)}; forbidden vocabulary: ${verdict.forbidden_vocabulary.join(", ") || "none"}.`,
    `Model: ${provider.model} digest ${provider.digest.slice(0, 12)}… server ${provider.server_version}.`,
    "",
    "One bounded qualification run. No retries, no prompt/scenario/threshold tuning.",
    ""
  ].join("\n"));
  process.stdout.write(`${verdict.verdict}\n`);
}

const [command, directory, outputDirectory] = process.argv.slice(2);
if (command === "prepare" && directory !== undefined) await prepare(directory);
else if (command === "run" && directory !== undefined) {
  await run(directory, outputDirectory ?? join(directory, "qualification"));
} else {
  process.stderr.write("usage: cli.ts prepare <readiness-dir> | run <readiness-dir> [output-dir]\n");
  process.exitCode = 2;
}
