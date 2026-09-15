# BELIEF_NEW_PROPOSITION_ADMISSION_GATE_V0 — DECISION (READ-ONLY)

§3 hard-gate audit for `BELIEF_LIVED_EVIDENCE_CAUSAL_COMPLETION_V0`.
**Real model calls: 0. Production changes: NONE.** HEAD `10376a6` (`main`, clean).

## Principal verdict

`BELIEF_NEW_PROPOSITION_ADMISSION_SEMANTICS_NOT_FROZEN`

Recommended next slice (READ-ONLY):
`BELIEF_NEW_PROPOSITION_ADMISSION_ARCHITECTURE_REVIEW`.

## §3 checklist (authority-critical items)

| Item | Status | Evidence |
| --- | --- | --- |
| proposition identity / key semantics | **FROZEN** | `packages/subject-core/src/canonical/belief.ts:14-41` (`belief-<sha256>` derived from `(subject_id, proposition_key)`); INSERT requires a host `proposition_key` (`belief-mutation-proposal.ts:39-46`) |
| canonical proposition label semantics | **NOT_FROZEN** | the only label law is `NEW_PROPOSITION_CANDIDATE policy: MODEL_PROPOSES_LABEL_ONLY` and the workflow **deliberately discards** it (`belief-semantic-target-resolution.ts:25-29`; `belief-adaptation-workflow.ts:1017-1021` `TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL`). No host law derives a canonical label from evidence |
| label normalization | **NOT_FROZEN** | no normalizer exists anywhere; the proposal validator only checks the label is a non-empty string |
| initial credence | **NOT_FROZEN** | `initial_credence` appears only as a validated `UnitIntervalV0` field (`belief-mutation-proposal.ts:45,151-167`); no host-owned constant or rule fixes the admission value (§7: "If no rule exists: STOP"; no intuitive 0/0.5/1) |
| evidence binding | **FROZEN** | `BeliefEvidenceBindingV0` nonempty/sorted/unique + repository membership verification (`belief-transition-executor.ts:125-153`) |
| duplicate handling | **PARTIALLY FROZEN** — canonical identity uniqueness (unique, raw-ASCII-sorted `proposition_id`) is frozen; recognising "the same proposition in different wording" would require **new semantic/fuzzy dedup infrastructure** (§14: STOP; no embeddings, no LLM judge) |
| collision handling | **FROZEN** for identity collisions (deterministic id derivation; duplicate id → validation failure); wording-level collisions are the missing semantic law above |
| replay behavior | **FROZEN** | write-once ledger + deterministic transition id + idempotent replay (`belief-adaptation-workflow.ts`, e2e proof tests) |
| candidate rejection / abstention | **FROZEN** | closed provider output vocabulary; `ABSTAIN`/`NO_BEARING` terminal; invalid result → no write, no retry |

## Why this is a STOP and not an implementation

The frozen contract states the boundary explicitly: the accepted candidate is
*NON-CANONICAL, NON-PERSISTENT*, is *NOT* a `BeliefMutationProposalV0` INSERT
(no `proposition_key`, no `initial_credence`, no identity authority), and
**"NO code path exists from a semantic result to BeliefTransitionExecutor"**
(`belief-semantic-target-resolution.ts:25-35`). The workflow terminal
(`TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL`) is therefore a deliberate design
decision, not an oversight: implementation was previously deferred on purpose and the
program named it "Belief lived-evidence completion — Phase 4", which has no directory.

Completing the slice would require inventing three authority-critical semantics
(canonical label derivation/normalization, host initial-credence rule, wording-level
proposition identity/dedup). All three are architecture decisions, and two of them
(§8 arbitrary NL canonicalization; §14 fuzzy dedup) are named STOP conditions in the
slice prompt. Implementing them would silently promote model prose into canonical state
and would create a new identity authority — exactly what §5/§6/§8 forbid.

## What the read-only review must decide

1. Canonical label law: evidence-anchored derivation (e.g. label must be an exact or
   deterministically-normalized substring of the cited evidence) vs a host-owned label
   registry; and what happens to the model's `proposed_label` under that law.
2. Initial credence law for INSERT (host constant or host rule; no fake neutral).
3. Wording-level proposition identity: reuse-only-existing-catalog (no invention) vs a
   deterministic canonicalization family; if fuzzy/NL equivalence is required, that is
   out of scope by policy.
4. Where the admission authority lives (which component mints `proposition_key`,
   label, `initial_credence`) and how it fails closed.
5. Whether the workflow terminal may be replaced at all under the freeze, or whether
   admission must be a separate host-authoritative entry point.

No production change, no Belief semantics change, no Personality/Familiarity/UI work,
and no model call was made or needed for this audit.
