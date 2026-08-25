/**
 * P2.3.1 — InterpretationPort (DRAFT seam; proposal-only, fixed providers in P2.3).
 *
 * Stage authority (p2-runtime-plan §8.2): Interpretation MAY be a proposal provider;
 * in P2.3 it is a FIXED deterministic provider — never a live LLM. Its proposal payload
 * schema lands with the appraisal-package contract slice; this port freezes only the
 * wiring shape: controlled projection view in, draft proposal out.
 */

import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import type { MemoryRetrievalResultV0 } from "@characteros-next/memory";

/**
 * Controlled read-model handed to interpretation (p2-runtime-plan §8.3 subset).
 * DRAFT schema, evolved by P2.3.3.1: `projection_ref` was replaced by the grammar-safe
 * `projection_hash` (kind `projection` is not among the 21 frozen ref kinds); the view
 * now carries the observation identity and refs-only facts it projects.
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

/** DRAFT interpretation output — schema finalizes with the appraisal package slice. */
export interface InterpretationProposalDraftV0 {
  readonly interpretation_ref: CanonicalRefV0;
}

export interface InterpretationPort {
  interpret(request: ControlledProjectionViewV0): Promise<InterpretationProposalDraftV0>;
}
