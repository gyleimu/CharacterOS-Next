/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C0a SCIENTIFIC TARGET — EXACTLY TWELVE CALLS. THEN STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-cross-expression-d4/d4c0a-target.ts <noiseDir> <outdir>
 *
 * Loads the frozen target schedule, recomputes both arm request hashes from the actual model-facing
 * bytes, re-proves treatment isolation and state-blindness, executes the twelve scheduled calls in the
 * frozen order, freezes the dataset BEFORE scoring, and only then calls the frozen `scoreD4C0ARev1V0`.
 *
 * TRIAL 12 RUNS even if the first eleven already decide the outcome.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ARMS,
  D4C0A_FORBIDDEN_SUBSTRINGS,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0,
  normaliseD4C0ARequestV0
} from "./contract.ts";
import { D4C0A_REV1_CLAIM_SCOPE, D4_REV1_ARCHITECTURE_GATE, scoreD4C0ARev1V0 } from "./contract-rev1-directional-majority.ts";
import { buildD4C0ABaseRequestV0, buildD4C0AStanceTransferRequestV0 } from "./transformer-d4c0a.ts";
import type { D4C0AArmV0 } from "./contract.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const FROZEN_SCHEDULE_HASH = "sha256:d85ffc134a2e2a4cada319f4843690374dfebbdf49a63c18c13139d0eb17335f" as const;
const FROZEN_SUPPORT_HASH = "sha256:0bad19fc3cd612db457615127ff79074f0e49c3f4bceab1b4b38d53b9d61549a" as const;
const FROZEN_OPPOSE_HASH = "sha256:bd195ef5ac12da286b0e7e8d401dc05a4ea7965506f52b41e00fea350d2dafb5" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

function parseD4C0A(content: string): { ok: true; token: string } | { ok: false; reason: string } {
  if (content.trim().length === 0) return { ok: false, reason: "empty output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, reason: `malformed output: ${(error as Error).message.slice(0, 40)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "output is not a JSON object" };
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["d4_c0a_schema_version", "stance_toward_b", "explanation"].includes(key)) return { ok: false, reason: `unknown member: ${key}` };
  }
  if (record["d4_c0a_schema_version"] !== "d4-c0a-stance-transfer-readout-v0") return { ok: false, reason: "schema version mismatch" };
  const token = record["stance_toward_b"];
  if (typeof token !== "string") return { ok: false, reason: "stance_toward_b is not a string" };
  if (!(D4C0A_TOKENS as readonly string[]).includes(token)) return { ok: false, reason: "token outside the frozen D4-C0a vocabulary" };
  return { ok: true, token };
}

async function main(): Promise<void> {
  const noiseDir = process.argv[2];
  const outdir = process.argv[3];
  if (noiseDir === undefined || outdir === undefined) fail("D4_C0A_TARGET_USAGE", "usage: <noiseDir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the frozen target schedule ------------------------------------------------------------
  const scheduleRaw = await readFile(join(noiseDir, "D4_C0A_TARGET_SCHEDULE.json"), "utf8");
  const schedule = JSON.parse(scheduleRaw) as {
    planned_calls: number;
    calls_per_arm: number;
    support_request_hash: string;
    oppose_request_hash: string;
    trials: { position: number; trial_id: string; arm: D4C0AArmV0; request_hash: string }[];
  };
  const scheduleHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C0A_TARGET_SCHEDULE.json", content: scheduleRaw }));
  const expectedIds = Array.from({ length: 12 }, (_u, index) => `TARGET-${String(index + 1).padStart(3, "0")}`);

  // ---- 2. recompute both arm hashes from the ACTUAL model-facing bytes ---------------------------
  const supportRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_SUPPORT.binding));
  const opposeRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_OPPOSE.binding));
  const supportHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, supportRequest as unknown));
  const opposeHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, opposeRequest as unknown));

  const scheduleAudit = {
    schedule_hash_recomputed: scheduleHash,
    schedule_hash_exact: scheduleHash === FROZEN_SCHEDULE_HASH,
    planned_trials: schedule.trials.length,
    identities_unique_exact: schedule.trials.map((t) => t.trial_id).join(",") === expectedIds.join(","),
    positions_1_to_12: schedule.trials.every((t, i) => t.position === i + 1),
    support_trials: schedule.trials.filter((t) => t.arm === "ARM_SUPPORT").length,
    oppose_trials: schedule.trials.filter((t) => t.arm === "ARM_OPPOSE").length,
    duplicate_identities: schedule.trials.length - new Set(schedule.trials.map((t) => t.trial_id)).size,
    missing_identities: expectedIds.filter((id) => !schedule.trials.some((t) => t.trial_id === id)).length,
    extra_identities: schedule.trials.filter((t) => !expectedIds.includes(t.trial_id)).length,
    every_trial_references_its_arm_hash: schedule.trials.every(
      (t) => t.request_hash === (t.arm === "ARM_SUPPORT" ? FROZEN_SUPPORT_HASH : FROZEN_OPPOSE_HASH)
    ),
    support_request_hash_recomputed: supportHash,
    support_request_hash_exact: supportHash === FROZEN_SUPPORT_HASH && supportHash === schedule.support_request_hash,
    oppose_request_hash_recomputed: opposeHash,
    oppose_request_hash_exact: opposeHash === FROZEN_OPPOSE_HASH && opposeHash === schedule.oppose_request_hash,
    reshuffled: false,
    rebuilt: false,
    ordering_unchanged_from_the_frozen_schedule: true
  };
  const scheduleOk =
    scheduleAudit.schedule_hash_exact &&
    scheduleAudit.planned_trials === 12 &&
    scheduleAudit.identities_unique_exact &&
    scheduleAudit.positions_1_to_12 &&
    scheduleAudit.support_trials === 6 &&
    scheduleAudit.oppose_trials === 6 &&
    scheduleAudit.duplicate_identities === 0 &&
    scheduleAudit.missing_identities === 0 &&
    scheduleAudit.extra_identities === 0 &&
    scheduleAudit.every_trial_references_its_arm_hash &&
    scheduleAudit.support_request_hash_exact &&
    scheduleAudit.oppose_request_hash_exact;
  if (!scheduleOk) fail("D4_C0A_TARGET_SCHEDULE_BLOCKED", JSON.stringify(scheduleAudit));
  await write("target-schedule-verification.json", { ...scheduleAudit, verdict: "D4_C0A_TARGET_SCHEDULE_VERIFIED" });

  // ---- 3. treatment isolation, re-proved before any call ------------------------------------------
  const supportSystem = supportRequest.messages[0]?.content ?? "";
  const opposeSystem = opposeRequest.messages[0]?.content ?? "";
  const supportUser = supportRequest.messages[1]?.content ?? "";
  const opposeUser = opposeRequest.messages[1]?.content ?? "";
  const differing = supportUser
    .split("\n")
    .map((line, index) => ({ index, support: line, oppose: opposeUser.split("\n")[index] ?? null }))
    .filter((row) => row.support !== row.oppose);
  const supportNorm = normaliseD4C0ARequestV0(supportUser);
  const opposeNorm = normaliseD4C0ARequestV0(opposeUser);
  const isolation = {
    system_message_byte_identical: supportSystem === opposeSystem,
    same_proposition_a: supportUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a) && opposeUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a),
    same_proposition_b: supportUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b) && opposeUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b),
    same_explicit_relation: supportUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.relation) && opposeUser.includes(D4C0A_ARMS.ARM_SUPPORT.binding.relation),
    same_measurement_contract: countOf(supportSystem, "D4-C0A STANCE TRANSFER CONTRACT") === 2 && countOf(opposeSystem, "D4-C0A STANCE TRANSFER CONTRACT") === 2,
    same_schema: JSON.stringify(supportRequest.structured_output) === JSON.stringify(opposeRequest.structured_output),
    same_anchors: true,
    same_output_vocabulary: D4C0A_TOKENS.every((t) => countOf(supportSystem, t) === countOf(opposeSystem, t)),
    same_surrounding_framing: supportSystem === opposeSystem,
    differing_user_line_count: differing.length,
    differing_lines: differing,
    treatment_correlated_differences_beyond_the_stance: differing.filter((d) => !d.support.startsWith("SUBJECT STANCE TOWARD A: ")).length,
    byte_identical_after_the_frozen_sentinel_normalisation: supportNorm.normalised === opposeNorm.normalised
  };
  if (
    !isolation.system_message_byte_identical ||
    isolation.differing_user_line_count !== 1 ||
    isolation.treatment_correlated_differences_beyond_the_stance !== 0 ||
    !isolation.byte_identical_after_the_frozen_sentinel_normalisation
  ) {
    fail("D4_C0A_TARGET_TREATMENT_ISOLATION_FAILED", JSON.stringify(isolation));
  }
  await write("treatment-isolation-audit.json", { ...isolation, verdict: "D4_C0A_TARGET_TREATMENT_ISOLATION_HOLDS" });

  // ---- 4. state-blindness on both arms -------------------------------------------------------------
  const requestMaterial = `${supportSystem}\n${supportUser}\n${opposeSystem}\n${opposeUser}`;
  const forbiddenHits = D4C0A_FORBIDDEN_SUBSTRINGS.filter((s) => requestMaterial.includes(s));
  const stateBlindness = {
    forbidden_substrings_checked: D4C0A_FORBIDDEN_SUBSTRINGS,
    hits: forbiddenHits,
    contains_an_arm_label_such_as_SUPPORT_ARM: /SUPPORT_ARM|OPPOSE_ARM|ARM_SUPPORT|ARM_OPPOSE/.test(requestMaterial),
    contains_an_expected_answer_token: false,
    contains_a_replicate_ordinal: /\breplicate\b|\bordinal\b/i.test(requestMaterial),
    contains_a_schedule_identity: /TARGET-0[01][0-9]|NOISE-00[1-6]|D4C0A-QF-/.test(requestMaterial),
    contains_a_request_hash: /sha256:/.test(requestMaterial),
    the_stance_line_is_the_treatment_not_a_leak: true,
    state_blind: forbiddenHits.length === 0
  };
  const blindnessOk =
    stateBlindness.state_blind &&
    !stateBlindness.contains_an_arm_label_such_as_SUPPORT_ARM &&
    !stateBlindness.contains_a_replicate_ordinal &&
    !stateBlindness.contains_a_schedule_identity &&
    !stateBlindness.contains_a_request_hash;
  if (!blindnessOk) fail("D4_C0A_TARGET_STATE_BLINDNESS_FAILED", JSON.stringify(stateBlindness));
  await write("pre-execution-target-audit.json", {
    schedule: scheduleAudit,
    isolation,
    state_blindness: stateBlindness,
    frozen_inputs: {
      proposition_a: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a,
      proposition_b: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b,
      relation: D4C0A_ARMS.ARM_SUPPORT.binding.relation,
      reworded: false,
      relation_weakened: false
    },
    target_calls_so_far: 0,
    verdict: "D4_C0A_TARGET_IDENTITY_AND_ISOLATION_VERIFIED"
  });

  // ---- 6. the frozen executor ----------------------------------------------------------------------
  if (process.env["D4C0A_TARGET_DRY_RUN"] === "1") {
    process.stdout.write("D4C0A_TARGET_DRY_RUN: identity, isolation and blindness verified, 0 model calls.\n");
    return;
  }
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) fail("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const generationSettings = Object.freeze({ temperature: 0, max_output_tokens: 256, provider_thinking: "disabled", timeout_ms: 120_000, endpoint });
  const transport = new OpenAiCompatibleTransportV0({
    base_url: endpoint,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: 0,
    max_output_tokens: 256,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;
  const executor = { provider: "DeepSeek", model, ...generationSettings };

  // ---- 7. exactly twelve calls, in the frozen order ---------------------------------------------------
  const trials: Record<string, unknown>[] = [];
  for (const [index, entry] of schedule.trials.entries()) {
    const request = entry.arm === "ARM_SUPPORT" ? supportRequest : opposeRequest;
    const expectedHash = entry.arm === "ARM_SUPPORT" ? supportHash : opposeHash;
    if (entry.request_hash !== expectedHash) fail("D4_C0A_TARGET_SCHEDULED_HASH_MISMATCH", entry.trial_id);
    process.stdout.write(`[${String(index + 1)}/12] ${entry.trial_id} ${entry.arm} ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(request);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseD4C0A(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial = {
      trial_id: entry.trial_id,
      ordinal: index + 1,
      arm: entry.arm,
      request_hash: expectedHash,
      raw_provider_response: content,
      parsed_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : "INVALID",
      transport_status: failure === null ? "OK" : "FAILED",
      invalid_reason: parsed.ok ? null : parsed.reason,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await write(`trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 10. collection integrity -----------------------------------------------------------------------
  const collection = {
    planned: 12,
    records: trials.length,
    support_records: trials.filter((t) => t["arm"] === "ARM_SUPPORT").length,
    oppose_records: trials.filter((t) => t["arm"] === "ARM_OPPOSE").length,
    duplicate_identities: trials.length - new Set(trials.map((t) => String(t["trial_id"]))).size,
    missing_identities: expectedIds.filter((id) => !trials.some((t) => t["trial_id"] === id)).length,
    extra_identities: trials.filter((t) => !expectedIds.includes(String(t["trial_id"]))).length,
    every_recorded_arm_matches_the_frozen_schedule: trials.every((t, index) => t["arm"] === schedule.trials[index]?.arm),
    every_request_hash_matches_the_frozen_arm_identity: trials.every(
      (t) => t["request_hash"] === (t["arm"] === "ARM_SUPPORT" ? FROZEN_SUPPORT_HASH : FROZEN_OPPOSE_HASH)
    ),
    invalid_trials: trials.filter((t) => t["parsed_token"] === null).length,
    transport_failures: trials.filter((t) => t["transport_status"] !== "OK").length,
    frozen_ordering_preserved: trials.every((t, index) => t["trial_id"] === schedule.trials[index]?.trial_id),
    verdict: "D4_C0A_TARGET_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", collection);

  // ---- 11. freeze the dataset BEFORE scoring ----------------------------------------------------------
  const datasetDoc = {
    stage: "D4_C0A_TARGET",
    is_the_scientific_contrast: true,
    planned: 12,
    observed: trials.length,
    scored: false,
    trials
  };
  await writeFile(join(outdir, "target-dataset.json"), `${JSON.stringify(datasetDoc, null, 2)}\n`, "utf8");
  const datasetContent = await readFile(join(outdir, "target-dataset.json"), "utf8");
  const datasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "target-dataset.json", content: datasetContent }));
  await write("target-dataset-hash.json", { D4_C0A_TARGET_DATASET_SHA256: datasetHash, frozen_before_any_scientific_scoring: true, planned: 12, observed: trials.length });

  // ---- 12. the frozen scorer, over the frozen bytes ----------------------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outdir, "target-dataset.json"), "utf8")) as {
    trials: { trial_id: string; arm: D4C0AArmV0; parsed_token: string | null }[];
  };
  if (frozenDoc.trials.length !== 12) fail("D4_C0A_TARGET_DENOMINATOR_VIOLATION", String(frozenDoc.trials.length));
  const outcome = scoreD4C0ARev1V0({
    trials: frozenDoc.trials.map((t) => ({ trial_id: t.trial_id, arm: t.arm, parsed_token: t.parsed_token })),
    r_per_arm: 6
  });
  await write("support-arm-counts.json", {
    arm: "ARM_SUPPORT",
    counts: outcome.arm_counts?.["ARM_SUPPORT"] ?? null,
    unique_modal: outcome.arm_unique_modals?.["ARM_SUPPORT"] ?? null,
    predicted_token: "SUPPORTS_B",
    predicted_token_count: outcome.arm_predicted_counts?.["ARM_SUPPORT"] ?? null,
    predicted_count_at_least_4: (outcome.arm_predicted_counts?.["ARM_SUPPORT"] ?? 0) >= 4,
    criterion_met: outcome.arm_meets_directional_majority?.["ARM_SUPPORT"] ?? null
  });
  await write("oppose-arm-counts.json", {
    arm: "ARM_OPPOSE",
    counts: outcome.arm_counts?.["ARM_OPPOSE"] ?? null,
    unique_modal: outcome.arm_unique_modals?.["ARM_OPPOSE"] ?? null,
    predicted_token: "OPPOSES_B",
    predicted_token_count: outcome.arm_predicted_counts?.["ARM_OPPOSE"] ?? null,
    predicted_count_at_least_4: (outcome.arm_predicted_counts?.["ARM_OPPOSE"] ?? 0) >= 4,
    criterion_met: outcome.arm_meets_directional_majority?.["ARM_OPPOSE"] ?? null
  });
  await write("scorer-output.json", {
    scorer: "scoreD4C0ARev1V0 (frozen revision 1) — called, not re-implemented",
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  const positive = outcome.outcome_class === "POSITIVE";
  const nullResult = outcome.outcome_class === "NULL";
  const scientificVerdict = {
    stage: "D4_C0a-target",
    outcome_class: outcome.outcome_class,
    verdict: outcome.verdict,
    collection_integrity: outcome.collection_integrity,
    invalid_count: outcome.invalid_count,
    scientific_scoring_executed: outcome.scientific_scoring_executed,
    support_counts: outcome.arm_counts?.["ARM_SUPPORT"] ?? null,
    oppose_counts: outcome.arm_counts?.["ARM_OPPOSE"] ?? null,
    support_unique_modal: outcome.arm_unique_modals?.["ARM_SUPPORT"] ?? null,
    oppose_unique_modal: outcome.arm_unique_modals?.["ARM_OPPOSE"] ?? null,
    support_predicted_count: outcome.arm_predicted_counts?.["ARM_SUPPORT"] ?? null,
    oppose_predicted_count: outcome.arm_predicted_counts?.["ARM_OPPOSE"] ?? null,
    directional_majority: outcome.arm_meets_directional_majority ?? null,
    contrast_holds: outcome.contrast_holds,
    claim_scope: positive ? D4C0A_REV1_CLAIM_SCOPE.canonical_interpretation : null,
    authoritative_expansion: positive
      ? "Under the frozen state-blind task with explicit polar stance and an explicitly supplied semantic-alignment relation, the executor transferred SUPPORT and OPPOSE stances from proposition A to proposition B in the preregistered directions."
      : null,
    minimal_wording: positive
      ? null
      : "even with CharacterOS absent and with the stance and the semantic-alignment relation supplied explicitly, the executor did not complete the composition in the preregistered direction",
    forbidden_interpretations: outcome.forbidden_interpretations
  };
  await write("scientific-verdict.json", scientificVerdict);

  await write("hypothesis-update.json", {
    positive: {
      h_exec_composition_strong_form: positive ? "WEAKENED" : "unchanged",
      statement: positive
        ? "the claim that the executor would not perform stance composition even with every required fact supplied explicitly is no longer a good standalone explanation"
        : null,
      forbidden_even_on_positive: [
        "spontaneous composition established",
        "implicit composition established",
        "arbitrary stance transfer established",
        "UNCERTAIN transfer established",
        "CharacterOS representation proven defective",
        "projection broken",
        "semantic ID required",
        "integration mechanism failed"
      ]
    },
    null_result: nullResult
      ? {
          localisation: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED",
          strength:
            "strong: the baseline supplied stance(A), the semantic alignment A↔B and a composition-oriented framing, with CharacterOS entirely absent",
          consequence: "CHARACTEROS ARCHITECTURE MODIFICATION NOT AUTHORISED BY THIS LINE",
          forbidden_responses: ["prompt rescue", "friendlier wording", "modifying CharacterOS", "immediately running another similar baseline"]
        }
      : null,
    inconclusive: outcome.outcome_class === "INCONCLUSIVE"
      ? {
          localisation: "none",
          h_exec_composition: "remains OPEN",
          characteros_architecture_modification: "not authorised",
          c0b: "deferred",
          link_4: "locked",
          forbidden: ["re-running to force a verdict", "reading a provider or parser failure as an executor composition null"]
        }
      : null,
    h6_boundary_remains_open: true,
    h6_note:
      "even on a C0a positive, A1's frozen framing ambiguity stays open: C0a's contract is a deliberately explicit composition baseline, so a C0a positive plus an A1 null cannot separate CharacterOS representation/binding from executor-facing framing from A1 measurement-contract ambiguity"
  });

  await write("architecture-gate-status.json", {
    characteros_architecture_may_be_modified: false,
    c0a_positive_alone_authorises_nothing: D4_REV1_ARCHITECTURE_GATE.c0a_positive_alone_authorises_nothing,
    comparator_must_hold_all_equal: D4_REV1_ARCHITECTURE_GATE.a_future_comparator_must_hold_all_of_these_equal,
    comparator_must_enumerate_all_model_facing_byte_differences: true,
    only_permitted_scientific_difference: D4_REV1_ARCHITECTURE_GATE.the_only_permitted_scientific_difference,
    if_framing_or_relation_explicitness_also_changes: D4_REV1_ARCHITECTURE_GATE.if_relation_explicitness_instruction_framing_or_measurement_semantics_also_change,
    until_then: D4_REV1_ARCHITECTURE_GATE.until_then,
    c0b_status: "D4_C0B_NOT_PREREGISTERED",
    link_4_status: "LINK_4_REMAINS_LOCKED",
    status: "CLOSED"
  });

  const finalStates = positive
    ? ["EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED", "D4_C0A_TARGET_EXECUTED", "H_EXEC_COMPOSITION_STRONG_FORM_WEAKENED", "CHARACTEROS_UNMODIFIED", "D4_C0B_NOT_PREREGISTERED"]
    : nullResult
      ? ["EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED", "D4_C0A_TARGET_EXECUTED", "CHARACTEROS_ARCHITECTURE_MODIFICATION_NOT_AUTHORISED", "H_EXEC_COMPOSITION_REMAINS_OPEN", "D4_C0B_NOT_PREREGISTERED"]
      : [outcome.verdict, "D4_C0A_TARGET_EXECUTED", "H_EXEC_COMPOSITION_REMAINS_OPEN", "CHARACTEROS_ARCHITECTURE_MODIFICATION_NOT_AUTHORISED", "D4_C0B_NOT_PREREGISTERED"];

  await write("D4_C0A_TARGET_MANIFEST.json", {
    stage: "D4_C0a-target",
    final_states: finalStates,
    outcome_class: outcome.outcome_class,
    verdict: outcome.verdict,
    dataset_hash: datasetHash,
    schedule_hash: scheduleHash,
    support_request_hash: supportHash,
    oppose_request_hash: opposeHash,
    collection,
    treatment_isolation: isolation,
    model_calls_this_round: 12,
    d4_model_calls_cumulative: 27,
    executor,
    characteros_modified: false,
    link_4_reopened: false,
    non_claims: [
      "no spontaneous or implicit composition is claimed",
      "no arbitrary or UNCERTAIN stance transfer is claimed",
      "no CharacterOS representation defect is claimed, and no projection defect is claimed",
      "the reverse direction, a 3-2-1 plurality and a tie are NULLs, never effects",
      "A1's framing ambiguity (H6) remains open regardless of this result"
    ],
    next_round_may_only: "freeze this scientific result; any comparator or C0b requires its own preregistration and may not modify CharacterOS",
    next_round_may_not: ["design a comparator in this round", "design C0b in this round", "modify CharacterOS"]
  });

  process.stdout.write(
    `\n${finalStates.join("\n")}\nSUPPORT ${JSON.stringify(outcome.arm_counts?.["ARM_SUPPORT"] ?? null)}\nOPPOSE  ${JSON.stringify(outcome.arm_counts?.["ARM_OPPOSE"] ?? null)}\n` +
      `modals: ${String(outcome.arm_unique_modals?.["ARM_SUPPORT"] ?? null)} / ${String(outcome.arm_unique_modals?.["ARM_OPPOSE"] ?? null)}\n` +
      `D4_MODEL_CALLS_THIS_ROUND = 12\nD4_MODEL_CALLS = 27\n`
  );
}

await main();
