/* globals AbortSignal, Buffer, fetch, performance */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, 'structured-output-evidence.json');
const outputPath = resolve(here, 'structured-output-evidence-s1z-retry.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const original = source.records.find(
  (record) => record.scenario === 'S1_AMBIGUOUS_REQUEST' && record.condition === 'Z'
);
if (original === undefined) throw new Error('S1/Z forensic request not found');
const body = original.request.body;
const startedAt = new Date().toISOString();
const started = performance.now();
const response = await fetch(original.request.endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
  signal: AbortSignal.timeout(240_000)
});
const rawBody = await response.text();
const envelope = JSON.parse(rawBody);
const content = envelope?.message?.content ?? null;
let contentJsonValid = false;
let contentParseError = null;
try {
  JSON.parse(content);
  contentJsonValid = true;
} catch (error) {
  contentParseError = String(error);
}
const hash = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const evidence = {
  schema_version: 'affect-authority-structured-output-forensics-retry-v0',
  captured_at: new Date().toISOString(),
  immutable_after_capture: true,
  retry_classification: 'ONE_PREDECLARED_INFRASTRUCTURE_RETRY_AFTER_TIMEOUT_BEFORE_RESPONSE_BYTES',
  scenario: original.scenario,
  condition: original.condition,
  request_body: body,
  request_body_sha256: hash(body),
  started_at: startedAt,
  elapsed_ms: Math.round(performance.now() - started),
  http_status: response.status,
  raw_body: rawBody,
  raw_body_sha256: hash(rawBody),
  message_content: content,
  message_content_sha256: typeof content === 'string' ? hash(content) : null,
  message_content_utf8_hex: typeof content === 'string' ? Buffer.from(content, 'utf8').toString('hex') : null,
  message_content_json_valid: contentJsonValid,
  message_content_parse_error: contentParseError,
  done_reason: envelope.done_reason ?? null,
  prompt_eval_count: envelope.prompt_eval_count ?? null,
  eval_count: envelope.eval_count ?? null,
  total_duration_ns: envelope.total_duration ?? null
};
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${outputPath}\n`);
