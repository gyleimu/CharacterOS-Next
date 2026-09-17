/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — POST-PARITY PREREGISTRATION AUTHORITY.
 *
 * This is the SAME confirmatory experiment: same claim, same target proposition,
 * same LOW/HIGH histories, same A/B/C/D cells, same scenario, same outcome, same
 * statistical law, same sample size, same executor. What changed is ONLY the
 * model-visible contract: the schema and the system prompt now advertise the
 * length, cardinality and non-emptiness constraints the production validator
 * always enforced, so the executor is no longer held to an invisible law.
 *
 * WHY A NEW AUTHORITY IS REQUIRED: the model-facing request is part of the frozen
 * scientific instrument. The system prompt and schema changed, so the request
 * changed, so the previous authority no longer describes what would be sent.
 *
 * WHAT THIS MODULE DOES NOT CLAIM: that the executor now complies. Contract
 * visibility is a property of the instrument, not evidence about the executor —
 * only a real calibration can answer that, and none is authorized by this file.
 */
import { buildParityInventory, inventorySummary } from "../../audits/model-visible-contract-parity-v0/inventory.ts";

import { CURRENT_SCENE, MODEL, modelConfigManifest } from "./contract.ts";
import { hashJson } from "./histories.ts";

export const PREREG_AUTHORITY_VERSION = "POST_PARITY_V1" as const;

/**
 * The superseded authority. Kept as immutable history: it was a valid
 * preregistration, its calibration authorization was consumed, and its terminal
 * result stands. Nothing here reinterprets, re-issues or replaces it.
 */
export const SUPERSEDED_AUTHORITY = Object.freeze({
  commit: "917d5d107cc29033b036682875b69be9d02d34f2",
  status: "VALID_HISTORICAL_PREREG" as const,
  calibration_authorization: "CONSUMED" as const,
  terminal_result: "EXECUTOR_CALIBRATION_RESULT_APPROVED_STOP_EARLY" as const,
  planned_logical_trials: 50,
  executed_logical_trials: 17,
  host_valid: 14,
  non_host_valid: 3,
  system_hash: "sha256:9241794b19b06b7a85a020c0c2a3522fd14504c80689ef8a3180afed8e25dc2c",
  schema_hash: "sha256:e9da721b67903c40e40f32dc1989456924923167e921e47cdd2231a78ee771b9",
  request_hash: "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509",
  request_body_bytes: 16085,
  may_be_reissued: false
});

/** The contract-parity remediation that produced the current model-visible contract. */
export const CONTRACT_PARITY_REMEDIATION = Object.freeze({
  commit: "452dc6852501c6958c0add78387a4aa6432942c1",
  status: "COMPLETE" as const,
  verdict: "MODEL_VISIBLE_CONTRACT_PARITY_REMEDIATION_COMPLETE" as const,
  production_accept_reject_semantics_changed: false,
  production_validator_authority: "UNCHANGED" as const,
  production_bound_metric: "UNICODE_CODE_POINTS" as const
});

/**
 * The model-visible contract this authority freezes. Every value is recomputed
 * from the live runtime by `contractParityBinding()` and asserted by tests; the
 * literals below exist so a drift is a test failure rather than a silent change.
 */
export interface ContractParityBinding {
  readonly schema_hash: string;
  readonly system_hash: string;
  readonly user_hash: string;
  readonly model_config_hash: string;
  readonly request_hash: string;
  readonly request_body_bytes: number;
  readonly serialization: "canonicalJson";
  readonly parity_inventory_hash: string;
  readonly production_only_model_authored_constraints: number;
  readonly parity_status_counts: Readonly<Record<string, number>>;
  readonly remediation_commit: string;
  readonly authority_version: string;
}

export function contractParityBinding(input: {
  readonly systemHash: string;
  readonly userHash: string;
  readonly schemaHash: string;
  readonly modelConfigHash: string;
  readonly requestHash: string;
  readonly requestBodyBytes: number;
}): ContractParityBinding {
  const summary = inventorySummary(buildParityInventory());
  return {
    schema_hash: input.schemaHash,
    system_hash: input.systemHash,
    user_hash: input.userHash,
    model_config_hash: input.modelConfigHash,
    request_hash: input.requestHash,
    request_body_bytes: input.requestBodyBytes,
    serialization: "canonicalJson",
    parity_inventory_hash: hashJson(buildParityInventory()),
    production_only_model_authored_constraints: summary.unexplained_production_only.length,
    parity_status_counts: summary.by_status,
    remediation_commit: CONTRACT_PARITY_REMEDIATION.commit,
    authority_version: PREREG_AUTHORITY_VERSION
  };
}

/**
 * The executor is UNCHANGED. Recorded here so a future slice cannot quietly swap
 * the model or retune the configuration under a preregistration that promised the
 * opposite.
 */
export const AUTHORITY_EXECUTOR = Object.freeze({
  provider: MODEL.provider,
  model: MODEL.id,
  base_url: MODEL.base_url,
  temperature: MODEL.temperature,
  top_p: MODEL.top_p,
  max_tokens: MODEL.max_tokens,
  timeout_ms: MODEL.timeout_ms,
  stream: MODEL.stream,
  response_format: MODEL.response_format,
  fallbacks: MODEL.fallbacks,
  config_hash: hashJson(modelConfigManifest()),
  unchanged_from_superseded_authority: true
});

/** The scientific instrument this authority freezes — unchanged in every respect. */
export const AUTHORITY_SCIENTIFIC_INVARIANTS = Object.freeze({
  experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1" as const,
  target_proposition_label: "The service passage is usable." as const,
  scenario_text_hash: hashJson(CURRENT_SCENE),
  scenario_text_unchanged: true,
  cells: ["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED"] as readonly string[],
  delta_min: 0.2,
  epsilon: 0.15,
  n_per_cell_per_phase: 200,
  calibration_scheduled_draws: 50,
  minimum_host_valid: 48,
  maximum_non_host_valid: 2,
  third_invalid_early_stop: true,
  invalid_trials_replaced: false,
  outcome_diversity_gate: "NONE" as const,
  estimator_families: ["WILSON", "NEWCOMBE", "TOST", "IUT_FULL_CONJUNCTION"] as readonly string[],
  primary_and_replication_independent: true,
  belief_decision_remains_dead: true,
  changes_from_superseded_authority: [] as readonly string[]
});

/**
 * The EMPTY-genesis limitation, restated for this authority so no reader can
 * over-read a future RUN.
 */
export const AUTHORITY_LIMITATIONS: readonly string[] = Object.freeze([
  "The calibration subject is a normal EMPTY genesis: a RUN would attest transport, provider, schema and host readiness for the frozen EMPTY-genesis request ONLY. It could NOT establish that projection-bearing A/B/C/D scenes are equally schema-stable.",
  "Contract visibility parity is a property of the instrument. This authority freezes that the executor CAN see every bound the validator enforces; it says nothing about whether the executor will comply.",
  "Calibration contributes 0 to every confirmatory count and enters no causal denominator.",
  "The superseded authority's terminal result (EXECUTOR_CALIBRATION_STOP_EARLY) stands as historical fact and is neither re-run, completed, nor reinterpreted.",
  "The exploratory diagnostic characterized a mechanism; it did not identify a calibration root cause and no causal claim follows from it."
]);

/**
 * Executable self-check for the authority's own binding: it recomputes the
 * contract hashes and the parity inventory from the live runtime and reports any
 * divergence. A caller that cannot reproduce these values must not proceed.
 */
export function authorityBindingDivergences(binding: ContractParityBinding): readonly string[] {
  const divergences: string[] = [];
  if (binding.parity_inventory_hash !== hashJson(buildParityInventory())) divergences.push("PARITY_INVENTORY_HASH_DRIFT");
  if (binding.production_only_model_authored_constraints !== 0) divergences.push("PRODUCTION_ONLY_CONSTRAINTS_PRESENT");
  if (binding.serialization !== "canonicalJson") divergences.push("SERIALIZATION_NOT_CANONICAL_JSON");
  if (binding.remediation_commit !== CONTRACT_PARITY_REMEDIATION.commit) divergences.push("REMEDIATION_COMMIT_MISMATCH");
  const modelConfigHash = hashJson(modelConfigManifest());
  if (binding.model_config_hash !== modelConfigHash) divergences.push("MODEL_CONFIG_HASH_DRIFT");
  if (!AUTHORITY_EXECUTOR.unchanged_from_superseded_authority) divergences.push("EXECUTOR_MARKED_CHANGED");
  return divergences;
}
