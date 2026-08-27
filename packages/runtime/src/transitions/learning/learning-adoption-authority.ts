/**
 * P2.3.5.3c — narrow adoption seam for the frozen Learning repository lifecycle:
 *
 *   prepare R1 → canonical SubjectCore bind succeeds → markAdopted(R1)
 *
 * Least privilege (frozen §12): the Learning orchestration receives EXACTLY
 * `markAdopted(candidateRevision)` — no revision/manifest mutation, no payload
 * deletion, no repository reset, no internal store access. The host mints this
 * projection from its own concrete repository (which already exposes the
 * adoption seam); the runtime never sees the raw store.
 *
 * Ordering invariant (§3): markAdopted runs ONLY after the canonical SubjectCore
 * commit has bound the candidate revision. A canonical failure after a
 * successful prepare must leave the candidate unadopted (non-canonical orphan
 * under CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES). The post-commit
 * crash window (bind succeeded, markAdopted not yet executed) is owned by
 * P2.3.5.3d recovery — no rollback/retry semantics here (§4/§8).
 */

import type { MemoryPreparationAuthority } from "@characteros-next/memory";

/** Repository revision id as accepted by the host's narrow adoption seam. */
export type LearningAdoptionRevision = Parameters<
  MemoryPreparationAuthority["readManifest"]
>[0];

export interface LearningAdoptionAuthority {
  /** Mark the canonically bound candidate revision as adopted (idempotent). */
  markAdopted(revision: LearningAdoptionRevision): void;
}
