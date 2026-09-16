/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — verdict law.
 *
 * `deriveVerdict` is the ONLY place a run's success claim is produced, and it
 * consumes `evaluateHardGates` unconditionally: a declared hard gate that is not
 * wired here cannot exist (the registry in contract.ts is the single source).
 */
import {
  ANALYSIS_LAW,
  DESIGN,
  HARD_GATE_IDS,
  PROTOCOL_ID,
  evaluateHardGates,
  type GateEvaluation,
  type VerdictInput
} from "./contract.ts";
import { conjunctiveDecision, type ConjunctiveDecision } from "./statistics.ts";

export const FINAL_VERDICTS = [
  "BELIEF_CAUSAL_INFLUENCE_REPLICATED",
  "BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED",
  "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
  "BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED",
  "BELIEF_EFFECT_CONFOUNDED_BY_RAW_HISTORY",
  "BELIEF_EFFECT_CONFOUNDED_BY_MEMORY_RETRIEVAL",
  "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  "BELIEF_MEDIATOR_EQUALIZATION_FAILED",
  "BELIEF_CAUSAL_TRUTH_CONFLATION_FAILED",
  "BELIEF_CAUSAL_ACCOUNTING_FAILED",
  "EXPERIMENT_INVALID"
] as const;
export type FinalVerdict = (typeof FINAL_VERDICTS)[number];

export interface RunVerdict {
  readonly protocol_id: string;
  readonly phase: string;
  readonly gates: readonly GateEvaluation[];
  readonly failed_gates: readonly string[];
  readonly decision: ConjunctiveDecision;
  readonly verdict: FinalVerdict;
  readonly interpretation: string;
}

/** Gate failure → the specific confounder verdict; the first failure wins. */
const GATE_FAILURE_VERDICT: Readonly<Record<string, FinalVerdict>> = Object.freeze({
  HOST_VALIDITY_OVERALL: "BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED",
  HOST_VALIDITY_PER_CELL_MINIMUM: "BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED",
  INVALID_IMBALANCE_AUDIT: "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
  RAW_HISTORY_ISOLATION: "BELIEF_EFFECT_CONFOUNDED_BY_RAW_HISTORY",
  RETRIEVAL_ISOLATION: "BELIEF_EFFECT_CONFOUNDED_BY_MEMORY_RETRIEVAL",
  NON_BELIEF_STATE_EQUALITY: "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  NON_BELIEF_PROMPT_EQUIVALENCE: "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  B_D_INPUT_IDENTITY: "BELIEF_MEDIATOR_EQUALIZATION_FAILED",
  INTERVENTION_BELIEF_STABILITY: "EXPERIMENT_INVALID",
  FRESH_PROCESS_RESTORE: "EXPERIMENT_INVALID",
  TRUTH_CONFLATION: "BELIEF_CAUSAL_TRUTH_CONFLATION_FAILED",
  CALL_ACCOUNTING: "BELIEF_CAUSAL_ACCOUNTING_FAILED"
});

export function deriveVerdict(input: VerdictInput): RunVerdict {
  const gates = evaluateHardGates(input);
  const failed = gates.filter((gate) => !gate.passed).map((gate) => gate.id);
  const decision = conjunctiveDecision({
    counts: input.cells,
    deltaMin: DESIGN.delta_min,
    epsilon: DESIGN.epsilon,
    zSuperiority: DESIGN.z_superiority,
    zEquivalence: DESIGN.z_equivalence
  });

  let verdict: FinalVerdict;
  let interpretation: string;
  if (failed.length > 0) {
    const first = failed[0] as string;
    verdict = GATE_FAILURE_VERDICT[first] ?? "EXPERIMENT_INVALID";
    interpretation = `hard gate failure (${failed.join(", ")}): the run cannot support any causal claim`;
  } else if (decision.joint) {
    verdict = "BELIEF_CAUSAL_INFLUENCE_REPLICATED";
    interpretation =
      "all four preregistered constraints passed simultaneously: the difference is mediated by the model-facing Belief representation";
  } else if (!decision.C1_AB_superiority && !decision.C2_BC_superiority && !decision.C4_DA_superiority) {
    verdict = "BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED";
    interpretation = "no superiority contrast reached the preregistered minimum effect (a genuine null under a valid protocol)";
  } else {
    verdict = "BELIEF_CAUSAL_RESULT_INCONCLUSIVE";
    interpretation =
      "the conjunctive law is not satisfied: at least one required contrast is undecided (neither a claimable effect nor a null)";
  }

  return {
    protocol_id: PROTOCOL_ID,
    phase: input.phase,
    gates,
    failed_gates: failed,
    decision,
    verdict,
    interpretation
  };
}

/** Contract-completeness guard used by the integrity tests. */
export function assertGateRegistryComplete(): readonly string[] {
  return HARD_GATE_IDS;
}

export { ANALYSIS_LAW };
