/* globals fetch, structuredClone */
/** Lawfully reached positive/negative Affect confirmation through the full production path. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractiveSubjectRuntimeV0,
  OllamaNativeCognitionTransportV0
} from '../../../packages/runtime/dist/index.js';
import {
  growSnapshot,
  runtimeOptions,
  stubCognitionTransport,
  validLanguageStub
} from '../phase-2-affect-authority-contract-revalidation-v0/lib/pipeline.mjs';
import { classifyAffectBehavior } from '../phase-2-affect-authority-contract-revalidation-v0/lib/classify.mjs';
import { PROVIDER } from './lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, 'lawful-confirmation.json');
const freeze = JSON.parse(await readFile(resolve(here, 'freeze.json'), 'utf8'));
const version = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const model = tags.models.find((entry) => entry.name === PROVIDER.model);
if (model?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');

const REPLICATES = 5;
const SCENARIO = Object.freeze({
  id: 'S1_AMBIGUOUS_REQUEST',
  role: 'AFFECT_RELEVANT',
  event: 'Alice asks: "Would you be up for taking on the additional review this week?"'
});
const HISTORIES = Object.freeze({
  LAWFUL_POS: Object.freeze([
    'That worked exactly as I hoped. Thank you.',
    'This helped a lot — well done.',
    'That was useful and it worked well.',
    'Thanks, that went well.'
  ]),
  LAWFUL_NEG: Object.freeze([
    "Please don't do that again; it caused a problem.",
    'That failed and made things harder.',
    "That didn't work and made things worse.",
    'Please stop — this is a problem.'
  ])
});

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

const states = {};
for (const [stateId, events] of Object.entries(HISTORIES)) {
  const snapshot = await growSnapshot(events);
  const persistedAffect = structuredClone(snapshot.durable.identity.affect);
  const restored = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(stubCognitionTransport(), `sess-remediation-lawful-restore-${stateId}`, validLanguageStub()),
    structuredClone(snapshot)
  );
  const restoredStatus = await restored.status();
  const roundTrip = {
    persisted_affect: persistedAffect,
    restored_affect: restoredStatus.affect,
    equal:
      persistedAffect.valence === restoredStatus.affect.valence &&
      persistedAffect.activation === restoredStatus.affect.activation
  };
  if (!roundTrip.equal) throw new Error(`${stateId}: AFFECT_ROUND_TRIP_FAILED`);

  const records = [];
  for (let replicate = 0; replicate < REPLICATES; replicate += 1) {
    const cognitionStart = traces.cognition.length;
    const languageStart = traces.language.length;
    const record = await runCondition({
      snapshot,
      scenario: SCENARIO,
      conditionId: null,
      realTransport: cognition,
      realLanguageTransport: language,
      sessionId: `sess-remediation-lawful-${stateId.toLowerCase()}-r${replicate}`
    });
    records.push({
      replicate,
      ...record,
      class:
        record.status === 'COMPLETE' && record.final_behavior !== null
          ? classifyAffectBehavior(record.final_behavior)
          : null,
      cognition_trace: traces.cognition.slice(cognitionStart),
      language_trace: traces.language.slice(languageStart)
    });
    process.stdout.write(
      `DONE ${stateId}/r${replicate} status=${record.status} schema=${record.stages.SCHEMA_VALID}\n`
    );
  }
  states[stateId] = {
    history_events: events,
    round_trip: roundTrip,
    memory_differs_by_design: true,
    affect_line_at_cognition: records[0]?.request_attestation?.affect_section ?? null,
    cognition_calls: records.reduce((sum, record) => sum + record.cognition_calls, 0),
    language_calls: records.reduce((sum, record) => sum + record.language_calls, 0),
    delivered: records.filter((record) => record.stages.FINAL_BEHAVIOR).length,
    schema_valid: records.filter((record) => record.stages.SCHEMA_VALID).length,
    executor_valid: records.filter((record) => record.stages.EXECUTOR_ADMISSIBLE).length,
    language_valid: records.filter((record) => record.stages.LANGUAGE_ADMISSIBLE).length,
    records
  };
}

const artifact = {
  schema_version: 'affect-authority-remediation-lawful-confirmation-v0',
  captured_at: new Date().toISOString(),
  immutable_after_capture: true,
  freeze_hash: freeze.freeze_hash,
  provider: { version: version.version, model: model.name, digest: model.digest },
  scenario: SCENARIO,
  replicates_per_state: REPLICATES,
  total_cognition_calls: Object.values(states).reduce((sum, state) => sum + state.cognition_calls, 0),
  total_language_calls: Object.values(states).reduce((sum, state) => sum + state.language_calls, 0),
  infrastructure_retries: 0,
  states
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${JSON.stringify({
  total_cognition_calls: artifact.total_cognition_calls,
  total_language_calls: artifact.total_language_calls,
  states: Object.fromEntries(
    Object.entries(states).map(([id, state]) => [id, {
      round_trip: state.round_trip.equal,
      affect: state.round_trip.restored_affect,
      delivered: state.delivered,
      schema_valid: state.schema_valid,
      executor_valid: state.executor_valid,
      classes: state.records.map((record) => record.class)
    }])
  )
}, null, 2)}\n`);
