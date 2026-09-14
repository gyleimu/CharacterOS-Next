import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = 'research/core-completion/phase-2-affect-cognition-c4-choice-applicability-and-subjective-basis-v0';
const rows = readFileSync(resolve(dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
const out = [];

// ---- 1. rationale inventory for every SELECTED cell -----------------------------
out.push(['=== RATIONALE INVENTORY (SELECTED cells) ===']);
const stateWords = /\b(energy|stress(?:ed)?|fatigue|fatigued|tired|exhaust(?:ed|ion)?|fresh|freshness|calm|capacity|capable|capability|mind|mood|alert|sharp|awake|ready|readiness|bandwidth|focus(?:ed)?|aroused|arousal)\b/i;
const seen = new Map();
for (const r of rows.filter((x) => x.subjective_choice?.kind === 'SELECTED')) {
  const key = `${r.scenario}|${r.subjective_choice.subjective_rationale}`;
  if (!seen.has(key)) seen.set(key, { scenario: r.scenario, stance: r.subjective_choice.stance, rationale: r.subjective_choice.subjective_rationale, frozen: r.classification.rationale_lawful, stateFlavoured: r.subjective_choice.subjective_rationale !== null && stateWords.test(r.subjective_choice.subjective_rationale), count: 0 });
  seen.get(key).count += 1;
}
for (const v of seen.values()) {
  out.push([v.scenario, `n=${v.count}`, `frozen=${v.frozen}`, `state-flavoured=${v.stateFlavoured}`, `stance=${JSON.stringify(v.stance)}`, `rationale=${JSON.stringify(v.rationale)}`]);
}

// ---- 2. M2 full chain: request text vs stance vs delivered ---------------------
out.push(['=== M2 CHAIN ===']);
for (const r of rows.filter((x) => x.scenario === 'M2').slice(0, 1)) {
  const user = r.raw_cognition_request.messages.find((m) => m.role === 'user').content;
  out.push(['scene line', (user.split('\n').find((l) => l.startsWith('[context]')) ?? '').slice(0, 400)]);
  out.push(['task line', (user.split('\n').find((l) => l.startsWith('  task=')) ?? '').slice(0, 200)]);
  out.push(['stance', JSON.stringify(r.subjective_choice.stance)]);
  out.push(['rationale', JSON.stringify(r.subjective_choice.subjective_rationale)]);
  out.push(['delivered', JSON.stringify(r.final_behavior)]);
  out.push(['language_choice', r.classification.language_choice]);
  // what Language received
  const luser = r.raw_language_request.messages.find((m) => m.role === 'user').content;
  const body = /LANGUAGE REALIZATION INPUT V6[\s\S]*?\n(\{[\s\S]*?\n\})\n/.exec(luser)?.[1];
  const parsed = body === undefined ? null : JSON.parse(body);
  out.push(['language input keys', JSON.stringify(Object.keys(parsed ?? {}))]);
  out.push(['language input current_user_request', JSON.stringify(parsed?.current_user_request ?? null)]);
  out.push(['language input choice', JSON.stringify(parsed?.selected_subjective_choice ?? null)]);
  out.push(['language input has option list?', String(/option|choice_space|alternative/i.test(luser))]);
}

// ---- 3. does the observation/projection expose any option structure? -----------
out.push(['=== PROJECTION SURFACE (M2/R2) ===']);
for (const id of ['M2', 'R2']) {
  const r = rows.find((x) => x.scenario === id);
  const user = r.raw_cognition_request.messages.find((m) => m.role === 'user').content;
  out.push([id, 'section headers:', JSON.stringify(user.split('\n').filter((l) => /^\[/.test(l.trim())).map((l) => l.slice(0, 42)))]);
}

// ---- 4. Language prompt rules on repair ----------------------------------------
const m2 = rows.find((x) => x.scenario === 'M2');
const system = m2.raw_language_request.messages.find((m) => m.role === 'system').content;
out.push(['=== LANGUAGE C4 PROMPT RULES ===']);
for (const line of system.split('\n')) if (/^\d+\./.test(line.trim())) out.push(['LANG', line.slice(0, 300)]);

process.stdout.write(out.map((parts) => parts.join(' | ')).join('\n') + '\n');
