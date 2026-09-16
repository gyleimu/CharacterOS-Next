/**
 * BELIEF_CAUSAL_VALIDATION_V0 — scientific freeze manifest (§27).
 *
 * After the pilot passes its host-validity gate, the code, the design, the
 * histories, the intervention law, the model configuration, the metrics and the
 * thresholds are frozen into ONE manifest artifact. The primary and replication
 * phases verify the manifest before their first call and refuse to run if any
 * frozen input changed.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  CELL_DEFINITION,
  CELL_IDS,
  CURRENT_SCENE,
  EXPERIMENT_ID,
  GATES,
  HIGH_EPISODES,
  LOW_EPISODES,
  OUTCOME_CLASSIFIER,
  PILOT_SCENES_PER_CELL,
  RETRY_POLICY,
  SCENES_PER_CELL,
  SEMANTIC_PROVIDER_LAW,
  SUBJECT,
  TARGET_PROPOSITION_LABEL,
  modelConfigManifest,
  scheduledScenes
} from "./contract.ts";
import { hashJson } from "./world.ts";

export const FREEZE_FILES: readonly string[] = [
  "contract.ts",
  "transport.ts",
  "world.ts",
  "precheck.ts",
  "runner.ts",
  "scene-worker.ts",
  "cli.ts"
];

export function fileHash(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

export function buildFreezeCore(experimentDir: string, evidenceRoot: string): Record<string, unknown> {
  const git = (args: readonly string[]): string =>
    execFileSync("git", args as string[], { cwd: experimentDir, encoding: "utf8" }).trim();
  const precheck = JSON.parse(readFileSync(join(evidenceRoot, "precheck", "precheck.json"), "utf8")) as Record<string, unknown>;
  const low = JSON.parse(readFileSync(join(evidenceRoot, "precheck", "history-low.json"), "utf8")) as {
    progression: readonly number[];
    final_credence: number;
    proposition: unknown;
    repository_digest: string;
    state_revision: number;
  };
  const high = JSON.parse(readFileSync(join(evidenceRoot, "precheck", "history-high.json"), "utf8")) as typeof low;
  const pilot = JSON.parse(readFileSync(join(evidenceRoot, "pilot", "verdict.json"), "utf8")) as {
    host_valid: number;
    scheduled: number;
    invalid_scenes: readonly unknown[];
  };
  const exploratory = JSON.parse(readFileSync(join(evidenceRoot, "exploratory-calls.json"), "utf8")) as unknown;
  const rendered = JSON.parse(readFileSync(join(evidenceRoot, "precheck", "precheck-rendered-requests.json"), "utf8")) as {
    cells: Record<string, { system_hash: string; user_hash: string; belief_section_hash: string; non_belief_user_hash: string; projection_hash: string }>;
  };

  const frozen: Record<string, unknown> = {
    schema_version: "belief-causal-scientific-freeze-v0",
    experiment_id: EXPERIMENT_ID,
    repository: {
      branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
      head: git(["rev-parse", "HEAD"]),
      tracked_tree_dirty_outside_experiment: git(["status", "--porcelain"])
        .split("\n")
        .filter((line) => line.trim().length > 0 && !line.includes("research/experiments/belief-causal-validation-v0"))
        .length
    },
    code_hashes: Object.fromEntries(FREEZE_FILES.map((file) => [file, fileHash(join(experimentDir, file))])),
    design: {
      subject: SUBJECT,
      target_proposition_label: TARGET_PROPOSITION_LABEL,
      semantic_provider_law: SEMANTIC_PROVIDER_LAW,
      low_episodes: LOW_EPISODES,
      high_episodes: HIGH_EPISODES,
      current_scene: CURRENT_SCENE,
      cells: CELL_DEFINITION,
      cell_ids: CELL_IDS,
      pilot_scenes_per_cell: PILOT_SCENES_PER_CELL,
      scenes_per_cell: SCENES_PER_CELL,
      schedule_primary: scheduledScenes("PRIMARY", SCENES_PER_CELL),
      schedule_replication: scheduledScenes("REPLICATION", SCENES_PER_CELL),
      outcome_classifier: OUTCOME_CLASSIFIER,
      metrics: {
        primary: "communication_directive.kind (CLARIFY_MISSING_CONTEXT | REALIZE_CURRENT_INTENT)",
        secondary: [
          "proceeds_with_passage",
          "proposes_alternative_route",
          "seeks_verification",
          "asserts_current_truth",
          "objective_truth_conflation",
          "cross_domain_inference",
          "belief_view.target_visible",
          "belief_view.target_credence"
        ],
        hard_gates: [
          "raw_history_isolation",
          "memory_retrieval_isolation",
          "non_belief_state_equality",
          "non_belief_prompt_equivalence",
          "b_d_full_input_equality",
          "intervention_belief_stability",
          "host_validity"
        ]
      },
      thresholds: GATES,
      contrast_law: {
        C1: "A_LOW_BELIEF vs B_HIGH_BELIEF — effect expected",
        C2: "B_HIGH_BELIEF vs C_HIGH_BELIEF_MEDIATOR_ABLATED — effect expected (mediator necessity)",
        C3: "B_HIGH_BELIEF vs D_LOW_BELIEF_MEDIATOR_EQUALIZED — NO effect expected (history identity control)",
        C4: "A_LOW_BELIEF vs D_LOW_BELIEF_MEDIATOR_EQUALIZED — effect expected (mediator sufficiency)"
      },
      intervention_law: {
        C: "ABLATE_TARGET — the target belief item is removed from the research-side model-facing belief view only",
        D: "EQUALIZE_TARGET_TO_HIGH — the target item is presented with the HIGH credence in the research-side model-facing belief view only",
        production_write: false,
        durable_state_unchanged: "verified per scene (belief_item_before == belief_item_after)"
      }
    },
    model: modelConfigManifest(),
    retry_policy: RETRY_POLICY,
    histories: {
      low: { progression: low.progression, final_credence: low.final_credence, state_revision: low.state_revision, proposition: low.proposition, repository_digest: low.repository_digest },
      high: { progression: high.progression, final_credence: high.final_credence, state_revision: high.state_revision, proposition: high.proposition, repository_digest: high.repository_digest }
    },
    rendered_requests: rendered.cells,
    precheck: {
      ok: precheck["ok"],
      failed_gates: precheck["failed_gates"],
      non_belief_state_identical: precheck["non_belief_state_identical"],
      canonical_state_hashes: precheck["canonical_state_hashes"],
      history: precheck["history"],
      restore: precheck["restore"]
    },
    pilot: { host_valid: pilot.host_valid, scheduled: pilot.scheduled, rate: pilot.host_valid / pilot.scheduled, invalid_scenes: pilot.invalid_scenes },
    exploratory_calls: exploratory
  };
  return frozen;
}

export function buildFreezeManifest(experimentDir: string, evidenceRoot: string): Record<string, unknown> {
  const core = buildFreezeCore(experimentDir, evidenceRoot);
  return { ...core, frozen_at_utc: new Date().toISOString(), manifest_hash: hashJson(core) };
}

export function writeFreezeManifest(experimentDir: string, evidenceRoot: string): Record<string, unknown> {
  const manifest = buildFreezeManifest(experimentDir, evidenceRoot);
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(join(evidenceRoot, "scientific-freeze-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** Primary/replication refuse to run if any frozen input changed after the freeze. */
export function verifyFreezeManifest(experimentDir: string, evidenceRoot: string): void {
  const path = join(evidenceRoot, "scientific-freeze-manifest.json");
  const stored = JSON.parse(readFileSync(path, "utf8")) as { manifest_hash?: string };
  const core = buildFreezeCore(experimentDir, evidenceRoot);
  if (stored.manifest_hash !== hashJson(core)) {
    throw new Error("BELIEF_CAUSAL: frozen manifest inputs changed after the scientific freeze");
  }
}
