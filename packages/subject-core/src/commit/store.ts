/**
 * P2.1.3 — AtomicCommitStore compare-and-commit port and in-memory reference
 * implementation.
 * Source: docs/implementation/p2-1-contract-freeze.md §15.1–§15.3.
 *
 * The port is the ONLY canonical write authority: one call, three outcomes, no partial
 * writes and no last-write-wins. `InMemoryAtomicCommitStore` is a reference adapter
 * for tests and sandbox composition — it holds state in process memory only (no
 * database, no filesystem, no network) and is deliberately NOT wired into any runtime.
 */

import type {
  AtomicCommitBundleV1,
  AtomicCommitOutcomeV1,
  CommitFailureCertainty
} from "../types/persistence.js";

export interface AtomicCommitStorePort {
  compareAndCommit(
    expected_revision: number,
    identity_record_version_before: number,
    complete_bundle: AtomicCommitBundleV1
  ): Promise<AtomicCommitOutcomeV1>;
}

export type InjectedStoreFault = CommitFailureCertainty;

export interface InMemoryAtomicCommitStoreOptions {
  /**
   * Deterministic fault hook for tests: return a certainty to make the next invocation
   * fail with that outcome; return undefined to behave normally.
   */
  readonly nextFault?: () => InjectedStoreFault | undefined;
}

interface SubjectHead {
  readonly revision: number;
  readonly record_version: number;
}

/** Single-subject-heads in-memory store; per-subject revision + record-version CAS. */
export class InMemoryAtomicCommitStore implements AtomicCommitStorePort {
  private readonly heads = new Map<string, SubjectHead>();
  private readonly committedBundles: AtomicCommitBundleV1[] = [];
  private readonly options: InMemoryAtomicCommitStoreOptions;

  constructor(options: InMemoryAtomicCommitStoreOptions = {}) {
    this.options = options;
  }

  /** Committed bundles in authority order (rebuildable projection for tests). */
  getCommittedBundles(): readonly AtomicCommitBundleV1[] {
    return [...this.committedBundles];
  }

  currentRevision(subjectId: string): number | null {
    return this.heads.get(subjectId)?.revision ?? null;
  }

  async compareAndCommit(
    expected_revision: number,
    identity_record_version_before: number,
    complete_bundle: AtomicCommitBundleV1
  ): Promise<AtomicCommitOutcomeV1> {
    const fault = this.options.nextFault?.();
    if (fault !== undefined) {
      return { outcome: "FAILURE", certainty: fault };
    }
    const head = this.heads.get(complete_bundle.subject_id);
    const casMatches =
      head === undefined
        ? expected_revision === 0 && identity_record_version_before === 0
        : head.revision === expected_revision &&
          head.record_version === identity_record_version_before;
    if (!casMatches) {
      // A CAS mismatch never overwrites the winner (§15.2).
      return { outcome: "CONFLICT" };
    }
    if (complete_bundle.expected_revision !== expected_revision) {
      return { outcome: "CONFLICT" };
    }
    this.committedBundles.push(complete_bundle);
    this.heads.set(complete_bundle.subject_id, {
      revision: complete_bundle.next_revision,
      record_version: complete_bundle.transition_record.record_version
    });
    return { outcome: "COMMITTED", bundle: complete_bundle };
  }
}
