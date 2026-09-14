/**
 * AFFECT_COGNITION_C4_2_..._V0 — freeze preparation (NO model calls).
 *
 * Mints opaque session ids, captures one base cognition request per formal
 * scenario, captures the PRODUCTION C4.2 prompt surfaces through a zero-model turn,
 * attests the P/N/Z/A derivations, and writes the qualification + formal freezes
 * hashed BEFORE the first governed model call.
 */
/* globals fetch */
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA, LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256, memorySection, subjectDataInvariantDigest } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { assertNoExperimentalLabels, auditAffectVariant, verifyAbsentIsBaseMinusAffect } from '../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import {
  CALL_BUDGET, CONDITIONS, FALSIFICATION, FORMAL_REPLICATES, FORMAL_SCENARIOS, GROUNDING, HISTORY_EVENTS,
  MATERIALITY, PROTOCOL_STRINGS, PROVIDER, QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS,
  RATIONALE_CLASSES, RETRY_POLICY, SUBJECT_ID
} from './lib/config.mjs';
import { captureBaseRequest, conditionVariant, growSnapshot, runCondition, stubCognitionTransport } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const providerVersion = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const installed = tags.models.find((entry) => entry.name === PROVIDER.model);
if (installed?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const provider = { version: providerVersion.version, name: installed.name, digest: installed.digest, quantization: installed.details?.quantization_level, size: installed.size };
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '..', '..', '..'), encoding: 'utf8' }).trim();
const opaque = () => `c42-${randomUUID()}`;
const qualificationIds = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => [scenario.id, Array.from({ length: QUALIFICATION_REPLICATES }, opaque)]));
const formalIds = Object.fromEntries(FORMAL_SCENARIOS.map((scenario) => [scenario.id, Array.from({ length: FORMAL_REPLICATES }, opaque)]));
const lawfulIds = { LAWFUL_POS: Array.from({ length: 5 }, opaque), LAWFUL_NEG: Array.from({ length: 5 }, opaque) };
const snapshot = await growSnapshot(HISTORY_EVENTS);

// ---- production prompt surfaces, captured through a zero-model turn -----------
let languageSystem = '';
const recordingLanguage = { complete: async (request) => {
  languageSystem = request.messages.find((message) => message.role === 'system')?.content ?? '';
  return { model: 'capture', content: JSON.stringify({ schema_version: 'language-realization-semantic-draft-v1', text: 'capture', evidence_refs: [] }) };
} };
const captureTurn = await runCondition({
  snapshot, scenario: QUALIFICATION_SCENARIOS[0], conditionId: 'A',
  cognitionTransport: stubCognitionTransport(), languageTransport: recordingLanguage, sessionId: opaque()
});
if (languageSystem === '') throw new Error('language prompt capture failed');
const cognitionSystem = captureTurn.raw_cognition_request.messages.find((message) => message.role === 'system')?.content ?? '';
if (!cognitionSystem.includes('FORBIDDEN rationale content')) throw new Error('cognition prompt is not the C4.2 policy revision');
if (!languageSystem.includes('NO SEMANTIC COMPLETION')) throw new Error('language prompt is not the C4.2 policy revision');

const baseRequests = {};
const attestation = {};
for (const scenario of FORMAL_SCENARIOS) {
  const capture = await captureBaseRequest(snapshot, scenario, opaque());
  if (capture.request.structured_output?.kind !== 'JSON_SCHEMA') throw new Error(`${scenario.id}: native schema missing`);
  const advertised = JSON.stringify(capture.request.structured_output.schema);
  if (advertised.includes('projection_hash')) throw new Error(`${scenario.id}: schema must not advertise a projection hash`);
  if (!advertised.includes('NOT_APPLICABLE') || !advertised.includes('SELECTED')) throw new Error(`${scenario.id}: both applicability branches required`);
  const conditions = {};
  for (const id of ['P', 'N', 'Z', 'A']) {
    const variant = conditionVariant(capture.user_content, id);
    const audit = auditAffectVariant(capture.user_content, variant.transformed, variant.removedIndices ?? []);
    const absent = id === 'A' ? verifyAbsentIsBaseMinusAffect(capture.user_content, variant.transformed, variant.removedIndices ?? []) : { ok: true, reasons: [] };
    const labels = assertNoExperimentalLabels(`${capture.system_content}\n${variant.transformed}`);
    const invariant = subjectDataInvariantDigest(capture.user_content) === subjectDataInvariantDigest(variant.transformed);
    const ok = audit.ok && absent.ok && labels.ok && invariant && memorySection(variant.transformed) !== '';
    conditions[id] = {
      ok, problems: [...audit.reasons, ...absent.reasons, ...labels.found],
      system_sha256: sha256(capture.system_content), user_sha256: sha256(variant.transformed),
      memory_sha256: sha256(memorySection(variant.transformed)), invariant_digest: subjectDataInvariantDigest(variant.transformed),
      structured_schema_sha256: hashJson(capture.request.structured_output.schema), differing_indices: audit.differing_indices,
      removed_indices: variant.removedIndices ?? []
    };
    if (!ok) throw new Error(`${scenario.id}/${id}: request isolation failure`);
  }
  baseRequests[scenario.id] = {
    system_content: capture.system_content, user_content: capture.user_content, projection_hash: capture.projection_hash,
    observation_ref: capture.observation_ref, structured_output: capture.request.structured_output
  };
  attestation[scenario.id] = conditions;
}

const paraphrase = JSON.parse(await readFile(resolve(here, 'lexical-guard-evaluation.json'), 'utf8'));
const harness = {
  classify_sha256: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8')),
  pipeline_sha256: sha256(await readFile(resolve(here, 'lib/pipeline.mjs'), 'utf8')),
  config_sha256: sha256(await readFile(resolve(here, 'lib/config.mjs'), 'utf8')),
  grounding_guard_sha256: sha256(await readFile(resolve(here, 'lib/grounding-guard.mjs'), 'utf8'))
};

const common = {
  repository_head: head, created_before_model_calls: true, subject_id: SUBJECT_ID, provider, declared_provider: PROVIDER,
  generation_settings: { temperature: 0, think: false, stream: false, num_ctx: 8192, cognition_num_predict: 2048, language_num_predict: 2048 },
  conditions: CONDITIONS, history_events: HISTORY_EVENTS, retry_policy: RETRY_POLICY,
  endpoint: PROTOCOL_STRINGS.endpoint,
  protocol: `${PROTOCOL_STRINGS.cognition} + ${PROTOCOL_STRINGS.language_input} + ${PROTOCOL_STRINGS.language_draft}`,
  version_policy: PROTOCOL_STRINGS.version_policy,
  host_owned_integrity: PROTOCOL_STRINGS.host_owned_integrity, native_structured_output: true,
  rationale_policy: RATIONALE_CLASSES,
  grounding: GROUNDING,
  paraphrase_suite_result: {
    suite_sha256: paraphrase.suite_sha256,
    lawful_accepted: paraphrase.scores.lawful_accepted,
    lawful_total: paraphrase.scores.lawful_total,
    invalid_detected: paraphrase.scores.invalid_detected,
    invalid_total: paraphrase.scores.invalid_total,
    shipped: paraphrase.shipped,
    recorded_flag: paraphrase.recorded_flag
  },
  falsification: FALSIFICATION,
  schema_authority: {
    proposal_v5_schema_sha256: hashJson(CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA),
    semantic_draft_schema_sha256: hashJson(LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA),
    cognition_prompt_sha256: sha256(cognitionSystem),
    language_prompt_sha256: sha256(languageSystem),
    factual_source_authority: 'subject:, entity: and environment: refs remain non-factual sources; only FACTUAL SOURCE REFS may appear in factual_assessment.source_refs',
    host_binding: 'CognitionInvocationBindingV1 / LanguageInvocationBindingV0 in-flight bindings; no model-emitted projection_hash'
  },
  session_id_policy: 'opaque UUID per cell (c42-<uuid>), no scenario/condition/replicate identity',
  materiality: { ...MATERIALITY, within_split: [[0, 1, 2], [3, 4, 5, 6]] }, call_budget: CALL_BUDGET,
  primary_endpoint: 'RATIONALE_LAWFUL_AND_ON_QUESTION_STANCE', harness
};
const qualificationFreeze = {
  schema_version: 'affect-cognition-c4-2-qualification-freeze-v0', ...common,
  condition: CONDITIONS.A, scenarios: QUALIFICATION_SCENARIOS, replicates: QUALIFICATION_REPLICATES,
  opaque_session_ids: qualificationIds,
  success: 'all 65 must be protocol-valid and fully delivered, with CHOICE_APPLICABILITY_CORRECT everywhere (NOT_APPLICABLE on all 30 null cells; SELECTED with an on-question stance on all 35 choice cells), every rationale null or in the allowed classes (zero forbidden categories), zero off-question stances, zero language semantic completions, zero self-state factual claims, zero unlawful factual source refs, zero unsupported premise, zero false clarification and zero isolation violation'
};
const qualificationHash = hashJson(qualificationFreeze);
const formalFreeze = {
  schema_version: 'affect-cognition-c4-2-formal-freeze-v0', ...common,
  prerequisite: `qualification freeze ${qualificationHash} must pass 65/65`, scenarios: FORMAL_SCENARIOS,
  replicates: FORMAL_REPLICATES, opaque_session_ids: formalIds, lawful_opaque_session_ids: lawfulIds,
  conditions_schedule: 'round-robin P,N,A,Z rotated by replicate',
  success: {
    null: '168/168 NOT_APPLICABLE, correct fact, no invented preference',
    mixed_facts: '84/84', mixed_choices: '84/84 SELECTED on-question with lawful rationale', mixed_material: '>=1/3',
    relevant_material: '>=3/4', forbidden_rationale: 0, off_question_stances: 0, language_completions: 0,
    self_state_facts: 0, unlawful_sources: 0, false_clarify: 0, protocol_failures: 0
  }
};
const formalHash = hashJson(formalFreeze);
await writeFile(resolve(here, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'request-attestation.json'), `${JSON.stringify({ schema_version: 'affect-cognition-c4-2-request-attestation-v0', pass: true, invariant: 'only the Affect projection differs across P/N/Z/A; the C4.2 prompts and tagged schema are identical everywhere', scenarios: attestation }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-freeze.json'), `${JSON.stringify({ ...qualificationFreeze, freeze_hash: qualificationHash }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'formal-freeze.json'), `${JSON.stringify({ ...formalFreeze, freeze_hash: formalHash }, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ provider, head, qualification_freeze_hash: qualificationHash, formal_freeze_hash: formalHash, rationale_policy: RATIONALE_CLASSES, grounding: GROUNDING, paraphrase_suite_result: common.paraphrase_suite_result, schema_authority: common.schema_authority, calls: CALL_BUDGET }, null, 2)}\n`);

