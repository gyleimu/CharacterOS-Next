/* globals URL */
/**
 * AFFECT_COGNITION_C2 — lawful failure forensics (deterministic, ZERO model calls).
 *
 * Re-validates each PRESERVED lawful raw cognition response against the
 * production V3 validator with a projection reconstructed from the same
 * preserved request bytes, and reports the exact rejection detail and stage.
 * It never regenerates or replaces evidence.
 *
 * Usage: node forensics-lawful.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateConversationCognitionProposalV3 } from '../../../packages/runtime/dist/index.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const lawful = JSON.parse(readFileSync(join(root, 'lawful-confirmation.json'), 'utf8'));

function sectionLines(user, header) {
  const lines = user.split('\n');
  const start = lines.findIndex((line) => line.startsWith(header));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trimStart();
    if (line.startsWith('[') && !line.startsWith('- ')) break;
    if (line.startsWith('- ')) out.push(line.slice(2).trim());
  }
  return out;
}

function parseJsonOrNull(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Reconstruct the projection fields the V3 validator inspects. */
function reconstructProjection(user, proposal) {
  const sceneMatch = /^\[context\] scene=(.*?) task=/m.exec(user);
  const taskMatch = /^\[context\] scene=.*? task=(.*)$/m.exec(user);
  const observation = /^\[current observation\] (\S+)$/m.exec(user)?.[1] ?? null;
  const citeable = sectionLines(user, 'CITEABLE CONTEXT REFS');
  const memoryRefs = citeable.filter((ref) => ref.startsWith('episode:'));
  const focus = sectionLines(user, '[focus refs]');
  const entities = sectionLines(user, '[active entity refs]');
  const environment = sectionLines(user, '[environment refs]');

  // PRIOR FACTUAL MEMORY entries → factual_memory_evidence bundle.
  const entries = [];
  const memoryStart = user.indexOf('[PRIOR FACTUAL MEMORY');
  const memoryEnd = user.indexOf('[END HISTORICAL FACTUAL CONTENT]');
  if (memoryStart >= 0 && memoryEnd > memoryStart) {
    const block = user.slice(memoryStart, memoryEnd);
    const chunks = block.split(/\n- /).slice(1);
    for (const chunk of chunks) {
      const ep = /episode_ref: "([^"]+)"/.exec(chunk)?.[1];
      if (ep === undefined) continue;
      if (chunk.startsWith('Past episode record')) {
        entries.push({ kind: 'EPISODE_SCENE', episode_ref: ep, scene: parseJsonOrNull(/"scene": (".*")/.exec(chunk)?.[1] ?? '""') ?? '' });
        const sceneRaw = /scene: (.*)\)\s*$/.exec(chunk.trim())?.[1];
        if (sceneRaw !== undefined) entries[entries.length - 1].scene = parseJsonOrNull(sceneRaw) ?? sceneRaw;
      } else {
        const delivered = /delivered_behavior_text: (.*)$/m.exec(chunk)?.[1];
        const outcome = /outcome_reply_text: (.*)$/m.exec(chunk)?.[1];
        entries.push({
          kind: 'BEHAVIOR_OUTCOME',
          episode_ref: ep,
          experience_ref: /experience_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          event_ref: /event_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          actor_ref: /actor_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          delivered_behavior_text: parseJsonOrNull(delivered ?? '""') ?? '',
          exact_outcome_text: parseJsonOrNull(outcome ?? '""') ?? ''
        });
      }
    }
  }

  return {
    schema_version: 'cognitive-context-projection-v2',
    subject_id: parseJsonOrNull(/^\[identity\] subject_id=(.*)$/m.exec(user)?.[1] ?? '""') ?? 'unknown',
    state_revision: 0,
    context: {
      scene: parseJsonOrNull(sceneMatch?.[1] ?? '""') ?? '',
      task: taskMatch?.[1] === '(none)' ? null : parseJsonOrNull(taskMatch?.[1] ?? 'null'),
      focus_refs: focus,
      active_entity_refs: entities,
      environment_refs: environment,
      current_observation_ref: observation
    },
    memory_working_refs: memoryRefs,
    recent_retrieval_refs: [],
    factual_memory_evidence: { entries },
    projection_hash: proposal.cognition.projection_hash,
    belief_items: [],
    interaction_familiarity_cognition_influences: [],
    traits_dimensions: {}
  };
}

/** Stage classification for a validator rejection detail. */
function stageOf(detail) {
  if (detail.includes('schema_version')) return 'PROPOSAL_V3_VALIDATION';
  if (detail.includes('factual_assessment.claims') && detail.includes('source_refs')) return 'EVIDENCE_VALIDATION';
  if (detail.includes('has no inspectable source content')) return 'SOURCE_QUOTE_VALIDATION';
  if (detail.includes('SOURCE_QUOTE')) return 'SOURCE_QUOTE_VALIDATION';
  if (detail.includes('factual_assessment')) return 'FACTUAL_ASSESSMENT';
  if (detail.includes('clarification_basis')) return 'CLARIFICATION_BASIS';
  if (detail.includes('current_intent') || detail.includes('unresolved')) return 'COGNITION_INTENT';
  if (detail.includes('projection_hash')) return 'PROPOSAL_HASH_BINDING';
  return 'PROPOSAL_V3_VALIDATION';
}

const results = {};
for (const [stateId, state] of Object.entries(lawful.states)) {
  results[stateId] = state.records.map((record) => {
    const user = record.raw_cognition_request.messages.find((m) => m.role === 'user').content;
    let parsed;
    try {
      parsed = JSON.parse(record.raw_cognition_response);
    } catch (error) {
      return { replicate: record.replicate, stage: 'STRUCTURED_SCHEMA', error: String(error) };
    }
    const projection = reconstructProjection(user, parsed);
    let check;
    try {
      check = validateConversationCognitionProposalV3(parsed, projection);
    } catch (error) {
      return { replicate: record.replicate, stage: 'PROPOSAL_V3_VALIDATION', error: String(error) };
    }
    if (check.ok) {
      return {
        replicate: record.replicate,
        stage: 'VALIDATOR_ACCEPTS',
        note: 'the preserved proposal passes the production V3 validator against the reconstructed projection'
      };
    }
    return {
      replicate: record.replicate,
      stage: stageOf(check.detail),
      validator_detail: check.detail,
      cited_source_refs: (parsed.factual_assessment?.claims ?? []).map((c) => ({ kind: c.kind, refs: c.source_refs }))
    };
  });
}

writeFileSync(
  join(evidenceDir, 'lawful-forensics.json'),
  `${JSON.stringify(
    {
      schema_version: 'affect-cognition-c2-lawful-forensics-v0',
      method: 'deterministic offline re-validation of preserved raw responses against the production V3 validator; zero model calls',
      note: 'the projection is reconstructed from the preserved request bytes; it is sufficient for every field the validator inspects but is not a byte-exact copy of the original projection object',
      results
    },
    null,
    2
  )}\n`
);

for (const [stateId, rows] of Object.entries(results)) {
  console.log(`===== ${stateId}`);
  for (const row of rows) {
    console.log(` r${row.replicate} ${row.stage}${row.validator_detail ? ` :: ${row.validator_detail}` : ''}`);
  }
}
