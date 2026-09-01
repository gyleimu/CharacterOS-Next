/**
 * Belief Decision Influence Relation Foundation V0 — LlmCognitionRelationProviderV1
 * (frozen architecture §17).
 *
 * Responsibilities ONLY:
 *   1. receive host-validated, deep-frozen input
 *   2. build deterministic V1 messages
 *   3. call ModelTransportV0.complete(...) MAXIMUM ONCE
 *      (COGNITION_V1_MAX_MODEL_CALLS_PER_INVOCATION = 1)
 *   4. read the returned content
 *   5. direct JSON.parse — NO Markdown stripping, NO regex extraction, NO JSON
 *      repair, NO second call, NO fallback
 *   6. return the parsed unknown
 *
 * The provider owns NO final schema authority, NO capability minting, NO
 * fingerprint acceptance, NO action selection and NO canonical mutation —
 * admission is host-owned. Malformed content is a stable
 * MODEL_MALFORMED_JSON rejection; transport failures propagate untouched
 * (no retry, no repair).
 */

import type { CognitionRelationProviderInputV1, CognitionRelationProviderV1 } from "../../ports/cognition-relation-port.js";
import type { ModelTransportV0 } from "../../transports/model-transport.js";
import { buildCognitivePromptMessagesV1 } from "./cognitive-prompt-projection-v1.js";
import { CognitionRelationRejectionErrorV1 } from "../../transitions/cognition-action/cognition-proposal-v1.js";

export const COGNITION_V1_MAX_MODEL_CALLS_PER_INVOCATION = 1 as const;

export interface LlmCognitionRelationProviderConfigV1 {
  readonly transport: ModelTransportV0;
}

export class LlmCognitionRelationProviderV1 implements CognitionRelationProviderV1 {
  constructor(private readonly config: LlmCognitionRelationProviderConfigV1) {}

  async propose(input: CognitionRelationProviderInputV1): Promise<unknown> {
    const messages = buildCognitivePromptMessagesV1(input);
    // The ONE and only external model call for this invocation.
    const response = await this.config.transport.complete({ messages });
    try {
      return JSON.parse(response.content) as unknown;
    } catch (error) {
      throw new CognitionRelationRejectionErrorV1(
        "MODEL_MALFORMED_JSON",
        `direct JSON.parse of model content failed: ${(error as Error).message}`
      );
    }
  }
}
