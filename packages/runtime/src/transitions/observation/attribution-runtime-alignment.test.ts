/**
 * P2.3.5.0b — Appraisal attribution runtime alignment conformance suite.
 * Contract: docs/implementation/p2-3-5-appraisal-attribution-resolution.md
 * (commit aa2847a). attribution = DOMINANT ATTRIBUTION LOCUS, closed enum
 * `"self" | "other" | "situation"`; numeric representation retired with no
 * committed numeric→literal mapping.
 *
 * Covers: A1–A10 provider-boundary matrix, closed-object conformance (already
 * normative before this slice), zero-partial-mutation integration (failure
 * BEFORE any AffectProducer invocation or canonical commit), valid-literal
 * pipeline runs through the REAL Observation executor, and categorical replay
 * determinism under the new contract (not equality with retired numeric bytes).
 */

import { describe, expect, it } from "vitest";

import type { CanonicalTransitionProposalV1 } from "@characteros-next/subject-core";
import { proposalFingerprint } from "@characteros-next/subject-core";
import type { AffectProducerPort } from "../../ports/affect-producer-port.js";
import type { AppraisalPort } from "../../ports/appraisal-port.js";
import { buildContextDelta } from "../../ports/context-producer-port.js";
import { TransitionStageFailure } from "../common.js";
import { validateAppraisalV0 } from "./proposal-validation.js";
import {
  buildObservationHarness,
  fixedAffectProducer,
  observationCapabilities,
  observationInput
} from "./observation-fixtures.js";
import { buildObservationProposal } from "./observation-transition-executor.js";

// ---------------------------------------------------------------------------------
// Fixtures: one well-formed draft builder + one provider factory that returns an
// otherwise-valid draft whose ONLY defect is the attribution value (§7 requirement:
// the provider actually RETURNS the invalid value; validation is the rejection
// point, not the provider).
// ---------------------------------------------------------------------------------

function draftOf(attribution: unknown): Record<string, unknown> {
  return {
    schema_version: "appraisal-v0",
    appraisal_ref: "appraisal:ap-1",
    evidence_refs: [],
    relevance: 0.9,
    goal_congruence: 0.9,
    attribution,
    controllability: 0.9,
    uncertainty: 0.9,
    intensity: 0.9
  };
}

function draftWithoutAttribution(): Record<string, unknown> {
  const draft = draftOf(null);
  delete draft["attribution"];
  return draft;
}

function malformedAttributionAppraisal(attribution: unknown): AppraisalPort {
  return {
    appraise: async (view) =>
      ({
        schema_version: "appraisal-v0",
        appraisal_ref: `appraisal:ap-${view.observation_id.replace(":", "-")}`,
        evidence_refs: view.retrieval_result?.selected_memory_refs ?? [],
        relevance: 0.9,
        goal_congruence: 0.9,
        attribution,
        controllability: 0.9,
        uncertainty: 0.9,
        intensity: 0.9
      }) as never
  };
}

// ---------------------------------------------------------------------------------
// A1–A10 (+ closed-object) provider-boundary matrix at validateAppraisalV0, the
// exact trust boundary the Observation executor applies before any producer work.
// ---------------------------------------------------------------------------------

describe("P2.3.5.0b attribution provider-boundary validation", () => {
  it.each(["self", "other", "situation"] as const)(
    'A1/A2/A3: valid literal "%s" accepted at the boundary',
    (literal) => {
      const checked = validateAppraisalV0(draftOf(literal));
      expect(checked.ok).toBe(true);
      if (checked.ok) {
        expect(checked.value.attribution).toBe(literal);
      }
    }
  );

  it.each([0, 0.5, 0.8, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "A4: numeric attribution %p rejected (representation retired, no coercion)",
    (numeric) => {
      const checked = validateAppraisalV0(draftOf(numeric));
      expect(checked.ok).toBe(false);
      if (!checked.ok) {
        expect(checked.error.error_code).toBe("INVALID_SCHEMA");
        expect(checked.error.detail).toContain("appraisal.attribution");
      }
    }
  );

  it.each(["myself", "environment", "external", "unknown", "mixed", ""])(
    "A5: arbitrary string %p rejected (no aliases)",
    (str) => {
      const checked = validateAppraisalV0(draftOf(str));
      expect(checked.ok).toBe(false);
    }
  );

  it.each(["SELF", "Self", "Other", "SITUATION"])(
    "A6: case variant %p rejected (case-sensitive exact match)",
    (variant) => {
      const checked = validateAppraisalV0(draftOf(variant));
      expect(checked.ok).toBe(false);
    }
  );

  it("A7: null rejected", () => {
    expect(validateAppraisalV0(draftOf(null)).ok).toBe(false);
  });

  it("A8: object rejected", () => {
    expect(validateAppraisalV0(draftOf({ locus: "self" })).ok).toBe(false);
  });

  it("A9: array rejected", () => {
    expect(validateAppraisalV0(draftOf(["self"])).ok).toBe(false);
  });

  it("A10: missing attribution key rejected (actual runtime shape, no forced TS value)", () => {
    const checked = validateAppraisalV0(draftWithoutAttribution());
    expect(checked.ok).toBe(false);
  });

  it("closed-object rule (already normative pre-slice): extra key rejected", () => {
    const draft = draftOf("situation");
    draft["extra_field"] = 1;
    const checked = validateAppraisalV0(draft);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.detail).toContain("unknown key");
    }
  });

  it("the five numeric dimensions keep their frozen UnitIntervalV0 rules unchanged", () => {
    const draft = draftOf("situation");
    draft["relevance"] = 1.5;
    const checked = validateAppraisalV0(draft);
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_VALUE_RANGE");
      expect(checked.error.detail).toContain("appraisal.relevance");
    }
  });
});

// ---------------------------------------------------------------------------------
// Zero-partial-mutation integration (§7): a provider that RETURNS an otherwise
// valid draft with an invalid attribution must leave the canonical state
// byte-for-byte untouched — failure occurs BEFORE AffectProducer execution and
// BEFORE any canonical commit.
// ---------------------------------------------------------------------------------

describe("P2.3.5.0b zero-partial-mutation on invalid attribution", () => {
  it.each([0.8, "SELF", "myself"])(
    "invalid attribution %p ⇒ typed fail-closed rejection, total canonical +0",
    async (bad) => {
      let affectCalls = 0;
      const innerAffect = fixedAffectProducer();
      const countingAffect: AffectProducerPort = {
        produceAffectDelta: async (input) => {
          affectCalls += 1;
          return innerAffect.produceAffectDelta(input);
        }
      };
      const harness = buildObservationHarness({
        appraisal: malformedAttributionAppraisal(bad),
        affectProducer: countingAffect
      });
      const error: unknown = await harness.executor
        .execute(harness.ctx, observationInput(), await observationCapabilities())
        .then(() => null, (e) => e);

      // Typed stage failure reusing the existing Observation taxonomy.
      expect(error).toBeInstanceOf(TransitionStageFailure);
      if (!(error instanceof TransitionStageFailure)) throw new Error("expected typed stage failure");
      expect(error.stage).toBe("OBSERVATION");
      expect(error.error_code).toBe("INVALID_SCHEMA");
      expect(error.reason).toBe("SS-SCHEMA-001");
      expect(error.message).toContain("appraisal.attribution");

      // Zero partial mutation: no producer execution, no canonical mutation.
      expect(affectCalls).toBe(0);
      expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(0);
      expect(harness.core.storeRead.currentRevision("subject-s0")).toBeNull();
      expect(harness.core.storeRead.readCurrentBundle("subject-s0")).toBeNull();
      expect(harness.memory.prepareCalls).toBe(0);
      expect(harness.memory.readCalls).toBe(0);
    }
  );
});

// ---------------------------------------------------------------------------------
// Valid literals through the REAL Observation pipeline (§8): every closed-enum
// literal commits exactly once, and the canonical commit is attribution-invariant
// (FAST_EMA_V0 + context producers are attribution-blind by contract).
// ---------------------------------------------------------------------------------

describe("P2.3.5.0b valid categorical attribution through the real pipeline", () => {
  it.each(["self", "other", "situation"] as const)(
    '"%s" ⇒ exactly one atomic canonical Observation commit',
    async (literal) => {
      const harness = buildObservationHarness({ appraisalAttribution: literal });
      const outcome = await harness.executor.execute(
        harness.ctx,
        observationInput(),
        await observationCapabilities()
      );
      expect(outcome.kind).toBe("COMMITTED");
      if (outcome.kind !== "COMMITTED") return;
      expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(1);
      expect(outcome.bundle.next_revision).toBe(1);
      const next = outcome.bundle.next_snapshot;
      expect(next.trace_window.entries).toHaveLength(1);
      const traceEntry = next.trace_window.entries[0];
      if (traceEntry === undefined) throw new Error("expected one trace entry");
      expect(traceEntry.domain_mutations.map((m) => m.domain)).toEqual(["affect", "context"]);
    }
  );

  it("commit bytes are identical across the three literals (attribution never enters canonical bytes)", async () => {
    async function runLiteral(literal: "self" | "other" | "situation") {
      const harness = buildObservationHarness({ appraisalAttribution: literal });
      const outcome = await harness.executor.execute(
        harness.ctx,
        observationInput(),
        await observationCapabilities()
      );
      if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${outcome.kind}`);
      return outcome.bundle;
    }
    const self = await runLiteral("self");
    const other = await runLiteral("other");
    const situation = await runLiteral("situation");
    expect(JSON.stringify(self.next_snapshot)).toBe(JSON.stringify(other.next_snapshot));
    expect(JSON.stringify(other.next_snapshot)).toBe(JSON.stringify(situation.next_snapshot));
    expect(self.canonical_result.transition_id).toBe(other.canonical_result.transition_id);
    expect(other.canonical_result.transition_id).toBe(situation.canonical_result.transition_id);
  });
});

// ---------------------------------------------------------------------------------
// Categorical replay determinism (§16): determinism under the NEW contract (no
// requirement to equal retired numeric fixture bytes).
// ---------------------------------------------------------------------------------

describe("P2.3.5.0b categorical Observation replay determinism", () => {
  async function alignedProposal(): Promise<CanonicalTransitionProposalV1> {
    const harness = buildObservationHarness({ appraisalAttribution: "situation" });
    const affectDelta = await fixedAffectProducer().produceAffectDelta({
      context: harness.ctx,
      snapshot: harness.initial,
      transition_type: "Observation",
      appraisal: null,
      elapsed_ticks: null
    });
    const contextDelta = await buildContextDelta(observationInput(), harness.initial);
    return buildObservationProposal({
      subjectId: "subject-s0",
      stateRevision: 0,
      observation: observationInput(),
      deltas: [affectDelta, contextDelta]
    });
  }

  it("same categorical appraisal + identical pipeline ⇒ same fingerprint, state hash, transition identity", async () => {
    async function isolatedRun() {
      const harness = buildObservationHarness({ appraisalAttribution: "situation" });
      const outcome = await harness.executor.execute(
        harness.ctx,
        observationInput(),
        await observationCapabilities()
      );
      if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${outcome.kind}`);
      return outcome.bundle;
    }

    const a = await isolatedRun();
    const b = await isolatedRun();

    // Same canonical proposal ⇒ same fingerprint (HASH-DET-001).
    expect(await proposalFingerprint(await alignedProposal())).toBe(
      await proposalFingerprint(await alignedProposal())
    );
    // Same successor state bytes ⇒ identical trace identities.
    expect(JSON.stringify(a.next_snapshot)).toBe(JSON.stringify(b.next_snapshot));
    const entryA = a.next_snapshot.trace_window.entries[0];
    const entryB = b.next_snapshot.trace_window.entries[0];
    if (entryA === undefined || entryB === undefined) throw new Error("expected trace entries");
    expect(entryA.state_hash_after).toBe(entryB.state_hash_after);
    expect(entryA.transition_id).toBe(entryB.transition_id);
    expect(a.canonical_result.transition_id).toBe(b.canonical_result.transition_id);
  });
});
