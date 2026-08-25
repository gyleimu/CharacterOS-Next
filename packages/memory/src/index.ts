/**
 * P2.2.1 — @characteros-next/memory public contracts.
 *
 * Infrastructure contracts only: repository revision manifest schema/hash, kind-scoped
 * memory references, the MemoryRepository port and the EpisodicMemoryRecordV0 draft.
 * No storage selection, no retrieval algorithm, no embedding/RAG, no LLM — and Subject
 * Core never depends on this package (inverted verdict-only capabilities only).
 */

export {
  MEMORY_BOUND_REF_KINDS,
  isMemoryBoundRefKind,
  parseAppraisalRef,
  parseAffectSnapshotRef,
  parseEpisodeRef,
  parseEventRef,
  parseExperienceRef,
  parseMemoryBoundRef,
  parseMemoryContentRef,
  type AppraisalRef,
  type AffectSnapshotRef,
  type EpisodeRef,
  type EventRef,
  type ExperienceRef,
  type MemoryBoundRef,
  type MemoryBoundRefKind,
  type MemoryContentRef
} from "./refs.js";

export {
  REPOSITORY_MANIFEST_SCHEMA_VERSION,
  REPOSITORY_REVISION_HASH_PROJECTION,
  computeRepositoryRevisionHash,
  prepareRevisionManifest,
  validateRepositoryManifest,
  type PreparedRevisionV0,
  type RevisionPrepareRequestV0
} from "./revisions.js";

export type { MemoryRepository } from "./repository/memory-repository.js";

export {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryContextV0,
  type EpisodicMemoryProvenanceV0,
  type EpisodicMemoryRecordV0,
  type EpisodicMemorySalienceV0
} from "./records/episodic-record.js";
