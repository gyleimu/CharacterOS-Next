/**
 * Fresh-process matched-scene worker. Restores the persisted history through the
 * production authoritative restore chain (boundary mint → chain validation → exact
 * terminal head), admits the frozen current observation, and executes ONE matched scene
 * against the live Cognition V8 / Language V10 pipeline with the frozen provider.
 *
 * The cell-level research intervention is DERIVED here from the cell id (never chosen by
 * the caller), so a run cannot silently alter the design.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ALICE, CONDITION_IDS, MODEL, SCENARIOS, type ConditionId, type Scenario } from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { check, restoreHistory, type HistoryBundle } from "./world.ts";

const runtimeRoot = new URL("../../../packages/runtime/dist/index.js", import.meta.url).href;
const { OllamaNativeCognitionTransportV0 } = await import(runtimeRoot);

interface WorkerInput {
  readonly bundle: HistoryBundle;
  readonly condition: ConditionId;
  readonly scenario_index: number;
  readonly replicate: number;
  readonly evidence_dir: string;
  readonly identity_phase: string;
}

const input = JSON.parse(readFileSync(0, "utf8")) as WorkerInput;
const scenario = SCENARIOS[input.scenario_index] as Scenario;
check(scenario !== undefined, "scenario index within the frozen set");
check((CONDITION_IDS as readonly string[]).includes(input.condition), "condition within the frozen cell set");

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
  condition: input.condition,
  scenario,
  replicate: input.replicate,
  suppress_mediator_contribution: input.condition === "C_HIGH_CONTEXT_ABLATED",
  cognitionTransport: transport(),
  languageTransport: transport(),
  identity_phase: input.identity_phase
});

mkdirSync(input.evidence_dir, { recursive: true });
const label = `${input.condition.toLowerCase()}-${scenario.id}-r${input.replicate}`;
const directory = join(input.evidence_dir, `${input.identity_phase}-scenes`);
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, `${label}.json`), `${JSON.stringify({
  input: {
    condition: input.condition,
    scenario: scenario.id,
    replicate: input.replicate,
    identity_phase: input.identity_phase,
    model: MODEL,
    counterpart: ALICE
  },
  observation
}, null, 2)}\n`);
process.stdout.write(JSON.stringify(observation));
process.stderr.write(
  `SCENE ${label} ${(observation as SceneObservation).result_kind} class=${(observation as SceneObservation).behavior_class}`
  + ` fam=${String((observation as SceneObservation).recognition.familiarity_entry_line)}`
  + ` ctx=${String((observation as SceneObservation).recognition.counterpart_context_visible_in_prompt)}`
  + ` cited=${String((observation as SceneObservation).outcomes.counterpart_context_cited)}`
  + ` cognition=${(observation as SceneObservation).cognition.calls} language=${(observation as SceneObservation).language.calls}\n`
);
