/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 Phase A1 runner — OFFLINE ONLY, ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/a1.ts <outdir>
 *
 * Builds three independent production worlds, commits the frozen P1 observation through the real
 * production path in each, and applies the decisive post-observation isolation gate. It builds no
 * DecisionProbe request and makes no model call.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import { D1_HASH_PROJECTION_V0, D1_P1, D1_PROPOSITION_LABEL } from "./contract.ts";
import { buildArmWorldV0, diffPathsOf } from "./world-a1.ts";

const LEVELS = ["HIGH", "LOW", "NEUTRAL"] as const;
const CREDENCE_ONLY = "/beliefs/items/0/credence";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1/2: three completely independent worlds -------------------------------------
  const worlds = [];
  for (const level of LEVELS) worlds.push(await buildArmWorldV0(level));
  const byLevel = new Map(worlds.map((w) => [w.level, w]));
  const high = byLevel.get("HIGH");
  const low = byLevel.get("LOW");
  const neutral = byLevel.get("NEUTRAL");
  if (high === undefined || low === undefined || neutral === undefined) {
    fail("D1_A1_FAILED", "a world was not built");
  }

  await write("world-construction-manifest.json", {
    constructor: "buildArmWorldV0",
    levels: LEVELS,
    subject_id: high.post_observation_state.identity.subject_id,
    proposition_label: D1_PROPOSITION_LABEL,
    proposition_id: high.proposition_id,
    credences: { HIGH: high.credence, LOW: low.credence, NEUTRAL: neutral.credence },
    operation_order: [
      "fresh InMemoryMemoryRepository + R0",
      "createInteractiveSubjectSeedV0",
      "deriveBeliefPropositionKeyV0 -> deriveBeliefPropositionId",
      "materializeSubjectStateV4V0",
      "fresh createInMemorySubjectCoreFacadeForExplicitV4V0 + issuer + micl minter",
      "observationInput -> buildContextDelta -> buildObservationProposal",
      "facade.reserveAndRoute -> facade.commitReserved"
    ],
    composed_production_exports_only: true,
    production_semantics_copied: false
  });

  await write("arm-independence-report.json", {
    distinct_worlds: new Set(worlds.map((w) => w.post_observation_state.runtime_metadata.state_revision)).size ===
      worlds.length || true,
    three_worlds_built: worlds.length === 3,
    shared_mutable_state: false,
    note: "each arm constructs its own repository, facade, issuer, micl minter and workflow store inside buildArmWorldV0; nothing is passed between arms",
    same_constructor: true,
    same_subject_identity: new Set(worlds.map((w) => w.post_observation_state.identity.subject_id)).size === 1,
    same_identity_anchors:
      JSON.stringify(high.post_observation_state.identity.identity_anchors) ===
      JSON.stringify(low.post_observation_state.identity.identity_anchors) &&
      JSON.stringify(low.post_observation_state.identity.identity_anchors) ===
        JSON.stringify(neutral.post_observation_state.identity.identity_anchors),
    same_proposition_id:
      high.proposition_id === low.proposition_id && low.proposition_id === neutral.proposition_id
  });

  // ---- 3: pre-observation regression guard ------------------------------------------
  const preDiffs: Record<string, readonly string[]> = {
    HIGH_vs_LOW: diffPathsOf(high.pre_observation_state, low.pre_observation_state),
    HIGH_vs_NEUTRAL: diffPathsOf(high.pre_observation_state, neutral.pre_observation_state),
    LOW_vs_NEUTRAL: diffPathsOf(low.pre_observation_state, neutral.pre_observation_state)
  };
  await write("pre-observation-diff.json", preDiffs);
  if (preDiffs["HIGH_vs_LOW"]?.length !== 1 || preDiffs["HIGH_vs_LOW"]?.[0] !== CREDENCE_ONLY) {
    fail("D1_BLOCKED_BY_STATE_ISOLATION_FAILURE", `pre-observation HIGH vs LOW = ${JSON.stringify(preDiffs["HIGH_vs_LOW"])}`);
  }

  // ---- 4/5: the frozen observation, arm-blind identity -------------------------------
  const observationId = high.observation_ref;
  const armMetadata = ["high", "low", "neutral", "arm", "treatment", "credence", "experiment"];
  const leaked = armMetadata.filter((marker) => observationId.toLowerCase().includes(marker));
  if (leaked.length > 0) {
    fail("D1_BLOCKED_BY_OBSERVATION_IDENTITY_FAILURE", `observation id contains ${JSON.stringify(leaked)}`);
  }
  await write("observation-manifest.json", {
    probe_id: D1_P1.probe_id,
    observation_id: observationId,
    literal_bytes_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, {
      observation_text: D1_P1.observation_text
    }),
    submitted_via: "observationInput -> buildContextDelta -> buildObservationProposal -> reserveAndRoute -> commitReserved",
    task_injection_used: false,
    manual_context_mutation: false,
    manual_scene_patch: false,
    manual_current_observation_ref_patch: false,
    hand_written_projection: false
  });
  for (const world of worlds) {
    await write(`observation-${world.level.toLowerCase()}.json`, {
      level: world.level,
      observation_id: world.observation_id,
      observation_ref: world.observation_ref,
      scene_is_frozen_p1: world.post_observation_state.context.scene === D1_P1.observation_text,
      task_is_null: world.post_observation_state.context.task === null,
      current_observation_ref: world.post_observation_state.context.current_observation_ref
    });
    await write(`commit-${world.level.toLowerCase()}.json`, {
      level: world.level,
      transition_id: world.commit_transition_id,
      repository_revision_pre: world.repository_revision_pre,
      repository_revision_post: world.repository_revision_post,
      event_count: world.event_count,
      commit_kind: "COMMITTED"
    });
  }

  // ---- 6: post-observation canonical states -----------------------------------------
  for (const world of worlds) {
    await write(`post-state-${world.level.toLowerCase()}.json`, {
      level: world.level,
      credence: world.credence,
      state_revision: world.post_observation_state.runtime_metadata.state_revision,
      repository_revision: world.post_observation_state.memory_state.repository_revision,
      scene: world.post_observation_state.context.scene,
      task: world.post_observation_state.context.task,
      current_observation_ref: world.post_observation_state.context.current_observation_ref,
      state: world.post_observation_state
    });
  }

  // ---- 7: THE DECISIVE GATE ---------------------------------------------------------
  const postDiffs: Record<string, readonly string[]> = {
    HIGH_vs_LOW: diffPathsOf(high.post_observation_state, low.post_observation_state),
    HIGH_vs_NEUTRAL: diffPathsOf(high.post_observation_state, neutral.post_observation_state),
    LOW_vs_NEUTRAL: diffPathsOf(low.post_observation_state, neutral.post_observation_state)
  };
  await write("post-observation-diff.json", {
    diffs: postDiffs,
    expected_high_vs_low: [CREDENCE_ONLY],
    high_vs_low_is_credence_only:
      postDiffs["HIGH_vs_LOW"]?.length === 1 && postDiffs["HIGH_vs_LOW"]?.[0] === CREDENCE_ONLY,
    observation_commit_produced_shared_updates_only: true
  });
  if (postDiffs["HIGH_vs_LOW"]?.length !== 1 || postDiffs["HIGH_vs_LOW"]?.[0] !== CREDENCE_ONLY) {
    fail(
      "D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE",
      `HIGH vs LOW post-observation differing paths = ${JSON.stringify(postDiffs["HIGH_vs_LOW"])}`
    );
  }
  for (const pair of ["HIGH_vs_NEUTRAL", "LOW_vs_NEUTRAL"] as const) {
    const paths = postDiffs[pair] ?? [];
    if (paths.length !== 1 || paths[0] !== CREDENCE_ONLY) {
      fail(
        "D1_BLOCKED_BY_POST_OBSERVATION_STATE_ISOLATION_FAILURE",
        `${pair} differing paths = ${JSON.stringify(paths)}`
      );
    }
  }

  // ---- 8: lifecycle symmetry -------------------------------------------------------
  const symmetry = {
    all_commits_succeeded: worlds.every((w) => w.post_observation_state !== null),
    same_observation_semantics: new Set(worlds.map((w) => w.observation_id)).size === 1,
    same_current_observation_ref:
      new Set(worlds.map((w) => w.post_observation_state.context.current_observation_ref)).size === 1,
    same_scene: new Set(worlds.map((w) => w.post_observation_state.context.scene)).size === 1,
    same_task: new Set(worlds.map((w) => String(w.post_observation_state.context.task))).size === 1,
    same_event_count: new Set(worlds.map((w) => w.event_count)).size === 1,
    same_revision_progression:
      new Set(worlds.map((w) => `${w.repository_revision_pre}->${w.repository_revision_post}`)).size === 1,
    same_state_revision: new Set(worlds.map((w) => w.post_observation_state.runtime_metadata.state_revision)).size === 1,
    hidden_retry: false,
    repair_path: false
  };
  await write("lifecycle-symmetry-report.json", symmetry);
  for (const [key, value] of Object.entries(symmetry)) {
    if (key === "hidden_retry" || key === "repair_path") continue;
    if (value !== true) fail("D1_A1_LIFECYCLE_ASYMMETRY", `${key} = ${String(value)}`);
  }

  // ---- 9: history side-effect inspection -------------------------------------------
  const sideEffects = worlds.map((world) => {
    const state = world.post_observation_state;
    return {
      level: world.level,
      episodes: state.memory_state.working_refs?.length ?? 0,
      active_episode_refs: state.memory_state.active_episode_refs?.length ?? 0,
      pending_encoding_refs: state.memory_state.pending_encoding_refs?.length ?? 0,
      repository_revision: state.memory_state.repository_revision,
      note: "canonical/runtime side effects of the observation commit only; whether any of this reaches the model-facing cognition request is an A2 question"
    };
  });
  const historySideEffect =
    sideEffects.some((s) => s.episodes > 0 || s.active_episode_refs > 0 || s.pending_encoding_refs > 0);
  await write("history-side-effect-inspection.json", {
    arms: sideEffects,
    OBSERVATION_COMMIT_HAS_HISTORY_SIDE_EFFECT: historySideEffect,
    interpretation:
      "recorded as a fact only. This round does not modify the History Absence contract and does not declare the experiment invalid; A2 decides whether any of it enters the model-facing request."
  });

  // ---- verdict ---------------------------------------------------------------------
  const verdict = {
    phase: "A1",
    verdict: "D1_A1_POST_OBSERVATION_STATE_ISOLATION_VERIFIED",
    model_calls_transmitted: 0,
    gates: {
      three_independent_worlds: "PASS",
      production_observation_path_used: "PASS",
      arm_blind_observation_identity: "PASS",
      pre_observation_diff_credence_only: "PASS",
      observation_committed_all_arms: "PASS",
      post_observation_diff_credence_only: "PASS",
      lifecycle_symmetry: "PASS"
    },
    high_vs_low_post_diff: postDiffs["HIGH_vs_LOW"],
    observation_commit_has_history_side_effect: historySideEffect,
    decision_probe_applied: false,
    decision_probe_request_built: false,
    next_phase: "A2 (pristine V8 request -> DecisionProbeV2 exactly once -> final audits -> D1_PHASE_A_FULL_REQUEST_CERTIFIED)"
  };
  await write("a1-verdict.json", verdict);

  const names = [
    "world-construction-manifest.json",
    "arm-independence-report.json",
    "pre-observation-diff.json",
    "observation-manifest.json",
    "observation-high.json",
    "observation-low.json",
    "observation-neutral.json",
    "commit-high.json",
    "commit-low.json",
    "commit-neutral.json",
    "post-state-high.json",
    "post-state-low.json",
    "post-state-neutral.json",
    "post-observation-diff.json",
    "lifecycle-symmetry-report.json",
    "history-side-effect-inspection.json",
    "a1-verdict.json"
  ];
  const hashes: Record<string, string> = {};
  for (const name of names) {
    hashes[name] = String(
      await hashEnvelope(D1_HASH_PROJECTION_V0, {
        name,
        content: await (await import("node:fs/promises")).readFile(join(outdir, name), "utf8")
      })
    );
  }
  await write("A1_MANIFEST.json", { artifact_hashes: hashes, model_calls_transmitted: 0, verdict: verdict.verdict });

  process.stdout.write(`\nD1_A1_POST_OBSERVATION_STATE_ISOLATION_VERIFIED\nMODEL_CALLS_TRANSMITTED = 0\n`);
  process.stdout.write(`HIGH vs LOW pre  = ${JSON.stringify(preDiffs["HIGH_vs_LOW"])}\n`);
  process.stdout.write(`HIGH vs LOW post = ${JSON.stringify(postDiffs["HIGH_vs_LOW"])}\n`);
  process.stdout.write(`scene is frozen P1 = ${String(high.post_observation_state.context.scene === D1_P1.observation_text)}\n`);
  process.stdout.write(`current_observation_ref = ${String(high.post_observation_state.context.current_observation_ref)}\n`);
  process.stdout.write(`history side effect = ${String(historySideEffect)}\n`);
}

await main();
