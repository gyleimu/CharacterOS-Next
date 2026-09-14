/**
 * AFFECT_COGNITION_C3_REVALIDATION_V0 — rejection forensic (ZERO model calls).
 *
 * The runtime surfaces cognition-stage failures as a generic fail-closed message,
 * so the host's exact rejection reason is not in the evidence. This diagnostic
 * replays the ALREADY RECORDED raw provider responses (byte-identical, read from
 * the immutable qualification evidence) through the production runtime, capturing
 * the real projection and the provider's own rejection code by patching the
 * provider prototype's `propose` — the runtime constructs that provider itself
 * from the same module instance.
 *
 * It issues no model calls: the transport returns the recorded bytes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConversationCognitionProviderV4 } from '../../../packages/runtime/dist/index.js';
import { QUALIFICATION_SCENARIOS } from './lib/config.mjs';
import { runCondition } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rows = readFileSync(resolve(here, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const freeze = JSON.parse(readFileSync(resolve(here, 'qualification-freeze.json'), 'utf8'));
const snapshot = JSON.parse(readFileSync(resolve(here, 'snapshot.json'), 'utf8'));

const captured = [];
const original = ConversationCognitionProviderV4.prototype.propose;
ConversationCognitionProviderV4.prototype.propose = async function patched(projection) {
  const entry = { projection_hash: projection.projection_hash, subject_id: projection.subject_id, state_revision: projection.state_revision, error: null };
  captured.push(entry);
  try {
    return await original.call(this, projection);
  } catch (error) {
    entry.error = { name: error?.name ?? null, code: error?.code ?? null, message: error?.message ?? String(error) };
    throw error;
  }
};

const targets = process.argv.slice(2);
const selected = rows.filter((row) => (targets.length === 0 ? row.status === 'FAILED' : targets.includes(row.scenario)));
const output = [];
for (const row of selected) {
  captured.length = 0;
  const transport = { complete: async () => ({ content: row.raw_cognition_response, model: 'replay-recorded' }) };
  const replay = await runCondition({
    snapshot,
    scenario: QUALIFICATION_SCENARIOS.find((entry) => entry.id === row.scenario),
    conditionId: 'A',
    cognitionTransport: transport,
    languageTransport: { complete: async () => ({ content: row.raw_language_response ?? '{}', model: 'replay-recorded' }) },
    sessionId: freeze.opaque_session_ids[row.scenario][row.replicate]
  });
  output.push({
    scenario: row.scenario, replicate: row.replicate,
    original_status: row.status, replay_status: replay.status,
    projection_hash_matches: captured[0]?.projection_hash === row.raw_cognition_request?.messages?.find((m) => m.role === 'user')?.content?.match(/\[projection_hash\]\s+(\S+)/)?.[1],
    rejection: captured[0]?.error ?? null,
    stance: row.subjective_choice?.stance ?? null,
    offending_refs: [...new Set([...(row.raw_cognition_response ?? '').matchAll(/(?:subject|environment):[A-Za-z0-9._-]+/g)].map((match) => match[0]))]
  });
  process.stdout.write(`${row.scenario}/${row.replicate} original=${row.status} replay=${replay.status} rejection=${captured[0]?.error?.code ?? 'none'} detail=${(captured[0]?.error?.message ?? '').slice(0, 200)}\n`);
}
const artifact = {
  schema_version: 'affect-cognition-c3-rejection-forensic-v0',
  method: 'recorded raw provider responses replayed through the production runtime with the provider prototype patched to capture the exact projection and rejection code',
  model_calls: 0,
  replays_matching_original_outcome: output.filter((entry) => entry.original_status === entry.replay_status).length,
  replays: output
};
writeFileSync(resolve(here, 'rejection-forensic.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ model_calls: 0, replays: output.length, matching: artifact.replays_matching_original_outcome }, null, 2)}\n`);
