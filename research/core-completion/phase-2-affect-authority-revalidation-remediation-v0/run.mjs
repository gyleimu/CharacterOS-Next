/* globals fetch */
/** Resumable, frozen run-of-record collection. No semantic or schema retries. */

import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  classifyAffectBehavior,
  classifyNullBehavior
} from '../phase-2-affect-authority-contract-revalidation-v0/lib/classify.mjs';
import {
  PRIMARY_SCENARIOS,
  PROVIDER,
  REPLICATES,
  primarySchedule
} from './lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const partialPath = resolve(here, 'raw-cognition.partial.jsonl');
const finalPath = resolve(here, 'raw-cognition.jsonl');
const languagePath = resolve(here, 'raw-language.jsonl');
const collectionPath = resolve(here, 'collection-primary.json');
const exists = async (path) => stat(path).then(() => true, () => false);
if (await exists(finalPath)) throw new Error('immutable run-of-record evidence already exists');

const freeze = JSON.parse(await readFile(resolve(here, 'freeze.json'), 'utf8'));
const scoringBytes = await readFile(resolve(here, 'scoring-freeze.json'), 'utf8');
const scoring = JSON.parse(scoringBytes);
if (!freeze.created_before_run_of_record || !scoring.frozen_before_run_of_record) {
  throw new Error('run-of-record freeze missing');
}
const freezeWithoutHash = { ...freeze };
delete freezeWithoutHash.freeze_hash;
if (hashJson(freezeWithoutHash) !== freeze.freeze_hash) throw new Error('freeze hash mismatch');

const version = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const model = tags.models.find((entry) => entry.name === PROVIDER.model);
if (model?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const snapshot = JSON.parse(await readFile(resolve(here, 'snapshot.json'), 'utf8'));
const schedule = primarySchedule(REPLICATES);
const existingRows = (await exists(partialPath))
  ? (await readFile(partialPath, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  : [];
const completed = new Set(existingRows.map((row) => `${row.scenario}/${row.schedule_index}`));
const traces = { cognition: [], language: [] };
const cognition = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.cognition_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => {
    if (!('stage' in event)) traces.cognition.push(event);
  }
});
const language = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.language_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => {
    if (!('stage' in event)) traces.language.push(event);
  }
});

function mixedFactCorrect(scenario, text) {
  if (typeof text !== 'string') return false;
  const escaped = scenario.objective_fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const present = new RegExp(escaped, 'i').test(text);
  const negated = new RegExp(`\\b(?:not|isn't|is not|wasn't|was not)\\s+(?:at\\s+)?${escaped}`, 'i').test(text);
  return present && !negated;
}

function mixedSubjectiveClass(record) {
  if (record.directive === 'CLARIFY_MISSING_CONTEXT') return 'ASK_FOR_CLARIFICATION';
  const text = String(record.final_behavior ?? '');
  for (const rule of scoring.mixed_subjective_precedence) {
    if (rule.source === 'validated communication directive') continue;
    if (rule.pattern === null) return rule.class;
    if (typeof rule.pattern !== 'string') continue;
    if (new RegExp(rule.pattern, 'i').test(text)) return rule.class;
  }
  return 'OTHER';
}

for (const scenario of PRIMARY_SCENARIOS) {
  for (let scheduleIndex = 0; scheduleIndex < schedule.length; scheduleIndex += 1) {
    const key = `${scenario.id}/${scheduleIndex}`;
    if (completed.has(key)) continue;
    const condition = schedule[scheduleIndex];
    const replicate = Math.floor(scheduleIndex / 4);
    process.stdout.write(`START ${scenario.id}/${condition}/r${replicate}\n`);
    const cognitionStart = traces.cognition.length;
    const languageStart = traces.language.length;
    const result = await runCondition({
      snapshot,
      scenario,
      conditionId: condition,
      realTransport: cognition,
      realLanguageTransport: language,
      sessionId: `sess-remediation-ror-${scenario.id.toLowerCase()}-${condition.toLowerCase()}-${replicate}`
    });
    const row = {
      schema_version: 'affect-authority-remediation-run-record-v0',
      stage: 'RUN_OF_RECORD',
      freeze_hash: freeze.freeze_hash,
      scoring_freeze_sha256: sha256(scoringBytes),
      replicate,
      schedule_index: scheduleIndex,
      ...result,
      classification:
        scenario.role === 'AFFECT_RELEVANT' && result.status === 'COMPLETE'
          ? classifyAffectBehavior(result.final_behavior)
          : scenario.role === 'FACTUAL_CONTROL' && result.status === 'COMPLETE'
            ? classifyNullBehavior(scenario.expected, result.final_behavior)
            : null,
      mixed_fact_correct:
        scenario.role === 'MIXED_AUTHORITY' ? mixedFactCorrect(scenario, result.final_behavior) : null,
      mixed_subjective_class:
        scenario.role === 'MIXED_AUTHORITY' ? mixedSubjectiveClass(result) : null,
      cognition_trace: traces.cognition.slice(cognitionStart),
      language_trace: traces.language.slice(languageStart)
    };
    await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
    process.stdout.write(
      `DONE ${scenario.id}/${condition}/r${replicate} status=${row.status} schema=${row.stages.SCHEMA_VALID}\n`
    );
  }
}

const rawBytes = await readFile(partialPath, 'utf8');
const rows = rawBytes.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const expectedRows = PRIMARY_SCENARIOS.length * schedule.length;
if (rows.length !== expectedRows) throw new Error(`run incomplete: ${rows.length}/${expectedRows}`);
const languageRows = rows
  .filter((row) => row.raw_language_response !== null)
  .map((row) => ({
    schema_version: 'affect-authority-remediation-language-record-v0',
    scenario: row.scenario,
    condition: row.condition,
    replicate: row.replicate,
    schedule_index: row.schedule_index,
    raw_language_requests: row.raw_language_requests,
    raw_language_response: row.raw_language_response,
    language_trace: row.language_trace
  }));
const collection = {
  schema_version: 'affect-authority-remediation-collection-primary-v0',
  completed_at: new Date().toISOString(),
  freeze_hash: freeze.freeze_hash,
  scoring_freeze_sha256: sha256(scoringBytes),
  provider: { version: version.version, model: model.name, digest: model.digest },
  expected_records: expectedRows,
  recorded_records: rows.length,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0),
  language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0,
  transport_failures: rows.filter((row) => !row.stages.RAW_PROVIDER_RESPONSE).length,
  malformed_structured_outputs: rows.filter(
    (row) => row.stages.RAW_PROVIDER_RESPONSE && !row.stages.SCHEMA_VALID
  ).length,
  host_or_executor_rejections: rows.filter(
    (row) => row.stages.SCHEMA_VALID && !row.stages.EXECUTOR_ADMISSIBLE
  ).length,
  raw_cognition_sha256: sha256(rawBytes)
};
await rename(partialPath, finalPath);
await writeFile(languagePath, `${languageRows.map((row) => JSON.stringify(row)).join('\n')}\n`, { encoding: 'utf8', flag: 'wx' });
await writeFile(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${JSON.stringify(collection)}\n`);
