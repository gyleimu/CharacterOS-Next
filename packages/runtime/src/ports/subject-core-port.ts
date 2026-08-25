/**
 * P2.3.1 — SubjectCorePort: the canonical authority boundary (types-only seam).
 *
 * Mirrors the P2.1.3 commit engine public surface plus authoritative snapshot reads.
 * Runtime executors may ONLY act through this port; direct bundle assembly or store
 * access is a layer-0 boundary violation.
 */

import type {
  CommitTransitionInput,
  CommitTransitionOutcome,
  SubjectStateV0
} from "@characteros-next/subject-core";

export interface SubjectCorePort {
  /**
   * Drives the canonical commit pipeline for one complete proposal
   * (validation → guards → candidate → hashes/trace → single CAS).
   * Deterministic per input; outcome mapping is frozen in subject-core.
   */
  commit(input: CommitTransitionInput): Promise<CommitTransitionOutcome>;

  /** Reads the current immutable snapshot, or null when the subject does not exist. */
  readCurrentSnapshot(subjectId: string): Promise<SubjectStateV0 | null>;
}
