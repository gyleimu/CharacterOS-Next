import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = 'research/core-completion/phase-2-affect-cognition-c4-choice-applicability-and-subjective-basis-v0';
const rows = readFileSync(resolve(dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
const STOP = new Set(['that', 'this', 'with', 'would', 'will', 'have', 'been', 'from', 'they', 'their', 'there', 'then', 'than', 'when', 'what', 'which', 'while', 'your', 'you', 'the', 'and', 'for', 'not', 'but', 'are', 'was', 'were', 'its', 'it', 'is', 'as', 'at', 'on', 'in', 'of', 'to', 'a', 'an', 'my', 'me', 'i', 'we', 'our', 'do', 'does', 'did', 'be', 'or', 'if', 'so', 'no', 'yes', 'state', 'exactly', 'given', 'says', 'asks', 'user', 'personally', 'brief', 'reason']);
const tokens = (text) => [...new Set(String(text ?? '').toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])].filter((t) => !STOP.has(t));

const results = [];
for (const r of rows.filter((x) => x.family !== 'NULL')) {
  const user = r.raw_cognition_request.messages.find((m) => m.role === 'user').content;
  const scene = /^\[context\] scene="([\s\S]*?)" task=/m.exec(user)?.[1] ?? '';
  const claimText = (r.factual_assessment?.claims ?? []).map((c) => c.text).join(' ');
  const requestTokens = new Set([...tokens(scene), ...tokens(claimText)]);
  const stanceTokens = tokens(r.subjective_choice?.stance);
  const shared = stanceTokens.filter((t) => requestTokens.has(t));
  const deliveredTokens = tokens(r.final_behavior);
  const inputTokens = new Set([...stanceTokens, ...tokens(r.subjective_choice?.subjective_rationale), ...tokens(claimText), ...tokens(scene)]);
  const addedByLanguage = deliveredTokens.filter((t) => !inputTokens.has(t));
  results.push({ id: `${r.scenario}/${r.replicate}`, stance: r.subjective_choice?.stance, stanceTokens, shared, grounded: shared.length > 0, delivered: r.final_behavior, addedByLanguage });
}
process.stdout.write('=== stance grounding (turn-local lexical overlap) ===\n');
for (const x of results) process.stdout.write(`${x.id} grounded=${String(x.grounded).padEnd(5)} shared=${JSON.stringify(x.shared)} stance=${JSON.stringify(x.stance)}\n`);
const ungrounded = results.filter((x) => !x.grounded);
process.stdout.write(`\nungrounded stances: ${ungrounded.length}/${results.length} -> ${JSON.stringify(ungrounded.map((x) => x.id))}\n`);
process.stdout.write('\n=== tokens Language added beyond the whole input payload ===\n');
for (const x of results.filter((v) => v.addedByLanguage.length > 0)) process.stdout.write(`${x.id} added=${JSON.stringify(x.addedByLanguage)}\n`);
const m2 = results.find((x) => x.id === 'M2/0');
process.stdout.write(`\nM2/0 delivered=${JSON.stringify(m2.delivered)}\nM2/0 added tokens=${JSON.stringify(m2.addedByLanguage)}\n`);
