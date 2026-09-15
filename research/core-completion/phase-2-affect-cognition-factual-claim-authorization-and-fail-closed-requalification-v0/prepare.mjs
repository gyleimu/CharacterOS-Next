/**
 * Factual-claim authorization V7 freeze preparation (NO model calls).
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
import {
  CONVERSATION_COGNITION_PROPOSAL_V7_JSON_SCHEMA,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V6,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V7,
  FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0,
  HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0,
  LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA,
  SUBJECTIVE_RATIONALE_AUTHORIZATION_POLICY_VERSION_V0
} from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256, memorySection, subjectDataInvariantDigest } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { assertNoExperimentalLabels, auditAffectVariant, verifyAbsentIsBaseMinusAffect } from '../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import {
  CALL_BUDGET, CONDITIONS, FALSIFICATION, FORMAL_REPLICATES, FORMAL_SCENARIOS, GROUNDING, HISTORY_EVENTS,
  MATERIALITY, PROTOCOL_STRINGS, PROVIDER, QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS,
  CONTRACT_LEGIBILITY, DERIVATION_REGISTRY, RATIONALE_CLASSES, RETRY_POLICY, SUBJECT_ID
} from './lib/config.mjs';
import { captureBaseRequest, conditionVariant, growSnapshot, runCondition, stubCognitionTransport } from './lib/pipeline.mjs';
import {
  FORMAL_SCENARIOS as PREVIOUS_FORMAL_SCENARIOS,
  QUALIFICATION_SCENARIOS as PREVIOUS_QUALIFICATION_SCENARIOS
} from '../phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0/lib/config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const providerVersion = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const installed = tags.models.find((entry) => entry.name === PROVIDER.model);
if (installed?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const provider = { version: providerVersion.version, name: installed.name, digest: installed.digest, quantization: installed.details?.quantization_level, size: installed.size };
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '..', '..', '..'), encoding: 'utf8' }).trim();
const opaque = () => `fca-${randomUUID()}`;
const qualificationIds = Object.fromEntries(QUALIFICATION_SCENARIOS.map((scenario) => [scenario.id, Array.from({ length: QUALIFICATION_REPLICATES }, opaque)]));
const formalIds = Object.fromEntries(FORMAL_SCENARIOS.map((scenario) => [scenario.id, Array.from({ length: FORMAL_REPLICATES }, opaque)]));
const snapshot = await growSnapshot(HISTORY_EVENTS);

if (JSON.stringify(HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0) !== JSON.stringify(DERIVATION_REGISTRY.operations)) {
  throw new Error('PRODUCTION_RESEARCH_FACTUAL_POLICY_DIVERGENCE');
}
if (JSON.stringify(QUALIFICATION_SCENARIOS) !== JSON.stringify(PREVIOUS_QUALIFICATION_SCENARIOS)
  || JSON.stringify(FORMAL_SCENARIOS) !== JSON.stringify(PREVIOUS_FORMAL_SCENARIOS)) {
  throw new Error('SCENARIO_BYTES_CHANGED');
}
const expectedPrompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V6
  .replaceAll('conversation-cognition-proposal-v6', 'conversation-cognition-proposal-v7')
  .replace(
    'for example: {"claims":[{"kind":"DERIVED_RESULT","text":"...","source_handles":["F2"]}],"cognition"',
    'for example: {"claims":[{"kind":"SOURCE_QUOTE","text":"<exact source substring>","source_handles":["F2"]}],"cognition"'
  )
  .replace(
    '8. FACTUAL ASSESSMENT: at most 8 claims; each has exactly kind, text, source_handles; text is non-empty and at most 512 code points; source_handles is non-empty and unique.',
    '8. FACTUAL ASSESSMENT: at most 8 claims. Each claim is exactly SOURCE_QUOTE with text/source_handles, or HOST_VERIFIABLE_DERIVATION with operation/source_handles/derivation. Arbitrary paraphrase or inference is not factual authority.'
  )
  .replace(
    '9. SOURCE_QUOTE text must occur verbatim, with exact case and punctuation, in every cited source. Use DERIVED_RESULT for arithmetic, classification, extraction, transformation or any non-verbatim result.',
    '9. SOURCE_QUOTE text must occur verbatim, with exact case and punctuation, in every cited source. Non-verbatim authority is limited to the advertised closed operations: INTEGER_ARITHMETIC(source_expression, operands{left,operator:ADD|SUBTRACT,right}, claimed_result), STRING_REVERSE(source_instruction,input,claimed_result), and RULE_CLASSIFICATION(source_rule,source_query,claimed_result). The host recomputes every result exactly; do not add display text.'
  );
if (CONVERSATION_COGNITION_SYSTEM_PROMPT_V7 !== expectedPrompt) throw new Error('PROMPT_SEMANTIC_CONTRACT_CHANGED');

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
if (cognitionSystem !== CONVERSATION_COGNITION_SYSTEM_PROMPT_V7) throw new Error('captured cognition prompt differs from production V7');
if (!cognitionSystem.includes('FORBIDDEN rationale content')) throw new Error('cognition prompt lost the rationale policy');
if (!cognitionSystem.includes('CITATION BINDING')) throw new Error('cognition prompt is not the citation-binding revision');
if (!cognitionSystem.includes('STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION')) throw new Error('cognition prompt lacks the C4.4 latitude discriminator');
if (!cognitionSystem.includes('FACTUAL SOURCE HANDLES')) throw new Error('cognition prompt lacks the C4.4 handle contract');
if (!languageSystem.includes('NEVER supply a decision target')) throw new Error('language prompt is not the C4.4 policy revision');

const baseRequests = {};
const attestation = {};
for (const scenario of FORMAL_SCENARIOS) {
  const capture = await captureBaseRequest(snapshot, scenario, opaque());
  if (capture.request.structured_output?.kind !== 'JSON_SCHEMA') throw new Error(`${scenario.id}: native schema missing`);
  const advertised = JSON.stringify(capture.request.structured_output.schema);
  if (advertised.includes('projection_hash')) throw new Error(`${scenario.id}: schema must not advertise a projection hash`);
  if (!advertised.includes('NO_SUBJECTIVE_SELECTION') || !advertised.includes('SUBJECTIVE_SELECTION')) throw new Error(`${scenario.id}: both applicability branches required`);
  if (!advertised.includes('considered_handles') || !advertised.includes('source_handles')) throw new Error(`${scenario.id}: the C4.4 handle wire keys must be advertised`);
  if (!advertised.includes('HOST_VERIFIABLE_DERIVATION') || advertised.includes('DERIVED_RESULT')) throw new Error(`${scenario.id}: V7 factual claim kinds not closed`);
  for (const operation of DERIVATION_REGISTRY.operations) if (!advertised.includes(operation)) throw new Error(`${scenario.id}: missing operation ${operation}`);
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

const contractAudit = { verdict: 'HANDLE_CONTRACT_APPLIES', uncovered_material_obligations: [] };
const harness = {
  classify_sha256: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8')),
  pipeline_sha256: sha256(await readFile(resolve(here, 'lib/pipeline.mjs'), 'utf8')),
  config_sha256: sha256(await readFile(resolve(here, 'lib/config.mjs'), 'utf8')),
};
const policySource = await readFile(resolve(here, '../../../packages/runtime/src/transitions/conversation/factual-claim-authorization.ts'), 'utf8');
const proposalSource = await readFile(resolve(here, '../../../packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts'), 'utf8');
const rationaleSource = await readFile(resolve(here, '../../../packages/runtime/src/transitions/conversation/subjective-rationale-authorization.ts'), 'utf8');
const authoritativeSchema = {
  kinds: ['SOURCE_QUOTE', 'HOST_VERIFIABLE_DERIVATION'],
  operations: DERIVATION_REGISTRY.operations,
  derived_text_owner: 'HOST_CANONICAL_RENDERER',
  transaction: 'WHOLE_PROPOSAL_FAIL_CLOSED'
};

const common = {
  repository_head: head, created_before_model_calls: true, subject_id: SUBJECT_ID, provider, declared_provider: PROVIDER,
  generation_settings: { temperature: 0, think: false, stream: false, num_ctx: 8192, cognition_num_predict: 2048, language_num_predict: 2048 },
  conditions: CONDITIONS, history_events: HISTORY_EVENTS, retry_policy: RETRY_POLICY,
  endpoint: PROTOCOL_STRINGS.endpoint,
  protocol: `${PROTOCOL_STRINGS.cognition} + ${PROTOCOL_STRINGS.language_input} + ${PROTOCOL_STRINGS.language_draft}`,
  version_policy: PROTOCOL_STRINGS.version_policy,
  citation_binding: PROTOCOL_STRINGS.citation_binding,
  ref_handles: PROTOCOL_STRINGS.ref_handles,
  host_owned_integrity: PROTOCOL_STRINGS.host_owned_integrity, native_structured_output: true,
  rationale_policy: RATIONALE_CLASSES,
  factual_authorization: {
    policy_version: FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0,
    policy_source_sha256: sha256(policySource),
    admitted_registry: DERIVATION_REGISTRY,
    admitted_registry_sha256: hashJson(DERIVATION_REGISTRY),
    host_recomputation_renderer_sha256: sha256(policySource),
    authoritative_schema: authoritativeSchema,
    authoritative_schema_sha256: hashJson(authoritativeSchema),
    transaction_severity: {
      tier_1: 'atomic authoritative fields: any invalidity rejects the whole proposal',
      tier_2: 'optional zero-authority subjective_rationale: invalid content becomes null',
      tier_3: 'raw response and typed rejection trace: diagnostic only'
    }
  },
  grounding: GROUNDING,
  contract_legibility: {
    repaired_defect: 'free-form factual assessment over-authorized; V7 closes claim kinds and fails the whole proposal on any rejected fact',
    host_validator_changed: true,
    handle_canonicalization: 'F* = factual-source namespace, C* = citeable-context namespace; exact advertised match only; unknown/malformed/namespace-escalating handles fail closed; canonical refs are authoritative and stored',
    wire_vs_authoritative: 'V7 wire derivations carry no display text; host canonicalization resolves handles, recomputes results and renders authoritative text before any proposal hash',
    audit_verdict: contractAudit.verdict,
    audit_uncovered_material: contractAudit.uncovered_material_obligations
  },
  paraphrase_suite_result_frozen_from_c4_2: {
    suite_sha256: 'sha256:2e810540b4c273d6061444914f09f315f863b617cdc61116663ef11dcd96d21e',
    lawful_accepted: 34,
    lawful_total: 40,
    invalid_detected: 15,
    invalid_total: 20,
    shipped: false,
    recorded_flag: 'LEXICAL_GROUNDING_GUARD_TOO_BRITTLE'
  },
  falsification: FALSIFICATION,
  schema_authority: {
    proposal_v7_wire_schema_sha256: hashJson(CONVERSATION_COGNITION_PROPOSAL_V7_JSON_SCHEMA),
    authoritative_schema_sha256: hashJson(authoritativeSchema),
    semantic_draft_schema_sha256: hashJson(LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA),
    cognition_prompt_sha256: sha256(cognitionSystem),
    language_prompt_sha256: sha256(languageSystem),
    factual_source_authority: 'SOURCE_QUOTE exact source substring or structured HOST_VERIFIABLE_DERIVATION only; arbitrary paraphrase and semantic inference are not authoritative',
    host_binding: 'CognitionInvocationBindingV3 / LanguageInvocationBindingV0 in-flight bindings; no model-emitted projection_hash; canonical refs are host-resolved from exact advertised handles'
  },
  policy_digests: {
    factual_authorization_policy: sha256(policySource),
    rationale_authorization_policy_version: SUBJECTIVE_RATIONALE_AUTHORIZATION_POLICY_VERSION_V0,
    rationale_authorization_policy: sha256(rationaleSource),
    choice_evaluator: sha256(proposalSource),
    n5q_evaluator: harness.classify_sha256
  },
  prompt_semantic_contract_unchanged: true,
  session_id_policy: 'opaque UUID per cell (fca-<uuid>), no scenario/condition/replicate identity',
  materiality: { ...MATERIALITY, within_split: [[0, 1, 2], [3, 4, 5, 6]] }, call_budget: CALL_BUDGET,
  primary_factual_gate: 'AUTHORITATIVE_RUNTIME_FACTUAL_VALID=65/65',
  primary_endpoint: 'Affect -> SUBJECTIVE_SELECTION.stance, only for factually valid authoritative proposals', harness
};
const qualificationFreeze = {
  schema_version: 'affect-cognition-factual-authority-qualification-freeze-v0', ...common,
  condition: CONDITIONS.A, scenarios: QUALIFICATION_SCENARIOS, replicates: QUALIFICATION_REPLICATES,
  opaque_session_ids: qualificationIds,
  success: 'AUTHORITATIVE_RUNTIME_FACTUAL_VALID 65/65, then all reached endpoints satisfy the unchanged applicability, stance, Language, rationale, handle, transport, identity and isolation gates'
};
const qualificationHash = hashJson(qualificationFreeze);
const formalFreeze = {
  schema_version: 'affect-cognition-factual-authority-formal-freeze-v0', ...common,
  prerequisite: `qualification freeze ${qualificationHash} must pass 65/65`, scenarios: FORMAL_SCENARIOS,
  replicates: FORMAL_REPLICATES, opaque_session_ids: formalIds,
  conditions_schedule: 'round-robin P,N,A,Z rotated by replicate',
  success: {
    factual_authority: '476/476 authoritative runtime factual-valid; every invalid factual cell stops and is excluded from causal scoring without silent omission',
    null: '168/168 NO_SUBJECTIVE_SELECTION, correct fact, no invented preference',
    mixed_facts: '84/84', mixed_choices: '84/84 SELECTED on-question with lawful rationale', mixed_material: '>=1/3',
    relevant_material: '>=3/4', forbidden_rationale: 0, off_question_stances: 0, language_completions: 0,
    self_state_facts: 0, unlawful_sources: 0, false_clarify: 0, protocol_failures: 0
  }
};
const formalHash = hashJson(formalFreeze);
await writeFile(resolve(here, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'request-attestation.json'), `${JSON.stringify({ schema_version: 'affect-cognition-c4-4-request-attestation-v0', pass: true, invariant: 'only the Affect projection differs across P/N/Z/A; the C4.2 prompts and tagged schema are identical everywhere', scenarios: attestation }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-freeze.json'), `${JSON.stringify({ ...qualificationFreeze, freeze_hash: qualificationHash }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'formal-freeze.json'), `${JSON.stringify({ ...formalFreeze, freeze_hash: formalHash }, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ provider, head, contract_legibility: CONTRACT_LEGIBILITY, qualification_freeze_hash: qualificationHash, formal_freeze_hash: formalHash, factual_authorization: common.factual_authorization, policy_digests: common.policy_digests, rationale_policy: RATIONALE_CLASSES, grounding: GROUNDING, schema_authority: common.schema_authority, calls: CALL_BUDGET }, null, 2)}\n`);
