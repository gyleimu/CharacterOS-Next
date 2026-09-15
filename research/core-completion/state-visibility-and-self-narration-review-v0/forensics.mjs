/**
 * AFFECT_COGNITION_STATE_VISIBILITY_AND_SELF_NARRATION_ARCHITECTURE_REVIEW
 * — zero-model forensics across every frozen R4 qualification round, plus the
 * self-narration frequency census over all choice-bearing cells of recent rounds.
 * No model calls, no production changes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');

const ROUNDS = [
  ['C2-clean-revalidation', 'phase-2-affect-cognition-c2-clean-revalidation-v0'],
  ['C2-host-bound', 'phase-2-affect-cognition-c2-host-bound-language-and-semantic-revalidation-v0'],
  ['C3-revalidation', 'phase-2-affect-cognition-c3-revalidation-v0'],
  ['C4-choice', 'phase-2-affect-cognition-c4-choice-applicability-and-subjective-basis-v0'],
  ['C4.2', 'phase-2-affect-cognition-c4-2-subjective-basis-and-stance-grounding-v0'],
  ['C4.3', 'phase-2-affect-cognition-c4-3-contract-legibility-and-grounding-v0'],
  ['C4.4', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0'],
  ['rationale-vocabulary', 'phase-2-affect-cognition-rationale-vocabulary-and-latitude-legibility-v0'],
  ['contract-compaction', 'phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0'],
  ['evaluator-v2', 'phase-2-affect-cognition-evaluator-v2-rationale-alignment-requalification-v0'],
  ['instrument-alignment', 'phase-2-affect-cognition-instrument-alignment-and-input-stability-v0'],
];

const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const rowsOf = (dir) => readFileSync(resolve(ROOT, dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const rationaleOf = (row) => row.subjective_selection?.subjective_rationale ?? null;
const forbiddenOf = (row) => (row.classification?.rationale_forbidden_classes ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.kind ?? String(entry)));

// ---- §3 chronological R4 table ----------------------------------------------------
const r4Table = ROUNDS.map(([label, dir]) => {
  let rows;
  try { rows = rowsOf(dir).filter((row) => row.scenario === 'R4'); } catch { return { round: label, available: false }; }
  const first = rows[0];
  const freeze = (() => { try { return JSON.parse(readFileSync(resolve(ROOT, dir, 'qualification-freeze.json'), 'utf8')); } catch { return null; } })();
  const request = first?.raw_cognition_request ?? null;
  const messages = request?.messages ?? [];
  const user = messages.find((message) => message.role === 'user')?.content ?? '';
  return {
    round: label, available: true,
    prompt_digest: freeze?.schema_authority?.cognition_prompt_sha256 ?? null,
    subject_id: freeze?.subject_id ?? null,
    request_sha256: request === null ? null : sha(JSON.stringify(messages)),
    regulation_projection: (user.split('\n').find((line) => line.startsWith('[regulation]')) ?? null),
    affect_projection: (user.split('\n').find((line) => line.startsWith('[affect')) ?? null),
    current_intent: first?.raw_cognition_wire?.cognition?.current_intent ?? first?.current_intent ?? null,
    factual_claims: (first?.factual_assessment?.claims ?? []).map((claim) => claim.text),
    stance: first?.subjective_selection?.stance ?? null,
    rationale: rationaleOf(first),
    language_output: first?.final_behavior ?? null,
    rationale_classification: first?.classification?.rationale_category ?? null,
    forbidden_classes: forbiddenOf(first),
    unique_rationales: [...new Set(rows.map((row) => rationaleOf(row)))],
    unique_stances: [...new Set(rows.map((row) => row.subjective_selection?.stance))],
    provider_digest: freeze?.provider?.digest ?? null,
    pass: rows.every((row) => row.classification?.pass)
  };
});

// ---- §37 self-narration census over choice cells of the last three rounds ---------
const CENSUS_ROUNDS = ['contract-compaction', 'evaluator-v2', 'instrument-alignment'];
const census = {};
for (const label of CENSUS_ROUNDS) {
  const dir = ROUNDS.find(([name]) => name === label)[1];
  const rows = rowsOf(dir).filter((row) => row.scenario?.startsWith('M') || row.scenario?.startsWith('R'));
  const byScenario = {};
  for (const row of rows) {
    const entry = byScenario[row.scenario] ??= { cells: 0, forbidden: 0, categories: new Set() };
    entry.cells += 1;
    const forbidden = forbiddenOf(row);
    if (forbidden.length > 0) entry.forbidden += 1;
    entry.categories.add(row.classification?.rationale_category ?? 'UNKNOWN');
  }
  census[label] = Object.fromEntries(Object.entries(byScenario).map(([id, entry]) => [id, { cells: entry.cells, forbidden_cells: entry.forbidden, categories: [...entry.categories] }]));
}

// ---- §4/§5 energy provenance (source citations) -----------------------------------
const provenance = {
  regulation_render_site: 'packages/runtime/src/providers/behavior/conversation-cognition-provider-v6.ts (buildConversationSubjectDataV4 → base render includes the [regulation] line)',
  regulation_projection_field: 'projection.regulation.{energy,stress,arousal,fatigue} — canonical Regulation state, unit-interval validated',
  regulation_producer: 'packages/runtime/src/producers/reference-regulation-v0-producer.ts (energy_next = energy_current, byte-exact pass-through; requireUnitInterval checks)',
  subject_data_source: 'packages/runtime/src/session/interactive-subject-runtime-v0.ts: snapshot.regulation.energy → subject data [regulation] line',
  affect_line: '[affect (canonical)] valence=… activation=… — separate canonical Affect state; no code path derives regulation from affect or vice versa in the cognition projection',
  production_rationale_validation: 'packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts validateSubjectiveRationaleV1: null / canonical text / non-empty / ≤256 code points ONLY — no content-semantics check',
  forbidden_rationale_enforcement: 'research instrument only (research/core-completion/*/lib/classify.mjs rationaleVerdict); no production code path rejects a proposal for rationale content'
};

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-state-visibility-self-narration-review-forensics-v0',
  model_calls: 0, production_files_changed: 0,
  r4_chronology: r4Table,
  self_narration_census: census,
  energy_provenance: provenance
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
