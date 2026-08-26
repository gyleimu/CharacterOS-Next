/**
 * P2.3.1 — MemoryPort: immutable repository capability boundary (types-only seam).
 *
 * Exposes the SANCTIONED intent-driven authority surface only (R2-G / ATTACK F
 * closure): the runtime-facing port is typed against MemoryPreparationAuthority, so
 * the raw revision-minting path (MemoryRevisionStoreInternal.prepareRevision) is not
 * reachable through the runtime boundary and intent-level idempotency cannot be
 * bypassed. The runtime NEVER writes canonical state through memory and never touches
 * repository payloads — refs only (Producer != Mutator; adoption happens solely
 * inside subject-core commits).
 */

import type { MemoryPreparationAuthority } from "@characteros-next/memory";

export interface MemoryPort {
  readonly repository: MemoryPreparationAuthority;
}
