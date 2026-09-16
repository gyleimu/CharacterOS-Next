/**
 * EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0 — fresh-process scene worker (API executor).
 *
 * Byte-for-byte the same scientific flow as the LOCAL V2 worker: authoritative v4 restore →
 * frozen current observation → ONE matched scene through the production executor. The ONLY
 * difference is the executor: `ApiExecutorTransportV0` instead of
 * `OllamaNativeCognitionTransportV0`. The frozen V2 `scene.ts` and `world.ts` modules are
 * imported UNMODIFIED, so prompt construction, evidence rendering, the scenario and the
 * structured outcomes cannot drift.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CONDITION_IDS, SCENARIOS, type ConditionId, type Scenario } from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import { runScene } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { check, restoreHistory, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import { ApiExecutorTransportV0, keyFingerprint, type TransportUsage } from "./api-transport.ts";
import { loadApiExecutorConfig } from "./contract.ts";

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

const loaded = loadApiExecutorConfig(process.env);
if (!loaded.ok) {
  process.stderr.write(`API_EXECUTOR_UNCONFIGURED: ${loaded.detail}\n`);
  throw new Error(`API_EXECUTOR_UNCONFIGURED: ${loaded.detail}`);
}
const executorConfig = loaded.config;
const executorKey = loaded.api_key;
const seedSupport = loaded.seed_support;
const keyFingerprintValue = keyFingerprint(executorKey);

const usage: TransportUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, requests: 0 };
const attempts: { attempt: number; http_status: number | null; failure_class: string | null; elapsed_ms: number }[] = [];
const usageSink = (entry: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): void => {
  usage.prompt_tokens += entry.prompt_tokens;
  usage.completion_tokens += entry.completion_tokens;
  usage.total_tokens += entry.total_tokens;
  usage.requests += 1;
};
const attemptSink = (entry: { attempt: number; http_status: number | null; failure_class: string | null; elapsed_ms: number }): void => {
  attempts.push(entry);
};

function transport(): ApiExecutorTransportV0 {
  return new ApiExecutorTransportV0({
    config: executorConfig,
    api_key: executorKey,
    usage_sink: usageSink,
    attempt_sink: attemptSink
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
    executor: {
      kind: "API_OPENAI_COMPATIBLE",
      base_url: executorConfig.base_url,
      model: executorConfig.model,
      temperature: executorConfig.temperature,
      top_p: executorConfig.top_p,
      max_tokens: executorConfig.max_tokens,
      timeout_ms: executorConfig.timeout_ms,
      seed_support: seedSupport,
      key_fingerprint: keyFingerprintValue
    },
    retry_policy: "FROZEN_MAX_3_ATTEMPTS_TRANSPORT_ONLY_IDENTICAL_INPUT",
    local_fallback: "FORBIDDEN"
  },
  accounting: { usage, attempts },
  observation
}, null, 2)}\n`);
process.stdout.write(JSON.stringify({ ...observation, __api_accounting: { usage, attempts, key_fingerprint: keyFingerprintValue, model: executorConfig.model, base_url: executorConfig.base_url, seed_support: seedSupport } }));
process.stderr.write(
  `SCENE ${label} ${observation.result_kind} class=${observation.behavior_class}`
  + ` ctx=${String(observation.recognition.counterpart_context_visible_in_prompt)}`
  + ` cited=${String(observation.outcomes.counterpart_context_cited)}`
  + ` usage=${usage.total_tokens}tok attempts=${attempts.length}\n`
);
