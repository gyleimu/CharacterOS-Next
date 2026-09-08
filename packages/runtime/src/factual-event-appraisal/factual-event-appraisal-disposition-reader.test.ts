/**
 * DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0 — disposition resolver matrix.
 *
 * Proves resolveInitialAppraisalDispositionForFactualEventV0 against the
 * durable repository state model: PENDING / APPRAISED / ABSTAINED_INSUFFICIENT_
 * CONTEXT are mutually exclusive terminal-or-pending readings of the effective
 * visible ancestry; every conflict, duplicate and malformed candidate fails
 * closed; unrelated and non-INITIAL records never alter the disposition.
 * Absence of both artifacts is PENDING — never abstention.
 */

import { describe, expect, it } from "vitest";

import {
  deriveFactualEventAppraisalRefV0,
  validateFactualEventAppraisalRecordV0,
  type FactualEventAppraisalRecordV0
} from "@characteros-next/appraisal";
import {
  deriveFactualEventAppraisalAbstentionRefV0,
  type FactualEventAppraisalAbstentionRecordV0
} from "@characteros-next/appraisal";
import { InMemoryMemoryRepository } from "@characteros-next/memory";
import {
  resolveInitialAppraisalDispositionForFactualEventV0
} from "./factual-event-appraisal-disposition-reader.js";

const SUBJECT = "subject-s0";
const EVENT_A = "event:" + "a".repeat(64);
const EVENT_B = "event:" + "b".repeat(64);
const OBSERVATION = "observation:" + "c".repeat(64);
const HASH = "sha256:" + "d".repeat(64);
const HASH_2 = "sha256:" + "e".repeat(64);
const HASH_3 = "sha256:" + "f".repeat(64);

async function abstentionFixture(eventRef: string, overrides: Record<string, unknown> = {}): Promise<FactualEventAppraisalAbstentionRecordV0> {
  const body = {
    schema_version: "factual-event-appraisal-abstention-record-v0",
    semantic_appraisal_episode: "INITIAL",
    subject_id: SUBJECT,
    factual_event_ref: eventRef,
    factual_event_payload_hash: HASH,
    source_observation_ref: OBSERVATION,
    source_observation_transition_id: "t-learn-obs",
    source_admission_history_sequence: 5,
    subject_state: { state_revision: 2, state_hash: HASH_2, repository_revision: "R1" },
    evaluated_at_logical_time: 9,
    reason: "INSUFFICIENT_CONTEXT",
    provenance: { stage: "CONTEXT_EVALUATION" },
    ...overrides
  };
  const ref = await deriveFactualEventAppraisalAbstentionRefV0(body as never);
  return { ...body, abstention_ref: ref } as unknown as FactualEventAppraisalAbstentionRecordV0;
}

async function appraisalFixture(eventRef: string, overrides: Record<string, unknown> = {}): Promise<FactualEventAppraisalRecordV0> {
  const body = {
    schema_version: "factual-event-appraisal-record-v0",
    semantic_appraisal_episode: "INITIAL",
    subject_id: SUBJECT,
    factual_event_ref: eventRef,
    factual_event_payload_hash: HASH,
    source_observation_ref: OBSERVATION,
    source_observation_transition_id: "t-learn-obs",
    source_admission_history_sequence: 5,
    subject_state: { state_revision: 2, state_hash: HASH_2, repository_revision: "R1" },
    evaluated_at_logical_time: 9,
    subject_context: { schema_version: "experience-appraisal-subject-context-v0", current_task: "revise the update" },
    context_projection_hash: HASH_3,
    dimensions: {
      relevance: 0.8, goal_congruence: 0.3, attribution: "other",
      controllability: 0.4, uncertainty: 0.5, intensity: 0.6
    },
    assessment_confidence: 0.7,
    evidence_refs: [eventRef, OBSERVATION].sort(),
    provenance: {
      provider_id: "factual-event-appraisal-provider",
      provider_contract_version: "factual-event-appraisal-provider-v0",
      proposal_hash: HASH_2,
      transition_id: "t-learn-appr"
    },
    ...overrides
  };
  const ref = await deriveFactualEventAppraisalRefV0(body as never);
  const record = { ...body, appraisal_ref: ref };
  const checked = validateFactualEventAppraisalRecordV0(record);
  if (!checked.ok) throw new Error(`fixture invariant: appraisal fixture must validate: ${checked.error.detail}`);
  return checked.value;
}

async function repoWithRecords(...records: readonly unknown[]): Promise<InMemoryMemoryRepository> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  if (records.length === 0) return repo;
  const entries = [];
  for (const record of records) {
    const ref = (record as { abstention_ref?: string; appraisal_ref?: string }).abstention_ref ??
      (record as { appraisal_ref?: string }).appraisal_ref;
    if (ref === undefined) throw new Error("fixture invariant: record must carry a self ref");
    const hash = await repo.storePayload(ref as never, record);
    entries.push({ ref, payload_hash: hash });
  }
  entries.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  await repo.prepareRevision({ parent_revision: "R0" as never, records: entries as never });
  return repo;
}

function headRevision(repo: InMemoryMemoryRepository): string {
  const ids = repo.revisionIds();
  const head = ids.at(-1);
  if (head === undefined) throw new Error("fixture invariant: head revision must exist");
  return head;
}

describe("resolveInitialAppraisalDispositionForFactualEventV0 — resolver matrix (§51)", () => {
  it("13. 0 Appraisal / 0 abstention → PENDING (absence is never abstention)", async () => {
    const repo = await repoWithRecords();
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("PENDING");
  });

  it("14. 1 Appraisal / 0 abstention → APPRAISED with the verified record", async () => {
    const appraisal = await appraisalFixture(EVENT_A);
    const repo = await repoWithRecords(appraisal);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("APPRAISED");
    if (result.kind !== "APPRAISED") return;
    expect(result.appraisal.appraisal_ref).toBe(appraisal.appraisal_ref);
    expect(result.appraisal.factual_event_ref).toBe(EVENT_A);
  });

  it("15. 0 Appraisal / 1 abstention → ABSTAINED_INSUFFICIENT_CONTEXT with the verified record", async () => {
    const abstention = await abstentionFixture(EVENT_A);
    const repo = await repoWithRecords(abstention);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
    if (result.kind !== "ABSTAINED_INSUFFICIENT_CONTEXT") return;
    expect(result.abstention.abstention_ref).toBe(abstention.abstention_ref);
    expect(result.abstention.reason).toBe("INSUFFICIENT_CONTEXT");
    expect(result.abstention.semantic_appraisal_episode).toBe("INITIAL");
  });

  it("16. 1 Appraisal + 1 abstention → INTEGRITY_FAILURE (never resolved by timestamp)", async () => {
    const repo = await repoWithRecords(
      await appraisalFixture(EVENT_A),
      await abstentionFixture(EVENT_A)
    );
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("INTEGRITY_FAILURE");
  });

  it("17. >1 Appraisal → INTEGRITY_FAILURE", async () => {
    const first = await appraisalFixture(EVENT_A);
    const second = await appraisalFixture(EVENT_A, {
      subject_context: { schema_version: "experience-appraisal-subject-context-v0", current_task: "a different task" }
    });
    expect(second.appraisal_ref).not.toBe(first.appraisal_ref);
    const repo = await repoWithRecords(first, second);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("INTEGRITY_FAILURE");
  });

  it("18. >1 abstention → INTEGRITY_FAILURE (even with identical reason)", async () => {
    const first = await abstentionFixture(EVENT_A);
    const second = await abstentionFixture(EVENT_A, { evaluated_at_logical_time: 10 });
    expect(second.abstention_ref).not.toBe(first.abstention_ref);
    const repo = await repoWithRecords(first, second);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("INTEGRITY_FAILURE");
  });

  it("19. malformed visible Appraisal → INTEGRITY_FAILURE (corruption is NOT absence)", async () => {
    const appraisal = await appraisalFixture(EVENT_A);
    const mutated = { ...appraisal, dimensions: { ...appraisal.dimensions, relevance: 5.5 } };
    const repo = await repoWithRecords(mutated);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("INTEGRITY_FAILURE");
    if (result.kind === "INTEGRITY_FAILURE") expect(result.reason).toContain("is malformed");
  });

  it("20. malformed visible Abstention → INTEGRITY_FAILURE (corruption is NOT absence)", async () => {
    const abstention = await abstentionFixture(EVENT_A);
    const mutated = { ...abstention, source_admission_history_sequence: -1 };
    const repo = await repoWithRecords(mutated);
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("INTEGRITY_FAILURE");
    if (result.kind === "INTEGRITY_FAILURE") expect(result.reason).toContain("is malformed");
  });

  it("21. unrelated event records ignored (event B artifacts do not decide event A)", async () => {
    const repo = await repoWithRecords(
      await appraisalFixture(EVENT_B),
      await abstentionFixture(EVENT_B)
    );
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("PENDING");
    // The other subject's records are equally invisible to this subject.
    const otherSubject = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, "subject-other", EVENT_B);
    expect(otherSubject.kind).toBe("PENDING");
  });

  it("22. historical non-INITIAL records do not alter INITIAL disposition", async () => {
    // An Experience-grounded Appraisal (different contract/schema) is visible
    // under the same `appraisal:` ref kind but is a different lifecycle.
    const repo = new InMemoryMemoryRepository();
    await repo.prepareRevision({ parent_revision: null as never, records: [] });
    const experienceAppraisal = {
      schema_version: "experience-appraisal-record-v0",
      semantic_appraisal_episode: "INITIAL",
      experience_ref: "experience:" + "9".repeat(64),
      subject_id: SUBJECT
    };
    const hash = await repo.storePayload("appraisal:" + "8".repeat(64) as never, experienceAppraisal);
    await repo.prepareRevision({ parent_revision: "R0" as never, records: [{ ref: "appraisal:" + "8".repeat(64) as never, payload_hash: hash }] });
    const result = await resolveInitialAppraisalDispositionForFactualEventV0(repo, headRevision(repo) as never, SUBJECT, EVENT_A);
    expect(result.kind).toBe("PENDING");
  });
});
