/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — qualification failure forensics.
 *
 * DETERMINISTIC, ZERO model calls: re-validates each preserved raw cognition
 * response against the production V3 validator with a projection reconstructed
 * from the same preserved request bytes, and reports the exact rejection reason.
 * It never regenerates, replaces or tunes anything.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateConversationCognitionProposalV3 } from '../../../packages/runtime/dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const rows = readFileSync(resolve(here, 'qualification-raw.jsonl'), 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));

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
const jsonOr = (raw, fallback) => {
  try { return JSON.parse(raw); } catch { return fallback; }
};

function reconstructProjection(user) {
  const sceneMatch = /^\[context\] scene=(.*?) task=/m.exec(user);
  const taskMatch = /^\[context\] scene=.*? task=(.*)$/m.exec(user);
  const observation = /^\[current observation\] (\S+)$/m.exec(user)?.[1] ?? null;
  const entries = [];
  const start = user.indexOf('[PRIOR FACTUAL MEMORY');
  const end = user.indexOf('[END HISTORICAL FACTUAL CONTENT]');
  if (start >= 0 && end > start) {
    for (const chunk of user.slice(start, end).split(/\n- /).slice(1)) {
      const ep = /episode_ref: "([^"]+)"/.exec(chunk)?.[1];
      if (ep === undefined) continue;
      if (chunk.startsWith('Past episode record')) {
        const sceneRaw = /scene: (.*)\)\s*$/.exec(chunk.trim())?.[1];
        entries.push({ kind: 'EPISODE_SCENE', episode_ref: ep, scene: jsonOr(sceneRaw ?? '""', sceneRaw ?? '') });
      } else {
        entries.push({
          kind: 'BEHAVIOR_OUTCOME', episode_ref: ep,
          experience_ref: /experience_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          event_ref: /event_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          actor_ref: /actor_ref: "([^"]+)"/.exec(chunk)?.[1] ?? null,
          delivered_behavior_text: jsonOr(/delivered_behavior_text: (.*)$/m.exec(chunk)?.[1] ?? '""', ''),
          exact_outcome_text: jsonOr(/outcome_reply_text: (.*)$/m.exec(chunk)?.[1] ?? '""', '')
        });
      }
    }
  }
  return {
    schema_version: 'cognitive-context-projection-v2',
    subject_id: jsonOr(/^\[identity\] subject_id=(.*)$/m.exec(user)?.[1] ?? '""', 'unknown'),
    state_revision: 0,
    context: {
      scene: jsonOr(sceneMatch?.[1] ?? '""', ''),
      task: taskMatch?.[1] === '(none)' ? null : jsonOr(taskMatch?.[1] ?? 'null', null),
      focus_refs: sectionLines(user, '[focus refs]'),
      active_entity_refs: sectionLines(user, '[active entity refs]'),
      environment_refs: sectionLines(user, '[environment refs]'),
      current_observation_ref: observation
    },
    memory_working_refs: sectionLines(user, 'CITEABLE CONTEXT REFS').filter((ref) => ref.startsWith('episode:')),
    recent_retrieval_refs: [],
    factual_memory_evidence: { entries },
    projection_hash: /\[projection_hash\]\s+(\S+)/.exec(user)?.[1],
    belief_items: [],
    interaction_familiarity_cognition_influences: [],
    traits_dimensions: {}
  };
}

const diagnosis = rows.filter((row) => !row.classification.pass).map((row) => {
  const user = row.raw_cognition_request.messages.find((message) => message.role === 'user').content;
  const parsed = (() => {
    try { return JSON.parse(row.raw_cognition_response ?? ''); } catch { return null; }
  })();
  if (parsed === null) return { scenario: row.scenario, replicate: row.replicate, stage: 'RAW_NOT_JSON', detail: 'raw response is not strict JSON' };
  const projection = reconstructProjection(user);
  let check;
  try { check = validateConversationCognitionProposalV3(parsed, projection); } catch (error) { return { scenario: row.scenario, replicate: row.replicate, stage: 'THREW', detail: String(error) }; }
  return {
    scenario: row.scenario,
    replicate: row.replicate,
    production_status: row.status,
    production_stage: row.failure_stage,
    v3_accepted: check.ok,
    rejection: check.ok ? null : check.detail,
    model_current_intent: parsed?.cognition?.current_intent ?? null,
    model_directive: parsed?.communication_directive?.kind ?? null,
    model_claims: (parsed?.factual_assessment?.claims ?? []).map((claim) => ({ kind: claim.kind, refs: claim.source_refs })),
    final_behavior: row.final_behavior,
    classification: { final_fact: row.classification.final_fact, intent_choice: row.classification.intent_choice, final_choice: row.classification.final_choice, choice_fidelity: row.classification.choice_fidelity, unsupported_premises: row.classification.unsupported_premises }
  };
});

const artifact = {
  schema_version: 'affect-cognition-c2-clean-qualification-forensics-v0',
  method: 'deterministic offline re-validation of preserved raw responses against the production V3 validator; zero model calls; no evidence rewritten',
  failing_records: diagnosis.length,
  total_records: rows.length,
  diagnosis
};
writeFileSync(resolve(here, 'qualification-forensics.json'), `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(diagnosis, null, 2)}\n`);
void existsSync;
