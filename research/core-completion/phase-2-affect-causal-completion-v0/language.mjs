/* globals URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — language realization evidence (≤ 20 real calls).
 *
 * Selects the majority-class representative and one boundary case per condition
 * (from the frozen Stage-1 records), replays the exact validated cognition
 * response through the production lifecycle, and lets the REAL production
 * language path realize behavior. No new cognition decisions are introduced.
 *
 * Usage: node language.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0, OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { PROVIDER, SCENARIOS } from './lib/config.mjs';
import { sha256 } from './lib/hash.mjs';
import { classifyEndpoints } from './lib/classify.mjs';
import { fixedCognitionTransport, recordingCognitionTransport } from './lib/transports.mjs';
import { runtimeOptions } from './lib/world.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const MAX_LANGUAGE_CALLS = 20;
const CONDITIONS = ['P', 'N', 'Z', 'A'];
const STAGE1_IDS = ['S1_AMBIGUOUS_REQUEST', 'N1_ARITHMETIC'];
const STAGE2_IDS = ['S2_SOCIAL_INTERPRETATION', 'S3_UNCERTAIN_RECOMMENDATION', 'S4_BOUNDARY_WILLINGNESS'];
const scenarioId = process.argv[2] ?? 'S1_AMBIGUOUS_REQUEST';
if (![...STAGE1_IDS, ...STAGE2_IDS].includes(scenarioId)) {
  console.error(`usage: node language.mjs [${[...STAGE1_IDS, ...STAGE2_IDS].join('|')}]`);
  process.exit(2);
}

function readJson(name) {
  return JSON.parse(readFileSync(join(evidenceDir, name), 'utf8'));
}

function validRecordsFor(records, scenarioId, conditionId) {
  return records.filter(
    (record) =>
      record.scenario === scenarioId &&
      record.condition === conditionId &&
      record.activation_experiment !== true &&
      record.schema_valid === true
  );
}

/** Majority representative + one boundary (different class) per condition. */
function selectRecords(records, scenario) {
  const selections = [];
  for (const conditionId of CONDITIONS) {
    const valid = validRecordsFor(records, scenario.id, conditionId);
    if (valid.length === 0) continue;
    const classes = valid.map((record) => classifyEndpoints(scenario, record.directive, record.current_intent));
    const counts = {};
    for (const cls of classes) counts[cls] = (counts[cls] ?? 0) + 1;
    const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const majorityIndex = classes.indexOf(majority);
    selections.push({ role: 'MAJORITY', condition: conditionId, record: valid[majorityIndex], behavior_class: majority });
    const boundaryIndex = classes.findIndex((cls) => cls !== majority);
    if (boundaryIndex >= 0) {
      selections.push({ role: 'BOUNDARY', condition: conditionId, record: valid[boundaryIndex], behavior_class: classes[boundaryIndex] });
    }
  }
  return selections.slice(0, MAX_LANGUAGE_CALLS);
}

async function main() {
  if (!existsSync(join(evidenceDir, 'raw-cognition.jsonl'))) throw new Error('no recorded cognition yet');
  const records = readFileSync(join(evidenceDir, 'raw-cognition.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
  const snapshot = readJson('snapshot.json');

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  const selections = selectRecords(records, scenario);

  const languageTransport = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.language_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens
  });

  const results = [];
  for (const selection of selections) {
    const languageSink = [];
    const recordingLanguage = {
      complete: async (request) => {
        const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
        languageSink.push({ userContent: user, userSha256: sha256(user) });
        return languageTransport.complete(request);
      }
    };
    const runtime = await InteractiveSubjectRuntimeV0.restore(
      runtimeOptions(
        recordingCognitionTransport(fixedCognitionTransport(selection.record.raw_response), []),
        `sess-language-${selection.condition}-${selection.role}`,
        recordingLanguage
      ),
      JSON.parse(JSON.stringify(snapshot))
    );
    const outcome = await runtime.submitUserText(scenario.event);
    if (outcome.status !== 'COMPLETE') throw new Error(`language realization failed: ${outcome.failure}`);
    const languageCalled = languageSink.length > 0;
    results.push({
      scenario: scenario.id,
      selection_role: selection.role,
      condition: selection.condition,
      behavior_class: selection.behavior_class,
      directive: selection.record.directive,
      current_intent: selection.record.current_intent,
      language_call_required: outcome.language_call_required,
      language_called: languageCalled,
      language_request_sha256: languageCalled ? languageSink[0].userSha256 : null,
      raw_language_response: outcome.raw_language_response ?? null,
      behavior_text: outcome.subject_text,
      behavior_text_sha256: sha256(outcome.subject_text)
    });
  }

  const byCondition = {};
  for (const conditionId of CONDITIONS) {
    byCondition[conditionId] = results.filter((result) => result.condition === conditionId);
  }
  const pairwise = [];
  for (let i = 0; i < CONDITIONS.length; i += 1) {
    for (let j = i + 1; j < CONDITIONS.length; j += 1) {
      const a = CONDITIONS[i];
      const b = CONDITIONS[j];
      const majorityA = byCondition[a].find((result) => result.selection_role === 'MAJORITY');
      const majorityB = byCondition[b].find((result) => result.selection_role === 'MAJORITY');
      pairwise.push({
        pair: `${a}_vs_${b}`,
        majority_behavior_identical:
          majorityA !== undefined && majorityB !== undefined && majorityA.behavior_text === majorityB.behavior_text,
        majority_behavior_a: majorityA?.behavior_text ?? null,
        majority_behavior_b: majorityB?.behavior_text ?? null
      });
    }
  }

  writeFileSync(
    join(evidenceDir, `language-evidence-${scenario.id}.json`),
    `${JSON.stringify(
      {
        schema_version: 'affect-causal-language-evidence-v0',
        scenario: scenario.id,
        real_language_calls: results.filter((result) => result.language_called).length,
        max_language_calls: MAX_LANGUAGE_CALLS,
        results,
        pairwise
      },
      null,
      2
    )}\n`
  );
  console.log(
    JSON.stringify(
      {
        real_language_calls: results.filter((result) => result.language_called).length,
        results: results.map((result) => ({
          condition: result.condition,
          role: result.selection_role,
          class: result.behavior_class,
          behavior: result.behavior_text
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
