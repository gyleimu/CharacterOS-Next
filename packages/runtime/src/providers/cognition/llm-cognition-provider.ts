/**
 * P2-next — LlmCognitionProviderV0: the first real model-backed
 * CognitionProviderV0 (provider integration slice).
 *
 * Pipeline: CognitiveContextProjectionV0 → deterministic prompt rendering →
 * ModelTransportV0 (single attempt, no retry) → parse → closed-schema
 * validation → projection binding → evidence grounding → action-space
 * validation → CognitionProposalV0.
 *
 * The model output is UNTRUSTED until every gate passes. Every rejection and
 * every transport failure is thrown as an observable provider failure —
 * canonical state is left untouched (the frozen executor only ever reaches the
 * canonical boundary with an already-validated proposal).
 *
 * NO silent fallback to ReferenceCognitionProviderV0: a real provider failure
 * surfaces as a provider failure. The reference provider remains an explicit,
 * separately selectable choice.
 *
 * NOT byte-deterministic by nature: temperature=0 may reduce variance but is
 * never claimed as perfect determinism — ReferenceCognitionProviderV0 remains
 * the deterministic baseline.
 */

import type { CognitionProviderV0 } from "../../ports/cognition-port.js";
import {
  actionIntentAllowed,
  allowedEvidenceSet,
  findUnsupportedEvidenceRef,
  validateCognitionProposal,
  type CognitiveContextProjectionV0,
  type CognitionProposalV0
} from "../../transitions/cognition-action/types.js";
import { buildCognitivePromptMessages } from "./cognitive-prompt-projection.js";
import {
  ModelTransportErrorV0,
  type ModelTransportV0
} from "../../transports/model-transport.js";

/** Stable provider rejection codes (observable; never silent successes). */
export type LlmCognitionRejectionCode =
  | "MODEL_MALFORMED_JSON"
  | "MODEL_SCHEMA_INVALID"
  | "MODEL_PROJECTION_MISMATCH"
  | "MODEL_UNSUPPORTED_EVIDENCE"
  | "MODEL_ACTION_NOT_ALLOWED";

export class LlmCognitionRejectionErrorV0 extends Error {
  readonly code: LlmCognitionRejectionCode;
  readonly detail_ref: string | null;

  constructor(code: LlmCognitionRejectionCode, detail: string, detailRef: string | null = null) {
    super(`LLM_COGNITION_${code}: ${detail}`);
    this.name = "LlmCognitionRejectionErrorV0";
    this.code = code;
    this.detail_ref = detailRef;
  }
}

export interface LlmCognitionProviderConfigV0 {
  /**
   * Model generation temperature. Lower values reduce variance; this is NOT a
   * perfect-determinism claim (A1 determinism belongs to the reference provider).
   */
  readonly temperature: number;
}

/** Strips an optional markdown fence and parses the raw model content. */
function parseModelJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced !== null && fenced[1] !== undefined ? fenced[1] : content;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new LlmCognitionRejectionErrorV0(
      "MODEL_MALFORMED_JSON",
      `model response is not valid JSON: ${(error as Error).message}`
    );
  }
}

export class LlmCognitionProviderV0 implements CognitionProviderV0 {
  constructor(
    private readonly transport: ModelTransportV0,
    private readonly config: LlmCognitionProviderConfigV0 = { temperature: 0 }
  ) {}

  async propose(projection: CognitiveContextProjectionV0): Promise<CognitionProposalV0> {
    // ---- deterministic prompt (projection-only; no raw internals) --------------
    const messages = buildCognitivePromptMessages(projection);

    // ---- transport: SINGLE attempt; transport failures are provider failures ---
    const response = await this.transport.complete({ messages });

    // ---- parse → closed schema (untrusted until all gates pass) -----------------
    const parsed = parseModelJson(response.content);
    const checked = validateCognitionProposal(parsed);
    if (!checked.ok) {
      throw new LlmCognitionRejectionErrorV0("MODEL_SCHEMA_INVALID", checked.error.detail);
    }
    const proposal = checked.value;

    // ---- projection binding ------------------------------------------------------
    if (proposal.projection_hash !== projection.projection_hash) {
      throw new LlmCognitionRejectionErrorV0(
        "MODEL_PROJECTION_MISMATCH",
        "model answered a different projection_hash (stale or fabricated binding)"
      );
    }

    // ---- evidence grounding (no invented memories/entities/events) ---------------
    const allowed = allowedEvidenceSet(projection);
    const unsupported = findUnsupportedEvidenceRef(
      [...proposal.evidence_refs, ...proposal.relevant_memory_refs, ...proposal.considered_context_refs],
      allowed
    );
    if (unsupported !== null) {
      throw new LlmCognitionRejectionErrorV0(
        "MODEL_UNSUPPORTED_EVIDENCE",
        `model cites ${unsupported} outside the allowed evidence set`,
        unsupported
      );
    }

    // ---- action space (typed intents only; NO_ACTION always legal) ----------------
    if (proposal.action_intent !== null && !actionIntentAllowed(proposal.action_intent, projection.allowed_actions)) {
      throw new LlmCognitionRejectionErrorV0(
        "MODEL_ACTION_NOT_ALLOWED",
        `model proposed action "${proposal.action_intent.action_type}" outside the allowed action space`
      );
    }

    return proposal;
  }
}

// Re-exported so hosts can branch on transport vs rejection failures without
// importing the transport module directly.
export { ModelTransportErrorV0 };
