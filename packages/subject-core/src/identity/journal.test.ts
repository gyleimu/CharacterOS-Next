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

/** Structurally valid terminal COMMITTED record (crafted for injection tests). */
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
    attempts: [],
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
