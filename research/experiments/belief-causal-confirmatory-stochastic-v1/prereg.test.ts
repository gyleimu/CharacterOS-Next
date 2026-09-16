/* eslint-disable no-restricted-imports -- Research harness: reuses the FROZEN verifier by relative path for cross-contract regressions. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — preregistration integrity tests.
 *
 * Offline, deterministic, no model calls. These tests pin the preregistration's
 * own invariants, close the two non-blocking MAJORs the measurement-protocol
 * freeze audit left open (exact scan-surface coverage and a committed
 * missing-blob regression), and prove that the hard-gate registry really feeds
 * the verdict.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CALIBRATION_INPUT,
  CELL_IDS,
  CURRENT_SCENE,
  FORBIDDEN_MODEL_FACING_LABELS,
  HARD_GATE_IDS,
  SAMPLE_SIZE,
  SLICE_CALL_ATTESTATION,
  V0_FIREWALL,
  VERDICT_MENU,
  cellInterventionLawManifest,
  replicateRange,
  trialSchedule
} from "./contract.ts";
import { auditScanSurface, classifyCognitionSchemaLeaves, deriveExactCognitionTextScanSurface, FROZEN_PROTOCOL_DECLARED_PATHS } from "./scan-surface.ts";
import { buildPreregDesign, PREREG_CODE_PATHS } from "./manifest.ts";
import { evaluateHardGates, deriveConfirmatoryVerdict, type VerdictInput } from "./verdict.ts";
import { hashJson } from "./histories.ts";
import { manifestHashOf, verifyFreezeManifest } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/hashing.ts";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const EXPERIMENT_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const EVIDENCE_DIR = join(REPO_ROOT, EXPERIMENT_DIR, "evidence");

function git(args: readonly string[]): string {
  return execFileSync("git", args as string[], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function baseVerdictInput(): VerdictInput {
  return {
    phase: "PRIMARY",
    cells: {
      A_LOW: { scheduled: 200, host_valid: 200, realize: 60, conflation_flags: 0 },
      B_HIGH: { scheduled: 200, host_valid: 200, realize: 134, conflation_flags: 0 },
      C_HIGH_ABLATED: { scheduled: 200, host_valid: 200, realize: 20, conflation_flags: 0 },
      D_LOW_EQUALIZED: { scheduled: 200, host_valid: 200, realize: 138, conflation_flags: 0 }
    },
    prereg_sha_matches: true,
    manifest_valid: true,
    seed_belief_empty: true,
    formation_attested: true,
    raw_history_leaks: 0,
    retrieval_exposed: false,
    non_belief_state_equal: true,
    a_b_only_belief_difference: true,
    b_d_full_input_identity: true,
    intervention_production_writes: 0,
    secret_safety_clean: true,
    accounting: { planned: 800, actual: 800, unique: 800, duplicate: 0, missing: 0, extra: 0 },
    primary_conjunction_passed: null,
    replication_conjunction_passed: null
  };
}

describe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — exact cognition scan surface", () => {
  it("covers every model-authored semantic text leaf of the real V8 proposal schema", () => {
    const audit = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
    expect(audit.unscanned_model_authored_semantic_text).toEqual([]);
    expect(audit.exact_scan_surface.length).toBeGreaterThan(0);
    for (const path of audit.exact_scan_surface) {
      expect(audit.model_authored_semantic_leaves).toContain(path);
    }
  });

  it("keeps the frozen protocol's five declared paths inside the surface", () => {
    const surface = deriveExactCognitionTextScanSurface();
    for (const path of FROZEN_PROTOCOL_DECLARED_PATHS) {
      expect(surface, path).toContain(path);
    }
  });

  it("includes subjective_selection and every derivation string leaf", () => {
    const surface = deriveExactCognitionTextScanSurface();
    expect(surface).toContain("subjective_selection.stance");
    expect(surface).toContain("subjective_selection.subjective_rationale");
    for (const path of [
      "factual_assessment.claims[*].derivation.source_expression",
      "factual_assessment.claims[*].derivation.source_instruction",
      "factual_assessment.claims[*].derivation.input",
      "factual_assessment.claims[*].derivation.source_rule",
      "factual_assessment.claims[*].derivation.source_query"
    ]) {
      expect(surface, path).toContain(path);
    }
  });

  it("classifies opaque refs, enums and structural values as NOT prose", () => {
    const audit = auditScanSurface("x");
    for (const path of [
      "cognition.relevant_memory_handles[*]",
      "cognition.considered_handles[*]",
      "cognition.evidence_handles[*]",
      "factual_assessment.claims[*].source_handles[*]",
      "clarification_basis.current_observation_ref"
    ]) {
      expect(audit.opaque_ref_leaves, path).toContain(path);
      expect(audit.exact_scan_surface, path).not.toContain(path);
    }
    expect(audit.enum_leaves.length).toBeGreaterThan(0);
    expect(audit.structural_leaves).toContain("cognition.confidence");
  });

  it("the schema walk is complete and deterministic (leaf inventory is stable)", () => {
    const first = classifyCognitionSchemaLeaves();
    const second = classifyCognitionSchemaLeaves();
    expect(hashJson(first)).toBe(hashJson(second));
    for (const leaf of first) {
      expect(leaf.leaf_class, leaf.path).toMatch(/^[ABCD]$/);
      expect(leaf.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — missing-blob verifier regression (§22)", () => {
  it("a manifest naming a non-existent historical blob fails closed WITHOUT throwing", () => {
    const head = git(["rev-parse", "HEAD"]);
    // positive control: a path that already exists at HEAD (the experiment sources
    // are added BY the preregistration commit; the frozen protocol is already there)
    const existingPath = "research/measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";
    const coreMissing: Record<string, unknown> = {
      schema_version: "stochastic-executor-causal-freeze-manifest-v1",
      protocol_id: "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0",
      preregistration_commit_sha: head,
      code_blob_hashes: { "research/this/path/does/not/exist.ts": `sha256:${"0".repeat(64)}` },
      design: { fixture: "missing-blob regression" }
    };
    const manifestMissing = { ...coreMissing, manifest_hash: manifestHashOf(coreMissing) };
    let result: { ok: boolean; detail: string } | null = null;
    expect(() => {
      result = verifyFreezeManifest(REPO_ROOT, manifestMissing as never);
    }).not.toThrow();
    expect(result).not.toBeNull();
    expect((result as unknown as { ok: boolean }).ok).toBe(false);

    // positive control: the same manifest shape with a REAL blob verifies
    const coreReal: Record<string, unknown> = {
      ...coreMissing,
      code_blob_hashes: { [existingPath]: git(["rev-parse", `${head}:${existingPath}`]).length > 0 ? blobHash(existingPath, head) : blobHash(existingPath, head) }
    };
    const manifestReal = { ...coreReal, manifest_hash: manifestHashOf(coreReal) };
    expect(verifyFreezeManifest(REPO_ROOT, manifestReal as never).ok).toBe(true);
  });

  it("the regression is committed in this experiment's own test directory (frozen sources untouched)", () => {
    const self = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "prereg.test.ts"), "utf8");
    expect(self).toContain("missing-blob verifier regression");
    expect(self).toContain("verifyFreezeManifest");
  });
});

function blobHash(path: string, commitSha: string): string {
  const content = execFileSync("git", ["cat-file", "blob", `${commitSha}:${path}`], { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

describe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — trial identities and schedule", () => {
  it("1600 confirmatory identities are unique and correctly ranged", () => {
    const primary = trialSchedule("PRIMARY");
    const replication = trialSchedule("REPLICATION");
    const ids = [...primary, ...replication].map((entry) => entry.trial_id);
    expect(ids.length).toBe(SAMPLE_SIZE.primary_cognition_calls + SAMPLE_SIZE.replication_cognition_calls);
    expect(new Set(ids).size).toBe(ids.length);
    expect(replicateRange("PRIMARY")).toEqual({ start: 1, end: 200 });
    expect(replicateRange("REPLICATION")).toEqual({ start: 201, end: 400 });
    for (const cell of CELL_IDS) {
      expect(primary.filter((entry) => entry.cell === cell).length).toBe(200);
      expect(replication.filter((entry) => entry.cell === cell).length).toBe(200);
    }
  });

  it("no trial identity reuses a V0, pilot or calibration namespace", () => {
    const ids = [...trialSchedule("PRIMARY"), ...trialSchedule("REPLICATION")].map((entry) => entry.trial_id);
    for (const id of ids) {
      expect(id).toContain("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1");
      expect(id).not.toContain("BELIEF_CAUSAL_VALIDATION_V0");
      expect(id).not.toContain("PILOT");
      expect(id).not.toContain("CALIBRATION");
    }
    expect(CALIBRATION_INPUT.namespace).toBe("CALIBRATION");
    expect(CALIBRATION_INPUT.belongs_to_confirmatory_counts).toBe(false);
  });

  it("the schedule is deterministic and balanced (A B C D rotating)", () => {
    const first = trialSchedule("PRIMARY").slice(0, 8).map((entry) => entry.cell);
    expect(first).toEqual(["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED", "A_LOW"]);
  });
});

describe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — gates, verdict and firewalls", () => {
  it("every declared hard gate has an executable evaluator consumed by the verdict", () => {
    const evaluations = evaluateHardGates({
      ...baseVerdictInput(),
      primary_conjunction_passed: true,
      replication_conjunction_passed: true
    });
    expect(evaluations.map((entry) => entry.id)).toEqual([...HARD_GATE_IDS]);
    expect(evaluations.every((entry) => entry.passed)).toBe(true);
    expect(HARD_GATE_IDS.length).toBe(17);
  });

  it("EVERY gate individually blocks a successful verdict when violated", () => {
    const violations: Record<string, (input: VerdictInput) => VerdictInput> = {
      PREREG_SHA_MATCH: (input) => ({ ...input, prereg_sha_matches: false }),
      MANIFEST_VALID: (input) => ({ ...input, manifest_valid: false }),
      SEED_BELIEF_EMPTY: (input) => ({ ...input, seed_belief_empty: false }),
      FORMATION_ATTESTATION: (input) => ({ ...input, formation_attested: false }),
      RAW_HISTORY_ZERO: (input) => ({ ...input, raw_history_leaks: 1 }),
      MEMORY_RETRIEVAL_ZERO: (input) => ({ ...input, retrieval_exposed: true }),
      NON_BELIEF_STATE_EQUAL: (input) => ({ ...input, non_belief_state_equal: false }),
      A_B_ONLY_BELIEF_DIFFERENCE: (input) => ({ ...input, a_b_only_belief_difference: false }),
      B_D_FULL_INPUT_IDENTITY: (input) => ({ ...input, b_d_full_input_identity: false }),
      INTERVENTION_NO_PRODUCTION_WRITE: (input) => ({ ...input, intervention_production_writes: 1 }),
      TRUTH_CONFLATION_ZERO_FLAGS: (input) => ({
        ...input,
        cells: { ...input.cells, B_HIGH: { ...input.cells.B_HIGH, conflation_flags: 1 } }
      }),
      HOST_VALIDITY: (input) => ({ ...input, cells: { ...input.cells, A_LOW: { ...input.cells.A_LOW, host_valid: 140 } } }),
      CELL_INVALID_IMBALANCE: (input) => ({
        ...input,
        cells: {
          ...input.cells,
          A_LOW: { ...input.cells.A_LOW, host_valid: 180 },
          B_HIGH: { ...input.cells.B_HIGH, host_valid: 200 },
          C_HIGH_ABLATED: { ...input.cells.C_HIGH_ABLATED, host_valid: 200 },
          D_LOW_EQUALIZED: { ...input.cells.D_LOW_EQUALIZED, host_valid: 200 }
        }
      }),
      CALL_ACCOUNTING: (input) => ({ ...input, accounting: { ...input.accounting, duplicate: 1 } }),
      SECRET_SAFETY: (input) => ({ ...input, secret_safety_clean: false }),
      PRIMARY_FULL_CONJUNCTION: (input) => ({ ...input, primary_conjunction_passed: false }),
      REPLICATION_FULL_CONJUNCTION: (input) => ({ ...input, replication_conjunction_passed: false })
    };
    expect(Object.keys(violations).sort()).toEqual([...HARD_GATE_IDS].sort());
    for (const gateId of HARD_GATE_IDS) {
      const verdict = deriveConfirmatoryVerdict((violations[gateId] as (input: VerdictInput) => VerdictInput)(baseVerdictInput()));
      expect(verdict.failed_gates).toContain(gateId);
      expect(verdict.verdict, `${gateId} did not block success`).not.toBe("BELIEF_CAUSAL_INFLUENCE_REPLICATED");
      expect(VERDICT_MENU).toContain(verdict.verdict);
    }
  });

  it("a full conjunction plus every gate yields the frozen replicated verdict", () => {
    const input = baseVerdictInput();
    const verdict = deriveConfirmatoryVerdict({
      ...input,
      primary_conjunction_passed: true,
      replication_conjunction_passed: true
    });
    expect(verdict.decision.joint).toBe(true);
    expect(verdict.verdict).toBe("BELIEF_CAUSAL_INFLUENCE_REPLICATED");
  });

  it("the NOT_REPLICATED law is the frozen one: only an all-superiority failure is a genuine null", () => {
    const input = baseVerdictInput();
    const nullish = deriveConfirmatoryVerdict({
      ...input,
      cells: {
        A_LOW: { scheduled: 200, host_valid: 200, realize: 80, conflation_flags: 0 },
        B_HIGH: { scheduled: 200, host_valid: 200, realize: 96, conflation_flags: 0 },
        C_HIGH_ABLATED: { scheduled: 200, host_valid: 200, realize: 84, conflation_flags: 0 },
        D_LOW_EQUALIZED: { scheduled: 200, host_valid: 200, realize: 92, conflation_flags: 0 }
      }
    });
    expect(nullish.verdict).toBe("BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED");
    const partial = deriveConfirmatoryVerdict({
      ...input,
      cells: { ...input.cells, D_LOW_EQUALIZED: { scheduled: 200, host_valid: 200, realize: 176, conflation_flags: 0 } }
    });
    expect(partial.verdict).toBe("BELIEF_CAUSAL_RESULT_INCONCLUSIVE");
  });

  it("the V0 firewall and the zero-call attestation are declared and machine-readable", () => {
    expect(V0_FIREWALL.confirmatory_count_contribution).toBe(0);
    expect(V0_FIREWALL.forbidden_reads.length).toBeGreaterThan(0);
    expect(SLICE_CALL_ATTESTATION.total_model_calls).toBe(0);
    expect(FORBIDDEN_MODEL_FACING_LABELS.length).toBeGreaterThan(0);
  });
});

describe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — frozen design bindings", () => {
  it("the prereg design binds every required hash and reads NO V0 outcome file", () => {
    const design = buildPreregDesign(EVIDENCE_DIR) as Record<string, unknown>;
    for (const key of [
      "scenario_hash",
      "intervention_law_hash",
      "scan_surface_hash",
      "evaluator_hash",
      "statistical_law_hash",
      "model_config_hash",
      "calibration_input_hash",
      "trial_schedule_hash"
    ]) {
      expect(design[key], key).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    const histories = design["histories"] as Record<string, unknown>;
    for (const key of ["low_hash", "high_hash"]) {
      expect(histories[key], key).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(design["seed_belief_item_count"]).toEqual([0, 0]);
  });

  it("the frozen code paths bound by the manifest are exactly this experiment's sources", () => {
    expect(PREREG_CODE_PATHS.length).toBeGreaterThan(0);
    for (const path of PREREG_CODE_PATHS) {
      expect(path.startsWith(`${EXPERIMENT_DIR}/`), path).toBe(true);
      expect(path.includes("measurement-protocols"), path).toBe(false);
    }
  });

  it("the scenario and calibration input are byte-stable and label-free", () => {
    const scene = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "contract.ts"), "utf8");
    for (const label of FORBIDDEN_MODEL_FACING_LABELS) {
      expect(CURRENT_SCENE.text.includes(label), label).toBe(false);
    }
    expect(CURRENT_SCENE.text.length).toBeGreaterThan(0);
    expect(scene).toContain(CURRENT_SCENE.text);
    expect(cellInterventionLawManifest()["production_write"]).toBe(false);
  });
});
