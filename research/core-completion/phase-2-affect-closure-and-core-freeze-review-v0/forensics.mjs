/**
 * AFFECT_PHASE2_NEGATIVE_CLOSURE_AND_CORE_FREEZE_REVIEW — zero-model forensics.
 *
 * Builds a representative V9 Language input for the conversational
 * (NO_FACTUAL_PRIMARY_RESPONSE) mode and enumerates exactly what the model sees,
 * so the review's central question is answered from constructed evidence rather
 * than inference. No model calls, no production changes.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeConversationCognitionModelOutputV7 } from '../../../packages/runtime/dist/index.js';
import {
  buildLanguageRealizationInputV9,
  modelFacingLanguagePayloadV9
} from '../../../packages/runtime/dist/transitions/conversation/language-realization-input.js';

const here = dirname(fileURLToPath(import.meta.url));
const OBS = 'observation:o-review-closure';
const HASH = `sha256:${'a'.repeat(64)}`;
const SCENE = 'Alice says: "Hello there."';

function projection() {
  return {
    schema_version: 'cognitive-context-projection-v2', subject_id: 'subject-closure-review',
    current_logical_time: 1, state_revision: 1, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: 'canonical-affect-cognition-projection-v0', valence: 0, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: SCENE, task: "Respond to the user's latest message.", focus_refs: [], active_entity_refs: ['entity:alice'], environment_refs: ['environment:room-1'], current_observation_ref: OBS },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: { entries: [] }
  };
}

function wire(claims, handles = []) {
  return {
    schema_version: 'conversation-cognition-proposal-v7',
    factual_assessment: { claims },
    cognition: {
      schema_version: 'cognition-proposal-v0', reasoning_summary: 'review fixture',
      relevant_memory_handles: [], considered_handles: handles, current_intent: 'acknowledge the greeting',
      confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: handles
    },
    subjective_selection: { kind: 'NO_SUBJECTIVE_SELECTION' },
    communication_directive: { kind: 'REALIZE_CURRENT_INTENT' },
    clarification_basis: null
  };
}

const canonical = (value) => {
  const checked = canonicalizeConversationCognitionModelOutputV7(value, projection(), HASH);
  if (!checked.ok) throw new Error(`fixture rejected: ${checked.detail}`);
  return checked.proposal;
};

const request = (proposal) => ({
  subject_id: 'subject-closure-review', source_revision: 1, response_request_id: 'req-closure-review',
  projection: projection(), conversation_proposal: proposal, memory_episode_contents: []
});

// ---- conversational mode ---------------------------------------------------------
const conversational = await buildLanguageRealizationInputV9(request(canonical(wire([]))));
if (!conversational.ok) throw new Error(`conversational build failed: ${conversational.detail}`);
const payload = modelFacingLanguagePayloadV9(conversational.input);

// ---- N6 shape (quotes, no derivation) --------------------------------------------
const n6 = await buildLanguageRealizationInputV9(request(canonical(wire([
  { kind: 'SOURCE_QUOTE', text: 'Alice says: "Hello there."', source_handles: ['F1'] }
], ['F1']))));

// ---- states of the same question under-asserted ----------------------------------
// "What is 17 + 25?" with zero claims is structurally indistinguishable to the host
// from "Hello there." — both are zero-claim NO_SUBJECTIVE_SELECTION REALIZE turns.
const underAsserted = await buildLanguageRealizationInputV9(request(canonical(wire([]))));

writeFileSync(resolve(here, 'forensics.json'), `${JSON.stringify({
  schema_version: 'affect-phase2-closure-core-freeze-review-forensics-v0',
  model_calls: 0,
  production_files_changed: 0,
  conversational_mode: {
    plan: conversational.input.realization_plan,
    model_facing_payload_keys: Object.keys(payload),
    model_facing_payload: payload,
    response_request_id_in_payload: Object.hasOwn(payload, 'response_request_id'),
    authoritative_atoms_in_payload: {
      factual_claims: payload.factual_assessment?.claims?.length ?? null,
      selection_kind: payload.selected_subjective_selection?.kind ?? null,
      plan_references: payload.realization_plan?.references?.length ?? null
    }
  },
  n6_shape_rejection: n6.ok ? null : { code: n6.code, detail: n6.detail },
  under_asserted_zero_claim_turn: underAsserted.ok
    ? { admitted: true, mode: underAsserted.input.realization_plan.mode }
    : { admitted: false, code: underAsserted.code }
}, null, 2)}\n`);
process.stdout.write('forensics.json written (0 model calls)\n');
process.stdout.write(`${JSON.stringify({
  conversational_payload_keys: Object.keys(payload),
  plan: conversational.input.realization_plan,
  n6_rejection: n6.ok ? 'ADMITTED' : n6.code,
  under_asserted: underAsserted.ok ? underAsserted.input.realization_plan.mode : underAsserted.code
}, null, 2)}\n`);
