/* globals URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — lawful persistent snapshot confirmation
 * (ecological, secondary).
 *
 * Produces REAL canonical Affect through the lawful Appraisal → AffectApplication
 * path, persists, restores fresh (proving the Affect round-trip), renders the
 * production cognition request for the scenario, and issues REAL cognition calls.
 * Memory necessarily differs from the counterfactual base, so this is an
 * ecological confirmation, not a causal isolation.
 *
 * Usage: node lawful.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0, OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { PROVIDER, SCENARIOS } from './lib/config.mjs';
import { sha256, memorySection } from './lib/hash.mjs';
import { classifyEndpoints, distribution } from './lib/classify.mjs';
import { parseConversationProposal } from './lib/proposal.mjs';
import { growSnapshot, captureScenarioRequest, runtimeOptions } from './lib/world.mjs';
import { stubCognitionTransport } from './lib/transports.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
const lawfulDir = join(evidenceDir, 'lawful');
mkdirSync(lawfulDir, { recursive: true });

const REPLICATES = 5;
const SCENARIO = SCENARIOS.find((s) => s.id === 'S1_AMBIGUOUS_REQUEST');

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

const realTransport = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.cognition_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens,
  trace_observer: () => {}
});

async function main() {
  const records = [];
  const roundTrips = {};
  for (const [stateId, events] of Object.entries(HISTORIES)) {
    const snapshot = await growSnapshot(events);
    writeFileSync(join(lawfulDir, `${stateId}.json`), `${JSON.stringify(snapshot)}\n`);
    const persistedAffect = snapshot.durable.identity.affect;

    // Fresh-process-style restore from the serialized snapshot, then verify the
    // Affect round-trip BEFORE any cognition.
    const verifyRuntime = await InteractiveSubjectRuntimeV0.restore(
      runtimeOptions(stubCognitionTransport(), `sess-lawful-verify-${stateId}`),
      JSON.parse(JSON.stringify(snapshot))
    );
    const restoredStatus = await verifyRuntime.status();
    roundTrips[stateId] = {
      origin: restoredStatus.origin,
      persisted_affect: persistedAffect,
      restored_affect: restoredStatus.affect,
      affect_round_trip_equal:
        persistedAffect.valence === restoredStatus.affect.valence &&
        persistedAffect.activation === restoredStatus.affect.activation
    };
    if (!roundTrips[stateId].affect_round_trip_equal) {
      throw new Error(`${stateId}: Affect did not round-trip through restore`);
    }

    // Production-rendered request from the LAWFUL state (stub; no real call).
    const capture = await captureScenarioRequest(snapshot, SCENARIO, `sess-lawful-capture-${stateId}`);
    const affectLine = /^\[affect \(canonical\)\][^\n]*$/m.exec(capture.userContent)?.[0] ?? null;

    for (let replicate = 0; replicate < REPLICATES; replicate += 1) {
      const response = await realTransport.complete({
        messages: [
          { role: 'system', content: capture.systemContent },
          { role: 'user', content: capture.userContent }
        ]
      });
      const parsed = parseConversationProposal(response.content, capture.projectionHash);
      records.push({
        state: stateId,
        scenario: SCENARIO.id,
        replicate,
        schema_valid: parsed.ok,
        directive: parsed.ok ? parsed.proposal.communication_directive.kind : null,
        current_intent: parsed.ok ? parsed.proposal.cognition.current_intent : null,
        behavior_class: parsed.ok
          ? classifyEndpoints(SCENARIO, parsed.proposal.communication_directive.kind, parsed.proposal.cognition.current_intent)
          : null,
        affect_persisted: persistedAffect,
        affect_line_at_cognition: affectLine,
        memory_section_sha256: sha256(memorySection(capture.userContent)),
        raw_response: response.content,
        parse_error: parsed.ok ? null : parsed.error
      });
    }
  }

  const valid = records.filter((record) => record.schema_valid);
  const perState = {};
  for (const stateId of Object.keys(HISTORIES)) {
    const stateRecords = valid.filter((record) => record.state === stateId);
    perState[stateId] = {
      affect_line_at_cognition: stateRecords[0]?.affect_line_at_cognition ?? null,
      ...distribution(stateRecords.map((record) => record.behavior_class), SCENARIO.classes)
    };
  }
  writeFileSync(
    join(evidenceDir, 'lawful-snapshot-confirmation.json'),
    `${JSON.stringify(
      {
        schema_version: 'affect-causal-lawful-confirmation-v0',
        method: 'lawful canonical Affect produced by Appraisal→AffectApplication, persisted, restored, then the production-rendered request is issued to the real provider',
        replicates_per_state: REPLICATES,
        round_trips: roundTrips,
        per_state: perState,
        records
      },
      null,
      2
    )}\n`
  );
  console.log(JSON.stringify({ roundTrips, per_state: perState, calls: records.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
