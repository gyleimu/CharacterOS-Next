/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — CALIBRATION_RUN_STOP_LAW_V1.
 *
 * EXPERIMENT-LEVEL OPERATIONAL READINESS LAW — explicitly NOT a new causal
 * statistical law. It does not modify `Δ_min`, `ε`, N, the primary outcome or the
 * confirmatory success law, and it is derived from the frozen measurement
 * protocol rather than invented here:
 *
 *   the frozen overall host-validity floor is 0.95
 *   the scheduled calibration size is 50
 *   therefore MINIMUM_HOST_VALID_COUNT = ceil(50 × 0.95) = 48   (47/50 = 0.94 fails, 48/50 = 0.96 passes)
 *   and MAXIMUM_NON_HOST_VALID_COUNT = 2
 *
 * NO outcome-diversity gate exists: 50/50 REALIZE and 50/50 CLARIFY are both
 * lawful RUN outcomes. Stochasticity and truth-conflation flags are recorded as
 * DIAGNOSTICS only and can never change this law.
 */
import { HOST_VALIDITY, SAMPLING } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";

export const CALIBRATION_LAW_ID = "CALIBRATION_RUN_STOP_LAW_V1" as const;
export const CALIBRATION_LAW_KIND = "EXPERIMENT_OPERATIONAL_READINESS_LAW" as const;

export const CALIBRATION_SCHEDULED_LOGICAL_TRIALS = SAMPLING.calibration_draws;
export const CALIBRATION_MINIMUM_HOST_VALID_COUNT = Math.ceil(
  SAMPLING.calibration_draws * HOST_VALIDITY.minimum_overall_rate
);
export const CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT =
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS - CALIBRATION_MINIMUM_HOST_VALID_COUNT;

/** The frozen V8 primary-outcome atoms; the menu is never widened here. */
export const ALLOWED_DIRECTIVE_ATOMS: readonly string[] = Object.freeze([
  "REALIZE_CURRENT_INTENT",
  "CLARIFY_MISSING_CONTEXT"
]);

export const CALIBRATION_INTEGRITY_GATE_IDS: readonly string[] = Object.freeze([
  "PREREG_SHA_MATCH",
  "MANIFEST_VALID",
  "DESIGN_REDERIVATION",
  "TRACKED_TREE_CLEAN",
  "REQUEST_HASH_IDENTITY",
  "MODEL_IDENTITY",
  "CONFIG_HASH_IDENTITY",
  "SCHEMA_HASH_IDENTITY",
  "SYSTEM_HASH_IDENTITY",
  "USER_HASH_IDENTITY",
  "RETRY_LEGALITY",
  "SECRET_SAFETY",
  "NO_PRODUCTION_WRITE",
  "NO_FORBIDDEN_PROVIDER"
]);

export const CALIBRATION_STOP_TRIGGERS: readonly string[] = Object.freeze([
  "manifest mismatch",
  "design re-derivation mismatch",
  "formal SHA mismatch",
  "tracked tree dirty",
  "request hash drift",
  "model config drift",
  "response schema drift",
  "system/user payload drift",
  "illegal retry",
  "secret safety failure",
  "host_valid < 48/50",
  "non_host_valid > 2",
  "forbidden network/provider",
  "production write",
  "unexpected code-state mutation"
]);

export const CALIBRATION_LAW = Object.freeze({
  id: CALIBRATION_LAW_ID,
  kind: CALIBRATION_LAW_KIND,
  scheduled_logical_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  minimum_host_valid_count: CALIBRATION_MINIMUM_HOST_VALID_COUNT,
  maximum_non_host_valid_count: CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT,
  validity_threshold_source:
    "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 HOST_VALIDITY.minimum_overall_rate = 0.95, discretized over the 50 scheduled draws as ceil(50 x 0.95) = 48",
  allowed_directive_atoms: ALLOWED_DIRECTIVE_ATOMS,
  outcome_diversity_gate: "NONE",
  stochasticity_role: "DIAGNOSTIC_ONLY",
  truth_conflation_role: "DIAGNOSTIC_ONLY",
  early_stop_on_third_non_host_valid: true,
  invalid_trials_replaced: false,
  retry_law: "FROZEN_TRANSPORT_ONLY (429/5xx/timeout/transport reset, byte-identical request, never schema-invalid)",
  integrity_gates: CALIBRATION_INTEGRITY_GATE_IDS,
  modifies: [] as readonly string[]
});

export type CalibrationDecision = "EXECUTOR_CALIBRATION_RUN" | "EXECUTOR_CALIBRATION_STOP" | "EXECUTOR_CALIBRATION_STOP_EARLY";

export interface CalibrationLawInput {
  readonly scheduled_trials: number;
  readonly executed_trials: number;
  readonly host_valid_count: number;
  readonly non_host_valid_count: number;
  readonly integrity_gates: Readonly<Record<string, boolean>>;
  readonly early_stopped: boolean;
}

export interface CalibrationLawDecision {
  readonly law_id: string;
  readonly decision: CalibrationDecision;
  readonly failed_integrity_gates: readonly string[];
  readonly detail: string;
}

/**
 * The machine-readable decision. Integrity gates dominate; the host-validity
 * floor is applied exactly as discretized above.
 */
export function evaluateCalibrationLaw(input: CalibrationLawInput): CalibrationLawDecision {
  const failed = Object.entries(input.integrity_gates)
    .filter(([, passed]) => !passed)
    .map(([id]) => id);
  if (failed.length > 0) {
    return {
      law_id: CALIBRATION_LAW_ID,
      decision: "EXECUTOR_CALIBRATION_STOP",
      failed_integrity_gates: failed,
      detail: `integrity gate failure (${failed.join(", ")}): calibration cannot authorize readiness`
    };
  }
  if (input.early_stopped) {
    return {
      law_id: CALIBRATION_LAW_ID,
      decision: "EXECUTOR_CALIBRATION_STOP_EARLY",
      failed_integrity_gates: [],
      detail: `deterministic early stop: the ${CALIBRATION_MINIMUM_HOST_VALID_COUNT}/${input.scheduled_trials} floor became unreachable (non-host-valid = ${input.non_host_valid_count} > ${CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT})`
    };
  }
  if (input.executed_trials !== input.scheduled_trials) {
    return {
      law_id: CALIBRATION_LAW_ID,
      decision: "EXECUTOR_CALIBRATION_STOP",
      failed_integrity_gates: [],
      detail: `executed ${input.executed_trials} of ${input.scheduled_trials} scheduled logical trials`
    };
  }
  if (
    input.host_valid_count >= CALIBRATION_MINIMUM_HOST_VALID_COUNT &&
    input.non_host_valid_count <= CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT
  ) {
    return {
      law_id: CALIBRATION_LAW_ID,
      decision: "EXECUTOR_CALIBRATION_RUN",
      failed_integrity_gates: [],
      detail: `host-valid ${input.host_valid_count}/${input.scheduled_trials} >= ${CALIBRATION_MINIMUM_HOST_VALID_COUNT} and non-host-valid ${input.non_host_valid_count} <= ${CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT}: the frozen 0.95 host-validity floor is met`
    };
  }
  return {
    law_id: CALIBRATION_LAW_ID,
    decision: "EXECUTOR_CALIBRATION_STOP",
    failed_integrity_gates: [],
    detail: `host-valid ${input.host_valid_count}/${input.scheduled_trials} < ${CALIBRATION_MINIMUM_HOST_VALID_COUNT} (frozen 0.95 floor)`
  };
}

/**
 * Deterministic early-stop law: once the non-host-valid count EXCEEDS the
 * maximum, even a perfect remainder cannot reach the 48/50 floor, so the
 * remaining draws are mathematically futile and the run stops.
 */
export function floorUnreachable(nonHostValidCount: number): boolean {
  return nonHostValidCount > CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT;
}
