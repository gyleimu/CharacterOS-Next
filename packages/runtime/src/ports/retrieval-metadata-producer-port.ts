/**
 * P2.3.3 (P0-6 §21) — MemoryRetrievalMetadataProducerPort (refs-only; producer
 * identity `memory`, domain `memory-retrieval`).
 *
 * Observation's OPTIONAL retrieval-metadata delta: working_refs (retrieval-selected
 * episode refs), recent_retrieval_trace ring pointer and last_retrieval_at — all
 * deterministic from the retrieval result + read-only snapshot. No memory writes, no
 * payloads, no ranking: this producer only mirrors evidence the retrieval stage
 * already selected.
 */

import type { DomainDeltaV0, SubjectStateV0 } from "@characteros-next/subject-core";
import type { MemoryRetrievalResultV0 } from "@characteros-next/memory";

export interface RetrievalMetadataProducerInputV0 {
  readonly snapshot: SubjectStateV0;
  readonly retrieval_result: MemoryRetrievalResultV0;
}

export interface RetrievalMetadataProducerPort {
  produceRetrievalMetadataDelta(input: RetrievalMetadataProducerInputV0): Promise<DomainDeltaV0>;
}

/** Deterministic refs-only assembly helper (reference contract). */
export async function buildRetrievalMetadataDelta(
  input: RetrievalMetadataProducerInputV0
): Promise<DomainDeltaV0> {
  const snapshot = input.snapshot;
  const result = input.retrieval_result;
  const delta = {
    producer: "memory",
    domain: "memory-retrieval",
    expected_repository_revision: snapshot.memory_state.repository_revision,
    operations: [
      {
        path: "/memory_state/last_retrieval_at",
        value: snapshot.runtime_metadata.logical_time
      },
      {
        path: "/memory_state/recent_retrieval_trace",
        value: result.retrieval_trace_ref !== null ? [result.retrieval_trace_ref] : []
      },
      {
        path: "/memory_state/working_refs",
        value: [...result.selected_memory_refs]
      }
    ],
    provenance_refs: [...result.selected_memory_refs]
  } as unknown as DomainDeltaV0;
  deepFreeze(delta);
  return delta;
}

/** Reference implementation of the optional retrieval-metadata producer. */
export class ReferenceRetrievalMetadataProducer implements RetrievalMetadataProducerPort {
  async produceRetrievalMetadataDelta(
    input: RetrievalMetadataProducerInputV0
  ): Promise<DomainDeltaV0> {
    return buildRetrievalMetadataDelta(input);
  }
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
