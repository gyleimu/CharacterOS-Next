/* globals URL */
/**
 * CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0 — controlled adversarial probes.
 * Research/test only: temporary in-memory stores, no production data touched,
 * ZERO real model calls.
 *
 * Probe A — stale/rolled-back store accepted on restore?
 *   Build S1 (1 turn) and S2 (2 turns) from the SAME runtime, then restore with
 *   S2.durable + S1.store (durable insists on the newer head; store rolls back).
 * Probe B — external observation replay duplicates lived experience?
 *   Commit the identical external observation_id twice and observe how many
 *   distinct durable episodes result.
 *
 * Usage: node adversarial.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ExplicitV4SessionAuthorityV0,
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0
} from '../../../packages/runtime/dist/index.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const SUBJECT_ID = 'audit-adversarial-subject';
const CLOCK = '2026-01-01T00:00:00.000Z';

function appraisal() {
  return {
    proposeFactualEventAppraisal: async (ctx) => ({
      schema_version: 'factual-event-appraisal-proposal-v0',
      status: 'APPRAISED',
      subject_id: ctx.subject_id,
      factual_event_ref: ctx.factual_event_ref,
      context_projection_hash: ctx.context_projection_hash,
      dimensions: { relevance: 0.6, goal_congruence: 0.6, attribution: 'other', controllability: 0.5, uncertainty: 0.3, intensity: 0.5 },
      assessment_confidence: 0.8,
      evidence_refs: [ctx.factual_event_ref].sort()
    })
  };
}

const cognition = {
  complete: async (request) => {
    const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
    const hash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
    return {
      content: JSON.stringify({
        schema_version: 'conversation-cognition-proposal-v1',
        cognition: { schema_version: 'cognition-proposal-v0', projection_hash: hash, reasoning_summary: 'x', relevant_memory_refs: [], considered_context_refs: [], current_intent: 'respond', confidence: 0.7, uncertainty: 0.3, action_intent: null, evidence_refs: [] },
        communication_directive: { kind: 'CLARIFY_MISSING_CONTEXT' }
      }),
      model: 'stub'
    };
  }
};
const language = { complete: async () => ({ content: '{}', model: 'stub' }) };

function options() {
  return {
    session_id: 'sess-audit-adversarial',
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognition,
    languageTransport: language,
    factualEventAppraisalProvider: appraisal(),
    interval_ticks: 1,
    provider_identity: { model: 'stub', num_predict: 2048 },
    clock: () => CLOCK
  };
}

async function probeRollback() {
  const runtime = await InteractiveSubjectRuntimeV0.create(options());
  await runtime.submitUserText('first event');
  const s1 = await runtime.snapshot();
  await runtime.submitUserText('second event');
  const s2 = await runtime.snapshot();
  const newerRevision = s2.durable.identity.state_revision;
  const olderRevision = s1.durable.identity.state_revision;
  let result;
  try {
    const rolledBack = await InteractiveSubjectRuntimeV0.restore(options(), { ...s2, store: s1.store });
    const status = await rolledBack.status();
    result = {
      restore_succeeded: true,
      durable_claimed_state_revision: newerRevision,
      restored_state_revision: status.state_revision,
      store_head_state_revision: olderRevision,
      rollback_accepted: status.state_revision < newerRevision,
      origin: status.origin
    };
  } catch (error) {
    result = { restore_succeeded: false, durable_claimed_state_revision: newerRevision, error: String(error), rollback_accepted: false };
  }
  return result;
}

async function probeExternalObservationReplay() {
  const authority = await ExplicitV4SessionAuthorityV0.createFresh(options());
  const input = {
    observation_id: 'observation:replay-1',
    source_refs: ['source:sensor-a'],
    external_refs: ['event:external-1'],
    entity_refs: ['entity:alice'],
    scene: 'external scene',
    task: null,
    focus_refs: [],
    environment_refs: ['environment:room-1'],
    declaredSalience: 0.5
  };
  // commitExternalObservation already performs the observation-sourced Learning
  // commit and returns the durable episode_ref, so a replay is observable by
  // comparing the returned episode refs directly.
  const first = await authority.commitExternalObservation(input);
  const second = await authority.commitExternalObservation(input);
  return {
    first_observation_transition_id: first.observation_transition_id,
    second_observation_transition_id: second.observation_transition_id,
    first_episode_ref: first.episode_ref,
    second_episode_ref: second.episode_ref,
    distinct_transition_ids: first.observation_transition_id !== second.observation_transition_id,
    distinct_episodes: first.episode_ref !== second.episode_ref,
    duplicate_experience: first.episode_ref !== second.episode_ref
  };
}

async function main() {
  const rollback = await probeRollback();
  const externalReplay = await probeExternalObservationReplay();
  const report = { schema_version: 'core-integrity-audit-adversarial-v0', real_model_calls: 0, rollback, external_observation_replay: externalReplay };
  writeFileSync(join(root, 'adversarial.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
