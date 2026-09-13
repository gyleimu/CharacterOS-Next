/**
 * Lawful world construction + production request capture.
 *
 * The subject runtime is used UNMODIFIED. A deterministic stub transport is used
 * only to obtain the exact production-rendered cognition request; it is never
 * counted as evidence. The persistent snapshot artifact is read-only.
 */

import { readFileSync } from 'node:fs';

import {
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0
} from '../../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from './appraisal.mjs';
import { recordingCognitionTransport, stubCognitionTransport, validLanguageStub } from './transports.mjs';
import { FROZEN_CLOCK, INTERVAL_TICKS, PROVIDER, SUBJECT_ID } from './config.mjs';

export function runtimeOptions(cognitionTransport, sessionId, languageTransport = validLanguageStub()) {
  return {
    session_id: sessionId,
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport,
    languageTransport,
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

/** Grow the lawful lived history once (deterministic stub; no real calls). */
export async function growSnapshot(historyEvents) {
  const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions(stubCognitionTransport(), 'sess-affect-grow'));
  for (const event of historyEvents) {
    const outcome = await runtime.submitUserText(event);
    if (outcome.status !== 'COMPLETE') throw new Error(`grow turn failed: ${outcome.failure}`);
  }
  return runtime.snapshot();
}

/**
 * Restore the snapshot, run ONE scenario event through the real production
 * lifecycle with a stub transport, and capture the exact rendered cognition
 * request. Returns the capture plus the lawful pre-turn affect (informational).
 */
export async function captureScenarioRequest(snapshot, scenario, sessionId) {
  const sink = [];
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(recordingCognitionTransport(stubCognitionTransport(), sink), sessionId),
    JSON.parse(JSON.stringify(snapshot))
  );
  const statusBefore = await runtime.status();
  const outcome = await runtime.submitUserText(scenario.event);
  if (outcome.status !== 'COMPLETE') {
    throw new Error(`${scenario.id} capture turn FAILED: ${outcome.failure}`);
  }
  const captured = sink.at(-1);
  if (captured === undefined) throw new Error(`${scenario.id}: no cognition request captured`);
  const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(captured.userContent)?.[1] ?? '';
  if (projectionHash === '') throw new Error(`${scenario.id}: projection_hash missing from captured request`);
  return {
    systemContent: captured.systemContent,
    userContent: captured.userContent,
    projectionHash,
    affect_before_turn: statusBefore.affect,
    provider_memory_section_present: outcome.provider_memory_section_present,
    retrieved_ref_count: outcome.retrieved_refs.length
  };
}

export function readSnapshotFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
