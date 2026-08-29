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

export {
  MEMORY_PREPARE_INTENT_PROJECTION,
  computePrepareIntentFingerprint,
  validatePrepareIntentBody,
  type MemoryPrepareIntentV1
} from "./revisions.js";

export type {
  MemoryPreparationAuthority,
  MemoryRepository,
  MemoryRevisionStoreInternal
} from "./repository/memory-repository.js";

export {
  createMemoryPreparationAuthority
} from "./repository/memory-repository.js";

export {
  MEMORY_RECORD_PAYLOAD_HASH_PROJECTION,
  computeMemoryRecordPayloadHash
} from "./record-payload-hash.js";

export {
  InMemoryMemoryRepository
} from "./repository/in-memory-memory-repository.js";

export {
  MEMORY_RETRIEVAL_CONFIG_V0,
  MEMORY_RETRIEVAL_QUERY_SCHEMA_VERSION,
  MEMORY_RETRIEVAL_RESULT_SCHEMA_VERSION,
  RETRIEVAL_REASON_DIMENSIONS,
  retrievalQueryFingerprint,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0,
  type RetrievalDeterministicMetadataV0,
  type RetrievalEvidenceV0,
  type RetrievalReasonDimension,
  type RetrievalReasonV0,
  type RetrievalRehearsalV0,
  type RetrievalSalienceConstraintsV0,
  type RetrievalTemporalContextV0,
  type SelectedEpisodeRef,
  type RetrievalTraceRef
} from "./retrieval/types.js";

export {
  validateMemoryRetrievalQuery,
  validateMemoryRetrievalResult
} from "./retrieval/validation.js";

export type { MemoryRetrievalService } from "./retrieval/memory-retrieval-service.js";

export {
  InMemoryRetrievalService,
  type InMemoryRetrievalServiceOptions
} from "./retrieval/in-memory-retrieval-service.js";

export {
  validateRehearsalFixture
} from "./retrieval/validation.js";

export {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryContextV0,
  type EpisodicMemoryProvenanceV0,
  type EpisodicMemoryRecordV0,
  type EpisodicMemorySalienceV0
} from "./records/episodic-record.js";
