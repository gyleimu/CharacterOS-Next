/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative path. */
/**
 * STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0 — Phase A capability audit (0 model calls).
 *
 * Reads the REAL code paths and reports, per layer, whether a JSON Schema
 * constraint survives to the wire, where it is dropped, and whether any adapter
 * implements a strict/grammar mode. Nothing here is guessed: every entry names the
 * source it was read from.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { buildCalibrationRequest, serializeAuthoritativeRequest } from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { CALIBRATION_LAW } from "../belief-causal-confirmatory-stochastic-v1/calibration-law.ts";
import { modelConfigManifest } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";

import {
  CURRENT_RESPONSE_FORMAT,
  MAX_LENGTH_SEMANTICS,
  MINIMAL_NESTED_TEST_SCHEMA,
  PRIOR_CAPABILITY_EVIDENCE,
  strictJsonSchemaRequestFormat
} from "./contract.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

export interface CodePathFact {
  readonly id: string;
  readonly file: string;
  readonly finding: string;
  readonly evidence: string;
}

function readProductionFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

/**
 * Reads the three code paths that decide whether a schema reaches the wire:
 *   - the calibration request builder (what the FORMAL calibration sends),
 *   - the production OpenAI-compatible transport (what the product sends),
 *   - the Ollama-native transport (the one adapter with grammar mapping).
 */
export function auditCodePaths(): readonly CodePathFact[] {
  const openAiTransport = readProductionFile("packages/runtime/src/transports/model-transport.ts");
  const ollamaTransport = readProductionFile("packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts");
  const v8Provider = readProductionFile("packages/runtime/src/providers/behavior/conversation-cognition-provider-v8.ts");
  const calibrationRequest = readProductionFile("research/experiments/belief-causal-confirmatory-stochastic-v1/calibration-request.ts");

  const openAiBody = openAiTransport.slice(
    openAiTransport.indexOf("async complete(request: ModelTransportRequestV0)"),
    openAiTransport.indexOf("signal: abort.signal")
  );
  const openAiMentionsStructuredOutput = /structured_output/.test(openAiBody);
  const ollamaMapsSchemaToFormat = /format:\s*request\.structured_output\.schema/.test(ollamaTransport);
  const calibrationSendsJsonObject = /response_format:\s*\{\s*type:\s*"json_object"\s*\}/.test(calibrationRequest);
  const providerDeclaresStructuredOutput = /structured_output:\s*\{\s*kind:\s*"JSON_SCHEMA"/.test(v8Provider);

  return Object.freeze([
    {
      id: "FORMAL_CALIBRATION_REQUEST",
      file: "research/experiments/belief-causal-confirmatory-stochastic-v1/calibration-request.ts",
      finding: calibrationSendsJsonObject
        ? "the frozen calibration body carries response_format {\"type\":\"json_object\"} and NO schema"
        : "unexpected: the calibration body does not carry the expected json_object response_format",
      evidence: "buildCalibrationRequestBody() → { model, messages, temperature, max_tokens, stream, response_format: { type: \"json_object\" } }"
    },
    {
      id: "PRODUCTION_OPENAI_COMPATIBLE_TRANSPORT",
      file: "packages/runtime/src/transports/model-transport.ts",
      finding: openAiMentionsStructuredOutput
        ? "the OpenAI-compatible transport maps structured_output to the wire"
        : "the OpenAI-compatible transport DROPS request.structured_output: its body has no response_format field at all, and the drop is silent",
      evidence: openAiBody.replace(/\s+/g, " ").slice(0, 240)
    },
    {
      id: "LOCAL_OLLAMA_TRANSPORT",
      file: "packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts",
      finding: ollamaMapsSchemaToFormat
        ? "maps structured_output.schema to Ollama's grammar-enforced `format` (constrained decoding exists on the LOCAL path only)"
        : "unexpected: the Ollama transport no longer maps the schema to `format`",
      evidence: "…(request.structured_output === undefined ? {} : { format: request.structured_output.schema })"
    },
    {
      id: "V8_PROVIDER_DECLARES_CONSTRAINT",
      file: "packages/runtime/src/providers/behavior/conversation-cognition-provider-v8.ts",
      finding: providerDeclaresStructuredOutput
        ? "the provider DOES pass { kind: \"JSON_SCHEMA\", schema } to its transport; whether that reaches the wire is the transport's decision (see the two entries above)"
        : "unexpected: the V8 provider no longer passes a JSON_SCHEMA constraint",
      evidence: "transport.complete({ messages, structured_output: { kind: \"JSON_SCHEMA\", schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } })"
    }
  ]);
}

export interface CapabilityMatrix {
  readonly CURRENT_MODE: string;
  readonly CURRENT_PROVIDER_PAYLOAD: Readonly<Record<string, unknown>>;
  readonly SCHEMA_SENT_TO_PROVIDER: boolean;
  readonly PROMPT_ONLY_SCHEMA: boolean;
  readonly JSON_OBJECT_ONLY: boolean;
  readonly JSON_SCHEMA_MODE_IMPLEMENTED: boolean;
  readonly JSON_SCHEMA_MODE_SUPPORTED_BY_ADAPTER: boolean;
  readonly STRICT_FLAG_SUPPORTED: boolean;
  readonly GRAMMAR_SUPPORTED: boolean;
  readonly GRAMMAR_SUPPORTED_SCOPE: string;
  readonly UNKNOWN_FIELDS_DROPPED: boolean;
  readonly PROVIDER_CAPABILITY_UNKNOWN: boolean;
  readonly CODE_PATHS: readonly CodePathFact[];
  readonly TRANSPORT_PATH: readonly string[];
  readonly SERIALIZATION_PATH: readonly string[];
}

/**
 * The capability matrix, computed from the live request builder plus the code-path
 * audit. `PROVIDER_CAPABILITY_UNKNOWN` stays FALSE only because a prior slice
 * documented the endpoint's rejection with its exact error text — and Phase B
 * re-verifies it rather than trusting the note.
 */
export async function buildCapabilityMatrix(): Promise<CapabilityMatrix> {
  const request = await buildCalibrationRequest({ schemaHash: "", modelConfigHash: "" });
  const body = JSON.parse(serializeAuthoritativeRequest(request.body)) as Record<string, unknown>;
  const codePaths = auditCodePaths();
  const schemaSent = "response_format" in body && JSON.stringify(body["response_format"]) !== JSON.stringify(CURRENT_RESPONSE_FORMAT)
    ? true
    : JSON.stringify(body["response_format"] ?? null).includes("json_schema");
  return {
    CURRENT_MODE: "json_object + full schema rendered into the prompt",
    CURRENT_PROVIDER_PAYLOAD: {
      top_level_keys: Object.keys(body).sort(),
      response_format: body["response_format"] ?? null,
      message_roles: (body["messages"] as readonly { role: string }[]).map((message) => message.role),
      carries_schema: JSON.stringify(body).includes("\"additionalProperties\"")
    },
    SCHEMA_SENT_TO_PROVIDER: schemaSent,
    PROMPT_ONLY_SCHEMA: !schemaSent,
    JSON_OBJECT_ONLY: JSON.stringify(body["response_format"] ?? null) === JSON.stringify(CURRENT_RESPONSE_FORMAT),
    JSON_SCHEMA_MODE_IMPLEMENTED: false,
    JSON_SCHEMA_MODE_SUPPORTED_BY_ADAPTER: false,
    STRICT_FLAG_SUPPORTED: false,
    GRAMMAR_SUPPORTED: codePaths.some((entry) => entry.id === "LOCAL_OLLAMA_TRANSPORT" && entry.finding.includes("grammar-enforced")),
    GRAMMAR_SUPPORTED_SCOPE: "LOCAL_OLLAMA_TRANSPORT_ONLY (the API transport has no grammar path)",
    UNKNOWN_FIELDS_DROPPED: codePaths.some((entry) => entry.id === "PRODUCTION_OPENAI_COMPATIBLE_TRANSPORT" && entry.finding.includes("DROPS")),
    PROVIDER_CAPABILITY_UNKNOWN: false,
    CODE_PATHS: codePaths,
    TRANSPORT_PATH: [
      "ConversationCognitionProviderV8.propose → ModelTransportV0.complete({ messages, structured_output })",
      "→ OpenAiCompatibleTransportV0 (API) : structured_output DROPPED, body carries only model/messages/temperature/max_tokens",
      "→ OllamaNativeCognitionTransportV0 (local) : structured_output.schema → `format` (grammar-constrained decoding)",
      "→ calibration path (research) : its own body with response_format {\"type\":\"json_object\"} and no schema"
    ],
    SERIALIZATION_PATH: [
      "packages/runtime/src/transports/model-transport.ts — JSON.stringify of an explicit field list (unknown/extra fields are silently omitted)",
      "research/.../calibration-request.ts — canonicalJson(body); response_format is a hard-coded literal { type: \"json_object\" }"
    ]
  };
}

/** What the probe would send, for inspection before any call. */
export function probePayloadPreview(): Record<string, unknown> {
  return {
    model_config: modelConfigManifest(),
    calibration_law_id: CALIBRATION_LAW.id,
    current_response_format: CURRENT_RESPONSE_FORMAT,
    probe_response_format_minimal: strictJsonSchemaRequestFormat(MINIMAL_NESTED_TEST_SCHEMA),
    probe_response_format_full_v8: strictJsonSchemaRequestFormat(
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as Readonly<Record<string, unknown>>
    ),
    max_length_semantics: MAX_LENGTH_SEMANTICS,
    prior_evidence: PRIOR_CAPABILITY_EVIDENCE
  };
}
