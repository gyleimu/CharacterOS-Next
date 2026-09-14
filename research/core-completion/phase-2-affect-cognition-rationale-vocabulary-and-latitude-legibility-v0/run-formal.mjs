/* globals fetch */
/**
 * AFFECT_COGNITION_C4_SELECTION_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 —
 * formal matrix collector (476 cells).
 *
 * RUN ONLY IF QUALIFICATION = 65/65. This slice's qualification reached 55/65, so
 * the collector must refuse: `FORMAL_BLOCKED_QUALIFICATION_GATE`. It is kept so the
 * next slice can exercise the frozen matrix without redesigning it.
 */
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { FORMAL_REPLICATES, FORMAL_SCENARIOS, LANGUAGE_CONNECTORS, PROVIDER, conditionSchedule } from './lib/config.mjs';
import { classifyRecord } from './lib/classify.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const partialPath = resolve(here, 'raw-formal.partial.jsonl');
const finalPath = resolve(here, 'raw-cognition.jsonl');
const exists = (path) => stat(path).then(() => true, () => false);
if (await exists(finalPath)) throw new Error('immutable formal evidence already exists');

const qualification = JSON.parse(await readFile(resolve(here, 'qualification-summary.json'), 'utf8'));
if (qualification.all_qualification_passed !== true) {
  throw new Error(`FORMAL_BLOCKED_QUALIFICATION_GATE: ${qualification.passed}/${qualification.total}`);
}
const freeze = JSON.parse(await readFile(resolve(here, 'formal-freeze.json'), 'utf8'));
const withoutHash = { ...freeze }; delete withoutHash.freeze_hash;
if (hashJson(withoutHash) !== freeze.freeze_hash || !freeze.created_before_model_calls) throw new Error('FORMAL_FREEZE_INVALID');
for (const [key, file] of [['classify_sha256', 'lib/classify.mjs'], ['pipeline_sha256', 'lib/pipeline.mjs'], ['config_sha256', 'lib/config.mjs']]) {
  if (sha256(await readFile(resolve(here, file), 'utf8')) !== freeze.harness[key]) throw new Error(`HARNESS_CHANGED_AFTER_FREEZE: ${file}`);
}
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
const completed = new Set(prior.map((row) => `${row.scenario}/${row.condition}/${row.replicate}`));
let ordinal = prior.length;
let issued = 0;
let skipped = 0;

for (const scenario of FORMAL_SCENARIOS) {
  for (let replicate = 0; replicate < FORMAL_REPLICATES; replicate += 1) {
    const schedule = conditionSchedule(replicate);
    for (let slot = 0; slot < schedule.length; slot += 1) {
      const condition = schedule[slot];
      const key = `${scenario.id}/${condition}/${replicate}`;
      if (completed.has(key)) { skipped += 1; continue; }
      const cognitionStart = traces.cognition.length;
      const languageStart = traces.language.length;
      const record = await runCondition({
        snapshot, scenario, conditionId: condition, cognitionTransport: cognition, languageTransport: language,
        sessionId: freeze.opaque_session_ids[scenario.id][replicate]
      });
      const row = {
        phase: 'FORMAL', ordinal, replicate, schedule_slot: slot, provider_digest: PROVIDER.required_digest,
        ...record, classification: classifyRecord(scenario, record, LANGUAGE_CONNECTORS),
        cognition_trace: traces.cognition.slice(cognitionStart), language_trace: traces.language.slice(languageStart)
      };
      await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
      ordinal += 1; issued += 1;
      process.stdout.write(`FORMAL ${ordinal}/476 ${key} status=${row.status} pass=${row.classification.pass} tag=${row.classification.applicability} stage=${row.failure_stage ?? 'FINAL'}\n`);
    }
  }
}

const rows = (await readFile(partialPath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
if (rows.length !== freeze.call_budget.formal) throw new Error(`formal count ${rows.length}/${freeze.call_budget.formal}`);
await rename(partialPath, finalPath);
await writeFile(
  resolve(here, 'raw-language.jsonl'),
  `${rows.filter((row) => row.raw_language_request !== null).map((row) => JSON.stringify({ scenario: row.scenario, condition: row.condition, replicate: row.replicate, request: row.raw_language_request, response: row.raw_language_response, leakage: row.language_leakage })).join('\n')}\n`,
  { flag: 'wx' }
);
const summary = {
  schema_version: 'affect-cognition-rationale-vocabulary-formal-collection-v0', freeze_hash: freeze.freeze_hash, status: 'COMPLETE',
  formal_cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0),
  formal_language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0, issued, skipped,
  decoded_pass: rows.filter((row) => row.classification.pass).length, total: rows.length
};
await writeFile(resolve(here, 'formal-collection.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
