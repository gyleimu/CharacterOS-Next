/* globals fetch */
/**
 * AFFECT_COGNITION_C4_3_..._V0 — qualification collector (65 real calls).
 *
 * 13 scenarios × 5 replicates under AFFECT_ABSENT, run against the production
 * C4.2 surfaces. Evaluates the two frozen Family-D triggers (failure to select or
 * ground; failure to withhold) plus the rationale-boundary endpoint.
 */
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  CHOICE_SCENARIOS, FALSIFICATION, LANGUAGE_CONNECTORS, NULL_ONLY_SCENARIOS, PROVIDER,
  QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS
} from './lib/config.mjs';
import { classifyRecord } from './lib/classify.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const partialPath = resolve(here, 'qualification-raw.partial.jsonl');
const finalPath = resolve(here, 'qualification-raw.jsonl');
const exists = (path) => stat(path).then(() => true, () => false);
if (await exists(finalPath)) throw new Error('immutable qualification evidence already exists');
const freeze = JSON.parse(await readFile(resolve(here, 'qualification-freeze.json'), 'utf8'));
const withoutHash = { ...freeze }; delete withoutHash.freeze_hash;
if (hashJson(withoutHash) !== freeze.freeze_hash || !freeze.created_before_model_calls) throw new Error('QUALIFICATION_FREEZE_INVALID');
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
const completed = new Set(prior.map((row) => `${row.scenario}/${row.replicate}`));
let ordinal = prior.length;
for (const scenario of QUALIFICATION_SCENARIOS) {
  for (let replicate = 0; replicate < QUALIFICATION_REPLICATES; replicate += 1) {
    const key = `${scenario.id}/${replicate}`; if (completed.has(key)) continue;
    const cognitionStart = traces.cognition.length; const languageStart = traces.language.length;
    const record = await runCondition({ snapshot, scenario, conditionId: 'A', cognitionTransport: cognition, languageTransport: language, sessionId: freeze.opaque_session_ids[scenario.id][replicate] });
    const row = {
      phase: 'QUALIFICATION', ordinal, replicate, provider_digest: PROVIDER.required_digest, ...record,
      classification: classifyRecord(scenario, record, LANGUAGE_CONNECTORS),
      cognition_trace: traces.cognition.slice(cognitionStart), language_trace: traces.language.slice(languageStart)
    };
    await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
    ordinal += 1;
    process.stdout.write(`QUAL ${ordinal}/65 ${key} status=${row.status} pass=${row.classification.pass} tag=${row.classification.applicability} stance=${row.classification.stance_selected} rationale=${row.classification.rationale_category} completion=${row.classification.language_completion}\n`);
  }
}
const rows = (await readFile(partialPath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
if (rows.length !== QUALIFICATION_SCENARIOS.length * QUALIFICATION_REPLICATES) throw new Error(`qualification count ${rows.length}/65`);
await rename(partialPath, finalPath);

const perScenario = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => {
  const selected = rows.filter((row) => row.scenario === scenario.id);
  return [scenario.id, {
    choice_bearing: scenario.choice !== undefined,
    required_tag: scenario.choice !== undefined ? 'SELECTED' : 'NOT_APPLICABLE',
    passed: selected.filter((row) => row.classification.pass).length,
    total: selected.length,
    tags: selected.map((row) => row.classification.applicability),
    stances: selected.map((row) => row.classification.stance_selected),
    off_question: selected.map((row) => row.classification.off_question),
    rationale_categories: selected.map((row) => row.classification.rationale_category),
    rationale_values: selected.map((row) => row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.subjective_rationale : null),
    stance_values: selected.map((row) => row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null),
    language_completion: selected.map((row) => row.classification.language_completion),
    citation_binding: selected.map((row) => row.classification.citation_binding),
    failures: selected.filter((row) => !row.classification.pass).map((row) => ({
      replicate: row.replicate, tag: row.classification.applicability, stance: row.classification.stance_selected,
      off_question: row.classification.off_question, rationale: row.classification.rationale_category,
      forbidden: row.classification.rationale_forbidden_classes, completion: row.classification.language_completion,
      completion_tokens: row.classification.language_completion_tokens,
      unsupported: row.classification.unsupported_premises, final_behavior: row.final_behavior, detail: row.failure_detail
    }))
  }];
}));

const selectDefect = (row) => {
  const c = row.classification;
  if (c.applicability !== 'SELECTED') return true;
  if (c.off_question === 'OFF_QUESTION_STANCE') return true;
  return ['ENUM_ECHO', 'PLACEHOLDER', 'STANCE_EMPTY', 'STANCE_OVERSIZED', 'SELECTED_KEYS', 'UNKNOWN_KIND'].includes(c.applicability_reason);
};
const failureToSelect = CHOICE_SCENARIOS.map((scenario) => {
  const cells = rows.filter((row) => row.scenario === scenario.id);
  const defective = cells.filter(selectDefect).length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const failureToWithhold = NULL_ONLY_SCENARIOS.map((scenario) => {
  const cells = rows.filter((row) => row.scenario === scenario.id);
  const defective = cells.filter((row) => row.classification.applicability === 'SELECTED').length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.length, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const falsification = {
  schema_version: 'affect-cognition-c4-3-family-d-falsification-v0', threshold: FALSIFICATION,
  FAMILY_D_FAILURE_TO_SELECT_TRIGGERED: failureToSelect.length >= FALSIFICATION.min_scenarios,
  failure_to_select_scenarios: failureToSelect,
  FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED: failureToWithhold.length >= FALSIFICATION.min_scenarios,
  failure_to_withhold_scenarios: failureToWithhold
};

const countBy = (key) => Object.fromEntries([...new Set(rows.map((row) => row.classification[key]))].map((label) => [label, rows.filter((row) => row.classification[key] === label).length]));
const summary = {
  schema_version: 'affect-cognition-c4-3-qualification-summary-v0', freeze_hash: freeze.freeze_hash,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0), language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0, passed: rows.filter((row) => row.classification.pass).length, total: rows.length,
  applicability_counts: countBy('applicability'),
  endpoint_counts: countBy('choice_applicability'),
  stance_counts: countBy('stance_selected'),
  off_question_counts: countBy('off_question'),
  rationale_category_counts: countBy('rationale_category'),
  language_completion_counts: countBy('language_completion'),
  citation_binding_counts: countBy('citation_binding'),
  citation_unbound_cells: rows.filter((row) => row.classification.citation_binding === 'CITATION_UNBOUND').length,
  forbidden_rationale_cells: rows.filter((row) => row.classification.rationale_forbidden_classes.length > 0).length,
  off_question_cells: rows.filter((row) => row.classification.off_question === 'OFF_QUESTION_STANCE').length,
  semantic_completion_cells: rows.filter((row) => row.classification.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE').length,
  null_cells_with_invented_preference: rows.filter((row) => row.family === 'NULL' && row.classification.language_invented_preference === true).length,
  family_d: falsification,
  all_qualification_passed: rows.every((row) => row.classification.pass),
  per_scenario: perScenario
};
await writeFile(resolve(here, 'qualification-forensics.json'), `${JSON.stringify({ falsification, per_scenario: perScenario }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-raw-language.jsonl'), `${rows.filter((row) => row.raw_language_request !== null).map((row) => JSON.stringify({ scenario: row.scenario, replicate: row.replicate, request: row.raw_language_request, response: row.raw_language_response, leakage: row.language_leakage, completion: row.classification.language_completion, completion_tokens: row.classification.language_completion_tokens })).join('\n')}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ passed: summary.passed, total: summary.total, applicability: summary.applicability_counts, stances: summary.stance_counts, off_question: summary.off_question_counts, rationale: summary.rationale_category_counts, language: summary.language_completion_counts, citation_binding: summary.citation_binding_counts, family_d: { select: falsification.FAMILY_D_FAILURE_TO_SELECT_TRIGGERED, withhold: falsification.FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED } }, null, 2)}\n`);
