/* globals URL */
/**
 * PHASE A — offline structural proof (ZERO real model calls), fresh process.
 *
 * Restores every on-disk snapshot authoritatively, submits each scenario's
 * current event through the REAL production lifecycle with a deterministic
 * cognition stub, and captures the exact production cognition request. Then
 * proves:
 *   - FULL and the ablated variants share a byte-identical factual-Memory section
 *     and identical identity / context / citeable refs / action space / hash;
 *   - the diverging lines are EXACTLY the designated non-Memory sections;
 *   - the captured FULL request equals the production request-identity hash.
 *
 * Usage: node phase-a.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractiveSubjectRuntimeV0 } from '../../../packages/runtime/dist/index.js';
import { runtimeOptions } from './grow.mjs';
import { memorySection, sha256 } from './lib/hash.mjs';
import { productionRequestHash, recordingCognitionTransport } from './lib/transports.mjs';
import { ablateAffectOnly, ablateAllDesignated, AFFECT_PREFIXES, verifyAblation } from './lib/ablation.mjs';
import { PROVIDER, SCENARIOS, SWAP_PAIRS } from './lib/config.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const snapshotsDir = join(root, 'evidence', 'snapshots');

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
            reasoning_summary: 'phase-a stub',
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

function affectLineOf(userContent) {
  const lines = userContent.split('\n');
  const found = lines.filter((line) => AFFECT_PREFIXES.some((prefix) => line.trimStart().startsWith(prefix)));
  return found.length === 1 ? found[0] : null;
}

async function scenarioRequest(scenario) {
  const snapshot = JSON.parse(readFileSync(join(snapshotsDir, `${scenario.history}.json`), 'utf8'));
  const sink = [];
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(recordingCognitionTransport(stubCognitionTransport(), sink)),
    snapshot
  );
  const status = await runtime.status();
  const outcome = await runtime.submitUserText(scenario.event);
  if (outcome.status !== 'COMPLETE') throw new Error(`${scenario.id} turn failed: ${outcome.failure}`);
  const captured = sink.at(-1);
  const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(captured.userContent)?.[1] ?? '';
  const expectedProductionHash = productionRequestHash({
    model: PROVIDER.model,
    systemContent: captured.systemContent,
    userContent: captured.userContent,
    numPredict: PROVIDER.cognition_num_predict,
    contextWindowTokens: PROVIDER.context_window_tokens
  });

  const b = ablateAllDesignated(captured.userContent);
  const c = ablateAffectOnly(captured.userContent);
  const verificationB = verifyAblation(captured.userContent, b.ablated, b.removedIndices);
  const verificationC = verifyAblation(captured.userContent, c.ablated, c.removedIndices, {
    allowedIndices: c.removedIndices
  });

  return {
    id: scenario.id,
    history: scenario.history,
    category: scenario.category,
    event: scenario.event,
    expected_direction: scenario.expected_direction,
    origin: status.origin,
    affect_at_cognition: status.affect,
    projection_hash: projectionHash,
    full_user: captured.userContent,
    full_user_sha256: sha256(captured.userContent),
    full_request_hash: captured.requestHash,
    production_request_hash: expectedProductionHash,
    production_hash_match: expectedProductionHash === outcome.provider_request_hash,
    provider_memory_section_present: outcome.provider_memory_section_present,
    full_memory_section_sha256: sha256(memorySection(captured.userContent)),
    affect_line: affectLineOf(captured.userContent),
    b_user: b.ablated,
    b_user_sha256: sha256(b.ablated),
    b_memory_section_sha256: sha256(memorySection(b.ablated)),
    b_removed_lines: b.removedLines,
    b_verification: verificationB,
    c_user: c.ablated,
    c_user_sha256: sha256(c.ablated),
    c_memory_section_sha256: sha256(memorySection(c.ablated)),
    c_removed_lines: c.removedLines,
    c_verification: verificationC
  };
}

async function main() {
  const byId = {};
  for (const scenario of SCENARIOS) {
    const result = await scenarioRequest(scenario);
    byId[scenario.id] = result;
    console.log(
      `${scenario.id}: B-verify=${result.b_verification.ok} C-verify=${result.c_verification.ok} ` +
        `production-hash-match=${result.production_hash_match} mem-equal=${result.full_memory_section_sha256 === result.b_memory_section_sha256}`
    );
    if (!result.b_verification.ok) throw new Error(`${scenario.id} B verification failed: ${result.b_verification.reasons.join('; ')}`);
    if (!result.c_verification.ok) throw new Error(`${scenario.id} C verification failed: ${result.c_verification.reasons.join('; ')}`);
    if (!result.production_hash_match) throw new Error(`${scenario.id} production request hash mismatch`);
    if (result.full_memory_section_sha256 !== result.b_memory_section_sha256) throw new Error(`${scenario.id} memory section changed in B`);
    if (result.full_memory_section_sha256 !== result.c_memory_section_sha256) throw new Error(`${scenario.id} memory section changed in C`);
    if (result.full_memory_section_sha256 === '') throw new Error(`${scenario.id} has no memory section`);
  }

  const swaps = [];
  for (const { id, borrow_affect_from } of SWAP_PAIRS) {
    const target = byId[id];
    const donor = byId[borrow_affect_from];
    swaps.push({
      id,
      borrow_affect_from,
      original_affect_line: target.affect_line,
      replacement_affect_line: donor.affect_line,
      same_memory_section: target.full_memory_section_sha256 === donor.full_memory_section_sha256
    });
  }

  const report = {
    schema_version: 'non-memory-ablation-phase-a-v0',
    process_boundary: 'snapshots created in grow.mjs process; restored and analysed in phase-a.mjs process',
    scenarios: byId,
    swaps,
    all_verifications_ok: true,
    memory_equality: Object.fromEntries(
      Object.values(byId).map((entry) => [
        entry.id,
        {
          full: entry.full_memory_section_sha256,
          b: entry.b_memory_section_sha256,
          c: entry.c_memory_section_sha256,
          equal: entry.full_memory_section_sha256 === entry.b_memory_section_sha256 && entry.full_memory_section_sha256 === entry.c_memory_section_sha256
        }
      ])
    )
  };
  writeFileSync(join(root, 'evidence', 'phase-a.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('phase-a: structural proof complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
