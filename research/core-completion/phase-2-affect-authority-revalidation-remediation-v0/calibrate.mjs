/* globals fetch */
import { createHash } from 'node:crypto';
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OllamaNativeCognitionTransportV0
} from '../../../packages/runtime/dist/index.js';
import { growSnapshot } from '../phase-2-affect-authority-contract-revalidation-v0/lib/pipeline.mjs';
import { classifyNullBehavior } from '../phase-2-affect-authority-contract-revalidation-v0/lib/classify.mjs';
import { HISTORY_EVENTS, PROVIDER } from '../phase-2-affect-authority-contract-revalidation-v0/lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const infrastructureRetry = process.argv.includes('--infrastructure-retry');
const candidatePath = resolve(here, 'capability-candidates.json');
const suffix = infrastructureRetry ? '-infrastructure-retry-1' : '';
const partialPath = resolve(here, `capability-calibration${suffix}.partial.jsonl`);
const finalPath = resolve(here, `capability-calibration${suffix}.jsonl`);
const summaryPath = resolve(here, `capability-calibration${suffix}-summary.json`);
const qualifiedPath = resolve(here, `qualified-null-oracle${suffix}.json`);
const hash = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const exists = async (path) => stat(path).then(() => true, () => false);

if (await exists(finalPath)) throw new Error('immutable calibration evidence already exists');
const candidateBytes = await readFile(candidatePath, 'utf8');
const protocol = JSON.parse(candidateBytes);
if (protocol.baseline_condition !== 'AFFECT_ABSENT') throw new Error('calibration baseline must be AFFECT_ABSENT');
if (protocol.replicates_per_candidate !== 5) throw new Error('calibration k must be 5');
if (protocol.candidates.length < 8) throw new Error('at least eight candidates required');
if (infrastructureRetry) {
  const firstSummary = JSON.parse(
    await readFile(resolve(here, 'capability-calibration-summary.json'), 'utf8')
  );
  if (firstSummary.frozen_candidate_artifact_sha256 !== hash(candidateBytes)) {
    throw new Error('candidate artifact changed before infrastructure retry');
  }
  if (firstSummary.cognition_calls !== 40 || firstSummary.language_calls !== 0) {
    throw new Error('first calibration is not the recorded provider-crash attempt');
  }
}

const version = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const model = tags.models.find((entry) => entry.name === PROVIDER.model);
if (model?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');

const existingLines = (await exists(partialPath))
  ? (await readFile(partialPath, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  : [];
const completedKeys = new Set(existingLines.map((row) => `${row.scenario}/${row.replicate}`));
const snapshot = await growSnapshot(HISTORY_EVENTS);
const cognitionTraces = [];
const languageTraces = [];
const cognition = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.cognition_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => {
    if (!('stage' in event)) cognitionTraces.push(event);
  }
});
const language = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.language_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => {
    if (!('stage' in event)) languageTraces.push(event);
  }
});

for (const candidate of protocol.candidates) {
  const scenario = { ...candidate, role: 'FACTUAL_CONTROL' };
  for (let replicate = 0; replicate < protocol.replicates_per_candidate; replicate += 1) {
    const key = `${scenario.id}/${replicate}`;
    if (completedKeys.has(key)) continue;
    process.stdout.write(`START ${key}\n`);
    const cognitionTraceStart = cognitionTraces.length;
    const languageTraceStart = languageTraces.length;
    const result = await runCondition({
      snapshot,
      scenario,
      conditionId: 'A',
      realTransport: cognition,
      realLanguageTransport: language,
      sessionId: `sess-cal-${scenario.id.toLowerCase()}-${replicate}`
    });
    const classification =
      result.status === 'COMPLETE' && result.final_behavior !== null
        ? classifyNullBehavior(candidate.expected, result.final_behavior)
        : null;
    const correct =
      classification === `CORRECT_${candidate.expected}` &&
      Object.values(result.stages).every(Boolean) &&
      result.cognition_calls === 1 &&
      result.request_attestation?.ok === true;
    const row = {
      schema_version: 'affect-authority-capability-calibration-record-v0',
      stage: infrastructureRetry
        ? 'BASELINE_ONLY_CAPABILITY_CALIBRATION_INFRASTRUCTURE_RETRY_1'
        : 'BASELINE_ONLY_CAPABILITY_CALIBRATION',
      baseline_condition: 'AFFECT_ABSENT',
      candidate_order: candidate.order,
      replicate,
      expected: candidate.expected,
      classification,
      correct,
      ...result,
      cognition_trace: cognitionTraces.slice(cognitionTraceStart),
      language_trace: languageTraces.slice(languageTraceStart)
    };
    await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
    process.stdout.write(`DONE ${key} correct=${correct}\n`);
  }
}

const rawBytes = await readFile(partialPath, 'utf8');
const rows = rawBytes.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const expectedCount = protocol.candidates.length * protocol.replicates_per_candidate;
if (rows.length !== expectedCount) throw new Error(`calibration incomplete: ${rows.length}/${expectedCount}`);
const results = protocol.candidates.map((candidate) => {
  const records = rows.filter((row) => row.scenario === candidate.id);
  const correct = records.filter((row) => row.correct).length;
  return { order: candidate.order, id: candidate.id, expected: candidate.expected, correct, total: records.length, qualified: correct === 5 };
});
const selected = results.find((result) => result.qualified) ?? null;
const summary = {
  schema_version: 'affect-authority-capability-calibration-summary-v0',
  infrastructure_retry_round: infrastructureRetry ? 1 : 0,
  frozen_candidate_artifact_sha256: hash(candidateBytes),
  calibration_artifact_sha256: hash(rawBytes),
  provider: {
    version: version.version,
    model: PROVIDER.model,
    digest: model.digest,
    semantic_settings: {
      temperature: PROVIDER.temperature,
      think: PROVIDER.think,
      stream: PROVIDER.stream,
      num_ctx: PROVIDER.context_window_tokens,
      num_predict: PROVIDER.cognition_num_predict,
      timeout_ms: PROVIDER.timeout_ms
    },
    serialization_constraint: 'OLLAMA_NATIVE_JSON_SCHEMA'
  },
  baseline_condition: protocol.baseline_condition,
  qualification_rule: protocol.qualification_rule,
  selection_rule: protocol.selection_rule,
  results,
  selected: selected?.id ?? null,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0),
  language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  malformed_structured_outputs: rows.filter(
    (row) => row.stages.RAW_PROVIDER_RESPONSE && !row.stages.SCHEMA_VALID
  ).length,
  transport_failures: rows.filter((row) => !row.stages.RAW_PROVIDER_RESPONSE).length,
  infrastructure_retries: infrastructureRetry ? rows.length : 0
};
const selectedCandidate = selected === null
  ? null
  : protocol.candidates.find((candidate) => candidate.id === selected.id);
const qualified = {
  schema_version: 'affect-authority-qualified-null-oracle-v0',
  selection_status: selectedCandidate === null ? 'NONE_QUALIFIED' : 'QUALIFIED',
  frozen_candidate_artifact_sha256: summary.frozen_candidate_artifact_sha256,
  calibration_artifact_sha256: summary.calibration_artifact_sha256,
  selection_rule: protocol.selection_rule,
  baseline_condition: protocol.baseline_condition,
  candidate: selectedCandidate
};

await rename(partialPath, finalPath);
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
await writeFile(qualifiedPath, `${JSON.stringify(qualified, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${JSON.stringify({ finalPath, selected: summary.selected, results })}\n`);
