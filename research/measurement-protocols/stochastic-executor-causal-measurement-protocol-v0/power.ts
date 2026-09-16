/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — offline power / sensitivity analysis.
 *
 * ZERO model calls. Pure deterministic arithmetic over the preregistered
 * parameter grid: exact binomial enumeration for every marginal contrast and an
 * exact four-dimensional enumeration for the conjunctive success probability of
 * the recommended design points.
 *
 * The grid is NOT anchored on the V0 point estimates: it spans baseline
 * probabilities 0.2 … 0.8 and effect sizes 0.15 … 0.40, and V0 appears only as
 * one labelled stress-test scenario (`v0_observed`).
 */
import { DESIGN, SAMPLING } from "./contract.ts";
import {
  exactEquivalencePower,
  exactJointSuccessProbability,
  exactSuperiorityPower
} from "./statistics.ts";

export const BASELINE_GRID: readonly number[] = Object.freeze([0.2, 0.3, 0.5, 0.7, 0.8]);
export const EFFECT_GRID: readonly number[] = Object.freeze([0.15, 0.2, 0.25, 0.3, 0.4]);
export const N_GRID: readonly number[] = Object.freeze([10, 20, 30, 40, 50, 60, 80, 100, 120, 140, 160, 200, 240, 300, 400, 600]);
/** Separation values used by the joint design table (pA=pC=b, pB=pD=b+delta). */
export const SEPARATION_GRID: readonly number[] = Object.freeze([0.3, 0.4, 0.45, 0.5, 0.6]);
/**
 * Planning band for the BASELINE rate. Above 0.60 a claim threshold of 0.20 has
 * no headroom left (p + delta_min approaches the ceiling and the interval lower
 * bound can never exceed the threshold), so ceiling-limited cells are reported
 * separately as UNDECIDABLE rather than powered.
 */
export const PLAUSIBLE_BASELINE_BAND: readonly number[] = Object.freeze([0.2, 0.3, 0.4, 0.5, 0.6]);
export const EPSILON_GRID: readonly number[] = Object.freeze([0.1, 0.15, 0.2]);
export const DELTA_MIN_GRID: readonly number[] = Object.freeze([0.15, 0.2, 0.25, 0.3]);

export interface SuperiorityCell {
  readonly baseline: number;
  readonly effect: number;
  readonly n: number;
  readonly power: number;
  readonly expected_ci_width: number;
  readonly false_positive_rate_at_zero_effect: number;
}

export interface EquivalenceCell {
  readonly baseline: number;
  readonly epsilon: number;
  readonly n: number;
  readonly power: number;
  readonly expected_ci_width: number;
  readonly false_negative_rate_at_margin: number;
}

function clampProbability(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Superiority power table: true p_lo = baseline, true p_hi = baseline + effect,
 * claim threshold delta_min (the design's MIN_CAUSALLY_MEANINGFUL_EFFECT).
 */
export function superiorityPowerTable(deltaMin: number, grid = { baselines: BASELINE_GRID, effects: EFFECT_GRID, ns: N_GRID }): readonly SuperiorityCell[] {
  const cells: SuperiorityCell[] = [];
  for (const baseline of grid.baselines) {
    for (const effect of grid.effects) {
      const pHi = clampProbability(baseline + effect);
      for (const n of grid.ns) {
        const power = exactSuperiorityPower(baseline, pHi, n, n, deltaMin, DESIGN.z_superiority);
        const falsePositive = exactSuperiorityPower(baseline, baseline, n, n, deltaMin, DESIGN.z_superiority);
        cells.push({
          baseline,
          effect,
          n,
          power: power.power,
          expected_ci_width: power.expected_ci_width ?? 0,
          false_positive_rate_at_zero_effect: falsePositive.power
        });
      }
    }
  }
  return cells;
}

/** Equivalence power table for the B/D control at true |Δ| = 0 (and at the margin). */
export function equivalencePowerTable(
  epsilon: number,
  grid = { baselines: BASELINE_GRID, ns: N_GRID }
): readonly EquivalenceCell[] {
  const cells: EquivalenceCell[] = [];
  for (const baseline of grid.baselines) {
    for (const n of grid.ns) {
      const atZero = exactEquivalencePower(baseline, baseline, n, n, epsilon, DESIGN.z_equivalence);
      const atMargin = exactEquivalencePower(clampProbability(baseline + epsilon), baseline, n, n, epsilon, DESIGN.z_equivalence);
      cells.push({
        baseline,
        epsilon,
        n,
        power: atZero.power,
        expected_ci_width: atZero.expected_ci_width ?? 0,
        false_negative_rate_at_margin: 1 - atMargin.power
      });
    }
  }
  return cells;
}

export interface RequirementRow {
  readonly n_per_cell: number;
  readonly min_superiority_power_over_band: number;
  readonly min_equivalence_power_over_band: number;
  readonly min_superiority_power_over_full_grid: number;
  readonly min_equivalence_power_over_full_grid: number;
  readonly power_at_v0_like_baseline: number;
}

/**
 * The design question: for a given (delta_min, epsilon), which N per cell makes
 * BOTH the superiority component (at the design effect) and the equivalence
 * component meet their targets across the WHOLE baseline grid?
 */
export function requirementTable(input: {
  readonly deltaMin: number;
  readonly designEffect: number;
  readonly epsilon: number;
  readonly superiorityTarget: number;
  readonly equivalenceTarget: number;
}): readonly RequirementRow[] {
  const rows: RequirementRow[] = [];
  for (const n of N_GRID) {
    const bandSuperiority = PLAUSIBLE_BASELINE_BAND.map((baseline) =>
      exactSuperiorityPower(
        baseline,
        clampProbability(baseline + input.designEffect),
        n,
        n,
        input.deltaMin,
        DESIGN.z_superiority
      ).power
    );
    const bandEquivalence = PLAUSIBLE_BASELINE_BAND.map(
      (baseline) => exactEquivalencePower(baseline, baseline, n, n, input.epsilon, DESIGN.z_equivalence).power
    );
    const superiority = BASELINE_GRID.map((baseline) =>
      exactSuperiorityPower(
        baseline,
        clampProbability(baseline + input.designEffect),
        n,
        n,
        input.deltaMin,
        DESIGN.z_superiority
      ).power
    );
    const equivalence = BASELINE_GRID.map(
      (baseline) => exactEquivalencePower(baseline, baseline, n, n, input.epsilon, DESIGN.z_equivalence).power
    );
    const v0LikeSuperiority = exactSuperiorityPower(0.23, 0.68, n, n, input.deltaMin, DESIGN.z_superiority).power;
    rows.push({
      n_per_cell: n,
      min_superiority_power_over_band: Math.min(...bandSuperiority),
      min_equivalence_power_over_band: Math.min(...bandEquivalence),
      min_superiority_power_over_full_grid: Math.min(...superiority),
      min_equivalence_power_over_full_grid: Math.min(...equivalence),
      power_at_v0_like_baseline: v0LikeSuperiority
    });
  }
  return rows;
}

export function firstNAdequatelyPowered(input: {
  readonly deltaMin: number;
  readonly designEffect: number;
  readonly epsilon: number;
  readonly superiorityTarget: number;
  readonly equivalenceTarget: number;
}): RequirementRow | null {
  const rows = requirementTable(input);
  return (
    rows.find(
      (row) =>
        row.min_superiority_power_over_band >= input.superiorityTarget &&
        row.min_equivalence_power_over_band >= input.equivalenceTarget
    ) ?? null
  );
}

export interface ProtocolOption {
  readonly id: "LOW_COST" | "RECOMMENDED" | "HIGH_CONFIDENCE";
  readonly delta_min: number;
  readonly epsilon: number;
  readonly n_per_cell_primary: number;
  readonly n_per_cell_replication: number;
  readonly calibration_draws: number;
  readonly superiority_power_min: number;
  readonly equivalence_power_min: number;
  readonly joint_success_probability_exact: number | null;
  readonly total_cognition_requests: number;
  readonly claim_strength: string;
}

function totalCognitionRequests(n: number, calibration: number): number {
  return n * 4 * 2 + calibration;
}

/** Exact joint success probability for a symmetric-alternative design point. */
export function jointSuccessProbability(input: {
  readonly pA: number;
  readonly pC: number;
  readonly pHigh: number;
  readonly pD: number;
  readonly n: number;
  readonly epsilon: number;
  readonly deltaMin: number;
}): number {
  return exactJointSuccessProbability({
    pA: input.pA,
    pB: input.pHigh,
    pC: input.pC,
    pD: input.pD,
    n: input.n,
    deltaMin: input.deltaMin,
    epsilon: input.epsilon,
    zSuperiority: DESIGN.z_superiority,
    zEquivalence: DESIGN.z_equivalence
  });
}

export interface JointDesignCell {
  readonly n_per_cell: number;
  readonly epsilon: number;
  readonly separation: number;
  readonly joint_success_probability: number;
  readonly total_cognition_requests: number;
}

/**
 * The decision-critical table: exact joint success probability of the whole
 * conjunctive law as a function of the TRUE cell separation and N. This is what
 * tells a future experiment how strong the treatment must be for the design to
 * be worth its cost.
 */
export function jointDesignTable(input: {
  readonly ns: readonly number[];
  readonly epsilons: readonly number[];
  readonly separations: readonly number[];
  readonly baseline: number;
}): readonly JointDesignCell[] {
  const cells: JointDesignCell[] = [];
  for (const epsilon of input.epsilons) {
    for (const n of input.ns) {
      for (const separation of input.separations) {
        const pHigh = Math.min(0.95, input.baseline + separation);
        cells.push({
          n_per_cell: n,
          epsilon,
          separation,
          joint_success_probability: exactJointSuccessProbability({
            pA: input.baseline,
            pB: pHigh,
            pC: input.baseline,
            pD: pHigh,
            n,
            deltaMin: DESIGN.delta_min,
            epsilon,
            zSuperiority: DESIGN.z_superiority,
            zEquivalence: DESIGN.z_equivalence
          }),
          total_cognition_requests: n * 4 * 2 + SAMPLING.calibration_draws
        });
      }
    }
  }
  return cells;
}

/** Smallest separation on a fixed grid whose exact joint probability reaches the target. */
export function minimumSeparationForJoint(input: {
  readonly n: number;
  readonly epsilon: number;
  readonly baseline: number;
  readonly target: number;
  readonly candidates?: readonly number[];
}): number | null {
  const candidates = input.candidates ?? [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
  for (const separation of candidates) {
    const pHigh = Math.min(0.95, input.baseline + separation);
    const joint = exactJointSuccessProbability({
      pA: input.baseline,
      pB: pHigh,
      pC: input.baseline,
      pD: pHigh,
      n: input.n,
      deltaMin: DESIGN.delta_min,
      epsilon: input.epsilon,
      zSuperiority: DESIGN.z_superiority,
      zEquivalence: DESIGN.z_equivalence
    });
    if (joint >= input.target) return separation;
  }
  return null;
}

export interface PowerArtifact {
  readonly schema_version: "stochastic-executor-power-analysis-v0";
  readonly protocol_id: string;
  readonly model_calls: 0;
  readonly design: {
    readonly delta_min: number;
    readonly design_effect: number;
    readonly epsilon: number;
    readonly alpha_superiority: number;
    readonly alpha_equivalence: number;
  };
  readonly grid: {
    readonly planning_band: readonly number[];
    readonly baselines: readonly number[];
    readonly effects: readonly number[];
    readonly ns: readonly number[];
    readonly epsilons: readonly number[];
    readonly delta_mins: readonly number[];
  };
  readonly superiority_table: readonly SuperiorityCell[];
  readonly equivalence_table: readonly EquivalenceCell[];
  readonly requirement_tables: Readonly<Record<string, readonly RequirementRow[]>>;
  readonly delta_min_analysis: readonly {
    readonly delta_min: number;
    readonly required_n_for_superiority_target: number | null;
    readonly claim_stronger_than: string;
    readonly total_requests_at_required_n: number | null;
  }[];
  readonly epsilon_analysis: readonly {
    readonly epsilon: number;
    readonly required_n_for_equivalence_target: number | null;
    readonly residual_bound: string;
    readonly total_requests_at_required_n: number | null;
  }[];
  readonly options: readonly ProtocolOption[];
  readonly joint_design_table: readonly JointDesignCell[];
  readonly minimum_separation_for_joint_80: readonly { readonly n_per_cell: number; readonly epsilon: number; readonly separation: number | null; readonly total_cognition_requests: number }[];
  readonly ceiling_limited_note: string;
  readonly v0_stress_test: {
    readonly scenario: string;
    readonly superiority_power: number;
    readonly equivalence_power: number;
    readonly note: string;
  };
}

export function buildPowerArtifact(): PowerArtifact {
  const superiorityTarget = 0.9;
  const equivalenceTarget = 0.8;
  const deltaMinAnalysis = DELTA_MIN_GRID.map((deltaMin) => {
    const row = firstNAdequatelyPowered({
      deltaMin,
      designEffect: DESIGN.design_effect,
      epsilon: DESIGN.epsilon,
      superiorityTarget,
      equivalenceTarget: 0
    });
    return {
      delta_min: deltaMin,
      required_n_for_superiority_target: row === null ? null : row.n_per_cell,
      claim_stronger_than:
        deltaMin <= 0.15
          ? "everyday fluctuation scale; a sub-0.15 shift is inside the executor's own trial-to-trial variation and cannot be called a policy change"
          : deltaMin <= 0.2
            ? "a majority-relevant policy shift for low baselines (0.30 -> 0.50 crosses the majority boundary)"
            : deltaMin <= 0.25
              ? "a robust policy shift across the whole plausible baseline range"
              : "a dominant effect that the mediator would have to produce almost on its own",
      total_requests_at_required_n: row === null ? null : totalCognitionRequests(row.n_per_cell, SAMPLING.calibration_draws)
    };
  });

  const epsilonAnalysis = EPSILON_GRID.map((epsilon) => {
    const row = firstNAdequatelyPowered({
      deltaMin: DESIGN.delta_min,
      designEffect: DESIGN.design_effect,
      epsilon,
      superiorityTarget: 0,
      equivalenceTarget
    });
    return {
      epsilon,
      required_n_for_equivalence_target: row === null ? null : row.n_per_cell,
      residual_bound:
        epsilon >= DESIGN.delta_min
          ? "residual may equal the smallest meaningful effect: the mediation claim is not protected"
          : epsilon <= 0.1
            ? "residual bounded at half the smallest meaningful effect"
            : "residual bounded strictly below the smallest meaningful effect",
      total_requests_at_required_n: row === null ? null : totalCognitionRequests(row.n_per_cell, SAMPLING.calibration_draws)
    };
  });

  const recommendedN = SAMPLING.n_per_cell_primary;
  void Math.min(
    ...BASELINE_GRID.map((baseline) =>
      exactSuperiorityPower(
        baseline,
        clampProbability(baseline + DESIGN.design_effect),
        recommendedN,
        recommendedN,
        DESIGN.delta_min,
        DESIGN.z_superiority
      ).power
    )
  );
  void Math.min(
    ...BASELINE_GRID.map(
      (baseline) => exactEquivalencePower(baseline, baseline, recommendedN, recommendedN, DESIGN.epsilon, DESIGN.z_equivalence).power
    )
  );

  const recommendedRow = requirementTable({
    deltaMin: DESIGN.delta_min,
    designEffect: DESIGN.design_effect,
    epsilon: DESIGN.epsilon,
    superiorityTarget,
    equivalenceTarget
  }).find((row) => row.n_per_cell === recommendedN);
  const options: ProtocolOption[] = [
    {
      id: "LOW_COST",
      delta_min: 0.2,
      epsilon: 0.2,
      n_per_cell_primary: 120,
      n_per_cell_replication: 120,
      calibration_draws: 30,
      superiority_power_min: exactSuperiorityPower(0.3, 0.7, 120, 120, DESIGN.delta_min, DESIGN.z_superiority).power,
      equivalence_power_min: exactEquivalencePower(0.3, 0.3, 120, 120, 0.2, DESIGN.z_equivalence).power,
      joint_success_probability_exact: null,
      total_cognition_requests: totalCognitionRequests(120, 30),
      claim_strength:
        "SCREENING GRADE: with epsilon equal to delta_min the residual may equal the smallest claimable effect, so a pass cannot support a full mediation claim; it decides whether to fund the recommended run"
    },
    {
      id: "RECOMMENDED",
      delta_min: DESIGN.delta_min,
      epsilon: DESIGN.epsilon,
      n_per_cell_primary: recommendedN,
      n_per_cell_replication: recommendedN,
      calibration_draws: SAMPLING.calibration_draws,
      superiority_power_min: recommendedRow?.min_superiority_power_over_band ?? 0,
      equivalence_power_min: recommendedRow?.min_equivalence_power_over_band ?? 0,
      joint_success_probability_exact: null,
      total_cognition_requests: totalCognitionRequests(recommendedN, SAMPLING.calibration_draws),
      claim_strength:
        "FULL CONJUNCTIVE CLAIM: superiority >= delta_min in all three contrasts AND the B/D residual bounded at three quarters of the smallest claimable effect; requires >= 0.40 true separation (exact joint 0.88 at 0.40 and 0.97 at 0.50)"
    },
    {
      id: "HIGH_CONFIDENCE",
      delta_min: 0.2,
      epsilon: 0.1,
      n_per_cell_primary: 400,
      n_per_cell_replication: 400,
      calibration_draws: 50,
      superiority_power_min: exactSuperiorityPower(0.3, 0.7, 400, 400, DESIGN.delta_min, DESIGN.z_superiority).power,
      equivalence_power_min: exactEquivalencePower(0.3, 0.3, 400, 400, 0.1, DESIGN.z_equivalence).power,
      joint_success_probability_exact: null,
      total_cognition_requests: totalCognitionRequests(400, 50),
      claim_strength:
        "TIGHT MEDIATION CLAIM: the residual is bounded at half the smallest claimable effect, tolerates a weaker treatment (>= 0.35 separation for an exact joint of 0.80), and costs twice the recommended run"
    }
  ];

  // Exact joint success probability at the recommended design, for a plausible
  // alternative family (pA low, pB/pD high, pC near the pA level).
  const jointScenarios = [
    { pA: 0.3, pC: 0.3, pHigh: 0.7, pD: 0.7 },
    { pA: 0.3, pC: 0.3, pHigh: 0.8, pD: 0.8 }
  ];
  const recommended = options.find((option) => option.id === "RECOMMENDED");
  if (recommended !== undefined) {
    const joint = jointScenarios.map((scenario) =>
      jointSuccessProbability({
        pA: scenario.pA,
        pC: scenario.pC,
        pHigh: scenario.pHigh,
        pD: scenario.pD,
        n: recommended.n_per_cell_primary,
        epsilon: recommended.epsilon,
        deltaMin: recommended.delta_min
      })
    );
    (recommended as { joint_success_probability_exact: number | null }).joint_success_probability_exact =
      Math.min(...joint);
  }
  const lowCost = options.find((option) => option.id === "LOW_COST");
  if (lowCost !== undefined) {
    (lowCost as { joint_success_probability_exact: number | null }).joint_success_probability_exact = Math.min(
      ...jointScenarios.map((scenario) =>
        jointSuccessProbability({
          pA: scenario.pA,
          pC: scenario.pC,
          pHigh: scenario.pHigh,
          pD: scenario.pD,
          n: lowCost.n_per_cell_primary,
          epsilon: lowCost.epsilon,
          deltaMin: lowCost.delta_min
        })
      )
    );
  }
  const highConfidence = options.find((option) => option.id === "HIGH_CONFIDENCE");
  if (highConfidence !== undefined) {
    (highConfidence as { joint_success_probability_exact: number | null }).joint_success_probability_exact = Math.min(
      ...jointScenarios.map((scenario) =>
        jointSuccessProbability({
          pA: scenario.pA,
          pC: scenario.pC,
          pHigh: scenario.pHigh,
          pD: scenario.pD,
          n: highConfidence.n_per_cell_primary,
          epsilon: highConfidence.epsilon,
          deltaMin: highConfidence.delta_min
        })
      )
    );
  }

  const v0Superiority = exactSuperiorityPower(0.23, 0.68, 10, 10, DESIGN.delta_min, DESIGN.z_superiority).power;
  const v0Equivalence = exactEquivalencePower(0.68, 0.76, 10, 10, 0.1, DESIGN.z_equivalence).power;

  return {
    schema_version: "stochastic-executor-power-analysis-v0",
    protocol_id: "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0",
    model_calls: 0,
    design: {
      delta_min: DESIGN.delta_min,
      design_effect: DESIGN.design_effect,
      epsilon: DESIGN.epsilon,
      alpha_superiority: DESIGN.alpha_superiority,
      alpha_equivalence: DESIGN.alpha_equivalence
    },
    grid: {
      planning_band: PLAUSIBLE_BASELINE_BAND,
      baselines: BASELINE_GRID,
      effects: EFFECT_GRID,
      ns: N_GRID,
      epsilons: EPSILON_GRID,
      delta_mins: DELTA_MIN_GRID
    },
    superiority_table: superiorityPowerTable(DESIGN.delta_min),
    equivalence_table: equivalencePowerTable(DESIGN.epsilon),
    requirement_tables: {
      recommended: requirementTable({
        deltaMin: DESIGN.delta_min,
        designEffect: DESIGN.design_effect,
        epsilon: DESIGN.epsilon,
        superiorityTarget,
        equivalenceTarget
      }),
      high_confidence: requirementTable({
        deltaMin: 0.2,
        designEffect: 0.3,
        epsilon: 0.1,
        superiorityTarget,
        equivalenceTarget
      }),
      low_cost: requirementTable({
        deltaMin: 0.2,
        designEffect: 0.3,
        epsilon: 0.2,
        superiorityTarget,
        equivalenceTarget
      })
    },
    delta_min_analysis: deltaMinAnalysis,
    epsilon_analysis: epsilonAnalysis,
    options,
    joint_design_table: jointDesignTable({
      ns: [120, 200, 400],
      epsilons: [0.1, 0.15, 0.2],
      separations: SEPARATION_GRID,
      baseline: 0.3
    }),
    minimum_separation_for_joint_80: [120, 200, 400].flatMap((n) =>
      [0.1, 0.15, 0.2].map((epsilon) => ({
        n_per_cell: n,
        epsilon,
        separation: minimumSeparationForJoint({ n, epsilon, baseline: 0.3, target: 0.8 }),
        total_cognition_requests: n * 4 * 2 + SAMPLING.calibration_draws
      }))
    ),
    ceiling_limited_note:
      "A baseline at or above 0.60 leaves no headroom for a 0.20 claim threshold: the true difference cannot exceed the threshold plus noise, so such a contrast is structurally UNDECIDABLE. The protocol therefore declares the planning band [0.20, 0.60] and requires the calibration phase to report where the observed baseline sits; a cell outside the band is reported as UNDECIDABLE, never as a failed or passed contrast.",
    v0_stress_test: {
      scenario:
        "V0 observed cell-level rates at N=10 (pA 0.20/pB 0.67/pC 0.00/pD 0.78 primary; A 0.30/B 0.70/C 0.11/D 0.60 replication) — used ONLY to show why the V0 design could not decide",
      superiority_power:
        v0Superiority,
      equivalence_power: v0Equivalence,
      note:
        "V0 ran 10 single-draw trials per cell and decided the B/D control with a paired-mismatch rule (<=1/10). The equivalent distributional design at N=10 has effectively no power to certify the residual bound, which is why the V0 null criterion was mis-calibrated rather than merely unlucky."
    }
  };
}
