/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — verdict law.
 *
 * The statistical law and the verdict semantics are IMPORTED from the frozen
 * measurement protocol: `conjunctiveDecision` (Wilson / Newcombe / TOST / exact
 * enumeration) and the frozen constants `DESIGN`, `HOST_VALIDITY`. Nothing is
 * re-implemented and nothing is retuned.
 *
 * The experiment adds its own gate registry (§38, 17 gates) whose verdict
 * consumption is proven by tests: every gate can block a success verdict.
 */
import {
  CONFLATION_LAW,
  DESIGN,
  HOST_VALIDITY,
  PROTOCOL_ID,
  SAMPLING
} from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";
import { conjunctiveDecision, type ConjunctiveDecision } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/statistics.ts";

import { CELL_IDS, HARD_GATE_IDS, VERDICT_MENU, type CellId } from "./contract.ts";

export interface CellCounts {
  readonly scheduled: number;
  readonly host_valid: number;
  readonly realize: number;
  readonly conflation_flags: number;
}

export interface VerdictInput {
  readonly phase: "PRIMARY" | "REPLICATION";
  readonly cells: Readonly<Record<CellId, CellCounts>>;
  readonly prereg_sha_matches: boolean;
  readonly manifest_valid: boolean;
  readonly seed_belief_empty: boolean;
  readonly formation_attested: boolean;
  readonly raw_history_leaks: number;
  readonly retrieval_exposed: boolean;
  readonly non_belief_state_equal: boolean;
  readonly a_b_only_belief_difference: boolean;
  readonly b_d_full_input_identity: boolean;
  readonly intervention_production_writes: number;
  readonly secret_safety_clean: boolean;
  readonly accounting: {
    readonly planned: number;
    readonly actual: number;
    readonly unique: number;
    readonly duplicate: number;
    readonly missing: number;
    readonly extra: number;
  };
  readonly primary_conjunction_passed: boolean | null;
  readonly replication_conjunction_passed: boolean | null;
}

export interface GateEvaluation {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export type GateEvaluator = (input: VerdictInput) => GateEvaluation;

const cellList = CELL_IDS;

function totals(input: VerdictInput): { scheduled: number; valid: number; flags: number } {
  return {
    scheduled: cellList.reduce((total, cell) => total + input.cells[cell].scheduled, 0),
    valid: cellList.reduce((total, cell) => total + input.cells[cell].host_valid, 0),
    flags: cellList.reduce((total, cell) => total + input.cells[cell].conflation_flags, 0)
  };
}

export const HARD_GATE_EVALUATORS: Readonly<Record<string, GateEvaluator>> = Object.freeze({
  PREREG_SHA_MATCH: (input) => ({
    id: "PREREG_SHA_MATCH",
    passed: input.prereg_sha_matches,
    detail: "HEAD equals the recorded PREREGISTRATION_COMMIT"
  }),
  MANIFEST_VALID: (input) => ({
    id: "MANIFEST_VALID",
    passed: input.manifest_valid,
    detail: "frozen manifest verifies offline from the preregistration commit blobs"
  }),
  SEED_BELIEF_EMPTY: (input) => ({
    id: "SEED_BELIEF_EMPTY",
    passed: input.seed_belief_empty,
    detail: "normal genesis contains zero canonical beliefs in both branches"
  }),
  FORMATION_ATTESTATION: (input) => ({
    id: "FORMATION_ATTESTATION",
    passed: input.formation_attested,
    detail: "LOW/HIGH progressions and proposition identity are attested exactly"
  }),
  RAW_HISTORY_ZERO: (input) => ({
    id: "RAW_HISTORY_ZERO",
    passed: input.raw_history_leaks === 0,
    detail: `raw history occurrences in model-facing input: ${input.raw_history_leaks}`
  }),
  MEMORY_RETRIEVAL_ZERO: (input) => ({
    id: "MEMORY_RETRIEVAL_ZERO",
    passed: !input.retrieval_exposed,
    detail: "retrieved historical memory exposure is zero (or strictly equalized)"
  }),
  NON_BELIEF_STATE_EQUAL: (input) => ({
    id: "NON_BELIEF_STATE_EQUAL",
    passed: input.non_belief_state_equal,
    detail: "affect/relationship/personality/regulation/environment/context/identity matched"
  }),
  A_B_ONLY_BELIEF_DIFFERENCE: (input) => ({
    id: "A_B_ONLY_BELIEF_DIFFERENCE",
    passed: input.a_b_only_belief_difference,
    detail: "A and B differ only in the target Belief representation"
  }),
  B_D_FULL_INPUT_IDENTITY: (input) => ({
    id: "B_D_FULL_INPUT_IDENTITY",
    passed: input.b_d_full_input_identity,
    detail: "B and D model-facing input is byte-identical"
  }),
  INTERVENTION_NO_PRODUCTION_WRITE: (input) => ({
    id: "INTERVENTION_NO_PRODUCTION_WRITE",
    passed: input.intervention_production_writes === 0,
    detail: `durable writes caused by an intervention: ${input.intervention_production_writes}`
  }),
  TRUTH_CONFLATION_ZERO_FLAGS: (input) => ({
    id: "TRUTH_CONFLATION_ZERO_FLAGS",
    passed: totals(input).flags <= CONFLATION_LAW.hard_gate_threshold,
    detail: `deterministic classifier flags: ${totals(input).flags} (means ${CONFLATION_LAW.pass_means})`
  }),
  HOST_VALIDITY: (input) => {
    const { scheduled, valid } = totals(input);
    const rate = scheduled === 0 ? 0 : valid / scheduled;
    const belowFloor = cellList.filter(
      (cell) => input.cells[cell].host_valid / Math.max(1, input.cells[cell].scheduled) < SAMPLING.minimum_valid_fraction_per_cell
    );
    return {
      id: "HOST_VALIDITY",
      passed: scheduled > 0 && rate >= HOST_VALIDITY.minimum_overall_rate && belowFloor.length === 0,
      detail: `host-valid ${valid}/${scheduled} = ${rate.toFixed(4)}; cells below the per-cell floor: ${belowFloor.join(", ") || "none"}`
    };
  },
  CELL_INVALID_IMBALANCE: (input) => {
    const rates = cellList.map((cell) => 1 - input.cells[cell].host_valid / Math.max(1, input.cells[cell].scheduled));
    const spread = Math.max(...rates) - Math.min(...rates);
    return {
      id: "CELL_INVALID_IMBALANCE",
      passed: spread <= HOST_VALIDITY.maximum_cell_imbalance,
      detail: `invalid-rate spread ${spread.toFixed(4)} (max ${HOST_VALIDITY.maximum_cell_imbalance})`
    };
  },
  CALL_ACCOUNTING: (input) => {
    const { planned, actual, unique, duplicate, missing, extra } = input.accounting;
    return {
      id: "CALL_ACCOUNTING",
      passed: planned === actual && actual === unique && duplicate === 0 && missing === 0 && extra === 0,
      detail: `planned=${planned} actual=${actual} unique=${unique} duplicate=${duplicate} missing=${missing} extra=${extra}`
    };
  },
  SECRET_SAFETY: (input) => ({
    id: "SECRET_SAFETY",
    passed: input.secret_safety_clean,
    detail: "no credential literal, authorization header or provider secret in any tracked artifact"
  }),
  PRIMARY_FULL_CONJUNCTION: (input) => ({
    id: "PRIMARY_FULL_CONJUNCTION",
    passed: input.primary_conjunction_passed === true,
    detail: `primary conjunction: ${String(input.primary_conjunction_passed)}`
  }),
  REPLICATION_FULL_CONJUNCTION: (input) => ({
    id: "REPLICATION_FULL_CONJUNCTION",
    passed: input.replication_conjunction_passed === true,
    detail: `replication conjunction: ${String(input.replication_conjunction_passed)}`
  })
});

const GATE_FAILURE_VERDICT: Readonly<Record<string, string>> = Object.freeze({
  PREREG_SHA_MATCH: "EXPERIMENT_INVALID",
  MANIFEST_VALID: "EXPERIMENT_INVALID",
  SEED_BELIEF_EMPTY: "EXPERIMENT_INVALID",
  FORMATION_ATTESTATION: "EXPERIMENT_INVALID",
  RAW_HISTORY_ZERO: "BELIEF_EFFECT_CONFOUNDED_BY_RAW_HISTORY",
  MEMORY_RETRIEVAL_ZERO: "BELIEF_EFFECT_CONFOUNDED_BY_MEMORY_RETRIEVAL",
  NON_BELIEF_STATE_EQUAL: "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  A_B_ONLY_BELIEF_DIFFERENCE: "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  B_D_FULL_INPUT_IDENTITY: "BELIEF_MEDIATOR_EQUALIZATION_FAILED",
  INTERVENTION_NO_PRODUCTION_WRITE: "EXPERIMENT_INVALID",
  TRUTH_CONFLATION_ZERO_FLAGS: "BELIEF_CAUSAL_TRUTH_CONFLATION_FAILED",
  HOST_VALIDITY: "BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED",
  CELL_INVALID_IMBALANCE: "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
  CALL_ACCOUNTING: "BELIEF_CAUSAL_ACCOUNTING_FAILED",
  SECRET_SAFETY: "EXPERIMENT_INVALID",
  PRIMARY_FULL_CONJUNCTION: "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
  REPLICATION_FULL_CONJUNCTION: "BELIEF_CAUSAL_RESULT_INCONCLUSIVE"
});

export interface ConfirmatoryVerdict {
  readonly protocol_id: string;
  readonly experiment_id: string;
  readonly phase: string;
  readonly gates: readonly GateEvaluation[];
  readonly failed_gates: readonly string[];
  readonly decision: ConjunctiveDecision;
  readonly verdict: string;
  readonly interpretation: string;
}

export function evaluateHardGates(input: VerdictInput): readonly GateEvaluation[] {
  return HARD_GATE_IDS.map((id) => {
    const evaluator = HARD_GATE_EVALUATORS[id];
    if (evaluator === undefined) throw new Error(`HARD_GATE_REGISTRY: missing evaluator for ${id}`);
    return evaluator(input);
  });
}

/**
 * §40 NOT_REPLICATED law, taken from the frozen framework: a run is a genuine null
 * only when NO superiority contrast reaches the claim threshold (all three fail)
 * while every hard gate passes; anything else that is not a full conjunction is
 * INCONCLUSIVE.
 */
export const CONJUNCTION_GATE_IDS: readonly string[] = Object.freeze([
  "PRIMARY_FULL_CONJUNCTION",
  "REPLICATION_FULL_CONJUNCTION"
]);

export function deriveConfirmatoryVerdict(input: VerdictInput): ConfirmatoryVerdict {
  const gates = evaluateHardGates(input);
  const failed = gates.filter((gate) => !gate.passed).map((gate) => gate.id);
  // The two conjunction gates express the phase-level requirement; they are
  // checked AFTER the confounder gates so a valid protocol showing no effect can
  // still reach the frozen null verdict instead of being masked as a gate failure.
  const confounderFailures = failed.filter((id) => !CONJUNCTION_GATE_IDS.includes(id));
  const decision = conjunctiveDecision({
    // The frozen statistics law is keyed A/B/C/D; the experiment's cells map onto
    // them by construction (A = LOW, B = HIGH, C = HIGH-ablated, D = LOW-equalized).
    counts: {
      A: input.cells.A_LOW,
      B: input.cells.B_HIGH,
      C: input.cells.C_HIGH_ABLATED,
      D: input.cells.D_LOW_EQUALIZED
    },
    deltaMin: DESIGN.delta_min,
    epsilon: DESIGN.epsilon,
    zSuperiority: DESIGN.z_superiority,
    zEquivalence: DESIGN.z_equivalence
  });
  let verdict: string;
  let interpretation: string;
  if (confounderFailures.length > 0) {
    const first = confounderFailures[0] as string;
    verdict = GATE_FAILURE_VERDICT[first] ?? "EXPERIMENT_INVALID";
    interpretation = `hard gate failure (${confounderFailures.join(", ")}): the run cannot support a causal claim`;
  } else if (decision.joint && failed.length === 0) {
    verdict = "BELIEF_CAUSAL_INFLUENCE_REPLICATED";
    interpretation =
      "all four preregistered constraints passed simultaneously in this phase: the effect is mediated by the model-facing Belief representation";
  } else if (!decision.C1_AB_superiority && !decision.C2_BC_superiority && !decision.C4_DA_superiority) {
    verdict = "BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED";
    interpretation = "no superiority contrast reached the preregistered minimum effect under a valid protocol (a genuine null)";
  } else {
    verdict = "BELIEF_CAUSAL_RESULT_INCONCLUSIVE";
    interpretation = "the conjunctive law is not satisfied: at least one required contrast is undecided";
  }
  if (!VERDICT_MENU.includes(verdict)) throw new Error(`VERDICT_MENU_VIOLATION: ${verdict}`);
  return {
    protocol_id: PROTOCOL_ID,
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    phase: input.phase,
    gates,
    failed_gates: failed,
    decision,
    verdict,
    interpretation
  };
}
