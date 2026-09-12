/* globals URL, Buffer, performance, fetch */
/**
 * REPLY_CRITICAL_LATENCY_FORENSIC_V0 — bounded real-provider latency forensic.
 *
 * Runs real product turns through the real product runtime (`createProductRuntimeV0`)
 * against the local Ollama provider while capturing, per model call:
 *   - the exact wire request body (for stage classification and prompt-size audit)
 *   - Ollama's native timing metadata (total/load/prompt_eval/eval durations + counts)
 *   - client wall time (for transport/host overhead)
 *
 * It never modifies product code, never writes canonical state outside its own
 * isolated data root, and stores only sizes/counts/timings — no prompt or Memory
 * text — in its evidence files.
 *
 * Usage:
 *   node harness.mjs --cold      # one bounded cold-start probe, then exit
 *   node harness.mjs --run N     # N complete real turns (reuse flag from env)
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { createProductRuntimeV0 } from '../../../product/sandbox/dist/product-runtime.js';
import { PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0 } from '../../../product/sandbox/dist/product-appraisal-prompt.js';
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V1 } from '../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js';
import { LANGUAGE_REALIZATION_SYSTEM_PROMPT_V0 } from '../../../packages/runtime/dist/providers/behavior/language-realization-provider.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const DATA_ROOT = join(root, 'data-root');
const sha = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

const SYSTEM_SIGNATURES = new Map([
  [sha(PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0), 'APPRAISAL'],
  [sha(CONVERSATION_COGNITION_SYSTEM_PROMPT_V1), 'COGNITION'],
  [sha(LANGUAGE_REALIZATION_SYSTEM_PROMPT_V0), 'LANGUAGE']
]);

function classify(systemContent) {
  return SYSTEM_SIGNATURES.get(sha(systemContent)) ?? 'OTHER_ADAPTATION';
}

const TURNS = [
  'My sister called this morning to say the surgery went well. I had barely slept while waiting, and now I feel relieved and shaky.',
  'I still have to prepare for tomorrow, but I keep thinking about the call.',
  'Thank you. I think I can rest now.'
];

function psSnapshot() {
  try {
    return execFileSync('ollama', ['ps'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function gpuSnapshot() {
  try {
    const out = execFileSync(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu,clocks.sm,pstate', '--format=csv,noheader'],
      { encoding: 'utf8' }
    ).trim();
    return out;
  } catch {
    return 'UNKNOWN';
  }
}

/** Prompt-section audit for the cognition projection (character counts only). */
function sectionAudit(userContent) {
  const lines = userContent.split('\n');
  const sections = new Map();
  let current = 'HEADER';
  for (const line of lines) {
    const match = /^\[([^\]]+)\]/.exec(line);
    if (match !== null) current = match[1].slice(0, 48);
    sections.set(current, (sections.get(current) ?? 0) + line.length + 1);
  }
  return Object.fromEntries([...sections.entries()].sort((a, b) => b[1] - a[1]));
}

function installFetchCapture(calls, label) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (endpoint, init) => {
    if (!String(endpoint).includes('/api/chat')) return originalFetch(endpoint, init);
    const started = performance.now();
    const body = JSON.parse(init.body);
    let response = null;
    let json = null;
    let fetchError = null;
    try {
      response = await originalFetch(endpoint, init);
      json = await response.clone().json();
    } catch (error) {
      // A timed-out / failed call is recorded too, so a failed turn can be
      // attributed to a real provider failure rather than vanishing from evidence.
      fetchError = { name: error?.name ?? 'Error', message: String(error?.message ?? error) };
    }
    const ended = performance.now();
    const system = body.messages?.[0]?.content ?? '';
    const user = body.messages?.[1]?.content ?? '';
    const stage = classify(system);
    const call = {
      label,
      at: new Date().toISOString(),
      stage,
      system_chars: system.length,
      user_chars: user.length,
      request_bytes: Buffer.byteLength(init.body),
      message_count: body.messages.length,
      model: body.model,
      think: body.think ?? null,
      stream: body.stream ?? null,
      options: body.options ?? null,
      client_ms: +(ended - started).toFixed(3),
      fetch_error: fetchError,
      ollama: json === null ? {
        total_duration_ms: null,
        load_duration_ms: null,
        prompt_eval_count: null,
        prompt_eval_duration_ms: null,
        eval_count: null,
        eval_duration_ms: null,
        done_reason: null
      } : {
        total_duration_ms: json.total_duration === undefined ? null : +(json.total_duration / 1e6).toFixed(3),
        load_duration_ms: json.load_duration === undefined ? null : +(json.load_duration / 1e6).toFixed(3),
        prompt_eval_count: json.prompt_eval_count ?? null,
        prompt_eval_duration_ms: json.prompt_eval_duration === undefined ? null : +(json.prompt_eval_duration / 1e6).toFixed(3),
        eval_count: json.eval_count ?? null,
        eval_duration_ms: json.eval_duration === undefined ? null : +(json.eval_duration / 1e6).toFixed(3),
        done_reason: json.done_reason ?? null
      }
    };
    if (stage === 'COGNITION') call.cognition_sections = sectionAudit(user);
    call.sha256_first_message = sha(system);
    // Validity/size only (never content): lets a failed turn be attributed to a
    // model-output schema violation rather than to the harness.
    const content = json.message?.content;
    call.content_chars = typeof content === 'string' ? content.length : null;
    call.content_sha256 = typeof content === 'string' ? sha(content) : null;
    if (typeof content === 'string' && stage === 'APPRAISAL') {
      try {
        const keys = Object.keys(JSON.parse(content)).sort().join(',');
        call.appraisal_key_set_valid =
          keys ===
          'assessment_confidence,attribution,controllability,goal_congruence,intensity,relevance,uncertainty';
      } catch {
        call.appraisal_key_set_valid = false;
      }
    }
    calls.push(call);
    appendFileSync(join(root, 'calls.jsonl'), JSON.stringify(call) + '\n');
    if (fetchError !== null) {
      throw Object.assign(new Error(fetchError.message), { name: fetchError.name });
    }
    return response;
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function main() {
  const mode = process.argv[2];
  const reuseFlag = process.env.CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE ?? '(unset)';
  if (!existsSync(join(root, 'calls.jsonl')) && mode === '--cold') {
    mkdirSync(root, { recursive: true });
  }
  const calls = [];
  const meta = {
    started_at: new Date().toISOString(),
    mode,
    reuse_flag: reuseFlag,
    ollama_version: await (await fetch('http://127.0.0.1:11434/api/version')).json(),
    ollama_ps_before: psSnapshot(),
    gpu_before: gpuSnapshot(),
    data_root: DATA_ROOT
  };

  // Drive the real product runtime (reuse flag comes from the ambient environment).
  // A failed turn marks the runtime failed (product behavior: relaunch required),
  // so the harness reopens it exactly as a user would — measuring real product
  // behavior rather than bypassing it.
  let relaunches = 0;
  const openRuntime = () =>
    createProductRuntimeV0({
      data_root: DATA_ROOT,
      subject: { display_name: 'Forensic' },
      session_label: 'latency-forensic',
      write: () => undefined
    });
  let runtime = await openRuntime();
  const bootstrap = await runtime.bootstrap();
  meta.subject_id = bootstrap.identity.subject_id;
  meta.subject_status = bootstrap.status;
  meta.model = bootstrap.provider.model;
  meta.endpoint = bootstrap.provider.endpoint;
  meta.config_reuse = runtime.configView().appraisal_exact_input_reuse;

  const restore = installFetchCapture(calls, mode);
  const turns = [];
  try {
    if (mode === '--cold') {
      // One call only, from an idle/evicted model state, to observe load_duration.
      const before = calls.length;
      const result = await runtime.submitHumanText(TURNS[0]);
      turns.push({
        turn: 0,
        label: 'COLD',
        status: result.outcome.status,
        calls: calls.slice(before).map((c) => ({ stage: c.stage, client_ms: c.client_ms, ollama: c.ollama })),
        model_load_total_ms: calls.slice(before).reduce((sum, c) => sum + (c.ollama.load_duration_ms ?? 0), 0)
      });
    } else {
      // Adaptive but strictly bounded: collect up to 3 COMPLETE turns, never
      // exceeding 6 attempts (a turn whose Appraisal output violates the closed
      // schema fails its own turn — real product behavior, not a harness defect).
      const targetComplete = 3;
      const maxAttempts = 6;
      let complete = 0;
      for (let index = 0; index < maxAttempts && complete < targetComplete; index += 1) {
        const before = calls.length;
        const started = performance.now();
        let result;
        try {
          result = await runtime.submitHumanText(TURNS[index % TURNS.length]);
        } catch (error) {
          // Failed runtime: reopen (fresh process semantics) and retry this input
          // only if the attempt budget still allows it.
          relaunches += 1;
          await runtime.shutdown();
          runtime = await openRuntime();
          turns.push({
            turn: index,
            label: `WARM_${index + 1}`,
            status: 'RUNTIME_RELAUNCHED',
            failure: (error instanceof Error ? error.message : String(error)).slice(0, 160),
            calls: calls.slice(before).map((c) => ({ stage: c.stage, client_ms: c.client_ms, ollama: c.ollama }))
          });
          continue;
        }
        const elapsed = performance.now() - started;
        const timing = runtime.diagnosticsView()?.provider?.last_turn ?? null;
        if (result.outcome.status === 'COMPLETE') complete += 1;
        turns.push({
          turn: index,
          label: `WARM_${index + 1}`,
          status: result.outcome.status,
          failure: result.outcome.status === 'FAILED' ? (result.outcome.failure ?? '').slice(0, 160) : null,
          wall_ms: +elapsed.toFixed(1),
          provider_ms: timing?.provider_ms ?? null,
          reply_ms: timing?.reply_ms ?? null,
          prior_reply_ms: timing?.prior_reply_ms ?? null,
          adaptation_ms: timing?.adaptation_ms ?? null,
          skipped: timing?.skipped ?? [],
          reuse: runtime.diagnosticsView()?.appraisal_inference ?? null,
          calls: calls.slice(before).map((c) => ({
            stage: c.stage,
            client_ms: c.client_ms,
            ollama: c.ollama,
            appraisal_key_set_valid: c.appraisal_key_set_valid ?? null
          }))
        });
      }
    }
  } finally {
    restore();
  }
  meta.ollama_ps_after = psSnapshot();
  meta.gpu_after = gpuSnapshot();
  meta.calls = calls.length;
  meta.relaunches = relaunches;
  meta.finished_at = new Date().toISOString();
  await runtime.shutdown();

  const suffix = mode === '--cold' ? 'cold' : `run-${process.argv[3] ?? '3'}`;
  writeFileSync(join(root, `meta-${suffix}.json`), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(root, `turns-${suffix}.json`), JSON.stringify(turns, null, 2) + '\n');
  console.log(JSON.stringify({ mode: suffix, calls: calls.length, turns: turns.map((t) => ({ label: t.label, status: t.status, wall_ms: t.wall_ms ?? null })) }));
}

await main();
