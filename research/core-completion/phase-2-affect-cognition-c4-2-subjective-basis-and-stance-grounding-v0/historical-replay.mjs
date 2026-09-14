/**
 * AFFECT_COGNITION_C4_2_..._V0 — historical replay regressions (ZERO model calls).
 *
 * Re-classifies the FROZEN C4 qualification evidence with the C4.2 classifier and
 * reports the four regressions the architecture brief requires:
 *   M1 → RAW_SELF_STATE_DESCRIPTION (was RATIONALE_UNLAWFUL under C4 vocabulary)
 *   R4 → forbidden self-state narration ("while my mind is fresh")   [C4 missed it]
 *   M3 → INFERRED_CAPACITY ("within my operational scope")           [C4 missed it]
 *   M2 → OFF_QUESTION_STANCE + SEMANTICALLY_COMPLETED_BY_LANGUAGE    [C4 mislabelled it]
 *
 * Read-only: the C4 evidence is never modified.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGE_CONNECTORS, PROTOCOL_STRINGS } from './lib/config.mjs';
import { classifyRecord, rationaleVerdict } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const c4Dir = resolve(here, '../phase-2-affect-cognition-c4-choice-applicability-and-subjective-basis-v0');
const rows = readFileSync(resolve(c4Dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const scenarios = JSON.parse(readFileSync(resolve(c4Dir, 'qualification-freeze.json'), 'utf8')).scenarios;
const scenarioById = (id) => scenarios.find((entry) => entry.id === id);

const replay = rows.map((row) => {
  const scenario = scenarioById(row.scenario);
  const record = {
    status: row.status, directive: row.directive, current_intent: row.current_intent,
    subjective_choice: row.subjective_choice,
    language_selected_subjective_choice: row.language_selected_subjective_choice,
    factual_assessment: row.factual_assessment, final_behavior: row.final_behavior,
    stages: row.stages, request_attestation: row.request_attestation, language_leakage: row.language_leakage
  };
  const c42 = classifyRecord(scenario, record, LANGUAGE_CONNECTORS);
  return {
    scenario: row.scenario, replicate: row.replicate,
    stance: row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.stance : null,
    rationale: row.subjective_choice?.kind === 'SELECTED' ? row.subjective_choice.subjective_rationale : null,
    delivered: row.final_behavior,
    c4_rationale_label: row.classification.rationale_lawful,
    c4_language_label: row.classification.language_choice,
    c42
  };
});

const byScenario = (id) => replay.filter((entry) => entry.scenario === id);
const regression = (id) => {
  const cells = byScenario(id);
  return {
    scenario: id,
    cells: cells.length,
    rationale_categories: [...new Set(cells.map((entry) => entry.c42.rationale_category))],
    rationale_forbidden: cells.filter((entry) => entry.c42.rationale_forbidden_classes.length > 0).length,
    off_question: cells.filter((entry) => entry.c42.off_question === 'OFF_QUESTION_STANCE').length,
    language_completed: cells.filter((entry) => entry.c42.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE').length,
    completion_tokens: [...new Set(cells.flatMap((entry) => entry.c42.language_completion_tokens))],
    examples: cells.slice(0, 1).map((entry) => ({ stance: entry.stance, rationale: entry.rationale, delivered: entry.delivered }))
  };
};

const artifact = {
  schema_version: 'affect-cognition-c4-2-historical-replay-v0',
  model_calls: 0,
  source: 'phase-2-affect-cognition-c4-choice-applicability-and-subjective-basis-v0/qualification-raw.jsonl (read-only)',
  protocol: PROTOCOL_STRINGS.cognition,
  regressions: {
    M1: regression('M1'),
    R4: regression('R4'),
    M3: regression('M3'),
    M2: regression('M2')
  },
  totals: {
    rationale_forbidden_cells: replay.filter((entry) => entry.c42.rationale_forbidden_classes.length > 0).length,
    off_question_cells: replay.filter((entry) => entry.c42.off_question === 'OFF_QUESTION_STANCE').length,
    language_completion_cells: replay.filter((entry) => entry.c42.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE').length,
    passing_cells_under_c42: replay.filter((entry) => entry.c42.pass).length,
    total_cells: replay.length
  },
  c4_vs_c42: {
    c4_rationale_unlawful_cells: rows.filter((row) => row.classification.rationale_lawful === 'RATIONALE_UNLAWFUL').length,
    c42_rationale_forbidden_cells: replay.filter((entry) => entry.c42.rationale_forbidden_classes.length > 0).length,
    c4_language_changed_cells: rows.filter((row) => row.classification.language_choice === 'LANGUAGE_CHOICE_CHANGED').length,
    c42_off_question_cells: replay.filter((entry) => entry.c42.off_question === 'OFF_QUESTION_STANCE').length,
    c42_language_completion_cells: replay.filter((entry) => entry.c42.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE').length
  },
  expectations_met: {
    M1_raw_self_state: byScenario('M1').every((entry) => entry.c42.rationale_forbidden_classes.includes('RAW_SELF_STATE_DESCRIPTION')),
    R4_forbidden_self_state: byScenario('R4').every((entry) => entry.c42.rationale_forbidden_classes.length > 0),
    M3_inferred_capacity: byScenario('M3').every((entry) => entry.c42.rationale_forbidden_classes.includes('INFERRED_CAPACITY')),
    M2_off_question: byScenario('M2').every((entry) => entry.c42.off_question === 'OFF_QUESTION_STANCE'),
    M2_language_completion: byScenario('M2').every((entry) => entry.c42.language_completion === 'SEMANTICALLY_COMPLETED_BY_LANGUAGE')
  }
};
writeFileSync(resolve(here, 'historical-replay.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ regressions: Object.fromEntries(Object.entries(artifact.regressions).map(([id, value]) => [id, { categories: value.rationale_categories, forbidden: value.rationale_forbidden, off_question: value.off_question, completed: value.language_completed }])), totals: artifact.totals, c4_vs_c42: artifact.c4_vs_c42, expectations_met: artifact.expectations_met }, null, 2)}\n`);
void rationaleVerdict;
