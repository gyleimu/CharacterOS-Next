/**
 * P2-next — CognitionProviderV0: the narrow provider seam for the
 * CognitionActionTransition (transition-contracts §16; LLM constitutional
 * boundary §4 of the task).
 *
 * Provider authority: semantic reasoning, candidate intentions, candidate
 * actions (PROPOSALS only). Provider authority MUST NEVER include canonical
 * mutation of any kind — the executor validates every proposal (schema,
 * projection binding, evidence grounding, action-space compatibility) BEFORE
 * any canonical boundary, and the V0 canonical footprint is a zero-delta
 * durable NO_OP minted by SubjectCore.
 *
 * The seam is vendor-neutral: a future LocalModelCognitionProvider or
 * RemoteLLMCognitionProvider implements the same one-method contract. V0 ships
 * only the deterministic reference provider (producers/).
 */

import type {
  CognitiveContextProjectionAnyVersion,
  CognitionProposalV0
} from "../transitions/cognition-action/types.js";

/**
 * EXPERIENCE_MEMORY_FUTURE_COGNITION_INTEGRATION_V0 + CANONICAL_AFFECT_COGNITION_
 * INTEGRATION_V0: the input side accepts the versioned projection union — V0
 * (frozen behavior, no evidence), V1 (explicit factual-memory-evidence input)
 * or V2 (explicit-v4 canonical raw-VA input). Proposal OUTPUT schemas are
 * unchanged (input-side-only change).
 */
export interface CognitionProviderV0 {
  propose(projection: CognitiveContextProjectionAnyVersion): Promise<CognitionProposalV0>;
}
