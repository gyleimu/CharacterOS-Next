/* globals AbortSignal, Buffer, fetch, performance */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { conditionVariant } from '../phase-2-affect-authority-contract-revalidation-v0/lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '..', '..', '..');
const priorRoot = resolve(
  repositoryRoot,
  'research',
  'core-completion',
  'phase-2-affect-authority-contract-revalidation-v0'
);
const outputPath = resolve(here, 'structured-output-evidence.json');
const partialPath = resolve(here, 'structured-output-evidence.partial.json');
const baseRequests = JSON.parse(
  await readFile(resolve(priorRoot, 'evidence', 'base-requests.json'), 'utf8')
);

const MODEL = 'qwen3.5:9b';
const ENDPOINT = 'http://127.0.0.1:11434/api/chat';
const cells = [
  ['S1_AMBIGUOUS_REQUEST', 'Z'],
  ['S1_AMBIGUOUS_REQUEST', 'P'],
  ['S1_AMBIGUOUS_REQUEST', 'N'],
  ['S1_AMBIGUOUS_REQUEST', 'A'],
  ['N4', 'A'],
  ['N4', 'P'],
  ['N4', 'N'],
  ['N4', 'Z']
];

function sha256(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function utf8Hex(text) {
  return Buffer.from(text, 'utf8').toString('hex');
}

async function call(scenario, condition) {
  const base = baseRequests[scenario];
  if (base === undefined) throw new Error(`saved request missing: ${scenario}`);
  const variant = conditionVariant(base.userContent, condition);
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: base.systemContent },
      { role: 'user', content: variant.transformed }
    ],
    think: false,
    stream: false,
    options: {
      temperature: 0,
      num_predict: 2048,
      num_ctx: 8192
    }
  });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let response = null;
  let responseText = null;
  let transportError = null;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(240_000)
    });
    responseText = await response.text();
  } catch (error) {
    transportError = {
      name: error instanceof Error ? error.name : null,
      message: String(error),
      cause_code:
        typeof error?.cause?.code === 'string' ? error.cause.code : null
    };
  }
  const finishedAt = new Date().toISOString();
  let envelope = null;
  let envelopeParseError = null;
  if (responseText !== null) {
    try {
      envelope = JSON.parse(responseText);
    } catch (error) {
      envelopeParseError = String(error);
    }
  }
  const content = envelope?.message?.content ?? null;
  let contentJsonValid = false;
  let contentParseError = null;
  if (typeof content === 'string') {
    try {
      JSON.parse(content);
      contentJsonValid = true;
    } catch (error) {
      contentParseError = String(error);
    }
  }
  return {
    scenario,
    condition,
    request_source: 'saved prior base request plus the prior frozen conditionVariant transform',
    request: {
      endpoint: ENDPOINT,
      method: 'POST',
      content_type: 'application/json',
      body,
      body_sha256: sha256(body),
      system_content_sha256: sha256(base.systemContent),
      user_content_sha256: sha256(variant.transformed),
      format_present: Object.hasOwn(JSON.parse(body), 'format')
    },
    response: {
      started_at: startedAt,
      finished_at: finishedAt,
      elapsed_ms: Math.round(performance.now() - started),
      transport_error: transportError,
      http_status: response?.status ?? null,
      http_ok: response?.ok ?? false,
      raw_body: responseText,
      raw_body_sha256: responseText === null ? null : sha256(responseText),
      envelope_parse_error: envelopeParseError,
      message_content: content,
      message_content_sha256: typeof content === 'string' ? sha256(content) : null,
      message_content_utf8_hex: typeof content === 'string' ? utf8Hex(content) : null,
      message_content_json_valid: contentJsonValid,
      message_content_parse_error: contentParseError,
      done_reason: envelope?.done_reason ?? null,
      prompt_eval_count: envelope?.prompt_eval_count ?? null,
      eval_count: envelope?.eval_count ?? null,
      total_duration_ns: envelope?.total_duration ?? null
    }
  };
}

const providerVersionResponse = await fetch('http://127.0.0.1:11434/api/version');
const providerVersion = await providerVersionResponse.json();
const tagsResponse = await fetch('http://127.0.0.1:11434/api/tags');
const tags = await tagsResponse.json();
const model = tags.models.find((entry) => entry.name === MODEL);
const records = [];
for (const [scenario, condition] of cells) {
  process.stdout.write(`START ${scenario}/${condition}\n`);
  const record = await call(scenario, condition);
  records.push(record);
  await writeFile(partialPath, `${JSON.stringify({ records }, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `DONE ${scenario}/${condition} status=${record.response.http_status ?? 'transport-error'} json=${record.response.message_content_json_valid}\n`
  );
}

const evidence = {
  schema_version: 'affect-authority-structured-output-forensics-v0',
  captured_at: new Date().toISOString(),
  immutable_after_capture: true,
  repository_head: '2418ca0a7b6346939dd15625f518c0346a410ea2',
  provider: {
    kind: 'OLLAMA_NATIVE',
    version: providerVersion.version,
    model: MODEL,
    digest: model?.digest ?? null,
    serialization_constraint: null,
    semantic_settings: {
      temperature: 0,
      think: false,
      stream: false,
      num_ctx: 8192,
      num_predict: 2048
    }
  },
  prior_attempt: {
    cell: 'S1_AMBIGUOUS_REQUEST/P',
    result: 'INFRASTRUCTURE_FAILURE_BEFORE_RESPONSE_BYTES',
    error: 'TypeError: fetch failed; cause UND_ERR_HEADERS_TIMEOUT',
    evidence_file_written: false,
    interpretation: 'transport failure; not a schema or semantic result'
  },
  records
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${outputPath}\n`);
