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

export interface ProductConfigurationV0 {
  readonly model: ProductConfigValueV0<string>;
  readonly endpoint: ProductConfigValueV0<string>;
  readonly timeout_ms: ProductConfigValueV0<number>;
  readonly context_window_tokens: ProductConfigValueV0<number>;
  readonly num_predict: ProductConfigValueV0<number>;
  readonly data_root: ProductConfigValueV0<string>;
  readonly debug: ProductConfigValueV0<boolean>;
  readonly disable_adaptation: ProductConfigValueV0<boolean>;
  readonly belief_semantic_model: ProductConfigValueV0<string>;
  readonly interval_ticks: ProductConfigValueV0<number>;
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
 */
export function resolveProductConfigurationV0(
  input: ResolveProductConfigurationInputV0
): ProductConfigurationV0 {
  const environment = input.environment;
  const model = resolveStringSettingV0(environment, "CHARACTEROS_MODEL", "qwen3.5:9b");
  const beliefSemanticModelRaw = environment.get("CHARACTEROS_BELIEF_SEMANTIC_MODEL");
  const beliefSemanticModel: ProductConfigValueV0<string> =
    beliefSemanticModelRaw === undefined
      ? { value: model.value, source: "DERIVED", origin: "effective CHARACTEROS_MODEL" }
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
    model,
    endpoint: resolveEndpointSettingV0(environment, "OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    timeout_ms: resolvePositiveIntSettingV0(environment, "CHARACTEROS_TIMEOUT_MS", 120000, "milliseconds"),
    context_window_tokens: resolvePositiveIntSettingV0(environment, "CHARACTEROS_CONTEXT_WINDOW_TOKENS", 8192, "tokens"),
    num_predict: resolvePositiveIntSettingV0(environment, "CHARACTEROS_NUM_PREDICT", 2048, "tokens"),
    data_root: dataRoot,
    debug: resolveFlagSettingV0(environment, "CHARACTEROS_DEBUG"),
    disable_adaptation: resolveFlagSettingV0(environment, "CHARACTEROS_DISABLE_ADAPTATION"),
    belief_semantic_model: beliefSemanticModel,
    interval_ticks: resolvePositiveIntSettingV0(environment, "CHARACTEROS_INTERVAL_TICKS", 1, "canonical ticks")
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
  lines.push(...settingLinesV0("model", configuration.model.value, configuration.model.source, configuration.model.origin));
  lines.push(
    ...settingLinesV0(
      "endpoint",
      redactEndpointV0(configuration.endpoint.value),
      configuration.endpoint.source,
      configuration.endpoint.origin
    )
  );
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
