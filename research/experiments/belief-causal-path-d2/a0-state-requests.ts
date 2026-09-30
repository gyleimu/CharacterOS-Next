/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A0 — MATERIALISE THE THREE CHARACTEROS STATES AND FREEZE THE THREE REQUESTS. OFFLINE, 0 CALLS.
 *
 *   node research/experiments/belief-causal-path-d2/a0-state-requests.ts <outdir>
 *
 * Nothing here is authored at runtime. Every literal byte of the stimulus comes from an artifact
 * frozen BEFORE this round:
 *   - the canonical CAUTION proposition label                -> D1 contract.ts (D1 frozen, sealed)
 *   - the P1 observation text and its observation id         -> D1 contract.ts / D1 world-a1.ts
 *   - credences 0.80 / 0.50 / 0.20                           -> D1_STATE_LEVELS / D2A_STATES
 *   - the world construction path                            -> production genesis + facade (D1 world-a1.ts)
 *   - the system prompt, user content and V8 schema          -> production provider V8
 *   - the measurement contract and schema                    -> REV1.1b A0 transformer contract
 * This file chooses nothing and writes no stimulus; it only composes those frozen parts.
 */

import { mkdir, writeFile } from "node:fs/promises";
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

import { D2A0_CONTRACT_TEXT, D2A0_JSON_SCHEMA, deriveD2Rev11bManifestV0 } from "./contract-rev1-1b-a0-fixtures.ts";
import { D2_HASH_PROJECTION_V0, D2_BUDGET_REV1, D2A0_PREDICTION, D2_NOISE_RULE } from "./contract-rev1.ts";
import { DP_V2_MARKER, buildD2StructuralReadoutRequestV0 } from "./transformer-a0.ts";
import {
  D1_P1,
  D1_PROPOSITION_LABEL,
  D1_STATE_LEVELS
} from "../belief-state-sensitivity-d1/contract.ts";
import { normalizeArmSpecificBytes } from "../belief-state-sensitivity-d1/revision-3.ts";
import {
  D1_SUBJECT_ID,
  buildArmWorldV0,
  diffPathsOf
} from "../belief-state-sensitivity-d1/world-a1.ts";
import { buildProjectionV0 } from "../belief-state-sensitivity-d1/state-construction.ts";

const LEVELS = ["HIGH", "LOW", "NEUTRAL"] as const;
type Level = (typeof LEVELS)[number];

/** FROZEN by D1 REVISION 4. No new difference class may be added. */
const REVISION_4_ALLOWED_PATHS = [
  "/beliefs/items/0/credence",
  "/trace_window/entries/0/state_hash_before",
  "/trace_window/entries/0/state_hash_after",
  "/trace_window/entries/0/trace_id"
] as const;
const TRACE_PATHS = REVISION_4_ALLOWED_PATHS.slice(1) as readonly string[];
const CREDENCE_PATH = REVISION_4_ALLOWED_PATHS[0];
/** Copied verbatim from packages/subject-core/src/trace/trace.ts:31 (not exported by production). */
const TRACE_ID_PROJECTION = "characteros-next/trace/entry-id/v1" as const;
const BOOKKEEPING_SENTINEL = "__D1_DERIVED_BOOKKEEPING__" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Sentinelises ONLY the three frozen derived trace bookkeeping paths. Never the credence. */
function sentineliseDerivedBookkeepingV0(state: SubjectStateV4): { state: SubjectStateV4; replaced: string[] } {
  const clone = JSON.parse(JSON.stringify(state)) as SubjectStateV4 & {
    trace_window: { entries: Record<string, unknown>[] };
  };
  const entry = clone.trace_window.entries[0];
  if (entry === undefined) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", "no trace entry to normalise");
  const replaced: string[] = [];
  for (const path of TRACE_PATHS) {
    const field = path.split("/").pop() ?? "";
    if (!(field in entry)) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `trace field ${field} absent`);
    entry[field] = BOOKKEEPING_SENTINEL;
    replaced.push(path);
  }
  return { state: clone as SubjectStateV4, replaced };
}

export interface A0PristineRequestV0 {
  readonly level: Level;
  readonly credence: number;
  readonly request: ModelTransportRequestV0;
  readonly request_hash: string;
  readonly system_bytes: number;
  readonly user_bytes: number;
  readonly state_hash: string;
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a0-state-requests.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1. materialise the three real CharacterOS worlds --------------------------------
  const worlds = new Map<Level, Awaited<ReturnType<typeof buildArmWorldV0>>>();
  for (const level of LEVELS) worlds.set(level, await buildArmWorldV0(level));
  const world = (level: Level): Awaited<ReturnType<typeof buildArmWorldV0>> =>
    worlds.get(level) ?? fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `world ${level} missing`);

  const expectedCredence: Record<Level, number> = {
    HIGH: D1_STATE_LEVELS.HIGH,
    LOW: D1_STATE_LEVELS.LOW,
    NEUTRAL: D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION
  };
  for (const level of LEVELS) {
    if (world(level).credence !== expectedCredence[level]) {
      fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `${level} credence ${world(level).credence}`);
    }
  }

  // ---- 2. identity parity + the state-isolation proof ----------------------------------
  const identity = {
    subject_id_constant: D1_SUBJECT_ID,
    subject_ids: LEVELS.map((l) => String((world(l).post_observation_state as unknown as { subject_id: string }).subject_id)),
    proposition_ids: LEVELS.map((l) => world(l).proposition_id),
    proposition_label: D1_PROPOSITION_LABEL,
    proposition_label_constant_across_arms: true,
    observation_ids: LEVELS.map((l) => world(l).observation_id),
    observation_refs: LEVELS.map((l) => world(l).observation_ref),
    event_counts: LEVELS.map((l) => world(l).event_count)
  };
  if (new Set(identity.subject_ids).size !== 1) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", "subject ids differ");
  if (new Set(identity.proposition_ids).size !== 1) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", "proposition ids differ");
  if (new Set(identity.observation_ids).size !== 1) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", "observation ids differ");

  const pairs: readonly (readonly [Level, Level])[] = [["HIGH", "LOW"], ["HIGH", "NEUTRAL"], ["LOW", "NEUTRAL"]];
  const stateIsolation: Record<string, unknown> = {};
  let isolationOk = true;
  for (const [a, b] of pairs) {
    const postA = world(a).post_observation_state;
    const postB = world(b).post_observation_state;
    const rawDiff = [...diffPathsOf(postA, postB)].sort();
    const unexpectedRaw = rawDiff.filter((p) => !(REVISION_4_ALLOWED_PATHS as readonly string[]).includes(p));
    const normA = sentineliseDerivedBookkeepingV0(postA);
    const normB = sentineliseDerivedBookkeepingV0(postB);
    const normalizedDiff = [...diffPathsOf(normA.state, normB.state)].sort();
    const onlyCredence = normalizedDiff.length === 1 && normalizedDiff[0] === CREDENCE_PATH;
    if (unexpectedRaw.length > 0 || !onlyCredence) isolationOk = false;
    stateIsolation[`${a}_vs_${b}`] = {
      raw_diff_paths: rawDiff,
      raw_diff_matches_revision_4_allow_list:
        canonicalJsonString(rawDiff) === canonicalJsonString([...REVISION_4_ALLOWED_PATHS].sort()),
      unexpected_raw_paths_outside_the_frozen_allow_list: unexpectedRaw,
      sentinelised_paths: normA.replaced,
      normalized_diff_paths: normalizedDiff,
      normalized_diff_is_exactly_the_credence: onlyCredence,
      non_belief_non_trace_state_bytes_identical: onlyCredence && unexpectedRaw.length === 0
    };
  }
  if (!stateIsolationOk(stateIsolation)) isolationOk = false;
  if (!isolationOk) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", JSON.stringify(stateIsolation));

  // ---- 3. the trace bookkeeping recompute proof (derivation, not decoration) -----------
  const bookkeepingProof: Record<string, unknown> = {};
  let proofOk = true;
  for (const level of LEVELS) {
    const w = world(level);
    const entry = (w.post_observation_state.trace_window as unknown as { entries: Record<string, unknown>[] }).entries[0];
    if (entry === undefined) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `${level}: no trace entry`);
    const recomputedAfter = String(await stateHashAnyVersion(w.post_observation_state as never));
    const recomputedBefore = String(await stateHashAnyVersion(w.pre_observation_state as never));
    const body: Record<string, unknown> = { ...entry };
    delete body["trace_id"];
    const recomputedTraceId = String(await deriveRef("trace", TRACE_ID_PROJECTION, body));
    const afterMatches = recomputedAfter === String(entry["state_hash_after"]);
    const beforeMatches = recomputedBefore === String(entry["state_hash_before"]);
    const traceMatches = recomputedTraceId === String(entry["trace_id"]);
    if (!afterMatches || !beforeMatches || !traceMatches) proofOk = false;
    bookkeepingProof[level] = {
      recorded_state_hash_before: String(entry["state_hash_before"]),
      recomputed_state_hash_before: recomputedBefore,
      state_hash_before_matches: beforeMatches,
      recorded_state_hash_after: String(entry["state_hash_after"]),
      recomputed_state_hash_after: recomputedAfter,
      state_hash_after_matches: afterMatches,
      recorded_trace_id: String(entry["trace_id"]),
      recomputed_trace_id: recomputedTraceId,
      trace_id_matches: traceMatches
    };
  }
  if (!proofOk) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `trace bookkeeping not reproducible: ${JSON.stringify(bookkeepingProof)}`);

  // ---- 4. pristine production requests (no research contract of any kind) --------------
  const pristines = new Map<Level, A0PristineRequestV0>();
  for (const level of LEVELS) {
    const projection = await buildProjectionV0(world(level).post_observation_state);
    const request = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
        Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
      ]),
      structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
    }) as unknown as ModelTransportRequestV0;
    const user = request.messages.find((m) => m.role === "user")?.content ?? "";
    const system = request.messages.find((m) => m.role === "system")?.content ?? "";
    for (const [tag, text] of [["system", system], ["user", user]] as const) {
      if (text.includes(D2A0_CONTRACT_TEXT)) fail("D2_A0_STATE_REQUEST_NOT_PRISTINE", `${level} ${tag} already carries the A0 contract`);
      if (text.includes(DP_V2_MARKER)) fail("D2_A0_STATE_REQUEST_NOT_PRISTINE", `${level} ${tag} carries a DecisionProbeV2 contract`);
      if (text.includes("0.95") || text.includes("0.49") || text.includes("0.06")) {
        fail("D2_A0_QUALIFICATION_FIXTURE_LEAKAGE", `${level} ${tag}`);
      }
    }
    pristines.set(level, {
      level,
      credence: world(level).credence,
      request,
      request_hash: String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown)),
      system_bytes: system.length,
      user_bytes: user.length,
      state_hash: String(await stateHashAnyVersion(world(level).post_observation_state as never))
    });
  }

  // ---- 5. apply the frozen A0 transformer exactly once ---------------------------------
  const finals = new Map<Level, ModelTransportRequestV0>();
  const transformerReport: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const pristine = pristines.get(level) as A0PristineRequestV0;
    const transformed = buildD2StructuralReadoutRequestV0(pristine.request);
    const sys = transformed.messages.find((m) => m.role === "system")?.content ?? "";
    const pristineSys = pristine.request.messages.find((m) => m.role === "system")?.content ?? "";
    const checks = {
      a0_contract_appended_exactly_once: sys.split(D2A0_CONTRACT_TEXT).length - 1 === 1,
      production_prefix_byte_identical: sys.slice(0, sys.length - D2A0_CONTRACT_TEXT.length) === pristineSys,
      a0_schema_exactly_once:
        canonicalJsonString(transformed.structured_output?.schema ?? {}) === canonicalJsonString(D2A0_JSON_SCHEMA),
      user_content_untouched:
        (transformed.messages.find((m) => m.role === "user")?.content ?? "") ===
        (pristine.request.messages.find((m) => m.role === "user")?.content ?? ""),
      decision_probe_v2_absent: !sys.includes(DP_V2_MARKER),
      a1_transformer_absent: !sys.includes("D2A1_CONTRACT") && !sys.includes("PARAPHRASE READOUT CONTRACT"),
      b_transformer_absent: !sys.includes("D2B_CONTRACT") && !sys.includes("APPRAISAL READOUT CONTRACT"),
      no_transformer_on_transformer: true
    };
    if (Object.values(checks).some((v) => v !== true)) {
      fail("D2_A0_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT", `${level}: ${JSON.stringify(checks)}`);
    }
    let secondApplicationRejected = false;
    try {
      buildD2StructuralReadoutRequestV0(transformed);
    } catch {
      secondApplicationRejected = true;
    }
    if (!secondApplicationRejected) fail("D2_A0_TRANSFORMER_ON_TRANSFORMER_NOT_REJECTED", level);
    transformerReport[level] = { ...checks, second_application_rejected: secondApplicationRejected };
    finals.set(level, transformed);
  }

  // ---- 6. cross-arm request isolation, using ONLY the frozen normalisation --------------
  const normalizeOf = (request: ModelTransportRequestV0): { normalized: string; result: ReturnType<typeof normalizeArmSpecificBytes> } => {
    const result = normalizeArmSpecificBytes(request);
    if (!result.ok) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", "frozen normalisation did not find exactly one credence and one projection hash");
    const system = request.messages.find((m) => m.role === "system")?.content ?? "";
    const schema = canonicalJsonString(request.structured_output?.schema ?? {});
    return { normalized: canonicalJsonString({ system, user: result.normalized_user_content, schema }), result };
  };
  const isolation: Record<string, unknown> = {};
  const normalizedText = new Map<Level, string>();
  for (const level of LEVELS) {
    const { normalized, result } = normalizeOf(finals.get(level) as ModelTransportRequestV0);
    normalizedText.set(level, normalized);
    isolation[`normalized_${level}`] = {
      credence_replacements: result.credence_replacements,
      projection_hash_replacements: result.projection_hash_replacements,
      normalized_bytes: normalized.length,
      normalized_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { normalized }))
    };
  }
  const distinctNormalized = new Set([...normalizedText.values()]);
  const pairsIdentical = distinctNormalized.size === 1;
  // Raw (unnormalised) diffs, recorded for the audit trail.
  const rawLineDiff = (a: string, b: string): unknown => {
    const al = a.split("\n");
    const bl = b.split("\n");
    const out: unknown[] = [];
    const n = Math.max(al.length, bl.length);
    for (let i = 0; i < n; i += 1) {
      if (al[i] !== bl[i]) out.push({ line: i, high_or_first: al[i] ?? null, low_or_second: bl[i] ?? null });
    }
    return out;
  };
  const rawReport: Record<string, unknown> = {};
  for (const [a, b] of pairs) {
    const ra = finals.get(a) as ModelTransportRequestV0;
    const rb = finals.get(b) as ModelTransportRequestV0;
    rawReport[`${a}_vs_${b}_system_lines`] = rawLineDiff(
      ra.messages.find((m) => m.role === "system")?.content ?? "",
      rb.messages.find((m) => m.role === "system")?.content ?? ""
    );
    rawReport[`${a}_vs_${b}_user_lines`] = rawLineDiff(
      ra.messages.find((m) => m.role === "user")?.content ?? "",
      rb.messages.find((m) => m.role === "user")?.content ?? ""
    );
  }
  if (!pairsIdentical) fail("D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE", `normalized requests differ: ${JSON.stringify(rawReport)}`);

  const requestIsolation = {
    normalisation_used: "D1 REVISION 3 `normalizeArmSpecificBytes` — the two already-frozen classes only",
    normalisation_classes: [
      "the frozen proposition's credence value inside the canonical belief projection line",
      "the whole `[projection_hash]` value"
    ],
    new_normalisation_exceptions_added: false,
    raw_model_facing_differences_before_normalisation: rawReport,
    normalized: isolation,
    distinct_normalized_forms: distinctNormalized.size,
    normalize_HIGH_equals_normalize_LOW_equals_normalize_NEUTRAL: pairsIdentical,
    verdict: pairsIdentical ? "D2_A0_CROSS_ARM_REQUEST_ISOLATION_HOLDS" : "D2_A0_BLOCKED_BY_STATE_ISOLATION_FAILURE"
  };

  // ---- 7. write every artifact, then the manifest --------------------------------------
  const rev11b = await deriveD2Rev11bManifestV0();
  const stateHashes: Record<string, string> = {};
  const preStateHashes: Record<string, string> = {};
  for (const level of LEVELS) {
    stateHashes[level] = String(await stateHashAnyVersion(world(level).post_observation_state as never));
    preStateHashes[level] = String(await stateHashAnyVersion(world(level).pre_observation_state as never));
  }
  await write("state-manifest.json", {
    levels: LEVELS,
    expected_credences: expectedCredence,
    actual_credences: Object.fromEntries(LEVELS.map((l) => [l, world(l).credence])),
    identity_parity: identity,
    state_hashes: stateHashes,
    pre_observation_state_hashes: preStateHashes,
    commit_transition_ids: Object.fromEntries(LEVELS.map((l) => [l, world(l).commit_transition_id])),
    frozen_context_provenance: {
      canonical_proposition_label: D1_PROPOSITION_LABEL,
      observation_probe_id: D1_P1.probe_id,
      observation_id: world("HIGH").observation_id,
      observation_text: D1_P1.observation_text,
      task: null,
      scene_source: "the observation commit's own scene (D1 world-a1.ts:160) — not written here",
      state_construction_path: "production genesis materialisation + production facade observation commit (D1 frozen)",
      projection_path: "buildCognitiveContextProjectionV2ForExplicitV4 (production)",
      instrument: "buildD2StructuralReadoutRequestV0 (REV1.1b frozen contract)",
      authored_in_this_round: false,
      section_3_determination:
        "A0 binds NO probe family: `probe_family` appears only in the D2-B laws, and D2A_INSTRUMENT_LAWS.same_projection_path freezes the A0 stimulus as the unmodified production projection. Every literal byte of the stimulus therefore comes from an artifact frozen before this round; the round composes, it does not author. D2_A0_STATE_REQUEST_NOT_FULLY_PREREGISTERED is NOT emitted."
    }
  });
  await write("state-isolation-report.json", {
    allowed_difference_classes: REVISION_4_ALLOWED_PATHS,
    source_of_the_allow_list: "D1 REVISION 4 (frozen before D1's treatment)",
    new_allowed_difference_classes_added: false,
    per_pair: stateIsolation,
    trace_bookkeeping_derivation_proof: bookkeepingProof,
    trace_bookkeeping_is_derived_not_assumed: proofOk,
    verdict: "D2_A0_STATE_ISOLATION_HOLDS"
  });
  const fileOf: Record<Level, [string, string]> = {
    HIGH: ["pristine-high.json", "final-high.json"],
    LOW: ["pristine-low.json", "final-low.json"],
    NEUTRAL: ["pristine-neutral.json", "final-neutral.json"]
  };
  for (const level of LEVELS) {
    const pristine = pristines.get(level) as A0PristineRequestV0;
    const [pristineName, finalName] = fileOf[level];
    await write(pristineName, { ...pristine, state_hash: pristine.state_hash });
    const finalRequest = finals.get(level) as ModelTransportRequestV0;
    await write(finalName, {
      level,
      credence: pristine.credence,
      pristine_request_hash: pristine.request_hash,
      final_request_hash: String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", finalRequest as unknown)),
      request: finalRequest
    });
  }
  const finalHashes = Object.fromEntries(
    await Promise.all(
      LEVELS.map(async (l) => [
        l,
        String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", finals.get(l) as ModelTransportRequestV0))
      ])
    )
  );
  await write("transformer-application-report.json", transformerReport);
  await write("request-isolation-report.json", requestIsolation);
  const manifestHash = await write("A0_CHARACTEROS_REQUEST_SET_MANIFEST.json", {
    stage: "D2_A0",
    source_of_the_three_requests: "production V8 requests over the three real CharacterOS arm states",
    high_request_hash: finalHashes["HIGH"],
    low_request_hash: finalHashes["LOW"],
    neutral_request_hash: finalHashes["NEUTRAL"],
    a0_contract_hash: rev11b.contract_text_hash,
    a0_schema_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { schema: D2A0_JSON_SCHEMA })),
    fixture_manifest_hash: rev11b.fixture_manifest_hash,
    protocol_revision_chain: [
      "belief-causal-path-localization-d2",
      "belief-causal-path-localization-d2-rev1",
      "belief-causal-path-localization-d2-rev1.1",
      "belief-causal-path-localization-d2-rev1.1a",
      "belief-causal-path-localization-d2-rev1.1b"
    ],
    state_hashes: Object.fromEntries(LEVELS.map((l) => [l, pristines.get(l)?.state_hash])),
    prediction_frozen_here: D2A0_PREDICTION,
    noise_rule_frozen_here: D2_NOISE_RULE,
    budget_frozen_here: D2_BUDGET_REV1,
    a0_characteros_outputs_seen_before_request_freeze: false,
    qualification_fixture_bytes_used: false,
    qualification_credences_used: false,
    scheduled_high_low_replicates: "not yet known",
    reason_replicates_unknown: "waiting for neutral self-noise pilot",
    requests_may_no_longer_be_modified: true
  });

  process.stdout.write(`D2_A0_STATE_REQUEST_SET_FROZEN\n${JSON.stringify({ finalHashes, manifest_hash: manifestHash, isolation: requestIsolation.verdict }, null, 2)}\n`);
}

/** Small helper kept separate so the isolation gate reads as one predicate. */
function stateIsolationOk(report: Record<string, unknown>): boolean {
  return Object.values(report).every((entry) => {
    const row = entry as { normalized_diff_is_exactly_the_credence?: boolean; unexpected_raw_paths_outside_the_frozen_allow_list?: unknown[] };
    return row.normalized_diff_is_exactly_the_credence === true && (row.unexpected_raw_paths_outside_the_frozen_allow_list ?? []).length === 0;
  });
}

await main();
