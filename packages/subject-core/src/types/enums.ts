/**
 * P2.1.1 — Frozen literal enums and the authoritative requirement catalog.
 * Source: docs/implementation/p2-1-contract-freeze.md §3 (49 MUST leaves), §5.3 (ref kinds),
 * §6.2 (channel/phase), §7.1 (transition type / time input), §13 (statuses, error codes).
 * Types + constants only; no validation or processing.
 */

/** §5.3 ref kinds (21 exact literals). */
export const REF_KINDS = [
  "audit",
  "appraisal",
  "commit",
  "entity",
  "environment",
  "episode",
  "event",
  "experience",
  "memory",
  "observation",
  "outcome",
  "proposal",
  "relationship",
  "result",
  "retrieval-trace",
  "seed-schema",
  "snapshot",
  "source",
  "subject",
  "trace",
  "workflow"
] as const;

export type RefKind = (typeof REF_KINDS)[number];

/** §6.2 affect channel enum. */
export type AffectChannelId = "anger" | "fear" | "sadness" | "joy";

export const AFFECT_CHANNEL_IDS = ["anger", "fear", "sadness", "joy"] as const;

/** §6.2 affect phase enum. */
export type AffectPhase = "INACTIVE" | "ACTIVE" | "RELEASING";

/** §7.1 transition types. */
export type TransitionType =
  | "Time"
  | "Observation"
  | "CognitionAction"
  | "Learning"
  | "Personality"
  | "Relationship"
  | "Belief";

export const TRANSITION_TYPES = [
  "Time",
  "Observation",
  "CognitionAction",
  "Learning",
  "Personality",
  "Relationship",
  "Belief"
] as const;

/** §7.1 canonical time input kinds. */
export type TimeInputKind = "ELAPSED" | "OCCURRENCE";

/** §13.1 statuses (creation / core / logical / MICL / publish). */
export type StatusValue =
  | "CREATED"
  | "COMMITTED"
  | "ALREADY_COMMITTED"
  | "NO_OP"
  | "REJECTED"
  | "ABORTED"
  | "REBASE_REQUIRED"
  | "COMPLETED"
  | "FAILED_BEFORE_STATE_CHANGE"
  | "FAILED_AFTER_TIME"
  | "FAILED_AFTER_OBSERVATION"
  | "PENDING"
  | "PUBLISHED";

/** §13.2 frozen error codes. */
export type ErrorCode =
  | "INVALID_SCHEMA"
  | "INVALID_VALUE_RANGE"
  | "STALE_STATE_REVISION"
  | "INVALID_LOGICAL_TIME"
  | "INVALID_TIMEBASE"
  | "INVALID_MEMORY_REVISION"
  | "INVALID_MEMORY_REFERENCE"
  | "FORBIDDEN_DIRECT_MUTATION"
  | "UNKNOWN_SUBJECT"
  | "PROPOSAL_REJECTED"
  | "DOMAIN_DELTA_CONFLICT"
  | "MISSING_REQUIRED_DELTA"
  | "UNAUTHORIZED_PRODUCER"
  | "INVALID_TRANSITION_COMPOSITION"
  | "INVALID_TRANSITION_OWNER"
  | "INVARIANT_VIOLATION"
  | "COMMIT_CONFLICT"
  | "TRANSITION_ID_REUSE"
  | "SERVICE_UNAVAILABLE"
  | "OUT_OF_ORDER_OBSERVATION"
  | "INVALID_STAGE_DEPENDENCY"
  | "UNSUPPORTED_EVIDENCE_REF"
  | "MICL_ID_REUSE"
  | "ACTION_UNAVAILABLE"
  | "EXTERNAL_ACTION_FAILED"
  | "FULL_SNAPSHOT_CHECKSUM_MISMATCH"
  | "STATE_HASH_MISMATCH"
  | "SNAPSHOT_HASH_MISMATCH"
  | "TRACE_INTEGRITY_FAILURE"
  | "COMMIT_CHAIN_INTEGRITY_FAILURE";

/** §3.2 P2.1 applicable MUST leaves (28). */
export type P21RequirementId =
  | "SS-SCHEMA-001"
  | "SS-IMMUTABLE-001"
  | "SS-REVISION-001"
  | "SS-AUTH-001"
  | "SS-RESTORE-001"
  | "SS-RESTORE-002"
  | "TR-DET-001"
  | "TR-ATOMIC-001"
  | "TR-CONFLICT-001"
  | "MEM-REV-001"
  | "MEM-OWN-001"
  | "MEM-ORPHAN-001"
  | "LLM-AUTH-001"
  | "TRACE-ATOMIC-001"
  | "TRACE-CONTENT-001"
  | "TRACE-HISTORY-001"
  | "TRACE-REJECT-001"
  | "HASH-DET-001"
  | "HASH-PROJ-001"
  | "HASH-SER-001"
  | "HASH-SNAPSHOT-001"
  | "FAIL-PRECOMMIT-001"
  | "FAIL-CAS-001"
  | "FAIL-PUBLISH-001"
  | "IDEM-COMMIT-001"
  | "IDEM-REUSE-001"
  | "IDEM-RETRY-001"
  | "IDEM-RECOVERY-001";

/** §3.3 later-phase A1–A13 leaves (21), frozen but NOT_DUE in P2.1. */
export type LaterPhaseRequirementId =
  | "MEM-RET-DET-001"
  | "MICL-DET-001"
  | "MEM-RET-HISTORY-001"
  | "MEM-RET-CONTROL-001"
  | "MICL-RETRIEVAL-001"
  | "MICL-STAGE-001"
  | "LLM-EVID-001"
  | "SS-AFFECT-001"
  | "TIME-AFFECT-001"
  | "TIME-NOOBS-001"
  | "TRACE-CHAIN-001"
  | "TIME-ADVANCE-001"
  | "TIME-NOOP-001"
  | "TIME-OCCURRENCE-001"
  | "TIME-WALL-001"
  | "MICL-ACTION-001"
  | "FAIL-SERVICE-001"
  | "FAIL-PREPARE-001"
  | "MICL-RESUME-001"
  | "MEM-IDEM-001"
  | "REBASE-STALE-001";

/** The full 49-leaf authoritative requirement catalog (§3). */
export type RequirementId = P21RequirementId | LaterPhaseRequirementId;

/** §7.2 registered producer literals. */
export type ProducerName =
  | "affect"
  | "belief"
  | "context"
  | "memory"
  | "regulation"
  | "personality"
  | "relationship";

/** §7.2 registered domain literals (memory split into content / retrieval). */
export type DomainName =
  | "affect"
  | "belief"
  | "context"
  | "memory-content"
  | "memory-retrieval"
  | "regulation"
  | "personality"
  | "relationship";
