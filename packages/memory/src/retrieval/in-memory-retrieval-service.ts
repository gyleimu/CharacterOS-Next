/**
 * P2.2.4 — InMemoryRetrievalService: deterministic reference adapter (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §16, §5.1–§5.3; plan §3.3.
 *
 * The adapter replays INJECTED DECLARATIVE FIXTURES (`RetrievalRehearsalV0`) verbatim:
 * the fixture author declares selections, aligned evidence and candidate counts per
 * (repository revision, semantic anchor). This class adds NO search, NO ranking, NO
 * embedding, NO vector index and NO LLM. Behavior is fail-closed and deterministic:
 *
 * - malformed query .......................... throws INVALID_SCHEMA / SS-SCHEMA-001
 * - query revision unknown to the adapter .... throws INVALID_MEMORY_REVISION / MEM-REV-001
 * - known revision, unmatched semantic anchor . LEGAL EMPTY RETRIEVAL (valid zero result)
 * - matched rehearsal ......................... declared result assembled verbatim,
 *                                               embedded fingerprint recomputed from the
 *                                               exact query, result deep-frozen
 *
 * Same input ⇒ byte-identical output. Storage is process memory only.
 */

import type {
  CanonicalRefV0,
  RepositoryRevisionIdV0
} from "@characteros-next/subject-core";
import {
  retrievalQueryFingerprint,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0,
  type RetrievalRehearsalV0
} from "./types.js";
import {
  validateMemoryRetrievalQuery,
  validateMemoryRetrievalResult,
  validateRehearsalFixture
} from "./validation.js";

export interface InMemoryRetrievalServiceOptions {
  /** Declarative fixtures; validated fail-closed at construction time. */
  readonly rehearsals: readonly RetrievalRehearsalV0[];
}

export class InMemoryRetrievalService {
  private readonly rehearsalsByKey = new Map<string, RetrievalRehearsalV0>();
  private readonly knownRevisions = new Set<RepositoryRevisionIdV0>();

  constructor(options: InMemoryRetrievalServiceOptions) {
    for (const rehearsal of options.rehearsals) {
      const fixtureCheck = validateRehearsalFixture(rehearsal);
      if (!fixtureCheck.ok) {
        throw new Error(`invalid retrieval fixture: ${fixtureCheck.error.detail}`);
      }
      const key = InMemoryRetrievalService.keyOf(
        rehearsal.repository_revision,
        rehearsal.semantic_reference
      );
      if (this.rehearsalsByKey.has(key)) {
        throw new Error(
          `duplicate rehearsal fixture for (${rehearsal.repository_revision}, ${String(rehearsal.semantic_reference)})`
        );
      }
      this.rehearsalsByKey.set(key, { ...rehearsal });
      this.knownRevisions.add(rehearsal.repository_revision);
    }
  }

  private static keyOf(revision: RepositoryRevisionIdV0, semantic: CanonicalRefV0 | null): string {
    return `${revision}\u0000${semantic ?? "\u0001"}`;
  }

  async retrieve(query: MemoryRetrievalQueryV0): Promise<MemoryRetrievalResultV0> {
    const checked = validateMemoryRetrievalQuery(query);
    if (!checked.ok) {
      throw new Error(`INVALID_SCHEMA/SS-SCHEMA-001: ${checked.error.detail}`);
    }
    const q = checked.value;

    // Revision-consistency guard: revisions unknown to this adapter reject outright.
    if (!this.knownRevisions.has(q.repository_revision)) {
      throw new Error(
        `INVALID_MEMORY_REVISION/MEM-REV-001: repository revision ${q.repository_revision} is unknown to the retrieval adapter`
      );
    }

    const key = InMemoryRetrievalService.keyOf(q.repository_revision, q.semantic_reference);
    const rehearsal = this.rehearsalsByKey.get(key);
    const fingerprint = await retrievalQueryFingerprint(q);

    // LEGAL EMPTY RETRIEVAL: known revision, no rehearsal matches the anchor.
    const selections = rehearsal?.selected_memory_refs ?? [];
    const evidence = rehearsal?.evidence ?? [];
    const candidateCount = rehearsal?.candidate_count ?? 0;
    const traceRef = rehearsal?.retrieval_trace_ref ?? null;

    const result: MemoryRetrievalResultV0 = {
      schema_version: "memory-retrieval-result-v0",
      subject_id: q.subject_id,
      selected_memory_refs: [...selections],
      evidence: evidence.map((entry) => ({ ...entry })),
      retrieval_trace_ref: traceRef,
      deterministic_metadata: {
        repository_revision: q.repository_revision,
        candidate_count: candidateCount,
        computed_under_config: "MEMORY_RETRIEVAL_V0",
        query_fingerprint: fingerprint
      }
    };

    // Self-verification: emitted results always satisfy the frozen contract, including
    // fingerprint recomputation against the exact query.
    const selfCheck = await validateMemoryRetrievalResult(
      result as unknown as Record<string, unknown>,
      q as unknown as Record<string, unknown>
    );
    if (!selfCheck.ok) {
      throw new Error(`retrieval adapter produced a non-conforming result: ${selfCheck.error.detail}`);
    }
    deepFreeze(result);
    return result;
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
