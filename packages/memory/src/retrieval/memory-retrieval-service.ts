/**
 * P2.2.3 — MemoryRetrievalService contract (types-only port).
 * Source: docs/implementation/p2-1-contract-freeze.md §16 (actor chain), plan §3.3.
 *
 * The service PROPOSES candidate episodes; the repository STORES AND VALIDATES. The
 * two concerns are separate ports and must never merge. A later-phase implementation
 * receives its MemoryRepository capability through composition and MUST be
 * deterministic: identical (repository revision, query, config) triples produce
 * byte-identical results. This file deliberately contains no algorithm.
 */

import type { MemoryRetrievalQueryV0, MemoryRetrievalResultV0 } from "./types.js";

export interface MemoryRetrievalService {
  /**
   * Answers one closed query against the immutable repository revision it names.
   * Deterministic per (revision, query, config); failures reject without partials.
   */
  retrieve(query: MemoryRetrievalQueryV0): Promise<MemoryRetrievalResultV0>;
}
