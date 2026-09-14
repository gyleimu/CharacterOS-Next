/* globals fetch, structuredClone */
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InteractiveSubjectRuntimeV0, OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { PROVIDER } from './lib/config.mjs';
import { classifyRecord } from './lib/classify.mjs';
import { growSnapshot, runCondition, runtimeOptions, stubCognitionTransport, stubLanguageTransport } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const freeze = JSON.parse(await readFile(resolve(here, 'lawful-freeze.json'), 'utf8'));
const withoutHash = { ...freeze }; delete withoutHash.freeze_hash;
if (hashJson(withoutHash) !== freeze.freeze_hash || !freeze.frozen_before_lawful_model_calls) throw new Error('LAWFUL_FREEZE_INVALID');
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
if (tags.models.find((entry) => entry.name === PROVIDER.model)?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const traces = { cognition: [], language: [] };
const transport = (bucket, numPredict) => new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url, model: PROVIDER.model, timeout_ms: PROVIDER.timeout_ms, num_predict: numPredict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: (event) => { if (!('stage' in event)) traces[bucket].push(event); }
});
const cognition = transport('cognition', PROVIDER.cognition_num_predict);
const language = transport('language', PROVIDER.language_num_predict);
const states = {};
for (const [stateId, events] of Object.entries(freeze.histories)) {
  const snapshot = await growSnapshot(events);
  const persisted = structuredClone(snapshot.durable.identity.affect);
  const restored = await InteractiveSubjectRuntimeV0.restore(runtimeOptions(stubCognitionTransport(), `c2-${randomUUID()}`, stubLanguageTransport()), structuredClone(snapshot));
  const restoredStatus = await restored.status();
  const roundTrip = { persisted_affect: persisted, restored_affect: restoredStatus.affect, equal: persisted.valence === restoredStatus.affect.valence && persisted.activation === restoredStatus.affect.activation };
  if (!roundTrip.equal) throw new Error(`${stateId}: AFFECT_ROUND_TRIP_FAILED`);
  const records = [];
  for (let replicate = 0; replicate < 5; replicate += 1) {
    const cognitionStart = traces.cognition.length; const languageStart = traces.language.length;
    const record = await runCondition({ snapshot, scenario: freeze.scenario, conditionId: null, cognitionTransport: cognition, languageTransport: language, sessionId: freeze.opaque_session_ids[stateId][replicate] });
    records.push({ replicate, ...record, classification: classifyRecord(freeze.scenario, record), cognition_trace: traces.cognition.slice(cognitionStart), language_trace: traces.language.slice(languageStart) });
    process.stdout.write(`LAWFUL ${stateId}/${replicate} status=${record.status} pass=${records.at(-1).classification.pass}\n`);
  }
  states[stateId] = { history_events: events, memory_differs_by_design: true, round_trip: roundTrip, records,
    cognition_calls: records.reduce((sum, row) => sum + row.cognition_calls, 0), language_calls: records.reduce((sum, row) => sum + row.language_calls, 0), passed: records.filter((row) => row.classification.pass).length };
}
const artifact = {
  schema_version: 'affect-cognition-c2-lawful-confirmation-v0', freeze_hash: freeze.freeze_hash, provider_digest: PROVIDER.required_digest,
  total_cognition_calls: Object.values(states).reduce((sum, state) => sum + state.cognition_calls, 0),
  total_language_calls: Object.values(states).reduce((sum, state) => sum + state.language_calls, 0), infrastructure_retries: 0, states
};
await writeFile(resolve(here, 'lawful-confirmation.json'), `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ cognition_calls: artifact.total_cognition_calls, language_calls: artifact.total_language_calls, states: Object.fromEntries(Object.entries(states).map(([id, value]) => [id, { affect: value.round_trip.restored_affect, round_trip: value.round_trip.equal, passed: value.passed }])) }, null, 2)}\n`);

