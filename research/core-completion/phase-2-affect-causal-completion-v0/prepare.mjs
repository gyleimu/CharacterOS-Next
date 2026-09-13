/* globals fetch, URL */
/**
 * AFFECT_CAUSAL_COMPLETION_V0 — deterministic preparation (ZERO real model calls).
 *
 * 1. Verifies the frozen provider identity against the live daemon.
 * 2. Grows ONE lawful lived history (deterministic stub) → evidence/snapshot.json.
 * 3. Captures the exact production-rendered cognition request per scenario
 *    (deterministic stub; the capture is not evidence).
 * 4. Builds the P/N/Z/A research-only counterfactual requests and ATTESTS that
 *    they differ from the base request only inside the Affect section.
 * 5. Writes freeze.json (hashed) and scenarios.json before any live call.
 *
 * Usage: node prepare.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVATION_CONDITIONS,
  CALL_BUDGET,
  CONDITIONS,
  HISTORY_EVENTS,
  MATERIALITY,
  PROVIDER,
  REPLICATES,
  RETRY_POLICY,
  SCENARIOS,
  STAGE1_SCENARIOS,
  STAGE2_SCENARIOS,
  STOP_RULES,
  SUBJECT_ID,
  VERDICT_RULE,
  primarySchedule
} from './lib/config.mjs';
import { hashJson, memorySection, sha256, subjectDataInvariantDigest } from './lib/hash.mjs';
import {
  affectValueLine,
  assertNoExperimentalLabels,
  auditAffectVariant,
  removeAffectSection,
  swapAffectValue,
  verifyAbsentIsBaseMinusAffect
} from './lib/ablation.mjs';
import { captureScenarioRequest, growSnapshot } from './lib/world.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const evidenceDir = join(root, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

async function verifyProvider() {
  const response = await fetch(`${PROVIDER.base_url}/api/tags`);
  if (!response.ok) throw new Error(`provider /api/tags returned ${response.status}`);
  const body = await response.json();
  const model = (body.models ?? []).find((entry) => entry.name === PROVIDER.model || entry.model === PROVIDER.model);
  if (model === undefined) throw new Error(`model ${PROVIDER.model} is not available`);
  if (model.digest !== PROVIDER.required_digest) {
    throw new Error(`model digest mismatch: expected ${PROVIDER.required_digest}, got ${model.digest}`);
  }
  return { name: model.name, digest: model.digest, quantization: model.details?.quantization_level, size: model.size };
}

function buildVariants(baseUserContent) {
  const variants = {};
  for (const id of ['P', 'N', 'Z']) {
    const condition = CONDITIONS[id];
    variants[id] = swapAffectValue(baseUserContent, affectValueLine(condition.valence, condition.activation));
  }
  variants.A = removeAffectSection(baseUserContent);
  return variants;
}

function attestScenario(scenario, capture) {
  const variants = buildVariants(capture.userContent);
  const invariantDigest = subjectDataInvariantDigest(capture.userContent);
  const attestation = { scenario: scenario.id, base_sha256: sha256(capture.userContent), conditions: {} };
  const problems = [];
  if (memorySection(capture.userContent) === '') problems.push('empty Memory section');
  for (const id of ['P', 'N', 'Z', 'A']) {
    const variant = variants[id];
    const text = variant.transformed;
    const audit = auditAffectVariant(capture.userContent, text, variant.removedIndices ?? []);
    const absent = id === 'A' ? verifyAbsentIsBaseMinusAffect(capture.userContent, text, variant.removedIndices) : { ok: true, reasons: [] };
    const labelsUser = assertNoExperimentalLabels(text);
    const labelsSystem = assertNoExperimentalLabels(capture.systemContent);
    const affected = id === 'A' ? variant.removedLines : [variant.replacement];
    if (!audit.ok) problems.push(`${id}: ${audit.reasons.join('; ')}`);
    if (!absent.ok) problems.push(`${id} absent: ${absent.reasons.join('; ')}`);
    if (!labelsUser.ok) problems.push(`${id}: experimental labels in user content ${labelsUser.found.join(',')}`);
    if (!labelsSystem.ok) problems.push(`${id}: experimental labels in system prompt ${labelsSystem.found.join(',')}`);
    if (subjectDataInvariantDigest(text) !== invariantDigest) problems.push(`${id}: invariant subject-data digest changed`);
    attestation.conditions[id] = {
      kind: CONDITIONS[id].kind,
      valence: CONDITIONS[id].valence,
      activation: CONDITIONS[id].activation,
      user_sha256: sha256(text),
      request_hash: hashJson({ system: capture.systemContent, user: text }),
      memory_section_sha256: sha256(memorySection(text)),
      memory_section_present: memorySection(text) !== '',
      affect_section: affected,
      invariant_digest: subjectDataInvariantDigest(text),
      isolation_ok: audit.ok && absent.ok && labelsUser.ok,
      differing_indices: audit.differing_indices,
      removed_indices: variant.removedIndices ?? []
    };
  }
  attestation.ok = problems.length === 0;
  attestation.problems = problems;
  return { variants, attestation };
}

async function main() {
  const provider = await verifyProvider();
  const snapshot = await growSnapshot(HISTORY_EVENTS);
  writeFileSync(join(evidenceDir, 'snapshot.json'), `${JSON.stringify(snapshot)}\n`);

  const baseRequests = {};
  const scenarios = [];
  const allProblems = [];
  for (const scenario of SCENARIOS) {
    const capture = await captureScenarioRequest(snapshot, scenario, `sess-affect-capture-${scenario.id}`);
    const { variants, attestation } = attestScenario(scenario, capture);
    if (!attestation.ok) allProblems.push(...attestation.problems.map((p) => `${scenario.id}: ${p}`));
    baseRequests[scenario.id] = {
      systemContent: capture.systemContent,
      userContent: capture.userContent,
      projectionHash: capture.projectionHash,
      affect_before_turn: capture.affect_before_turn,
      provider_memory_section_present: capture.provider_memory_section_present,
      retrieved_ref_count: capture.retrieved_ref_count,
      variants: Object.fromEntries(
        Object.entries(variants).map(([id, value]) => [id, { userContent: value.transformed }])
      ),
      attestation
    };
    scenarios.push({
      id: scenario.id,
      stage: scenario.stage,
      role: scenario.role,
      event: scenario.event,
      classes: scenario.classes,
      base_user_sha256: sha256(capture.userContent),
      memory_section_present: memorySection(capture.userContent) !== '',
      projection_hash: capture.projectionHash
    });
  }

  writeFileSync(join(evidenceDir, 'base-requests.json'), `${JSON.stringify(baseRequests, null, 2)}\n`);
  writeFileSync(
    join(evidenceDir, 'scenarios.json'),
    `${JSON.stringify({ schema_version: 'affect-causal-scenarios-v0', scenarios }, null, 2)}\n`
  );
  writeFileSync(
    join(evidenceDir, 'request-attestation.json'),
    `${JSON.stringify(
      {
        schema_version: 'affect-causal-request-attestation-v0',
        invariant: 'all conditions share system prompt, identity, context, observation, Memory, citeable refs and action space byte-for-byte',
        scenarios: Object.fromEntries(
          Object.entries(baseRequests).map(([id, value]) => [id, value.attestation])
        )
      },
      null,
      2
    )}\n`
  );

  const freeze = {
    schema_version: 'affect-causal-freeze-v0',
    created_before_live_calls: true,
    provider,
    declared_provider: PROVIDER,
    subject_id: SUBJECT_ID,
    history_events: HISTORY_EVENTS,
    conditions: CONDITIONS,
    activation_conditions: ACTIVATION_CONDITIONS,
    scenarios,
    replicates: REPLICATES,
    primary_schedule: primarySchedule(REPLICATES),
    request_construction:
      'P/N/Z: replace exactly the single rendered canonical affect value line, legend unchanged. A: remove the whole affect section (value + legend). Canonical state never modified.',
    classification: 'directive + frozen scenario-specific intent-keyword taxonomy (lib/classify.mjs)',
    materiality: MATERIALITY,
    stop_rules: STOP_RULES,
    call_budget: CALL_BUDGET,
    retry_policy: RETRY_POLICY,
    verdict_rule: VERDICT_RULE,
    stage1_scenarios: STAGE1_SCENARIOS.map((s) => s.id),
    stage2_scenarios: STAGE2_SCENARIOS.map((s) => s.id),
    base_request_hashes: Object.fromEntries(
      Object.entries(baseRequests).map(([id, value]) => [id, sha256(value.userContent)])
    )
  };
  const freezeHash = hashJson(freeze);
  writeFileSync(join(evidenceDir, 'freeze.json'), `${JSON.stringify({ ...freeze, freeze_hash: freezeHash }, null, 2)}\n`);

  console.log(JSON.stringify({ provider, freeze_hash: freezeHash, problems: allProblems }, null, 2));
  if (allProblems.length > 0) {
    console.error('PREPARE FAILED: isolation attestation problems');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
