/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 — MATERIALISE THE THREE CHARACTEROS ARMS AND FREEZE THE THREE REQUESTS. OFFLINE, 0 CALLS.
 *
 *   node research/experiments/belief-causal-path-d2/a1-state-requests.ts <outdir>
 *
 * Nothing is authored here. Every literal byte of the A1 stimulus comes from an artifact frozen before
 * this round, and the production context is the one REV1.1d bound explicitly:
 *   subject identity, P1 observation id, P1 observation literal and scene, task: null    -> D1 (frozen)
 *   arm credences 0.80 / 0.50 / 0.20                                                     -> D1_STATE_LEVELS
 *   world construction, observation lifecycle, projection                                -> production (D1 frozen)
 *   measurement contract, anchors, paraphrase, schema                                    -> REV1.1c (frozen)
 * The A1 semantic structure is canonical wording in the subject state -> different preregistered
 * wording in the measurement contract. The two must not be swapped or duplicated.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalJsonString,
  deriveRef,
  hashEnvelope,
  stateHashAnyVersion,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

import { D2_HASH_PROJECTION_V0, D2A1_PARAPHRASE, D2A1_TOKENS } from "./contract-rev1.ts";
import {
  D2A1_ANCHORS_FROZEN_V0,
  D2A1_CONTRACT_TEXT,
  D2A1_JSON_SCHEMA,
  D2A1_TRANSFORMER_CONTRACT,
  deriveD2Rev11cManifestV0
} from "./contract-rev1-1c-a1-prerequisites.ts";
import {
  D2A1_PRODUCTION_CONTEXT_BINDING,
  deriveD2Rev11dManifestV0
} from "./contract-rev1-1d-a1-neutral-and-context.ts";
import { A0_MARKER, B_MARKER, DP_V2_MARKER, buildD2SemanticReadoutRequestV0 } from "./transformer-a1.ts";
import { D1_P1, D1_PROPOSITION_LABEL, D1_STATE_LEVELS } from "../belief-state-sensitivity-d1/contract.ts";
import { normalizeArmSpecificBytes } from "../belief-state-sensitivity-d1/revision-3.ts";
import { D1_OBSERVATION_ID, D1_SUBJECT_ID, buildArmWorldV0, diffPathsOf } from "../belief-state-sensitivity-d1/world-a1.ts";
import { buildProjectionV0 } from "../belief-state-sensitivity-d1/state-construction.ts";

const LEVELS = ["HIGH", "NEUTRAL", "LOW"] as const;
type Level = (typeof LEVELS)[number];
const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const TRANSFORMER_SOURCE = "research/experiments/belief-causal-path-d2/transformer-a1.ts" as const;
const FROZEN_TRANSFORMER_SOURCE_HASH =
  "sha256:628c5094deee14dea88b79b8e1a65692f9cd9766490347f2ba2e6c3125172406" as const;

const REVISION_4_ALLOWED_PATHS = [
  "/beliefs/items/0/credence",
  "/trace_window/entries/0/state_hash_before",
  "/trace_window/entries/0/state_hash_after",
  "/trace_window/entries/0/trace_id"
] as const;
const TRACE_PATH_FIELDS = ["state_hash_before", "state_hash_after", "trace_id"] as const;
const CREDENCE_PATH = "/beliefs/items/0/credence";
const TRACE_ID_PROJECTION = "characteros-next/trace/entry-id/v1" as const;
const BOOKKEEPING_SENTINEL = "__D1_DERIVED_BOOKKEEPING__" as const;
const ARM_WORDS = ["HIGH", "LOW", "NEUTRAL"] as const;
const ACTION_TOKENS = ["ACCEPT", "VERIFY", "REJECT", "proceed", "choose", "decide"] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

function sentineliseDerivedBookkeepingV0(state: SubjectStateV4): SubjectStateV4 {
  const clone = JSON.parse(JSON.stringify(state)) as SubjectStateV4 & {
    trace_window: { entries: Record<string, unknown>[] };
  };
  const entry = clone.trace_window.entries[0];
  if (entry === undefined) fail("D2_A1_BLOCKED_BY_STATE_ISOLATION_FAILURE", "no trace entry to normalise");
  const mutable = entry as Record<string, unknown>;
  for (const field of TRACE_PATH_FIELDS) {
    if (!(field in mutable)) fail("D2_A1_BLOCKED_BY_STATE_ISOLATION_FAILURE", `trace field ${field} absent`);
    mutable[field] = BOOKKEEPING_SENTINEL;
  }
  return clone as SubjectStateV4;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function countToken(text: string, token: string): number {
  return text.split(new RegExp(`\\b${token}\\b`)).length - 1;
}

function ngrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  for (let index = 0; index + n <= words.length; index += 1) out.push(words.slice(index, index + n).join(" "));
  return out;
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-state-requests.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  const rev11c = await deriveD2Rev11cManifestV0();
  const rev11d = await deriveD2Rev11dManifestV0();

  // ---- 1. materialise the three real CharacterOS arms ----------------------------------------
  const expected: Record<Level, number> = {
    HIGH: D1_STATE_LEVELS.HIGH,
    NEUTRAL: D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION,
    LOW: D1_STATE_LEVELS.LOW
  };
  const worlds = new Map<Level, Awaited<ReturnType<typeof buildArmWorldV0>>>();
  for (const level of LEVELS) worlds.set(level, await buildArmWorldV0(level));
  const world = (level: Level): Awaited<ReturnType<typeof buildArmWorldV0>> =>
    worlds.get(level) ?? fail("D2_A1_BLOCKED_BY_STATE_ISOLATION_FAILURE", `world ${level} missing`);
  for (const level of LEVELS) {
    if (world(level).credence !== expected[level]) {
      fail("D2_A1_BLOCKED_BY_STATE_ISOLATION_FAILURE", `${level} credence ${world(level).credence}`);
    }
  }

  // ---- 1b. REV1.1d context-binding verification ------------------------------------------------
  const binding = D2A1_PRODUCTION_CONTEXT_BINDING;
  const contextVerification: Record<string, unknown> = {};
  let contextOk = true;
  for (const level of LEVELS) {
    const w = world(level);
    const state = w.post_observation_state as unknown as { identity: { subject_id: string } };
    const row = {
      subject_id_equals_rev11d_binding: state.identity.subject_id === binding.identity.exact_value,
      subject_id_equals_D1: state.identity.subject_id === D1_SUBJECT_ID,
      observation_id_equals_rev11d_binding: w.observation_id === binding.observation.exact_observation_id,
      observation_id_equals_D1_OBSERVATION_ID: w.observation_id === D1_OBSERVATION_ID,
      committed_observation_identity_equals_D1: w.observation_ref === D1_OBSERVATION_ID,
      observation_literal_equals_rev11d_binding: binding.observation.exact_observation_bytes === D1_P1.observation_text,
      probe_id_equals_D1_P1: binding.observation.probe_id === D1_P1.probe_id,
      scene_bytes_equal_the_observation_bytes: binding.observation.exact_scene_bytes === binding.observation.exact_observation_bytes,
      task_is_null: binding.task.exact_value === null,
      canonical_proposition_equals_D1: binding.canonical_proposition_label === D1_PROPOSITION_LABEL,
      credence_equals_the_rev11d_arm_value: w.credence === expected[level]
    };
    if (Object.values(row).some((v) => v !== true)) contextOk = false;
    contextVerification[level] = { ...row, pass: Object.values(row).every((v) => v === true) };
  }
  if (!contextOk) fail("D2_A1_CONTEXT_BINDING_MISMATCH", JSON.stringify(contextVerification));

  // ---- 2. state isolation, Revision 4 only -----------------------------------------------------
  const pairs: readonly (readonly [Level, Level])[] = [["HIGH", "NEUTRAL"], ["HIGH", "LOW"], ["NEUTRAL", "LOW"]];
  const isolation: Record<string, unknown> = {};
  let isolationOk = true;
  for (const [a, b] of pairs) {
    const postA = world(a).post_observation_state;
    const postB = world(b).post_observation_state;
    const raw = [...diffPathsOf(postA, postB)].sort();
    const unexpected = raw.filter((p) => !(REVISION_4_ALLOWED_PATHS as readonly string[]).includes(p));
    const normalised = [...diffPathsOf(sentineliseDerivedBookkeepingV0(postA), sentineliseDerivedBookkeepingV0(postB))].sort();
    const onlyCredence = normalised.length === 1 && normalised[0] === CREDENCE_PATH;
    const entryA = (postA.trace_window as unknown as { entries: Record<string, unknown>[] }).entries[0];
    const entryB = (postB.trace_window as unknown as { entries: Record<string, unknown>[] }).entries[0];
    const bookkeepingOk =
      entryA !== undefined &&
      entryB !== undefined &&
      String(await stateHashAnyVersion(postA as never)) === String(entryA["state_hash_after"]) &&
      String(await stateHashAnyVersion(postB as never)) === String(entryB["state_hash_after"]) &&
      String(await deriveRef("trace", TRACE_ID_PROJECTION, Object.fromEntries(Object.entries(entryA).filter(([k]) => k !== "trace_id")))) === String(entryA["trace_id"]) &&
      String(await deriveRef("trace", TRACE_ID_PROJECTION, Object.fromEntries(Object.entries(entryB).filter(([k]) => k !== "trace_id")))) === String(entryB["trace_id"]);
    if (unexpected.length > 0 || !onlyCredence || !bookkeepingOk) isolationOk = false;
    isolation[`${a}_vs_${b}`] = {
      raw_diff_paths: raw,
      raw_diff_is_exactly_the_frozen_allow_list:
        canonicalJsonString(raw) === canonicalJsonString([...REVISION_4_ALLOWED_PATHS].sort()),
      unexpected_paths_outside_the_frozen_allow_list: unexpected,
      normalised_diff_paths: normalised,
      normalised_diff_is_exactly_the_credence: onlyCredence,
      trace_bookkeeping_forward_recomputed: bookkeepingOk
    };
  }
  if (!isolationOk) fail("D2_A1_BLOCKED_BY_STATE_ISOLATION_FAILURE", JSON.stringify(isolation));
  await write("state-isolation-report.json", {
    allowed_difference_classes: REVISION_4_ALLOWED_PATHS,
    new_allowed_difference_classes_added: false,
    per_pair: isolation,
    verdict: "D2_A1_STATE_ISOLATION_HOLDS"
  });

  // ---- 3. pristine production requests ---------------------------------------------------------
  const pristineHash: Record<Level, string> = {} as Record<Level, string>;
  const stateHash: Record<Level, string> = {} as Record<Level, string>;
  const pristines = new Map<Level, ModelTransportRequestV0>();
  for (const level of LEVELS) {
    const projection = await buildProjectionV0(world(level).post_observation_state);
    const request = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
        Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
      ]),
      structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
    }) as unknown as ModelTransportRequestV0;
    const system = request.messages[0]?.content ?? "";
    const user = request.messages[1]?.content ?? "";
    for (const [tag, text] of [["system", system], ["user", user]] as const) {
      if (text.includes(D2A1_CONTRACT_TEXT)) fail("D2_A1_PRISTINE_NOT_PRISTINE", `${level} ${tag} already carries the A1 contract`);
      if (text.includes(DP_V2_MARKER)) fail("D2_A1_PRISTINE_NOT_PRISTINE", `${level} ${tag} carries DecisionProbeV2`);
      if (text.includes(D2A1_PARAPHRASE)) fail("D2_A1_PRISTINE_CONTAINS_THE_PARAPHRASE", `${level} ${tag}`);
    }
    if (!user.includes(D1_PROPOSITION_LABEL)) fail("D2_A1_PRISTINE_MISSING_THE_CANONICAL_PROPOSITION", level);
    pristines.set(level, request);
    pristineHash[level] = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    stateHash[level] = String(await stateHashAnyVersion(world(level).post_observation_state as never));
    await write(`pristine-${level.toLowerCase()}.json`, {
      level,
      credence: world(level).credence,
      request_hash: pristineHash[level],
      state_hash: stateHash[level],
      system_bytes: system.length,
      user_bytes: user.length,
      request
    });
  }
  await write("context-binding-verification.json", {
    binding_source: "contract-rev1-1d-a1-neutral-and-context.ts :: D2A1_PRODUCTION_CONTEXT_BINDING",
    revision_1_1d_manifest_hash: rev11d.manifest_hash,
    per_arm: contextVerification,
    observation_id: world("HIGH").observation_id,
    observation_ref: world("HIGH").observation_ref,
    probe_id: D1_P1.probe_id,
    task: null,
    verdict: "D2_A1_CONTEXT_BINDING_VERIFIED"
  });

  // ---- 4. apply the frozen A1 transformer exactly once -----------------------------------------
  const sourceText = await readFile(TRANSFORMER_SOURCE, "utf8");
  const sourceHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { source: sourceText }));
  if (sourceHash !== FROZEN_TRANSFORMER_SOURCE_HASH) fail("D2_A1_TRANSFORMER_CHANGED_SINCE_QUALIFICATION", sourceHash);
  const finals = new Map<Level, ModelTransportRequestV0>();
  const transformerReport: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const pristine = pristines.get(level) as ModelTransportRequestV0;
    const transformed = buildD2SemanticReadoutRequestV0(pristine);
    const sys = transformed.messages[0]?.content ?? "";
    const user = transformed.messages[1]?.content ?? "";
    const pristineSys = pristine.messages[0]?.content ?? "";
    const pristineUser = pristine.messages[1]?.content ?? "";
    const anchorsExact = Object.values(D2A1_ANCHORS_FROZEN_V0).every((m) => sys.includes(m));
    const checks = {
      production_prefix_byte_identical: sys.slice(0, sys.length - D2A1_CONTRACT_TEXT.length) === pristineSys,
      user_content_untouched: user === pristineUser,
      a1_measurement_contract_exactly_once: countOccurrences(sys, D2A1_CONTRACT_TEXT) === 1,
      a1_schema_exactly_once:
        canonicalJsonString(transformed.structured_output?.schema ?? {}) === canonicalJsonString(D2A1_JSON_SCHEMA),
      a1_contract_hash_exact:
        String(await hashEnvelope(D2_HASH_PROJECTION_V0, { contract_text: D2A1_CONTRACT_TEXT })) === rev11c.contract_text_hash,
      frozen_paraphrase_exactly_once: countOccurrences(sys, D2A1_PARAPHRASE) === 1,
      a1_anchors_exact: anchorsExact,
      decision_probe_v2_absent: !sys.includes(DP_V2_MARKER),
      a0_contract_absent: !sys.includes(A0_MARKER),
      b_contract_absent: !sys.includes(B_MARKER)
    };
    let secondApplicationRejected = false;
    try {
      buildD2SemanticReadoutRequestV0(transformed);
    } catch {
      secondApplicationRejected = true;
    }
    if (Object.values(checks).some((v) => v !== true) || !secondApplicationRejected) {
      fail("D2_A1_TRANSFORMER_APPLICATION_NONCONFORMANT", `${level}: ${JSON.stringify({ ...checks, secondApplicationRejected })}`);
    }
    const armIntroduced = ARM_WORDS.map((w) => ({ word: w, introduced: countToken(sys, w) - countToken(pristineSys, w) }));
    const actionIntroduced = ACTION_TOKENS.map((t) => ({ token: t, introduced: countToken(sys, t) - countToken(pristineSys, t) }));
    transformerReport[level] = {
      ...checks,
      transformer_on_transformer_rejected: secondApplicationRejected,
      arm_words_introduced_by_the_transformer: armIntroduced.filter((a) => a.introduced !== 0),
      action_tokens_introduced_by_the_transformer: actionIntroduced.filter((a) => a.introduced !== 0)
    };
    if (armIntroduced.some((a) => a.introduced !== 0) || actionIntroduced.some((a) => a.introduced !== 0)) {
      fail("D2_A1_TRANSFORMER_INTRODUCED_ARM_OR_ACTION_VOCABULARY", level);
    }
    finals.set(level, transformed);
  }
  await write("transformer-application-report.json", {
    transformer: D2A1_TRANSFORMER_CONTRACT.name,
    transformer_source_hash: sourceHash,
    transformer_source_unchanged_since_qualification: true,
    per_arm: transformerReport,
    verdict: "D2_A1_TRANSFORMER_APPLIED_ONCE_PER_ARM"
  });

  // ---- 5. semantic structure audit -------------------------------------------------------------
  const structure: Record<string, unknown> = {};
  let structureOk = true;
  for (const level of LEVELS) {
    const pristine = pristines.get(level) as ModelTransportRequestV0;
    const transformed = finals.get(level) as ModelTransportRequestV0;
    const sys = transformed.messages[0]?.content ?? "";
    const user = transformed.messages[1]?.content ?? "";
    const contractText = sys.slice(sys.length - D2A1_CONTRACT_TEXT.length);
    const pristineUser = pristine.messages[1]?.content ?? "";
    const beliefLine = pristineUser.split("\n").find((l) => l.includes('"proposition_label"')) ?? "";
    const row = {
      subject_state_side_contains_the_canonical_wording: user.includes(D1_PROPOSITION_LABEL),
      subject_state_side_belief_line_carries_the_canonical_wording: beliefLine.includes(D1_PROPOSITION_LABEL),
      subject_state_side_belief_line_carries_the_arm_credence: beliefLine.includes(`"credence":${world(level).credence}`),
      measurement_side_uses_only_the_frozen_paraphrase: countOccurrences(contractText, D2A1_PARAPHRASE) === 1,
      canonical_wording_is_NOT_copied_into_the_measurement_contract: !contractText.includes(D1_PROPOSITION_LABEL),
      paraphrase_is_NOT_written_into_the_canonical_belief_state: !pristineUser.includes(D2A1_PARAPHRASE),
      measurement_contract_offers_no_numeric_to_token_lookup_hint:
        !/\b0\.\d/.test(contractText) && !/credence/i.test(contractText),
      no_arm_labels_in_the_measurement_contract: ARM_WORDS.every((w) => countToken(contractText, w) === 0),
      no_expected_token_written_into_the_stimulus:
        !pristineUser.includes("SUPPORTS_PARAPHRASED") && !pristineUser.includes("OPPOSES_PARAPHRASED") && !pristineUser.includes("UNCERTAIN_ABOUT_PARAPHRASED"),
      canonical_wording_and_paraphrase_share_no_4gram: ngrams(D1_PROPOSITION_LABEL, 4).filter((g) => ngrams(D2A1_PARAPHRASE, 4).includes(g)).length === 0,
      canonical_wording_4gram_overlap_with_the_contract_is_zero:
        ngrams(D1_PROPOSITION_LABEL, 4).filter((g) => ngrams(contractText, 4).includes(g)).length === 0,
      structure_is_canonical_wording_then_different_wording:
        user.includes(D1_PROPOSITION_LABEL) && contractText.includes(D2A1_PARAPHRASE) && !contractText.includes(D1_PROPOSITION_LABEL)
    };
    if (Object.values(row).some((v) => v !== true)) structureOk = false;
    structure[level] = {
      ...row,
      // Informational, deliberately OUTSIDE the boolean predicate: a numeric field in a
      // "every value must be true" row would fail the audit on a passing request.
      canonical_wording_4gram_overlap_with_the_contract_count: ngrams(D1_PROPOSITION_LABEL, 4).filter((g) =>
        ngrams(contractText, 4).includes(g)
      ).length,
      contract_text_bytes: contractText.length,
      subject_data_bytes: user.length
    };
  }
  if (!structureOk) fail("D2_A1_SEMANTIC_STRUCTURE_AUDIT_FAILED", JSON.stringify(structure));
  await write("semantic-structure-audit.json", {
    requirement:
      "canonical wording in the subject state -> different preregistered wording in the measurement contract; NOT the qualification shape of same wording -> same wording",
    per_arm: structure,
    verdict: "D2_A1_SEMANTIC_STRUCTURE_HOLDS"
  });

  // ---- 6. cross-arm model-facing isolation, frozen normalisation only --------------------------
  const normalise = (request: ModelTransportRequestV0): { text: string; replacements: [number, number] } => {
    const result = normalizeArmSpecificBytes(request);
    if (!result.ok) fail("D2_A1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", "the frozen normalisation did not find exactly one credence and one projection hash");
    return {
      text: canonicalJsonString({
        system: request.messages[0]?.content ?? "",
        user: result.normalized_user_content,
        schema: canonicalJsonString(request.structured_output?.schema ?? {})
      }),
      replacements: [result.credence_replacements, result.projection_hash_replacements]
    };
  };
  const normalisedForms: Record<string, { hash: string; bytes: number; replacements: [number, number] }> = {};
  const rawLineDiffs: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const request = finals.get(level) as ModelTransportRequestV0;
    const norm = normalise(request);
    normalisedForms[level] = {
      hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { normalised: norm.text })),
      bytes: norm.text.length,
      replacements: norm.replacements
    };
  }
  for (const [a, b] of pairs) {
    const sysA = (finals.get(a) as ModelTransportRequestV0).messages[0]?.content ?? "";
    const sysB = (finals.get(b) as ModelTransportRequestV0).messages[0]?.content ?? "";
    const userA = (finals.get(a) as ModelTransportRequestV0).messages[1]?.content ?? "";
    const userB = (finals.get(b) as ModelTransportRequestV0).messages[1]?.content ?? "";
    const diff = (x: string, y: string): unknown[] => {
      const xl = x.split("\n");
      const yl = y.split("\n");
      const out: unknown[] = [];
      for (let i = 0; i < Math.max(xl.length, yl.length); i += 1) if (xl[i] !== yl[i]) out.push({ line: i, first: xl[i] ?? null, second: yl[i] ?? null });
      return out;
    };
    rawLineDiffs[`${a}_vs_${b}`] = { system_lines: diff(sysA, sysB), user_lines: diff(userA, userB) };
  }
  const distinctNormalised = new Set(Object.values(normalisedForms).map((v) => v.hash));
  const isolationHolds = distinctNormalised.size === 1;
  await write("request-isolation-report.json", {
    normalisation_used: "D1 REVISION 3 normalizeArmSpecificBytes — the two already-frozen classes only",
    new_normalisation_exception_added: false,
    per_arm_normalised: normalisedForms,
    raw_model_facing_differences: rawLineDiffs,
    distinct_normalised_forms: distinctNormalised.size,
    normalize_HIGH_equals_normalize_NEUTRAL_equals_normalize_LOW: isolationHolds,
    verdict: isolationHolds ? "D2_A1_CROSS_ARM_REQUEST_ISOLATION_HOLDS" : "D2_A1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE"
  });
  if (!isolationHolds) fail("D2_A1_BLOCKED_BY_REQUEST_ISOLATION_FAILURE", JSON.stringify(normalisedForms));

  // ---- 7. freeze the request set ---------------------------------------------------------------
  const finalHash: Record<Level, string> = {} as Record<Level, string>;
  for (const level of LEVELS) {
    const request = finals.get(level) as ModelTransportRequestV0;
    finalHash[level] = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    await write(`final-${level.toLowerCase()}.json`, {
      level,
      credence: world(level).credence,
      pristine_request_hash: pristineHash[level],
      final_request_hash: finalHash[level],
      request
    });
  }
  const manifestHash = await write("A1_CHARACTEROS_REQUEST_SET_MANIFEST.json", {
    stage: "D2_A1",
    high_final_request_hash: finalHash["HIGH"],
    neutral_final_request_hash: finalHash["NEUTRAL"],
    low_final_request_hash: finalHash["LOW"],
    pristine_request_hashes: pristineHash,
    state_hashes: stateHash,
    context_binding_identity: {
      source: "REV1.1d D2A1_PRODUCTION_CONTEXT_BINDING",
      subject_id: D1_SUBJECT_ID,
      observation_id: world("HIGH").observation_id,
      observation_probe_id: D1_P1.probe_id,
      task: null,
      revision_1_1d_manifest_hash: rev11d.manifest_hash
    },
    transformer_source_hash: sourceHash,
    a1_contract_hash: rev11c.contract_text_hash,
    paraphrase_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { paraphrase: D2A1_PARAPHRASE })),
    anchor_or_fixture_manifest_hash: rev11c.fixture_manifest_hash,
    normalisation_identity: {
      function: "D1 REVISION 3 normalizeArmSpecificBytes",
      classes: 2,
      normalised_forms_distinct: distinctNormalised.size
    },
    a1_characteros_outputs_seen_before_request_freeze: false,
    scheduled_high_low_replicates: "not yet known",
    reason_replicates_unknown: "waiting for the A1 neutral self-noise pilot",
    a1_token_vocabulary: D2A1_TOKENS,
    requests_may_no_longer_be_modified: true
  });

  process.stdout.write(
    `D2_A1_STATE_REQUEST_SET_FROZEN\n${JSON.stringify({ finalHash, pristineHash, manifestHash, isolation: "HOLDS", structure: "HOLDS" }, null, 2)}\n`
  );
}

await main();
