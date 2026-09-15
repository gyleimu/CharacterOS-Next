/**
 * Fresh-process matched-scene worker: restores the persisted history through the
 * production authoritative restore chain, admits the frozen current observation,
 * and executes ONE matched scene against the live Cognition V8 / Language V10
 * pipeline with the frozen provider. Prints the observation JSON on stdout and
 * saves the raw request/response artifacts before any scoring.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ALICE, MODEL, SCENARIOS, type Scenario } from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { check, restoreHistory, type HistoryBundle } from "./world.ts";

const runtimeRoot = new URL("../../../packages/runtime/dist/index.js", import.meta.url).href;
const { OllamaNativeCognitionTransportV0 } = await import(runtimeRoot);

interface WorkerInput {
  readonly bundle: HistoryBundle;
  readonly condition: string;
  readonly scenario_index: number;
  readonly replicate: number;
  readonly ablation: boolean;
  readonly evidence_dir: string;
  readonly role: "readiness" | "scene";
}

const input = JSON.parse(readFileSync(0, "utf8")) as WorkerInput;
const scenario = SCENARIOS[input.scenario_index] as Scenario;
check(scenario !== undefined, "scenario index within the frozen set");

function transport() {
  return new OllamaNativeCognitionTransportV0({
    base_url: MODEL.base_url,
    model: MODEL.model,
    timeout_ms: MODEL.timeout_ms,
    num_predict: MODEL.num_predict
  });
}

const runtime = await restoreHistory(input.bundle);
const observation = await runScene(runtime, {
  condition: `${input.condition}${input.ablation ? "_SEARCH_ABLATED" : ""}`,
  scenario,
  replicate: input.replicate,
  ablation: input.ablation,
  cognitionTransport: transport(),
  languageTransport: transport()
});

mkdirSync(input.evidence_dir, { recursive: true });
const label = `${input.condition.toLowerCase()}${input.ablation ? "-ablated" : ""}-${scenario.id}-r${input.replicate}`;
writeFileSync(join(input.evidence_dir, `${label}.json`), `${JSON.stringify({ input: { condition: input.condition, ablation: input.ablation, scenario: scenario.id, replicate: input.replicate, model: MODEL, counterpart: ALICE }, observation }, null, 2)}\n`);
process.stdout.write(JSON.stringify(observation));
process.stderr.write(`SCENE ${label} ${(observation as SceneObservation).result_kind} class=${(observation as SceneObservation).behavior_class} cognition=${(observation as SceneObservation).cognition.calls} language=${(observation as SceneObservation).language.calls}\n`);
