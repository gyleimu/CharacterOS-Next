/* globals fetch, URL */
/**
 * Structural preflight (NOT evidence): a very small bounded real-call set that
 * establishes the V2 protocol works end to end before the run of record.
 *
 * Usage: node preflight.mjs
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mkdirSync, writeFileSync } from 'node:fs';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { PROVIDER } from './lib/config.mjs';
import { growSnapshot, runCondition } from './lib/pipeline.mjs';
import { HISTORY_EVENTS, PRIMARY_SCENARIOS } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

async function main() {
  const response = await fetch(`${PROVIDER.base_url}/api/tags`);
  const body = await response.json();
  const model = (body.models ?? []).find((e) => e.name === PROVIDER.model);
  if (model?.digest !== PROVIDER.required_digest) throw new Error(`provider/digest not ready: ${model?.digest}`);

  const snapshot = await growSnapshot(HISTORY_EVENTS);
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

  const plan = [
    { id: 'S1_AMBIGUOUS_REQUEST', condition: 'P' },
    { id: 'S1_AMBIGUOUS_REQUEST', condition: 'N' },
    { id: 'N1', condition: 'Z' },
    { id: 'N2', condition: 'A' }
  ];
  const results = [];
  for (const step of plan) {
    const scenario = PRIMARY_SCENARIOS.find((s) => s.id === step.id);
    const record = await runCondition({
      snapshot,
      scenario,
      conditionId: step.condition,
      realTransport: cognition,
      realLanguageTransport: language,
      sessionId: `sess-preflight-${step.id}-${step.condition}`
    });
    results.push({
      scenario: step.id,
      condition: step.condition,
      stages: record.stages,
      directive: record.directive,
      language_calls: record.language_calls,
      final_behavior: record.final_behavior,
      failure_stage: record.failure_stage,
      failure_detail: record.failure_detail,
      attestation_ok: record.attestation?.ok ?? null
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  writeFileSync(join(evidenceDir, 'preflight.json'), `${JSON.stringify({ provider: model.digest, results }, null, 2)}\n`);
  const allReached = results.every((r) => r.stages.FINAL_BEHAVIOR && r.attestation_ok !== false);
  console.log(`PREFLIGHT_${allReached ? 'PASS' : 'FAIL'}`);
  if (!allReached) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
