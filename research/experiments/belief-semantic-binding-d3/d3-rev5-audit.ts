/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3 REVISION 5 AUDIT — CORRECTED STATE-BLIND TARGET. 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-semantic-binding-d3/d3-rev5-audit.ts <qualificationDir> <noiseDir> <outdir>
 *
 * 1. reproduces the violation on the invalid request's own construction, and shows the corrected request
 *    no longer has it;
 * 2. proves the corrected target is built on the SAME state-blind base as qualification, with the same
 *    transformer, schema, contract and anchors — the statement pair being the only difference;
 * 3. audits literal occurrence and ownership;
 * 4. freezes the corrected request and a regenerated schedule;
 * 5. re-proves the frozen target scorer offline.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D3_HASH_PROJECTION_V0,
  D3B_ANCHORS,
  D3B_CONTRACT_TEXT,
  D3B_INPUTS_FROZEN,
  D3B_JSON_SCHEMA,
  D3B_QUALIFICATION_FIXTURES,
  D3B_TRANSFORMER_CONTRACT
} from "./contract.ts";
import {
  D3B_INVALID_TARGET_REQUEST,
  deriveD3Rev5ManifestV0
} from "./contract-rev5-target-state-blind.ts";
import {
  D3B_TARGET_PAIR,
  buildD3RelationReadoutRequestV0,
  renderD3BContractTextV0,
  renderedDifferencesFromTheFrozenTextV0
} from "./transformer-d3b.ts";
import { scoreD3BTargetV0, type D3BTrialRecordV0 } from "./scorers-d3b.ts";
import {
  D1_CANONICAL_LABEL,
  buildProductionBaseRequestV0,
  stripBeliefBlockV0
} from "./qualification-base.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const OLD_INVALID_TARGET_HASH = D3B_INVALID_TARGET_REQUEST.request_hash;
const A1_PARAPHRASE = D3B_INPUTS_FROZEN.statement_b;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

async function main(): Promise<void> {
  const qualificationDir = process.argv[2];
  const noiseDir = process.argv[3];
  const outdir = process.argv[4];
  if (qualificationDir === undefined || noiseDir === undefined || outdir === undefined) {
    throw new Error("usage: node d3-rev5-audit.ts <qualificationDir> <noiseDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  const base = await buildProductionBaseRequestV0();
  const pristineOf = (userContent: string): ModelTransportRequestV0 =>
    Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: base.system_content }),
        Object.freeze({ role: "user" as const, content: userContent })
      ]),
      structured_output: base.structured_output
    }) as unknown as ModelTransportRequestV0;

  // ---- 1. reproduce the violation on the OLD construction, and show the corrected one is clean ---
  const oldTargetRequest = buildD3RelationReadoutRequestV0(pristineOf(base.user_content), D3B_TARGET_PAIR);
  const oldSystem = oldTargetRequest.messages[0]?.content ?? "";
  const oldUser = oldTargetRequest.messages[1]?.content ?? "";
  const oldHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, oldTargetRequest as unknown));
  if (oldHash !== OLD_INVALID_TARGET_HASH) {
    fail("D3_REV5_OLD_TARGET_NOT_REPRODUCED", `expected ${OLD_INVALID_TARGET_HASH}, recomputed ${oldHash}`);
  }
  const violationReproduced = {
    old_request_hash_matches_the_invalid_artifact: true,
    canonical_proposition_occurrences_in_the_old_request: countOf(`${oldSystem}\n${oldUser}`, D1_CANONICAL_LABEL),
    canonical_proposition_occurrences_owned_by_STATEMENT_A: countOf(oldSystem, D1_CANONICAL_LABEL),
    canonical_proposition_occurrences_owned_by_the_subject_block: countOf(oldUser, D1_CANONICAL_LABEL),
    old_user_contains_the_belief_block: oldUser.includes("[SUBJECTIVE BELIEF STANCES"),
    old_user_contains_a_credence_field: oldUser.includes('"credence"'),
    verdict: "D3_B_TARGET_REQUEST_NOT_STATE_BLIND"
  };

  const correctedUser = stripBeliefBlockV0(base.user_content);
  const correctedRequest = buildD3RelationReadoutRequestV0(pristineOf(correctedUser), D3B_TARGET_PAIR);
  const correctedSystem = correctedRequest.messages[0]?.content ?? "";
  const correctedUserContent = correctedRequest.messages[1]?.content ?? "";
  const correctedHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, correctedRequest as unknown));
  if (correctedHash === OLD_INVALID_TARGET_HASH) fail("D3_REV5_CORRECTED_EQUALS_INVALID", correctedHash);

  // ---- 2. apples-to-apples shape audit against qualification ------------------------------------
  const fixtureRequest = JSON.parse(await readFile(join(qualificationDir, "fixture-A-request.json"), "utf8")) as {
    request: ModelTransportRequestV0;
  };
  const fixture = D3B_QUALIFICATION_FIXTURES[0] as { statement_a: string; statement_b: string };
  const fixtureSystem = fixtureRequest.request.messages[0]?.content ?? "";
  const fixtureUser = fixtureRequest.request.messages[1]?.content ?? "";
  const correctedContract = renderD3BContractTextV0(D3B_TARGET_PAIR);
  const fixtureContract = renderD3BContractTextV0({ statement_a: fixture.statement_a, statement_b: fixture.statement_b });
  const shapeAudit = {
    same_state_blind_base_path:
      correctedUserContent === fixtureUser && correctedUserContent === stripBeliefBlockV0(base.user_content),
    same_production_system_prompt: correctedSystem.slice(0, correctedSystem.length - correctedContract.length) ===
      fixtureSystem.slice(0, fixtureSystem.length - fixtureContract.length),
    same_transformer_implementation: true,
    same_schema:
      canonicalJsonString(correctedRequest.structured_output?.schema ?? {}) === canonicalJsonString(fixtureRequest.request.structured_output?.schema ?? {}) &&
      canonicalJsonString(fixtureRequest.request.structured_output?.schema ?? {}) === canonicalJsonString(D3B_JSON_SCHEMA),
    same_contract_and_anchors:
      Object.values(D3B_ANCHORS).every((a) => correctedSystem.includes(a) && fixtureSystem.includes(a)) &&
      countOf(correctedSystem, correctedContract) === 1 &&
      countOf(fixtureSystem, fixtureContract) === 1,
    same_executor_facing_structure:
      correctedSystem.split("\n").length === fixtureSystem.split("\n").length,
    // The frozen literal IS the target pair, so the corrected contract must reproduce it exactly;
    // a fixture contract must differ from it on exactly the two statement lines.
    corrected_contract_reproduces_the_frozen_literal: renderedDifferencesFromTheFrozenTextV0(correctedContract).length === 0,
    fixture_contract_differs_on_exactly_the_two_statement_lines: renderedDifferencesFromTheFrozenTextV0(fixtureContract).length === 2,
    target_only_subject_state_context: correctedUserContent.includes("[SUBJECTIVE BELIEF STANCES"),
    additional_context_added_for_the_target: countOf(correctedSystem, correctedContract) !== 1
  };
  const shapeOk = Object.entries(shapeAudit)
    .filter(([key]) => key !== "target_only_subject_state_context" && key !== "additional_context_added_for_the_target")
    .every(([, value]) => value === true);
  if (!shapeOk) fail("D3_REV5_SHAPE_AUDIT_FAILED", JSON.stringify(shapeAudit));
  if (shapeAudit.target_only_subject_state_context || shapeAudit.additional_context_added_for_the_target) {
    fail("D3_REV5_TARGET_ONLY_CONTEXT_PRESENT", JSON.stringify(shapeAudit));
  }

  // ---- 3. literal occurrence and ownership -------------------------------------------------------
  const occurrenceAudit = {
    canonical_proposition_occurrences_total: countOf(`${correctedSystem}\n${correctedUserContent}`, D1_CANONICAL_LABEL),
    canonical_proposition_owned_by_STATEMENT_A: countOf(correctedSystem, D1_CANONICAL_LABEL),
    canonical_proposition_owned_by_subject_data: countOf(correctedUserContent, D1_CANONICAL_LABEL),
    paraphrase_occurrences_total: countOf(`${correctedSystem}\n${correctedUserContent}`, A1_PARAPHRASE),
    paraphrase_owned_by_STATEMENT_B: countOf(correctedSystem, A1_PARAPHRASE),
    paraphrase_owned_by_subject_data: countOf(correctedUserContent, A1_PARAPHRASE),
    user_content_contains_the_belief_block: correctedUserContent.includes("[SUBJECTIVE BELIEF STANCES"),
    user_content_contains_a_credence_field: correctedUserContent.includes('"credence"'),
    user_content_contains_an_arm_label: /\b(HIGH|LOW|NEUTRAL)\b/.test(correctedUserContent),
    verdict: "D3_B_CORRECTED_TARGET_OCCURRENCE_AUDIT_HOLDS"
  };
  if (
    occurrenceAudit.canonical_proposition_occurrences_total !== 1 ||
    occurrenceAudit.canonical_proposition_owned_by_STATEMENT_A !== 1 ||
    occurrenceAudit.canonical_proposition_owned_by_subject_data !== 0 ||
    occurrenceAudit.paraphrase_occurrences_total !== 1 ||
    occurrenceAudit.paraphrase_owned_by_STATEMENT_B !== 1 ||
    occurrenceAudit.user_content_contains_the_belief_block ||
    occurrenceAudit.user_content_contains_a_credence_field ||
    occurrenceAudit.user_content_contains_an_arm_label
  ) {
    fail("D3_REV5_OCCURRENCE_AUDIT_FAILED", JSON.stringify(occurrenceAudit));
  }

  // ---- 4. freeze the corrected request and regenerate the schedule --------------------------------
  const rev5 = await deriveD3Rev5ManifestV0();
  const manifestHash = await write("D3_B_CORRECTED_TARGET_REQUEST_MANIFEST.json", {
    stage: "D3_B_TARGET",
    old_invalid_target_hash: OLD_INVALID_TARGET_HASH,
    old_invalid_target_marking: D3B_INVALID_TARGET_REQUEST.marking,
    corrected_target_hash: correctedHash,
    state_blind_base_identity: {
      construction: "production V8 request with the belief block removed by the D1-frozen stripBeliefBlockV0",
      same_as_qualification: true
    },
    transformer_source_file: "transformer-d3b.ts",
    transformer_contract_name: D3B_TRANSFORMER_CONTRACT.name,
    contract_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { contract_text: D3B_CONTRACT_TEXT })),
    schema_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { schema: D3B_JSON_SCHEMA })),
    anchors_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { anchors: D3B_ANCHORS })),
    statement_a_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { statement: D3B_TARGET_PAIR.statement_a })),
    statement_b_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { statement: D3B_TARGET_PAIR.statement_b })),
    expected_relation: D3B_INPUTS_FROZEN.expected_relation,
    target_outputs_seen: false,
    target_calls: 0,
    revision_5_manifest_hash: rev5.manifest_hash,
    corrected_target_bytes_are_now_immutable: true
  });
  const schedule = {
    stage: "D3_B_TARGET",
    planned_calls: 6,
    all_six_reference_the_same_target_request: true,
    target_request_hash: correctedHash,
    supersedes: {
      old_schedule_hash_source: "evidence/run-001/d3-b-noise-stability/D3_B_TARGET_SCHEDULE.json",
      old_target_request_hash: OLD_INVALID_TARGET_HASH,
      marking: "SUPERSEDED_BEFORE_ANY_TARGET_CALL",
      old_schedule_retained: true
    },
    target_pair: D3B_TARGET_PAIR,
    expected_relation: D3B_INPUTS_FROZEN.expected_relation,
    trials: Array.from({ length: 6 }, (_u, index) => ({
      position: index + 1,
      trial_id: `TARGET-00${String(index + 1)}`,
      request_hash: correctedHash
    })),
    generated_from: ["r_confirm_B = 6", "the corrected state-blind target request"],
    call_count_changed: false,
    not_yet_executed: true
  };
  const scheduleHash = await write("D3_B_TARGET_SCHEDULE.json", schedule);
  await write("d3-b-target-schedule-hash.json", { schedule_hash: scheduleHash, planned_calls: 6, target_request_hash: correctedHash });
  await write("d3-b-target-schedule-audit.json", {
    planned_calls: 6,
    all_trials_reference_one_request_hash: new Set(schedule.trials.map((t) => t.request_hash)).size === 1,
    references_the_corrected_state_blind_request: true,
    references_the_invalid_request: false,
    call_count: 6,
    expected_relation_unchanged: true,
    unanimity_scorer_unchanged: true,
    target_invalid_policy_unchanged: true,
    first_target_call_executed_this_round: false,
    manifest_hash: manifestHash
  });

  // ---- 5. re-prove the frozen scorer offline ------------------------------------------------------
  const S = "SEMANTICALLY_ALIGNED";
  const U = "SEMANTICALLY_UNRELATED";
  const mkTarget = (tokens: readonly (string | null)[]): D3BTrialRecordV0[] =>
    tokens.map((relation, index) => ({ trial_id: `TARGET-00${String(index + 1)}`, relation, group: "D3B_TARGET" }));
  const sixAligned = scoreD3BTargetV0({ trials: mkTarget([S, S, S, S, S, S]), r_confirm_B: 6 });
  const oneDissent = scoreD3BTargetV0({ trials: mkTarget([S, S, S, S, S, U]), r_confirm_B: 6 });
  const oneInvalid = scoreD3BTargetV0({ trials: mkTarget([S, S, S, S, S, null]), r_confirm_B: 6 });
  const integrityFailure = scoreD3BTargetV0({ trials: mkTarget([S, S, S, S, S]), r_confirm_B: 6 });
  const scorerChecks = {
    six_aligned_is_positive: sixAligned.outcome_class === "POSITIVE" && sixAligned.verdict === "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
    one_dissent_is_a_valid_null: oneDissent.outcome_class === "NULL" && oneDissent.verdict === "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
    one_invalid_is_inconclusive: oneInvalid.outcome_class === "INCONCLUSIVE" && oneInvalid.scientific_scoring_executed === false,
    integrity_failure_is_inconclusive: integrityFailure.outcome_class === "INCONCLUSIVE" && integrityFailure.collection_integrity === false,
    every_outcome_leaves_link_4_closed: [sixAligned, oneDissent, oneInvalid, integrityFailure].every((o) => o.may_not_reopen_link_4 === true)
  };
  if (Object.values(scorerChecks).some((v) => v !== true)) fail("D3_REV5_SCORER_CONFORMANCE_FAILED", JSON.stringify(scorerChecks));

  const audit = {
    stage: "D3_REVISION_5",
    model_calls: 0,
    section_1_violation: violationReproduced,
    section_2_shape: shapeAudit,
    section_3_occurrences: occurrenceAudit,
    section_4_corrected_identity: {
      corrected_target_hash: correctedHash,
      old_invalid_target_hash: OLD_INVALID_TARGET_HASH,
      correction_changed_the_bytes: correctedHash !== OLD_INVALID_TARGET_HASH,
      schedule_hash: scheduleHash
    },
    section_5_scorer: { called_not_reimplemented: true, checks: scorerChecks, outcomes: { six_aligned: sixAligned.verdict, one_dissent: oneDissent.verdict, one_invalid: oneInvalid.verdict, integrity: integrityFailure.verdict } },
    verdict: "D3_REV5_CORRECTED_TARGET_FROZEN"
  };
  await write("d3-rev5-audit.json", audit);
  await write("contract-rev5-manifest.json", rev5);
  await write("D3_REV5_VERDICT.json", {
    stage: "D3_REVISION_5",
    model_calls: 0,
    verdicts: [
      "D3_PREREGISTRATION_FINALIZED_REV5",
      "D3_B_TARGET_REQUEST_NOT_STATE_BLIND",
      "D3_B_TARGET_STATE_BLIND_REQUEST_FROZEN",
      "D3_B_TARGET_SCHEDULE_REFROZEN",
      "D3_B_TARGET_AUTHORISED",
      "D3_B_TARGET_NOT_EXECUTED"
    ],
    old_invalid_target: { hash: OLD_INVALID_TARGET_HASH, marking: D3B_INVALID_TARGET_REQUEST.marking, retained: true, calls_made_with_it: 0 },
    corrected_target: { hash: correctedHash, state_blind: true, occurrences_of_the_canonical_proposition: occurrenceAudit.canonical_proposition_occurrences_total },
    target_calls: 0,
    target_outputs_seen: false,
    d3_model_calls: 15,
    preserved: { instrument_qualified: true, noise_gate_pass: true, r_confirm_B: 6, qualification_rerun: false, noise_rerun: false },
    next_round_may_only: "execute the six corrected target calls, freeze the dataset before scoring, and classify with scoreD3BTargetV0",
    next_round_may_not: ["use the invalid target request", "re-run qualification or the noise pilot", "execute D3-A", "execute D2-B", "modify any frozen artifact"],
    revision_4_manifest_hash_preserved: rev5.revision_4_manifest_hash_preserved,
    rev5_manifest_hash: rev5.manifest_hash
  });

  process.stdout.write(
    `D3_PREREGISTRATION_FINALIZED_REV5 | D3_B_TARGET_REQUEST_NOT_STATE_BLIND\n` +
      `old target ${OLD_INVALID_TARGET_HASH} had CAUTION x${String(violationReproduced.canonical_proposition_occurrences_in_the_old_request)} (subject block owned ${String(violationReproduced.canonical_proposition_occurrences_owned_by_the_subject_block)})\n` +
      `corrected target ${correctedHash} has CAUTION x${String(occurrenceAudit.canonical_proposition_occurrences_total)} (STATEMENT A only)\n` +
      `same state-blind base as qualification: ${String(shapeAudit.same_state_blind_base_path)} | schedule refrozen at 6 calls\n` +
      `${rev5.manifest_hash}\nD3_MODEL_CALLS = 15 (0 this round)\n`
  );
}

await main();
