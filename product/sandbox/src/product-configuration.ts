/**
 * CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — product configuration
 * READ view.
 *
 * This module introduces NO configuration authority. It reads the SAME product
 * resolution the CLI has always used (environment variable → built-in default,
 * plus the persisted product subject config for identity) and reports the
 * effective value together with WHERE it came from. Nothing here is persisted,
 * nothing here is canonical SubjectState, and no setting is ever written back.
 *
 * The `/config` presentation is built from an explicit allow-list of known
 * settings, so no arbitrary environment variable (API key, token, credential)
 * can leak into output. There is no process-environment dump anywhere.
 */

/** Where an effective product setting came from. */
export type ProductConfigSourceV0 = "ENVIRONMENT" | "PERSISTED_PRODUCT_CONFIG" | "DEFAULT" | "DERIVED";

export interface ProductConfigValueV0<T> {
  readonly value: T;
  readonly source: ProductConfigSourceV0;
  /** Human-readable origin: the variable name, the file, or the built-in default. */
  readonly origin: string;
}

/** Read-only view over the process/ambient environment (injectable for tests). */
export interface ProductEnvironmentV0 {
  readonly get: (name: string) => string | undefined;
}

/** Empty values are treated as unset, matching the product's historical behavior. */
export function environmentFromRecordV0(
  record: Readonly<Record<string, string | undefined>>
): ProductEnvironmentV0 {
  return {
    get: (name) => {
      const value = record[name];
      return value === undefined || value.length === 0 ? undefined : value;
    }
  };
}

export function processEnvironmentV0(): ProductEnvironmentV0 {
  return environmentFromRecordV0(process.env);
}

/** Product-only configuration error: names the setting, value, source and expected format. */
export class ProductConfigurationErrorV0 extends Error {
  constructor(
    readonly setting: string,
    readonly received: string,
    readonly expected: string,
    readonly source: string
  ) {
    super(`Configuration is invalid: ${setting}=${JSON.stringify(received)} (source: ${source}); expected ${expected}.`);
    this.name = "ProductConfigurationErrorV0";
  }
}

export const BUILT_IN_DEFAULT_ORIGIN = "built-in default";

/** Strips URL userinfo so an endpoint can never print embedded credentials. */
export function redactEndpointV0(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username.length === 0 && url.password.length === 0) return raw;
    url.username = "***";
    url.password = "";
    return url.toString();
  } catch {
    return raw;
  }
}

/** Strict positive integer: digits only, safe range, greater than zero. */
export function parsePositiveIntV0(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function resolveStringSettingV0(
  environment: ProductEnvironmentV0,
  name: string,
  fallback: string
): ProductConfigValueV0<string> {
  const raw = environment.get(name);
  if (raw === undefined) return { value: fallback, source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  return { value: raw, source: "ENVIRONMENT", origin: name };
}

export function resolvePositiveIntSettingV0(
  environment: ProductEnvironmentV0,
  name: string,
  fallback: number,
  unit: string
): ProductConfigValueV0<number> {
  const raw = environment.get(name);
  if (raw === undefined) return { value: fallback, source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  const parsed = parsePositiveIntV0(raw);
  if (parsed === null) {
    throw new ProductConfigurationErrorV0(
      name,
      raw,
      `a positive integer (${unit})`,
      `environment variable ${name}`
    );
  }
  return { value: parsed, source: "ENVIRONMENT", origin: name };
}

/** Present-or-absent flag with the product's existing `1`-means-on semantics. */
export function resolveFlagSettingV0(
  environment: ProductEnvironmentV0,
  name: string
): ProductConfigValueV0<boolean> {
  const raw = environment.get(name);
  if (raw === undefined) return { value: false, source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  return { value: raw === "1", source: "ENVIRONMENT", origin: name };
}

/**
 * Strictly validated product boolean: accepts ONLY `1`/`0` (or unset). Any other
 * value fails closed rather than being silently coerced to false.
 */
export function resolveStrictBooleanSettingV0(
  environment: ProductEnvironmentV0,
  name: string,
  fallback: boolean
): ProductConfigValueV0<boolean> {
  const raw = environment.get(name);
  if (raw === undefined) return { value: fallback, source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  if (raw !== "0" && raw !== "1") {
    throw new ProductConfigurationErrorV0(name, raw, "0 or 1", `environment variable ${name}`);
  }
  return { value: raw === "1", source: "ENVIRONMENT", origin: name };
}

export function resolveEndpointSettingV0(
  environment: ProductEnvironmentV0,
  name: string,
  fallback: string
): ProductConfigValueV0<string> {
  const raw = environment.get(name);
  if (raw === undefined) return { value: fallback, source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ProductConfigurationErrorV0(
      name,
      redactEndpointV0(raw),
      "an http(s) URL such as http://127.0.0.1:11434",
      `environment variable ${name}`
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ProductConfigurationErrorV0(
      name,
      redactEndpointV0(raw),
      "an http(s) URL such as http://127.0.0.1:11434",
      `environment variable ${name}`
    );
  }
  return { value: raw, source: "ENVIRONMENT", origin: name };
}

// --- executor family selection (PRODUCT_EXECUTOR_SELECTION_V0) -----------------

/**
 * The executor FAMILIES this product slice can serve model calls with.
 *
 * `deepseek` — cloud, OpenAI-compatible `/chat/completions`, model `deepseek-flash`
 *              (default), credential from `MODEL_API_KEY` (environment only).
 * `ollama`   — local / offline, native `/api/chat`, model `qwen3.5:9b` (default).
 *
 * No other provider (OpenAI, Gemini, Anthropic, …) is selectable in this slice:
 * the family is a closed set, so an unknown value fails closed instead of
 * silently falling back to a different provider.
 */
export type ProductExecutorFamilyV0 = "deepseek" | "ollama";

/** The REQUESTED value, which may defer the choice: `auto` picks per environment. */
export type ProductExecutorRequestV0 = ProductExecutorFamilyV0 | "auto";

/**
 * The credential is read ONLY from the environment, and ONLY its presence is
 * ever surfaced. The product never accepts a credential as an argument, never
 * writes it anywhere, and never prints it.
 */
export const PRODUCT_CLOUD_CREDENTIAL_ENV_V0 = "MODEL_API_KEY" as const;

export interface ProductExecutorResolutionV0 {
  readonly requested: ProductExecutorRequestV0;
  readonly requested_source: ProductConfigSourceV0;
  readonly requested_origin: string;
  readonly effective: ProductExecutorFamilyV0;
  /** Why the effective family was chosen — never contains a credential value. */
  readonly reason: string;
}

export function resolveExecutorSettingV0(environment: ProductEnvironmentV0): ProductExecutorResolutionV0 {
  const raw = environment.get("CHARACTEROS_EXECUTOR");
  const requestedSource: ProductConfigSourceV0 = raw === undefined ? "DEFAULT" : "ENVIRONMENT";
  const requestedOrigin = raw === undefined ? BUILT_IN_DEFAULT_ORIGIN : "CHARACTEROS_EXECUTOR";
  const requested = (raw === undefined ? "auto" : raw.trim().toLowerCase()) as ProductExecutorRequestV0;
  if (requested !== "deepseek" && requested !== "ollama" && requested !== "auto") {
    throw new ProductConfigurationErrorV0(
      "CHARACTEROS_EXECUTOR",
      raw ?? "",
      "one of deepseek, ollama, auto",
      `environment variable CHARACTEROS_EXECUTOR`
    );
  }
  const credentialPresent = environment.get(PRODUCT_CLOUD_CREDENTIAL_ENV_V0) !== undefined;
  if (requested === "auto") {
    return {
      requested,
      requested_source: requestedSource,
      requested_origin: requestedOrigin,
      effective: credentialPresent ? "deepseek" : "ollama",
      // The reason is also served to the local web product, whose payload gate
      // rejects any `api…key` token outright. It therefore states the DECISION
      // without naming the variable; the exact variable name appears where an
      // operator acts on it: the human /config text and configuration errors.
      reason: credentialPresent
        ? "CHARACTEROS_EXECUTOR is unset and a cloud credential is present → cloud executor"
        : "CHARACTEROS_EXECUTOR is unset and no cloud credential is present → local executor"
    };
  }
  return {
    requested,
    requested_source: requestedSource,
    requested_origin: requestedOrigin,
    effective: requested,
    reason: `explicitly requested with CHARACTEROS_EXECUTOR=${requested}`
  };
}

export interface ProductConfigurationV0 {
  /**
   * PRODUCT_EXECUTOR_SELECTION_V0 — WHICH executor family serves the model calls.
   * `deepseek` is the cloud family (OpenAI-compatible /chat/completions), `ollama`
   * is the local/offline family (native /api/chat). No other provider is wired.
   */
  readonly executor: ProductExecutorResolutionV0;
  /** Effective model for the SELECTED executor family (never the other family's). */
  readonly model: ProductConfigValueV0<string>;
  /** Effective endpoint for the SELECTED executor family. */
  readonly endpoint: ProductConfigValueV0<string>;
  /**
   * Whether a cloud credential is present in the environment. Presence ONLY: the
   * value is never read into this structure, never compared, never printed.
   */
  readonly credential_present: boolean;
  /** Local executor model (`CHARACTEROS_MODEL`) — used by Ollama-only providers. */
  readonly local_model: ProductConfigValueV0<string>;
  /** Local executor endpoint (`OLLAMA_BASE_URL`) — used by Ollama-only providers. */
  readonly local_endpoint: ProductConfigValueV0<string>;
  readonly timeout_ms: ProductConfigValueV0<number>;
  readonly context_window_tokens: ProductConfigValueV0<number>;
  readonly num_predict: ProductConfigValueV0<number>;
  readonly data_root: ProductConfigValueV0<string>;
  readonly debug: ProductConfigValueV0<boolean>;
  readonly disable_adaptation: ProductConfigValueV0<boolean>;
  readonly belief_semantic_model: ProductConfigValueV0<string>;
  readonly interval_ticks: ProductConfigValueV0<number>;
  /**
   * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 rollout switch, strictly 0/1.
   * DEFAULT OFF for the first production slice (opt-in until manually validated
   * with real models). Non-canonical product configuration only.
   */
  readonly appraisal_exact_input_reuse: ProductConfigValueV0<boolean>;
  /**
   * DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 — the cloud family's thinking-mode
   * request setting (`CHARACTEROS_DEEPSEEK_THINKING`). DEFAULT `DISABLED`: the
   * product's cognition/language contract consumes the provider's FINAL
   * `message.content`, and a thinking-first model spends its whole output budget
   * on reasoning and returns empty content, which fails closed. Inert for the
   * local family (the native transport already sends `think: false`).
   */
  readonly deepseek_thinking: ProductConfigValueV0<DeepSeekThinkingSettingV0>;
}

/** Explicit thinking-mode request setting for the cloud (OpenAI-compatible) family. */
export type DeepSeekThinkingSettingV0 = "DISABLED" | "PROVIDER_DEFAULT" | "ENABLED";

/** Narrow, documented environment surface for the setting above. */
export const DEEPSEEK_THINKING_ENV_V0 = "CHARACTEROS_DEEPSEEK_THINKING" as const;

function resolveDeepSeekThinkingV0(
  environment: ProductEnvironmentV0
): ProductConfigValueV0<DeepSeekThinkingSettingV0> {
  const raw = environment.get(DEEPSEEK_THINKING_ENV_V0);
  if (raw === undefined) {
    return { value: "DISABLED", source: "DEFAULT", origin: BUILT_IN_DEFAULT_ORIGIN };
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "disabled") {
    return { value: "DISABLED", source: "ENVIRONMENT", origin: DEEPSEEK_THINKING_ENV_V0 };
  }
  if (normalized === "enabled") {
    return { value: "ENABLED", source: "ENVIRONMENT", origin: DEEPSEEK_THINKING_ENV_V0 };
  }
  if (normalized === "provider-default" || normalized === "provider_default") {
    return { value: "PROVIDER_DEFAULT", source: "ENVIRONMENT", origin: DEEPSEEK_THINKING_ENV_V0 };
  }
  throw new ProductConfigurationErrorV0(
    DEEPSEEK_THINKING_ENV_V0,
    raw,
    "one of disabled, provider-default, enabled",
    `environment variable ${DEEPSEEK_THINKING_ENV_V0}`
  );
}

export interface ResolveProductConfigurationInputV0 {
  readonly environment: ProductEnvironmentV0;
  /** Resolved default data root when CHARACTEROS_DATA_DIR is unset. */
  readonly default_data_root: string;
  /** Human-readable origin for the default data root. */
  readonly default_data_root_origin?: string;
}

/**
 * Resolves the effective product configuration by REUSING the existing
 * resolution order (environment variable → built-in default). Invalid values
 * fail early here instead of being silently coerced.
 *
 * Executor selection changes WHICH model/endpoint pair is effective; it never
 * changes a resolution rule. The local (`CHARACTEROS_MODEL` / `OLLAMA_BASE_URL`)
 * settings stay resolved in BOTH cases, because the Ollama-only adaptation
 * providers keep using them regardless of the selected executor.
 */
export function resolveProductConfigurationV0(
  input: ResolveProductConfigurationInputV0
): ProductConfigurationV0 {
  const environment = input.environment;
  const executor = resolveExecutorSettingV0(environment);
  const credentialPresent = environment.get(PRODUCT_CLOUD_CREDENTIAL_ENV_V0) !== undefined;
  if (executor.effective === "deepseek" && !credentialPresent) {
    // Fail closed with an actionable message. The value is absent by definition,
    // and no credential material is ever echoed.
    throw new ProductConfigurationErrorV0(
      "CHARACTEROS_EXECUTOR",
      "deepseek",
      `${PRODUCT_CLOUD_CREDENTIAL_ENV_V0} to be present in the environment (or CHARACTEROS_EXECUTOR=ollama for the local executor)`,
      "environment variable CHARACTEROS_EXECUTOR"
    );
  }
  const localModel = resolveStringSettingV0(environment, "CHARACTEROS_MODEL", "qwen3.5:9b");
  const localEndpoint = resolveEndpointSettingV0(environment, "OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  const model =
    executor.effective === "deepseek"
      ? resolveStringSettingV0(environment, "MODEL_API_MODEL", "deepseek-flash")
      : localModel;
  const endpoint =
    executor.effective === "deepseek"
      ? resolveEndpointSettingV0(environment, "MODEL_API_BASE_URL", "https://api.deepseek.com")
      : localEndpoint;
  const beliefSemanticModelRaw = environment.get("CHARACTEROS_BELIEF_SEMANTIC_MODEL");
  const beliefSemanticModel: ProductConfigValueV0<string> =
    beliefSemanticModelRaw === undefined
      ? { value: localModel.value, source: "DERIVED", origin: "effective CHARACTEROS_MODEL" }
      : { value: beliefSemanticModelRaw, source: "ENVIRONMENT", origin: "CHARACTEROS_BELIEF_SEMANTIC_MODEL" };
  const dataRootRaw = environment.get("CHARACTEROS_DATA_DIR");
  const dataRoot: ProductConfigValueV0<string> =
    dataRootRaw === undefined
      ? {
          value: input.default_data_root,
          source: "DEFAULT",
          origin: input.default_data_root_origin ?? BUILT_IN_DEFAULT_ORIGIN
        }
      : { value: dataRootRaw, source: "ENVIRONMENT", origin: "CHARACTEROS_DATA_DIR" };
  return {
    executor,
    model,
    endpoint,
    credential_present: credentialPresent,
    local_model: localModel,
    local_endpoint: localEndpoint,
    timeout_ms: resolvePositiveIntSettingV0(environment, "CHARACTEROS_TIMEOUT_MS", 120000, "milliseconds"),
    context_window_tokens: resolvePositiveIntSettingV0(environment, "CHARACTEROS_CONTEXT_WINDOW_TOKENS", 8192, "tokens"),
    num_predict: resolvePositiveIntSettingV0(environment, "CHARACTEROS_NUM_PREDICT", 2048, "tokens"),
    data_root: dataRoot,
    debug: resolveFlagSettingV0(environment, "CHARACTEROS_DEBUG"),
    disable_adaptation: resolveFlagSettingV0(environment, "CHARACTEROS_DISABLE_ADAPTATION"),
    belief_semantic_model: beliefSemanticModel,
    interval_ticks: resolvePositiveIntSettingV0(environment, "CHARACTEROS_INTERVAL_TICKS", 1, "canonical ticks"),
    appraisal_exact_input_reuse: resolveStrictBooleanSettingV0(
      environment,
      "CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE",
      false
    ),
    deepseek_thinking: resolveDeepSeekThinkingV0(environment)
  };
}

// --- subject identity provenance (product metadata only) -----------------------

export interface ProductIdentityProvenanceV0 {
  readonly source: ProductConfigSourceV0;
  readonly origin: string;
}

export interface ProductConfigurationSubjectV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly status: "NEW" | "RESTORED";
  readonly durable_state: "NONE" | "PRESENT" | "UNKNOWN";
  readonly identity: ProductIdentityProvenanceV0;
  readonly data_location: string | null;
  readonly provider_ready: boolean;
}

/** Explains, using repository truth, what lives in the resolved data root. */
export const PRODUCT_DATA_ROOT_CONTENTS_V0: readonly string[] = Object.freeze([
  "subject-config.json (product subject configuration)",
  "subject-<id>.snapshot.json (authoritative durable snapshot)",
  "subject-<id>.shared-subject.json (shared canonical subject source)",
  "subject-<id>.environment-<id>.checkpoint.json (context checkpoint sidecar)",
  "subject-<id>.interactions.jsonl (append-only operational log)"
]);

function millisecondsToSecondsV0(value: number): string {
  return `${value} ms (${value / 1000} s)`;
}

function settingLinesV0(label: string, value: string, source: ProductConfigSourceV0, origin: string): readonly string[] {
  return [`  ${label}: ${value}`, `    source: ${source} (${origin})`];
}

/**
 * Effective configuration, read-only. Built from an explicit allow-list only —
 * it never iterates the environment, so unrelated/secret variables cannot appear.
 */
export function formatConfigurationLinesV0(
  configuration: ProductConfigurationV0,
  subject: ProductConfigurationSubjectV0
): readonly string[] {
  const lines: string[] = [];
  const displayName = subject.display_name.trim().length > 0 ? subject.display_name : "(unset)";
  lines.push("CharacterOS configuration (read-only)");
  lines.push("");
  lines.push("Subject");
  lines.push(`  id: ${subject.subject_id}`);
  lines.push(`  name: ${displayName}`);
  lines.push(`  status: ${subject.status === "RESTORED" ? "RESTORED (continuing the same canonical subject)" : "NEW (no lived history yet)"}`);
  lines.push(
    `  durable state: ${
      subject.durable_state === "PRESENT"
        ? "PRESENT (a completed turn has been persisted)"
        : subject.durable_state === "NONE"
          ? "NONE (nothing persisted yet)"
          : "UNKNOWN"
    }`
  );
  lines.push(`    source: ${subject.identity.source} (${subject.identity.origin})`);
  lines.push("");
  lines.push("Provider");
  lines.push(
    `  executor: ${configuration.executor.effective === "deepseek" ? "deepseek (cloud, OpenAI-compatible /chat/completions)" : "ollama (local, native /api/chat)"}`
  );
  lines.push(`    why: ${configuration.executor.reason}`);
  lines.push(
    `    requested: ${configuration.executor.requested} (source: ${configuration.executor.requested_source} (${configuration.executor.requested_origin}))`
  );
  if (configuration.executor.effective === "deepseek") {
    // Presence only. The credential value is never read into the configuration
    // and therefore cannot appear here.
    lines.push(
      `    credential: ${configuration.credential_present ? `present (${PRODUCT_CLOUD_CREDENTIAL_ENV_V0}, value never printed)` : `MISSING (${PRODUCT_CLOUD_CREDENTIAL_ENV_V0})`}`
    );
    lines.push(
      ...settingLinesV0(
        "thinking",
        configuration.deepseek_thinking.value.toLowerCase().replace("_", "-"),
        configuration.deepseek_thinking.source,
        configuration.deepseek_thinking.origin
      )
    );
  }
  lines.push(...settingLinesV0("model", configuration.model.value, configuration.model.source, configuration.model.origin));
  lines.push(
    ...settingLinesV0(
      "endpoint",
      redactEndpointV0(configuration.endpoint.value),
      configuration.endpoint.source,
      configuration.endpoint.origin
    )
  );
  if (configuration.executor.effective === "deepseek") {
    // The Ollama-only adaptation providers keep the LOCAL pair; saying so avoids
    // presenting one endpoint as if it served every call.
    lines.push(
      ...settingLinesV0(
        "local model (adaptation)",
        configuration.local_model.value,
        configuration.local_model.source,
        configuration.local_model.origin
      )
    );
    lines.push(
      ...settingLinesV0(
        "local endpoint (adaptation)",
        redactEndpointV0(configuration.local_endpoint.value),
        configuration.local_endpoint.source,
        configuration.local_endpoint.origin
      )
    );
  }
  lines.push(
    ...settingLinesV0(
      "timeout",
      millisecondsToSecondsV0(configuration.timeout_ms.value),
      configuration.timeout_ms.source,
      configuration.timeout_ms.origin
    )
  );
  lines.push(
    ...settingLinesV0(
      "context window tokens",
      String(configuration.context_window_tokens.value),
      configuration.context_window_tokens.source,
      configuration.context_window_tokens.origin
    )
  );
  lines.push(
    ...settingLinesV0(
      "max output tokens",
      String(configuration.num_predict.value),
      configuration.num_predict.source,
      configuration.num_predict.origin
    )
  );
  lines.push(`  readiness: ${subject.provider_ready ? "READY (metadata preflight passed at startup)" : "NOT READY"}`);
  lines.push("");
  lines.push("Adaptation");
  lines.push(
    ...settingLinesV0(
      "belief semantic model",
      configuration.belief_semantic_model.value,
      configuration.belief_semantic_model.source,
      configuration.belief_semantic_model.origin
    )
  );
  lines.push(
    ...settingLinesV0(
      "disable adaptation",
      configuration.disable_adaptation.value ? "yes" : "no",
      configuration.disable_adaptation.source,
      configuration.disable_adaptation.origin
    )
  );
  lines.push("");
  lines.push("Storage");
  lines.push(`  data root: ${configuration.data_root.value}`);
  lines.push(`    source: ${configuration.data_root.source} (${configuration.data_root.origin})`);
  lines.push(`  snapshot: ${subject.data_location ?? "(none yet)"}`);
  lines.push("  contains:");
  for (const entry of PRODUCT_DATA_ROOT_CONTENTS_V0) lines.push(`    - ${entry}`);
  lines.push("");
  lines.push("Runtime");
  lines.push(
    ...settingLinesV0(
      "debug",
      configuration.debug.value ? "on" : "off",
      configuration.debug.source,
      configuration.debug.origin
    )
  );
  lines.push(
    ...settingLinesV0(
      "interval ticks",
      String(configuration.interval_ticks.value),
      configuration.interval_ticks.source,
      configuration.interval_ticks.origin
    )
  );
  lines.push("");
  lines.push("Optimizations");
  lines.push(
    ...settingLinesV0(
      "appraisal exact-input reuse",
      configuration.appraisal_exact_input_reuse.value ? "on" : "off",
      configuration.appraisal_exact_input_reuse.source,
      configuration.appraisal_exact_input_reuse.origin
    )
  );
  lines.push("");
  lines.push("/config is read-only and changes nothing. Use /diagnostics for what happened during provider calls.");
  return lines;
}

// --- onboarding presentation (pure formatters) --------------------------------

export interface ProductStartupSummaryInputV0 {
  readonly display_name: string;
  readonly subject_id: string;
  readonly status: "NEW" | "RESTORED";
  readonly created: boolean;
  readonly model: string;
  readonly data_location: string | null;
  readonly provider_ready: boolean;
}

/** Compact startup summary (§34): identity, continuity, model, readiness, data. */
export function formatStartupSummaryV0(input: ProductStartupSummaryInputV0): readonly string[] {
  const name = input.display_name.trim().length > 0 ? input.display_name : input.subject_id;
  const lines: string[] = [];
  if (input.created) lines.push("Subject created.");
  lines.push("CharacterOS");
  lines.push(`  Subject: ${name} (${input.subject_id})`);
  lines.push(
    `  Status: ${input.status === "RESTORED" ? "RESTORED — continuing the same subject" : "NEW — no lived history yet"}`
  );
  lines.push(`  Model: ${input.model}`);
  lines.push(`  Provider: ${input.provider_ready ? "READY" : "NOT READY"}`);
  lines.push(`  Data: ${input.data_location ?? "(in-memory)"}`);
  lines.push("  Type /help for commands, /config for effective configuration.");
  return lines;
}

/** Short, actionable first-run guidance (§17). Never a multi-page wizard. */
export function firstRunGuidanceV0(input: { readonly display_name: string }): readonly string[] {
  const name = input.display_name.trim().length > 0 ? input.display_name : "the subject";
  return [
    "First run:",
    "  1. Provider preflight passed: the local model endpoint is reachable and the configured model is installed.",
    "  2. CharacterOS will persist this subject's life under the data root shown above.",
    `  3. Start typing to talk to ${name}, or use /help for all commands.`,
    "  4. Use /life and /memory to inspect what the subject has lived."
  ];
}

/** Actionable guidance when the local provider endpoint is unreachable (§20). */
export function providerUnavailableGuidanceV0(endpoint: string, detail: string): readonly string[] {
  return [
    "Provider unavailable.",
    `  endpoint: ${redactEndpointV0(endpoint)}`,
    `  detail: ${detail}`,
    "Action:",
    "  Start Ollama locally, then relaunch CharacterOS.",
    "  The product never silently retries or switches to another provider."
  ];
}

/** Actionable guidance when the configured model is not installed (§21). */
export function modelMissingGuidanceV0(model: string, endpoint: string, detail: string): readonly string[] {
  return [
    `Model unavailable: ${model}`,
    `  endpoint: ${redactEndpointV0(endpoint)}`,
    `  detail: ${detail}`,
    "Action:",
    "  Install/pull that model locally with your own Ollama tooling, then relaunch CharacterOS.",
    "  CharacterOS never downloads or installs models for you."
  ];
}

/** Actionable guidance when the durable data root cannot be created or written (§29). */
export function dataDirectoryFailureGuidanceV0(path: string, detail: string): readonly string[] {
  return [
    "Data directory is not usable.",
    `  path: ${path}`,
    `  detail: ${detail}`,
    "Action:",
    "  Make sure the path exists and is writable, or set CHARACTEROS_DATA_DIR to a writable directory."
  ];
}

/** Names the invalid setting, its value class, its source and the expected format (§26). */
export function formatConfigurationErrorLinesV0(error: ProductConfigurationErrorV0): readonly string[] {
  return [
    "Configuration is invalid.",
    `  setting: ${error.setting}`,
    `  received: ${JSON.stringify(error.received)}`,
    `  expected: ${error.expected}`,
    `  source: ${error.source}`,
    "  action: fix the value and relaunch CharacterOS."
  ];
}
