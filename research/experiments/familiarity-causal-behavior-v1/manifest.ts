import {
  EXPERIMENT_ID, BASELINE, V0_RESULT, SCENARIO, HISTORY_SCENES, CONVENTION_REF,
  ORDER, RUBRIC, SUCCESS_GATES, PROVIDERS, NEUTRAL, RESPONSE_REQUEST_ID, FAILURE_CLASSES, EVALUATOR_SYSTEM
} from "./contract.ts";
import { objectHash } from "./observe.ts";
import { builtFingerprint, frozenIntegrity, sourceFingerprint, type Gates } from "./artifacts.ts";
import { preflightHash, type Preflight } from "./preflight.ts";

export function protocol() {
  return {
    experiment_id: EXPERIMENT_ID, schema_version: "familiarity-production-behavior-manifest-v1",
    predecessor: { experiment: "FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V0", result_commit: V0_RESULT,
      permanent_result: "INVALID_EXPERIMENT", reason: "Artificial experiment-specific cognition/reply envelope was not the production contract.",
      old_raw_output_reuse: false, old_behavior_semantics_used_for_tuning: false },
    production_feature: "PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0", production_commit: BASELINE,
    production_entry: "ConversationTextResponseExecutorV0.execute",
    endpoint: "Exact validated CharacterLanguageBehaviorV0.text from OUTPUT_READY, no fallback.",
    scenario: SCENARIO, histories: { A: HISTORY_SCENES.slice(0, 1), B: [...HISTORY_SCENES] },
    treatment: {
      ingestion: "Real processInteractionExperience, unique qualifying DIRECT_COMMUNICATION episodes; no raw state injection.",
      A: { count: 1, familiarity: 1 / 32, strategy: "BASIC_CONTEXT_FIRST", priority_queries: 0, convention_refs: [] },
      B: { count: 16, familiarity: 16 / 32, strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", priority_queries: 1,
        exact_counterpart: "entity:alice", convention_refs: [CONVENTION_REF] },
      retrieval_adapter: "Unchanged V0 InMemoryRetrievalService declarative rehearsal. NOT a learned search benchmark.",
      base_fixture: "Exact V0 genesis; identity/personality/beliefs/affect/mood/regulation/current context held equal.",
      provider_inputs_byte_identical: false,
      downstream_differences: ["history/commit heads/revisions", "familiarity/influences", "retrieval/evidence/payload hashes", "cognition result/current_intent", "language input/hash"],
      response_request_id: RESPONSE_REQUEST_ID,
      request_identity_scope: "Independent reconstructed subject per trial; reused neutral request identity carries no arm/trial metadata. No delivery deduplication claim."
    },
    rubric: RUBRIC, success_gates: SUCCESS_GATES, order: ORDER, n_per_arm: 8, behavior_trial_denominator: 16,
    providers: PROVIDERS,
    sequencing: "For each frozen order item: one cognition, if valid one language, if valid behavior one blinded evaluator; sequential, no seed support, no retries.",
    call_accounting: { future_complete_primary: { cognition: 16, language: 16, generation_total: 32, evaluator_max: 16 },
      readiness_neutral_max: { cognition: 1, language: 1, evaluator: 0 }, real_control_calls: 0,
      denominator_is_behavior_trials_not_provider_calls: true },
    evaluator: { system: EVALUATOR_SYSTEM, config: PROVIDERS.evaluator,
      input_keys: ["scenario", "behavior_text", "lawful_memory_evidence"],
      evidence: "All validated lawful Memory contents available to the actual language input, not merely refs the draft chose to cite.",
      mapping: "Separate arm-map.json; no arm/trial/familiarity/strategy/behavior_id/source metadata in evaluator request.",
      entailment: "Reference authority does not automatically prove historical semantic entailment; unsupported shared context is a hard rubric failure." },
    neutral_conformance: { fixture: NEUTRAL, primary_sample: false, retries: 0, quality_grading: false,
      criterion: "Same production executor yields validated cognition, validated language draft and nonempty validated behavior.text in one attempt.",
      failure_action: "Stop; no tuning, model changes or schema repair; never start primary." },
    negative_controls: ["same-state reconstruction in frozen order", "high Bob / low active Alice", "high Alice / empty retrieval", "fresh authoritative restore"],
    restore: "Serialize real genesis/terminal persistence envelopes + commit bundles + owned Memory records/binding; new process mints Level-2 history boundary and validates canonical chain; no re-ingestion, no process-local receipt reuse.",
    trace_scope: "Observation-only retrieval port queries/results plus projection, selected refs and authoritative Memory reads. Internal orchestrator summary is not exported by production response result and is not fabricated.",
    failure_classes: FAILURE_CLASSES,
    invalidation: ["No valid OUTPUT_READY artifact means no behavioral observation; never use proposal/summary/intent/raw draft.",
      "No retry, repair, fallback model, replacement trial or skipped-failure denominator.",
      "Completeness requires all 16 unique scheduled trials valid and evaluated, plus host 8/8 each.",
      "Any host/config/fingerprint/authority violation stops further calls and invalidates the run.",
      "Unsupported shared context overrides other rubric classes and fails grounding.",
      "Any concrete generic production defect stops readiness without a production edit."],
    readiness_authorizes_formal_run: false
  };
}
export function makeManifest(input: { harnessCommit: string; gates: Gates; preflight: Preflight; provider: unknown }) {
  return { ...protocol(), harness_commit: input.harnessCommit,
    freeze: { source_fingerprint: sourceFingerprint(), built_fingerprint: builtFingerprint(),
      protocol_hash: objectHash(protocol()), preflight_hash: preflightHash(input.preflight), gates_hash: objectHash(input.gates),
      integrity: frozenIntegrity(), provider_probe: input.provider,
      timestamp: new Date().toISOString(), before_any_real_conformance_output: true } };
}
export type Manifest = ReturnType<typeof makeManifest>;
