/* eslint-disable no-restricted-imports -- Research harness: reuses the FROZEN manifest architecture by relative path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — preregistration freeze manifest.
 *
 * The manifest architecture is the FROZEN one: the hashed core excludes the
 * manifest hash, any wall clock, the current HEAD and worktree state; the code
 * hashes are git BLOB hashes taken from the PREREGISTRATION COMMIT, so the
 * manifest stays verifiable offline at any later commit.
 *
 * Every design-relevant artefact is bound into the core: protocol id, experiment
 * id, preregistration commit SHA, frozen code blobs, history hashes, scenario
 * hash, intervention law hash, scan-surface hash, evaluator hash, statistical
 * law hash, model config hash, calibration input hash and trial schedule hash.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { gitBlobHash, manifestHashOf, verifyFreezeManifest, type FreezeManifestShape } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/hashing.ts";

import {
  CALIBRATION_INPUT,
  CELL_DEFINITION,
  CELL_IDS,
  CURRENT_SCENE,
  EXPERIMENT_ID,
  FROZEN_PROTOCOL_ID,
  HARD_GATE_IDS,
  MODEL,
  SAMPLE_SIZE,
  cellInterventionLawManifest,
  modelConfigManifest,
  trialSchedule
} from "./contract.ts";
import { hashJson } from "./histories.ts";
import { auditScanSurface } from "./scan-surface.ts";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

/** The frozen code paths this experiment's manifest binds. */
export const PREREG_CODE_PATHS: readonly string[] = Object.freeze([
  "research/experiments/belief-causal-confirmatory-stochastic-v1/contract.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/histories.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/precheck.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/scan-surface.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/verdict.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/manifest.ts",
  "research/experiments/belief-causal-confirmatory-stochastic-v1/cli.ts"
]);

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function buildPreregDesign(evidenceRoot: string): Record<string, unknown> {
  const low = readJson(join(evidenceRoot, "history-low.json"));
  const high = readJson(join(evidenceRoot, "history-high.json"));
  const scan = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
  const schedule = { primary: trialSchedule("PRIMARY"), replication: trialSchedule("REPLICATION") };
  return {
    protocol_id: FROZEN_PROTOCOL_ID,
    experiment_id: EXPERIMENT_ID,
    seed_belief_item_count: [low["seed_belief_item_count"], high["seed_belief_item_count"]],
    histories: {
      low_hash: hashJson(low),
      high_hash: hashJson(high),
      low_progression: low["progression"],
      high_progression: high["progression"],
      low_proposition: low["proposition"],
      high_proposition: high["proposition"],
      low_commit_chain: low["commit_chain"],
      high_commit_chain: high["commit_chain"]
    },
    scenario_hash: hashJson(CURRENT_SCENE),
    intervention_law_hash: hashJson(cellInterventionLawManifest()),
    scan_surface_hash: hashJson({
      surface: scan.exact_scan_surface,
      opaque_refs: scan.opaque_ref_leaves,
      enum_leaves: scan.enum_leaves,
      structural_leaves: scan.structural_leaves,
      unscanned: scan.unscanned_model_authored_semantic_text,
      schema_hash: scan.schema_hash
    }),
    evaluator_hash: hashJson({ gate_ids: HARD_GATE_IDS, cells: CELL_IDS, model: MODEL.id }),
    statistical_law_hash: hashJson({
      law: "CONJUNCTIVE_NEWCOMBE_CONSTRAINT",
      delta_min: 0.2,
      epsilon: 0.15,
      alpha_superiority: 0.025,
      alpha_equivalence: 0.05
    }),
    model_config_hash: hashJson(modelConfigManifest()),
    calibration_input_hash: hashJson(CALIBRATION_INPUT),
    trial_schedule_hash: hashJson(schedule),
    sample_size: SAMPLE_SIZE,
    cell_definition: CELL_DEFINITION
  };
}

export function buildPreregManifest(input: {
  readonly repoDir: string;
  readonly preregistrationCommitSha: string;
  readonly evidenceRoot: string;
}): FreezeManifestShape & Record<string, unknown> {
  const design = buildPreregDesign(input.evidenceRoot);
  const core: Record<string, unknown> = {
    schema_version: "stochastic-executor-causal-freeze-manifest-v1",
    protocol_id: FROZEN_PROTOCOL_ID,
    experiment_id: EXPERIMENT_ID,
    preregistration_commit_sha: input.preregistrationCommitSha,
    code_blob_hashes: Object.fromEntries(
      PREREG_CODE_PATHS.map((path) => [path, gitBlobHash(input.repoDir, input.preregistrationCommitSha, path)])
    ),
    design
  };
  return { ...core, manifest_hash: manifestHashOf(core) } as FreezeManifestShape & Record<string, unknown>;
}

export function verifyPreregManifest(repoDir: string, stored: unknown): { readonly ok: boolean; readonly detail: string } {
  return verifyFreezeManifest(repoDir, stored as FreezeManifestShape);
}
