/**
 * P2.2.3/P2.3.1 — RetrievalPort: deterministic candidate-proposal seam.
 *
 * Thin alias over the frozen retrieval contract so executors depend on a runtime-owned
 * name while implementations remain the memory package's concern (contract ≠ algorithm;
 * the reference adapter is declarative-replay only).
 */

import type { MemoryRetrievalQueryV0, MemoryRetrievalResultV0 } from "@characteros-next/memory";

export interface RetrievalPort {
  retrieve(query: MemoryRetrievalQueryV0): Promise<MemoryRetrievalResultV0>;
}
