# BELIEF_NEW_PROPOSITION_EVIDENCE_ELIGIBILITY_REVIEW — DECISION

READ-ONLY adjudication. **Real model calls: 0. Production changes: NONE.**
HEAD `3207c32` (`main`, clean). Applies ONLY to `NEW_PROPOSITION_CANDIDATE → canonical
INSERT`; existing-proposition plasticity is untouched (§1/§39).

## Verdicts

| §  | Item | Verdict |
| --- | --- | --- |
| 46 | Principal root cause | `MULTIPLE_EVIDENCE_ELIGIBILITY_SEMANTICS_UNDEFINED` |
| 47 | Self-generated status | `SELF_GENERATED_DELIVERY_INELIGIBLE` |
| 48 | External outcome status | `EXTERNAL_OUTCOME_ELIGIBLE` |
| 49 | Observation status | `OBSERVATION_FIELDS_PARTIALLY_ELIGIBLE` |
| 50 | Provenance status | `EPISODE_REF_IS_SUFFICIENT` |
| 51 | Core status | `DOMAIN_LOCAL_EVIDENCE_ELIGIBILITY_ALLOWED_UNDER_CORE_FREEZE` |
| 18 | Source policy | `EXTERNAL_TYPED_FIELDS_ONLY` |
| 52 | Architecture verdict | `ADD_FIELD_LOCAL_BELIEF_ADMISSION_ELIGIBILITY` |

## The frozen eligibility law (refines, does not reopen, the label law)

`proposed_label` is admissible **iff** it is a case-sensitive NFC exact substring of at
least one **host-eligible typed source field** of the admitted evidence window — never of a
flattened/rendered window (§19/§29).

Closed registry `BELIEF_NEW_PROPOSITION_ELIGIBLE_SOURCE_FIELDS_V0` (host-owned, no dynamic
registration, no model-supplied type — §14/§27), using actual repository field names:

| Field id | Source | Eligible |
| --- | --- | --- |
| `OBSERVATION_SCENE_TEXT` | observation-sourced episode `context.scene` (host-composed from the ingress event; external actor bound in the ingress record) | YES, with the structural condition below |
| `EXACT_OUTCOME_TEXT` | `BEHAVIOR_OUTCOME.exact_outcome_text` (external counterpart reply, `actor_ref` = counterpart) | YES |
| `DELIVERED_BEHAVIOR_TEXT` | `BEHAVIOR_OUTCOME.delivered_behavior_text` (the subject's own delivery) | **NO** |
| derived/rendered concatenations | any composed window string | NO |

Observation condition (§9/§10): the observation scene is a *typed* host-composed field whose
authoring actor is bound by the ingress event; if an observation payload is ever composed
with mixed roles (e.g. quoting the subject's own prior delivery), field-local authority is
lost and that evidence is **ineligible** until it carries typed provenance. No NLP author
detection, no regex speaker guessing, no LLM provenance judge (§10/§54).

## Why self-generated delivery is ineligible (§5/§6/§16)

The invariant governs: a delivered utterance is authoritative only about *what the subject
uttered*, never independent evidence that its embedded proposition deserves admission.
Policy B (self with provenance) is rejected: canonical Belief state cannot carry an
authorship marker, the projection would not expose origin, and decision semantics could not
distinguish a self-origin proposition — a self-reinforcement loop would be unpriced. Policy
C (structured self-event propositions) is rejected: verifying "the proposition is about what
the subject said" requires forbidden NL semantics. Prefer the narrowest boundary (§4):
field-local, not record-level.

## Match and failure semantics (deterministic, no retries — §20/§31/§32/§33/§42)

| Case | Result |
| --- | --- |
| eligible exact match (one or more eligible fields) | admissible; the admission report binds **all** matching `(episode_ref, field_id)` pairs, sorted (no model selection) |
| ineligible-only match | `ADMISSION_NO_OP_INELIGIBLE_SOURCE` (model-compliance class; no write, no retry, no repair) |
| no exact match | `ADMISSION_NO_OP_NOT_EXACT` |
| mixed eligible + ineligible match | **admissible** (`at least one eligible exact match`); the report also records the ineligible-field match count for audit |
| ambiguous multiple eligible sources | all bound (deterministic set), never a model choice |
| invalid source record / stale evidence / authority reject | fail closed per existing Belief laws; no partial INSERT |

## Durable provenance (§21–§28)

`EPISODE_REF_IS_SUFFICIENT`: the binding already stores the immutable, hash-verified episode
refs, and the eligibility law is deterministic over those records, so the field-local proof
is **reconstructable** after restart: re-running the verifier on `(canonical_label, bound
episode_refs, policy id)` yields the same eligible-field set. The admission decision records
that reconstruction (policy id + matched `(episode_ref, field_id)` pairs) in the existing
non-canonical workflow report; no byte offsets are required (offsets add no authority beyond
exact-substring verification + field identity — §28). Therefore:

- **canonical Belief state does NOT change** (no source author/field stored — §22/§55), and
- **`BeliefEvidenceBindingV0` is NOT versioned** (PROV-A/§24); PROV-B (new receipt artifact)
  is unnecessary, PROV-C/D rejected as semantic pollution.

## Non-regressions and recorded risks

- Belief ≠ fact: eligibility for subjective admission never touches factual-source
  registries; projection stays `STATE_VISIBLE_NOT_CITEABLE` (§13/§43).
- Hearsay (§12): a third party's report is a firsthand experience of *the report*; it may
  ground a subjective endorsement (never factual authority). Allowed and stated explicitly.
- External echo (§8/§41): authority follows the **current typed field**, not the historical
  origin of the wording — no phrase genealogy.
- Existing-proposition plasticity: **unchanged**; a separate
  `EXISTING_BELIEF_SELF_REINFORCEMENT_RISK` is recorded (a delivered belief statement can
  re-enter existing-proposition plasticity later) — it does not block new admission and must
  be reviewed separately (§40).
- Initial credence (0.55), surface identity, paraphrase-distinctness and the unchanged
  INSERT executor are preserved (§44/§45).

## Required future tests (§34–§38)

delivery-contains-X ∧ outcome-lacks-X ⇒ no INSERT (self-source regression); outcome-contains-X
⇒ admissible regardless of delivery (external positive); the mixed-match rule; a retrieved
`BEHAVIOR_OUTCOME` is still field-filtered (retrieval never flattens eligibility);
observation-sourced evidence behaves per the structural condition; ABSENT control; factual
isolation; persistence/fresh restore/projection unchanged.

## Recommended next slice

**`BELIEF_NEW_PROPOSITION_ADMISSION_V0`** (resume the stopped slice, now with the field-local
eligibility law frozen above): implement the admission component + field-local verifier +
workflow terminal replacement + all zero-model gates, then the bounded 20–40 call admission
qualification. Behavioral causality remains a SEPARATE later slice.
