/**
 * P2.3 R2 (§16) — journal export/import hardening regressions.
 * Red-team findings: exportState exposed live mutable records, importState
 * applied unvalidated records (invalid terminals injectable), and the
 * first-seen sequence counter did not recover across restart — letting a
 * restarted journal collide with pre-restart identities.
 */

import { describe, expect, it } from "vitest";

import { InMemoryTransitionIdentityJournal } from "./journal.js";
import type { AuthoritativeTransitionRecordV1 } from "../types/identity.js";
import type { HashV1, HistorySequenceV0, IdentifierV0, TransitionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";

const FINGERPRINT = ("sha256:" + "1".repeat(64)) as HashV1;
const PROPOSAL_REF = "proposal:p1" as CanonicalRefV0;
const RESULT_REF = "result:r1" as CanonicalRefV0;

function reserve(journal: InMemoryTransitionIdentityJournal, transitionId: string) {
  return journal.reserveIdentity({
    transition_id: transitionId as TransitionIdV0,
    subject_id: "subject-s0" as IdentifierV0,
    transition_type: "Time",
    proposal_ref: PROPOSAL_REF,
    payload_fingerprint: FINGERPRINT
  });
}

/**
 * Structurally AND semantically valid terminal COMMITTED record (crafted for
 * injection tests): a genuine last COMMITTED attempt whose result ref equals
 * the terminal result ref (Round-3 B3: semantic validation accepts it, so
 * forgery must be modeled at the semantic level, not just the shape level).
 */
function committedAttemptFor(resultRef: CanonicalRefV0): Record<string, unknown> {
  return {
    attempt_sequence: 1,
    status: "COMMITTED",
    revision_before: 0,
    revision_after: 1,
    state_hash_before: `sha256:${"a".repeat(64)}`,
    state_hash_after: `sha256:${"b".repeat(64)}`,
    result_ref: resultRef,
    prepared_result_ref: "workflow:w-1",
    trace_ref: "trace:t-1",
    audit_ref: null,
    error_code: null,
    reason: null
  };
}

function forgedCommittedRecord(transitionId: string): AuthoritativeTransitionRecordV1 {
  return {
    schema_version: "transition-record-v1",
    record_version: 2,
    transition_id: transitionId as TransitionIdV0,
    subject_id: "subject-s0" as IdentifierV0,
    transition_type: "Time",
    proposal_ref: PROPOSAL_REF,
    payload_fingerprint: FINGERPRINT,
    fingerprint_version: "proposal-fingerprint-v1",
    first_seen_sequence: 1 as HistorySequenceV0,
    attempts: [committedAttemptFor(RESULT_REF) as never],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: RESULT_REF
  };
}

describe("journal export/import hardening (§16)", () => {
  it("export returns a safe immutable snapshot — host mutation cannot reach journal state", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    await reserve(journal, "t-export-immutable");

    const exported = journal.exportState();
    expect(exported).toHaveLength(1);
    const record = exported[0] as unknown as Record<string, unknown>;

    // Deep freeze: mutating the exported record or the snapshot array throws.
    expect(() => {
      record["terminal_status"] = "COMMITTED";
    }).toThrow();
    expect(() => {
      (record["attempts"] as unknown[]).push({});
    }).toThrow();
    expect(() => {
      exported.push(record as unknown as AuthoritativeTransitionRecordV1);
    }).toThrow();

    // Internal state is untouched by the attempted mutations.
    const internal = await journal.readRecord("t-export-immutable" as TransitionIdV0);
    expect(internal?.terminal_status).toBeNull();
    expect(internal?.attempts).toHaveLength(0);
  });

  it("import cannot inject an invalid terminal record (status without result ref)", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    const forged = { ...forgedCommittedRecord("t-inject-terminal"), terminal_result_ref: null };
    expect(() =>
      journal.importState([forged as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-inject-terminal" as TransitionIdV0)).toBeNull();
  });

  it("B3.1: forged structurally valid COMMITTED with zero attempts is rejected (semantic gate)", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    // Structurally perfect, semantically impossible: a terminal COMMITTED state
    // without any attempt never exists under the frozen journal lifecycle.
    const forged = { ...forgedCommittedRecord("t-b3-empty-attempts"), attempts: [] };
    expect(() =>
      journal.importState([forged as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-b3-empty-attempts" as TransitionIdV0)).toBeNull();
  });

  it("B3.2: terminal result ref differing from the last committed attempt is rejected", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    const forged = {
      ...forgedCommittedRecord("t-b3-ref-mismatch"),
      terminal_result_ref: "result:other" as CanonicalRefV0
    };
    expect(() =>
      journal.importState([forged as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-b3-ref-mismatch" as TransitionIdV0)).toBeNull();
  });

  it("B3.3: a reuse conflict replaying the reserved identity tuple is rejected", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    const base = forgedCommittedRecord("t-b3-conflict-replay");
    const conflict = {
      conflict_sequence: 1,
      attempted_subject_id: "subject-s0",
      attempted_transition_type: "Time",
      attempted_proposal_ref: PROPOSAL_REF,
      attempted_payload_fingerprint: FINGERPRINT,
      revision_before: 0,
      logical_time_before: 0,
      state_hash_before: `sha256:${"c".repeat(64)}`,
      snapshot_hash_before: `sha256:${"d".repeat(64)}`,
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001",
      audit_ref: "audit:a-1",
      result_ref: "result:c-1"
    };
    const forged = {
      ...base,
      record_version: 3,
      reuse_conflicts: [conflict as never]
    };
    expect(() =>
      journal.importState([forged as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-b3-conflict-replay" as TransitionIdV0)).toBeNull();
  });

  it("B3.x: attempt status invariants reject forged COMMITTED/NO_OP attempts", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    // COMMITTED attempt that does not advance the revision.
    const badAttempt = { ...committedAttemptFor(RESULT_REF), revision_after: 0 };
    const forged = {
      ...forgedCommittedRecord("t-b3-attempt-invariant"),
      attempts: [badAttempt as never]
    };
    expect(() =>
      journal.importState([forged as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);

    // record_version below the journal-history floor (1 + attempts + conflicts).
    const shortVersion = {
      ...forgedCommittedRecord("t-b3-short-version"),
      record_version: 1,
      attempts: [committedAttemptFor(RESULT_REF) as never]
    };
    expect(() =>
      journal.importState([shortVersion as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-b3-short-version" as TransitionIdV0)).toBeNull();
  });

  it.each([
    ["schema_version", { schema_version: "not-a-record" }],
    ["record_version zero", { record_version: 0 }],
    ["bad fingerprint", { payload_fingerprint: "not-a-hash" }],
    ["bad transition_type", { transition_type: "NotAType" }],
    ["unknown key", { smuggled: true }],
    ["terminal ref without status", { terminal_status: null, terminal_result_ref: RESULT_REF }]
  ])("import rejects malformed record fields (%s)", async (_label, patch) => {
    const journal = new InMemoryTransitionIdentityJournal();
    const malformed = { ...forgedCommittedRecord("t-malformed"), ...patch };
    expect(() =>
      journal.importState([malformed as unknown as AuthoritativeTransitionRecordV1])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(await journal.readRecord("t-malformed" as TransitionIdV0)).toBeNull();
  });

  it("import is all-or-nothing: one invalid record rejects the whole batch", async () => {
    const journal = new InMemoryTransitionIdentityJournal();
    const valid = forgedCommittedRecord("t-batch-valid");
    const invalid = { ...forgedCommittedRecord("t-batch-invalid"), record_version: 0 };
    expect(() =>
      journal.importState([
        valid,
        invalid as unknown as AuthoritativeTransitionRecordV1
      ])
    ).toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    // The valid record in the same batch must NOT have been partially applied.
    expect(await journal.readRecord("t-batch-valid" as TransitionIdV0)).toBeNull();
  });

  it("import restores the first-seen sequence counter deterministically", async () => {
    const journalA = new InMemoryTransitionIdentityJournal();
    await reserve(journalA, "t-restart-1");
    await reserve(journalA, "t-restart-2");
    await reserve(journalA, "t-restart-3");
    const exported = journalA.exportState();
    expect(exported.map((r) => r.first_seen_sequence)).toEqual([1, 2, 3]);

    const journalB = new InMemoryTransitionIdentityJournal();
    journalB.importState(exported);

    // The restarted journal continues the sequence, never colliding with
    // pre-restart identities.
    await reserve(journalB, "t-restart-4");
    const next = await journalB.readRecord("t-restart-4" as TransitionIdV0);
    expect(next?.first_seen_sequence).toBe(4);
  });

  it("honest export → import round-trip preserves records and routing", async () => {
    const journalA = new InMemoryTransitionIdentityJournal();
    await reserve(journalA, "t-roundtrip");

    const journalB = new InMemoryTransitionIdentityJournal();
    journalB.importState(journalA.exportState());

    const restored = await journalB.readRecord("t-roundtrip" as TransitionIdV0);
    expect(restored).toEqual(await journalA.readRecord("t-roundtrip" as TransitionIdV0));

    // Same identity routes to the open record; the sequence counter continues.
    const same = await reserve(journalB, "t-roundtrip");
    expect(same.route).toBe("SAME_OPEN_OR_RETRY");
    await reserve(journalB, "t-roundtrip-other");
    expect(
      (await journalB.readRecord("t-roundtrip-other" as TransitionIdV0))?.first_seen_sequence
    ).toBe(2);
  });
});
