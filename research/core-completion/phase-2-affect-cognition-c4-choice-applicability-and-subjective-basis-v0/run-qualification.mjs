/* globals fetch */
/**
 * AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 —
 * qualification collector (65 real calls).
 *
 * 13 scenarios × 5 replicates under AFFECT_ABSENT. The run evaluates BOTH frozen
 * Family-D falsification triggers and the subjective-basis routing rule:
 *   FAMILY_D_FAILURE_TO_SELECT_TRIGGERED   — a choice-bearing scenario that stops selecting
 *   FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED — a null scenario that keeps declaring a selection
 *   SUBJECTIVE_BASIS_ROUTING_FAILED        — subject-side reasoning still entering facts
 */
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  CHOICE_SCENARIOS, FALSIFICATION, NULL_ONLY_SCENARIOS, PROVIDER, QUALIFICATION_REPLICATES,
  QUALIFICATION_SCENARIOS, SUBJECTIVE_BASIS_RULE
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
      classification: classifyRecord(scenario, record), cognition_trace: traces.cognition.slice(cognitionStart), language_trace: traces.language.slice(languageStart)
    };
    await appendFile(partialPath, `${JSON.stringify(row)}\n`, 'utf8');
    ordinal += 1;
    process.stdout.write(`QUAL ${ordinal}/65 ${key} status=${row.status} pass=${row.classification.pass} tag=${row.classification.applicability} endpoint=${row.classification.choice_applicability} stage=${row.failure_stage ?? 'FINAL'}\n`);
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
    endpoints: selected.map((row) => row.classification.choice_applicability),
    stances: selected.map((row) => (row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null)),
    rationales: selected.map((row) => (row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.subjective_rationale : null)),
    failures: selected.filter((row) => !row.classification.pass).map((row) => ({
      replicate: row.replicate, stage: row.failure_stage, tag: row.classification.applicability,
      reason: row.classification.applicability_reason, endpoint: row.classification.choice_applicability,
      rationale: row.classification.rationale_lawful, language_choice: row.classification.language_choice,
      self_state: row.classification.factual_self_state_assertion, unlawful_refs: row.classification.unlawful_factual_source_refs,
      unsupported: row.classification.unsupported_premises, final_behavior: row.final_behavior, detail: row.failure_detail
    }))
  }];
}));

// ---- frozen Family-D falsification triggers -------------------------------------
const failureToSelect = CHOICE_SCENARIOS.map((scenario) => {
  const cells = perScenario[scenario.id];
  const defective = cells.tags.filter((tag) => tag !== 'SELECTED').length + cells.failures.filter((failure) => failure.rationale === 'RATIONALE_UNLAWFUL' || failure.reason === 'ENUM_ECHO' || failure.reason === 'PLACEHOLDER').length;
  return { scenario: scenario.id, cells: defective, of: cells.total, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const failureToWithhold = NULL_ONLY_SCENARIOS.map((scenario) => {
  const cells = perScenario[scenario.id];
  const defective = cells.tags.filter((tag) => tag === 'SELECTED').length;
  return { scenario: scenario.id, cells: defective, of: cells.total, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const falsification = {
  schema_version: 'affect-cognition-c4-family-d-falsification-v0',
  threshold: FALSIFICATION,
  FAMILY_D_FAILURE_TO_SELECT_TRIGGERED: failureToSelect.length >= FALSIFICATION.min_scenarios,
  failure_to_select_scenarios: failureToSelect,
  FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED: failureToWithhold.length >= FALSIFICATION.min_scenarios,
  failure_to_withhold_scenarios: failureToWithhold
};

// ---- subjective-basis routing rule ---------------------------------------------
const routingScenarios = CHOICE_SCENARIOS.map((scenario) => {
  const cells = rows.filter((row) => row.scenario === scenario.id);
  const defective = cells.filter((row) => row.classification.factual_self_state_assertion.length > 0 || row.classification.unlawful_factual_source_refs.length > 0 || row.classification.rationale_lawful === 'RATIONALE_UNLAWFUL').length;
  return { scenario: scenario.id, defective, of: cells.length, systematic: defective >= 3 };
}).filter((entry) => entry.systematic);
const subjectiveBasis = {
  schema_version: 'affect-cognition-c4-subjective-basis-routing-v0',
  rule: SUBJECTIVE_BASIS_RULE,
  SUBJECTIVE_BASIS_ROUTING_FAILED: routingScenarios.length >= SUBJECTIVE_BASIS_RULE.min_scenarios,
  scenarios: routingScenarios,
  self_state_fact_cells: rows.filter((row) => row.classification.factual_self_state_assertion.length > 0).length,
  unlawful_source_cells: rows.filter((row) => row.classification.unlawful_factual_source_refs.length > 0).length,
  unlawful_rationale_cells: rows.filter((row) => row.classification.rationale_lawful === 'RATIONALE_UNLAWFUL').length
};

const countBy = (key) => Object.fromEntries([...new Set(rows.map((row) => row.classification[key]))].map((label) => [label, rows.filter((row) => row.classification[key] === label).length]));
const summary = {
  schema_version: 'affect-cognition-c4-qualification-summary-v0', freeze_hash: freeze.freeze_hash,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0), language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0, passed: rows.filter((row) => row.classification.pass).length, total: rows.length,
  choice_bearing_scenarios: CHOICE_SCENARIOS.length, null_scenarios: NULL_ONLY_SCENARIOS.length,
  applicability_counts: countBy('applicability'),
  endpoint_counts: countBy('choice_applicability'),
  rationale_counts: countBy('rationale_lawful'),
  language_choice_counts: countBy('language_choice'),
  null_cells_with_invented_preference: rows.filter((row) => row.family === 'NULL' && row.classification.language_invented_preference === true).length,
  family_d: falsification, subjective_basis: subjectiveBasis,
  all_qualification_passed: rows.every((row) => row.classification.pass),
  per_scenario: perScenario
};
await writeFile(resolve(here, 'qualification-forensics.json'), `${JSON.stringify({ falsification, subjective_basis: subjectiveBasis, per_scenario: perScenario }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-raw-language.jsonl'), `${rows.filter((row) => row.raw_language_request !== null).map((row) => JSON.stringify({ scenario: row.scenario, replicate: row.replicate, request: row.raw_language_request, response: row.raw_language_response, leakage: row.language_leakage })).join('\n')}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ passed: summary.passed, total: summary.total, applicability_counts: summary.applicability_counts, endpoint_counts: summary.endpoint_counts, rationale_counts: summary.rationale_counts, language_choice_counts: summary.language_choice_counts, null_cells_with_invented_preference: summary.null_cells_with_invented_preference, family_d: { select: falsification.FAMILY_D_FAILURE_TO_SELECT_TRIGGERED, withhold: falsification.FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED }, subjective_basis_routing_failed: subjectiveBasis.SUBJECTIVE_BASIS_ROUTING_FAILED }, null, 2)}\n`);
