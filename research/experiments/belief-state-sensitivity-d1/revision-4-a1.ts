/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 REVISION 4 + ATTEMPT 002 driver. OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/revision-4-a1.ts <attempt002dir>
 *
 * 1. recompute proof (§2/§3): the recorded trace bookkeeping must be reproducible from the frozen
 *    production algorithms and the ARM'S OWN states;
 * 2. freeze REVISION 4 (only if the proof passes);
 * 3. fresh A1 ATTEMPT 002 with the derived-bookkeeping normalisation;
 * 4. raw-diff gate (exact four frozen paths) then normalised gate (credence only).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  deriveRef,
  hashEnvelope,
  stateHashAnyVersion,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";

import { D1_HASH_PROJECTION_V0, D1_P1 } from "./contract.ts";
import { buildArmWorldV0, diffPathsOf } from "./world-a1.ts";

const ATTEMPT_001 = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a1-world";
const LEVELS = ["HIGH", "LOW", "NEUTRAL"] as const;
const FROZEN_PATHS = [
  "/beliefs/items/0/credence",
  "/trace_window/entries/0/state_hash_before",
  "/trace_window/entries/0/state_hash_after",
  "/trace_window/entries/0/trace_id"
] as const;
const TRACE_PATHS = FROZEN_PATHS.slice(1) as readonly string[];
const CREDENCE_PATH = FROZEN_PATHS[0];
// Copied verbatim from packages/subject-core/src/trace/trace.ts:31 (the production constant is not
// exported). Guessing this string is what made the first recompute attempt fail.
const TRACE_ID_PROJECTION = "characteros-next/trace/entry-id/v1" as const;
const SENTINEL = "__D1_DERIVED_BOOKKEEPING__" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Sentinelises ONLY the three frozen derived trace bookkeeping paths. Never the credence. */
export function normalizeDerivedBookkeepingForIsolationV0(
  state: SubjectStateV4
): { readonly normalized: SubjectStateV4; readonly replaced_paths: readonly string[] } {
  const clone = JSON.parse(JSON.stringify(state)) as SubjectStateV4 & {
    trace_window: { entries: Record<string, unknown>[] };
  };
  const entry = clone.trace_window.entries[0];
  if (entry === undefined) throw new Error("D1_R4: no trace entry to normalise");
  const replaced: string[] = [];
  for (const path of TRACE_PATHS) {
    const field = path.split("/").pop() ?? "";
    if (!(field in entry)) throw new Error(`D1_R4: trace field ${field} absent`);
    entry[field] = SENTINEL;
    replaced.push(path);
  }
  return { normalized: clone as SubjectStateV4, replaced_paths: replaced };
}

async function readJson<T>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), "utf8")) as T;
}

async function main(): Promise<void> {
  const out002 = process.argv[2];
  if (out002 === undefined) throw new Error("usage: node revision-4-a1.ts <attempt002dir>");
  const outAudit = join(ATTEMPT_001, "..", "..", "trace-causality-audit");
  await mkdir(outAudit, { recursive: true });
  await mkdir(out002, { recursive: true });
  const write = async (dir: string, name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(dir, name), content, "utf8");
    return String(await hashEnvelope(D1_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- §2/§3 RECOMPUTE PROOF ---------------------------------------------------------
  const matrix: Record<string, unknown> = {};
  let proofOk = true;
  for (const level of LEVELS) {
    const post = await readJson<{ state: SubjectStateV4 }>(ATTEMPT_001, `post-state-${level.toLowerCase()}.json`);
    const entry = (post.state.trace_window as unknown as { entries: Record<string, unknown>[] }).entries[0];
    if (entry === undefined) fail("TRACE_BOOKKEEPING_DERIVATION_NOT_PROVEN", `${level}: no entry`);

    // state_hash_before: content address of the arm's own PRE-observation state. The pre state's
    // trace window is empty (genesis); the recorded hash must reproduce it exactly.
    const recordedBefore = String(entry["state_hash_before"]);
    const recordedAfter = String(entry["state_hash_after"]);

    // The pre-observation state is not stored separately in ATTEMPT 001, so before/after are
    // proven against the POST state's own recorded pair via the acyclicity property: trace_window
    // is excluded from StateHash, so hashing the post state must reproduce state_hash_after.
    const recomputedAfter = String(await stateHashAnyVersion(post.state as never));
    const afterMatches = recomputedAfter === recordedAfter;

    // trace_id: FORWARD derivation from the entry's own non-trace_id body.
    const body: Record<string, unknown> = { ...entry };
    delete body["trace_id"];
    const recomputedTraceId = String(await deriveRef("trace", TRACE_ID_PROJECTION, body));
    const traceMatches = recomputedTraceId === String(entry["trace_id"]);

    matrix[level] = {
      recorded_state_hash_before: recordedBefore,
      recorded_state_hash_after: recordedAfter,
      recorded_trace_id: String(entry["trace_id"]),
      recomputed_state_hash_after: recomputedAfter,
      state_hash_after_matches: afterMatches,
      recomputed_trace_id: recomputedTraceId,
      trace_id_matches: traceMatches,
      entry_body_fields_other_than_trace_id: Object.keys(body).length,
      acyclicity_note:
        "`trace_window` is excluded from the StateHash input set (canonical/projections.ts:37), so state_hash_after is reproducible by hashing the post state directly"
    };
    if (!afterMatches || !traceMatches) proofOk = false;
  }
  // state_hash_before is provable the same way: it is the hash of the arm's pre state, and the
  // pre-state hash is the same value the genesis materialisation produced for that arm.
  const beforeProof: Record<string, unknown> = {};
  for (const level of LEVELS) {
    const world = await buildArmWorldV0(level);
    const recomputedBefore = String(await stateHashAnyVersion(world.pre_observation_state as never));
    const recordedBefore = String(
      ((await readJson<{ state: SubjectStateV4 }>(ATTEMPT_001, `post-state-${level.toLowerCase()}.json`)).state.trace_window as unknown as { entries: { state_hash_before: string }[] }).entries[0]?.state_hash_before
    );
    beforeProof[level] = { recorded: recordedBefore, recomputed: recomputedBefore, matches: recordedBefore === recomputedBefore };
    if (recordedBefore !== recomputedBefore) proofOk = false;
  }
  await write(outAudit, "trace-derivation-report.json", {
    projection: "characteros-next/trace/v1",
    trace_id_derivation: "deriveRef(\"trace\", TRACE_ID_PROJECTION, body) where body = the trace entry minus trace_id",
    state_hash_inputs: "the twelve top-level values defined by canonical/projections.ts:37, with trace_window EXCLUDED to avoid self-reference",
    dependency_direction: "canonical state -> stateHashAnyVersion -> buildTraceEntry -> trace_id -> nextTraceWindow",
    random_number_use: "none",
    clock_time_use: "none",
    arm_label_use: "none",
    executor_output_use: "none",
    hidden_experiment_metadata_use: "none"
  });
  await write(outAudit, "trace-recompute-report.json", { matrix, beforeProof, proof_ok: proofOk });
  if (!proofOk) fail("TRACE_BOOKKEEPING_DERIVATION_NOT_PROVEN", JSON.stringify({ matrix, beforeProof }).slice(0, 400));

  await write(outAudit, "trace-consumer-inventory.json", {
    behavioral_consumer_count: 0,
    classifications: {
      VALIDATION: [
        "packages/subject-core/src/validation/subject-state.ts:800-1020",
        "packages/subject-core/src/validation/subject-state-v4.ts:28,79",
        "packages/subject-core/src/validation/atomic-commit-bundle.ts:111,138,207,237,270-277,397",
        "packages/subject-core/src/validation/atomic-commit-bundle-shapes.ts:119,297",
        "packages/subject-core/src/validation/ownership.ts:78"
      ],
      WRITE_PATH: [
        "packages/subject-core/src/canonical/canonical-transition-effect.ts:230-231 (nextTraceWindow -> draft)",
        "packages/subject-core/src/commit/bundle.ts:149-154",
        "packages/subject-core/src/commit/bundle-v2.ts:230-234",
        "packages/subject-core/src/commit/facade.ts:603-604,775-776"
      ],
      GOVERNANCE: [
        "packages/runtime/src/authority/atomic-commit-chain-validator.ts:458-539,643",
        "packages/runtime/src/authority/restore-chain-authority-v4.ts:88-89,167-168",
        "packages/runtime/src/authority/trusted-canonical-history-boundary.ts:198-308",
        "packages/subject-core/src/restore/{restore,restore-v4,envelope}.ts"
      ],
      SERIALIZATION: [
        "packages/subject-core/src/types/{persistence,persistence-v2,subject-state,subject-state-v4,trace}.ts",
        "packages/subject-core/src/genesis/subject-state-v4-genesis.ts:133,166"
      ],
      EXPLICIT_SKIP: ["packages/runtime/src/authority/affect-application-history-validator-v0.ts:268 (continue)"],
      TEST_ONLY: ["packages/runtime/src/transitions/observation/observation-fixtures.ts:94-95"]
    },
    behavioral_consumers: []
  });
  await write(outAudit, "trace-model-facing-audit.json", {
    cognition_projection_references_to_trace_window: 0,
    production_hits_in_providers_or_cognition_action: 0,
    existing_test_asserts_absence: "packages/runtime/src/providers/cognition/llm-cognition-provider.test.ts:224 expects the projection NOT to contain trace_window",
    reaches_model_facing_messages: false,
    reaches_retrieval_query: false,
    reaches_provider_metadata: false
  });
  await write(outAudit, "trace-transition-dependency-report.json", {
    code_evidence: "canonical-transition-effect.ts:217-231",
    order: [
      "stateHashBefore = stateHashAnyVersion(cur)",
      "stateHashAfter = stateHashAnyVersion(preTraceValidation.value)  // taken BEFORE trace_window is written",
      "traceEntry = buildTraceEntry({ ...state_hash_before, ...state_hash_after })",
      "nextWindow = nextTraceWindow(cur.trace_window, traceEntry, nextRevision)",
      "draft[\"trace_window\"] = nextWindow"
    ],
    reverse_dependency_exists: false,
    acyclicity_law: "trace_window is excluded from the StateHash input set, which is what makes the cycle impossible"
  });

  // ---- §5 REVISION 4 ----------------------------------------------------------------
  const revision4Body = {
    version: "d1-belief-state-sensitivity-revision-4",
    model_calls_before_amendment: 0 as const,
    supersedes_scope: "POST_OBSERVATION_STATE_ISOLATION_GATE only",
    revision_2_hash: "sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b",
    revision_3_hash: "sha256:1781b3458fd760a73c27adb224e29e4c9d156ac60815383ac1d65e2dd298b60c",
    attempt_001_blocked_verdict: "D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE",
    retrospective_reinterpretation: false,
    allowed_paths_frozen: FROZEN_PATHS,
    wildcard_allowed: false,
    residual_difference_verdict: "D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE",
    unmodified: [
      "belief intervention",
      "HIGH/LOW/NEUTRAL",
      "observation",
      "Revision 3 request normalization",
      "probes",
      "DecisionProbe",
      "scorer",
      "thresholds",
      "noise pilot",
      "schedule",
      "history absence"
    ]
  };
  const revision4 = { ...revision4Body, amendment_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, revision4Body) };
  await write(outAudit, "revision-4-amendment.json", revision4);

  // ---- §9/§10 FRESH ATTEMPT 002 ------------------------------------------------------
  const worlds = [];
  for (const level of LEVELS) worlds.push(await buildArmWorldV0(level));
  const by = new Map(worlds.map((w) => [w.level, w]));
  const rawDiffs: Record<string, readonly string[]> = {};
  const normalizedDiffs: Record<string, readonly string[]> = {};
  const preDiffs: Record<string, readonly string[]> = {};
  for (const world of worlds) {
    await write(out002, `post-state-${world.level.toLowerCase()}.json`, {
      level: world.level,
      state_revision: world.post_observation_state.runtime_metadata.state_revision,
      state: world.post_observation_state
    });
  }
  for (const [a, b] of [["HIGH", "LOW"], ["HIGH", "NEUTRAL"], ["LOW", "NEUTRAL"]] as const) {
    const wa = by.get(a);
    const wb = by.get(b);
    if (wa === undefined || wb === undefined) fail("D1_A1_FAILED", `${a}/${b}`);
    preDiffs[`${a}_vs_${b}`] = diffPathsOf(wa.pre_observation_state, wb.pre_observation_state);
    rawDiffs[`${a}_vs_${b}`] = diffPathsOf(wa.post_observation_state, wb.post_observation_state);
    const na = normalizeDerivedBookkeepingForIsolationV0(wa.post_observation_state).normalized;
    const nb = normalizeDerivedBookkeepingForIsolationV0(wb.post_observation_state).normalized;
    normalizedDiffs[`${a}_vs_${b}`] = diffPathsOf(na, nb);
  }
  await write(out002, "pre-observation-diff.json", preDiffs);
  await write(out002, "raw-post-observation-diff.json", {
    diffs: rawDiffs,
    frozen_expected_paths: FROZEN_PATHS,
    high_vs_low_exact: rawDiffs["HIGH_vs_LOW"] !== undefined &&
      new Set(rawDiffs["HIGH_vs_LOW"]).size === 4 &&
      FROZEN_PATHS.every((p) => rawDiffs["HIGH_vs_LOW"]?.includes(p))
  });
  await write(out002, "normalized-post-observation-diff.json", {
    diffs: normalizedDiffs,
    high_vs_low_is_credence_only:
      normalizedDiffs["HIGH_vs_LOW"]?.length === 1 && normalizedDiffs["HIGH_vs_LOW"]?.[0] === CREDENCE_PATH
  });

  for (const pair of ["HIGH_vs_LOW", "HIGH_vs_NEUTRAL", "LOW_vs_NEUTRAL"] as const) {
    const raw = rawDiffs[pair] ?? [];
    if (!FROZEN_PATHS.every((p) => raw.includes(p)) || raw.length !== 4) {
      fail("D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE", `${pair} raw = ${JSON.stringify(raw)}`);
    }
    const norm = normalizedDiffs[pair] ?? [];
    if (norm.length !== 1 || norm[0] !== CREDENCE_PATH) {
      fail("D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE", `${pair} normalized = ${JSON.stringify(norm)}`);
    }
  }
  const pre = preDiffs["HIGH_vs_LOW"] ?? [];
  if (pre.length !== 1 || pre[0] !== CREDENCE_PATH) {
    fail("D1_BLOCKED_BY_STATE_ISOLATION_FAILURE", `pre HIGH vs LOW = ${JSON.stringify(pre)}`);
  }

  const verdict = {
    phase: "A1_ATTEMPT_002",
    verdict: "D1_A1_POST_OBSERVATION_STATE_ISOLATION_VERIFIED_UNDER_REVISION_4",
    model_calls_transmitted: 0,
    revision_4_hash: revision4.amendment_hash,
    trace_recompute_proof_ok: proofOk,
    raw_high_vs_low: rawDiffs["HIGH_vs_LOW"],
    normalized_high_vs_low: normalizedDiffs["HIGH_vs_LOW"],
    observation_id: worlds[0]?.observation_ref ?? null,
    scene_is_frozen_p1: worlds.every((w) => w.post_observation_state.context.scene === D1_P1.observation_text),
    decision_probe_applied: false,
    next_phase: "A2"
  };
  await write(out002, "attempt-002-verdict.json", verdict);

  process.stdout.write(`\nD1_A1_POST_OBSERVATION_STATE_ISOLATION_VERIFIED_UNDER_REVISION_4\n`);
  process.stdout.write(`MODEL_CALLS_TRANSMITTED = 0\n`);
  process.stdout.write(`REVISION 4 hash = ${revision4.amendment_hash}\n`);
  process.stdout.write(`recompute proof = ${String(proofOk)}\n`);
  process.stdout.write(`raw HIGH vs LOW = ${JSON.stringify(rawDiffs["HIGH_vs_LOW"])}\n`);
  process.stdout.write(`norm HIGH vs LOW = ${JSON.stringify(normalizedDiffs["HIGH_vs_LOW"])}\n`);
}

await main();
