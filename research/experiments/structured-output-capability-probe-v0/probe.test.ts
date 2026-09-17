/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative path. */
/**
 * STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0 — Phase A tests.
 *
 * ZERO model calls, ZERO network calls. These tests pin the capability audit, the
 * probe's wire shapes, the no-repair/no-retry discipline and the artifact
 * isolation BEFORE any capability call is made.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { buildCalibrationRequest, serializeAuthoritativeRequest } from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { modelConfigManifest } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";

import {
  CURRENT_RESPONSE_FORMAT,
  MAX_LENGTH_SEMANTICS,
  MAX_PROBE_CALLS,
  MINIMAL_NESTED_TEST_SCHEMA,
  PROBE_MARKERS,
  PROBE_NAMESPACE,
  PRIOR_CAPABILITY_EVIDENCE,
  strictJsonSchemaRequestFormat
} from "./contract.ts";
import { auditCodePaths, buildCapabilityMatrix, probePayloadPreview } from "./payload-audit.ts";
import { createProbeTransport, runCapabilityProbe, type ProbeTransport } from "./probe.ts";
import { probeRun } from "./cli.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const PROBE_DIR = "research/experiments/structured-output-capability-probe-v0";
const TEST_KEY = "sk-capability-probe-test-key-000000";

/* --- current payload snapshot -------------------------------------------------------- */

describe("CAPABILITY PROBE — the CURRENT payload is syntax-only", () => {
  it("TEST_CURRENT_PAYLOAD_SNAPSHOT", async () => {
    const request = await buildCalibrationRequest({ schemaHash: "", modelConfigHash: "" });
    const body = JSON.parse(serializeAuthoritativeRequest(request.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "response_format", "stream", "temperature"]);
    expect(body["response_format"]).toEqual({ type: "json_object" });
    expect(JSON.stringify(body)).not.toContain("additionalProperties");
    expect(JSON.stringify(body)).not.toContain("json_schema");
  });

  it("TEST_CAPABILITY_MATRIX", async () => {
    const matrix = await buildCapabilityMatrix();
    expect(matrix.CURRENT_MODE).toBe("json_object + full schema rendered into the prompt");
    expect(matrix.SCHEMA_SENT_TO_PROVIDER).toBe(false);
    expect(matrix.PROMPT_ONLY_SCHEMA).toBe(true);
    expect(matrix.JSON_OBJECT_ONLY).toBe(true);
    expect(matrix.JSON_SCHEMA_MODE_IMPLEMENTED).toBe(false);
    expect(matrix.JSON_SCHEMA_MODE_SUPPORTED_BY_ADAPTER).toBe(false);
    expect(matrix.STRICT_FLAG_SUPPORTED).toBe(false);
    expect(matrix.UNKNOWN_FIELDS_DROPPED).toBe(true);
    expect(matrix.GRAMMAR_SUPPORTED).toBe(true);
    expect(matrix.GRAMMAR_SUPPORTED_SCOPE).toContain("LOCAL_OLLAMA_TRANSPORT_ONLY");
    expect(matrix.PROVIDER_CAPABILITY_UNKNOWN).toBe(false);
    expect((matrix.CURRENT_PROVIDER_PAYLOAD["carries_schema"] as boolean)).toBe(false);
    expect((matrix.CURRENT_PROVIDER_PAYLOAD["response_format"] as Record<string, unknown>)["type"]).toBe("json_object");
  });

  it("TEST_CODE_PATHS_ARE_READ_FROM_SOURCE", () => {
    const facts = auditCodePaths();
    const ids = facts.map((fact) => fact.id);
    expect(ids).toContain("FORMAL_CALIBRATION_REQUEST");
    expect(ids).toContain("PRODUCTION_OPENAI_COMPATIBLE_TRANSPORT");
    expect(ids).toContain("LOCAL_OLLAMA_TRANSPORT");
    const openAi = facts.find((fact) => fact.id === "PRODUCTION_OPENAI_COMPATIBLE_TRANSPORT");
    expect(openAi?.finding).toContain("DROPS");
    const ollama = facts.find((fact) => fact.id === "LOCAL_OLLAMA_TRANSPORT");
    expect(ollama?.finding).toContain("grammar-enforced");
    // the prior slice's capability note is recorded, not silently trusted
    expect(PRIOR_CAPABILITY_EVIDENCE.recorded_finding).toContain("unavailable now");
    expect(PRIOR_CAPABILITY_EVIDENCE.status).toContain("RE_VERIFIABLE");
  });
});

/* --- wire shapes ----------------------------------------------------------------------- */

describe("CAPABILITY PROBE — the probe wire shapes", () => {
  it("TEST_MINIMAL_SCHEMA_SERIALIZATION", () => {
    const format = strictJsonSchemaRequestFormat(MINIMAL_NESTED_TEST_SCHEMA);
    expect(format["type"]).toBe("json_schema");
    const jsonSchema = format["json_schema"] as Record<string, unknown>;
    expect(jsonSchema["name"]).toBe("characteros_probe_schema");
    expect(jsonSchema["strict"]).toBe(true);
    expect(jsonSchema["schema"]).toEqual(MINIMAL_NESTED_TEST_SCHEMA);
    // the minimal schema really does demand a nested object with an enum
    const directive = MINIMAL_NESTED_TEST_SCHEMA.properties["communication_directive"] as unknown as Record<string, unknown>;
    expect(directive["type"]).toBe("object");
    expect(directive["required"]).toEqual(["kind"]);
    expect(CURRENT_RESPONSE_FORMAT).toEqual({ type: "json_object" });
  });

  it("TEST_FULL_SCHEMA_SERIALIZATION", () => {
    const format = strictJsonSchemaRequestFormat(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as Readonly<Record<string, unknown>>);
    const serialized = JSON.stringify(format);
    expect(serialized).toContain("conversation-cognition-proposal-v8");
    expect(serialized).toContain("additionalProperties");
    // the canonical schema is carried unmodified: no simplification, no relaxation
    expect(format["json_schema"]).toMatchObject({ schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA });
    const preview = probePayloadPreview();
    expect((preview["model_config"] as Record<string, unknown>)["model"]).toBe("deepseek-flash");
    expect(JSON.stringify(preview)).not.toContain(TEST_KEY);
  });

  it("TEST_MAX_LENGTH_SEMANTICS_ARE_NOT_ASSUMED", () => {
    expect(MAX_LENGTH_SEMANTICS.characteros_production).toBe("UNICODE_CODE_POINTS");
    expect(MAX_LENGTH_SEMANTICS.provider_side_implementation).toBe("UNVERIFIED_BY_THIS_PROBE");
    expect(MAX_LENGTH_SEMANTICS.equivalence_assumed).toBe(false);
  });
});

/* --- bounded, no-retry, no-repair ------------------------------------------------------ */

describe("CAPABILITY PROBE — bounded, no retry, no repair", () => {
  const rejectionTransport = (): { readonly transport: ProbeTransport; calls(): number; bodies(): string[] } => {
    const bodies: string[] = [];
    let calls = 0;
    return {
      transport: {
        async complete(body: string) {
          bodies.push(body);
          calls += 1;
          return {
            ok: false,
            http_status: 400,
            raw_envelope: JSON.stringify({ error: { message: "This response_format type is unavailable now", type: "invalid_request_error" } }),
            content: null,
            model: null,
            error_code: "invalid_request_error",
            error_message: "This response_format type is unavailable now",
            usage: null
          };
        }
      },
      calls: () => calls,
      bodies: () => bodies
    };
  };

  it("TEST_FEATURE_REJECTION_ENDS_THE_PROBE_WITH_ONE_CALL", async () => {
    const mock = rejectionTransport();
    const result = await runCapabilityProbe({ transport: mock.transport });
    expect(result.summary.model_calls).toBe(1);
    expect(mock.calls()).toBe(1);
    expect(result.summary.minimal_schema_accepted).toBe(false);
    expect(result.summary.nested_object_enforced).toBeNull();
    expect(result.summary.full_v8_schema_accepted).toBeNull();
    expect(result.summary.stop_reason).toContain("REJECTED");
    expect(result.summary.conclusion).toContain("CURRENT_JSON_OBJECT_MODE_IS_ONLY_SYNTAX_ENFORCEMENT");
    expect(result.summary.conclusion).toContain("PROVIDER_STRICT_JSON_SCHEMA_UNAVAILABLE");
    // the probe never retries an unsupported feature
    expect(JSON.parse(mock.bodies()[0] ?? "{}")["response_format"]).toMatchObject({ type: "json_schema" });
  });

  it("TEST_CEILING_IS_THREE_CALLS", async () => {
    expect(MAX_PROBE_CALLS).toBe(3);
    const bodies: string[] = [];
    const accepting: ProbeTransport = {
      async complete(body: string) {
        bodies.push(body);
        return {
          ok: true,
          http_status: 200,
          raw_envelope: "{}",
          content: JSON.stringify({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" } }),
          model: "deepseek-flash",
          error_code: null,
          error_message: null,
          usage: { total_tokens: 5 }
        };
      }
    };
    const result = await runCapabilityProbe({ transport: accepting });
    expect(result.summary.model_calls).toBeLessThanOrEqual(MAX_PROBE_CALLS);
    expect(bodies.length).toBeLessThanOrEqual(MAX_PROBE_CALLS);
    const capped = await runCapabilityProbe({ transport: accepting, maxCalls: MAX_PROBE_CALLS + 10 });
    expect(capped.summary.model_calls).toBeLessThanOrEqual(MAX_PROBE_CALLS);
  });

  it("TEST_NO_AUTO_REPAIR_IN_THE_PROBE", async () => {
    // A schema-valid-looking but WRONG-shaped response is recorded as not-enforced;
    // the probe never coerces a string into an object.
    const wrongShape: ProbeTransport = {
      async complete() {
        return {
          ok: true,
          http_status: 200,
          raw_envelope: "{}",
          content: JSON.stringify({ communication_directive: "CLARIFY_MISSING_CONTEXT" }),
          model: "deepseek-flash",
          error_code: null,
          error_message: null,
          usage: null
        };
      }
    };
    const result = await runCapabilityProbe({ transport: wrongShape });
    const nested = result.attempts.find((attempt) => attempt.test === "NESTED_OBJECT_ENFORCEMENT");
    expect(nested?.nested_object_enforced).toBe(false);
    expect(nested?.enum_enforced).toBe(false);
    // The no-repair discipline is asserted on CODE, not on the doc comment that
    // describes it: comments are stripped before the scan.
    const source = readFileSync(join(REPO_ROOT, PROBE_DIR, "probe.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/retryUntilValid|retry_until_valid/);
    expect(code).not.toMatch(/communication_directive\s*=\s*\{\s*kind/);
    // the model content is READ and judged, never rewritten into the required shape
    expect(code).not.toMatch(/content\s*=\s*JSON\.stringify\(/);
    expect(code).not.toMatch(/parsed\s*=\s*\{\s*communication_directive/);
  });

  it("TEST_MARKERS_AND_ISOLATION", async () => {
    const mock = rejectionTransport();
    const written: { path: string | null; text: string } = { path: null, text: "" };
    const report = await probeRun(
      { artifactOut: "tmp/capability-probe.json" },
      {
        apiKey: TEST_KEY,
        writeArtifact: (path: string, text: string) => {
          written.path = path;
          written.text = text;
        },
        maxCalls: 1
      }
    );
    expect(report.model_calls).toBe(1);
    expect(written.path).toBe("tmp/capability-probe.json");
    const artifact = JSON.parse(written.text) as Record<string, unknown>;
    expect(artifact["markers"]).toEqual(PROBE_MARKERS);
    expect((artifact["markers"] as Record<string, unknown>)["ENGINEERING_CAPABILITY_PROBE_ONLY"]).toBe(true);
    expect((artifact["markers"] as Record<string, unknown>)["NOT_PRIMARY_AUTHORIZATION_EVIDENCE"]).toBe(true);
    expect(written.text).not.toContain(TEST_KEY);
    expect(written.text).not.toMatch(/"authorization"\s*:/i);
    expect(written.text).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(PROBE_NAMESPACE).toBe("STRUCTURED_OUTPUT_CAPABILITY_PROBE");
    void mock;
  });

  it("TEST_ZERO_CALLS_WITHOUT_A_CREDENTIAL_AND_NO_PRODUCTION_CHANGE", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const refused = await probeRun({ artifactOut: "never.json" }, { apiKey: "", fetchImpl });
    expect(refused.verdict).toBe("PROBE_PREFLIGHT_STOP");
    expect(refused.model_calls).toBe(0);
    expect(calls).toBe(0);
    void createProbeTransport;
    // The probe WRITES nothing into a production or calibration path. The audit
    // module reads production sources — read-only — and writes nothing at all.
    for (const file of ["probe.ts", "cli.ts", "contract.ts", "payload-audit.ts"]) {
      const source = readFileSync(join(REPO_ROOT, PROBE_DIR, file), "utf8");
      expect(source, file).not.toMatch(/writeCalibrationEvidence|calibration-evidence/);
      // every write site is a reporting/artifact write, never a canonical-state write
      for (const write of source.match(/writeFileSync\([^)]*/g) ?? []) {
        expect(write, file).not.toMatch(/\.data|product|canonical|subject/i);
      }
    }
    // and the frozen calibration request is unchanged by this slice
    const request = await buildCalibrationRequest({ schemaHash: "", modelConfigHash: "" });
    expect(request.body.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(modelConfigManifest())).toContain("deepseek-flash");
  });
});
