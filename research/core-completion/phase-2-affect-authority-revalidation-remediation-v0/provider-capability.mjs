/* globals AbortSignal, fetch, performance */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const forensic = JSON.parse(await readFile(resolve(here, 'structured-output-evidence.json'), 'utf8'));
const retry = JSON.parse(await readFile(resolve(here, 'structured-output-evidence-s1z-retry.json'), 'utf8'));
const outputPath = resolve(here, 'provider-capability.json');
const endpoint = 'http://127.0.0.1:11434/api/chat';
const hash = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

export const conversationCognitionProposalV2JsonSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'cognition', 'communication_directive', 'clarification_basis'],
  properties: {
    schema_version: { const: 'conversation-cognition-proposal-v2' },
    cognition: {
      type: 'object',
      additionalProperties: false,
      required: [
        'schema_version',
        'projection_hash',
        'reasoning_summary',
        'relevant_memory_refs',
        'considered_context_refs',
        'current_intent',
        'confidence',
        'uncertainty',
        'action_intent',
        'evidence_refs'
      ],
      properties: {
        schema_version: { const: 'cognition-proposal-v0' },
        projection_hash: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_memory_refs: { type: 'array', items: { type: 'string' } },
        considered_context_refs: { type: 'array', items: { type: 'string' } },
        current_intent: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        uncertainty: { type: 'number', minimum: 0, maximum: 1 },
        action_intent: { type: 'null' },
        evidence_refs: { type: 'array', items: { type: 'string' } }
      }
    },
    communication_directive: {
      type: 'object',
      additionalProperties: false,
      required: ['kind'],
      properties: {
        kind: { enum: ['CLARIFY_MISSING_CONTEXT', 'REALIZE_CURRENT_INTENT'] }
      }
    },
    clarification_basis: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['current_observation_ref', 'missing_information', 'needed_for'],
          properties: {
            current_observation_ref: { type: 'string' },
            missing_information: { type: 'string', minLength: 1, maxLength: 256 },
            needed_for: { type: 'string', minLength: 1, maxLength: 256 }
          }
        }
      ]
    }
  }
});

async function invoke(label, request) {
  const body = JSON.stringify(request);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(240_000)
  });
  const rawBody = await response.text();
  const envelope = JSON.parse(rawBody);
  const content = envelope?.message?.content ?? null;
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    parseError = String(error);
  }
  return {
    label,
    request_body: body,
    request_body_sha256: hash(body),
    response: {
      started_at: startedAt,
      elapsed_ms: Math.round(performance.now() - started),
      http_status: response.status,
      raw_body: rawBody,
      raw_body_sha256: hash(rawBody),
      message_content: content,
      message_content_sha256: typeof content === 'string' ? hash(content) : null,
      strict_json_valid: parsed !== null,
      parse_error: parseError,
      parsed,
      done_reason: envelope.done_reason ?? null,
      prompt_eval_count: envelope.prompt_eval_count ?? null,
      eval_count: envelope.eval_count ?? null,
      total_duration_ns: envelope.total_duration ?? null
    }
  };
}

const common = {
  model: forensic.provider.model,
  think: false,
  stream: false,
  options: { temperature: 0, num_predict: 2048, num_ctx: 8192 }
};
const minimalJson = await invoke('OLLAMA_JSON_MODE_MINIMAL', {
  ...common,
  messages: [{ role: 'user', content: 'Return one JSON object with exactly one key named ok whose value is true.' }],
  format: 'json'
});
const s1Source = retry.request_body;
const n4Source = forensic.records.find((record) => record.scenario === 'N4' && record.condition === 'A').request.body;
const s1Schema = await invoke('S1_Z_CLOSED_JSON_SCHEMA', {
  ...JSON.parse(s1Source),
  format: conversationCognitionProposalV2JsonSchema
});
const n4Schema = await invoke('N4_A_CLOSED_JSON_SCHEMA', {
  ...JSON.parse(n4Source),
  format: conversationCognitionProposalV2JsonSchema
});

const evidence = {
  schema_version: 'ollama-cognition-structured-output-capability-v0',
  captured_at: new Date().toISOString(),
  immutable_after_capture: true,
  provider: forensic.provider,
  conclusions: {
    json_mode_supported: minimalJson.response.strict_json_valid,
    closed_json_schema_supported:
      s1Schema.response.strict_json_valid && n4Schema.response.strict_json_valid,
    selected_remediation_family: 'OPTION_A_PROVIDER_NATIVE_STRUCTURED_OUTPUT',
    host_validation_replacement: false
  },
  records: [minimalJson, s1Schema, n4Schema]
};
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${outputPath}\n`);
