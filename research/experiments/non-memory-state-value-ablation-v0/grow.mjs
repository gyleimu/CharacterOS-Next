/* globals URL */
/**
 * PHASE 1 — grow lawful lived histories and persist real subject snapshots.
 *
 * ONE OS process. Deterministic content-sensitive appraisal (lawful
 * Appraisal → AffectApplication authority), deterministic valid cognition and
 * language stubs (ZERO real model calls). The process then EXITS; the live
 * experiment runs in a fresh process that authoritatively restores these
 * snapshots.
 *
 * Usage: node grow.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from '../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from './lib/appraisal.mjs';
import { validLanguageStub } from './lib/transports.mjs';
import { FROZEN_CLOCK, HISTORIES, INTERVAL_TICKS, PROVIDER, SUBJECT_ID } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const snapshotsDir = join(root, 'evidence', 'snapshots');
mkdirSync(snapshotsDir, { recursive: true });

function stubCognitionTransport() {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v1',
          cognition: {
            schema_version: 'cognition-proposal-v0',
            projection_hash: projectionHash,
            reasoning_summary: 'grow stub',
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

export function runtimeOptions(cognitionTransport) {
  return {
    session_id: 'sess-non-memory-ablation',
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

async function main() {
  const index = { schema_version: 'non-memory-ablation-snapshots-v0', snapshots: {} };
  for (const [historyId, messages] of Object.entries(HISTORIES)) {
    const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions(stubCognitionTransport()));
    const turns = [];
    for (const message of messages) {
      const outcome = await runtime.submitUserText(message);
      if (outcome.status !== 'COMPLETE') throw new Error(`${historyId} turn failed: ${outcome.failure}`);
      turns.push({ user_text: message, affect_after: outcome.affect_after, repository_revision_after: outcome.repository_revision_after });
    }
    const view = await runtime.subjectStateView();
    const snapshot = await runtime.snapshot();
    writeFileSync(join(snapshotsDir, `${historyId}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
    index.snapshots[historyId] = {
      history_id: historyId,
      messages,
      turns,
      affect_final: view.affect,
      regulation_final: view.regulation,
      personality_dimension_count: view.personality.length,
      traits_seed: view.traits_seed,
      belief_count: view.beliefs.length,
      relationship_count: view.relationships.length,
      state_revision: view.state_revision,
      repository_revision: view.repository_revision,
      snapshot_sha256_input_bytes: JSON.stringify(snapshot).length
    };
    console.log(`${historyId}: affect=${JSON.stringify(view.affect)} beliefs=${view.beliefs.length} relationships=${view.relationships.length} personality=${view.personality.length}`);
  }
  writeFileSync(join(root, 'evidence', 'snapshots-index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log('grow: snapshots persisted; process exiting');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}