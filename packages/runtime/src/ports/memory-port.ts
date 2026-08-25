/**
 * P2.3.1 — MemoryPort: immutable repository capability boundary (types-only seam).
 *
 * Exposes exactly the MemoryRepository verdict/prepare surface. The runtime NEVER
 * writes canonical state through memory and never touches repository payloads — refs
 * only (Producer != Mutator; adoption happens solely inside subject-core commits).
 */

import type { MemoryRepository } from "@characteros-next/memory";

export interface MemoryPort {
  readonly repository: MemoryRepository;
}
