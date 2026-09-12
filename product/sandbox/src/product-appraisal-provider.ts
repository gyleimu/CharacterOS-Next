/**
 * CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0 — product appraisal producer.
 *
 * Two explicit roles:
 *   - `createConstantAppraisalProviderV0()` — deterministic FAKE/test fixture
 *     (content-insensitive). Used only by offline tests/fixtures.
 *   - `createProductAppraisalProviderV0({ transport })` — the REAL product
 *     provider: ONE model call per factual event proposing the six canonical
 *     dimensions; the adapter assembles every authority field from the trusted
 *     context (subject, event ref, context hash, evidence refs). Model output
 *     can never forge identity or refs.
 *
 * No sentiment/reward/named-emotion surface exists, no JSON repair, no retry,
 * and no constant fallback: malformed or invalid model output fails the
 * appraisal closed through the existing lifecycle.
 */

import type {
  FactualEventAppraisalContextProjectionV0,
  FactualEventAppraisalProviderV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import {
  PRODUCT_APPRAISAL_OUTPUT_KEYS,
  PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0,
  buildProductAppraisalUserDataV0
} from "./product-appraisal-prompt.js";
import {
  appraisalRequestIdentityV0,
  type AppraisalInferenceReuseV0
} from "./product-appraisal-reuse.js";

const ORDINARY_CONVERSATION_APPRAISAL = Object.freeze({
  relevance: 0.6,
  goal_congruence: 0.5,
  attribution: "other" as const,
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.4
});

/**
 * Deterministic, content-INSENSITIVE fake. Explicitly a test/fixture provider:
 * the product CLI does NOT use it. Kept so tests can hold appraisal constant.
 */
export function createConstantAppraisalProviderV0(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: { ...ORDINARY_CONVERSATION_APPRAISAL },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

export class ProductAppraisalProviderErrorV0 extends Error {
  constructor(detail: string) {
    super(`appraisal provider: ${detail}`);
    this.name = "ProductAppraisalProviderErrorV0";
  }
}

export interface ProductAppraisalProviderStatsV0 {
  /** Model appraisal calls made so far (separate from cognition/language). */
  callCount(): number;
}

export interface ProductAppraisalProviderV0 {
  readonly provider: FactualEventAppraisalProviderV0;
  readonly stats: ProductAppraisalProviderStatsV0;
}

interface ParsedModelAppraisalV0 {
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly attribution: string;
  readonly controllability: number;
  readonly uncertainty: number;
  readonly intensity: number;
  readonly assessment_confidence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strict structural parse of the model's narrow output: exact key set, numeric
 * dimensions as numbers, attribution as a string. RANGE and ENUM validity are
 * deliberately left to the frozen canonical validator (no clamping, no
 * normalization, single source of truth).
 */
function parseModelAppraisalV0(content: string): ParsedModelAppraisalV0 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new ProductAppraisalProviderErrorV0(
      `model output is not strict JSON (${error instanceof Error ? error.message : "unknown"})`
    );
  }
  if (!isRecord(parsed)) throw new ProductAppraisalProviderErrorV0("model output: expected a JSON object");
  const keys = Object.keys(parsed).sort();
  const expected = [...PRODUCT_APPRAISAL_OUTPUT_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new ProductAppraisalProviderErrorV0(
      `model output: unexpected key set; expected exactly [${expected.join(",")}]`
    );
  }
  for (const key of ["relevance", "goal_congruence", "controllability", "uncertainty", "intensity", "assessment_confidence"]) {
    const value = parsed[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ProductAppraisalProviderErrorV0(`model output.${key}: finite number required`);
    }
  }
  if (typeof parsed["attribution"] !== "string") {
    throw new ProductAppraisalProviderErrorV0("model output.attribution: string required");
  }
  return {
    relevance: parsed["relevance"] as number,
    goal_congruence: parsed["goal_congruence"] as number,
    attribution: parsed["attribution"] as string,
    controllability: parsed["controllability"] as number,
    uncertainty: parsed["uncertainty"] as number,
    intensity: parsed["intensity"] as number,
    assessment_confidence: parsed["assessment_confidence"] as number
  };
}

/**
 * Assembles the proposal for THIS event. Every authority field comes ONLY from
 * the trusted context — identical whether the candidate came from a real
 * inference or from an exact-request reuse.
 */
function assembleProposalV0(
  ctx: FactualEventAppraisalContextProjectionV0,
  parsed: ParsedModelAppraisalV0
): unknown {
  return {
    schema_version: "factual-event-appraisal-proposal-v0",
    status: "APPRAISED",
    // Authority fields come ONLY from the trusted context.
    subject_id: ctx.subject_id,
    factual_event_ref: ctx.factual_event_ref,
    context_projection_hash: ctx.context_projection_hash,
    dimensions: {
      relevance: parsed.relevance,
      goal_congruence: parsed.goal_congruence,
      attribution: parsed.attribution,
      controllability: parsed.controllability,
      uncertainty: parsed.uncertainty,
      intensity: parsed.intensity
    },
    assessment_confidence: parsed.assessment_confidence,
    evidence_refs: [ctx.factual_event_ref].sort()
  };
}

/**
 * The real product appraisal provider. ONE model call per factual event; the
 * model proposes only subjective dimensions/confidence and is never trusted
 * for identity, refs or hashes.
 *
 * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0: when an optional turn-scoped reuse
 * port is supplied and the COMPLETE model-facing request is identical to an
 * earlier invocation in the same turn/subject/provider scope, the already
 * parse-validated candidate is reused and no second local inference is issued.
 * Both semantic Appraisal invocations still happen; only the duplicate model
 * call disappears. A miss performs the normal independent inference.
 */
export function createProductAppraisalProviderV0(options: {
  readonly transport: ModelTransportV0;
  readonly reuse?: AppraisalInferenceReuseV0 | null;
}): ProductAppraisalProviderV0 {
  let calls = 0;
  const reuse = options.reuse ?? null;
  const provider = {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      calls += 1;
      reuse?.noteSemanticInvocation();
      const messages = [
        { role: "system" as const, content: PRODUCT_APPRAISAL_SYSTEM_PROMPT_V0 },
        { role: "user" as const, content: buildProductAppraisalUserDataV0(ctx) }
      ];
      const identity = reuse === null ? null : appraisalRequestIdentityV0(messages);
      if (reuse !== null && identity !== null) {
        const cached = reuse.take(identity);
        if (cached !== null) return assembleProposalV0(ctx, cached);
      }
      const response = await options.transport.complete({ messages });
      const content = (response as { readonly content?: unknown }).content;
      if (typeof content !== "string") {
        // No candidate extraction from an unusable response: the port is never
        // offered anything, and the turn fails closed through the lifecycle.
        reuse?.noteInferenceWithoutCandidate();
        throw new ProductAppraisalProviderErrorV0("model response has no text content");
      }
      let parsed: ParsedModelAppraisalV0;
      try {
        parsed = parseModelAppraisalV0(content);
      } catch (error) {
        // A malformed first candidate must not populate reuse state.
        reuse?.noteInferenceWithoutCandidate();
        throw error;
      }
      if (reuse !== null && identity !== null) reuse.offer(identity, parsed);
      return assembleProposalV0(ctx, parsed);
    }
  } as unknown as FactualEventAppraisalProviderV0;
  return { provider, stats: { callCount: () => calls } };
}
