/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — shared Appraisal foundation suite
 * (packages/appraisal, pure contract level).
 *
 * Proves: closed six-dimension schema (NaN/Infinity/out-of-range/attribution
 * laws), closed provider result union (extra rationale/emotion/reward/
 * appraisal_ref fields rejected), canonical record validation (mandatory
 * Experience evidence, hash/ref shapes), and deterministic identity
 * derivations (proposal hash binds only projection/dimensions/confidence/
 * evidence; appraisal ref re-derives from the admitted body).
 */

import { describe, expect, it } from "vitest";

import {
  validateAppraisalDimensionsV0,
  validateExperienceAppraisalProposalV0,
  validateExperienceAppraisalRecordV0,
  deriveExperienceAppraisalProposalHashV0,
  deriveExperienceAppraisalRefV0,
  type ExperienceAppraisalRecordV0
} from "./experience-appraisal-v0.js";

const H = (c: string): `sha256:${string}` => `sha256:${c.repeat(64)}`;

describe("AppraisalDimensionsV0", () => {
  const valid = {
    relevance: 0.8,
    goal_congruence: 0.2,
    attribution: "self",
    controllability: 0.7,
    uncertainty: 0.4,
    intensity: 0.6
  };

  it("accepts the closed six-dimension set", () => {
    expect(validateAppraisalDimensionsV0(valid).ok).toBe(true);
  });

  it("rejects unknown fields and missing dimensions", () => {
    expect(validateAppraisalDimensionsV0({ ...valid, valence: 0.5 }).ok).toBe(false);
    const partial: Record<string, unknown> = { ...valid };
    delete partial["attribution"];
    expect(validateAppraisalDimensionsV0(partial).ok).toBe(false);
  });

  it("rejects NaN, Infinity and out-of-range numerics without coercion", () => {
    expect(validateAppraisalDimensionsV0({ ...valid, relevance: Number.NaN }).ok).toBe(false);
    expect(validateAppraisalDimensionsV0({ ...valid, relevance: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(validateAppraisalDimensionsV0({ ...valid, relevance: -0.1 }).ok).toBe(false);
    expect(validateAppraisalDimensionsV0({ ...valid, relevance: 1.1 }).ok).toBe(false);
  });

  it("rejects invalid attribution literals (closed enum, no coercion)", () => {
    expect(validateAppraisalDimensionsV0({ ...valid, attribution: "Self" }).ok).toBe(false);
    expect(validateAppraisalDimensionsV0({ ...valid, attribution: "world" }).ok).toBe(false);
    expect(validateAppraisalDimensionsV0({ ...valid, attribution: 0.5 }).ok).toBe(false);
  });
});

describe("ExperienceAppraisalProposalV0", () => {
  const proposed = {
    schema_version: "experience-appraisal-proposal-v0",
    status: "APPRAISED",
    subject_id: "subject-s0",
    experience_ref: "experience:x1",
    context_projection_hash: H("c"),
    dimensions: {
      relevance: 0.8, goal_congruence: 0.2, attribution: "self",
      controllability: 0.7, uncertainty: 0.4, intensity: 0.6
    },
    assessment_confidence: 0.9,
    evidence_refs: ["experience:x1"]
  };

  it("accepts APPRAISED and INSUFFICIENT_CONTEXT results", () => {
    expect(validateExperienceAppraisalProposalV0(proposed).ok).toBe(true);
    expect(
      validateExperienceAppraisalProposalV0({
        schema_version: "experience-appraisal-proposal-v0",
        status: "INSUFFICIENT_CONTEXT",
        subject_id: "subject-s0",
        experience_ref: "experience:x1",
        context_projection_hash: H("c"),
        missing_inputs: ["CURRENT_TASK"]
      }).ok
    ).toBe(true);
  });

  it("rejects extra rationale/emotion/sentiment/reward/appraisal_ref fields", () => {
    expect(validateExperienceAppraisalProposalV0({ ...proposed, rationale: "because" }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, emotion: "anger" }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, sentiment: "negative" }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, reward: 1 }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, appraisal_ref: "appraisal:a1" }).ok).toBe(false);
  });

  it("rejects malformed status, evidence arrays and hashes", () => {
    expect(validateExperienceAppraisalProposalV0({ ...proposed, status: "MAYBE" }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, evidence_refs: ["memory:m1", "experience:x1"] }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, context_projection_hash: "abc" }).ok).toBe(false);
    expect(validateExperienceAppraisalProposalV0({ ...proposed, assessment_confidence: 1.5 }).ok).toBe(false);
  });
});

function recordFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "experience-appraisal-record-v0",
    appraisal_kind: "INITIAL",
    appraisal_ref: `appraisal:${"a".repeat(64)}`,
    subject_id: "subject-s0",
    experience_ref: "experience:x1",
    experience_payload_hash: H("1"),
    grounding: {
      source_episode_ref: "episode:p1",
      source_episode_payload_hash: H("2"),
      source_event_ref: "event:v1",
      source_event_payload_hash: H("3"),
      outcome_ref: "outcome:o1",
      behavior_delivery_id: "dlv-1",
      behavior_payload_hash: H("4")
    },
    evaluated_at_logical_time: 3,
    source_state: { state_revision: 2, state_hash: H("5"), repository_revision: "R1" },
    subject_context: { schema_version: "experience-appraisal-subject-context-v0", current_task: "obtain approval for this version" },
    context_projection_hash: H("6"),
    dimensions: {
      relevance: 0.8, goal_congruence: 0.2, attribution: "self",
      controllability: 0.7, uncertainty: 0.4, intensity: 0.6
    },
    assessment_confidence: 0.9,
    evidence_refs: ["experience:x1"],
    provenance: {
      provider_id: "test-provider",
      provider_contract_version: "experience-appraisal-provider-v0",
      proposal_hash: H("7"),
      transition_id: "t-learn-abc"
    },
    ...overrides
  };
}

describe("ExperienceAppraisalRecordV0", () => {
  it("accepts a fully populated canonical record", () => {
    expect(validateExperienceAppraisalRecordV0(recordFixture()).ok).toBe(true);
  });

  it("rejects invented factual prose and semantic label fields", () => {
    expect(validateExperienceAppraisalRecordV0(recordFixture({ external_fact: "Alice is mocking me" })).ok).toBe(false);
    expect(validateExperienceAppraisalRecordV0(recordFixture({ rationale: "because" })).ok).toBe(false);
    expect(validateExperienceAppraisalRecordV0(recordFixture({ sentiment: "negative" })).ok).toBe(false);
  });

  it("rejects missing Experience evidence, bad times and kind/version drift", () => {
    expect(validateExperienceAppraisalRecordV0(recordFixture({ evidence_refs: ["observation:o1"] })).ok).toBe(false);
    expect(validateExperienceAppraisalRecordV0(recordFixture({ evaluated_at_logical_time: -1 })).ok).toBe(false);
    expect(validateExperienceAppraisalRecordV0(recordFixture({ appraisal_kind: "REAPPRAISAL" })).ok).toBe(false);
    expect(validateExperienceAppraisalRecordV0(recordFixture({ schema_version: "experience-appraisal-record-v9" })).ok).toBe(false);
  });
});

describe("identity derivations", () => {
  it("proposal hash binds only projection/dimensions/confidence/evidence", async () => {
    const a = await deriveExperienceAppraisalProposalHashV0({
      context_projection_hash: H("6"),
      dimensions: { relevance: 0.8, goal_congruence: 0.2, attribution: "self", controllability: 0.7, uncertainty: 0.4, intensity: 0.6 } as never,
      assessment_confidence: 0.9 as never,
      evidence_refs: ["experience:x1"] as never
    });
    const b = await deriveExperienceAppraisalProposalHashV0({
      context_projection_hash: H("6"),
      dimensions: { relevance: 0.8, goal_congruence: 0.2, attribution: "self", controllability: 0.7, uncertainty: 0.4, intensity: 0.6 } as never,
      assessment_confidence: 0.9 as never,
      evidence_refs: ["experience:x1"] as never
    });
    expect(a).toBe(b);
    const changed = await deriveExperienceAppraisalProposalHashV0({
      context_projection_hash: H("6"),
      dimensions: { relevance: 0.7, goal_congruence: 0.2, attribution: "self", controllability: 0.7, uncertainty: 0.4, intensity: 0.6 } as never,
      assessment_confidence: 0.9 as never,
      evidence_refs: ["experience:x1"] as never
    });
    expect(changed).not.toBe(a);
  });

  it("appraisal ref re-derives from the admitted body and changes with any bound field", async () => {
    const body = recordFixture();
    const rest: Record<string, unknown> = { ...body };
    delete rest["appraisal_ref"];
    const record = rest as unknown as Omit<ExperienceAppraisalRecordV0, "appraisal_ref">;
    const derived = await deriveExperienceAppraisalRefV0(record as never);
    const derivedAgain = await deriveExperienceAppraisalRefV0(record as never);
    expect(derived).toBe(derivedAgain); // deterministic
    expect(derived).toMatch(/^appraisal:[0-9a-f]{64}$/);
    const mutated = { ...record, assessment_confidence: 0.8 as never };
    expect(await deriveExperienceAppraisalRefV0(mutated as never)).not.toBe(derived);
  });
});
