/* globals URL */
/**
 * CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0 — real end-to-end lifecycle trace.
 *
 * Deterministic fake providers only (ZERO real model calls). Records the ACTUAL
 * production turn order and the exact cognition request per turn, so the
 * architecture map can be validated against runtime behavior rather than docs.
 *
 * Usage: node trace.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from '../../../packages/runtime/dist/index.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const SUBJECT_ID = 'audit-trace-subject';
const CLOCK = '2026-01-01T00:00:00.000Z';

const EVENTS = [
  'That worked exactly as I hoped. Thank you.',
  "Please don't do that again; it caused a problem.",
  'What time does the library open tomorrow?'
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
      const affectLine = /\[affect \(canonical\)\][^\n]*/.exec(user)?.[0] ?? null;
      const memoryPresent = user.includes('[PRIOR FACTUAL MEMORY');
      calls.push({ projection_hash: projectionHash, affect_line_at_cognition: affectLine, memory_section_present: memoryPresent, user_content: user });
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v1',
          cognition: {
            schema_version: 'cognition-proposal-v0',
            projection_hash: projectionHash,
            reasoning_summary: 'audit trace',
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
    return { content: JSON.stringify({ schema_version: 'language-realization-draft-v0', input_hash: inputHash, text: '[stub]', evidence_refs: [] }), model: 'stub' };
  }
};

function options() {
  return {
    session_id: 'sess-audit-trace',
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

async function main() {
  const runtime = await InteractiveSubjectRuntimeV0.create(options());
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
      affect_after_turn: outcome.affect_after,
      affect_after_status: after.affect,
      state_revision_before: outcome.state_revision_before,
      state_revision_after: outcome.state_revision_after,
      repository_revision_before: outcome.repository_revision_before,
      repository_revision_after: outcome.repository_revision_after,
      directive: outcome.directive,
      current_intent: outcome.current_intent,
      provider_memory_section_present: outcome.provider_memory_section_present,
      retrieved_ref_count: outcome.retrieved_refs.length,
      observable_episode_ref: outcome.observational_experience_ref
    });
  }

  const snapshot = await runtime.snapshot();
  const durableBefore = {
    state_revision: snapshot.durable.identity.state_revision,
    repository_revision: snapshot.durable.identity.repository_revision,
    subject_state_hash: snapshot.durable.identity.subject_state_hash,
    affect: snapshot.durable.identity.affect
  };
  const roundTripped = JSON.parse(JSON.stringify(snapshot));
  const restored = await InteractiveSubjectRuntimeV0.restore(options(), roundTripped);
  const restoredStatus = await restored.status();
  const restoredView = await restored.subjectStateView();

  const restoreProof = {
    origin: restoredStatus.origin,
    state_revision_equal: restoredStatus.state_revision === durableBefore.state_revision,
    repository_revision_equal: restoredStatus.repository_revision === durableBefore.repository_revision,
    affect_equal:
      restoredStatus.affect.valence === durableBefore.affect.valence &&
      restoredStatus.affect.activation === durableBefore.affect.activation,
    restored_affect: restoredStatus.affect,
    restored_state_revision: restoredStatus.state_revision,
    restored_repository_revision: restoredStatus.repository_revision,
    personality_dimensions: restoredView.personality.length,
    beliefs: restoredView.beliefs.length,
    relationships: restoredView.relationships.length,
    traits_seed: restoredView.traits_seed,
    regulation: restoredView.regulation
  };

  const restoredTurn = await restored.submitUserText('Continuing after restore.');
  const continuity = { status: restoredTurn.status, state_revision_after: restoredTurn.state_revision_after };

  // Ordering evidence: does cognition at turn N see turn N's own AffectApplication?
  const ordering = turns.map((turn, index) => ({
    turn_index: turn.turn_index,
    affect_line_at_cognition: turn.affect_line_at_cognition,
    affect_before_turn: turn.affect_before_turn,
    affect_after_previous_turn: index === 0 ? null : turns[index - 1].affect_after_turn,
    affect_after_turn: turn.affect_after_turn,
    note:
      'cognition affect is post-time-recovery / post-prior-pending but PRE current-event AffectApplication ' +
      '(AffectApplication for the current event runs in completePendingLifecycleWork, after cognition); the ' +
      "current event's impulse therefore first reaches cognition on the NEXT turn"
  }));

  writeFileSync(
    join(root, 'trace.json'),
    `${JSON.stringify({ schema_version: 'core-integrity-audit-trace-v0', real_model_calls: 0, turns, restore_proof: restoreProof, continuity, ordering, total_cognition_calls: calls.length }, null, 2)}\n`
  );
  console.log(JSON.stringify({ turns: turns.length, restoreProof, continuity, ordering }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
