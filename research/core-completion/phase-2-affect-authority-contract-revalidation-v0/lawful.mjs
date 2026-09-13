/* globals URL */
/**
 * Lawful persistent snapshot confirmation (full production validation).
 *
 * Lawfully reached positive/negative states are persisted, restored fresh
 * (Affect round-trip proven BEFORE cognition), then the SAME scenario is run
 * through the complete production pipeline (executor + language) with NO research
 * mutation. Parser validity, executor admissibility, language admissibility and
 * final behavior are staged separately.
 *
 * Memory differs between lawful paths (ecological confirmation ≠ causal
 * isolation). Usage: node lawful.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0, OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { growSnapshot, runCondition, runtimeOptions, stubCognitionTransport, validLanguageStub } from './lib/pipeline.mjs';
import { PROVIDER } from './lib/config.mjs';
import { classifyAffectBehavior } from './lib/classify.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const REPLICATES = 5;
const SCENARIO = { id: 'S1_AMBIGUOUS_REQUEST', role: 'AFFECT_RELEVANT', event: 'Alice asks: "Would you be up for taking on the additional review this week?"' };

const HISTORIES = {
  LAWFUL_POS: [
    'That worked exactly as I hoped. Thank you.',
    'This helped a lot — well done.',
    'That was useful and it worked well.',
    'Thanks, that went well.'
  ],
  LAWFUL_NEG: [
    "Please don't do that again; it caused a problem.",
    'That failed and made things harder.',
    "That didn't work and made things worse.",
    'Please stop — this is a problem.'
  ]
};

async function main() {
  const cognition = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.cognition_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens,
    trace_observer: () => {}
  });
  const language = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.language_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens,
    trace_observer: () => {}
  });

  const states = {};
  for (const [stateId, events] of Object.entries(HISTORIES)) {
    const snapshot = await growSnapshot(events);
    const persistedAffect = snapshot.durable.identity.affect;
    const verify = await InteractiveSubjectRuntimeV0.restore(
      runtimeOptions(stubCognitionTransport(), `sess-lawful-verify-${stateId}`, validLanguageStub()),
      JSON.parse(JSON.stringify(snapshot))
    );
    const restoredStatus = await verify.status();
    const roundTrip = {
      persisted_affect: persistedAffect,
      restored_affect: restoredStatus.affect,
      equal: persistedAffect.valence === restoredStatus.affect.valence && persistedAffect.activation === restoredStatus.affect.activation
    };
    if (!roundTrip.equal) throw new Error(`${stateId}: Affect did not round-trip`);
    const records = [];
    for (let replicate = 0; replicate < REPLICATES; replicate += 1) {
      const record = await runCondition({
        snapshot,
        scenario: SCENARIO,
        conditionId: null,
        realTransport: cognition,
        realLanguageTransport: language,
        sessionId: `sess-lawful-${stateId}-r${replicate}`
      });
      records.push({
        replicate,
        stages: record.stages,
        directive: record.directive,
        language_calls: record.language_calls,
        request_affect_line: record.request_affect_line,
        final_behavior: record.final_behavior,
        class: record.final_behavior === null ? null : classifyAffectBehavior(record.final_behavior),
        failure_stage: record.failure_stage,
        failure_detail: record.failure_detail
      });
      console.log(`[lawful] ${stateId} r${replicate} -> ${record.final_behavior !== null ? 'FINAL' : `STOP@${record.failure_stage}`} ${JSON.stringify(record.final_behavior)}`);
    }
    states[stateId] = {
      round_trip: roundTrip,
      affect_line_at_cognition: records[0]?.request_affect_line ?? null,
      replicates: records,
      delivered: records.filter((r) => r.stages.FINAL_BEHAVIOR).length,
      executor_valid: records.filter((r) => r.stages.EXECUTOR_ADMISSIBLE).length,
      language_valid: records.filter((r) => r.stages.LANGUAGE_ADMISSIBLE).length
    };
  }
  writeFileSync(join(evidenceDir, 'lawful-confirmation.json'), `${JSON.stringify({ schema_version: 'affect-authority-lawful-v0', replicates_per_state: REPLICATES, states }, null, 2)}\n`);
  const compact = {};
  for (const [k, v] of Object.entries(states)) {
    compact[k] = {
      round_trip: v.round_trip.equal,
      affect_line: v.affect_line_at_cognition,
      delivered: v.delivered,
      executor_valid: v.executor_valid,
      classes: v.replicates.map((r) => r.class)
    };
  }
  console.log(JSON.stringify(compact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
