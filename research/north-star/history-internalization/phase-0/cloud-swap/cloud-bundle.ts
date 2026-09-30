/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE 0 — CLOUD EXECUTOR BUNDLE (the swapped condition's provider set).
 *
 * Builds exactly the four families Phase 0 drives, ALL FOUR on the swapped executor, and returns the
 * SAME `Phase0BundleV0` interface the local bundle returns — so `harness.ts`, the turn loop, the frozen
 * schedule and the scorer are reused untouched.
 *
 * The declarations that are NOT free:
 *   - the budgets are IMPORTED from `../contract.ts` (cognition 2048, appraisal 256) and from the frozen
 *     local sibling (belief semantic 512). They are not re-chosen here.
 *   - `packages/` is never modified; the only new code is host-side transport composition.
 *   - the process builds exactly ONE endpoint. There is no second base URL, no `localhost` fallback, and
 *     a missing credential throws instead of degrading. "no fallback" is therefore structural, not a policy
 *     statement.
 */

import {
  OpenAiCompatibleTransportV0,
  type ModelTransportConfigV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";
import { createProductAppraisalProviderV0 } from "../../../../../product/sandbox/dist/product-appraisal-provider.js";

import { P0_APPRAISAL_NUM_PREDICT, P0_COGNITION_NUM_PREDICT } from "../contract.ts";
import type { Phase0BundleV0 } from "../harness.ts";
import {
  CS_BELIEF_SEMANTIC_NUM_PREDICT,
  CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES,
  OpenAiCompatibleBeliefSemanticProviderV0
} from "./cloud-belief-semantic-provider.ts";
import {
  CS_CHANGED_CONDITIONS,
  CS_FAMILIES,
  CS_FAMILY_TIMEOUTS_MS,
  CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED,
  CS_PROVIDER_ID,
  CS_SCHEMA_ENFORCEMENT_MODE,
  CS_UNCHANGED_CONDITIONS,
  redactCsV0,
  type CsExecutorConfigV0,
  type CsFamilyV0
} from "./contract-cloud-v0.ts";

/** The frozen per-family budgets, read from the existing frozen contracts rather than re-chosen. */
export const CS_FAMILY_BUDGETS: Readonly<Record<CsFamilyV0, number>> = Object.freeze({
  cognition: P0_COGNITION_NUM_PREDICT,
  language: P0_COGNITION_NUM_PREDICT,
  appraisal: P0_APPRAISAL_NUM_PREDICT,
  belief_semantic: CS_BELIEF_SEMANTIC_NUM_PREDICT
});

/** Builds ONE OpenAI-compatible transport with the frozen per-family output budget AND timeout. */
export function createCloudTransportForFamilyV0(
  config: CsExecutorConfigV0,
  family: CsFamilyV0
): ModelTransportV0 {
  const transportConfig: ModelTransportConfigV0 = {
    base_url: config.base_url,
    model: config.model,
    api_key: config.api_key,
    timeout_ms: CS_FAMILY_TIMEOUTS_MS[family],
    temperature: config.temperature,
    max_output_tokens: CS_FAMILY_BUDGETS[family],
    ...(config.provider_request_options === undefined
      ? {}
      : { provider_request_options: config.provider_request_options })
  };
  return new OpenAiCompatibleTransportV0(transportConfig);
}

/** The per-family executor identity, for the run artifacts. Never hardcoded into a verdict. */
export interface CsExecutorDeclarationV0 {
  readonly provider: string;
  readonly api_style: string;
  readonly base_url: string;
  readonly model: string;
  readonly schema_enforcement_mode: string;
  readonly reasoning_policy: string;
  readonly temperature: number;
  readonly family_timeouts_ms: Readonly<Record<CsFamilyV0, number>>;
  readonly families: readonly CsFamilyV0[];
  readonly family_output_budgets: Readonly<Record<CsFamilyV0, number>>;
  readonly credential_present: boolean;
  readonly credential_value_recorded: false;
  readonly fallback_configured: false;
  readonly changed_conditions: Readonly<Record<string, string>>;
  readonly unchanged_conditions: Readonly<Record<string, string>>;
  readonly non_transferred_parameters: typeof CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED;
  readonly belief_semantic_error_vocabulary: readonly string[];
}

export function declareCloudExecutorV0(config: CsExecutorConfigV0): CsExecutorDeclarationV0 {
  return {
    provider: CS_PROVIDER_ID,
    api_style: "OPENAI_COMPATIBLE_CHAT_COMPLETIONS",
    base_url: config.base_url,
    model: config.model,
    schema_enforcement_mode: CS_SCHEMA_ENFORCEMENT_MODE,
    reasoning_policy: "provider-level thinking.type=disabled",
    temperature: config.temperature,
    family_timeouts_ms: CS_FAMILY_TIMEOUTS_MS,
    families: CS_FAMILIES,
    family_output_budgets: CS_FAMILY_BUDGETS,
    credential_present: config.api_key !== null,
    credential_value_recorded: false,
    fallback_configured: false,
    changed_conditions: CS_CHANGED_CONDITIONS,
    unchanged_conditions: CS_UNCHANGED_CONDITIONS,
    non_transferred_parameters: CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED,
    belief_semantic_error_vocabulary: CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES
  };
}

/**
 * Builds the swapped condition's real bundle. Identical in shape and in accounting to
 * `execute.ts`'s `realBundle()`; the transports and the belief-semantic provider are the only
 * differences, and both are named in the declaration above.
 */
export function buildCloudPhase0BundleV0(config: CsExecutorConfigV0): Phase0BundleV0 {
  const tally: Phase0BundleV0["tally"] = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];
  let currentTurn = "PRE";

  const countedTransport = (
    inner: ModelTransportV0,
    family: "cognition" | "language" | "appraisal"
  ): ModelTransportV0 => {
    return {
      complete: async (request: never) => {
        tally[family] += 1;
        if (family === "cognition") {
          const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
          cognitionRequests.push({
            turn: currentTurn,
            messages: messages.map((message) => ({ role: message.role, content: message.content }))
          });
        }
        return inner.complete(request);
      }
    } as ModelTransportV0;
  };

  const beliefSemantic = new OpenAiCompatibleBeliefSemanticProviderV0({
    transport: createCloudTransportForFamilyV0(config, "belief_semantic")
  });

  return {
    cognitionTransport: countedTransport(createCloudTransportForFamilyV0(config, "cognition"), "cognition"),
    languageTransport: countedTransport(createCloudTransportForFamilyV0(config, "language"), "language"),
    appraisalProvider: createProductAppraisalProviderV0({
      transport: countedTransport(createCloudTransportForFamilyV0(config, "appraisal"), "appraisal")
    }).provider,
    beliefSemanticProvider: {
      propose: async (input: never) => {
        tally.belief_semantic += 1;
        const turn = currentTurn;
        try {
          const output = await beliefSemantic.propose(input);
          providerCalls.push({ turn, input, output, error: null });
          return output;
        } catch (error) {
          // The recorded error string is REDACTED before it can reach an artifact: a provider
          // failure message must never carry the credential.
          providerCalls.push({
            turn,
            input,
            output: null,
            error: redactCsV0(error instanceof Error ? error.message : String(error))
          });
          throw error;
        }
      }
    },
    tally,
    cognitionRequests,
    providerCalls,
    executorModel: config.model,
    executorBaseUrl: config.base_url,
    isStub: false,
    setTurnLabel: (label: string) => {
      currentTurn = label;
    }
  };
}
