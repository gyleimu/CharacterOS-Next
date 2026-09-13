/* globals fetch, URL */
/**
 * Revalidation live collection (REAL provider). Runs the unmodified production
 * runtime with the condition applied at the transport boundary; the endpoint is
 * the final production-admissible observable behavior.
 *
 * Usage: node run.mjs primary|activation [--fresh]
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  ACTIVATION_SCENARIO_IDS,
  PRIMARY_SCENARIOS,
  PROVIDER,
  REPLICATES,
  activationSchedule,
  primarySchedule
} from './lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });
const rawPath = join(evidenceDir, 'raw-cognition.jsonl');
const stage = process.argv[2];
const fresh = process.argv.includes('--fresh');
if (!['primary', 'activation'].includes(stage)) {
  console.error('usage: node run.mjs primary|activation [--fresh]');
  process.exit(2);
}
const readJson = (name) => JSON.parse(readFileSync(join(evidenceDir, name), 'utf8'));

async function verifyProvider() {
  const response = await fetch(`${PROVIDER.base_url}/api/tags`);
  const body = await response.json();
  const model = (body.models ?? []).find((entry) => entry.name === PROVIDER.model);
  if (model === undefined) throw new Error(`model unavailable`);
  if (model.digest !== PROVIDER.required_digest) throw new Error(`digest mismatch: ${model.digest}`);
  return model.digest;
}

function plan() {
  if (stage === 'primary') {
    return PRIMARY_SCENARIOS.map((scenario) => ({ scenario, schedule: primarySchedule(REPLICATES), activation: false }));
  }
  return ACTIVATION_SCENARIO_IDS.map((id) => ({
    scenario: PRIMARY_SCENARIOS.find((s) => s.id === id),
    schedule: activationSchedule(REPLICATES),
    activation: true
  }));
}

async function main() {
  const freeze = readJson('freeze.json');
  const { freeze_hash: recorded, ...body } = freeze;
  if (recorded !== hashJson(body)) throw new Error('freeze.json hash mismatch — artifact edited');
  const digest = await verifyProvider();
  const snapshot = readJson('snapshot.json');
  const perCondition = stage === 'primary' ? 4 : 2;

  const realCognition = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.cognition_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens,
    trace_observer: () => {}
  });
  const realLanguage = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.language_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens,
    trace_observer: () => {}
  });

  // Bounded warm-up outside recorded evidence.
  const warmup = { stage, cognition: 0, language: 0 };
  const warmScenario = plan()[0];
  try {
    const record = await runCondition({
      snapshot,
      scenario: warmScenario.scenario,
      conditionId: warmScenario.schedule[0],
      realTransport: realCognition,
      realLanguageTransport: realLanguage,
      sessionId: `sess-authority-warmup-${stage}`,
      activation: warmScenario.activation
    });
    warmup.cognition += 1;
    warmup.language += record.language_calls;
  } catch (error) {
    warmup.error = String(error);
  }
  writeFileSync(join(evidenceDir, `warmup-${stage}.json`), `${JSON.stringify(warmup, null, 2)}\n`);

  const seen = new Set();
  if (!fresh && existsSync(rawPath)) {
    for (const line of readFileSync(rawPath, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const record = JSON.parse(line);
      if (record.stage === stage) seen.add(`${record.scenario}|${record.condition}|${record.replicate}`);
    }
  } else if (fresh) {
    writeFileSync(rawPath, '');
  }

  let issued = 0;
  let skipped = 0;
  for (const { scenario, schedule, activation } of plan()) {
    for (let index = 0; index < schedule.length; index += 1) {
      const conditionId = schedule[index];
      const replicate = Math.floor(index / perCondition);
      const key = `${scenario.id}|${conditionId}|${replicate}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      const record = await runCondition({
        snapshot,
        scenario,
        conditionId,
        realTransport: realCognition,
        realLanguageTransport: realLanguage,
        sessionId: `sess-authority-${stage}-${scenario.id}-${conditionId}-${replicate}`,
        activation
      });
      appendFileSync(rawPath, `${JSON.stringify({ stage, replicate, schedule_index: index, ...record })}\n`);
      issued += 1;
      const mark = record.stages.FINAL_BEHAVIOR ? 'FINAL' : `STOP@${record.failure_stage}`;
      console.log(
        `[${stage}] ${scenario.id} ${conditionId} r${replicate} -> ${mark} ${JSON.stringify(record.final_behavior ?? record.failure_detail)} lang=${record.language_calls}`
      );
    }
  }
  writeFileSync(
    join(evidenceDir, `collection-${stage}.json`),
    `${JSON.stringify({ stage, digest, issued, skipped, warmup }, null, 2)}\n`
  );
  console.log(`[${stage}] issued=${issued} skipped=${skipped} warmup=${JSON.stringify(warmup)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
