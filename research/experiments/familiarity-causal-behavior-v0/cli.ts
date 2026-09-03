/* eslint-disable no-restricted-imports -- Experiment-only consumer of built public package roots. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/index.js";
import { check, equal } from "./adapter.ts";
import { BASELINE, EXPERIMENT_ID, MODEL, ORDER, RUBRIC, SUCCESS_GATES, SCENARIO, HISTORY_SCENES, EVALUATOR_SYSTEM } from "./contract.ts";
import { preflight, sha256, type Preflight } from "./harness.ts";
import { ROOT, git, readJson, writeJson, freshDirectory, committedBaseline, probeProvider, verifyGates, type Gates } from "./artifacts.ts";
import { executePrimary } from "./runner.ts";

const frozen = { experiment_id: EXPERIMENT_ID, required_baseline: BASELINE, scenario: SCENARIO,
  histories: { A: HISTORY_SCENES.slice(0, 1), B: HISTORY_SCENES }, model: MODEL,
  order: ORDER, n_per_arm: 8, rubric: RUBRIC, success_gates: SUCCESS_GATES,
  evaluator: { model: MODEL, prompt: EVALUATOR_SYSTEM, prompt_hash: sha256(EVALUATOR_SYSTEM),
    blind_fields_only: ["scenario", "reply", "lawful_memory_evidence"], version: "familiarity-rubric-evaluator-v0" },
  retrieval: "existing InMemoryRetrievalService declarative rehearsal; not a learned retrieval/search benchmark",
  observation: "experiment-only reply envelope; not an executed action, cognition-proposal-v0 remains unchanged",
  secondary_model_calls: 0, restore: "deterministic fresh-process A/B only; no secondary model claim"
};
interface Manifest {
  status: "EXPERIMENT_READY" | "EXPERIMENT_READY_NEEDS_PROVIDER";
  frozen: typeof frozen;
  harness_commit: string;
  gates_hash: string;
  preflight_hash: string;
  provider: Awaited<ReturnType<typeof probeProvider>> | null;
  provider_error: string | null;
}

const command = process.argv[2];
if (command === "prepare") {
  const commit = committedBaseline();
  const gatesPath = resolve(ROOT, process.argv[3] ?? "tmp/familiarity-gates-v0/gates.json");
  const gates = readJson(gatesPath) as Gates;
  verifyGates(gates);
  const checks = await preflight();
  let provider: Manifest["provider"] = null;
  let providerError: string | null = null;
  try { provider = await probeProvider(); } catch (error) { providerError = String(error); }
  const manifest: Manifest = { status: provider ? "EXPERIMENT_READY" : "EXPERIMENT_READY_NEEDS_PROVIDER",
    frozen, harness_commit: commit, gates_hash: sha256(JSON.stringify(gates)), preflight_hash: sha256(JSON.stringify(checks)),
    provider, provider_error: providerError };
  const output = freshDirectory(process.argv[4] ?? "tmp/familiarity-ready-v0");
  writeJson(join(output, "gates.json"), gates);
  writeJson(join(output, "preflight.json"), checks);
  writeJson(join(output, "manifest.json"), manifest);
  writeFileSync(join(output, "SUMMARY.md"), `# ${manifest.status}\n\nHarness: ${commit}\n\nNo real-model generation calls. Deterministic A/B: 8/8 each; same-state, Bob, empty retrieval and fresh-process restore PASS.\n\nProvider: ${provider ? `${provider.model} / ${provider.digest}; server ${provider.server_version}` : providerError}\n\nN=8 per arm, 16 primary calls remain unexecuted. No behavioral or grounding result exists yet.\n\nInputs differ only by history-caused familiarity, strategy, lawful evidence and revision/hash metadata; see preflight accounting.\n`, { flag: "wx" });
  console.log(`${manifest.status}: ${output}`);
} else if (command === "run") {
  check(process.argv[3] && process.argv[4], "run requires a frozen ready directory and a new output directory");
  const ready = resolve(ROOT, process.argv[3]);
  const manifest = readJson(join(ready, "manifest.json")) as Manifest;
  const checks = readJson(join(ready, "preflight.json")) as Preflight;
  const gates = readJson(join(ready, "gates.json")) as Gates;
  const executionCommit = committedBaseline();
  check(equal(manifest.frozen, frozen) && manifest.status === "EXPERIMENT_READY" && manifest.provider !== null, "frozen complete manifest and configured provider required");
  check(manifest.preflight_hash === sha256(JSON.stringify(checks)) && manifest.gates_hash === sha256(JSON.stringify(gates)), "persisted evidence integrity");
  git("merge-base", "--is-ancestor", manifest.harness_commit, executionCommit);
  check(git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0] === executionCommit, "committed harness/evidence pushed before first formal run");
  verifyGates(gates);
  check(equal(checks, await preflight()), "fresh deterministic preflight identical to frozen record");
  const guard = async () => {
    check(committedBaseline() === executionCommit, "no worktree/commit drift during run");
    verifyGates(gates);
    check(equal(await probeProvider(), manifest.provider), "provider model/server identity unchanged");
  };
  await guard();
  // Exclusive registration locks this preregistration even after process death.
  // Never delete it to retry; partial runs stay invalid and remain evidence.
  check(relative(ROOT, resolve(ROOT, process.argv[4])).replaceAll("\\", "/").startsWith("tmp/"), "formal output must be in ignored tmp until the evidence commit");
  const lockDir = join(ROOT, "tmp/familiarity-run-locks");
  mkdirSync(lockDir, { recursive: true });
  const lockKey = sha256(JSON.stringify({ frozen, harness: manifest.harness_commit, preflight: manifest.preflight_hash })).slice(7);
  writeFileSync(join(lockDir, `${lockKey}.json`), JSON.stringify({ execution_commit: executionCommit, started_at: new Date().toISOString(), output: process.argv[4] }), { flag: "wx" });
  const output = freshDirectory(process.argv[4]);
  writeJson(join(output, "manifest.json"), { ...manifest, execution_commit: executionCommit });
  writeJson(join(output, "preflight.json"), checks);
  writeJson(join(output, "gates.json"), gates);
  const result = await executePrimary({ preflight: checks,
    primary: new OllamaNativeCognitionTransportV0(MODEL), evaluator: new OllamaNativeCognitionTransportV0(MODEL), guard,
    save: async (name, value) => { const path = join(output, `${name}.json`); mkdirSync(dirname(path), { recursive: true }); writeJson(path, value); }
  });
  writeFileSync(join(output, "SUMMARY.md"), `# ${result.interpretation}\n\n${JSON.stringify(result.counts, null, 2)}\n\nDirectional pairs: ${result.paired_directional}/8. Unsupported: ${result.unsupported} classified replies; complete=${result.complete}.\n\nPrimary calls: ${result.primary_calls}; evaluator calls: ${result.evaluator_calls}. No retries, prompt edits, or statistical significance claim. Invalid/incomplete runs have no behavioral interpretation.\n`, { flag: "wx" });
  console.log(`${result.interpretation}: ${output}`);
} else {
  // Explicit commands only; importing/running this file never silently starts API work.
  console.log(readFileSync(new URL("./README.md", import.meta.url), "utf8"));
  process.exitCode = 1;
}
