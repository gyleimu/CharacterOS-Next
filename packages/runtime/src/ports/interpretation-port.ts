/**
 * P2.3.1/P2.3.3 (P0-6 remediated) — InterpretationPort (proposal-only; fixed providers
 * in P2.3, never a live LLM). P0-6 §19: the draft now carries the exact projection
 * hash it answers to and its evidence refs, so runtime validation can enforce
 * evidence ownership (A4.3) and schema conformance before anything reaches commit.
 */

import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import type { MemoryRetrievalResultV0 } from "@characteros-next/memory";

/**
 * Controlled read-model handed to interpretation (p2-runtime-plan §8.3 subset).
 * `projection_hash` is the domain-separated deterministic hash of this exact body.
 */
export interface ControlledProjectionViewV0 {
  /** Domain-separated deterministic hash of this exact projection body. */
  readonly projection_hash: HashV1;
  /** The observation this projection was assembled for. */
  readonly observation_id: CanonicalRefV0;
  /** Unique sorted union of the observation's fact refs (source + entity). */
  readonly observation_refs: readonly CanonicalRefV0[];
  /** Current canonical scene label when resolved by the executor, else null. */
  readonly context_scene: string | null;
  /** Retrieval evidence when the retrieval stage ran, else null. */
  readonly retrieval_result: MemoryRetrievalResultV0 | null;
}

/** Closed interpretation proposal draft (§19): schema, projection hash, evidence. */
export interface InterpretationProposalDraftV0 {
  readonly schema_version: "interpretation-proposal-v0";
  readonly interpretation_ref: CanonicalRefV0;
  /** The exact projection body this proposal answers to. */
  readonly projection_hash: HashV1;
  /** Evidence refs this proposal cites; must ⊆ the allowed evidence set (A4.3). */
  readonly evidence_refs: readonly CanonicalRefV0[];
}

export interface InterpretationPort {
  interpret(request: ControlledProjectionViewV0): Promise<InterpretationProposalDraftV0>;
}
