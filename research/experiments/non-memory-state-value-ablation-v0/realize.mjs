/* globals URL */
/**
 * PHASE C — selective real Language realization.
 *
 * For the frozen null-control scenarios and up to two materially divergent
 * scenarios, this replays the ALREADY-CAPTURED structured cognition proposal
 * through the production runtime (so the production language-input projection is
 * built normally) with the REAL language transport. FULL and MEMORY_ONLY are
 * realized under an identical projection, so the only difference is the
 * cognition proposal that Phase B accepted.
 *
 * The replay is valid only if the freshly built cognition projection is
 * byte-identical to the Phase B projection; that is asserted per run.
 *
 * Usage: node realize.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractiveSubjectRuntimeV0,
  OllamaNativeCognitionTransportV0,
  createInteractiveSubjectSeedV0
} from '../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from './lib/appraisal.mjs';
import { fixedCognitionTransport, productionRequestHash, recordingCognitionTransport, recordingLanguageTransport } from './lib/transports.mjs';
import { FROZEN_CLOCK, INTERVAL_TICKS, PHASE_C_FIXED_SCENARIOS, PHASE_C_MATERIAL_MAX, PROVIDER, SCENARIOS, SUBJECT_ID } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const snapshotsDir = join(root, 'evidence', 'snapshots');
const phaseB = JSON.parse(readFileSync(join(root, 'evidence', 'phase-b.json'), 'utf8'));
const comparison = JSON.parse(readFileSync(join(root, 'evidence', 'comparison.json'), 'utf8'));

const realLanguageTransport = new OllamaNativeCognitionTransportV0({
  base_url: PROVIDER.base_url,
  model: PROVIDER.model,
  timeout_ms: PROVIDER.timeout_ms,
  num_predict: PROVIDER.language_num_predict,
  context_window_tokens: PROVIDER.context_window_tokens
});

function realizeOptions(cognitionTransport, sink) {
  return {
    session_id: 'sess-non-memory-ablation-realize',
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport,
    languageTransport: recordingLanguageTransport(realLanguageTransport, sink),
    factualEventAppraisalProvider: contentSensitiveAppraisalProvider(),
    interval_ticks: INTERVAL_TICKS,
    provider_identity: {
      model: PROVIDER.model,
      num_predict: PROVIDER.cognition_num_predict,
      context_window_tokens: PROVIDER.context_window_tokens
    },
    clock: () => FROZEN_CLOCK
  };
}

async function realize(record, which) {
  const scenario = SCENARIOS.find((entry) => entry.id === record.id);
  const snapshot = JSON.parse(readFileSync(join(snapshotsDir, `${scenario.history}.json`), 'utf8'));
  const proposal = which === 'A' ? record.full : record.b;
  const replay = fixedCognitionTransport(proposal.raw_response);
  const cognitionSink = [];
  const languageSink = [];
  const started = Date.now();
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    realizeOptions(recordingCognitionTransport(replay, cognitionSink), languageSink),
    snapshot
  );
  const outcome = await runtime.submitUserText(scenario.event);
  const cognitionExchange = cognitionSink.at(-1) ?? null;
  const builtProductionHash =
    cognitionExchange === null
      ? null
      : productionRequestHash({
          model: PROVIDER.model,
          systemContent: cognitionExchange.systemContent,
          userContent: cognitionExchange.userContent,
          numPredict: PROVIDER.cognition_num_predict,
          contextWindowTokens: PROVIDER.context_window_tokens
        });
  const language = languageSink.at(-1) ?? null;
  const parsedLanguage = language === null ? null : parseLanguageText(language.response);
  return {
    scenario: record.id,
    condition: `A_FULL` === which ? 'A_FULL' : 'B_MEMORY_ONLY_ALL',
    which,
    turn_status: outcome.status,
    turn_failure: outcome.failure,
    directive: outcome.directive,
    subject_text: outcome.subject_text,
    language_call_required: outcome.language_call_required,
    language_called: language !== null,
    language_user_sha256: language?.userHash ?? null,
    language_raw_response: language?.response ?? null,
    language_text: parsedLanguage?.text ?? null,
    language_valid: parsedLanguage?.ok ?? null,
    language_error: parsedLanguage?.ok === false ? parsedLanguage.error : null,
    elapsed_ms: Date.now() - started,
    projected_cognition_request_matches_phase_b:
      builtProductionHash !== null && builtProductionHash === (record.full.request_hash ?? null),
    built_cognition_request_hash: builtProductionHash
  };
}

function parseLanguageText(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.text === 'string') return { ok: true, text: parsed.text };
    return { ok: false, error: 'no text field' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function main() {
  const material = Object.values(comparison.pairs)
    .filter((pair) => pair.A_vs_B.classification === 'MATERIAL_COGNITION_DIFFERENCE')
    .map((pair) => pair.id)
    .filter((id) => !PHASE_C_FIXED_SCENARIOS.includes(id))
    .slice(0, PHASE_C_MATERIAL_MAX);
  const targets = [...PHASE_C_FIXED_SCENARIOS, ...material];
  const results = { schema_version: 'non-memory-ablation-phase-c-v0', targets, runs: [] };

  for (const id of targets) {
    const record = phaseB.scenarios[id];
    const a = await realize(record, 'A');
    const b = await realize(record, 'B');
    const comparisonEntry = {
      id,
      directive_a: a.directive,
      directive_b: b.directive,
      language_called_a: a.language_called,
      language_called_b: b.language_called,
      text_a: a.language_text,
      text_b: b.language_text,
      text_identical: a.language_text === b.language_text,
      objective_answer_present_a: a.language_text !== null ? /\b42\b/.test(a.language_text) : null,
      objective_answer_present_b: b.language_text !== null ? /\b42\b/.test(b.language_text) : null,
      projection_reattested: a.projected_cognition_request_matches_phase_b && b.projected_cognition_request_matches_phase_b
    };
    results.runs.push({ a, b, comparison: comparisonEntry });
    console.log(
      `${id}: directive A=${a.directive} B=${b.directive} | lang A=${JSON.stringify(a.language_text)} B=${JSON.stringify(b.language_text)} | identical=${comparisonEntry.text_identical} reattested=${comparisonEntry.projection_reattested}`
    );
  }
  writeFileSync(join(root, 'evidence', 'phase-c.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log('phase-c: complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
