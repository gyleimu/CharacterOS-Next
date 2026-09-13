/* globals fetch, URL */
/**
 * Revalidation preparation (ZERO real model calls): verify provider, grow one
 * lawful snapshot, capture the production-rendered V2 base request per scenario,
 * attest P/N/Z/A isolation, and write the hashed freeze before any live call.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  ACTIVATION_CONDITIONS,
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
import { captureBaseRequest, growSnapshot } from './lib/pipeline.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

async function verifyProvider() {
  const response = await fetch(`${PROVIDER.base_url}/api/tags`);
  const body = await response.json();
  const model = (body.models ?? []).find((entry) => entry.name === PROVIDER.model);
  if (model === undefined) throw new Error(`model ${PROVIDER.model} unavailable`);
  if (model.digest !== PROVIDER.required_digest) throw new Error(`digest mismatch: ${model.digest}`);
  return { name: model.name, digest: model.digest, quantization: model.details?.quantization_level, size: model.size };
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
  const problems = [];
  if (memorySection(capture.userContent) === '') problems.push('empty Memory section');
  const conditions = {};
  for (const id of ['P', 'N', 'Z', 'A']) {
    const variant = variants[id];
    const audit = auditAffectVariant(capture.userContent, variant.transformed, variant.removedIndices ?? []);
    const absent =
      id === 'A'
        ? verifyAbsentIsBaseMinusAffect(capture.userContent, variant.transformed, variant.removedIndices)
        : { ok: true, reasons: [] };
    const labels = assertNoExperimentalLabels(variant.transformed);
    const invariantOk = subjectDataInvariantDigest(variant.transformed) === invariant;
    const ok = audit.ok && absent.ok && labels.ok && invariantOk;
    if (!ok) problems.push(`${id}: ${[...audit.reasons, ...absent.reasons, ...labels.found].join('; ')}`);
    conditions[id] = {
      kind: CONDITIONS[id].kind,
      valence: CONDITIONS[id].valence,
      activation: CONDITIONS[id].activation,
      user_sha256: sha256(variant.transformed),
      memory_section_sha256: sha256(memorySection(variant.transformed)),
      invariant_digest: subjectDataInvariantDigest(variant.transformed),
      affect_section: id === 'A' ? [] : [variant.replacement],
      differing_indices: audit.differing_indices,
      removed_indices: variant.removedIndices ?? [],
      isolation_ok: ok
    };
  }
  return { scenario: scenario.id, ok: problems.length === 0, problems, conditions };
}

async function main() {
  const provider = await verifyProvider();
  const snapshot = await growSnapshot(HISTORY_EVENTS);
  writeFileSync(join(evidenceDir, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`);

  const baseRequests = {};
  const attestations = {};
  const problems = [];
  for (const scenario of PRIMARY_SCENARIOS) {
    const capture = await captureBaseRequest(snapshot, scenario, `sess-authority-capture-${scenario.id}`);
    const attestation = attestScenario(scenario, capture);
    if (!attestation.ok) problems.push(...attestation.problems.map((p) => `${scenario.id}: ${p}`));
    baseRequests[scenario.id] = { ...capture, attestation };
    attestations[scenario.id] = attestation;
  }

  writeFileSync(join(evidenceDir, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`);
  writeFileSync(
    join(evidenceDir, 'request-attestation.json'),
    `${JSON.stringify(
      {
        schema_version: 'affect-authority-request-attestation-v0',
        invariant: 'system prompt, identity, context, observation, Memory, citeable refs, action space and provider settings identical; only the Affect section differs',
        scenarios: attestations
      },
      null,
      2
    )}\n`
  );

  const freeze = {
    schema_version: 'affect-authority-revalidation-freeze-v0',
    created_before_live_calls: true,
    protocol: 'conversation-cognition-proposal-v2 + language-realization-input-v3',
    subject_id: SUBJECT_ID,
    provider,
    declared_provider: PROVIDER,
    history_events: HISTORY_EVENTS,
    conditions: CONDITIONS,
    activation_conditions: ACTIVATION_CONDITIONS,
    scenarios: PRIMARY_SCENARIOS.map((s) => ({ id: s.id, role: s.role, event: s.event, expected: s.expected ?? null })),
    replicates: REPLICATES,
    schedule: primarySchedule(REPLICATES),
    endpoint: 'final production-admissible observable behavior',
    stages: ['RAW_PROVIDER_RESPONSE', 'SCHEMA_VALID', 'EXECUTOR_ADMISSIBLE', 'LANGUAGE_ADMISSIBLE', 'FINAL_BEHAVIOR'],
    classifiers: 'frozen null oracles + frozen affect-relevant behavior keyword rules (lib/classify.mjs)',
    materiality: MATERIALITY,
    success: SUCCESS,
    retry_policy: RETRY_POLICY,
    call_budget: CALL_BUDGET,
    base_request_hashes: Object.fromEntries(
      Object.entries(baseRequests).map(([id, value]) => [id, sha256(value.userContent)])
    )
  };
  const freezeHash = hashJson(freeze);
  writeFileSync(join(evidenceDir, 'freeze.json'), `${JSON.stringify({ ...freeze, freeze_hash: freezeHash }, null, 2)}\n`);

  console.log(JSON.stringify({ provider, freeze_hash: freezeHash, problems }, null, 2));
  if (problems.length > 0) {
    console.error('PREPARE FAILED: isolation attestation problems');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
