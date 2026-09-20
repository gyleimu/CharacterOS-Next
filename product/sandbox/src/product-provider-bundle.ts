/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — shared product provider wiring.
 *
 * ONE place that decides WHICH providers a product process builds, with which
 * model/endpoint/timeout/budgets, and how stage progress is observed. Extracted
 * from `cli.ts` so the CLI and the local web product cannot diverge in provider
 * semantics (same transports, same appraisal/belief/relationship wiring, same
 * turn-plan flags). This module adds no canonical semantics.
 */

import type {
  BeliefSemanticTargetResolutionProviderV0,
  FactualEventAppraisalProviderV0,
  RelationshipInteractionQualifyingAdmissionProviderV0
} from "@characteros-next/runtime";
import {
  ModelRelationshipFamiliarityQualifyingAdmissionProviderV0,
  OllamaBeliefSemanticProviderV0
} from "@characteros-next/runtime";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0 } from "./product-appraisal-prompt.js";
import {
  AppraisalInferenceReuseV0,
  appraisalProviderFingerprintV0
} from "./product-appraisal-reuse.js";
import {
  PRODUCT_APPRAISAL_NUM_PREDICT_V0,
  PRODUCT_COGNITION_NUM_PREDICT_V0,
  createProductTransportsV0,
  deepSeekProviderRequestOptionsV0,
  type ProductTransportsV0
} from "./product-providers.js";
import {
  ProviderDiagnosticsV0,
  wrapTransportForStageV0,
  type ProductTurnPlanInputV0,
  type ProviderProgressEventV0
} from "./provider-diagnostics.js";
import type { ProductConfigurationV0, ProductEnvironmentV0 } from "./product-configuration.js";

export interface ProductProviderBundleOptionsV0 {
  readonly configuration: ProductConfigurationV0;
  /**
   * Environment accessor used for EXACTLY one thing: reading the cloud
   * credential (`MODEL_API_KEY`) when the cloud executor family is selected.
   * The value never leaves the transport construction path.
   */
  readonly environment?: ProductEnvironmentV0 | undefined;
  /** Terminal/diagnostic line sink (CLI stdout, server log, or a no-op). */
  readonly write: (line: string) => void;
  /** Optional structured progress sink (visual client). Additive to `write`. */
  readonly observer?: (event: ProviderProgressEventV0) => void;
  readonly debug?: boolean;
  /** Monotonic clock override for deterministic tests. */
  readonly now?: () => number;
}

export interface ProductProviderBundleV0 {
  readonly diagnostics: ProviderDiagnosticsV0;
  readonly transports: ProductTransportsV0;
  readonly appraisalProvider: FactualEventAppraisalProviderV0;
  /** Separate appraisal call accounting (never folded into cognition/language). */
  readonly appraisalCallCount: () => number;
  /** Null disables belief adaptation entirely (no provider calls), as the host contract allows. */
  readonly beliefSemanticProvider: BeliefSemanticTargetResolutionProviderV0 | null;
  readonly relationshipFamiliarityAdmissionProvider: RelationshipInteractionQualifyingAdmissionProviderV0 | null;
  readonly turnPlan: ProductTurnPlanInputV0;
  readonly model: string;
  /**
   * The ONE context allocation shared by every product transport. Exposed as
   * non-canonical observability so the "single resident runner" property is
   * testable and visible.
   */
  readonly context_window_tokens: number;
  /** Appraisal output budget (unchanged by the latency fix). */
  readonly appraisal_num_predict: number;
  /**
   * LOCAL_COGNITION_GENERATION_BUDGET_REMEDIATION — the COGNITION-ONLY output
   * budget. Language and relationship keep the shared `CHARACTEROS_NUM_PREDICT`
   * value; this field exists so the raised budget is visible and testable rather
   * than implicit in the transport construction.
   */
  readonly cognition_num_predict: number;
  /**
   * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — turn-scoped reuse port shared by
   * the appraisal provider and the product turn lifecycle. `enabled` reflects
   * the product configuration switch; disabled ports are inert.
   */
  readonly appraisalReuse: AppraisalInferenceReuseV0;
}

/** Builds the frozen product provider set for ONE product process. */
export function createProductProviderBundleV0(
  options: ProductProviderBundleOptionsV0
): ProductProviderBundleV0 {
  const configuration = options.configuration;
  const model = configuration.model.value;
  const baseUrl = configuration.endpoint.value;
  // DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 — the cloud family sends the product's
  // thinking-mode setting on the existing request path (default DISABLED, because
  // the contract consumes final `message.content`). The local family is untouched:
  // its native transport has always sent `think: false`.
  const cloudRequestOptions =
    configuration.executor.effective === "deepseek"
      ? deepSeekProviderRequestOptionsV0(configuration.deepseek_thinking.value)
      : undefined;
  const transports = createProductTransportsV0({
    executor: configuration.executor.effective,
    // Credential: environment → configuration → transport construction. It stays
    // in the transport config for the lifetime of this process; it is never
    // written, logged, traced or placed in canonical state.
    ...(configuration.executor.effective === "deepseek"
      ? { api_key: options.environment?.get("MODEL_API_KEY") ?? null }
      : {}),
    ...(cloudRequestOptions === undefined ? {} : { provider_request_options: cloudRequestOptions }),
    base_url: baseUrl,
    model,
    timeout_ms: configuration.timeout_ms.value,
    num_predict: configuration.num_predict.value,
    context_window_tokens: configuration.context_window_tokens.value
  });
  const diagnostics = new ProviderDiagnosticsV0({
    write: options.write,
    ...(options.observer === undefined ? {} : { observer: options.observer }),
    ...(options.now === undefined ? {} : { now: options.now }),
    model,
    timeout_ms: configuration.timeout_ms.value,
    debug: options.debug ?? configuration.debug.value
  });
  const cognitionTransport = wrapTransportForStageV0(transports.cognition, "COGNITION", diagnostics);
  const languageTransport = wrapTransportForStageV0(transports.language, "LANGUAGE", diagnostics);
  const appraisalTransport = wrapTransportForStageV0(transports.appraisal, "APPRAISAL", diagnostics);
  const relationshipTransport = wrapTransportForStageV0(
    transports.relationship,
    "RELATIONSHIP_ADAPTATION",
    diagnostics
  );
  // Every stage this bundle actually wires is CONFIGURED before its first call,
  // so diagnostics never present a wired stage as "not configured".
  // CHARACTEROS_DISABLE_ADAPTATION gates the adaptation DEPENDENCIES (both
  // providers below resolve to null), not merely their diagnostics.
  const adaptationDisabled = configuration.disable_adaptation.value;
  for (const stage of ["APPRAISAL", "COGNITION", "LANGUAGE"] as const) {
    diagnostics.enable(stage);
  }
  if (!adaptationDisabled) {
    diagnostics.enable("BELIEF_ADAPTATION");
    diagnostics.enable("RELATIONSHIP_ADAPTATION");
  }
  // APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — the port is per bundle (per
  // subject and process) and only reuses inside an explicitly opened turn scope.
  const appraisalReuse = new AppraisalInferenceReuseV0(
    configuration.appraisal_exact_input_reuse.value,
    appraisalProviderFingerprintV0({
      endpoint: baseUrl,
      model,
      timeout_ms: configuration.timeout_ms.value,
      num_predict: PRODUCT_APPRAISAL_NUM_PREDICT_V0,
      // Shared allocation (see product-providers.ts): one resident runner.
      context_window_tokens: configuration.context_window_tokens.value,
      system_prompt: PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0
    }),
    () => diagnostics.noteReused("APPRAISAL")
  );
  const appraisal = createProductAppraisalProviderV0({ transport: appraisalTransport, reuse: appraisalReuse });
  return {
    diagnostics,
    transports: {
      ...transports,
      cognition: cognitionTransport,
      language: languageTransport,
      appraisal: appraisalTransport,
      relationship: relationshipTransport
    },
    appraisalProvider: appraisal.provider,
    appraisalCallCount: () => appraisal.stats.callCount(),
    beliefSemanticProvider: adaptationDisabled
      ? null
      : new OllamaBeliefSemanticProviderV0({
          // ADAPTATION IS LOCAL-ONLY: this provider is Ollama-native, so it keeps
          // the LOCAL endpoint and model even when cognition runs on the cloud
          // executor. Pointing it at the cloud endpoint would be a silent
          // cross-provider mis-wire, not a feature.
          base_url: configuration.local_endpoint.value,
          model: configuration.belief_semantic_model.value
        }),
    relationshipFamiliarityAdmissionProvider: adaptationDisabled
      ? null
      : new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({
          transport: relationshipTransport
        }),
    turnPlan: {
      belief_adaptation_enabled: !adaptationDisabled,
      relationship_adaptation_enabled: !adaptationDisabled,
      personality_adaptation_enabled: false
    },
    model,
    context_window_tokens: configuration.context_window_tokens.value,
    appraisal_num_predict: PRODUCT_APPRAISAL_NUM_PREDICT_V0,
    cognition_num_predict: PRODUCT_COGNITION_NUM_PREDICT_V0,
    appraisalReuse
  };
}
