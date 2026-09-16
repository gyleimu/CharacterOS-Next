/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — fresh-process scene worker (one executor, one scene).
 *
 * Identical scientific flow to the frozen V2 worker — authoritative v4 restore, frozen current
 * observation, ONE matched scene through the production executor — with the executor selected by
 * `executor` in the payload. The V2 `scene.ts`/`world.ts`/`contract.ts` modules are imported
 * UNMODIFIED, so prompt construction, evidence rendering, scenario and structured outcomes cannot
 * drift between executors.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONDITION_IDS,
  SCENARIOS,
  type ConditionId,
  type Scenario
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import { runScene } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { check, restoreHistory, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import { EXECUTOR_IDS, RETRY_POLICY, type ExecutorId } from "./contract.ts";
import { buildExecutor } from "./executor.ts";

interface WorkerInput {
  readonly bundle: HistoryBundle;
  readonly condition: ConditionId;
  readonly scenario_index: number;
  readonly replicate: number;
  readonly evidence_dir: string;
  readonly identity_phase: string;
  readonly executor: ExecutorId;
}

const input = JSON.parse(readFileSync(0, "utf8")) as WorkerInput;
const scenario = SCENARIOS[input.scenario_index] as Scenario;
check(scenario !== undefined, "scenario index within the frozen set");
check((CONDITION_IDS as readonly string[]).includes(input.condition), "condition within the frozen cell set");
check((EXECUTOR_IDS as readonly string[]).includes(input.executor), "executor within the frozen set");

const built = buildExecutor({ id: input.executor, env: process.env });
if (!built.ok) {
  process.stderr.write(`EXECUTOR_UNCONFIGURED: ${built.detail}\n`);
  throw new Error(`EXECUTOR_UNCONFIGURED: ${built.detail}`);
}
const executor = built.executor;

const runtime = await restoreHistory(input.bundle);
const observation = await runScene(runtime, {
  condition: input.condition,
  scenario,
  replicate: input.replicate,
  suppress_mediator_contribution: input.condition === "C_HIGH_CONTEXT_ABLATED",
  cognitionTransport: executor.transport,
  languageTransport: executor.transport,
  identity_phase: `${input.executor.toLowerCase()}-${input.identity_phase}`
});

const accounting = {
  executor: input.executor,
  config: {
    model: executor.config.model,
    provider: executor.config.provider,
    base_url: executor.config.base_url,
    temperature: executor.config.temperature,
    top_p: executor.config.top_p,
    max_tokens: executor.config.max_tokens,
    timeout_ms: executor.config.timeout_ms,
    seed_support: executor.config.seed_support,
    schema_enforcement_mode: executor.config.schema_enforcement_mode
  },
  key_fingerprint: executor.key_fingerprint,
  retry_policy: "FROZEN_MAX_3_ATTEMPTS_TRANSPORT_ONLY_IDENTICAL_INPUT",
  local_fallback: "FORBIDDEN",
  usage: executor.observations.usage,
  attempts: executor.observations.attempts,
  captured_requests: executor.observations.requests
};

mkdirSync(input.evidence_dir, { recursive: true });
const label = `${input.executor.toLowerCase()}-${input.condition.toLowerCase()}-r${input.replicate}`;
const directory = join(input.evidence_dir, `${input.identity_phase}-scenes`);
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, `${label}.json`), `${JSON.stringify({
  input: {
    executor: input.executor,
    condition: input.condition,
    scenario: scenario.id,
    replicate: input.replicate,
    identity_phase: input.identity_phase
  },
  accounting,
  observation
}, null, 2)}\n`);
process.stdout.write(JSON.stringify({ ...observation, __accounting: accounting }));
process.stderr.write(
  `SCENE ${label} ${observation.result_kind} class=${observation.behavior_class}`
  + ` ctx=${String(observation.recognition.counterpart_context_visible_in_prompt)}`
  + ` tok=${String(executor.observations.usage.total_tokens)} attempts=${String(executor.observations.attempts.length)}\n`
);
void RETRY_POLICY;
