/* globals AbortSignal, fetch, performance */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, 'provider-recovery.json');
const candidateBytes = await readFile(resolve(here, 'capability-candidates.json'), 'utf8');
const firstRows = (await readFile(resolve(here, 'capability-calibration.jsonl'), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const sha256 = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const baseUrl = 'http://127.0.0.1:11434';
const expectedDigest = '6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7';
const version = await (await fetch(`${baseUrl}/api/version`)).json();
const tags = await (await fetch(`${baseUrl}/api/tags`)).json();
const model = tags.models.find((entry) => entry.name === 'qwen3.5:9b');
if (version.version !== '0.33.3' || model?.digest !== expectedDigest) throw new Error('MODEL_BASELINE_CHANGED');

const warmupRequest = {
  model: 'qwen3.5:9b',
  messages: [{ role: 'user', content: 'Return one JSON object whose only key is ready and whose value is true.' }],
  format: {
    type: 'object',
    additionalProperties: false,
    required: ['ready'],
    properties: { ready: { const: true } }
  },
  think: false,
  stream: false,
  options: { temperature: 0, num_predict: 32, num_ctx: 8192 }
};
const startedAt = new Date().toISOString();
const started = performance.now();
const response = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(warmupRequest),
  signal: AbortSignal.timeout(240_000)
});
const rawBody = await response.text();
const envelope = JSON.parse(rawBody);
const content = JSON.parse(envelope.message.content);
if (content.ready !== true) throw new Error('provider recovery warm-up failed');

const firstTraceFailures = firstRows.map((row) => row.cognition_trace?.[0]?.failure_code ?? null);
const evidence = {
  schema_version: 'affect-authority-provider-recovery-v0',
  captured_at: new Date().toISOString(),
  immutable_after_capture: true,
  prior_calibration: {
    records: firstRows.length,
    model_timeouts: firstTraceFailures.filter((code) => code === 'MODEL_TIMEOUT').length,
    model_connection_failures: firstTraceFailures.filter((code) => code === 'MODEL_CONNECTION_FAILURE').length,
    raw_provider_responses: firstRows.filter((row) => row.stages.RAW_PROVIDER_RESPONSE).length,
    interpretation: 'UNCONTROLLED_PROVIDER_PROCESS_TERMINATION; NO CAPABILITY ADJUDICATION'
  },
  recovered_provider: {
    version: version.version,
    model: model.name,
    digest: model.digest,
    candidate_artifact_sha256: sha256(candidateBytes)
  },
  warmup: {
    experimental_evidence: false,
    started_at: startedAt,
    elapsed_ms: Math.round(performance.now() - started),
    http_status: response.status,
    request: warmupRequest,
    raw_body: rawBody,
    strict_json_valid: true,
    done_reason: envelope.done_reason ?? null,
    prompt_eval_count: envelope.prompt_eval_count ?? null,
    eval_count: envelope.eval_count ?? null
  }
};
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${outputPath}\n`);
