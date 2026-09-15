# BELIEF_ADMISSION_HISTORICAL_POLICY_GATE_V0 — DECISION (READ-ONLY GATE)

§2 hard pre-implementation gate for `BELIEF_NEW_PROPOSITION_ADMISSION_V0`.
**Real model calls: 0. Production changes: NONE.** HEAD `8a5fd6d` (`main`, clean).

## Principal verdict

`BELIEF_ADMISSION_HISTORICAL_POLICY_AUTHORITY_UNBOUND`

The required property — *a historical admitted proposition must never be re-justified
solely by applying whichever eligibility policy happens to be current in future code* —
cannot be satisfied with the existing frozen surfaces. Field eligibility can therefore
only be expressed as **episode refs + CURRENT implementation rules**, which §2 names as the
STOP condition.

## The three candidate surfaces (all examined, all fail without a frozen-schema change)

1. **Belief proposal / evidence binding.**
   `BeliefMutationProposalV0` is closed-key
   (`{schema_version, subject_id, expected_state_revision, mutation, evidence_binding}`) and
   `BeliefEvidenceBindingV0` is closed-key (`{member_refs, member_set_fingerprint}`).
   Carrying `belief-new-proposition-evidence-eligibility-policy-v0` (id + fingerprint) in
   either requires changing a frozen canonical contract — forbidden by §2/§3 and by §22
   (“preserve `BeliefEvidenceBindingV0` … do not change merely to store convenience
   metadata”). The policy identity is not convenience metadata here; it is the authority —
   which is precisely why it cannot be smuggled in.
2. **Domain receipt as an evidence ref** (the familiarity `appraisal:` precedent).
   The belief executor verifies that every binding member is a bound episode of the queried
   repository revision (`validateRefsBelong` + payload hashes). A policy receipt ref that is
   not a bound episode is rejected by the existing law; making it admissible would be a new
   evidence-authority mechanism (forbidden).
3. **Workflow durable store** (`belief-adaptation-workflow-store`).
   It persists orchestration checkpoints, not admission authority; extending its schema is
   itself a persistence-format change, and a checkpoint image is not the canonical,
   historically resolvable authority the gate demands.

## Consequence

- The eligibility review's `EPISODE_REF_IS_SUFFICIENT` verdict relied on **reconstructability
  under the deterministic policy**. That reconstruction is only well-defined relative to a
  policy *identity*, and no frozen surface can durably bind that identity today. A future
  policy change (v1) would silently re-justify historical admissions — the exact failure §2
  forbids.
- Therefore no admission component, verifier, terminal replacement, zero-model gates or
  qualification may be implemented in this slice.

## What a read-only review must decide (recommended follow-up)

`BELIEF_NEW_PROPOSITION_EVIDENCE_POLICY_BINDING_REVIEW` (READ-ONLY) must choose one lawful
route, without inventing a generic Core protocol:

1. **Version the belief evidence binding** (`BeliefEvidenceBindingV1` carrying the policy id
   + fingerprint) and adjudicate the historical-compatibility consequences for
   V0 admissions and restore; or
2. **A domain-local durable admission-policy registry + resolver** (the
   `historical-writer-authority-registry` pattern applied to belief eligibility), with the
   proposition↔policy binding derived deterministically from durable inputs; or
3. Declare dynamic new-proposition admission **not justified under the current Core freeze**
   and close it, rather than expanding Core.

No production change, no admission law change, no model call was made or needed for this gate.
