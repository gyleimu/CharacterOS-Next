/**
 * CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — deterministic tests.
 *
 * 0 real provider calls. Covers effective-configuration visibility, source
 * labels, first-run/restored presentation, actionable provider/model/data
 * guidance, invalid configuration fail-closed, secret-firewall safety by
 * construction, and that /config mutates nothing.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import {
  ProductConfigurationErrorV0,
  dataDirectoryFailureGuidanceV0,
  environmentFromRecordV0,
  firstRunGuidanceV0,
  formatConfigurationErrorLinesV0,
  formatConfigurationLinesV0,
  formatStartupSummaryV0,
  modelMissingGuidanceV0,
  parsePositiveIntV0,
  providerUnavailableGuidanceV0,
  redactEndpointV0,
  resolveProductConfigurationV0,
  type ProductConfigurationV0,
  type ProductConfigurationSubjectV0
} from "./product-configuration.js";

const SUBJECT_ID = "config-subject";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-config-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

// --- fake transports (0 real calls), counting every model call ----------------

interface CallCounter {
  count: number;
}

function appraisalTransport(counter: CallCounter): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      counter.count += 1;
      return {
        content: JSON.stringify({
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4,
          assessment_confidence: 0.6
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function cognitionTransport(counter: CallCounter): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      counter.count += 1;
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(counter: CallCounter): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      counter.count += 1;
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "Noted.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

interface SessionFixture {
  readonly host: InteractiveSubjectHostV0;
  readonly session: ProductCliSessionV0;
  readonly lines: string[];
  readonly counter: CallCounter;
}

function hostConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return { subject_id: SUBJECT_ID, display_name: "Config", session_id: "sess-config", storage_root: dir, interval_ticks: 1 };
}

async function buildSession(
  dir: string,
  configuration: ProductConfigurationV0,
  durableState: "NONE" | "PRESENT" | "UNKNOWN" = "NONE"
): Promise<SessionFixture> {
  const counter: CallCounter = { count: 0 };
  const sharedSourceStore = new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID);
  const deps = {
    conversationCognitionTransport: cognitionTransport(counter),
    languageTransport: languageTransport(counter),
    appraisalProvider: createProductAppraisalProviderV0({ transport: appraisalTransport(counter) }).provider,
    sharedSourceStore,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
  const host = await InteractiveSubjectHostV0.open(hostConfig(dir), deps);
  const lines: string[] = [];
  const session = new ProductCliSessionV0({
    host,
    configuration,
    subjectIdentity: { source: "PERSISTED_PRODUCT_CONFIG", origin: "subject-config.json" },
    subjectDurableState: durableState,
    providerReady: true,
    subjectLabel: "Config",
    model: configuration.model.value,
    providerLabel: "OLLAMA_NATIVE",
    contextWindowTokens: configuration.context_window_tokens.value,
    maxOutputTokens: configuration.num_predict.value,
    debug: false,
    write: (line) => lines.push(line)
  });
  return { host, session, lines, counter };
}

function resolveConfig(
  dir: string,
  record: Readonly<Record<string, string | undefined>> = {}
): ProductConfigurationV0 {
  return resolveProductConfigurationV0({
    environment: environmentFromRecordV0(record),
    default_data_root: dir,
    default_data_root_origin: "built-in default (product/sandbox/.data)"
  });
}

function output(lines: readonly string[]): string {
  return lines.join("\n");
}

describe("CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — resolution", () => {
  it("C1+C2: unset settings resolve to documented defaults labeled DEFAULT", () => {
    const config = resolveConfig("D:\\data");
    expect(config.model.value).toBe("qwen3.5:9b");
    expect(config.model.source).toBe("DEFAULT");
    expect(config.endpoint.value).toBe("http://127.0.0.1:11434");
    expect(config.endpoint.source).toBe("DEFAULT");
    expect(config.timeout_ms.value).toBe(120000);
    expect(config.context_window_tokens.value).toBe(8192);
    expect(config.num_predict.value).toBe(2048);
    expect(config.data_root.value).toBe("D:\\data");
    expect(config.debug.value).toBe(false);
    expect(config.disable_adaptation.value).toBe(false);
    expect(config.interval_ticks.value).toBe(1);
    // Derived setting names its actual origin rather than pretending to be default.
    expect(config.belief_semantic_model.value).toBe("qwen3.5:9b");
    expect(config.belief_semantic_model.source).toBe("DERIVED");
  });

  it("C2: environment variables override and are labeled with the variable name", () => {
    const config = resolveConfig("D:\\data", {
      CHARACTEROS_MODEL: "llama3:8b",
      OLLAMA_BASE_URL: "http://127.0.0.1:9999",
      CHARACTEROS_TIMEOUT_MS: "60000",
      CHARACTEROS_CONTEXT_WINDOW_TOKENS: "4096",
      CHARACTEROS_NUM_PREDICT: "512",
      CHARACTEROS_DATA_DIR: "D:\\other",
      CHARACTEROS_DEBUG: "1",
      CHARACTEROS_DISABLE_ADAPTATION: "1",
      CHARACTEROS_BELIEF_SEMANTIC_MODEL: "belief-model:1b",
      CHARACTEROS_INTERVAL_TICKS: "5"
    });
    expect(config.model).toEqual({ value: "llama3:8b", source: "ENVIRONMENT", origin: "CHARACTEROS_MODEL" });
    expect(config.endpoint.source).toBe("ENVIRONMENT");
    expect(config.timeout_ms).toEqual({ value: 60000, source: "ENVIRONMENT", origin: "CHARACTEROS_TIMEOUT_MS" });
    expect(config.context_window_tokens.value).toBe(4096);
    expect(config.num_predict.value).toBe(512);
    expect(config.data_root).toEqual({ value: "D:\\other", source: "ENVIRONMENT", origin: "CHARACTEROS_DATA_DIR" });
    expect(config.debug.value).toBe(true);
    expect(config.disable_adaptation.value).toBe(true);
    expect(config.belief_semantic_model.value).toBe("belief-model:1b");
    expect(config.belief_semantic_model.source).toBe("ENVIRONMENT");
    expect(config.interval_ticks.value).toBe(5);
  });

  it("C1: malformed numeric settings fail early instead of being silently coerced", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["CHARACTEROS_TIMEOUT_MS", "abc"],
      ["CHARACTEROS_TIMEOUT_MS", "0"],
      ["CHARACTEROS_TIMEOUT_MS", "-5"],
      ["CHARACTEROS_TIMEOUT_MS", "1.5"],
      ["CHARACTEROS_TIMEOUT_MS", "12abc"],
      ["CHARACTEROS_TIMEOUT_MS", "99999999999999999999"],
      ["CHARACTEROS_NUM_PREDICT", "0"],
      ["CHARACTEROS_CONTEXT_WINDOW_TOKENS", "NaN"],
      ["CHARACTEROS_INTERVAL_TICKS", "1e3"]
    ];
    for (const [name, value] of cases) {
      let thrown: unknown = null;
      try {
        resolveConfig("D:\\data", { [name]: value });
      } catch (error) {
        thrown = error;
      }
      expect(thrown, `${name}=${value} must fail closed`).toBeInstanceOf(ProductConfigurationErrorV0);
      const error = thrown as ProductConfigurationErrorV0;
      expect(error.setting).toBe(name);
      expect(error.received).toBe(value);
      expect(error.source).toContain(name);
      const lines = output(formatConfigurationErrorLinesV0(error));
      expect(lines).toContain("Configuration is invalid.");
      expect(lines).toContain(`setting: ${name}`);
      expect(lines).toContain(JSON.stringify(value));
      expect(lines).toContain("expected:");
      expect(lines).toContain("source:");
    }
  });

  it("C1: a malformed endpoint is reported clearly without URL normalization", () => {
    for (const value of ["localhost:11434", "not a url", "ftp://127.0.0.1"]) {
      expect(() => resolveConfig("D:\\data", { OLLAMA_BASE_URL: value })).toThrow(ProductConfigurationErrorV0);
    }
    const config = resolveConfig("D:\\data", { OLLAMA_BASE_URL: "http://127.0.0.1:11434/" });
    expect(config.endpoint.value).toBe("http://127.0.0.1:11434/");
  });

  it("parsePositiveIntV0 rejects zero, fractions, garbage and overflow", () => {
    expect(parsePositiveIntV0("1")).toBe(1);
    expect(parsePositiveIntV0(" 42 ")).toBe(42);
    expect(parsePositiveIntV0("0")).toBeNull();
    expect(parsePositiveIntV0("-1")).toBeNull();
    expect(parsePositiveIntV0("1.5")).toBeNull();
    expect(parsePositiveIntV0("abc")).toBeNull();
    expect(parsePositiveIntV0("99999999999999999999")).toBeNull();
  });
});

describe("CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — views and guidance", () => {
  function subjectView(overrides: Partial<ProductConfigurationSubjectV0> = {}): ProductConfigurationSubjectV0 {
    return {
      subject_id: "mira-14aa8fc5",
      display_name: "Mira",
      status: "RESTORED",
      durable_state: "PRESENT",
      identity: { source: "PERSISTED_PRODUCT_CONFIG", origin: "subject-config.json" },
      data_location: "D:\\data\\subject-mira-14aa8fc5.snapshot.json",
      provider_ready: true,
      ...overrides
    };
  }

  it("C1+C2+C6: the configuration view shows values, sources and the data root", () => {
    const lines = output(formatConfigurationLinesV0(resolveConfig("D:\\data"), subjectView()));
    expect(lines).toContain("CharacterOS configuration (read-only)");
    expect(lines).toContain("id: mira-14aa8fc5");
    expect(lines).toContain("name: Mira");
    expect(lines).toContain("model: qwen3.5:9b");
    expect(lines).toContain("source: DEFAULT (built-in default)");
    expect(lines).toContain("endpoint: http://127.0.0.1:11434");
    expect(lines).toContain("timeout: 120000 ms (120 s)");
    expect(lines).toContain("readiness: READY (metadata preflight passed at startup)");
    expect(lines).toContain("data root: D:\\data");
    expect(lines).toContain("source: PERSISTED_PRODUCT_CONFIG (subject-config.json)");
    expect(lines).toContain("subject-config.json (product subject configuration)");
    expect(lines).toContain("subject-<id>.snapshot.json (authoritative durable snapshot)");
    expect(lines).toContain("subject-<id>.interactions.jsonl (append-only operational log)");
  });

  it("C2: configured values name their environment variable as the source", () => {
    const lines = output(
      formatConfigurationLinesV0(
        resolveConfig("D:\\data", { CHARACTEROS_TIMEOUT_MS: "60000", CHARACTEROS_DATA_DIR: "D:\\other" }),
        subjectView()
      )
    );
    expect(lines).toContain("source: ENVIRONMENT (CHARACTEROS_TIMEOUT_MS)");
    expect(lines).toContain("source: ENVIRONMENT (CHARACTEROS_DATA_DIR)");
    expect(lines).toContain("data root: D:\\other");
  });

  it("security: unrelated/secret environment entries never reach the view", () => {
    const secretRecord = {
      OPENAI_API_KEY: "sk-do-not-print",
      CHARACTEROS_API_KEY: "characteros-secret",
      CHARACTEROS_TOKEN: "token-secret",
      AWS_SECRET_ACCESS_KEY: "aws-secret"
    };
    const lines = output(formatConfigurationLinesV0(resolveConfig("D:\\data", secretRecord), subjectView()));
    for (const secret of Object.values(secretRecord)) expect(lines).not.toContain(secret);
    for (const name of Object.keys(secretRecord)) expect(lines).not.toContain(name);
  });

  it("security: endpoint credentials are redacted", () => {
    const withCredentials = "http://user:s3cr3t-pw@127.0.0.1:11434";
    expect(redactEndpointV0(withCredentials)).not.toContain("s3cr3t-pw");
    expect(redactEndpointV0(withCredentials)).not.toContain("user:");
    expect(redactEndpointV0("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
    const lines = output(
      formatConfigurationLinesV0(resolveConfig("D:\\data", { OLLAMA_BASE_URL: withCredentials }), subjectView())
    );
    expect(lines).not.toContain("s3cr3t-pw");
    expect(lines).toContain("***@127.0.0.1:11434");
  });

  it("C3: first-run guidance is short, actionable and names the data root concept", () => {
    const lines = output(firstRunGuidanceV0({ display_name: "Mira" }));
    expect(lines).toContain("First run:");
    expect(lines).toContain("talk to Mira");
    expect(lines).toContain("/life and /memory");
    expect(lines.split("\n").length).toBeLessThanOrEqual(6);
  });

  it("C3+C4: the startup summary distinguishes NEW from RESTORED", () => {
    const base = { display_name: "Mira", subject_id: "mira-14aa8fc5", model: "qwen3.5:9b", data_location: "D:\\data\\x.snapshot.json", provider_ready: true };
    const fresh = output(formatStartupSummaryV0({ ...base, status: "NEW", created: true }));
    expect(fresh).toContain("Subject created.");
    expect(fresh).toContain("CharacterOS");
    expect(fresh).toContain("Subject: Mira (mira-14aa8fc5)");
    expect(fresh).toContain("Status: NEW — no lived history yet");
    expect(fresh).toContain("Model: qwen3.5:9b");
    expect(fresh).toContain("Provider: READY");
    expect(fresh).toContain("Data: D:\\data\\x.snapshot.json");
    const restored = output(formatStartupSummaryV0({ ...base, status: "RESTORED", created: false }));
    expect(restored).not.toContain("Subject created.");
    expect(restored).toContain("Status: RESTORED — continuing the same subject");
  });

  it("C5: provider-unavailable guidance tells the user exactly what to check", () => {
    const lines = output(providerUnavailableGuidanceV0("http://127.0.0.1:11434", "fetch failed"));
    expect(lines).toContain("Provider unavailable.");
    expect(lines).toContain("endpoint: http://127.0.0.1:11434");
    expect(lines).toContain("Start Ollama locally, then relaunch CharacterOS.");
    expect(lines).toContain("never silently retries");
  });

  it("C5: model-missing guidance is actionable and never downloads", () => {
    const lines = output(modelMissingGuidanceV0("qwen3.5:9b", "http://127.0.0.1:11434", "model qwen3.5:9b is not available"));
    expect(lines).toContain("Model unavailable: qwen3.5:9b");
    expect(lines).toContain("Install/pull that model locally with your own Ollama tooling");
    expect(lines).toContain("never downloads or installs models");
  });

  it("data-directory failure guidance is actionable", () => {
    const lines = output(dataDirectoryFailureGuidanceV0("D:\\nope", "EACCES: permission denied"));
    expect(lines).toContain("Data directory is not usable.");
    expect(lines).toContain("path: D:\\nope");
    expect(lines).toContain("CHARACTEROS_DATA_DIR");
  });
});

describe("CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0 — product commands", () => {
  it("C1+C2+C6: /config prints effective configuration, sources and data root", async () => {
    const dir = makeTempDir();
    const product = await buildSession(dir, resolveConfig(dir, { CHARACTEROS_TIMEOUT_MS: "60000" }));
    await product.session.handleLine("/config");
    const text = output(product.lines);
    expect(text).toContain("CharacterOS configuration (read-only)");
    expect(text).toContain(`data root: ${dir}`);
    expect(text).toContain("timeout: 60000 ms (60 s)");
    expect(text).toContain("source: ENVIRONMENT (CHARACTEROS_TIMEOUT_MS)");
    expect(text).toContain("model: qwen3.5:9b");
    expect(text).toContain("id: config-subject");
    expect(text).toContain("name: Config");
    expect(text).toContain("Use /diagnostics for what happened during provider calls.");
  });

  it("C7+C8: /config is read-only — no revision change, no provider call", async () => {
    const dir = makeTempDir();
    const product = await buildSession(dir, resolveConfig(dir));
    const before = await product.host.status();
    const callsBefore = product.counter.count;
    await product.session.handleLine("/config");
    await product.session.handleLine("/config");
    const after = await product.host.status();
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(product.counter.count).toBe(callsBefore);
    expect(output(product.lines)).toContain("read-only");
  });

  it("C4: an existing subject reopens as a continuation, not a new setup", async () => {
    const dir = makeTempDir();
    const first = await buildSession(dir, resolveConfig(dir));
    await first.session.handleLine("Hello, remember this.");
    expect(first.counter.count).toBeGreaterThan(0);
    expect(first.host.resolution()).toBe("NEW_SUBJECT_CREATED");

    const second = await buildSession(dir, resolveConfig(dir), "PRESENT");
    const status = await second.host.status();
    expect(second.host.resolution()).toBe("SUBJECT_RESTORED");
    expect(status.completed_turns).toBeGreaterThan(0);
    await second.session.handleLine("/config");
    const text = output(second.lines);
    expect(text).toContain("status: RESTORED (continuing the same canonical subject)");
    expect(text).toContain("durable state: PRESENT (a completed turn has been persisted)");
    expect(text).not.toContain("First run:");
  });

  it("/help lists /config and /diagnostics", async () => {
    const dir = makeTempDir();
    const product = await buildSession(dir, resolveConfig(dir));
    await product.session.handleLine("/help");
    const text = output(product.lines);
    expect(text).toContain("/config");
    expect(text).toContain("/diagnostics");
  });
});
