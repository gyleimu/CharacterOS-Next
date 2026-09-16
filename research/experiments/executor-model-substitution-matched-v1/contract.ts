/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — frozen protocol + executor configuration.
 *
 * CORE QUESTION: with CharacterOS history, governed familiarity, persistence, retrieval, context
 * availability, scenario, corpus, prompt, cognition contract, evaluation and thresholds ALL held
 * equal, does changing ONLY `COGNITIVE_EXECUTOR_MODEL` (local `qwen3.5:9b` vs API
 * `deepseek-flash`) change the familiarity context-mediation result?
 *
 * ISOLATION TARGET: `SEMANTIC_INFORMATION_EQUAL`, NOT `PROVIDER_ENFORCEMENT_IDENTICAL`. Both
 * executors receive the same model-visible contract (post PORTABILITY_FIX `1f4776a`); they differ
 * in how strongly the provider can ENFORCE it (Ollama grammar vs OpenAI-compatible JSON syntax
 * mode). That difference is recorded, not hidden.
 *
 * Scientific inputs are imported VERBATIM from the frozen V2 experiment, so cells, familiarity
 * values, corpus, scenario, gates, thresholds, structured outcomes and contrasts cannot drift.
 */
import type { ConditionId } from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";

export {
  CONDITIONS,
  CONDITION_IDS,
  SCENARIOS,
  GATES,
  scheduledScenes,
  replicationScenes,
  pilotScenes
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";

export const EXPERIMENT_ID = "EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1";

/** The PORTABILITY FIX this experiment depends on (audited `PORTABILITY_FIX_APPROVED`). */
export const PORTABILITY_FIX = Object.freeze({
  commit: "1f4776a6807ea98f49d25246c186e9a3537bbbee",
  verdict: "PORTABILITY_FIX_APPROVED",
  contract_requirement: "80/80 named requirements model-visible, provider-only = 0"
} as const);

/** The PRE-PORTABILITY local result — preserved, and NOT comparable to this experiment. */
export const PRE_PORTABILITY_LOCAL_RESULT = Object.freeze({
  experiment: "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2",
  commit: "76b510b39c64a7e7c0f0fdc85b38c652b013d8b6",
  verdict: "FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED",
  comparability: "NOT_DIRECTLY_COMPARABLE_TO_MATCHED_V1 (pre-portability prompt)"
} as const);

export type ExecutorId = "LOCAL_QWEN" | "API_DEEPSEEK";
export const EXECUTOR_IDS: readonly ExecutorId[] = Object.freeze(["LOCAL_QWEN", "API_DEEPSEEK"]);

/** Deterministic interleaved execution order: LOCAL then API for each (cell, replicate). */
export const INTERLEAVE_ORDER: readonly ExecutorId[] = Object.freeze(["LOCAL_QWEN", "API_DEEPSEEK"]);

export interface ExecutorConfig {
  readonly id: ExecutorId;
  readonly provider: "OLLAMA_NATIVE" | "DEEPSEEK_OPENAI_COMPATIBLE";
  readonly model: string;
  readonly base_url: string;
  readonly temperature: number;
  readonly top_p: number | null;
  readonly max_tokens: number;
  readonly timeout_ms: number;
  readonly seed_support: string;
  readonly schema_enforcement_mode: string;
}

/** LOCAL executor — unchanged from the frozen Core manifest. */
export const LOCAL_EXECUTOR: ExecutorConfig = Object.freeze({
  id: "LOCAL_QWEN",
  provider: "OLLAMA_NATIVE",
  model: "qwen3.5:9b",
  base_url: "http://127.0.0.1:11434",
  temperature: 0,
  top_p: null,
  max_tokens: 2048,
  timeout_ms: 480000,
  seed_support: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT",
  schema_enforcement_mode: "OLLAMA_NATIVE_FORMAT_GRAMMAR_ENFORCED"
});

/** API executor — canonical model id `deepseek-flash`. The key is NEVER part of this config. */
export const API_EXECUTOR: ExecutorConfig = Object.freeze({
  id: "API_DEEPSEEK",
  provider: "DEEPSEEK_OPENAI_COMPATIBLE",
  model: "deepseek-flash",
  base_url: "https://api.deepseek.com",
  temperature: 0,
  top_p: null,
  max_tokens: 16384,
  timeout_ms: 480000,
  seed_support: "SEED_UNSUPPORTED_BY_PROVIDER",
  schema_enforcement_mode: "OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY"
});

export function executorConfig(id: ExecutorId): ExecutorConfig {
  return id === "LOCAL_QWEN" ? LOCAL_EXECUTOR : API_EXECUTOR;
}

/** Environment contract for the API executor (project convention; no prior shared API config). */
export const API_ENV = Object.freeze({
  base_url: "MODEL_API_BASE_URL",
  api_key: "MODEL_API_KEY",
  model: "MODEL_API_MODEL",
  timeout_ms: "MODEL_API_TIMEOUT_MS",
  temperature: "MODEL_API_TEMPERATURE",
  top_p: "MODEL_API_TOP_P",
  max_tokens: "MODEL_API_MAX_TOKENS",
  seed: "MODEL_API_SEED"
} as const);

/**
 * FROZEN RETRY POLICY (identical for both executors; frozen BEFORE the first scientific call).
 * Transport/provider failures only — never a content-level retry, and every retry re-sends the
 * byte-identical request.
 */
export const RETRY_POLICY = Object.freeze({
  max_attempts: 3,
  retry_on_http: Object.freeze([408, 409, 425, 429, 500, 502, 503, 504]),
  retry_on_transport: Object.freeze(["MODEL_TIMEOUT", "MODEL_CONNECTION_FAILURE"]),
  never_retry_on: Object.freeze([
    "MODEL_EMPTY_RESPONSE",
    "MODEL_OUTPUT_TRUNCATED",
    "INVALID_RESPONSE_SHAPE",
    "SCHEMA_REJECTED",
    "FACTUAL_AUTHORITY_REJECTED",
    "SOURCE_BINDING_REJECTED"
  ]),
  backoff_ms: Object.freeze([1000, 3000]),
  identical_input_required: true,
  local_fallback: "FORBIDDEN"
} as const);

/** Pilot: 4 cells × 6 replicates = 24 scenes per executor (>= 20 required, >= 0.95 host-valid). */
export const PILOT_REPLICATES = 6;
export const PILOT_REQUIRED_VALID = 20;
export const PRIMARY_REPLICATES = 10;
export const REPLICATION_REPLICATES = 10;
export const REPLICATION_FIRST_INDEX = PRIMARY_REPLICATES + 1;

export function pilotSchedule(): readonly { readonly condition: ConditionId; readonly replicate: number }[] {
  const out: { condition: ConditionId; replicate: number }[] = [];
  for (const condition of ["A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "D_LOW_CONTEXT_EQUALIZED"] as ConditionId[]) {
    for (let replicate = 1; replicate <= PILOT_REPLICATES; replicate += 1) out.push({ condition, replicate });
  }
  return out;
}

export function primarySchedule(): readonly { readonly condition: ConditionId; readonly replicate: number }[] {
  const out: { condition: ConditionId; replicate: number }[] = [];
  for (const condition of ["A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "D_LOW_CONTEXT_EQUALIZED"] as ConditionId[]) {
    for (let replicate = 1; replicate <= PRIMARY_REPLICATES; replicate += 1) out.push({ condition, replicate });
  }
  return out;
}

export function replicationSchedule(): readonly { readonly condition: ConditionId; readonly replicate: number }[] {
  const out: { condition: ConditionId; replicate: number }[] = [];
  for (const condition of ["A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "D_LOW_CONTEXT_EQUALIZED"] as ConditionId[]) {
    for (let replicate = REPLICATION_FIRST_INDEX; replicate < REPLICATION_FIRST_INDEX + REPLICATION_REPLICATES; replicate += 1) {
      out.push({ condition, replicate });
    }
  }
  return out;
}

/** Trial identity: executor + phase + cell + index, collision-free by construction. */
export function trialId(executor: ExecutorId, phase: string, condition: string, replicate: number): string {
  return `${executor}|${phase}|${condition}|${replicate}`;
}

export type MatchedConditionId = ConditionId;
