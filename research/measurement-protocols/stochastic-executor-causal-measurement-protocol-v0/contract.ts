/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — frozen protocol contract.
 *
 * This file IS the design law for the NEXT confirmatory Belief→Cognition
 * experiment. It contains no experiment results and performs no model calls.
 *
 * Two structural rules are enforced here rather than documented elsewhere:
 *
 *   1. EVERY hard gate is an executable evaluator in ONE registry
 *      (`HARD_GATE_EVALUATORS`), and `deriveVerdict` consumes that registry.
 *      A gate cannot be declared without being wired into the verdict.
 *   2. The success claim is CONJUNCTIVE (intersection of four pre-registered
 *      decisions plus the gate set), never "one significant contrast".
 */

export const PROTOCOL_ID = "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0" as const;
export const PROTOCOL_SCHEMA_VERSION = "stochastic-executor-causal-measurement-protocol-v0" as const;

/** §4 primary outcome: the frozen, production-grounded binary directive class. */
export const PRIMARY_OUTCOME = Object.freeze({
  field: "communication_directive.kind",
  positive_class: "REALIZE_CURRENT_INTENT",
  negative_class: "CLARIFY_MISSING_CONTEXT",
  forbidden_alternatives: ["free_text_sentiment", "keyword_match", "manual_judgment", "llm_judge"]
});

/** §6 estimands. */
export const ESTIMANDS = Object.freeze({
  pA: "P(REALIZE_CURRENT_INTENT | cell A frozen model-facing input) — LOW durable belief, LOW mediator",
  pB: "P(REALIZE_CURRENT_INTENT | cell B frozen model-facing input) — HIGH durable belief, HIGH mediator",
  pC: "P(REALIZE_CURRENT_INTENT | cell C frozen model-facing input) — HIGH durable belief, mediator ablated",
  pD: "P(REALIZE_CURRENT_INTENT | cell D frozen model-facing input) — LOW durable belief, mediator equalized to HIGH",
  delta_AB: "pB - pA (C1 superiority: total belief-mediated cognition effect)",
  delta_BC: "pB - pC (C2 superiority: mediator necessity)",
  delta_DA: "pD - pA (C4 superiority: mediator sufficiency)",
  delta_BD: "pB - pD (C3 equivalence: residual direct history / canonical-state effect)"
});

/**
 * §10 claim threshold, §7 equivalence margin, §16 targets.
 * Selected values are justified in DECISION.md from first principles and from
 * the offline power analysis — never from the V0 observed differences.
 */
export const DESIGN = Object.freeze({
  /** Smallest Belief-mediated shift in P(REALIZE) worth calling a meaningful cognition influence. */
  delta_min: 0.2,
  /**
   * True effect the design is POWERED for. Independent of the claim threshold:
   * the claim threshold is the floor of what may be claimed, while the design is
   * powered for an effect comfortably above it (twice the threshold), because a
   * minimum-effect test has ~50 % power at exactly the minimum by construction.
   */
  design_effect: 0.4,
  /** Residual |pB - pD| that still leaves the mediator the dominant explanation. */
  epsilon: 0.15,
  /** One-sided alpha for each superiority contrast (minimum-effect test). */
  alpha_superiority: 0.025,
  /** Per-side alpha for the TOST equivalence test. */
  alpha_equivalence: 0.05,
  z_superiority: 1.959963984540054,
  z_equivalence: 1.6448536269514722
});

/** §15/§28 sampling plan. */
export const SAMPLING = Object.freeze({
  n_per_cell_primary: 200,
  n_per_cell_replication: 200,
  calibration_draws: 50,
  /** Every cell must retain at least this fraction of its scheduled draws. */
  minimum_valid_fraction_per_cell: 0.9
});

/** §21/§25 host-validity law. */
export const HOST_VALIDITY = Object.freeze({
  minimum_overall_rate: 0.95,
  maximum_cell_imbalance: 0.05,
  imputation: "FORBIDDEN"
});

/** §22 retry law (identical to the frozen V0 transport law). */
export const RETRY_LAW = Object.freeze({
  max_attempts: 3,
  retry_on_http: [429, 500, 502, 503, 504] as readonly number[],
  retry_on_transport: ["MODEL_TIMEOUT", "MODEL_CONNECTION_FAILURE", "MODEL_EMPTY_RESPONSE"] as readonly string[],
  backoff_ms: [4000, 12000] as readonly number[],
  retry_on_schema_invalid: false,
  retry_on_unwanted_behavior: false,
  request_mutation_between_attempts: "FORBIDDEN"
});

/** §35 truth-conflation gate. */
export const CONFLATION_LAW = Object.freeze({
  classifier_id: "NEGATION_AWARE_CERTAINTY_ASSERTION_V1",
  scope: "deterministic, host-side, sentence-local negation window",
  hard_gate_threshold: 0,
  false_negative_direction_documented: true
});

/** §36 call accounting law. */
export const ACCOUNTING_LAW = Object.freeze({
  required_equalities: ["planned == actual", "actual == unique", "duplicate == 0", "missing == 0", "extra == 0"]
});

/* ------------------------------------------------------------------------- *
 * Executable hard gates (§36): declared ⟺ wired into the verdict.
 * ------------------------------------------------------------------------- */

export interface CellCountsInput {
  readonly scheduled: number;
  readonly host_valid: number;
  readonly realize: number;
}

export interface VerdictInput {
  readonly phase: "PRIMARY" | "REPLICATION";
  readonly cells: Readonly<Record<"A" | "B" | "C" | "D", CellCountsInput>>;
  readonly isolation: {
    readonly raw_history_leaks: number;
    readonly retrieval_exposed: boolean;
    readonly non_belief_state_equal: boolean;
    readonly non_belief_prompt_equal: boolean;
    readonly b_d_input_identical: boolean;
    readonly intervention_belief_stable: boolean;
    readonly fresh_process_restores: number;
    readonly scheduled_scenes: number;
  };
  readonly conflation_flags: number;
  readonly accounting: {
    readonly planned: number;
    readonly actual: number;
    readonly unique: number;
    readonly duplicate: number;
    readonly missing: number;
    readonly extra: number;
  };
}

export interface GateEvaluation {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export type GateEvaluator = (input: VerdictInput) => GateEvaluation;

const CELL_IDS = ["A", "B", "C", "D"] as const;

function hostValidityOverall(input: VerdictInput): GateEvaluation {
  const scheduled = CELL_IDS.reduce((total, cell) => total + input.cells[cell].scheduled, 0);
  const valid = CELL_IDS.reduce((total, cell) => total + input.cells[cell].host_valid, 0);
  const rate = scheduled === 0 ? 0 : valid / scheduled;
  return {
    id: "HOST_VALIDITY_OVERALL",
    passed: scheduled > 0 && rate >= HOST_VALIDITY.minimum_overall_rate,
    detail: `host-valid ${valid}/${scheduled} = ${rate.toFixed(4)} (min ${HOST_VALIDITY.minimum_overall_rate})`
  };
}

function hostValidityPerCell(input: VerdictInput): GateEvaluation {
  const failures = CELL_IDS.filter(
    (cell) => input.cells[cell].host_valid / Math.max(1, input.cells[cell].scheduled) < SAMPLING.minimum_valid_fraction_per_cell
  );
  return {
    id: "HOST_VALIDITY_PER_CELL_MINIMUM",
    passed: failures.length === 0,
    detail: failures.length === 0
      ? `every cell retains >= ${SAMPLING.minimum_valid_fraction_per_cell} of scheduled draws`
      : `cells below the minimum usable N: ${failures.join(", ")}`
  };
}

function invalidImbalance(input: VerdictInput): GateEvaluation {
  const rates = CELL_IDS.map((cell) => 1 - input.cells[cell].host_valid / Math.max(1, input.cells[cell].scheduled));
  const imbalance = Math.max(...rates) - Math.min(...rates);
  return {
    id: "INVALID_IMBALANCE_AUDIT",
    passed: imbalance <= HOST_VALIDITY.maximum_cell_imbalance,
    detail: `invalid-rate spread across cells = ${imbalance.toFixed(4)} (max ${HOST_VALIDITY.maximum_cell_imbalance})`
  };
}

function rawHistoryIsolation(input: VerdictInput): GateEvaluation {
  return {
    id: "RAW_HISTORY_ISOLATION",
    passed: input.isolation.raw_history_leaks === 0,
    detail: `raw-history refs visible in model-facing input: ${input.isolation.raw_history_leaks}`
  };
}

function retrievalIsolation(input: VerdictInput): GateEvaluation {
  return {
    id: "RETRIEVAL_ISOLATION",
    passed: !input.isolation.retrieval_exposed,
    detail: input.isolation.retrieval_exposed ? "per-condition retrieval exposure detected" : "retrieval exposure empty in every cell"
  };
}

function nonBeliefState(input: VerdictInput): GateEvaluation {
  return {
    id: "NON_BELIEF_STATE_EQUALITY",
    passed: input.isolation.non_belief_state_equal,
    detail: "affect/relationship/personality/context/memory/identity/logical-time/revision equality across conditions"
  };
}

function nonBeliefPrompt(input: VerdictInput): GateEvaluation {
  return {
    id: "NON_BELIEF_PROMPT_EQUIVALENCE",
    passed: input.isolation.non_belief_prompt_equal,
    detail: "normalized non-belief model-facing surface identical across cells"
  };
}

function bdInputIdentity(input: VerdictInput): GateEvaluation {
  return {
    id: "B_D_INPUT_IDENTITY",
    passed: input.isolation.b_d_input_identical,
    detail: "B and D model-facing requests byte-identical (mediator equalization)"
  };
}

function interventionStability(input: VerdictInput): GateEvaluation {
  return {
    id: "INTERVENTION_BELIEF_STABILITY",
    passed: input.isolation.intervention_belief_stable,
    detail: "durable belief unchanged by every research-side intervention"
  };
}

function persistenceRestore(input: VerdictInput): GateEvaluation {
  return {
    id: "FRESH_PROCESS_RESTORE",
    passed: input.isolation.fresh_process_restores === input.isolation.scheduled_scenes && input.isolation.scheduled_scenes > 0,
    detail: `authoritative restores ${input.isolation.fresh_process_restores}/${input.isolation.scheduled_scenes}`
  };
}

function conflationGate(input: VerdictInput): GateEvaluation {
  return {
    id: "TRUTH_CONFLATION",
    passed: input.conflation_flags <= CONFLATION_LAW.hard_gate_threshold,
    detail: `objective-truth conflation flags: ${input.conflation_flags} (max ${CONFLATION_LAW.hard_gate_threshold})`
  };
}

function accountingGate(input: VerdictInput): GateEvaluation {
  const { planned, actual, unique, duplicate, missing, extra } = input.accounting;
  const passed = planned === actual && actual === unique && duplicate === 0 && missing === 0 && extra === 0;
  return {
    id: "CALL_ACCOUNTING",
    passed,
    detail: `planned=${planned} actual=${actual} unique=${unique} duplicate=${duplicate} missing=${missing} extra=${extra}`
  };
}

export const HARD_GATE_EVALUATORS: Readonly<Record<string, GateEvaluator>> = Object.freeze({
  HOST_VALIDITY_OVERALL: hostValidityOverall,
  HOST_VALIDITY_PER_CELL_MINIMUM: hostValidityPerCell,
  INVALID_IMBALANCE_AUDIT: invalidImbalance,
  RAW_HISTORY_ISOLATION: rawHistoryIsolation,
  RETRIEVAL_ISOLATION: retrievalIsolation,
  NON_BELIEF_STATE_EQUALITY: nonBeliefState,
  NON_BELIEF_PROMPT_EQUIVALENCE: nonBeliefPrompt,
  B_D_INPUT_IDENTITY: bdInputIdentity,
  INTERVENTION_BELIEF_STABILITY: interventionStability,
  FRESH_PROCESS_RESTORE: persistenceRestore,
  TRUTH_CONFLATION: conflationGate,
  CALL_ACCOUNTING: accountingGate
});

export const HARD_GATE_IDS: readonly string[] = Object.freeze(Object.keys(HARD_GATE_EVALUATORS).sort());

export function evaluateHardGates(input: VerdictInput): readonly GateEvaluation[] {
  return HARD_GATE_IDS.map((id) => {
    const evaluator = HARD_GATE_EVALUATORS[id];
    if (evaluator === undefined) throw new Error(`HARD_GATE_REGISTRY: missing evaluator for ${id}`);
    return evaluator(input);
  });
}

/** §9/§19: ONE primary analysis law. Any other number is secondary reporting. */
export const ANALYSIS_LAW = Object.freeze({
  primary: "CONJUNCTIVE_NEWCOMBE_CONSTRAINT",
  superiority: "one-sided minimum-effect: lower bound of the 97.5% Newcombe interval > delta_min",
  equivalence: "TOST: the 90% Newcombe interval for pB - pD lies inside (-epsilon, +epsilon)",
  multiplicity_control: "the conjunction itself (every contrast must pass); no per-contrast p-value selection",
  prohibited: ["fisher_vs_chi_square_selection", "bayesian_prior_tuning", "bootstrap_shopping", "post_hoc_threshold_selection"]
});

/** §27/§28/§29 code-state law. */
export const CODE_STATE_LAW = Object.freeze({
  formal_run_code_sha: "PREREGISTRATION_COMMIT (exact SHA recorded at run start)",
  start_gate: "HEAD must equal PREREGISTRATION_COMMIT, else STOP: SCIENTIFIC_CODE_STATE_MISMATCH",
  post_run_mutation: "FORBIDDEN — any required runtime code change INVALIDATES the run and requires a new preregistration commit and a fresh run from zero",
  reseal_after_first_scientific_call: "FORBIDDEN"
});
