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
import { createProductTransportsV0, type ProductTransportsV0 } from "./product-providers.js";
import {
  ProviderDiagnosticsV0,
  wrapTransportForStageV0,
  type ProductTurnPlanInputV0,
  type ProviderProgressEventV0
} from "./provider-diagnostics.js";
import type { ProductConfigurationV0 } from "./product-configuration.js";

export interface ProductProviderBundleOptionsV0 {
  readonly configuration: ProductConfigurationV0;
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
}

/** Builds the frozen product provider set for ONE product process. */
export function createProductProviderBundleV0(
  options: ProductProviderBundleOptionsV0
): ProductProviderBundleV0 {
  const configuration = options.configuration;
  const model = configuration.model.value;
  const baseUrl = configuration.endpoint.value;
  const transports = createProductTransportsV0({
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
  // Every stage this bundle wires is CONFIGURED before its first call, so
  // diagnostics never present a wired stage as "not configured".
  for (const stage of ["APPRAISAL", "COGNITION", "LANGUAGE", "RELATIONSHIP_ADAPTATION"] as const) {
    diagnostics.enable(stage);
  }
  if (!configuration.disable_adaptation.value) {
    diagnostics.enable("BELIEF_ADAPTATION");
  }
  const appraisal = createProductAppraisalProviderV0({ transport: appraisalTransport });
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
    beliefSemanticProvider: new OllamaBeliefSemanticProviderV0({
      base_url: baseUrl,
      model: configuration.belief_semantic_model.value
    }),
    relationshipFamiliarityAdmissionProvider: new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({
      transport: relationshipTransport
    }),
    turnPlan: {
      belief_adaptation_enabled: !configuration.disable_adaptation.value,
      relationship_adaptation_enabled: true,
      personality_adaptation_enabled: false
    },
    model
  };
}
