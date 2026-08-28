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
  CognitiveContextProjectionV0,
  CognitionProposalV0
} from "../transitions/cognition-action/types.js";

export interface CognitionProviderV0 {
  propose(projection: CognitiveContextProjectionV0): Promise<CognitionProposalV0>;
}
