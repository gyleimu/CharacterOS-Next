/* globals URL */
/**
 * PHASE B — live cognition A/B/C with the REAL local provider (fresh process).
 *
 * For each frozen scenario the harness restores the on-disk snapshot
 * authoritatively, runs the current event through the REAL production lifecycle
 * once (the FULL cognition call is captured pass-through), then issues the
 * pre-frozen ablated variants as separate REAL calls against the same transport.
 *
 * Only research harness code changes; no canonical state is fabricated and the
 * production runtime is used unmodified.
 *
 * Usage: node run.mjs
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractiveSubjectRuntimeV0,
  OllamaNativeCognitionTransportV0,
  createInteractiveSubjectSeedV0
} from '../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from './lib/appraisal.mjs';
import { memorySection, sha256 } from './lib/hash.mjs';
import { recordingCognitionTransport, productionRequestHash, validLanguageStub } from './lib/transports.mjs';
import { ablateAffectOnly, ablateAllDesignated, swapAffectLine } from './lib/ablation.mjs';
import { parseConversationProposal } from './lib/proposal.mjs';
import {
  FROZEN_CLOCK,
  INTERVAL_TICKS,
  PROVIDER,
  REPEAT_SCENARIOS,
  SCENARIOS,
  SUBJECT_ID,
  SWAP_PAIRS
} from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const snapshotsDir = join(root, 'evidence', 'snapshots');
const DRY_RUN = process.env.ABLATION_DRY === '1';
const evidenceDir = DRY_RUN ? join(root, 'evidence-dry') : join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });
const callsPath = join(evidenceDir, 'raw-calls.jsonl');

const traces = [];

function dryTransport() {
  return {
    complete: async (request) => {
      const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v1',
          cognition: {
            schema_version: 'cognition-proposal-v0',
            projection_hash: projectionHash,
            reasoning_summary: 'dry run',
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: 'respond to the user',
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: 'CLARIFY_MISSING_CONTEXT' }
        }),
        model: 'dry'
      };
    }
  };
}

const realTransport = DRY_RUN
  ? dryTransport()
  : new OllamaNativeCognitionTransportV0({
      base_url: PROVIDER.base_url,
      model: PROVIDER.model,
      timeout_ms: PROVIDER.timeout_ms,
      num_predict: PROVIDER.cognition_num_predict,
      context_window_tokens: PROVIDER.context_window_tokens,
      trace_observer: (event) => {
        if (event.terminal_stage !== undefined && event.request_hash !== undefined) traces.push(event);
      }
    });

function liveOptions(cognitionTransport) {
  return {
    session_id: 'sess-non-memory-ablation-live',
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport,
    languageTransport: validLanguageStub(),
    factualEventAppraisalProvider: contentSensitiveAppraisalProvider(),
    interval_ticks: INTERVAL_TICKS,
    provider_identity: {
      model: PROVIDER.model,
      num_predict: PROVIDER.cognition_num_predict,
      context_window_tokens: PROVIDER.context_window_tokens
    },
    clock: () => FROZEN_CLOCK
  };
}

/** ONE real call; a thrown provider-infrastructure failure is retried at most
 * once and the retry is disclosed in the record. */
async function callDirect(systemContent, userContent) {
  const invoke = async () => {
    const started = Date.now();
    const response = await realTransport.complete({
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
    const retry = await invoke();
    return { ...retry, retried: true, first_error: String(error) };
  }
}

function digestCall({ scenario, condition, systemContent, userContent, projectionHash, result, note }) {
  const requestHash = productionRequestHash({
    model: PROVIDER.model,
    systemContent,
    userContent,
    numPredict: PROVIDER.cognition_num_predict,
    contextWindowTokens: PROVIDER.context_window_tokens
  });
  const parsed = parseConversationProposal(result.content, projectionHash);
  return {
    scenario,
    condition,
    note: note ?? null,
    retried: result.retried ?? false,
    user_sha256: sha256(userContent),
    request_hash: requestHash,
    memory_section_sha256: sha256(memorySection(userContent)),
    affect_line: /\[affect \(canonical\)\][^\n]*/.exec(userContent)?.[0] ?? null,
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
    reasoning_summary: parsed.ok ? parsed.proposal.cognition.reasoning_summary : null,
    relevant_memory_refs: parsed.ok ? parsed.proposal.cognition.relevant_memory_refs : null,
    projection_hash: projectionHash
  };
}

async function main() {
  rmSync(callsPath, { force: true });
  const scenarios = {};
  const allCalls = [];

  for (const scenario of SCENARIOS) {
    const snapshot = JSON.parse(readFileSync(join(snapshotsDir, `${scenario.history}.json`), 'utf8'));
    const sink = [];
    const runtime = await InteractiveSubjectRuntimeV0.restore(
      liveOptions(recordingCognitionTransport(realTransport, sink)),
      snapshot
    );
    const statusBefore = await runtime.status();
    const outcome = await runtime.submitUserText(scenario.event);
    if (outcome.status !== 'COMPLETE') throw new Error(`${scenario.id} live turn FAILED: ${outcome.failure}`);
    const captured = sink.at(-1);
    const fullTrace = traces.at(-1) ?? null;
    const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(captured.userContent)?.[1] ?? '';

    const fullCall = digestCall({
      scenario: scenario.id,
      condition: 'A_FULL',
      systemContent: captured.systemContent,
      userContent: captured.userContent,
      projectionHash,
      result: { content: outcome.raw_cognition_response ?? '', model: PROVIDER.model, elapsedMs: fullTrace?.elapsed_ms ?? null, trace: fullTrace }
    });
    fullCall.production_request_hash_match = fullCall.request_hash === outcome.provider_request_hash;

    const b = ablateAllDesignated(captured.userContent);
    const c = ablateAffectOnly(captured.userContent);

    const bCall = digestCall({
      scenario: scenario.id,
      condition: 'B_MEMORY_ONLY_ALL',
      systemContent: captured.systemContent,
      userContent: b.ablated,
      projectionHash,
      result: await callDirect(captured.systemContent, b.ablated)
    });
    const cCall = digestCall({
      scenario: scenario.id,
      condition: 'C_MEMORY_ONLY_AFFECT_ONLY',
      systemContent: captured.systemContent,
      userContent: c.ablated,
      projectionHash,
      result: await callDirect(captured.systemContent, c.ablated)
    });

    const record = {
      id: scenario.id,
      history: scenario.history,
      category: scenario.category,
      event: scenario.event,
      expected_direction: scenario.expected_direction,
      relevant_state: scenario.relevant_state,
      restored_origin: statusBefore.origin,
      affect_before_turn: statusBefore.affect,
      outcome_directive: outcome.directive,
      outcome_current_intent: outcome.current_intent,
      provider_memory_section_present: outcome.provider_memory_section_present,
      provider_request_identity_match: outcome.provider_request_identity_match,
      full_system_content: captured.systemContent,
      full_user_content: captured.userContent,
      b_user_content: b.ablated,
      affects_line: fullCall.affect_line,
      full: fullCall,
      b: bCall,
      c: cCall,
      repeat_a: null,
      repeat_b: null,
      swap: null
    };

    if (REPEAT_SCENARIOS.includes(scenario.id)) {
      record.repeat_a = digestCall({
        scenario: scenario.id,
        condition: 'A_FULL_REPEAT',
        systemContent: captured.systemContent,
        userContent: captured.userContent,
        projectionHash,
        result: await callDirect(captured.systemContent, captured.userContent)
      });
      record.repeat_b = digestCall({
        scenario: scenario.id,
        condition: 'B_MEMORY_ONLY_ALL_REPEAT',
        systemContent: captured.systemContent,
        userContent: b.ablated,
        projectionHash,
        result: await callDirect(captured.systemContent, b.ablated)
      });
    }

    scenarios[scenario.id] = record;
    console.log(
      `${scenario.id}: A=${fullCall.directive}/${JSON.stringify(fullCall.current_intent)} | ` +
        `B=${bCall.directive}/${JSON.stringify(bCall.current_intent)} | C=${cCall.directive}/${JSON.stringify(cCall.current_intent)} | ` +
        `${fullCall.latency_ms ?? '?'}ms hashMatch=${fullCall.production_request_hash_match}`
    );
  }

  for (const { id, borrow_affect_from } of SWAP_PAIRS) {
    const target = scenarios[id];
    const donor = scenarios[borrow_affect_from];
    const swapped = swapAffectLine(target.full_user_content, donor.full.affect_line);
    const call = digestCall({
      scenario: id,
      condition: 'X_RESEARCH_COUNTERFACTUAL_ONLY',
      note: `affect borrowed from ${borrow_affect_from}`,
      systemContent: target.full_system_content,
      userContent: swapped.swapped,
      projectionHash: target.full.projection_hash,
      result: await callDirect(target.full_system_content, swapped.swapped)
    });
    call.original_affect_line = swapped.original;
    call.replacement_affect_line = swapped.replacement;
    target.swap = call;
    console.log(`SWAP ${id}<-${borrow_affect_from}: ${call.directive}/${JSON.stringify(call.current_intent)}`);
  }

  for (const record of Object.values(scenarios)) {
    allCalls.push(record.full, record.b, record.c);
    if (record.repeat_a) allCalls.push(record.repeat_a);
    if (record.repeat_b) allCalls.push(record.repeat_b);
    if (record.swap) allCalls.push(record.swap);
  }
  writeFileSync(callsPath, `${allCalls.map((call) => JSON.stringify(call)).join('\n')}\n`);
  writeFileSync(
    join(evidenceDir, 'phase-b.json'),
    `${JSON.stringify(
      {
        schema_version: 'non-memory-ablation-phase-b-v0',
        provider: PROVIDER,
        total_cognition_calls: allCalls.length,
        valid_calls: allCalls.filter((call) => call.schema_valid).length,
        retried_calls: allCalls.filter((call) => call.retried).length,
        production_hash_matches: allCalls.filter((call) => call.production_request_hash_match === true).length,
        scenarios
      },
      null,
      2
    )}\n`
  );
  console.log(`phase-b: ${allCalls.length} real cognition calls; valid=${allCalls.filter((call) => call.schema_valid).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
