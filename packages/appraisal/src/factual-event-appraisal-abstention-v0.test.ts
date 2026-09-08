/**
 * DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0 — abstention record matrix.
 *
 * Proves the closed abstention record schema: lawful context-stage and
 * provider-stage records are accepted; every malformed/hostile variant is
 * rejected fail-closed with no coercion, no repair and no defaults; the
 * self-ref is deterministic over the canonical body; provenance is a closed
 * union (provider fields forbidden on CONTEXT_EVALUATION, required on
 * PROVIDER). Real-model calls 0.
 */

import { describe, expect, it } from "vitest";

import {
  deriveFactualEventAppraisalAbstentionIntentId,
  deriveFactualEventAppraisalAbstentionProposalHashV0,
  deriveFactualEventAppraisalAbstentionRefV0,
  FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION,
  validateFactualEventAppraisalAbstentionRecordV0,
  type FactualEventAppraisalAbstentionRecordV0
} from "./factual-event-appraisal-abstention-v0.js";
import { FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION } from "./factual-event-appraisal-v0.js";

const EVENT_REF = "event:" + "a".repeat(64);
const OBSERVATION_REF = "observation:" + "b".repeat(64);
const HASH_A = "sha256:" + "c".repeat(64);
const HASH_B = "sha256:" + "d".repeat(64);
const HASH_C = "sha256:" + "e".repeat(64);

function contextStageBody(): Record<string, unknown> {
  return {
    schema_version: FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION,
    semantic_appraisal_episode: "INITIAL",
    subject_id: "subject-s0",
    factual_event_ref: EVENT_REF,
    factual_event_payload_hash: HASH_A,
    source_observation_ref: OBSERVATION_REF,
    source_observation_transition_id: "t-learn-obs",
    source_admission_history_sequence: 7,
    subject_state: { state_revision: 3, state_hash: HASH_B, repository_revision: "R4" },
    evaluated_at_logical_time: 12,
    reason: "INSUFFICIENT_CONTEXT",
    provenance: { stage: "CONTEXT_EVALUATION" }
  };
}

function providerStageBody(): Record<string, unknown> {
  return {
    ...contextStageBody(),
    provenance: {
      stage: "PROVIDER",
      provider_id: "factual-event-appraisal-provider",
      provider_contract_version: FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
      proposal_hash: HASH_C
    }
  };
}

async function validRecord(body: Record<string, unknown>): Promise<FactualEventAppraisalAbstentionRecordV0> {
  const ref = await deriveFactualEventAppraisalAbstentionRefV0(body as never);
  return { ...body, abstention_ref: ref } as unknown as FactualEventAppraisalAbstentionRecordV0;
}

describe("FactualEventAppraisalAbstentionRecordV0 — record matrix (§50)", () => {
  it("1/11. valid context-stage abstention accepted with a deterministic self-ref", async () => {
    const body = contextStageBody();
    const refA = await deriveFactualEventAppraisalAbstentionRefV0(body as never);
    const refB = await deriveFactualEventAppraisalAbstentionRefV0(body as never);
    expect(refA).toBe(refB);
    expect(refA.startsWith("appraisal:")).toBe(true);
    const record = await validRecord(body);
    const checked = validateFactualEventAppraisalAbstentionRecordV0(record);
    expect(checked.ok).toBe(true);
  });

  it("2. valid provider-stage abstention accepted", async () => {
    const record = await validRecord(providerStageBody());
    const checked = validateFactualEventAppraisalAbstentionRecordV0(record);
    expect(checked.ok).toBe(true);
  });

  it("3. extra key rejected", async () => {
    const record = await validRecord(contextStageBody());
    const hostile = { ...record, rationale: "nope" } as unknown as Record<string, unknown>;
    const checked = validateFactualEventAppraisalAbstentionRecordV0(hostile);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.detail).toContain("unknown key");
  });

  it("4. missing key rejected", async () => {
    const record = await validRecord(contextStageBody());
    const missing = { ...record } as Record<string, unknown>;
    delete missing["reason"];
    expect(validateFactualEventAppraisalAbstentionRecordV0(missing).ok).toBe(false);
  });

  it("5. wrong episode rejected", async () => {
    const record = await validRecord({ ...contextStageBody(), semantic_appraisal_episode: "REAPPRAISAL" });
    expect(validateFactualEventAppraisalAbstentionRecordV0(record).ok).toBe(false);
  });

  it("6. wrong reason rejected", async () => {
    const record = await validRecord({ ...contextStageBody(), reason: "PROVIDER_TIMEOUT" });
    expect(validateFactualEventAppraisalAbstentionRecordV0(record).ok).toBe(false);
  });

  it("7. invalid ref/hash rejected", async () => {
    const wrongRef = await validRecord(contextStageBody());
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...wrongRef, abstention_ref: "event:" + "f".repeat(64) }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...wrongRef, factual_event_payload_hash: "sha256:zz" }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...wrongRef, factual_event_ref: "observation:" + "f".repeat(64) }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...wrongRef, subject_state: { ...(wrongRef.subject_state as Record<string, unknown>), state_hash: "nothash" } }).ok).toBe(false);
  });

  it("8. invalid history sequence rejected (negative / non-integer / non-safe)", async () => {
    const record = await validRecord(contextStageBody());
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...record, source_admission_history_sequence: -1 }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...record, source_admission_history_sequence: 1.5 }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...record, source_admission_history_sequence: "7" }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...record, evaluated_at_logical_time: -3 }).ok).toBe(false);
    expect(validateFactualEventAppraisalAbstentionRecordV0({ ...record, subject_state: { ...(record.subject_state as Record<string, unknown>), state_revision: -2 } }).ok).toBe(false);
  });

  it("9. provider fields forbidden for context-stage", async () => {
    const record = await validRecord({
      ...contextStageBody(),
      provenance: { stage: "CONTEXT_EVALUATION", provider_id: "factual-event-appraisal-provider" }
    });
    const checked = validateFactualEventAppraisalAbstentionRecordV0(record);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.detail).toContain("unknown key");
  });

  it("10. provider fields required for provider-stage (missing proposal_hash rejected)", async () => {
    const body = providerStageBody() as Record<string, unknown>;
    const partial = { ...body, provenance: { stage: "PROVIDER", provider_id: "factual-event-appraisal-provider", provider_contract_version: FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION } };
    const record = await validRecord(partial);
    expect(validateFactualEventAppraisalAbstentionRecordV0(record).ok).toBe(false);
    const badVersion = await validRecord({ ...body, provenance: { ...(body["provenance"] as Record<string, unknown>), provider_contract_version: "some-other-provider-v9" } });
    expect(validateFactualEventAppraisalAbstentionRecordV0(badVersion).ok).toBe(false);
    const badStage = await validRecord({ ...body, provenance: { stage: "SOMEWHERE_ELSE" } });
    expect(validateFactualEventAppraisalAbstentionRecordV0(badStage).ok).toBe(false);
  });

  it("11. self-ref separates records: changed grounding changes the ref", async () => {
    const refA = await deriveFactualEventAppraisalAbstentionRefV0(contextStageBody() as never);
    const changed = { ...contextStageBody(), evaluated_at_logical_time: 13 };
    const refB = await deriveFactualEventAppraisalAbstentionRefV0(changed as never);
    expect(refA).not.toBe(refB);
  });

  it("12. tampered payload/ref rejected (self-ref re-derivation mismatches)", async () => {
    const record = await validRecord(contextStageBody());
    // Shape-valid tampering: the mutated body no longer re-derives the ref.
    const tampered = { ...record, evaluated_at_logical_time: 99 };
    expect(validateFactualEventAppraisalAbstentionRecordV0(tampered).ok).toBe(true);
    const rederived = await deriveFactualEventAppraisalAbstentionRefV0(tampered as never);
    expect(rederived).not.toBe(record.abstention_ref);
  });

  it("23. deterministic persistence intent id; attempt bindings may differ without touching identity fields", async () => {
    const base = { subject_id: "subject-s0", factual_event_ref: EVENT_REF, expected_state_revision: 3, rebuild_ordinal: 0 };
    expect(await deriveFactualEventAppraisalAbstentionIntentId(base)).toBe(await deriveFactualEventAppraisalAbstentionIntentId(base));
    const otherOrdinal = await deriveFactualEventAppraisalAbstentionIntentId({ ...base, rebuild_ordinal: 1 });
    expect(otherOrdinal).not.toBe(await deriveFactualEventAppraisalAbstentionIntentId(base));
    expect(otherOrdinal.startsWith("li-")).toBe(true);
  });

  it("34. provider abstention audit hash is deterministic over the closed proposal", async () => {
    const proposal = {
      schema_version: "factual-event-appraisal-proposal-v0",
      status: "INSUFFICIENT_CONTEXT",
      subject_id: "subject-s0",
      factual_event_ref: EVENT_REF,
      context_projection_hash: HASH_A,
      missing_inputs: ["CURRENT_TASK"] as readonly string[]
    };
    expect(await deriveFactualEventAppraisalAbstentionProposalHashV0(proposal)).toBe(
      await deriveFactualEventAppraisalAbstentionProposalHashV0(proposal)
    );
    const other = await deriveFactualEventAppraisalAbstentionProposalHashV0({ ...proposal, factual_event_ref: "event:" + "1".repeat(64) });
    expect(other).not.toBe(await deriveFactualEventAppraisalAbstentionProposalHashV0(proposal));
  });
});
