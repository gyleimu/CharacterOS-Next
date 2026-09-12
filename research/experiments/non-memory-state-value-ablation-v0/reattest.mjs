/* globals URL */
/**
 * ZERO-CALL re-attestation.
 *
 * Proves that authoritatively restoring each on-disk snapshot and submitting the
 * frozen current event reproduces the EXACT Phase B FULL cognition request
 * (byte-identical production request identity). This establishes:
 *   - Phase B requests are deterministic across fresh restores;
 *   - Phase C's replay cognition projection is byte-identical to Phase B's, so
 *     the realized behaviors differ only by the replayed structured proposal.
 *
 * No model calls.
 *
 * Usage: node reattest.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0 } from '../../../packages/runtime/dist/index.js';
import { runtimeOptions } from './grow.mjs';
import { productionRequestHash, recordingCognitionTransport } from './lib/transports.mjs';
import { sha256 } from './lib/hash.mjs';
import { PROVIDER, SCENARIOS } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const snapshotsDir = join(root, 'evidence', 'snapshots');
const phaseB = JSON.parse(readFileSync(join(root, 'evidence', 'phase-b.json'), 'utf8'));
const phaseA = JSON.parse(readFileSync(join(root, 'evidence', 'phase-a.json'), 'utf8'));

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
            reasoning_summary: 'reattest stub',
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

async function main() {
  const results = {};
  let allMatch = true;
  for (const scenario of SCENARIOS) {
    const snapshot = JSON.parse(readFileSync(join(snapshotsDir, `${scenario.history}.json`), 'utf8'));
    const sink = [];
    const runtime = await InteractiveSubjectRuntimeV0.restore(
      runtimeOptions(recordingCognitionTransport(stubCognitionTransport(), sink)),
      snapshot
    );
    const outcome = await runtime.submitUserText(scenario.event);
    if (outcome.status !== 'COMPLETE') throw new Error(`${scenario.id} reattest turn failed`);
    const captured = sink.at(-1);
    const built = productionRequestHash({
      model: PROVIDER.model,
      systemContent: captured.systemContent,
      userContent: captured.userContent,
      numPredict: PROVIDER.cognition_num_predict,
      contextWindowTokens: PROVIDER.context_window_tokens
    });
    const phaseBHash = phaseB.scenarios[scenario.id].full.request_hash;
    // Phase A stores the raw rendered-prompt hash; compare rendered bytes, not hash method.
    const phaseAUserHash = phaseA.scenarios[scenario.id].full_user_sha256;
    const userMatch = sha256(captured.userContent) === phaseAUserHash;
    const match = built === phaseBHash && userMatch;
    allMatch = allMatch && match;
    results[scenario.id] = {
      built_request_hash: built,
      phase_b_request_hash: phaseBHash,
      phase_a_user_sha256: phaseAUserHash,
      current_user_sha256: sha256(captured.userContent),
      phase_b_match: built === phaseBHash,
      phase_a_render_match: userMatch
    };
    console.log(`${scenario.id}: phase_b_match=${built === phaseBHash} phase_a_render_match=${userMatch}`);
  }
  writeFileSync(
    join(root, 'evidence', 'reattest.json'),
    `${JSON.stringify({ schema_version: 'non-memory-ablation-reattest-v0', all_match: allMatch, scenarios: results }, null, 2)}\n`
  );
  console.log(`reattest: all_match=${allMatch}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
