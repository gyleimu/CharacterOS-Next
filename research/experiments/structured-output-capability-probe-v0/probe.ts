/**
 * STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0 — minimal probe transport + bounded runner.
 *
 * Single attempt per call, timeout-enforced, credential in the Authorization header
 * only, raw envelope retained with key-shaped text redacted. NO retry of any kind:
 * a rejected capability is an answer, not a failure to retry.
 */
import { createHash } from "node:crypto";

import { MODEL } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";
import { scanAndRedactCredentialPatterns } from "../executor-schema-failure-diagnostic-v0/diagnostic-transport.ts";

import {
  MAX_PROBE_CALLS,
  MINIMAL_NESTED_TEST_SCHEMA,
  MINIMAL_PROBE_PROMPT,
  PROBE_ARTIFACT_SCHEMA_VERSION,
  PROBE_ID,
  PROBE_MARKERS,
  PROBE_NAMESPACE,
  PROBE_STOP_RULE,
  PRIOR_CAPABILITY_EVIDENCE,
  strictJsonSchemaRequestFormat
} from "./contract.ts";
import { buildCapabilityMatrix, type CapabilityMatrix } from "./payload-audit.ts";

export interface ProbeAttemptRecord {
  readonly call: number;
  readonly test: "MINIMAL_SCHEMA_ACCEPTANCE" | "NESTED_OBJECT_ENFORCEMENT" | "FULL_V8_SCHEMA_ACCEPTANCE";
  readonly request_sha256: string;
  readonly request_bytes: number;
  readonly response_format_type: string;
  readonly http_status: number | null;
  readonly accepted_by_provider: boolean;
  readonly provider_error_code: string | null;
  readonly provider_error_message: string | null;
  readonly raw_envelope: string | null;
  readonly content: string | null;
  readonly content_json_valid: boolean | null;
  readonly nested_object_enforced: boolean | null;
  readonly enum_enforced: boolean | null;
  readonly model: string | null;
  readonly usage: Readonly<Record<string, number>> | null;
}

export interface ProbeResult {
  readonly schema_version: typeof PROBE_ARTIFACT_SCHEMA_VERSION;
  readonly probe_id: typeof PROBE_ID;
  readonly namespace: typeof PROBE_NAMESPACE;
  readonly markers: typeof PROBE_MARKERS;
  readonly stop_rule: typeof PROBE_STOP_RULE;
  readonly capability_matrix: CapabilityMatrix;
  readonly prior_evidence: typeof PRIOR_CAPABILITY_EVIDENCE;
  readonly attempts: readonly ProbeAttemptRecord[];
  readonly summary: {
    readonly model_calls: number;
    readonly network_calls: number;
    readonly minimal_schema_accepted: boolean | null;
    readonly nested_object_enforced: boolean | null;
    readonly full_v8_schema_accepted: boolean | null;
    readonly stop_reason: string;
    readonly conclusion: readonly string[];
  };
  readonly limitations: readonly string[];
  readonly artifact_hash?: string;
}

export interface ProbeTransport {
  complete(body: string): Promise<{
    readonly ok: boolean;
    readonly http_status: number | null;
    readonly raw_envelope: string;
    readonly content: string | null;
    readonly model: string | null;
    readonly error_code: string | null;
    readonly error_message: string | null;
    readonly usage: Readonly<Record<string, number>> | null;
  }>;
}

export interface ProbeTransportOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

/** The real probe transport: ONE attempt, no retry, credential in the header only. */
export function createProbeTransport(
  apiKey: string,
  baseUrl: string = MODEL.base_url,
  options: ProbeTransportOptions = {}
): ProbeTransport {
  if (apiKey.trim().length === 0) throw new Error("CAPABILITY_PROBE_NO_CREDENTIAL");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 120000;
  return {
    async complete(body: string) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body,
            signal: abort.signal
          });
        } catch (error) {
          return {
            ok: false,
            http_status: null,
            raw_envelope: "",
            content: null,
            model: null,
            error_code: abort.signal.aborted ? "PROBE_TIMEOUT" : "PROBE_NETWORK_ERROR",
            error_message: error instanceof Error ? error.message : String(error),
            usage: null
          };
        }
        const raw = await response.text().catch(() => "");
        const scanned = scanAndRedactCredentialPatterns(raw);
        if (!response.ok) {
          let errorCode: string | null = null;
          let errorMessage: string | null = scanned.text.slice(0, 400);
          try {
            const parsed = JSON.parse(raw) as { error?: { code?: unknown; message?: unknown; type?: unknown } };
            errorCode = typeof parsed.error?.code === "string" ? parsed.error.code : null;
            if (typeof parsed.error?.type === "string" && errorCode === null) errorCode = parsed.error.type;
            if (typeof parsed.error?.message === "string") errorMessage = parsed.error.message.slice(0, 400);
          } catch {
            /* a non-JSON error body is reported verbatim */
          }
          return {
            ok: false,
            http_status: response.status,
            raw_envelope: scanned.text,
            content: null,
            model: null,
            error_code: errorCode,
            error_message: errorMessage,
            usage: null
          };
        }
        const parsed = JSON.parse(raw) as {
          model?: unknown;
          choices?: readonly { message?: { content?: unknown } }[];
          usage?: Record<string, number>;
        };
        return {
          ok: true,
          http_status: response.status,
          raw_envelope: scanned.text,
          content: typeof parsed.choices?.[0]?.message?.content === "string" ? String(parsed.choices[0]?.message?.content) : null,
          model: typeof parsed.model === "string" ? parsed.model : null,
          error_code: null,
          error_message: null,
          usage: parsed.usage ?? null
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export interface ProbeRunOptions {
  readonly transport: ProbeTransport;
  readonly maxCalls?: number | undefined;
}

/**
 * Runs the capability probe: at most MAX_PROBE_CALLS calls.
 *   call 1 — does the provider ACCEPT a strict json_schema response_format?
 *   call 2 — (only if call 1 was accepted) is the nested object enforced?
 *   call 3 — (only if calls 1–2 were accepted) does the FULL V8 schema fit?
 * A rejection ends the probe immediately; the feature is never retried.
 */
export async function runCapabilityProbe(options: ProbeRunOptions): Promise<ProbeResult> {
  const maxCalls = Math.min(options.maxCalls ?? MAX_PROBE_CALLS, MAX_PROBE_CALLS);
  const matrix = await buildCapabilityMatrix();
  const attempts: ProbeAttemptRecord[] = [];

  const call = async (
    test: ProbeAttemptRecord["test"],
    responseFormat: Readonly<Record<string, unknown>>
  ): Promise<ProbeAttemptRecord> => {
    const body = JSON.stringify({
      model: MODEL.id,
      messages: [{ role: "user", content: MINIMAL_PROBE_PROMPT }],
      temperature: 0,
      max_tokens: 512,
      stream: false,
      response_format: responseFormat
    });
    const outcome = await options.transport.complete(body);
    let nestedEnforced: boolean | null = null;
    let enumEnforced: boolean | null = null;
    let contentJsonValid: boolean | null = null;
    if (outcome.ok && outcome.content !== null) {
      try {
        const parsed = JSON.parse(outcome.content) as { communication_directive?: unknown };
        contentJsonValid = true;
        const directive = parsed.communication_directive;
        nestedEnforced = typeof directive === "object" && directive !== null && !Array.isArray(directive);
        enumEnforced =
          nestedEnforced === true &&
          ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"].includes(
            String((directive as { kind?: unknown }).kind ?? "")
          );
      } catch {
        contentJsonValid = false;
      }
    }
    return {
      call: attempts.length + 1,
      test,
      request_sha256: `sha256:${sha256Hex(body)}`,
      request_bytes: Buffer.byteLength(body, "utf8"),
      response_format_type: String(responseFormat["type"]),
      http_status: outcome.http_status,
      accepted_by_provider: outcome.ok,
      provider_error_code: outcome.error_code,
      provider_error_message: outcome.error_message,
      raw_envelope: outcome.ok ? outcome.raw_envelope : null,
      content: outcome.content,
      content_json_valid: contentJsonValid,
      nested_object_enforced: nestedEnforced,
      enum_enforced: enumEnforced,
      model: outcome.model,
      usage: outcome.usage
    };
  };

  const first = await call("MINIMAL_SCHEMA_ACCEPTANCE", strictJsonSchemaRequestFormat(MINIMAL_NESTED_TEST_SCHEMA));
  attempts.push(first);
  let stopReason = first.accepted_by_provider
    ? "minimal strict schema accepted; proceeding"
    : `minimal strict schema REJECTED (http ${String(first.http_status)}${first.provider_error_code === null ? "" : `, ${first.provider_error_code}`}); the feature is not retried`;

  if (first.accepted_by_provider && attempts.length < maxCalls) {
    const second = await call("NESTED_OBJECT_ENFORCEMENT", strictJsonSchemaRequestFormat(MINIMAL_NESTED_TEST_SCHEMA));
    attempts.push(second);
    const enforced = second.nested_object_enforced === true && second.enum_enforced === true;
    stopReason = enforced
      ? "nested object and enum enforced; proceeding to the full schema"
      : "the provider accepted the strict schema but did not enforce the nested shape";
    if (enforced && attempts.length < maxCalls) {
      const { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } = await import("../../../packages/runtime/dist/index.js");
      const third = await call(
        "FULL_V8_SCHEMA_ACCEPTANCE",
        strictJsonSchemaRequestFormat(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as Readonly<Record<string, unknown>>)
      );
      attempts.push(third);
      stopReason = third.accepted_by_provider
        ? "the full canonical V8 schema was accepted by the provider"
        : `the provider rejected the FULL V8 schema (http ${String(third.http_status)})`;
    }
  }

  const minimalAccepted = first.accepted_by_provider;
  const nestedEnforced = attempts.find((attempt) => attempt.test === "NESTED_OBJECT_ENFORCEMENT")?.nested_object_enforced ?? null;
  const fullAccepted = attempts.find((attempt) => attempt.test === "FULL_V8_SCHEMA_ACCEPTANCE")?.accepted_by_provider ?? null;
  const conclusion: string[] = [
    "CURRENT_JSON_OBJECT_MODE_IS_ONLY_SYNTAX_ENFORCEMENT",
    ...(minimalAccepted
      ? ["PROVIDER_STRICT_JSON_SCHEMA_AVAILABLE_AND_COMPATIBLE"]
      : ["PROVIDER_STRICT_JSON_SCHEMA_UNAVAILABLE"])
  ];

  return {
    schema_version: PROBE_ARTIFACT_SCHEMA_VERSION,
    probe_id: PROBE_ID,
    namespace: PROBE_NAMESPACE,
    markers: PROBE_MARKERS,
    stop_rule: PROBE_STOP_RULE,
    capability_matrix: matrix,
    prior_evidence: PRIOR_CAPABILITY_EVIDENCE,
    attempts,
    summary: {
      model_calls: attempts.length,
      network_calls: attempts.length,
      minimal_schema_accepted: minimalAccepted,
      nested_object_enforced: nestedEnforced,
      full_v8_schema_accepted: fullAccepted,
      stop_reason: stopReason,
      conclusion
    },
    limitations: [
      "ENGINEERING CAPABILITY PROBE ONLY: this is not a calibration, not readiness evidence, not Belief evidence and not a scientific observation of any kind.",
      "It reports whether the ENDPOINT accepts a request shape today; acceptance is not a correctness or compliance claim about the executor.",
      "Provider-side JSON Schema length semantics are NOT exercised here and remain unverified: provider enforcement must never be assumed equivalent to the CharacterOS Unicode-code-point law.",
      "A rejection is recorded once and never retried; no repair, coercion or retry-until-valid occurs anywhere in this probe.",
      "Nothing in this probe changes production behaviour, the frozen contract, the calibration configuration or the executor."
    ]
  };
}
