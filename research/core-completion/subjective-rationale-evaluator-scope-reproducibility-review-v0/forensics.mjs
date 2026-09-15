/**
 * AFFECT_COGNITION_SUBJECTIVE_RATIONALE_EVALUATOR_SCOPE_AND_REPRODUCIBILITY_REVIEW
 * — zero-model forensics over the frozen qualification records of the last two
 * rounds (contract-compaction 55/65 and evaluator-v2 50/65), plus the transport
 * source. No model calls, no production changes, no instrument edits.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CC = resolve(here, '..', 'phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0');
const EV2 = resolve(here, '..', 'phase-2-affect-cognition-evaluator-v2-rationale-alignment-requalification-v0');
const load = (dir) => readFileSync(resolve(dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const roundA = load(CC); // 55/65 round
const roundB = load(EV2); // 50/65 round
const sha = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const requestHashes = (row) => {
  const messages = row.raw_cognition_request?.messages ?? [];
  const system = messages.find((message) => message.role === 'system')?.content ?? '';
  const user = messages.find((message) => message.role === 'user')?.content ?? '';
  return { system_sha256: sha(system), user_sha256: sha(user), schema_sha256: sha(JSON.stringify(row.raw_cognition_request?.structured_output?.schema ?? null)), request_sha256: sha(JSON.stringify(messages)) };
};
const uniq = (values) => [...new Set(values)];

// ---- 1. cross-run request identity (provider-boundary bytes) ----------------------
const crossRun = {};
for (const id of ['M2', 'R3', 'R4', 'N5Q']) {
  const a = roundA.find((row) => row.scenario === id);
  const b = roundB.find((row) => row.scenario === id);
  crossRun[id] = {
    round_A_hashes: requestHashes(a), round_B_hashes: requestHashes(b),
    identical_request_bytes: requestHashes(a).request_sha256 === requestHashes(b).request_sha256,
    round_A_delivered: a.final_behavior, round_B_delivered: b.final_behavior,
    same_delivered: a.final_behavior === b.final_behavior
  };
}

// ---- 2. within-run replicate identity --------------------------------------------
const withinRun = {};
for (const id of ['M2', 'R3', 'R4']) {
  for (const [label, rows] of [['round_A', roundA], ['round_B', roundB]]) {
    const cells = rows.filter((row) => row.scenario === id);
    withinRun[`${id}:${label}`] = {
      replicates: cells.length,
      unique_stances: uniq(cells.map((row) => row.subjective_selection?.stance)).length,
      unique_rationales: uniq(cells.map((row) => row.subjective_selection?.subjective_rationale)).length,
      unique_delivered: uniq(cells.map((row) => row.final_behavior)).length
    };
  }
}

// ---- 3. R4 energy origin + wording history ---------------------------------------
const r4B = roundB.find((row) => row.scenario === 'R4');
const r4User = r4B.raw_cognition_request.messages.find((message) => message.role === 'user').content;
const r4System = r4B.raw_cognition_request.messages.find((message) => message.role === 'system').content;
const countTerm = (text, term) => (text.match(new RegExp(term, 'gi')) ?? []).length;
const r4Energy = {
  rationale: r4B.subjective_selection.subjective_rationale,
  stance: r4B.subjective_selection.stance,
  forbidden_classes: r4B.classification.rationale_forbidden_classes,
  energy_in_user_material: countTerm(r4User, 'energy'),
  energy_regulation_line: (r4User.split('\n').find((line) => line.startsWith('[regulation]')) ?? ''),
  energy_in_system_prompt: countTerm(r4System, 'energy'),
  system_prompt_energy_sentences: r4System.split('\n').filter((line) => /energy/i.test(line)).map((line) => line.trim().slice(0, 240)),
  all_five_identical: uniq(roundB.filter((row) => row.scenario === 'R4').map((row) => row.final_behavior)).length === 1,
  wording_history: {
    round_A_rationales: uniq(roundA.filter((row) => row.scenario === 'R4').map((row) => row.subjective_selection?.subjective_rationale)),
    round_B_rationales: uniq(roundB.filter((row) => row.scenario === 'R4').map((row) => row.subjective_selection?.subjective_rationale))
  }
};

// ---- 4. R3 hedge forensics --------------------------------------------------------
const r3B = roundB.find((row) => row.scenario === 'R3');
const HEDGE = /\b(?:depends|if\b|provided|assuming|unless|would need|need to know|not sure|unsure|might not|could be)\b/gi;
const r3Delivered = r3B.final_behavior ?? '';
const r3HedgeMatches = [...r3Delivered.matchAll(HEDGE)].map((match) => ({ span: match[0], context: r3Delivered.slice(Math.max(0, match.index - 70), match.index + 40) }));
const r3 = {
  stance: r3B.subjective_selection.stance,
  rationale: r3B.subjective_selection.subjective_rationale,
  delivered: r3Delivered,
  delivered_first_sentence: r3Delivered.split(/(?<=\.)\s+/)[0] ?? null,
  hedge_matches: r3HedgeMatches,
  hedge_located_in_rationale_clause: r3HedgeMatches.every((match) => (match.context ?? '').toLowerCase().includes('prefer') || (match.span === 'if' && /even if/i.test(match.context ?? ''))),
  alternative_stance_introduced: /\b(?:instead|rather than|alternatively|or keep|or stop|not do it)\b/i.test(r3Delivered.replace(/\brather than [^.]*/i, '')),
  language_choice: r3B.classification.language_choice,
  language_completion: r3B.classification.language_completion,
  completion_tokens: r3B.classification.language_completion_tokens,
  stance_class: r3B.classification.stance_selected,
  round_A: { delivered: roundA.find((row) => row.scenario === 'R3').final_behavior, choice: roundA.find((row) => row.scenario === 'R3').classification.language_choice }
};

// ---- 5. M2 wording history ---------------------------------------------------------
const m2 = {
  round_A_rationale: roundA.find((row) => row.scenario === 'M2').subjective_selection.subjective_rationale,
  round_B_rationale: roundB.find((row) => row.scenario === 'M2').subjective_selection.subjective_rationale,
  round_A_class: roundA.find((row) => row.scenario === 'M2').classification.rationale_category,
  round_B_class: roundB.find((row) => row.scenario === 'M2').classification.rationale_category,
  both_lawful_semantically: 'first-person, turn-local, no forbidden class in either round'
};

// ---- 6. provider/version/settings identity across rounds ---------------------------
const freezeA = JSON.parse(readFileSync(resolve(CC, 'qualification-freeze.json'), 'utf8'));
const freezeB = JSON.parse(readFileSync(resolve(EV2, 'qualification-freeze.json'), 'utf8'));
const envIdentity = {
  provider_version_A: freezeA.provider.version, provider_version_B: freezeB.provider.version,
  provider_digest_A: freezeA.provider.digest, provider_digest_B: freezeB.provider.digest,
  generation_settings_A: freezeA.generation_settings, generation_settings_B: freezeB.generation_settings,
  cognition_prompt_A: freezeA.schema_authority.cognition_prompt_sha256, cognition_prompt_B: freezeB.schema_authority.cognition_prompt_sha256,
  temperature_A: freezeA.declared_provider.temperature, temperature_B: freezeB.declared_provider.temperature
};

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-cognition-rationale-evaluator-scope-reproducibility-review-forensics-v0',
  model_calls: 0, production_files_changed: 0,
  round_A: 'contract-compaction 55/65', round_B: 'evaluator-v2 50/65',
  cross_run_request_identity: crossRun,
  within_run_replicate_identity: withinRun,
  r4: r4Energy,
  r3, m2, environment_identity: envIdentity
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
