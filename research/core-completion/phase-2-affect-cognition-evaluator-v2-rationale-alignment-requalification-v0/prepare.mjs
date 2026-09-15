/**
 * AFFECT_COGNITION_EVALUATOR_V2_..._V0 — freeze preparation (NO model calls).
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
  MATERIALITY, NEGATIVE_EXAMPLES, POSITIVE_EXAMPLES, PROTOCOL_STRINGS, PROVIDER, QUALIFICATION_REPLICATES,
  QUALIFICATION_SCENARIOS, REMOVED_EXAMPLES, FORBIDDEN_EXAMPLE_TOKENS, CONTRACT_LEGIBILITY, RATIONALE_CLASSES,
  RETRY_POLICY, SUBJECT_ID, HEADROOM
} from './lib/config.mjs';
import { captureBaseRequest, conditionVariant, growSnapshot, runCondition, stubCognitionTransport } from './lib/pipeline.mjs';
import { rationaleVerdict } from './lib/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const providerVersion = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
const installed = tags.models.find((entry) => entry.name === PROVIDER.model);
if (installed?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
const provider = { version: providerVersion.version, name: installed.name, digest: installed.digest, quantization: installed.details?.quantization_level, size: installed.size };
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '..', '..', '..'), encoding: 'utf8' }).trim();
const opaque = () => `ev2-${randomUUID()}`;
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
// The compacted, example-neutral contract must actually be the one sent.
for (const required of ['SUBJECT-PROPERTY BOUNDARY', 'AVAILABILITY IS NOT CAPACITY', 'the supplied facts permit either response', 'I prefer the window seat because I like the quieter side.', "I'd rather spend the available time reading.", "I'd rather use the blue notebook because it keeps my notes organized.", 'I have enough capacity.']) {
  if (!cognitionSystem.includes(required)) throw new Error(`cognition prompt lacks the compacted contract: ${required}`);
}
if (!languageSystem.includes('NEVER supply a decision target')) throw new Error('language prompt is not the C4.4 policy revision');

// ---- §18 CONTRACT-COMPACTION COVERAGE AUDIT (zero model calls) -------------------
const COVERAGE_OBLIGATIONS = Object.freeze([
  ['subjective-selection latitude discriminator', 'leave more than one behaviourally admissible, fact-compatible response'],
  ['determined-result != subjective selection', 'STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION'],
  ['availability != capacity/capability', 'AVAILABILITY IS NOT CAPACITY'],
  ['subject-state latent-only', 'stays LATENT'],
  ['rationale preference frame', 'preference, priority, aversion, willingness or subjective strategy'],
  ['rationale no factual authority', 'carries NO factual authority'],
  ['factual source authority', 'Subject state is NEVER a factual source'],
  ['factual claim source binding', 'CITATION BINDING'],
  ['handle namespace rules', 'FACTUAL SOURCE HANDLES'],
  ['host canonical identity', 'identity is host-owned'],
  ['stance is sole choice authority', 'stance is ONE short sentence stating the choice itself'],
  ['Language cannot semantically complete', 'NEVER supply a decision target']
]);
const coverage = {
  schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-coverage-audit-v0',
  obligations: COVERAGE_OBLIGATIONS.map(([obligation, marker]) => ({ obligation, marker, present: cognitionSystem.includes(marker) || (obligation === 'Language cannot semantically complete' && languageSystem.includes(marker)) })),
  prompt_chars: cognitionSystem.length
};
coverage.uncovered = coverage.obligations.filter((entry) => !entry.present).map((entry) => entry.obligation);
coverage.verdict = coverage.uncovered.length === 0 ? 'CONTRACT_COMPACTION_COVERAGE_PASS' : 'CONTRACT_COMPACTION_COVERAGE_FAIL';
await writeFile(resolve(here, 'contract-coverage-audit.json'), `${JSON.stringify(coverage, null, 2)}\n`, { flag: 'wx' });
if (coverage.verdict !== 'CONTRACT_COMPACTION_COVERAGE_PASS') throw new Error(`CONTRACT_COVERAGE_FAILURE: ${coverage.uncovered.join(', ')}`);

// ---- §19/§20 EXAMPLE-NEUTRALITY + FORBIDDEN-VOCABULARY AUDIT ---------------------
const scenarioText = QUALIFICATION_SCENARIOS.map((scenario) => scenario.event).join('\n');
const neutrality = {
  schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-example-neutrality-audit-v0',
  positive_examples: POSITIVE_EXAMPLES,
  negative_examples: NEGATIVE_EXAMPLES,
  removed_examples_absent_from_prompt: REMOVED_EXAMPLES.map((example) => ({ example, absent: !cognitionSystem.includes(example) })),
  positive_examples_in_prompt: POSITIVE_EXAMPLES.map((example) => ({ example, present: cognitionSystem.includes(example) })),
  forbidden_token_hits: POSITIVE_EXAMPLES.flatMap((example) => FORBIDDEN_EXAMPLE_TOKENS.filter((token) => example.toLowerCase().includes(token)).map((token) => ({ example, token }))),
  overlap_with_scenario_text: POSITIVE_EXAMPLES.filter((example) => scenarioText.includes(example)),
  classifier_verdicts: POSITIVE_EXAMPLES.map((example) => ({ example, ...rationaleVerdict(example) }))
};
neutrality.pass = neutrality.removed_examples_absent_from_prompt.every((entry) => entry.absent)
  && neutrality.positive_examples_in_prompt.every((entry) => entry.present)
  && neutrality.forbidden_token_hits.length === 0
  && neutrality.overlap_with_scenario_text.length === 0
  && neutrality.classifier_verdicts.every((verdict) => verdict.lawful && verdict.allowed_classes.length > 0);
neutrality.verdict = neutrality.pass ? 'EXAMPLE_NEUTRALITY_PASS' : 'EXAMPLE_NEUTRALITY_FAIL';
await writeFile(resolve(here, 'example-neutrality-audit.json'), `${JSON.stringify(neutrality, null, 2)}\n`, { flag: 'wx' });
if (!neutrality.pass) throw new Error('EXAMPLE_NEUTRALITY_AUDIT_FAILURE');

// ---- §24 M3 RISK AUDIT (preregistered, descriptive — not proof of non-looping) ---
const previousBase = JSON.parse(await readFile(resolve(here, '..', 'phase-2-affect-cognition-rationale-vocabulary-and-latitude-legibility-v0', 'base-requests.json'), 'utf8'));
const previousPromptChars = previousBase.N1.system_content.length;
const vocabularyCensus = Object.fromEntries(['capacity', 'capable', 'capability', 'energy', 'stress', 'fatigue', 'bandwidth', 'readiness', 'workload', 'fresh', 'manage', 'available'].map((term) => [term, (cognitionSystem.match(new RegExp(term, 'gi')) ?? []).length]));
const m3Risk = {
  schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-m3-risk-audit-v0',
  note: 'preregistered risk audit only; it cannot prove M3 will not loop',
  prompt_chars_current: cognitionSystem.length,
  prompt_chars_previous_slice: previousPromptChars,
  prompt_char_delta: cognitionSystem.length - previousPromptChars,
  capability_availability_vocabulary_occurrences: vocabularyCensus,
  worked_example_count: POSITIVE_EXAMPLES.length + NEGATIVE_EXAMPLES.length,
  repeated_enumeration_removed: 'rules 2/5a/5b/6/10 compacted; one central subject-property boundary (rule 5d) replaces the repeated vocabulary enumerations'
};
await writeFile(resolve(here, 'm3-risk-audit.json'), `${JSON.stringify(m3Risk, null, 2)}\n`, { flag: 'wx' });

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

// ---- §20/§21 prompt + scenario byte-identity vs the previous frozen slice ---------
const previousFreeze = JSON.parse(await readFile(resolve(here, '..', 'phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0', 'qualification-freeze.json'), 'utf8'));
const previousScenarios = await import('../phase-2-affect-cognition-contract-compaction-and-example-neutrality-v0/lib/config.mjs');
const promptDigest = sha256(cognitionSystem);
const languagePromptDigest = sha256(languageSystem);
const scenarioDigest = sha256(JSON.stringify([QUALIFICATION_SCENARIOS, FORMAL_SCENARIOS]));
const scenarioDigestPrevious = sha256(JSON.stringify([previousScenarios.QUALIFICATION_SCENARIOS, previousScenarios.FORMAL_SCENARIOS]));
if (promptDigest !== previousFreeze.schema_authority.cognition_prompt_sha256) throw new Error('COGNITION_PROMPT_CHANGED');
if (languagePromptDigest !== previousFreeze.schema_authority.language_prompt_sha256) throw new Error('LANGUAGE_PROMPT_CHANGED');
if (scenarioDigest !== scenarioDigestPrevious) throw new Error('SCENARIO_CHANGED');
if (JSON.stringify(POSITIVE_EXAMPLES) !== JSON.stringify(previousFreeze.example_set.positive)) throw new Error('EXAMPLES_CHANGED');

const instrumentProbes = JSON.parse(await readFile(resolve(here, 'instrument-probe-results.json'), 'utf8'));
if (instrumentProbes.pass !== true) throw new Error('INSTRUMENT_PROBES_NOT_GREEN');
if (instrumentProbes.n5q_evaluator_version !== 'n5q-result-evaluator-v2') throw new Error('N5Q_EVALUATOR_VERSION_MISMATCH');
if (instrumentProbes.rationale_classifier_version !== 'rationale-classifier-v2') throw new Error('RATIONALE_CLASSIFIER_VERSION_MISMATCH');

const harness = {
  classify_sha256: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8')),
  pipeline_sha256: sha256(await readFile(resolve(here, 'lib/pipeline.mjs'), 'utf8')),
  config_sha256: sha256(await readFile(resolve(here, 'lib/config.mjs'), 'utf8')),
  probes_sha256: sha256(await readFile(resolve(here, 'probes.mjs'), 'utf8')),
  probes_test_sha256: sha256(await readFile(resolve(here, 'probes.test.mjs'), 'utf8')),
  probe_results_sha256: sha256(await readFile(resolve(here, 'probe-results.json'), 'utf8')),
  sentinel_sha256: sha256(await readFile(resolve(here, 'sentinel.test.mjs'), 'utf8')),
  contract_coverage_audit_sha256: sha256(await readFile(resolve(here, 'contract-coverage-audit.json'), 'utf8')),
  example_neutrality_audit_sha256: sha256(await readFile(resolve(here, 'example-neutrality-audit.json'), 'utf8')),
  m3_risk_audit_sha256: sha256(await readFile(resolve(here, 'm3-risk-audit.json'), 'utf8')),
  instrument_probes_sha256: sha256(await readFile(resolve(here, 'instrument-probes.mjs'), 'utf8')),
  instrument_probe_results_sha256: sha256(await readFile(resolve(here, 'instrument-probe-results.json'), 'utf8')),
  // v2 instruments are new versions, not silent mutations: identity vs history is
  // asserted by the regression battery, not by byte-identity with C4.4.
  classifier_version: 'rationale-classifier-v2 + n5q-result-evaluator-v2',
  classifier_changed_from_previous: sha256(await readFile(resolve(here, 'lib/classify.mjs'), 'utf8'))
    !== previousFreeze.harness.classify_sha256
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
  instrument_probe_suite: {
    path: 'instrument-probes.mjs',
    n5q_evaluator_version: instrumentProbes.n5q_evaluator_version,
    rationale_classifier_version: instrumentProbes.rationale_classifier_version,
    n5q_lawful_pass: instrumentProbes.n5q_lawful.length, n5q_unlawful_fail: instrumentProbes.n5q_unlawful.length,
    value_lawful_pass: instrumentProbes.value_lawful.length, value_unlawful_rejected: instrumentProbes.value_unlawful.length,
    historical_rationale_regressions: instrumentProbes.historical_rationale.length,
    historical_n5q_regressions: instrumentProbes.historical_n5q.length,
    failures: instrumentProbes.failures, frozen_before_model_calls: true
  },
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
  example_set: {
    positive: POSITIVE_EXAMPLES,
    negative: NEGATIVE_EXAMPLES,
    removed: REMOVED_EXAMPLES,
    forbidden_tokens: FORBIDDEN_EXAMPLE_TOKENS,
    sha256: sha256(JSON.stringify({ positive: POSITIVE_EXAMPLES, negative: NEGATIVE_EXAMPLES })),
    neutrality_verdict: neutrality.verdict,
    m3_risk: m3Risk
  },
  transport_headroom: { ...HEADROOM, endpoint: 'no completed cell above threshold_90pct eval tokens; no done_reason=length; no truncation', applied_retroactively: false },
  contract_legibility: {
    repaired_defect: 'contract compaction + example neutrality: repeated subject-property enumerations collapsed into one central boundary rule (5d); all directionally contaminated rationale examples replaced by out-of-domain polarity-neutral ones',
    host_validator_changed: false,
    prompt_only_change: 'cognition rules 2, 5, 5a, 5b, new 5d, 6, 10 only; schema, wire keys, handle canonicalization, validators, executor, Language and Affect are byte-unchanged; num_predict unchanged at 2048',
    observed_defect_text: 'M3 x5 MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED (eval_count=2048, done_reason=length) + 25/30 verbatim example copies with 3 deterministic FIRST->SECOND stance shifts (rationale-vocabulary slice)',
    instrument_versions: harness.classifier_version,
    instrument_changed_from_previous_slice: harness.classifier_changed_from_previous,
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
  session_id_policy: 'opaque UUID per cell (ev2-<uuid>), no scenario/condition/replicate identity',
  materiality: { ...MATERIALITY, within_split: [[0, 1, 2], [3, 4, 5, 6]] }, call_budget: CALL_BUDGET,
  primary_endpoint: 'RATIONALE_LAWFUL_AND_ON_QUESTION_STANCE', harness
};
const qualificationFreeze = {
  schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-qualification-freeze-v0', ...common,
  condition: CONDITIONS.A, scenarios: QUALIFICATION_SCENARIOS, replicates: QUALIFICATION_REPLICATES,
  opaque_session_ids: qualificationIds,
  success: 'all 65 must be protocol-valid and fully delivered, with SELECTION_APPLICABILITY_CORRECT everywhere (NO_SUBJECTIVE_SELECTION on all 30 null cells; SUBJECTIVE_SELECTION with an on-question stance on all 35 choice cells), R1 5/5 with a null or allowed-class rationale and zero forbidden classes, every rationale null or in the allowed classes (zero forbidden categories), zero off-question stances, zero language semantic completions, zero subject-property factual claims, zero unlawful factual source refs, zero unsupported premise, zero false clarification, zero handle anomaly, zero isolation violation, zero transport truncations (no done_reason=length) and zero completed cell above 1843 eval tokens'
};
const qualificationHash = hashJson(qualificationFreeze);
const formalFreeze = {
  schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-formal-freeze-v0', ...common,
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
await writeFile(resolve(here, 'request-attestation.json'), `${JSON.stringify({ schema_version: 'affect-cognition-evaluator-v2-rationale-alignment-request-attestation-v0', pass: true, invariant: 'only the Affect projection differs across P/N/Z/A; the C4.2 prompts and tagged schema are identical everywhere', scenarios: attestation }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'qualification-freeze.json'), `${JSON.stringify({ ...qualificationFreeze, freeze_hash: qualificationHash }, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(here, 'formal-freeze.json'), `${JSON.stringify({ ...formalFreeze, freeze_hash: formalHash }, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ provider, head, contract_legibility: CONTRACT_LEGIBILITY, qualification_freeze_hash: qualificationHash, formal_freeze_hash: formalHash, rationale_policy: RATIONALE_CLASSES, grounding: GROUNDING, paraphrase_suite_result: common.paraphrase_suite_result, schema_authority: common.schema_authority, calls: CALL_BUDGET }, null, 2)}\n`);

