/**
 * RATIONALE/EVALUATOR SCOPE + REPRODUCIBILITY REVIEW — controlled diagnostic
 * (recorded separately from qualification evidence; never fed back into any slice).
 *
 * Question the frozen records cannot answer: the two most recent rounds differ in
 * output AND in request bytes (the subject id was renamed per slice, changing every
 * derived ref). A faithful replay decides between two hypotheses:
 *   H1 input-driven: replaying each round's EXACT request reproduces that round's output.
 *   H2 provider-nondeterministic: identical bytes fail to reproduce their historical output.
 *
 * Design (9 calls max, one frozen scenario M2, no tuning purpose):
 *   calls 1-3: round A exact request
 *   calls 4-6: round B exact request
 *   calls 7-9: round B exact request WITH explicit seed (42) -- seed-support probe only
 */
/* globals fetch, AbortSignal */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CC = resolve(here, '..', 'phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0');
const EV2 = resolve(here, '..', 'phase-2-affect-cognition-evaluator-v2-rationale-alignment-requalification-v0');
const load = (dir) => readFileSync(resolve(dir, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const roundA = load(CC).find((row) => row.scenario === 'M2');
const roundB = load(EV2).find((row) => row.scenario === 'M2');

const MODEL = 'qwen3.5:9b';
const options = (seed) => ({ temperature: 0, num_predict: 2048, num_ctx: 8192, ...(seed === null ? {} : { seed }) });

async function call(row, seed, label) {
  const request = row.raw_cognition_request;
  const body = {
    model: MODEL,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    format: request.structured_output.schema,
    think: false,
    stream: false,
    options: options(seed)
  };
  const started = Date.now();
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(240000)
  });
  const envelope = await response.json();
  const record = {
    label, seed, status: response.status, elapsed_ms: Date.now() - started,
    content: envelope.message?.content ?? null,
    eval_count: envelope.eval_count ?? null, done_reason: envelope.done_reason ?? null,
    content_sha256: `sha256:${createHash('sha256').update(envelope.message?.content ?? '').digest('hex')}`
  };
  appendFileSync(resolve(here, 'diagnostic-calls.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
  process.stdout.write(`${label} seed=${seed} done=${record.done_reason} eval=${record.eval_count} sha=${record.content_sha256.slice(7, 17)}\n`);
  return record;
}

async function main() {
  const historicalA = roundA.final_behavior;
  const historicalB = roundB.final_behavior;
  writeFileSync(resolve(here, 'diagnostic-design.json'), `${JSON.stringify({
    schema_version: 'affect-cognition-reproducibility-diagnostic-design-v0',
    purpose: 'separate input-driven cross-round divergence from provider nondeterminism; NOT qualification evidence',
    scenario: 'M2', model: MODEL, options: { temperature: 0, num_predict: 2048, num_ctx: 8192 },
    calls_planned: 9,
    round_A_exact_request_sha256: createHash('sha256').update(JSON.stringify(roundA.raw_cognition_request)).digest('hex'),
    round_B_exact_request_sha256: createHash('sha256').update(JSON.stringify(roundB.raw_cognition_request)).digest('hex'),
    round_A_historical_output: historicalA, round_B_historical_output: historicalB
  }, null, 2)}\n`);

  const replaysA = [];
  for (let i = 0; i < 3; i += 1) replaysA.push(await call(roundA, null, `A-replay-${i + 1}`));
  const replaysB = [];
  for (let i = 0; i < 3; i += 1) replaysB.push(await call(roundB, null, `B-replay-${i + 1}`));
  const seeded = [];
  for (let i = 0; i < 3; i += 1) seeded.push(await call(roundB, 42, `B-seeded42-${i + 1}`));

  const matchesA = replaysA.filter((entry) => entry.content === historicalA).length;
  const matchesB = replaysB.filter((entry) => entry.content === historicalB).length;
  const seededIdentical = new Set(seeded.map((entry) => entry.content_sha256)).size === 1;
  const summary = {
    schema_version: 'affect-cognition-reproducibility-diagnostic-summary-v0',
    round_A_replays: replaysA.map((entry) => entry.content),
    round_A_reproduced_historical: `${matchesA}/3`,
    round_B_replays: replaysB.map((entry) => entry.content),
    round_B_reproduced_historical: `${matchesB}/3`,
    round_A_replay_unique_outputs: new Set(replaysA.map((entry) => entry.content)).size,
    round_B_replay_unique_outputs: new Set(replaysB.map((entry) => entry.content)).size,
    seeded_42_replays: seeded.map((entry) => entry.content),
    seeded_42_unique_outputs: new Set(seeded.map((entry) => entry.content)).size,
    seeded_matches_unseeded_B: seeded.some((entry) => entry.content === historicalB),
    interpretation: {
      input_driven: matchesA === 3 && matchesB === 3,
      provider_nondeterministic: matchesA < 3 || matchesB < 3
    }
  };
  writeFileSync(resolve(here, 'diagnostic-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ A_reproduced: summary.round_A_reproduced_historical, B_reproduced: summary.round_B_reproduced_historical, seeded_unique: seededIdentical }, null, 2)}\n`);
}

await main();
