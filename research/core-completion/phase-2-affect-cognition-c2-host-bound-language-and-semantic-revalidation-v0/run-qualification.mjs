/* globals fetch */
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { PROVIDER, QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS } from './lib/config.mjs';
import { classifyRecord } from './lib/classify.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const partialPath = resolve(here, 'qualification-raw.partial.jsonl');
const finalPath = resolve(here, 'qualification-raw.jsonl');
const exists = (path) => stat(path).then(() => true, () => false);
if (await exists(finalPath)) throw new Error('immutable qualification evidence already exists');
const freeze = JSON.parse(await readFile(resolve(here, 'qualification-freeze.json'), 'utf8'));
const withoutHash = { ...freeze }; delete withoutHash.freeze_hash;
if (hashJson(withoutHash) !== freeze.freeze_hash || !freeze.created_before_model_calls) throw new Error('QUALIFICATION_FREEZE_INVALID');
const snapshot = JSON.parse(await readFile(resolve(here, 'snapshot.json'), 'utf8'));
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
if (tags.models.find((entry) => entry.name === PROVIDER.model)?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const traces = { cognition: [], language: [] };
const transport = (bucket, numPredict) => new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url, model: PROVIDER.model, timeout_ms: PROVIDER.timeout_ms,
  num_predict: numPredict, context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => { if (!('stage' in event)) traces[bucket].push(event); }
});
const cognition = transport('cognition', PROVIDER.cognition_num_predict);
const language = transport('language', PROVIDER.language_num_predict);
const prior = (await exists(partialPath)) ? (await readFile(partialPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
const completed = new Set(prior.map((row) => `${row.scenario}/${row.replicate}`));
let ordinal = prior.length;
for (const scenario of QUALIFICATION_SCENARIOS) {
  for (let replicate = 0; replicate < QUALIFICATION_REPLICATES; replicate += 1) {
    const key = `${scenario.id}/${replicate}`; if (completed.has(key)) continue;
    const cognitionStart = traces.cognition.length; const languageStart = traces.language.length;
    const record = await runCondition({ snapshot, scenario, conditionId: 'A', cognitionTransport: cognition, languageTransport: language, sessionId: freeze.opaque_session_ids[scenario.id][replicate] });
    const row = {
      phase: 'QUALIFICATION', ordinal, replicate, provider_digest: PROVIDER.required_digest, ...record,
      classification: classifyRecord(scenario, record), cognition_trace: traces.cognition.slice(cognitionStart), language_trace: traces.language.slice(languageStart)
    };
    await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
    ordinal += 1;
    process.stdout.write(`QUAL ${ordinal}/65 ${key} status=${row.status} pass=${row.classification.pass} stage=${row.failure_stage ?? 'FINAL'}\n`);
  }
}
const rows = (await readFile(partialPath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
if (rows.length !== 65) throw new Error(`qualification count ${rows.length}/65`);
await rename(partialPath, finalPath);
const perScenario = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => {
  const selected = rows.filter((row) => row.scenario === scenario.id);
  return [scenario.id, { passed: selected.filter((row) => row.classification.pass).length, total: selected.length, failures: selected.filter((row) => !row.classification.pass).map((row) => ({ replicate: row.replicate, stage: row.failure_stage, classification: row.classification, final_behavior: row.final_behavior })) }];
}));
const summary = {
  schema_version: 'affect-cognition-c2-qualification-summary-v0', freeze_hash: freeze.freeze_hash,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0), language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0, passed: rows.filter((row) => row.classification.pass).length, total: rows.length,
  all_qualification_passed: rows.every((row) => row.classification.pass), per_scenario: perScenario
};
await writeFile(resolve(here, 'qualification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-raw-language.jsonl'), `${rows.filter((row) => row.raw_language_request !== null).map((row) => JSON.stringify({ scenario: row.scenario, replicate: row.replicate, request: row.raw_language_request, response: row.raw_language_response, leakage: row.language_leakage })).join('\n')}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

