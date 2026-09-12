/* globals URL */
/**
 * CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 — deterministic end-to-end trace.
 *
 * ZERO real model calls. Two segments:
 *   A. Human lifecycle: genesis → normal interactions → Memory → lawful Affect
 *      change → cognition projection (canonical affect value + frozen legend) →
 *      snapshot → fresh restore → EXACT round-trip.
 *   B. External structured observation: FIRST → REPLAY (+0) → CONFLICT
 *      (fail closed) → persist → fresh-process restore → REPLAY again (+0).
 *
 * Usage (after `pnpm build`): node trace.mjs
 */

import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ExplicitV4SessionAuthorityV0,
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0
} from '../../../packages/runtime/dist/index.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const CLOCK = '2026-01-01T00:00:00.000Z';
const SUBJECT_ID = 'phase1-trace-subject';

const EVENTS = [
  'That worked exactly as I hoped. Thank you.',
  "Please don't do that again; it caused a problem."
];

function contentSensitiveAppraisal() {
  return {
    proposeFactualEventAppraisal: async (ctx) => {
      const scene = String(ctx.current_observable_scene ?? '').toLowerCase();
      const incongruent = /worse|didn't work|don't|stop|problem|harder/.test(scene);
      const congruent = /worked|hoped|helped|useful|thanks|well/.test(scene);
      return {
        schema_version: 'factual-event-appraisal-proposal-v0',
        status: 'APPRAISED',
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.8,
          goal_congruence: incongruent ? 0.05 : congruent ? 0.95 : 0.5,
          attribution: 'other',
          controllability: 0.3,
          uncertainty: 0.2,
          intensity: incongruent ? 0.9 : congruent ? 0.7 : 0.4
        },
        assessment_confidence: 0.8,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  };
}

const calls = [];
function cognitionTransport() {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
      const affectLine = /^\[affect \(canonical\)\] valence=\S+ activation=\S+$/m.exec(user)?.[0] ?? null;
      const legendLine = /^\[affect \(canonical\) legend\][^\n]*$/m.exec(user)?.[0] ?? null;
      calls.push({
        projection_hash: projectionHash,
        affect_line_at_cognition: affectLine,
        affect_legend_at_cognition: legendLine,
        cognition_request_sha256: `sha256:${createHash('sha256').update(JSON.stringify(request.messages)).digest('hex')}`,
        memory_section_present: user.includes('[PRIOR FACTUAL MEMORY'),
        user_content: user
      });
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v1',
          cognition: {
            schema_version: 'cognition-proposal-v0',
            projection_hash: projectionHash,
            reasoning_summary: 'phase1 trace',
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
        model: 'stub'
      };
    }
  };
}

const languageStub = {
  complete: async (request) => {
    const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
    const inputHash = /input_hash: (\S+)/.exec(user)?.[1] ?? '';
    return {
      content: JSON.stringify({ schema_version: 'language-realization-draft-v0', input_hash: inputHash, text: '[stub]', evidence_refs: [] }),
      model: 'stub'
    };
  }
};

function humanOptions() {
  return {
    session_id: 'sess-phase1-trace',
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport(),
    languageTransport: languageStub,
    factualEventAppraisalProvider: contentSensitiveAppraisal(),
    interval_ticks: 1,
    provider_identity: { model: 'stub', num_predict: 2048 },
    clock: () => CLOCK
  };
}

function observationOptions() {
  return {
    subject: { subject_id: 'phase1-extobs-subject', display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0('phase1-extobs-subject'),
    conversationCognitionTransport: { complete: async () => { throw new Error('external observation must not call a model'); } },
    languageTransport: { complete: async () => { throw new Error('external observation must not call a model'); } },
    factualEventAppraisalProvider: { proposeFactualEventAppraisal: async () => { throw new Error('external observation must not appraise'); } },
    clock: () => CLOCK
  };
}

function observationInput(scene) {
  return {
    observation_id: 'observation:phase1-trace-1',
    source_refs: ['source:sensor-a'],
    external_refs: ['event:external-1'],
    entity_refs: ['entity:alice'],
    scene,
    task: null,
    focus_refs: ['entity:alice'],
    environment_refs: [],
    declaredSalience: 0.5
  };
}

async function segmentA() {
  const runtime = await InteractiveSubjectRuntimeV0.create(humanOptions());
  const turns = [];
  for (let i = 0; i < EVENTS.length; i += 1) {
    const before = await runtime.status();
    const callIndex = calls.length;
    const outcome = await runtime.submitUserText(EVENTS[i]);
    const after = await runtime.status();
    turns.push({
      turn_index: i,
      event: EVENTS[i],
      status: outcome.status,
      affect_before_turn: before.affect,
      affect_line_at_cognition: calls[callIndex]?.affect_line_at_cognition ?? null,
      affect_legend_at_cognition: calls[callIndex]?.affect_legend_at_cognition ?? null,
      affect_legend_at_cognition_present: calls[callIndex]?.affect_legend_at_cognition != null,
      cognition_request_sha256: calls[callIndex]?.cognition_request_sha256 ?? null,
      affect_after_turn: outcome.affect_after,
      affect_after_status: after.affect,
      state_revision_before: outcome.state_revision_before,
      state_revision_after: outcome.state_revision_after,
      repository_revision_before: outcome.repository_revision_before,
      repository_revision_after: outcome.repository_revision_after,
      directive: outcome.directive,
      provider_memory_section_present: outcome.provider_memory_section_present,
      retrieved_ref_count: outcome.retrieved_refs.length
    });
  }
  const snapshot = await runtime.snapshot();
  const beforeRestore = {
    state_revision: snapshot.durable.identity.state_revision,
    repository_revision: snapshot.durable.identity.repository_revision,
    subject_state_hash: snapshot.durable.identity.subject_state_hash,
    affect: snapshot.durable.identity.affect
  };
  const restored = await InteractiveSubjectRuntimeV0.restore(humanOptions(), JSON.parse(JSON.stringify(snapshot)));
  const restoredStatus = await restored.status();
  return {
    turns,
    restore_proof: {
      origin: restoredStatus.origin,
      state_revision_equal: restoredStatus.state_revision === beforeRestore.state_revision,
      repository_revision_equal: restoredStatus.repository_revision === beforeRestore.repository_revision,
      affect_equal:
        restoredStatus.affect.valence === beforeRestore.affect.valence &&
        restoredStatus.affect.activation === beforeRestore.affect.activation
    },
    affect_timing: turns.map((turn, index) => ({
      turn_index: turn.turn_index,
      affect_line_at_cognition: turn.affect_line_at_cognition,
      affect_before_turn: turn.affect_before_turn,
      affect_after_previous_turn: index === 0 ? null : turns[index - 1].affect_after_turn,
      affect_after_turn: turn.affect_after_turn,
      note:
        'cognition sees the affect from BEFORE the current event AffectApplication (one-turn lag, AUD-12 frozen)'
    }))
  };
}

async function segmentB() {
  const authority = await ExplicitV4SessionAuthorityV0.createFresh(observationOptions());
  const first = await authority.commitExternalObservation(observationInput('Front door opened.'));
  const bundlesAfterFirst = authority.durableSource().bundles.length;

  const replay = await authority.commitExternalObservation(observationInput('Front door opened.'));
  const bundlesAfterReplay = authority.durableSource().bundles.length;

  let conflict;
  try {
    await authority.commitExternalObservation(observationInput('Front door was forced open.'));
    conflict = { kind: 'ACCEPTED_UNEXPECTEDLY' };
  } catch (error) {
    conflict = { kind: 'CONFLICT_FAIL_CLOSED', name: error?.name ?? null, messagePrefix: String(error?.message ?? '').slice(0, 60) };
  }
  const bundlesAfterConflict = authority.durableSource().bundles.length;

  const durable = await authority.captureDurableState([first.episode_ref]);
  const source = authority.durableSource();
  const { authority: restored } = await ExplicitV4SessionAuthorityV0.restoreFromDurableState(observationOptions(), durable, source);
  const bundlesBeforeRestartReplay = restored.durableSource().bundles.length;
  const replayAfterRestart = await restored.commitExternalObservation(observationInput('Front door opened.'));
  const bundlesAfterRestartReplay = restored.durableSource().bundles.length;

  return {
    first: { observation_transition_id: first.observation_transition_id, observation_ref: first.observation_ref, episode_ref: first.episode_ref, bundles_after: bundlesAfterFirst },
    replay: {
      identical_transition_id: replay.observation_transition_id === first.observation_transition_id,
      identical_episode_ref: replay.episode_ref === first.episode_ref,
      bundles_unchanged: bundlesAfterReplay === bundlesAfterFirst
    },
    conflict: { ...conflict, bundles_unchanged: bundlesAfterConflict === bundlesAfterFirst },
    replay_after_restart: {
      identical_transition_id: replayAfterRestart.observation_transition_id === first.observation_transition_id,
      identical_episode_ref: replayAfterRestart.episode_ref === first.episode_ref,
      bundles_unchanged: bundlesAfterRestartReplay === bundlesBeforeRestartReplay
    }
  };
}

async function main() {
  const human = await segmentA();
  const external = await segmentB();
  const trace = {
    schema_version: 'core-phase-1-hardening-trace-v0',
    real_model_calls: 0,
    human_lifecycle: human,
    external_observation: external,
    total_cognition_calls: calls.length
  };
  writeFileSync(join(root, 'TRACE.json'), `${JSON.stringify(trace, null, 2)}\n`);
  console.log(JSON.stringify({
    turns: human.turns.length,
    restore_proof: human.restore_proof,
    affect_legend_present_every_turn: human.turns.every((t) => t.affect_legend_at_cognition_present),
    external
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
