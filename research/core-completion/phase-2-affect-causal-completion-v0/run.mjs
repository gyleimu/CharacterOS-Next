/* globals fetch, URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — live cognition collection (REAL provider).
 *
 * Reads the frozen artifacts, re-derives every condition request from the
 * captured base request, re-attests isolation, then issues REAL cognition calls
 * in the frozen interleaved order. Canonical state is never modified.
 *
 * Usage: node run.mjs stage1|stage2|activation [--fresh]
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OllamaNativeCognitionTransportV0 } from '../../../packages/runtime/dist/index.js';
import {
  ACTIVATION_CONDITIONS,
  ACTIVATION_SCENARIO_IDS,
  CONDITIONS,
  PROVIDER,
  REPLICATES,
  SCENARIOS,
  activationSchedule,
  primarySchedule
} from './lib/config.mjs';
import { hashJson, memorySection, sha256, subjectDataInvariantDigest } from './lib/hash.mjs';
import {
  affectValueLine,
  assertNoExperimentalLabels,
  auditAffectVariant,
  removeAffectSection,
  swapAffectValue,
  verifyAbsentIsBaseMinusAffect
} from './lib/ablation.mjs';
import { parseConversationProposal } from './lib/proposal.mjs';
import { productionRequestHash } from './lib/transports.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
const rawPath = join(evidenceDir, 'raw-cognition.jsonl');
const stage = process.argv[2];
const fresh = process.argv.includes('--fresh');
if (!['stage1', 'stage2', 'activation'].includes(stage)) {
  console.error('usage: node run.mjs stage1|stage2|activation [--fresh]');
  process.exit(2);
}

function readJson(name) {
  return JSON.parse(readFileSync(join(evidenceDir, name), 'utf8'));
}

async function verifyProvider() {
  const response = await fetch(`${PROVIDER.base_url}/api/tags`);
  const body = await response.json();
  const model = (body.models ?? []).find((entry) => entry.name === PROVIDER.model);
  if (model === undefined) throw new Error(`model ${PROVIDER.model} unavailable`);
  if (model.digest !== PROVIDER.required_digest) throw new Error(`digest mismatch: ${model.digest}`);
  return model.digest;
}

function buildConditionRequest(base, conditionId, activation = false) {
  if (activation) {
    const condition = ACTIVATION_CONDITIONS[conditionId];
    return { ...swapAffectValue(base.userContent, affectValueLine(condition.valence, condition.activation)), condition };
  }
  if (conditionId === 'A') return { ...removeAffectSection(base.userContent), condition: CONDITIONS.A };
  const condition = CONDITIONS[conditionId];
  return { ...swapAffectValue(base.userContent, affectValueLine(condition.valence, condition.activation)), condition };
}

function assertIsolation(scenarioId, base, request, conditionId) {
  const audit = auditAffectVariant(base.userContent, request.transformed, request.removedIndices ?? []);
  const absent =
    conditionId === 'A'
      ? verifyAbsentIsBaseMinusAffect(base.userContent, request.transformed, request.removedIndices)
      : { ok: true, reasons: [] };
  const labelsUser = assertNoExperimentalLabels(request.transformed);
  const labelsSystem = assertNoExperimentalLabels(base.systemContent);
  const invariantOk = subjectDataInvariantDigest(request.transformed) === subjectDataInvariantDigest(base.userContent);
  const ok = audit.ok && absent.ok && labelsUser.ok && labelsSystem.ok && invariantOk;
  if (!ok) {
    throw new Error(
      `${scenarioId}/${conditionId} isolation failed: ${[...audit.reasons, ...absent.reasons, ...labelsUser.found, ...labelsSystem.found].join('; ')}`
    );
  }
}

function planFor(stageName) {
  if (stageName === 'stage1') {
    return SCENARIOS.filter((s) => s.stage === 1).map((s) => ({ scenario: s, conditions: primarySchedule(REPLICATES), activation: false }));
  }
  if (stageName === 'stage2') {
    return SCENARIOS.filter((s) => s.stage === 2).map((s) => ({ scenario: s, conditions: primarySchedule(REPLICATES), activation: false }));
  }
  return ACTIVATION_SCENARIO_IDS.map((id) => ({
    scenario: SCENARIOS.find((s) => s.id === id),
    conditions: activationSchedule(REPLICATES),
    activation: true
  }));
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const freeze = readJson('freeze.json');
  const { freeze_hash: recordedHash, ...freezeBody } = freeze;
  if (recordedHash !== hashJson(freezeBody)) throw new Error('freeze.json hash mismatch — artifact was edited');
  const providerDigest = await verifyProvider();
  const baseRequests = readJson('base-requests.json');

  const traces = [];
  const transport = new OllamaNativeCognitionTransportV0({
    base_url: PROVIDER.base_url,
    model: PROVIDER.model,
    timeout_ms: PROVIDER.timeout_ms,
    num_predict: PROVIDER.cognition_num_predict,
    context_window_tokens: PROVIDER.context_window_tokens,
    trace_observer: (event) => {
      if (event.terminal_stage !== undefined) traces.push(event);
    }
  });

  const call = async (systemContent, userContent) => {
    const invoke = async () => {
      const started = Date.now();
      const response = await transport.complete({
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent }
        ]
      });
      return { content: response.content, model: response.model, elapsedMs: Date.now() - started, trace: traces.at(-1) ?? null };
    };
    try {
      return { ...(await invoke()), retried: false };
    } catch (error) {
      return { ...(await invoke()), retried: true, first_error: String(error) };
    }
  };

  // ---- bounded warm-up, OUTSIDE recorded evidence -----------------------------
  const warmupScenario = planFor(stage)[0];
  const warmupBase = baseRequests[warmupScenario.scenario.id];
  const warmupRequest = buildConditionRequest(warmupBase, warmupScenario.conditions[0], warmupScenario.activation);
  const warmup = { stage, calls: 0, examples: [] };
  for (let i = 0; i < 2; i += 1) {
    try {
      const result = await call(warmupBase.systemContent, warmupRequest.transformed);
      warmup.calls += 1;
      warmup.examples.push({ ok: true, sha256: sha256(result.content) });
    } catch (error) {
      warmup.examples.push({ ok: false, error: String(error) });
    }
  }
  writeFileSync(join(evidenceDir, `warmup-${stage}.json`), `${JSON.stringify(warmup, null, 2)}\n`);

  // ---- resume support ----------------------------------------------------------
  const seen = new Set();
  if (!fresh && existsSync(rawPath)) {
    for (const line of readFileSync(rawPath, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const record = JSON.parse(line);
      seen.add(`${record.stage}|${record.scenario}|${record.condition}|${record.replicate}`);
    }
  } else if (fresh) {
    writeFileSync(rawPath, '');
  }

  let issued = 0;
  let skipped = 0;
  for (const { scenario, conditions, activation } of planFor(stage)) {
    const base = baseRequests[scenario.id];
    for (let index = 0; index < conditions.length; index += 1) {
      const conditionId = conditions[index];
      const replicate = Math.floor(index / (activation ? 2 : 4));
      const key = `${stage}|${scenario.id}|${conditionId}|${replicate}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      const request = buildConditionRequest(base, conditionId, activation);
      assertIsolation(scenario.id, base, request, conditionId);
      const result = await call(base.systemContent, request.transformed);
      const parsed = parseConversationProposal(result.content, base.projectionHash);
      const record = {
        stage,
        scenario: scenario.id,
        role: scenario.role,
        condition: conditionId,
        condition_values: request.condition,
        activation_experiment: activation,
        replicate,
        schedule_index: index,
        provider_digest: providerDigest,
        user_sha256: sha256(request.transformed),
        request_hash: productionRequestHash({
          model: PROVIDER.model,
          systemContent: base.systemContent,
          userContent: request.transformed,
          numPredict: PROVIDER.cognition_num_predict,
          contextWindowTokens: PROVIDER.context_window_tokens
        }),
        memory_section_sha256: sha256(memorySection(request.transformed)),
        invariant_digest: subjectDataInvariantDigest(request.transformed),
        affect_section: conditionId === 'A' ? [] : [request.replacement],
        removed_indices: request.removedIndices ?? [],
        retried: result.retried ?? false,
        latency_ms: result.elapsedMs ?? null,
        model: result.model,
        transport_request_hash: result.trace?.request_hash ?? null,
        transport_request_bytes: result.trace?.request_bytes ?? null,
        num_ctx: result.trace?.budget?.context_window_tokens ?? null,
        max_output_tokens: result.trace?.budget?.max_output_tokens ?? null,
        ollama: result.trace?.ollama ?? null,
        raw_response: result.content,
        schema_valid: parsed.ok,
        parse_error: parsed.ok ? null : parsed.error,
        directive: parsed.ok ? parsed.proposal.communication_directive.kind : null,
        current_intent: parsed.ok ? parsed.proposal.cognition.current_intent : null,
        confidence: parsed.ok ? parsed.proposal.cognition.confidence : null,
        uncertainty: parsed.ok ? parsed.proposal.cognition.uncertainty : null,
        action_intent: parsed.ok ? parsed.proposal.cognition.action_intent : null,
        reasoning_summary: parsed.ok ? parsed.proposal.cognition.reasoning_summary : null
      };
      appendFileSync(rawPath, `${JSON.stringify(record)}\n`);
      issued += 1;
      console.log(
        `[${stage}] ${scenario.id} ${conditionId} r${replicate} -> ${record.schema_valid ? `${record.directive} / ${JSON.stringify(record.current_intent)}` : `INVALID(${record.parse_error})`} ${record.latency_ms}ms`
      );
    }
  }
  writeFileSync(
    join(evidenceDir, `collection-${stage}.json`),
    `${JSON.stringify({ stage, provider_digest: providerDigest, issued, skipped, warmup_calls: warmup.calls, total_recorded: seen.size + issued }, null, 2)}\n`
  );
  console.log(`[${stage}] issued=${issued} skipped=${skipped} warmup=${warmup.calls}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
