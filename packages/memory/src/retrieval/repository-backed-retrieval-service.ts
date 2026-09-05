/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 follow-on — EXPERIENCE_MEMORY_FUTURE_COGNITION_
 * INTEGRATION_V0: RepositoryBackedMemoryRetrievalServiceV0.
 *
 * The first repository-backed deterministic retrieval service. It implements the
 * EXISTING MemoryRetrievalService contract (no query/result schema changes) and
 * reads ONLY the revision named by `MemoryRetrievalQueryV0.repository_revision`:
 *
 *   load manifest → enumerate episode records → verify each payload hash against
 *   the manifest entry → validate each EpisodicMemoryRecordV0 → derive a small
 *   noncanonical search view → apply query constraints → deterministic ranking →
 *   top-K → contract-boundary normalization (raw-ASCII-sorted selections).
 *
 * AUTHORITY LAW: a search hit never establishes truth. A candidate whose payload
 * hash mismatches the manifest entry or whose payload violates the canonical
 * record schema is IGNORED (never selected) — repository payload remains the
 * only authority. Ordinary InMemoryRetrievalService and rehearsal adapters are
 * untouched; this is an additional service, not a replacement.
 *
 * NO semantic labels are derived (no approval/reward/sentiment/success). The
 * search view carries refs, times and declared salience only. No embeddings, no
 * LLM, no wall clock, no randomness.
 */

import type {
  CanonicalRefV0,
  HashV1,
  LogicalTimeV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { refKind } from "@characteros-next/subject-core";
import { EPISODIC_MEMORY_RECORD_SCHEMA_VERSION, validateEpisodicMemoryRecord, type EpisodicMemoryRecordV0 } from "../records/episodic-record.js";
import { computeMemoryRecordPayloadHash } from "../record-payload-hash.js";
import type { InMemoryMemoryRepository } from "../repository/in-memory-memory-repository.js";
import { validateMemoryRetrievalQuery, validateMemoryRetrievalResult } from "./validation.js";
import {
  MEMORY_RETRIEVAL_CONFIG_V0,
  retrievalQueryFingerprint,
  type MemoryRetrievalResultV0,
  type RetrievalEvidenceV0,
  type RetrievalReasonDimension,
  type RetrievalReasonV0,
  type SelectedEpisodeRef
} from "./types.js";

/** Minimal ephemeral search projection derived ONLY from a verified episode payload. */
export interface RepositoryEpisodeSearchViewV0 {
  readonly episode_ref: CanonicalRefV0;
  readonly episode_payload_hash: HashV1;
  readonly occurrence_logical_time: LogicalTimeV0;
  readonly references: readonly CanonicalRefV0[];
  readonly focus_refs: readonly CanonicalRefV0[];
  readonly environment_refs: readonly CanonicalRefV0[];
  readonly declared_salience: UnitIntervalV0;
}

/** Deterministic hit counts per matching dimension for one candidate. */
interface CandidateHits {
  readonly view: RepositoryEpisodeSearchViewV0;
  readonly semantic: boolean;
  readonly entity: number;
  readonly relationship: number;
  readonly context: number;
}

function overlapCount(queryRefs: readonly CanonicalRefV0[], candidateRefs: readonly CanonicalRefV0[]): number {
  const candidateSet = new Set<string>(candidateRefs);
  let count = 0;
  for (const ref of queryRefs) {
    if (candidateSet.has(ref)) count += 1;
  }
  return count;
}

/**
 * Deterministic ranking comparator (approved precedence):
 *   1. semantic-reference hit
 *   2. entity overlap
 *   3. relationship overlap
 *   4. context overlap
 *   5. declared salience
 *   6. recency (occurrence_logical_time)
 *   7. episode ref (raw-ASCII) as the final tie-breaker
 */
function rankCandidates(candidates: readonly CandidateHits[]): CandidateHits[] {
  return [...candidates].sort((a, b) => {
    if (a.semantic !== b.semantic) return a.semantic ? -1 : 1;
    if (a.entity !== b.entity) return b.entity - a.entity;
    if (a.relationship !== b.relationship) return b.relationship - a.relationship;
    if (a.context !== b.context) return b.context - a.context;
    if (a.view.declared_salience !== b.view.declared_salience) {
      return b.view.declared_salience - a.view.declared_salience;
    }
    if (a.view.occurrence_logical_time !== b.view.occurrence_logical_time) {
      return b.view.occurrence_logical_time - a.view.occurrence_logical_time;
    }
    return a.view.episode_ref < b.view.episode_ref ? -1 : a.view.episode_ref > b.view.episode_ref ? 1 : 0;
  });
}

/**
 * Repository-backed retrieval over ONE immutable revision. Reads payloads through
 * the concrete in-memory repository's stored-payload face (composition-trusted,
 * same pattern as the episode content reader). Exposes no mutation surface.
 */
export class RepositoryBackedMemoryRetrievalServiceV0 {
  private readonly repository: InMemoryMemoryRepository;

  constructor(repository: InMemoryMemoryRepository) {
    this.repository = repository;
  }

  async retrieve(query: unknown): Promise<MemoryRetrievalResultV0> {
    const checked = validateMemoryRetrievalQuery(query);
    if (!checked.ok) {
      throw new Error(`INVALID_MEMORY_REVISION/MEM-REV-001: retrieval query invalid (${checked.error.detail})`);
    }
    const q = checked.value;

    const manifest = await this.repository.readManifest(q.repository_revision);
    if (manifest === null) {
      throw new Error(`INVALID_MEMORY_REVISION/MEM-REV-001: revision ${q.repository_revision} has no manifest`);
    }

    // ---- enumerate + verify episode candidates (payload remains authority) --------
    const views: RepositoryEpisodeSearchViewV0[] = [];
    let candidateCount = 0;
    for (const entry of manifest.record_hashes) {
      if (refKind(entry.ref as CanonicalRefV0) !== "episode") continue;
      candidateCount += 1;
      const payload = this.repository.readStoredPayload(entry.ref as never);
      if (payload === undefined) continue; // unresolvable — never selected
      const recomputed = await computeMemoryRecordPayloadHash(payload);
      if (recomputed !== entry.payload_hash) continue; // tampered — ignored
      const schemaChecked = validateEpisodicMemoryRecord(payload);
      if (!schemaChecked.ok) continue; // malformed — ignored
      if (schemaChecked.value.schema_version !== EPISODIC_MEMORY_RECORD_SCHEMA_VERSION) continue;
      const record: EpisodicMemoryRecordV0 = schemaChecked.value;
      views.push({
        episode_ref: record.episode_ref,
        episode_payload_hash: entry.payload_hash,
        occurrence_logical_time: record.occurrence_logical_time,
        references: [...record.references],
        focus_refs: [...record.context.focus_refs],
        environment_refs: [...record.context.environment_refs],
        declared_salience: record.salience.declared_score
      });
    }

    // ---- constraints + deterministic matching --------------------------------------
    const hits: CandidateHits[] = [];
    for (const view of views) {
      // Temporal law: occurrence within [window_start, now].
      if (view.occurrence_logical_time > q.temporal.now_logical_time) continue;
      if (q.temporal.window_start !== null && view.occurrence_logical_time < q.temporal.window_start) continue;
      // Salience floor.
      if (q.salience_constraints.min_declared_score !== null && view.declared_salience < q.salience_constraints.min_declared_score) {
        continue;
      }
      const semantic = q.semantic_reference !== null && view.references.includes(q.semantic_reference);
      const entity = overlapCount(q.entity_refs, view.references);
      const relationship = overlapCount(q.relationship_refs, view.references);
      const context = overlapCount(q.current_context_refs, [...view.focus_refs, ...view.environment_refs]);
      if (!semantic && entity === 0 && relationship === 0 && context === 0) continue;
      hits.push({ view, semantic, entity, relationship, context });
    }

    // ---- deterministic ranking → top-K → contract-boundary normalization ------------
    const ranked = rankCandidates(hits).slice(0, q.salience_constraints.max_candidates);
    const selected = ranked
      .map((hit) => hit.view.episode_ref as SelectedEpisodeRef)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const evidence: RetrievalEvidenceV0[] = selected.map((ref) => {
      const hit = ranked.find((candidate) => candidate.view.episode_ref === ref);
      if (hit === undefined) throw new Error("retrieval integrity failure: selection missing from ranked set");
      const reasons: RetrievalReasonV0[] = [];
      const pushReason = (dimension: RetrievalReasonDimension, score: number): void => {
        reasons.push({ dimension, score: Math.max(0, Math.min(1, score)) as UnitIntervalV0 });
      };
      if (hit.semantic) pushReason("SEMANTIC", 1);
      if (hit.entity > 0) {
        pushReason("ENTITY", q.entity_refs.length === 0 ? 1 : hit.entity / q.entity_refs.length);
      }
      if (hit.relationship > 0) {
        pushReason("RELATIONSHIP", q.relationship_refs.length === 0 ? 1 : hit.relationship / q.relationship_refs.length);
      }
      if (hit.context > 0) {
        pushReason("CONTEXT", q.current_context_refs.length === 0 ? 1 : hit.context / q.current_context_refs.length);
      }
      pushReason("SALIENCE", hit.view.declared_salience);
      reasons.sort((a, b) => (a.dimension < b.dimension ? -1 : a.dimension > b.dimension ? 1 : 0));
      return { episode_ref: ref, reasons };
    });

    const result: MemoryRetrievalResultV0 = {
      schema_version: "memory-retrieval-result-v0",
      subject_id: q.subject_id,
      selected_memory_refs: selected,
      evidence,
      retrieval_trace_ref: null,
      deterministic_metadata: {
        repository_revision: q.repository_revision,
        candidate_count: candidateCount,
        computed_under_config: MEMORY_RETRIEVAL_CONFIG_V0,
        query_fingerprint: await retrievalQueryFingerprint(q)
      }
    };
    // Fail closed on any contract violation (self-validation under the EXISTING law).
    const resultChecked = await validateMemoryRetrievalResult(result, q);
    if (!resultChecked.ok) {
      throw new Error(`retrieval result violates the result contract (${resultChecked.error.detail})`);
    }
    return result;
  }
}

/** Composition factory returning the service behind the existing port shape. */
export function createRepositoryBackedMemoryRetrievalServiceV0(
  repository: InMemoryMemoryRepository
): Pick<RepositoryBackedMemoryRetrievalServiceV0, "retrieve"> {
  return { retrieve: (query: unknown) => new RepositoryBackedMemoryRetrievalServiceV0(repository).retrieve(query) };
}
