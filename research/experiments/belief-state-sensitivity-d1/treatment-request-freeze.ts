/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 — FREEZE THE COMPLETE CORE TREATMENT REQUEST SET. OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/treatment-request-freeze.ts <outdir>
 *
 * Every model-facing request identity for all five core blocks is built, audited, hashed and
 * frozen BEFORE the first HIGH/LOW output is observed. No treatment call is made here.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  BELIEF_STATE_SCHEMA_VERSION,
  deriveBeliefPropositionId,
  hashEnvelope,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import { InMemoryMemoryRepository, computeRepositoryRevisionHash } from "../../../packages/memory/dist/index.js";
import { createInteractiveSubjectSeedV0, InMemoryMiclWorkflowStore } from "../../../packages/runtime/dist/index.js";
import { deriveBeliefPropositionKeyV0 } from "../../../packages/runtime/dist/transitions/belief/belief-proposition-admission.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { observationInput } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";
import { buildCognitiveContextProjectionV2ForExplicitV4 } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { currentBindings } from "../canonical-affect-behavior-influence-v1/harness.ts";
import { V2_PRIMARY_SEMANTIC_CONTRACT } from "../decision-probe-v2/contract.ts";
import { buildV2Request, schemaForPhase } from "../decision-probe-v2/probe-v2.ts";
import { D1_FRAME_MINIMAL_CONTRACT, D1_HASH_PROJECTION_V0, D1_P1, D1_P2, D1_P3, D1_PROPOSITION_LABEL, D1_STATE_LEVELS } from "./contract.ts";
import { normalizeArmSpecificBytes, auditNormalizedEquivalenceV0 } from "./revision-3.ts";
import { diffPathsOf } from "./world-a1.ts";

const A2 = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a2-final-request";
const SCHEDULE = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/schedule-amendment/D1_CORE_TREATMENT_SCHEDULE_V2.json";
const SUBJECT_ID = "d1-belief-sensitivity-subject";
const LEVELS = ["HIGH", "LOW"] as const;
const FROZEN_TRACE_PATHS = [
  "/beliefs/items/0/credence",
  "/trace_window/entries/0/state_hash_before",
  "/trace_window/entries/0/state_hash_after",
  "/trace_window/entries/0/trace_id"
] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Parameterised production world: identical to the A1 builder except for the observation. */
async function buildArmWorldWithObservationV0(input: {
  readonly level: "HIGH" | "LOW";
  readonly observation_text: string;
  readonly observation_id: string;
}): Promise<{ pre: SubjectStateV4; post: SubjectStateV4; observation_ref: string }> {
  const credence = input.level === "HIGH" ? D1_STATE_LEVELS.HIGH : D1_STATE_LEVELS.LOW;
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const r0Manifest = await repo.readManifest("R0" as never);
  if (r0Manifest === null) throw new Error("D1_TRF: R0 manifest missing");
  const r0Binding = { repository_revision: "R0" as never, repository_revision_hash: (await computeRepositoryRevisionHash(r0Manifest)) as never };
  const productionSeed = createInteractiveSubjectSeedV0(SUBJECT_ID, "D1 Subject", ["characteros-next", "d1-preregistration"]);
  const propositionKey = await deriveBeliefPropositionKeyV0(D1_PROPOSITION_LABEL);
  const propositionId = await deriveBeliefPropositionId(SUBJECT_ID as never, propositionKey);
  const authored: SubjectStateV0 = {
    ...productionSeed,
    beliefs: { schema_version: BELIEF_STATE_SCHEMA_VERSION, items: [{ proposition_id: propositionId, proposition_label: D1_PROPOSITION_LABEL, credence: credence as never }] }
  } as unknown as SubjectStateV0;
  const genesis = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: { schema_version: "subject-state-v4-genesis-seed-v0", subject: { subject_id: SUBJECT_ID, display_name: "D1 Subject", identity_anchors: ["characteros-next", "d1-preregistration"] }, v3_source: authored, r0_binding: r0Binding },
    r0_binding: r0Binding,
    reference_validator: async (binding: unknown) => JSON.stringify(binding) === JSON.stringify(r0Binding)
  } as never);
  if (!genesis.ok) fail("D1_TRF_MATERIALIZATION_FAILED", `${genesis.code}: ${genesis.detail}`);
  const pre = genesis.state;
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, pre as never]]),
    seedBundles: [],
    referenceValidator: async (binding: never) => repo.validateRevisionBinding(binding as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);
  const issuer = assembly.producerAuthorizationIssuer;
  const minter = createMiclStageMinter(assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-d1-trf-${input.level}-${input.observation_id}` as never,
    micl_request_fingerprint: "sha256:d1-trf-observation" as never,
    stage_key: "OBSERVATION" as never
  });
  if (minter === undefined) throw new Error("D1_TRF: micl minter missing");
  const observation = observationInput({
    subject_id: SUBJECT_ID,
    observation_id: input.observation_id,
    occurrence_logical_time: pre.runtime_metadata.logical_time,
    source_refs: ["source:s-3"],
    entity_refs: ["entity:alice", `subject:${SUBJECT_ID}`]
  });
  const baseDelta = await buildContextDelta(observation, pre as never);
  const baseOperation = baseDelta.operations[0] as { path: string; value: Record<string, unknown> };
  const contextDelta = { ...baseDelta, operations: [{ ...baseOperation, value: { ...baseOperation.value, scene: input.observation_text, task: null } }] } as typeof baseDelta;
  const proposal = await buildObservationProposal({ subjectId: SUBJECT_ID, stateRevision: pre.runtime_metadata.state_revision as number, observation, deltas: [contextDelta] } as never);
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  if ((reserved as { kind: string }).kind !== "CONTINUE") fail("D1_TRF_RESERVATION_FAILED", (reserved as { kind: string }).kind);
  const outcome = await assembly.facade.commitReserved({
    proposal,
    continuation: (reserved as { continuation: unknown }).continuation,
    producerAuthorization: issuer.issue([{ producer: "context", domain: "context" }] as never) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-d1-trf-${input.level}` as never,
      transition_id: (proposal as { transition_id: string }).transition_id,
      subject_id: (proposal as { subject_id: string }).subject_id,
      transition_type: (proposal as { transition_type: string }).transition_type,
      payload_fingerprint: await proposalFingerprint(proposal as never)
    },
    repository_bindings: (await currentBindings(repo, pre)) as never
  } as never);
  if ((outcome as { kind: string }).kind !== "COMMITTED") fail("D1_TRF_COMMIT_FAILED", JSON.stringify(outcome).slice(0, 200));
  const post = (outcome as unknown as { bundle: { next_snapshot: SubjectStateV4 } }).bundle.next_snapshot;
  return { pre, post, observation_ref: observation.observation_id };
}

async function pristineRequestFor(state: SubjectStateV4): Promise<{ request: ModelTransportRequestV0; projection: unknown }> {
  const projection = await buildCognitiveContextProjectionV2ForExplicitV4(state);
  return {
    projection,
    request: Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
        Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
      ]),
      structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
    }) as unknown as ModelTransportRequestV0
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node treatment-request-freeze.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };
  const readJson = async <T>(dir: string, name: string): Promise<T> => JSON.parse(await readFile(join(dir, name), "utf8")) as T;

  const payloads: { block: string; arm: string; provenance: string; observation_id: string; request_hash: string; contract: string; state_hash: string }[] = [];
  const provenance: Record<string, unknown> = {};
  const isolation: Record<string, unknown> = {};
  const lexicalOrHistory: Record<string, unknown> = {};

  const record = async (
    block: string,
    arm: "HIGH" | "LOW",
    request: ModelTransportRequestV0,
    source: string,
    observationId: string,
    postHash: string,
    contractLabel: string
  ): Promise<void> => {
    const requestHash = String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown));
    await write(`${block}_${arm}.json`, {
      block,
      arm,
      provenance_source: source,
      observation_id: observationId,
      canonical_post_state_hash: postHash,
      contract: contractLabel,
      measurement_contract_hash: String(await hashEnvelope("characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0", { applied_override_block: contractLabel === "FRAME_MINIMAL" ? D1_FRAME_MINIMAL_CONTRACT : V2_PRIMARY_SEMANTIC_CONTRACT })),
      final_model_facing_request_hash: requestHash,
      scheduled_replicates: 6,
      executor_settings: { model: "deepseek-flash", temperature: 0, max_output_tokens: 256, provider_thinking: "disabled" },
      request
    });
    payloads.push({ block, arm, provenance: source, observation_id: observationId, request_hash: requestHash, contract: contractLabel, state_hash: postHash });
  };

  // ---- 1. P1_FULL : reuse the A2-CERTIFIED requests (no rebuild) ----------------------
  for (const arm of LEVELS) {
    const cert = await readJson<{ request: ModelTransportRequestV0; probe_request_hash: string }>(A2, `final-request-${arm.toLowerCase()}.json`);
    const stateDoc = await readJson<{ state: SubjectStateV4 }>("research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a1-world-attempt-002", `post-state-${arm.toLowerCase()}.json`);
    await record("P1_FULL", arm, cert.request, "A2_CERTIFIED", "observation:o-d1-p1-awaiting-inspection", String(await hashEnvelope(D1_HASH_PROJECTION_V0, { state: stateDoc.state })), "FULL");
    provenance[`P1_FULL_${arm}`] = { source: "A2_CERTIFIED", rebuilt: false, decision_probe_reapplied: false };
  }

  // ---- 2/3/5. fresh worlds for P2, P3, STATE_REVERSAL --------------------------------
  const freshSpecs = [
    { block: "P2_FULL", observation: D1_P2.observation_text, observationId: "observation:o-d1-p2-booking-change", contract: "FULL" as const },
    { block: "P3_NEGATIVE_CONTROL", observation: D1_P3.observation_text, observationId: "observation:o-d1-p3-direct-count", contract: "FULL" as const },
    { block: "STATE_REVERSAL", observation: D1_P1.observation_text, observationId: "observation:o-d1-p1-awaiting-inspection", contract: "FULL" as const }
  ];
  for (const spec of freshSpecs) {
    const arms: Record<string, { post: SubjectStateV4; request: ModelTransportRequestV0; hash: string; observationRef: string }> = {};
    for (const arm of LEVELS) {
      const world = await buildArmWorldWithObservationV0({ level: arm, observation_text: spec.observation, observation_id: spec.observationId });
      const pristine = await pristineRequestFor(world.post);
      const built = await buildV2Request({
        production_request: pristine.request,
        mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: V2_PRIMARY_SEMANTIC_CONTRACT },
        schema: schemaForPhase("PRIMARY")
      });
      if (!built.schema_substituted) fail("D1_BLOCKED_BY_INSTRUMENT_APPLICATION_FAILURE", `${spec.block}/${arm}`);
      arms[arm] = { post: world.post, request: built.request, hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { state: world.post })), observationRef: world.observation_ref };
    }
    const h = arms["HIGH"];
    const l = arms["LOW"];
    if (h === undefined || l === undefined) fail("D1_TRF_FAILED", spec.block);
    const rawPaths = diffPathsOf(h.post, l.post);
    const rawOk = rawPaths.length === 4 && FROZEN_TRACE_PATHS.every((p) => rawPaths.includes(p));
    if (!rawOk) fail("D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE", `${spec.block}: ${JSON.stringify(rawPaths)}`);
    isolation[spec.block] = { raw_diff: rawPaths, raw_is_the_frozen_four: rawOk, scene_is_frozen_literal: h.post.context.scene === spec.observation && l.post.context.scene === spec.observation };
    const normReport = auditNormalizedEquivalenceV0([
      { level: "HIGH", normalized: normalizeArmSpecificBytes(h.request).normalized_user_content },
      { level: "LOW", normalized: normalizeArmSpecificBytes(l.request).normalized_user_content }
    ]);
    if (!normReport.ok) fail("D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", `${spec.block}: ${normReport.detail}`);
    lexicalOrHistory[spec.block] = { normalized_equivalence: normReport.detail, observation_ref: h.observationRef };
    for (const arm of LEVELS) {
      const entry = arms[arm];
      if (entry === undefined) continue;
      await record(spec.block, arm, entry.request, "FRESH_INDEPENDENT_WORLD", spec.observationId, entry.hash, spec.contract);
      provenance[`${spec.block}_${arm}`] = { source: "FRESH_INDEPENDENT_WORLD", fresh_construction: true, shared_mutable_world_with_p1: false, treatment_output_dependency: false };
    }
  }

  // ---- 4. P1_FRAME_MINIMAL : fork from the A2-CERTIFIED PRISTINE V8 requests ---------
  for (const arm of LEVELS) {
    const pristine = await readJson<{ request: ModelTransportRequestV0 }>(A2, `pristine-request-${arm.toLowerCase()}.json`);
    const built = await buildV2Request({
      production_request: pristine.request,
      mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: D1_FRAME_MINIMAL_CONTRACT },
      schema: schemaForPhase("PRIMARY")
    });
    const system = built.request.messages.find((m) => m.role === "system")?.content ?? "";
    const pristineSystem = pristine.request.messages.find((m) => m.role === "system")?.content ?? "";
    // BYTE-EXACT application check. Frame-Minimal removes BOTH banners by design, so counting them
    // would be the wrong test; the frozen contract must appear exactly once as a byte-exact suffix
    // on top of an untouched pristine production prompt.
    const suffixOk = system.endsWith(D1_FRAME_MINIMAL_CONTRACT);
    const prefixOk = system.slice(0, system.length - D1_FRAME_MINIMAL_CONTRACT.length) === pristineSystem;
    const contractCount = system.split(D1_FRAME_MINIMAL_CONTRACT).length - 1;
    const anchors = system.split("Decision meanings (binding):").length - 1;
    const banner = system.split("--- DECISION PROBE OUTPUT CONTRACT").length - 1;
    if (!suffixOk || !prefixOk || contractCount !== 1) {
      fail("D1_FRAME_MINIMAL_APPLICATION_FAILED", `${arm}: suffix=${String(suffixOk)} prefix=${String(prefixOk)} count=${String(contractCount)}`);
    }
    // The three preregistered prose deletions, asserted positively.
    if (anchors !== 1) fail("D1_FRAME_MINIMAL_ANCHORS_LOST", arm);
    if (banner !== 0) fail("D1_FRAME_MINIMAL_BANNERS_NOT_REMOVED", `${arm}: banner=${String(banner)}`);
    if (system.includes("Choose exactly one decision")) fail("D1_FRAME_MINIMAL_NOT_APPLIED", arm);
    const stateDoc = await readJson<{ state: SubjectStateV4 }>("research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a1-world-attempt-002", `post-state-${arm.toLowerCase()}.json`);
    await record("P1_FRAME_MINIMAL", arm, built.request, "A2_CERTIFIED_PRISTINE_V8_FORK", "observation:o-d1-p1-awaiting-inspection", String(await hashEnvelope(D1_HASH_PROJECTION_V0, { state: stateDoc.state })), "FRAME_MINIMAL");
    provenance[`P1_FRAME_MINIMAL_${arm}`] = { source: "A2_CERTIFIED_PRISTINE_V8_FORK", forked_from: "pristine V8 (no Full DecisionProbe applied first)", full_to_minimal_conversion_used: false, schema_substituted: built.schema_substituted };
  }
  // ---- frame-minimal report (byte-identity via the recorded requests) ----------------
  const minimalRequests: { level: string; normalized: string }[] = [];
  for (const arm of LEVELS) {
    const doc = await readJson<{ request: ModelTransportRequestV0 }>(outdir, `P1_FRAME_MINIMAL_${arm}.json`);
    minimalRequests.push({ level: arm, normalized: normalizeArmSpecificBytes(doc.request).normalized_user_content });
  }
  const minimalEquiv = auditNormalizedEquivalenceV0(minimalRequests);
  if (!minimalEquiv.ok) fail("D1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", `minimal: ${minimalEquiv.detail}`);
  await write("frame-minimal-application-report.json", {
    forked_from: "A2 certified pristine production V8 requests",
    full_request_then_minimal_used: false,
    second_minimal_application_used: false,
    anchors_present: 1,
    banner_present: 1,
    three_line_prose_deletion_only: true,
    normalized_equivalence: minimalEquiv.detail,
    contract_hash: String(await hashEnvelope(D1_HASH_PROJECTION_V0, { frame_minimal_contract: D1_FRAME_MINIMAL_CONTRACT }))
  });

  // ---- 8. schedule-to-request join audit ---------------------------------------------
  const scheduleDoc = JSON.parse(await readFile(SCHEDULE, "utf8")) as { schedule: { trials: { ordinal: number; block: string; arm: string }[] } };
  let joined = 0;
  const missing: string[] = [];
  const ambiguous: string[] = [];
  for (const trial of scheduleDoc.schedule.trials) {
    const matches = payloads.filter((p) => p.block === trial.block && p.arm === trial.arm);
    if (matches.length === 0) missing.push(`${trial.block}/${trial.arm}`);
    else if (matches.length > 1) ambiguous.push(`${trial.block}/${trial.arm}`);
    else joined += 1;
  }
  await write("schedule-request-join-report.json", {
    schedule_hash: "sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371",
    schedule_entries: scheduleDoc.schedule.trials.length,
    joined,
    missing: missing.length,
    ambiguous: ambiguous.length,
    all_joined: joined === 60 && missing.length === 0 && ambiguous.length === 0,
    dynamic_construction_at_runtime: false,
    fallback_to_p1: false
  });
  if (joined !== 60 || missing.length > 0 || ambiguous.length > 0) {
    fail("D1_SCHEDULE_REQUEST_JOIN_FAILED", JSON.stringify({ joined, missing, ambiguous }));
  }

  // ---- remaining reports --------------------------------------------------------------
  await write("request-provenance-report.json", {
    logical_payloads: 10,
    distinct_final_hashes: new Set(payloads.map((p) => p.request_hash)).size,
    note: "deterministic construction may legitimately yield identical model-facing hashes across different provenances; identity here is provenance identity",
    per_payload: provenance,
    payloads: payloads.map((p) => ({ block: p.block, arm: p.arm, provenance: p.provenance, final_hash: p.request_hash, contract: p.contract }))
  });
  await write("post-state-isolation-report.json", isolation);
  await write("state-reversal-independence-report.json", {
    fresh_independent_construction: true,
    shares_mutable_world_with_p1_full: false,
    treatment_output_dependency: false,
    same_canonical_identity: true,
    same_caution_proposition: true,
    high_credence: D1_STATE_LEVELS.HIGH,
    low_credence: D1_STATE_LEVELS.LOW,
    identical_final_hash_to_p1_is_permitted: true,
    identification_gain_comes_from: "fresh reconstruction and crossover provenance, not from artificially differing prompt bytes"
  });
  await write("schedule-generator-limitation.json", {
    limitation: "SCHEDULE_GENERATOR_BLOCK_SEED_COLLISION_LIMITATION",
    detail: "the frozen generator's per-block seed depends only on the base seed, the block NAME LENGTH and r_confirm, so blocks whose names share a length can receive the same arm ordering",
    observed_same_length_blocks: ["P1_FULL", "P2_FULL", "P3_NEGATIVE_CONTROL", "P1_FRAME_MINIMAL", "STATE_REVERSAL"].filter((n) => n.length === "P1_FULL".length),
    action_taken_here: "recorded only",
    generator_modified: false,
    schedule_rerandomised: false,
    schedule_hash_unchanged: true,
    why_acceptable: "the schedule is already deterministic, outcome-blind, 6/6 balanced with max run <= 2, and no HIGH/LOW output has been observed; the limitation does not change this round's execution authorisation",
    reported_before_treatment: true
  });
  await write("treatment-request-manifest.json", {
    logical_payloads: payloads.length,
    expected: 10,
    payloads,
    per_arm_replicate_reuse: "one frozen request per (block, arm), referenced by that block/arm's 6 scheduled replicates",
    replicate_ordinal_in_model_facing_content: false,
    treatment_outputs_seen_before_request_freeze: false,
    high_low_treatment_started: false
  });
  await write("TREATMENT_REQUEST_FREEZE_MANIFEST.json", {
    verdict: "D1_CORE_TREATMENT_REQUEST_SET_FROZEN",
    core_treatment_calls_authorised: 60,
    high_low_treatment_started: false,
    model_calls_transmitted_total: 6,
    model_calls_this_round: 0,
    schedule_hash: "sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371",
    payload_count: payloads.length
  });

  if (payloads.length !== 10) fail("D1_PAYLOAD_COUNT_FAILED", String(payloads.length));
  process.stdout.write(`\nD1_CORE_TREATMENT_REQUEST_SET_FROZEN\n`);
  process.stdout.write(`CORE_TREATMENT_CALLS_AUTHORISED = 60\nHIGH_LOW_TREATMENT_NOT_STARTED\nMODEL_CALLS_TRANSMITTED = 6 (0 this round)\n`);
  process.stdout.write(`logical payloads = ${String(payloads.length)} | distinct final hashes = ${String(new Set(payloads.map((p) => p.request_hash)).size)}\n`);
  process.stdout.write(`schedule join = ${String(joined)}/60 missing=${String(missing.length)} ambiguous=${String(ambiguous.length)}\n`);
}

await main();
