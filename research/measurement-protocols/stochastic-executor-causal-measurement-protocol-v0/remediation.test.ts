/**
 * REMEDIATION TESTS T1–T10 — independent methodology audit of
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 (`FREEZE_BLOCKED_MINIMAL_REMEDIATION_REQUIRED`).
 *
 * These tests pin the remediated facts so the same inconsistencies cannot return:
 * one calibration N, the true band-minimum equivalence power, the artifact as the
 * single source of truth for the published power table, the pilot/calibration
 * firewalls, the closed conflation scan surface and both classifier error
 * directions, the byte-level freeze declaration, and byte-reproducible artifact
 * generation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync as readFileSyncNode } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BYTE_LEVEL_FREEZE,
  CONFLATION_LAW,
  CONFLATION_SCAN_SURFACE,
  EXECUTOR_CALIBRATION,
  POST_PREREG_CALIBRATION,
  PREREG_TIMELINE,
  SAMPLING,
  TREATMENT_DEVELOPMENT_PILOT
} from "./contract.ts";
import {
  CONFLATION_KNOWN_FALSE_NEGATIVES,
  CONFLATION_KNOWN_FALSE_POSITIVES,
  classifyTruthConflation
} from "./conflation.ts";
import {
  PLAUSIBLE_BASELINE_BAND,
  TOKEN_ENVELOPE_PER_REQUEST,
  buildPowerArtifact
} from "./power.ts";
import { exactEquivalencePower } from "./statistics.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const PROTOCOL_DIR = "research/measurement-protocols/stochastic-executor-causal-measurement-protocol-v0";
const Z_EQUIVALENCE = 1.6448536269514722;

const POWER_ARTIFACT_PATH = join(REPO_ROOT, PROTOCOL_DIR, "evidence", "power-analysis.json");

interface PowerOptionShape {
  readonly id: string;
  readonly epsilon: number;
  readonly n_per_cell_primary: number;
  readonly calibration_draws: number;
  readonly superiority_power_min: number;
  readonly equivalence_power_min: number;
  readonly joint_success_probability_exact: number;
  readonly joint_success_probability_at_valid_floor: number;
  readonly experiment_level_success_probability_approx: number;
  readonly total_cognition_requests: number;
  readonly token_estimate_range: readonly [number, number];
}

interface PowerArtifactShape {
  readonly options: readonly PowerOptionShape[];
  readonly joint_design_table: readonly {
    readonly n_per_cell: number;
    readonly epsilon: number;
    readonly separation: number;
    readonly joint_success_probability: number;
  }[];
  readonly minimum_separation_for_joint_80: readonly {
    readonly n_per_cell: number;
    readonly epsilon: number;
    readonly separation: number | null;
  }[];
  readonly power_table_assumption: { readonly valid_equals_scheduled: boolean; readonly detail: string };
  readonly token_estimate_law: { readonly per_request_range: readonly [number, number]; readonly label: string };
  readonly artifact_hash?: string;
}

function loadArtifact(): PowerArtifactShape {
  return JSON.parse(readFileSyncNode(POWER_ARTIFACT_PATH, "utf8")) as PowerArtifactShape;
}

function optionOf(artifact: PowerArtifactShape, id: string): PowerOptionShape {
  const option = artifact.options.find((entry) => entry.id === id);
  if (option === undefined) throw new Error(`missing option ${id}`);
  return option;
}

function bandMinimumEquivalencePower(n: number, epsilon: number): number {
  return Math.min(
    ...PLAUSIBLE_BASELINE_BAND.map(
      (baseline) => exactEquivalencePower(baseline, baseline, n, n, epsilon, Z_EQUIVALENCE).power
    )
  );
}

describe("REMEDIATION T1–T2: one calibration N, one request formula", () => {
  it("T1: LOW_COST total requests == 4 * 120 * 2 + SAMPLING.calibration_draws", () => {
    const option = optionOf(loadArtifact(), "LOW_COST");
    expect(option.total_cognition_requests).toBe(4 * 120 * 2 + SAMPLING.calibration_draws);
    expect(option.total_cognition_requests).toBe(1010);
  });

  it("T1b: every option's request total follows the SAME formula", () => {
    for (const option of loadArtifact().options) {
      expect(option.total_cognition_requests, option.id).toBe(
        4 * option.n_per_cell_primary * 2 + SAMPLING.calibration_draws
      );
    }
  });

  it("T2: every protocol option uses SAMPLING.calibration_draws (no special case)", () => {
    for (const option of loadArtifact().options) {
      expect(option.calibration_draws, option.id).toBe(SAMPLING.calibration_draws);
      expect(option.calibration_draws, option.id).toBe(EXECUTOR_CALIBRATION.draws);
    }
  });
});

describe("REMEDIATION T3–T5: equivalence power is the TRUE band minimum", () => {
  it("T3: LOW_COST equivalence_power_min equals the independently computed band minimum", () => {
    const option = optionOf(loadArtifact(), "LOW_COST");
    const computed = bandMinimumEquivalencePower(option.n_per_cell_primary, option.epsilon);
    expect(option.equivalence_power_min).toBe(computed);
    expect(option.equivalence_power_min).toBeCloseTo(0.8625309314422923, 12);
  });

  it("T4: HIGH_CONFIDENCE equivalence_power_min equals the independently computed band minimum", () => {
    const option = optionOf(loadArtifact(), "HIGH_CONFIDENCE");
    const computed = bandMinimumEquivalencePower(option.n_per_cell_primary, option.epsilon);
    expect(option.equivalence_power_min).toBe(computed);
    expect(option.equivalence_power_min).toBeCloseTo(0.7571368112111354, 12);
  });

  it("T5: HIGH_CONFIDENCE band-minimum equivalence power is BELOW 0.80 (pinned, disclosed truth)", () => {
    const option = optionOf(loadArtifact(), "HIGH_CONFIDENCE");
    expect(option.equivalence_power_min).toBeLessThan(0.8);
    expect(option.superiority_power_min).toBeGreaterThan(0.99);
  });

  it("RECOMMENDED keeps the audited values (N, epsilon, band minima, joints)", () => {
    const option = optionOf(loadArtifact(), "RECOMMENDED");
    expect(option.n_per_cell_primary).toBe(200);
    expect(option.epsilon).toBe(0.15);
    expect(option.superiority_power_min).toBeCloseTo(0.98647, 5);
    expect(option.equivalence_power_min).toBeCloseTo(0.82317, 5);
    expect(option.joint_success_probability_exact).toBeCloseTo(0.87894, 5);
  });
});

describe("REMEDIATION T6/T10: the artifact is the single source of truth", () => {
  it("T6: every power row in PROTOCOL section 16 matches the artifact for its (N, epsilon) label", () => {
    const protocol = readFileSyncNode(join(REPO_ROOT, PROTOCOL_DIR, "PROTOCOL.md"), "utf8");
    const artifact = loadArtifact();
    const rowPattern = /^\|\s*(\d+)\s*\(ε=([0-9.]+)\)\s*\|\s*([0-9.]+)\s*\|\s*\*{0,2}([0-9.]+)\*{0,2}\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|$/gm;
    let rows = 0;
    for (const match of protocol.matchAll(rowPattern)) {
      rows += 1;
      const n = Number(match[1]);
      const epsilon = Number(match[2]);
      const stated = [Number(match[3]), Number(match[4]), Number(match[5])];
      const statedMinimumSeparation = Number(match[6]);
      const artifactRows = artifact.joint_design_table.filter(
        (entry) => entry.n_per_cell === n && entry.epsilon === epsilon
      );
      expect(artifactRows.length, `no artifact rows for N=${n} eps=${epsilon}`).toBeGreaterThan(0);
      // The published table has exactly three separation columns: delta 0.30/0.40/0.50.
      const tableSeparations = [0.3, 0.4, 0.5];
      for (const [index, separation] of tableSeparations.entries()) {
        const expected = artifactRows.find((entry) => entry.separation === separation);
        expect(expected, `missing separation ${separation} at N=${n} eps=${epsilon}`).toBeDefined();
        const artifactValue = expected?.joint_success_probability ?? Number.NaN;
        const value = stated[index];
        if (value === undefined) continue;
        expect(Math.abs(value - artifactValue), `row N=${n} eps=${epsilon} delta=${separation}`).toBeLessThan(
          0.0011
        );
      }
      const minimum = artifact.minimum_separation_for_joint_80.find(
        (entry) => entry.n_per_cell === n && entry.epsilon === epsilon
      );
      expect(statedMinimumSeparation, `minimum separation row N=${n} eps=${epsilon}`).toBe(
        minimum?.separation ?? Number.NaN
      );
    }
    expect(rows, "PROTOCOL section-16 rows were not parsed (format changed?)").toBeGreaterThanOrEqual(4);
  });

  it("T6b: the PROTOCOL's quoted artifact hash matches the artifact on disk", () => {
    const protocol = readFileSyncNode(join(REPO_ROOT, PROTOCOL_DIR, "PROTOCOL.md"), "utf8");
    const stored = loadArtifact().artifact_hash ?? "";
    expect(stored).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(protocol).toContain(stored.slice(0, 19));
  });

  it("T10: two consecutive offline generations are byte-identical and match the file", () => {
    const first = `${JSON.stringify(buildPowerArtifact(), null, 2)}\n`;
    const second = `${JSON.stringify(buildPowerArtifact(), null, 2)}\n`;
    expect(first).toBe(second);
    const parsed = JSON.parse(readFileSyncNode(POWER_ARTIFACT_PATH, "utf8")) as PowerArtifactShape;
    const core = { ...(parsed as unknown as Record<string, unknown>) };
    delete core["artifact_hash"];
    expect(`${JSON.stringify(core, null, 2)}\n`).toBe(first);
  });

  it("the invalid-scene power assumption is declared and the validity floor is reported", () => {
    const artifact = loadArtifact();
    expect(artifact.power_table_assumption.valid_equals_scheduled).toBe(true);
    const recommended = optionOf(artifact, "RECOMMENDED");
    expect(recommended.joint_success_probability_at_valid_floor).toBeLessThan(
      recommended.joint_success_probability_exact
    );
    expect(recommended.joint_success_probability_at_valid_floor).toBeCloseTo(0.82553, 5);
    expect(recommended.experiment_level_success_probability_approx).toBeCloseTo(
      recommended.joint_success_probability_exact ** 2,
      10
    );
  });

  it("token estimates follow requests x per-request envelope", () => {
    const artifact = loadArtifact();
    expect(artifact.token_estimate_law.per_request_range).toEqual([...TOKEN_ENVELOPE_PER_REQUEST]);
    expect(artifact.token_estimate_law.label).toBe("ESTIMATE_ONLY");
    for (const option of artifact.options) {
      expect(option.token_estimate_range[0], option.id).toBe(
        Math.round(option.total_cognition_requests * TOKEN_ENVELOPE_PER_REQUEST[0])
      );
      expect(option.token_estimate_range[1], option.id).toBe(
        Math.round(option.total_cognition_requests * TOKEN_ENVELOPE_PER_REQUEST[1])
      );
    }
    expect(optionOf(artifact, "RECOMMENDED").token_estimate_range).toEqual([10725000, 14190000]);
  });
});

describe("REMEDIATION T7–T9: firewalls and closures", () => {
  it("T7: the treatment-development pilot can never be confirmatory and never enters a denominator", () => {
    expect(TREATMENT_DEVELOPMENT_PILOT.status).toBe("EXPLORATORY_ONLY");
    expect(TREATMENT_DEVELOPMENT_PILOT.confirmatory).toBe(false);
    expect(TREATMENT_DEVELOPMENT_PILOT.enters_confirmatory_denominator).toBe(false);
    expect(TREATMENT_DEVELOPMENT_PILOT.enters_primary).toBe(false);
    expect(TREATMENT_DEVELOPMENT_PILOT.enters_replication).toBe(false);
    expect(TREATMENT_DEVELOPMENT_PILOT.enters_pooled_confirmatory_result).toBe(false);
    expect(TREATMENT_DEVELOPMENT_PILOT.must_precede_preregistration_commit).toBe(true);
    expect(TREATMENT_DEVELOPMENT_PILOT.reuse_of_trial_identities_for_confirmatory_scenes).toBe("FORBIDDEN");
    for (const change of ["history", "scenario", "intervention", "treatment_strength", "evaluator", "N", "margins"]) {
      expect(TREATMENT_DEVELOPMENT_PILOT.changes_requiring_new_preregistration_commit).toContain(change);
    }
    expect(EXECUTOR_CALIBRATION.cannot_measure).toContain("A/B/C/D treatment separation");
    expect(EXECUTOR_CALIBRATION.enters_confirmatory_denominator).toBe(false);
  });

  it("T8: post-preregistration calibration can only RUN or STOP, and N is frozen", () => {
    expect([...POST_PREREG_CALIBRATION.allowed_outcomes]).toEqual(["RUN", "STOP"]);
    expect(POST_PREREG_CALIBRATION.may_modify).toEqual([]);
    expect(POST_PREREG_CALIBRATION.n_is_frozen_after_preregistration_commit).toBe(true);
    expect(EXECUTOR_CALIBRATION.may_modify).toEqual([]);
    expect(PREREG_TIMELINE.findIndex((step) => step.includes("PREREGISTRATION_COMMIT"))).toBeLessThan(
      PREREG_TIMELINE.findIndex((step) => step === "Primary")
    );
    expect(PREREG_TIMELINE.findIndex((step) => step.includes("treatment-development pilot"))).toBeLessThan(
      PREREG_TIMELINE.findIndex((step) => step.includes("PREREGISTRATION_COMMIT"))
    );
  });

  it("T9: the truth-conflation scan surface is explicit, closed and machine-readable", () => {
    expect(CONFLATION_SCAN_SURFACE.length).toBeGreaterThan(0);
    expect([...CONFLATION_LAW.closed_scan_surface]).toEqual([...CONFLATION_SCAN_SURFACE]);
    for (const path of CONFLATION_SCAN_SURFACE) {
      expect(path.length, path).toBeGreaterThan(0);
    }
    expect(CONFLATION_LAW.pass_means).toBe("NO_DETERMINISTIC_CLASSIFIER_FLAG");
    expect(CONFLATION_LAW.pass_does_not_mean).toBe("NO_SEMANTIC_OBJECTIVE_TRUTH_CONFLATION");
  });

  it("T9b: both classifier error directions are disclosed AND reproduce exactly as disclosed", () => {
    for (const text of CONFLATION_KNOWN_FALSE_POSITIVES) {
      expect(classifyTruthConflation(text).conflation, `disclosed FP not reproduced: ${text}`).toBe(true);
    }
    for (const text of CONFLATION_KNOWN_FALSE_NEGATIVES) {
      expect(classifyTruthConflation(text).conflation, `disclosed FN not reproduced: ${text}`).toBe(false);
    }
    expect([...CONFLATION_LAW.error_directions_disclosed]).toEqual(["FALSE_POSITIVE", "FALSE_NEGATIVE"]);
  });

  it("the byte-level freeze is declared in the contract", () => {
    expect(BYTE_LEVEL_FREEZE.level).toBe("BYTE");
    expect(BYTE_LEVEL_FREEZE.statement).toContain("BYTE-level");
    expect(BYTE_LEVEL_FREEZE.on_required_change_after_formal_calls).toContain("INVALID");
  });
});
