/** Two-cell production-path preflight. Not run-of-record evidence. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { classifyNullBehavior } from '../phase-2-affect-authority-contract-revalidation-v0/lib/classify.mjs';
import { AFFECT_SCENARIOS, NULL_SCENARIOS, PROVIDER } from './lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, 'preflight.json');
const snapshot = JSON.parse(await readFile(resolve(here, 'snapshot.json'), 'utf8'));
const freeze = JSON.parse(await readFile(resolve(here, 'freeze.json'), 'utf8'));
const traces = { cognition: [], language: [] };
const makeTransport = (target) => new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.cognition_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => {
    if (!('stage' in event)) traces[target].push(event);
  }
});
const cognition = makeTransport('cognition');
const language = makeTransport('language');
const cells = [
  { scenario: AFFECT_SCENARIOS.find((entry) => entry.id === 'S1_AMBIGUOUS_REQUEST'), condition: 'Z' },
  { scenario: NULL_SCENARIOS.find((entry) => entry.id === 'N4'), condition: 'A' }
];
const records = [];
for (const cell of cells) {
  if (cell.scenario === undefined) throw new Error('preflight scenario missing');
  const cognitionStart = traces.cognition.length;
  const languageStart = traces.language.length;
  process.stdout.write(`START ${cell.scenario.id}/${cell.condition}\n`);
  const result = await runCondition({
    snapshot,
    scenario: cell.scenario,
    conditionId: cell.condition,
    realTransport: cognition,
    realLanguageTransport: language,
    sessionId: `sess-remediation-preflight-${cell.scenario.id.toLowerCase()}-${cell.condition.toLowerCase()}`
  });
  records.push({
    ...result,
    cognition_trace: traces.cognition.slice(cognitionStart),
    language_trace: traces.language.slice(languageStart),
    objective_correct:
      cell.scenario.role !== 'FACTUAL_CONTROL'
        ? null
        : classifyNullBehavior(cell.scenario.expected, result.final_behavior) === `CORRECT_${cell.scenario.expected}`
  });
}
const pass = records.every((record) =>
  Object.values(record.stages).every(Boolean) &&
  record.cognition_calls === 1 &&
  record.request_attestation?.ok === true &&
  (record.objective_correct ?? true)
);
const artifact = {
  schema_version: 'affect-authority-remediation-preflight-v0',
  run_of_record_evidence: false,
  freeze_hash: freeze.freeze_hash,
  pass,
  cognition_calls: records.reduce((sum, record) => sum + record.cognition_calls, 0),
  language_calls: records.reduce((sum, record) => sum + record.language_calls, 0),
  records
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
if (!pass) throw new Error('STRUCTURED_OUTPUT_REMEDIATION_BLOCKED: production preflight failed');
process.stdout.write(`${JSON.stringify({ pass, cognition_calls: artifact.cognition_calls, language_calls: artifact.language_calls })}\n`);
