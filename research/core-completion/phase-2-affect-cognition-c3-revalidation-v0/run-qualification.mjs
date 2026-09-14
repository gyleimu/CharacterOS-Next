/* globals fetch */
/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — qualification collector (65 real calls).
 *
 * 13 scenarios × 5 replicates under AFFECT_ABSENT, run against the unmodified
 * production C3 surfaces. Raw evidence is append-only. The run also evaluates the
 * FROZEN Family-D falsification threshold: if ≥3 of 5 cells on ≥2 choice-bearing
 * scenarios still produce a null choice, an enum echo or another non-choice
 * placeholder, single-stage Cognition is insufficient and the formal matrix must
 * not run.
 */
import { appendFile, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256 } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { CHOICE_SCENARIOS, FALSIFICATION, NULL_ONLY_SCENARIOS, PROVIDER, QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS } from './lib/config.mjs';
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
    process.stdout.write(`QUAL ${ordinal}/65 ${key} status=${row.status} pass=${row.classification.pass} endpoint=${row.classification.primary_endpoint} stage=${row.failure_stage ?? 'FINAL'}\n`);
  }
}
const rows = (await readFile(partialPath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
if (rows.length !== QUALIFICATION_SCENARIOS.length * QUALIFICATION_REPLICATES) throw new Error(`qualification count ${rows.length}/65`);
await rename(partialPath, finalPath);

const perScenario = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => {
  const selected = rows.filter((row) => row.scenario === scenario.id);
  return [scenario.id, {
    choice_bearing: scenario.choice !== undefined,
    passed: selected.filter((row) => row.classification.pass).length,
    total: selected.length,
    endpoints: selected.map((row) => row.classification.primary_endpoint),
    defects: selected.map((row) => row.classification.choice_defect).filter((value) => value !== null),
    stances: selected.map((row) => row.subjective_choice?.stance ?? null),
    failures: selected.filter((row) => !row.classification.pass).map((row) => ({
      replicate: row.replicate, stage: row.failure_stage, endpoint: row.classification.primary_endpoint,
      defect: row.classification.choice_defect, fact: row.classification.final_fact,
      choice_fidelity: row.classification.choice_fidelity, unsupported: row.classification.unsupported_premises,
      stance: row.subjective_choice?.stance ?? null, final_behavior: row.final_behavior, detail: row.failure_detail
    }))
  }];
}));

// ---- frozen Family-D falsification threshold ------------------------------------
const falsificationScenarios = CHOICE_SCENARIOS.map((scenario) => {
  const cells = perScenario[scenario.id];
  const defective = cells.defects.length;
  return { scenario: scenario.id, defective_cells: defective, of: cells.total, defects: cells.defects, triggered: defective >= FALSIFICATION.min_cells };
}).filter((entry) => entry.triggered);
const falsification = {
  schema_version: 'affect-cognition-c3-family-d-falsification-v0',
  threshold: FALSIFICATION,
  scenario_ids_evaluated: CHOICE_SCENARIOS.map((scenario) => scenario.id),
  triggered_scenarios: falsificationScenarios,
  triggered: falsificationScenarios.length >= FALSIFICATION.min_scenarios
};

const summary = {
  schema_version: 'affect-cognition-c3-qualification-summary-v0', freeze_hash: freeze.freeze_hash,
  cognition_calls: rows.reduce((sum, row) => sum + row.cognition_calls, 0), language_calls: rows.reduce((sum, row) => sum + row.language_calls, 0),
  infrastructure_retries: 0, passed: rows.filter((row) => row.classification.pass).length, total: rows.length,
  choice_bearing_scenarios: CHOICE_SCENARIOS.length, null_scenarios: NULL_ONLY_SCENARIOS.length,
  primary_endpoint_counts: Object.fromEntries([...new Set(rows.map((row) => row.classification.primary_endpoint))].map((label) => [label, rows.filter((row) => row.classification.primary_endpoint === label).length])),
  choice_fidelity_counts: Object.fromEntries([...new Set(rows.map((row) => row.classification.choice_fidelity))].map((label) => [label, rows.filter((row) => row.classification.choice_fidelity === label).length])),
  enum_echo_cells: rows.filter((row) => row.subjective_choice?.stance === 'REALIZE_CURRENT_INTENT' || row.subjective_choice?.stance === 'CLARIFY_MISSING_CONTEXT').length,
  // The mirror defect the frozen Family-D rule does not cover: a declared choice
  // on a turn that requires exactly null.
  null_cell_choice_violations: rows.filter((row) => row.classification.choice_defect === 'UNEXPECTED_CHOICE').length,
  null_cell_violating_scenarios: NULL_ONLY_SCENARIOS.filter((scenario) => perScenario[scenario.id].defects.includes('UNEXPECTED_CHOICE')).map((scenario) => scenario.id),
  all_qualification_passed: rows.every((row) => row.classification.pass),
  family_d: falsification,
  per_scenario: perScenario
};
await writeFile(resolve(here, 'qualification-forensics.json'), `${JSON.stringify({ ...falsification, per_scenario: perScenario }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-raw-language.jsonl'), `${rows.filter((row) => row.raw_language_request !== null).map((row) => JSON.stringify({ scenario: row.scenario, replicate: row.replicate, request: row.raw_language_request, response: row.raw_language_response, leakage: row.language_leakage })).join('\n')}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ passed: summary.passed, total: summary.total, primary_endpoint_counts: summary.primary_endpoint_counts, choice_fidelity_counts: summary.choice_fidelity_counts, enum_echo_cells: summary.enum_echo_cells, family_d: { triggered: falsification.triggered, scenarios: falsification.triggered_scenarios.map((entry) => entry.scenario) } }, null, 2)}\n`);
