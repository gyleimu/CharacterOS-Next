# BELIEF_NEW_PROPOSITION_ADMISSION_ARCHITECTURE_REVIEW — DECISION

READ-ONLY architecture/authority adjudication. **Real model calls: 0. Production changes:
NONE.** HEAD `c9dd25c` (`main`, clean). Belief credence / stance / arbitration semantics,
Foundation, Plasticity, Decision and the executor are NOT redesigned.

## Principal Root Cause

`MULTIPLE_ADMISSION_SEMANTICS_UNDEFINED` — canonical label authority, initial-credence
authority and (wording-level) proposition identity were all undefined; identity *mechanics*
were frozen, identity *semantics* for dynamically discovered propositions were not.

## Status selections

| Item | Verdict |
| --- | --- |
| Identity status (§46) | `DETERMINISTIC_SURFACE_IDENTITY_READY` |
| Label status (§47) | `EXACT_EVIDENCE_LABEL` |
| Initial credence status (§48) | `NEW_HOST_INITIALIZATION_LAW_REQUIRED` (defined below, one narrow law) |
| Duplicate status (§49) | `DETERMINISTIC_NORMALIZED_DUPLICATION` |
| Core status (§50) | `DOMAIN_LOCAL_ADMISSION_ALLOWED_UNDER_CORE_FREEZE` |
| Principal architecture verdict (§51) | `DEFINE_IDENTITY_AND_INITIALIZATION_LAWS_THEN_IMPLEMENT` — both laws are defined in this decision, so implementation may proceed |

## The frozen laws (this review defines them)

1. **Proposition identity ontology = deterministic surface identity (ID-A).**
   A canonical proposition is its canonical label text. Identity:
   `canonical_label` (must be canonical NFC text, no NUL, well-formed) →
   `proposition_key := "prop." + sha256hex(canonical_label)` (host-computed; satisfies the
   frozen `IdentifierV0` law: canonical NFC + identifier format) → the EXISTING
   `deriveBeliefPropositionId(subject_id, proposition_key)` = `belief-<sha256>`.
   No model input participates. Semantic equivalence (paraphrase = same belief) is
   **explicitly NOT supported** in V0: different normalized label ⇒ distinct proposition
   (§25/§35 recorded as a documented limitation, not hidden).
2. **Canonical label law = exact evidence span (LABEL-A).**
   The host accepts the model's `proposed_label` as the canonical label **iff** it is a
   case-sensitive NFC **exact substring** of the admitted evidence window's canonical text
   (the same text the semantic channel showed the model). Anything else is a model-compliance
   rejection → deterministic no-op. This reuses the repository's frozen SOURCE_QUOTE
   matching discipline, keeps the model a *quoter/selector* (never an author of canonical
   text), and requires no NL entailment, no parser, no embeddings. Bounded structural
   limits (non-empty, bounded code points, single line) are applied as validation.
3. **Initial credence law (new, narrow, derived — not invented).**
   First admitted firsthand evidence IS an endorsement act (§23 chosen reading): the
   proposition becomes canonical *because* evidence supported it. Therefore
   `initial_credence := 0.5 + BELIEF_PLASTICITY_STEP = 0.55`: the algebraic stance-zero of
   the frozen transform (`stance(c) = 2c − 1`) advanced by exactly one frozen plasticity
   step (`BELIEF_PLASTICITY_STEP = 0.05`). The stored value is therefore **positive
   endorsement** (stance 0.1 > 0) — never a neutral placeholder. `0.5` is NOT selectable
   (§22): it is the stance-zero, i.e. zero endorsement, and storing it would contradict
   "the first evidence endorses". No new numeric model authority, no evidence-strength
   scoring model (belief plasticity has no strength input by design).
4. **Duplicate law.** Same canonical label (NFC-exact) ⇒ same `proposition_key` ⇒ same
   `proposition_id`. A candidate whose label already matches a canonical proposition must
   NOT create a second proposition: admission returns a deterministic **NO_OP** (no INSERT,
   no second proposition). It must NOT be silently re-interpreted as an
   EXISTING SUPPORTS/CONTRADICTS judgement the model did not make (that would alter
   existing-proposition behavior, forbidden by §16).
5. **Evidence binding.** Reuse the frozen binding unchanged: the INSERT proposal carries
   `BeliefEvidenceBindingV0` over the admitted evidence window (nonempty, unique, raw-ASCII
   sorted, member-set fingerprint) and the executor re-verifies membership + fingerprint.
   No ref-only authority, no widening of the model-visible evidence universe.
6. **Replay/idempotence.** Admission is a deterministic function of
   `(canonical state, evidence window, semantic result)`; the frozen write-once ledger and
   deterministic transition id already make replay a no-op. A replayed window produces the
   same admission decision and never a second INSERT.
7. **Admission authority ownership.** A domain-local host component (name chosen by the
   implementation slice, e.g. `belief-new-proposition-admission-v0.ts`) validates the
   candidate, computes the key, fixes the initial credence and mints the complete INSERT
   proposal; the EXISTING `BeliefTransitionExecutor` validates and commits it unchanged
   (§28: the executor is never taught to infer key/label/credence). No second writer, no
   new authority framework.
8. **Workflow integration boundary.** Replace ONLY the
   `TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL` terminal with
   `attempt admission → INSERT | deterministic NO_OP`. Behavior for EXISTING_PROPOSITION,
   ABSTAIN/NO_BEARING and invalid semantic results is unchanged; one provider call per
   evidence window, no retry, no repair, no second adjudication call.

## Answers to the review questions

- **Does the model still control identity indirectly?** It may *select* a span; it cannot
  author canonical text, choose the key, the id, the credence or the commit. Authority
  lies at the host admission step (accept/reject by exact-substring law) — the same
  authority shape as the frozen factual-authority contract.
- **Can the model choose the proposition key / numeric credence?** NO / NO (§5/§6).
- **Epistemic threshold (§13/§14):** exact textual support from one admitted firsthand
  evidence window, permanently bound by refs; subjective inference is represented by the
  *credence stance toward the quoted proposition*, never by model-authored prose.
- **Firsthand requirement (§31):** unchanged — the existing frozen evidence window and
  membership law govern; no hearsay/third-party path is added.
- **Self-generated utterance (§32):** a delivered-behavior episode is a record of what was
  said; quoting it yields a proposition the subject may *endorse subjectively* — never
  objective truth (projection stays `STATE_VISIBLE_NOT_CITEABLE`). Residual self-reinforcement
  risk is documented, not silently enabled; reopen condition: evidence of a
  self-reinforcing loop.
- **Proposition explosion (§26):** bounded by one candidate per evidence window (existing),
  exact-duplicate suppression (law 4) and the existing canonical-state validation; no
  fuzzy matching, no count cap invented.
- **Collision (§36):** covered by the global hash law (`sha256` envelope); no special
  handling invented.
- **Failure semantics (§39/§40):** non-substring label → model-compliance no-op; duplicate
  → NO_OP; invalid evidence / stale revision / authority reject → no write (existing
  fail-closed laws); never a retry or a repair call.
- **Core freeze:** no new canonical state type, no credence/arbitration change, no
  persistence/restore/Language/factual-authority change, no ontology, no fuzzy dedup.

## Recommended sequencing (§43/§44)

Two slices: **A** `BELIEF_NEW_PROPOSITION_ADMISSION_V0` (admission + persistence + restore
+ projection + zero-model gates, zero/limited real calls), then **B**
`BELIEF_LIVED_EVIDENCE_CAUSAL_COMPLETION_V0` (the bounded preregistered causal experiment
with matched Memory and a projection-level Belief ablation). Do not combine authority
implementation and causal science in one slice.

## Largest Remaining Uncertainty

Whether `EXACT_EVIDENCE_LABEL` yields propositions that are *useful* (evidence spans are
observations, not abstractions) while remaining honest; and whether the current model can
produce exact-substring labels often enough for the chain to fire in practice — both must
be measured by the implementation slice's bounded qualification, with an accepted-negative
policy and no prompt tuning.
