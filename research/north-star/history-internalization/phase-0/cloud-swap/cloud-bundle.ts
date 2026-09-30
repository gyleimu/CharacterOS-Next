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
import { createAugmentedCognitionTransportV0 } from "./run5-augmentation.ts";

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
 * Wraps a transport so EVERY model-backed call of a cognition/language/appraisal family is counted and
 * its RAW response recorded, valid or invalid.
 *
 * Exported so it can be verified with a stub transport at 0 model calls: the repository's law is that an
 * instrument must be exercised offline before it is relied on for real calls. Two properties matter and
 * both are asserted by the suite: the request reaches the inner transport UNCHANGED, and a failure is
 * recorded AND still thrown (the wrapper never swallows).
 */
export function createRecordingFamilyTransportV0(input: {
  readonly inner: ModelTransportV0;
  readonly family: "cognition" | "language" | "appraisal";
  readonly tally: Phase0BundleV0["tally"];
  readonly cognitionRequests: Phase0BundleV0["cognitionRequests"];
  readonly providerCalls: Phase0BundleV0["providerCalls"];
  readonly currentTurn: () => string;
}): ModelTransportV0 {
  return {
    complete: async (request: never) => {
      const turn = input.currentTurn();
      input.tally[input.family] += 1;
      if (input.family === "cognition") {
        const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
        input.cognitionRequests.push({
          turn,
          messages: messages.map((message) => ({ role: message.role, content: message.content }))
        });
      }
      try {
        const response = await input.inner.complete(request);
        input.providerCalls.push({
          turn,
          family: input.family,
          input: request,
          output: (response as { content?: unknown }).content ?? response,
          error: null
        });
        return response;
      } catch (error) {
        input.providerCalls.push({
          turn,
          family: input.family,
          input: request,
          output: null,
          error: redactCsV0(error instanceof Error ? error.message : String(error))
        });
        throw error;
      }
    }
  } as ModelTransportV0;
}

/**
 * Builds the swapped condition's real bundle. Identical in shape and in accounting to
 * `execute.ts`'s `realBundle()`; the transports and the belief-semantic provider are the only
 * differences, and both are named in the declaration above.
 */
export interface CloudPhase0BundleOptionsV0 {
  /**
   * RUN-5 — the declared SOURCE_QUOTE compliance augmentation, applied to the COGNITION family only.
   *
   * Absent by default, so the run-4 condition is reproduced exactly. Applied INSIDE the recorder, so the
   * recorded request (and therefore the leakage audit and every artifact) shows what was actually sent.
   */
  readonly cognition_augmentation?: string | undefined;
}

export function buildCloudPhase0BundleV0(
  config: CsExecutorConfigV0,
  options: CloudPhase0BundleOptionsV0 = {}
): Phase0BundleV0 {
  const tally: Phase0BundleV0["tally"] = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];
  let currentTurn = "PRE";

  const countedTransport = (
    inner: ModelTransportV0,
    family: "cognition" | "language" | "appraisal"
  ): ModelTransportV0 =>
    createRecordingFamilyTransportV0({
      inner,
      family,
      tally,
      cognitionRequests,
      providerCalls,
      currentTurn: () => currentTurn
    });

  const beliefSemantic = new OpenAiCompatibleBeliefSemanticProviderV0({
    transport: createCloudTransportForFamilyV0(config, "belief_semantic")
  });

  // ORDER MATTERS AND IS LOAD-BEARING: the recorder sits INSIDE the augmenter, so the recorded request
  // is byte-for-byte the request the real transport receives.
  //
  // The first version had it the other way round (`countedTransport(augmented(...))`), which recorded the
  // PRE-augmentation request: the augmentation did reach the wire, but no recorded artifact could show
  // it, so "the augmentation was applied" became an unverifiable claim and the run's own self-check
  // correctly refused to accept it. The order is now pinned by a regression test.
  const cognitionRecorded = countedTransport(createCloudTransportForFamilyV0(config, "cognition"), "cognition");
  const cognitionTransport =
    options.cognition_augmentation === undefined
      ? cognitionRecorded
      : createAugmentedCognitionTransportV0(cognitionRecorded, options.cognition_augmentation);

  return {
    cognitionTransport,
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
          providerCalls.push({ turn, family: "belief_semantic", input, output, error: null });
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
