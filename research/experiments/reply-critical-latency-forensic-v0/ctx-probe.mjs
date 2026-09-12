/* globals URL, AbortSignal, performance, fetch */
/**
 * REPLY_CRITICAL_LATENCY_FORENSIC_V0 — bounded Ollama runner-churn probe.
 *
 * Hypothesis: the product sends the SAME model with two different option sets
 * (`num_ctx` 4096 for Appraisal, 8192 for Cognition/Language), and Ollama must
 * rebuild its runner whenever the option set alternates, paying ~9-10 s of
 * `load_duration` per switch.
 *
 * This probe issues the same short prompt repeatedly while alternating and then
 * holding `num_ctx`, recording Ollama's own timing metadata and the resident
 * runner's CONTEXT as reported by `ollama ps`. Bounded: 5 calls.
 */

import { appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
const ENDPOINT = 'http://127.0.0.1:11434';
const MODEL = 'qwen3.5:9b';
const PROMPT =
  'Respond with EXACTLY one JSON object and nothing else: {"relevance":<0..1>,"goal_congruence":<0..1>,"attribution":"self"|"other"|"situation","controllability":<0..1>,"uncertainty":<0..1>,"intensity":<0..1>,"assessment_confidence":<0..1>}. ' +
  'Event: the user says hello. Task: respond to the user.';

// Deliberately mirrors the product's two option sets.
const SEQUENCE = [
  { label: 'CTX_8192_a', num_ctx: 8192 },
  { label: 'CTX_8192_b', num_ctx: 8192 },
  { label: 'CTX_4096_a', num_ctx: 4096 },
  { label: 'CTX_4096_b', num_ctx: 4096 },
  { label: 'CTX_8192_c', num_ctx: 8192 }
];

function psContext() {
  try {
    const line = execFileSync('ollama', ['ps'], { encoding: 'utf8' }).split('\n').find((l) => l.includes(MODEL));
    return line === undefined ? '(none)' : line.trim().replace(/\s+/g, ' ');
  } catch {
    return 'UNKNOWN';
  }
}

const rows = [];
for (const step of SEQUENCE) {
  const started = performance.now();
  const response = await fetch(`${ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: PROMPT }],
      think: false,
      stream: false,
      options: { temperature: 0, num_predict: 64, num_ctx: step.num_ctx }
    }),
    signal: AbortSignal.timeout(180000)
  });
  const json = await response.json();
  const clientMs = performance.now() - started;
  const row = {
    label: step.label,
    num_ctx: step.num_ctx,
    client_ms: +clientMs.toFixed(1),
    total_duration_ms: +(json.total_duration / 1e6).toFixed(1),
    load_duration_ms: +(json.load_duration / 1e6).toFixed(1),
    prompt_eval_count: json.prompt_eval_count,
    prompt_eval_duration_ms: +(json.prompt_eval_duration / 1e6).toFixed(1),
    eval_count: json.eval_count,
    eval_duration_ms: +(json.eval_duration / 1e6).toFixed(1),
    ollama_ps: psContext()
  };
  rows.push(row);
  appendFileSync(join(root, 'ctx-probe.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
}

const loadByCtx = (value) =>
  rows.filter((r) => r.num_ctx === value).map((r) => r.load_duration_ms);
writeFileSync(
  join(root, 'ctx-probe-summary.json'),
  JSON.stringify(
    {
      hypothesis: 'alternating num_ctx rebuilds the Ollama runner and pays load_duration per switch',
      sequence: SEQUENCE,
      rows,
      load_ms_by_ctx: { 8192: loadByCtx(8192), 4096: loadByCtx(4096) },
      prompt_eval_counts: rows.map((r) => r.prompt_eval_count)
    },
    null,
    2
  ) + '\n'
);
