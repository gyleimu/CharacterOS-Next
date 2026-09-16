/**
 * EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0 — API executor configuration + frozen protocol.
 *
 * Reuses the V2 scientific setup VERBATIM by import:
 *   `../relationship-familiarity-context-mediation-final-replication-v2/contract.ts`
 * supplies the cells, credit counts, familiarity expectations, corpus, scenario, gates,
 * replicate counts, budgets and the frozen structured-outcome list. NOTHING scientific is
 * redefined here — the ONLY variable this experiment changes is the executor model.
 *
 * SECURITY: the API key is read from the environment at run time and is NEVER written to any
 * file, manifest, log or artifact. Only a non-reversible fingerprint is recorded.
 */
import type { ConditionId } from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";

export { CONDITIONS, CONDITION_IDS, SCENARIOS, GATES, REPLICATES, scheduledScenes, replicationScenes, pilotScenes } from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";

export const EXPERIMENT_ID = "EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0";

/** The LOCAL baseline this substitution is compared against (frozen, never overwritten). */
export const LOCAL_BASELINE = Object.freeze({
  provider: "OLLAMA_NATIVE",
  model: "qwen3.5:9b",
  digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  endpoint: "http://127.0.0.1:11434",
  result: "FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED",
  evidence: "research/experiments/relationship-familiarity-context-mediation-final-replication-v2/evidence"
} as const);

/** Environment-variable contract (project convention: no prior shared API config exists). */
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

/** Scientific defaults. temperature = 0 (the only scientific temperature). */
export const API_DEFAULTS = Object.freeze({
  timeout_ms: 480000,
  temperature: 0,
  top_p: null,
  max_tokens: 2048,
  seed: null
} as const);

/** DeepSeek's OpenAI-compatible API does not expose a deterministic seed parameter. */
export const SEED_POLICY_LITERAL = "SEED_UNSUPPORTED_BY_PROVIDER" as const;

/**
 * FROZEN TRANSPORT RETRY POLICY (frozen BEFORE the first scientific call).
 * Only transport/provider failures retry; a content-level failure NEVER retries, and every
 * retry re-sends the byte-identical body.
 */
export const RETRY_POLICY = Object.freeze({
  max_attempts: 3,
  retry_on_http: Object.freeze([408, 409, 425, 429, 500, 502, 503, 504]),
  retry_on_transport: Object.freeze(["MODEL_TIMEOUT", "MODEL_CONNECTION_FAILURE"]),
  never_retry_on: Object.freeze(["MODEL_EMPTY_RESPONSE", "MODEL_OUTPUT_TRUNCATED", "INVALID_RESPONSE_SHAPE", "SCHEMA_REJECTED"]),
  backoff_ms: Object.freeze([1000, 3000]),
  identical_input_required: true,
  local_fallback: "FORBIDDEN"
} as const);

/** Hard guard: the substitution MUST NOT silently fall back to the local executor. */
export function assertNotLocalFallback(baseUrl: string): void {
  const normalized = baseUrl.trim().toLowerCase();
  if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(normalized)) {
    throw new Error(
      `EXECUTOR_MODEL_SUBSTITUTION: base_url ${baseUrl} resolves to a LOCAL endpoint; a local executor would contaminate the substituted variable (fail closed)`
    );
  }
  if (normalized.includes(":11434")) {
    throw new Error(
      "EXECUTOR_MODEL_SUBSTITUTION: base_url targets the OLLAMA port 11434; local fallback is FORBIDDEN (fail closed)"
    );
  }
}

export interface ApiExecutorConfig {
  readonly base_url: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly temperature: number;
  readonly top_p: number | null;
  readonly max_tokens: number;
  readonly seed: number | null;
  /** Non-reversible attribution only. The key itself is never stored or logged. */
  readonly key_fingerprint: string;
}

export function loadApiExecutorConfig(env: Record<string, string | undefined>): {
  readonly ok: true;
  readonly config: ApiExecutorConfig;
  readonly api_key: string;
  readonly seed_support: typeof SEED_POLICY_LITERAL | "SEED_CONFIGURED";
} | {
  readonly ok: false;
  readonly missing: readonly string[];
  readonly detail: string;
} {
  const baseUrl = env[API_ENV.base_url];
  const apiKey = env[API_ENV.api_key];
  const model = env[API_ENV.model];
  const missing = [
    ...(baseUrl === undefined || baseUrl.trim() === "" ? [API_ENV.base_url] : []),
    ...(apiKey === undefined || apiKey.trim() === "" ? [API_ENV.api_key] : []),
    ...(model === undefined || model.trim() === "" ? [API_ENV.model] : [])
  ];
  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      detail: `API executor not configured: set ${missing.join(", ")} in the environment (never in a file)`
    };
  }
  assertNotLocalFallback(baseUrl as string);
  const seedRaw = env[API_ENV.seed];
  const seed = seedRaw === undefined || seedRaw.trim() === "" ? null : Number(seedRaw);
  return {
    ok: true,
    api_key: apiKey as string,
    seed_support: seed === null ? SEED_POLICY_LITERAL : "SEED_CONFIGURED",
    config: {
      base_url: (baseUrl as string).replace(/\/$/, ""),
      model: (model as string).trim(),
      timeout_ms: Number(env[API_ENV.timeout_ms] ?? API_DEFAULTS.timeout_ms),
      temperature: Number(env[API_ENV.temperature] ?? API_DEFAULTS.temperature),
      top_p: env[API_ENV.top_p] === undefined ? API_DEFAULTS.top_p : Number(env[API_ENV.top_p]),
      max_tokens: Number(env[API_ENV.max_tokens] ?? API_DEFAULTS.max_tokens),
      seed,
      key_fingerprint: ""
    }
  };
}

export type SubstitutionConditionId = ConditionId;
