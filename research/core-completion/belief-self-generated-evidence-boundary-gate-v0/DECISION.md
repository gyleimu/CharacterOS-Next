# BELIEF_SELF_GENERATED_EVIDENCE_BOUNDARY_GATE_V0 — DECISION (READ-ONLY GATE)

§2/§3 hard pre-implementation audit for `BELIEF_NEW_PROPOSITION_ADMISSION_V0`.
**Real model calls: 0. Production changes: NONE.** HEAD `f14aa7d` (`main`, clean).

## Principal verdict

`BELIEF_ADMISSION_SELF_GENERATED_EVIDENCE_BOUNDARY_UNFROZEN`

Recommended next slice (READ-ONLY): `BELIEF_NEW_PROPOSITION_EVIDENCE_ELIGIBILITY_REVIEW`.

## Candidate evidence source families (§2)

The belief evidence window is built from the turn's newly committed lived evidence
(`interactive-subject-runtime-v0.ts:590-606`): the completed-prior-outcome episode when a
delivery was answered, else the turn's observation-sourced episode. Its record families:

| Family | Present in the window? | Authorship preserved in the record? |
| --- | --- | --- |
| current observation / user statement | yes (observation-sourced episode) | yes (ingress actor) |
| world / environment observation | yes (same family) | yes |
| committed firsthand episode | yes (this IS the window) | yes (provenance) |
| retrieved memory | only through the committed evidence it produced | by ref |
| third-party report | yes — its text is lawful evidence (the subject directly experienced the report) | yes (actor) |
| **CharacterOS delivered behavior** | **yes — `BEHAVIOR_OUTCOME` records carry `delivered_behavior_text` (the subject's own delivered utterance) alongside `exact_outcome_text` (the counterpart's reply)** (`transitions/cognition-action/factual-memory-evidence.ts:37-53,120-160`) | **yes in the record, but NOT in the proposed admission law** |
| counterpart outcome / reply | yes (`exact_outcome_text`) | yes |

## Why the boundary is unfrozen

The frozen admission law accepted in the architecture review is *"the model's
`proposed_label` must be a case-sensitive NFC exact substring of the admitted
evidence-window text"*. That law:

1. does not distinguish which **field/family** the span was drawn from, and
2. does not carry any **authorship marker** into canonical state (a
   `belief-state-v0` item is only `{proposition_id, proposition_label, credence}`).

Therefore the loop in §3 is reachable in principle: a delivered utterance
("Alice is reliable") that the subject itself produced in an earlier turn can appear in
the evidence window of a later feedback episode, be proposed verbatim as a label, pass the
exact-substring check, and become a persistent canonical proposition — with nothing in the
canonical state or the admission decision recording that the evidence was merely
*"CharacterOS previously said this"*. The Memory epistemic boundary preserves that fact in
the **evidence record** (`delivered_behavior_text` vs `exact_outcome_text`), but the
admission step as frozen never consults it, so the distinction is not preserved in the
Belief state.

§4 could not be satisfied: there is **no production law** in the belief domain (or in the
admission law as frozen) that excludes self-generated text from the evidence window.

## What the read-only eligibility review must decide

1. Whether self-generated delivered behavior is **eligible** evidence for *new-proposition
   admission* (it remains lawful evidence for existing-proposition plasticity, unchanged).
2. If ineligible: the exact host-side rule (e.g. spans may only be drawn from
   `exact_outcome_text` / observation text — never from `delivered_behavior_text`) and how
   it is verified deterministically against the episode record.
3. If eligible: the authorship-preserving representation (e.g. a required evidence-family
   marker in the admission decision and/or in the proposition's provenance), so that a
   self-derived proposition is never indistinguishable from a counterpart-grounded one.
4. Whether either choice changes the frozen label law, and whether that is domain-local
   under the Core freeze.
5. The equivalent question for **observation-sourced episodes**, whose scene may quote the
   subject's own earlier text.

No production implementation, no admission law change, no prompt tuning, and no model call
was made or needed for this gate.
