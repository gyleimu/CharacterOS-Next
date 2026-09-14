/**
 * AFFECT_COGNITION_RATIONALE_VOCABULARY_..._V0 — freeze preparation (NO model calls).
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
import { CONVERSATION_COGNITION_PROPOSAL_V6_JSON_SCHEMA, LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA } from '../../../packages/runtime/dist/index.js';
import { hashJson, sha256, memorySection, subjectDataInvariantDigest } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { assertNoExperimentalLabels, auditAffectVariant, verifyAbsentIsBaseMinusAffect } from '../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import {
  CALL_BUDGET, CONDITIONS, FALSIFICATION, FORMAL_REPLICATES, FORMAL_SCENARIOS, GROUNDING, HISTORY_EVENTS,
  MATERIALITY, PROTOCOL_STRINGS, PROVIDER, QUALIFICATION_REPLICATES, QUALIFICATION_SCENARIOS,
  CONTRACT_LEGIBILITY, RATIONALE_CLASSES, RETRY_POLICY, SUBJECT_ID
} from './lib/config.mjs';
import { captureBaseRequest, conditionVariant, growSnapshot, runCondition, stubCognitionTransport } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const providerVersion = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const installed = tags.models.find((entry) => entry.name === PROVIDER.model);
if (installed?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const provider = { version: providerVersion.version, name: installed.name, digest: installed.digest, quantization: installed.details?.quantization_level, size: installed.size };
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '..', '..', '..'), encoding: 'utf8' }).trim();
const opaque = () => `rv-${randomUUID()}`;
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
if (!cognitionSystem.includes('CITATION BINDING')) throw new Error('cognition prompt is not the citation-binding revision');
if (!cognitionSystem.includes('STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION')) throw new Error('cognition prompt lacks the C4.4 latitude discriminator');
if (!cognitionSystem.includes('FACTUAL SOURCE HANDLES')) throw new Error('cognition prompt lacks the C4.4 handle contract');
// Vocabulary-legibility repair: the refined contract must actually be the one sent.
for (const required of ['AVAILABILITY IS NOT CAPACITY', 'I prefer to use the free time to help.', 'the supplied facts permit either volunteering or declining', 'The subject has sufficient workload tolerance.', "I'd rather help."]) {
  if (!cognitionSystem.includes(required)) throw new Error(`cognition prompt lacks the refined vocabulary contract: ${required}`);
}
if (!languageSystem.includes('NEVER supply a decision target')) throw new Error('language prompt is not the C4.4 policy revision');

// ---- the zero-model probe suite must be green and is bound into the freeze -------
const probeResults = JSON.parse(await readFile(resolve(here, 'probe-results.json'), 'utf8'));
if (probeResults.pass !== true) throw new Error('PROBE_SUITE_NOT_GREEN');
if (probeResults.strict_divergences.length !== 0) throw new Error('PROBE_STRICT_DIVERGENCE');
if (probeResults.historical_r1_replay.still_unlawful_under_frozen_instrument !== true) throw new Error('HISTORICAL_R1_WAS_MADE_GREEN');

const baseRequests = {};
const attestation = {};
for (const scenario of FORMAL_SCENARIOS) {
  const capture = await captureBaseRequest(snapshot, scenario, opaque());
  if (capture.request.structured_output?.kind !== 'JSON_SCHEMA') throw new Error(`${scenario.id}: native schema missing`);
  const advertised = JSON.stringify(capture.request.structured_output.schema);
  if (advertised.includes('projection_hash')) throw new Error(`${scenario.id}: schema must not advertise a projection hash`);
  if (!advertised.includes('NO_SUBJECTIVE_SELECTION') || !advertised.includes('SUBJECTIVE_SELECTION')) throw new Error(`${scenario.id}: both applicability branches required`);
  if (!advertised.includes('considered_handles') || !advertised.includes('source_handles')) throw new Error(`${scenario.id}: the C4.4 handle wire keys must be advertised`);
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
  probes_sha256: sha256(await readFile(resolve(here, 'probes.mjs'), 'utf8')),
  probes_test_sha256: sha256(await readFile(resolve(here, 'probes.test.mjs'), 'utf8')),
  probe_results_sha256: sha256(await readFile(resolve(here, 'probe-results.json'), 'utf8')),
  sentinel_sha256: sha256(await readFile(resolve(here, 'sentinel.test.mjs'), 'utf8')),
  classifier_unchanged_from_c4_4: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8'))
    === sha256(await readFile(resolve(here, '..', 'phase-2-affect-cognition-c4-4-subjective-selection-semantics-and-ref-handles-v0', 'lib', 'classify.mjs'), 'utf8'))
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
  rationale_vocabulary: PROTOCOL_STRINGS.rationale_vocabulary,
  latitude_contract: PROTOCOL_STRINGS.latitude,
  availability_not_capacity: PROTOCOL_STRINGS.availability_not_capacity,
  subject_property_terms: PROTOCOL_STRINGS.subject_property_terms,
  probe_suite: {
    path: 'probes.mjs',
    cases: probeResults.probes.length,
    strict_divergences: probeResults.strict_divergences,
    lenient_coverage_gaps: probeResults.lenient_coverage_gaps,
    class_expectation_misses: probeResults.class_expectation_misses,
    historical_r1_replay: probeResults.historical_r1_replay,
    frozen_before_model_calls: true
  },
  grounding: GROUNDING,
  contract_legibility: {
    repaired_defect: 'rationale vocabulary and latitude legibility: the contract demonstrated the forbidden forms with concrete examples and the lawful forms only in the abstract, and its only concrete availability vocabulary was the forbidden word "capacity"',
    host_validator_changed: false,
    prompt_only_change: 'cognition rules 2, 5a, 5b, 6, 10 only; schema, wire keys, handle canonicalization, validators, executor, Language and Affect are byte-unchanged',
    observed_defect_text: 'I prefer to utilize my available capacity to assist with the task. (R1 x5, C4.4)',
    instrument_unchanged: harness.classifier_unchanged_from_c4_4,
    handle_canonicalization: 'F* = factual-source namespace, C* = citeable-context namespace; exact advertised match only; unknown/malformed/namespace-escalating handles fail closed; canonical refs are authoritative and stored',
    wire_vs_authoritative: 'conversation-cognition-proposal-v6 model wire carries handles; the authoritative proposal and hash carry canonical refs',
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
    proposal_v6_wire_schema_sha256: hashJson(CONVERSATION_COGNITION_PROPOSAL_V6_JSON_SCHEMA),
    semantic_draft_schema_sha256: hashJson(LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA),
    cognition_prompt_sha256: sha256(cognitionSystem),
    language_prompt_sha256: sha256(languageSystem),
    factual_source_authority: 'subject:, entity: and environment: refs remain non-factual sources; only the F* factual-source handles (resolved to FACTUAL SOURCE REFS) may appear in factual_assessment.claims[*].source_handles',
    host_binding: 'CognitionInvocationBindingV2 / LanguageInvocationBindingV0 in-flight bindings; no model-emitted projection_hash; canonical refs are host-resolved from exact advertised handles'
  },
  session_id_policy: 'opaque UUID per cell (rv-<uuid>), no scenario/condition/replicate identity',
  materiality: { ...MATERIALITY, within_split: [[0, 1, 2], [3, 4, 5, 6]] }, call_budget: CALL_BUDGET,
  primary_endpoint: 'RATIONALE_LAWFUL_AND_ON_QUESTION_STANCE', harness
};
const qualificationFreeze = {
  schema_version: 'affect-cognition-rationale-vocabulary-qualification-freeze-v0', ...common,
  condition: CONDITIONS.A, scenarios: QUALIFICATION_SCENARIOS, replicates: QUALIFICATION_REPLICATES,
  opaque_session_ids: qualificationIds,
  success: 'all 65 must be protocol-valid and fully delivered, with SELECTION_APPLICABILITY_CORRECT everywhere (NO_SUBJECTIVE_SELECTION on all 30 null cells; SUBJECTIVE_SELECTION with an on-question stance on all 35 choice cells), R1 5/5 with a null or allowed-class rationale and zero forbidden classes, every rationale null or in the allowed classes (zero forbidden categories), zero off-question stances, zero language semantic completions, zero subject-property factual claims, zero unlawful factual source refs, zero unsupported premise, zero false clarification, zero handle anomaly and zero isolation violation'
};
const qualificationHash = hashJson(qualificationFreeze);
const formalFreeze = {
  schema_version: 'affect-cognition-rationale-vocabulary-formal-freeze-v0', ...common,
  prerequisite: `qualification freeze ${qualificationHash} must pass 65/65`, scenarios: FORMAL_SCENARIOS,
  replicates: FORMAL_REPLICATES, opaque_session_ids: formalIds, lawful_opaque_session_ids: lawfulIds,
  conditions_schedule: 'round-robin P,N,A,Z rotated by replicate',
  success: {
    null: '168/168 NO_SUBJECTIVE_SELECTION, correct fact, no invented preference',
    mixed_facts: '84/84', mixed_choices: '84/84 SELECTED on-question with lawful rationale', mixed_material: '>=1/3',
    relevant_material: '>=3/4', forbidden_rationale: 0, off_question_stances: 0, language_completions: 0,
    self_state_facts: 0, unlawful_sources: 0, false_clarify: 0, protocol_failures: 0
  }
};
const formalHash = hashJson(formalFreeze);
await writeFile(resolve(here, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'request-attestation.json'), `${JSON.stringify({ schema_version: 'affect-cognition-rationale-vocabulary-request-attestation-v0', pass: true, invariant: 'only the Affect projection differs across P/N/Z/A; the C4.2 prompts and tagged schema are identical everywhere', scenarios: attestation }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-freeze.json'), `${JSON.stringify({ ...qualificationFreeze, freeze_hash: qualificationHash }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'formal-freeze.json'), `${JSON.stringify({ ...formalFreeze, freeze_hash: formalHash }, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ provider, head, contract_legibility: CONTRACT_LEGIBILITY, qualification_freeze_hash: qualificationHash, formal_freeze_hash: formalHash, rationale_policy: RATIONALE_CLASSES, grounding: GROUNDING, paraphrase_suite_result: common.paraphrase_suite_result, schema_authority: common.schema_authority, calls: CALL_BUDGET }, null, 2)}\n`);

