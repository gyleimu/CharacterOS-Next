/* globals fetch */
/** Freeze requests and the complete revalidation design. Zero real model calls. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { growSnapshot } from '../phase-2-affect-authority-contract-revalidation-v0/lib/pipeline.mjs';
import { hashJson, memorySection, sha256, subjectDataInvariantDigest } from '../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  affectValueLine,
  assertNoExperimentalLabels,
  auditAffectVariant,
  removeAffectSection,
  swapAffectValue,
  verifyAbsentIsBaseMinusAffect
} from '../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import {
  CALL_BUDGET,
  CONDITIONS,
  HISTORY_EVENTS,
  MATERIALITY,
  PRIMARY_SCENARIOS,
  PROVIDER,
  REPLICATES,
  RETRY_POLICY,
  SUBJECT_ID,
  SUCCESS,
  primarySchedule
} from './lib/config.mjs';
import { captureBaseRequest } from './lib/pipeline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hashFile = async (name) => sha256(await readFile(resolve(here, name), 'utf8'));

async function verifyProvider() {
  const version = await (await fetch(`${PROVIDER.base_url}/api/version`)).json();
  const tags = await (await fetch(`${PROVIDER.base_url}/api/tags`)).json();
  const model = tags.models.find((entry) => entry.name === PROVIDER.model);
  if (model?.digest !== PROVIDER.required_digest) throw new Error('MODEL_BASELINE_CHANGED');
  return {
    version: version.version,
    name: model.name,
    digest: model.digest,
    quantization: model.details?.quantization_level,
    size: model.size
  };
}

function variantsFor(userContent) {
  const variants = {};
  for (const id of ['P', 'N', 'Z']) {
    const condition = CONDITIONS[id];
    variants[id] = swapAffectValue(userContent, affectValueLine(condition.valence, condition.activation));
  }
  variants.A = removeAffectSection(userContent);
  return variants;
}

function attestScenario(scenario, capture) {
  const variants = variantsFor(capture.userContent);
  const invariant = subjectDataInvariantDigest(capture.userContent);
  const schemaHash = hashJson(capture.structuredOutput.schema);
  const problems = [];
  if (memorySection(capture.userContent) === '') problems.push('empty Memory section');
  if (capture.structuredOutput.kind !== 'JSON_SCHEMA') problems.push('structured constraint missing');
  const conditions = {};
  for (const id of ['P', 'N', 'Z', 'A']) {
    const variant = variants[id];
    const audit = auditAffectVariant(capture.userContent, variant.transformed, variant.removedIndices ?? []);
    const absent = id === 'A'
      ? verifyAbsentIsBaseMinusAffect(capture.userContent, variant.transformed, variant.removedIndices)
      : { ok: true, reasons: [] };
    const labels = assertNoExperimentalLabels(`${capture.systemContent}\n${variant.transformed}`);
    const invariantOk = subjectDataInvariantDigest(variant.transformed) === invariant;
    const ok = audit.ok && absent.ok && labels.ok && invariantOk;
    if (!ok) problems.push(`${id}: ${[...audit.reasons, ...absent.reasons, ...labels.found].join('; ')}`);
    conditions[id] = {
      kind: CONDITIONS[id].kind,
      valence: CONDITIONS[id].valence,
      activation: CONDITIONS[id].activation,
      system_sha256: sha256(capture.systemContent),
      user_sha256: sha256(variant.transformed),
      memory_section_sha256: sha256(memorySection(variant.transformed)),
      invariant_digest: subjectDataInvariantDigest(variant.transformed),
      structured_output_kind: capture.structuredOutput.kind,
      structured_output_schema_sha256: schemaHash,
      affect_section: id === 'A' ? [] : [variant.replacement],
      differing_indices: audit.differing_indices,
      removed_indices: variant.removedIndices ?? [],
      provider_visible_condition_labels: labels.found,
      isolation_ok: ok
    };
  }
  return { scenario: scenario.id, ok: problems.length === 0, problems, conditions };
}

const provider = await verifyProvider();
const snapshot = await growSnapshot(HISTORY_EVENTS);
const baseRequests = {};
const attestations = {};
const problems = [];
for (const scenario of PRIMARY_SCENARIOS) {
  const capture = await captureBaseRequest(snapshot, scenario, `sess-remediation-capture-${scenario.id}`);
  const attestation = attestScenario(scenario, capture);
  if (!attestation.ok) problems.push(...attestation.problems.map((problem) => `${scenario.id}: ${problem}`));
  baseRequests[scenario.id] = { ...capture, attestation };
  attestations[scenario.id] = attestation;
}
if (problems.length > 0) throw new Error(`request isolation failed: ${problems.join(' | ')}`);

const artifactHashes = {
  capability_candidates: await hashFile('capability-candidates.json'),
  capability_calibration: await hashFile('capability-calibration-infrastructure-retry-1.jsonl'),
  qualified_null_oracle: await hashFile('qualified-null-oracle-infrastructure-retry-1.json'),
  mixed_scenarios: await hashFile('mixed-scenarios.json'),
  prior_activation_analysis: sha256(
    await readFile(
      resolve(here, '..', 'phase-2-affect-authority-contract-revalidation-v0', 'evidence', 'activation-analysis.json'),
      'utf8'
    )
  )
};
const freeze = {
  schema_version: 'affect-authority-revalidation-remediation-freeze-v0',
  created_before_run_of_record: true,
  repository_head: 'abcc41976d894f1b6b7d1a650d5293dadeb1f9e2',
  family_c_changed: false,
  canonical_affect_changed: false,
  affect_timing_changed: false,
  protocol: 'conversation-cognition-proposal-v2 + language-realization-input-v3',
  serialization_constraint: 'OLLAMA_NATIVE_JSON_SCHEMA',
  host_validation_remains_authoritative: true,
  subject_id: SUBJECT_ID,
  provider,
  declared_provider: PROVIDER,
  history_events: HISTORY_EVENTS,
  conditions: CONDITIONS,
  scenarios: PRIMARY_SCENARIOS,
  replicates: REPLICATES,
  schedule: primarySchedule(REPLICATES),
  endpoint: 'final production-admissible observable behavior',
  stages: ['RAW_PROVIDER_RESPONSE', 'SCHEMA_VALID', 'EXECUTOR_ADMISSIBLE', 'LANGUAGE_ADMISSIBLE', 'FINAL_BEHAVIOR'],
  materiality: MATERIALITY,
  success: SUCCESS,
  retry_policy: { ...RETRY_POLICY, run_of_record_infrastructure_retries: 0 },
  call_budget: CALL_BUDGET,
  activation: {
    rerun: false,
    reason: 'Provider-native serialization changes shape reliability only; prior activation evidence had no malformed cells and is retained as prior evidence.',
    artifact_sha256: artifactHashes.prior_activation_analysis
  },
  artifact_hashes: artifactHashes,
  base_request_hashes: Object.fromEntries(
    Object.entries(baseRequests).map(([id, value]) => [id, {
      system: sha256(value.systemContent),
      user: sha256(value.userContent),
      structured_schema: hashJson(value.structuredOutput.schema)
    }])
  )
};
const freezeHash = hashJson(freeze);

await writeFile(resolve(here, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', flag: 'wx' });
await writeFile(resolve(here, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
await writeFile(
  resolve(here, 'request-attestation.json'),
  `${JSON.stringify({
    schema_version: 'affect-authority-request-attestation-v0',
    invariant: 'system contract, observation, task, identity, Memory, Belief, Relationship, Personality, action space, provider settings and JSON Schema are identical across P/N/Z/A; only Affect differs',
    scenarios: attestations
  }, null, 2)}\n`,
  { encoding: 'utf8', flag: 'wx' }
);
await writeFile(resolve(here, 'freeze.json'), `${JSON.stringify({ ...freeze, freeze_hash: freezeHash }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${JSON.stringify({ provider, scenarios: PRIMARY_SCENARIOS.length, call_budget: CALL_BUDGET, freeze_hash: freezeHash })}\n`);
