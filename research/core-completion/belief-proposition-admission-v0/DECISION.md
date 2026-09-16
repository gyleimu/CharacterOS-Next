# BELIEF_PROPOSITION_ADMISSION_V0 — DECISION (INTEGRATED)

PARTIAL COMMIT: `13ef7bfecab04ceccf80251d541f59cca1cd4885` (admission laws only; no wiring, no tests).
This record describes the FINAL INTEGRATED state on top of that partial commit.

This is an **architecture** slice, not a research result. No causal experiment was run and none should be
run until this integration passes independent audit.

## WHY

Independently audited and confirmed (`BELIEF_PATH_GAP_CONFIRMED`): the canonical Belief catalog of
a normal genesis subject was **permanently empty**. Five verified facts: genesis is the frozen empty
state; the plasticity producer handles only `EXISTING_PROPOSITION ± 0.05` and rejects
`NEW_PROPOSITION_CANDIDATE` as `INELIGIBLE_SEMANTIC_KIND`; with zero propositions there is never an
EXISTING target; no production module constructed an INSERT; the only lawful INSERT was
host-authored fixture state. Net effect: credence could never move and the live cognition consumer
always rendered `showing 0 of 0 canonical belief item(s)`.

Three production deadlocks (all closed by this slice):

1. `belief-adaptation-wiring-v0.ts` — with an empty catalog the wiring returned
   `SKIPPED_NO_CANDIDATE_PROPOSITIONS` **before** the provider was ever called.
2. `belief-adaptation-workflow.ts` — a NEW decision was terminalised as
   `COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED` with `canonical_commits: 0` and the label was
   **deliberately discarded** (`TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL`).
3. No host authority existed to turn a proposed label into a canonical proposition identity and a
   lawful first INSERT.

## LAW (implemented in `belief-proposition-admission.ts`)

| law | V0 definition |
| --- | --- |
| semantic provider authority | `NEW_PROPOSITION_CANDIDATE` + `proposed_label` only. No `proposition_key`, `initial_credence`, `next_credence`, delta, relation or decision authority is read or accepted. |
| host authority | evidence admission, canonical label, proposition identity, initial numeric state. |
| canonical label | Unicode **NFC** → collapse internal whitespace runs → trim → reject empty → revalidated by the canonical `validateBeliefPropositionLabel`. **No** lowercase rewriting, negation removal, paraphrase, word reordering, translation or synonym merge. |
| proposition identity | `proposition_key = "belief-prop-v0-" + hex(hashEnvelope("characteros-next/belief/proposition-key/v1", {canonical_label}))` — content-addressed, restart- and replay-stable; never random, clock-based, counter-based or model-supplied. The key deriver **fails closed** on a non-canonical label instead of silently minting a second identity for the same text. The canonical `proposition_id` then adds subject scope via the existing `deriveBeliefPropositionId(subject_id, proposition_key)`. |
| initial credence | Belief-domain frozen stance-zero point (0.5, from `stance(c) = 2c − 1`) + the frozen `BELIEF_PLASTICITY_STEP` (0.05) for the supporting evidence admitted with it ⇒ **0.55**. Explicitly a Belief-domain statement only — **not** a claim that 0.5 is neutral in any other domain. |
| evidence admission | non-empty, unique, raw-ASCII sorted canonical episode refs; membership re-verified by the executor through the sanctioned `validateRefsBelong` boundary. Any failure fails closed with no write. |
| exact duplicates | same canonical label ⇒ same key ⇒ same identity ⇒ **no second INSERT**; the event routes to the existing proposition (`ROUTED_EXISTING`). |
| routed-existing relation | a NEW candidate whose canonical identity already exists means the evidence is formation-bearing for that existing proposition: `BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0 = "SUPPORTS"` → the **ordinary frozen ±0.05 plasticity path**, receipt and all. The provider supplies no relation for a NEW candidate and the host never invents CONTRADICTS. |
| near duplicates | `NEAR_DUPLICATE_CANONICALIZATION_V0 = "OUT_OF_SCOPE_V0"` — textually different labels stay distinct propositions by design; no embeddings, LLM merge or fuzzy matching. |
| atomicity | proposition + 0.55 credence + evidence binding become durable in **one** governed INSERT transition through the existing `BeliefTransitionExecutor`; no intermediate 0.5 state is ever persisted. |
| idempotency | `NO_OP` / `ALREADY_COMMITTED` from the executor are reported as `ROUTED_EXISTING`, never as a second creation; no new global idempotency mechanism was added. |
| decision authority | **none** — no arbitration, tendency, action or runner change. |
| cross-domain | **none** — Affect valence, Relationship familiarity and Personality values are never read as admission or credence weights. |
| plasticity law | untouched; the frozen ±0.05 producer is unchanged and remains the only EXISTING-proposition path. |

## INTEGRATION (the minimal durable extension)

The governed workflow now carries a NEW candidate end to end:

1. **Durable candidate** (`BeliefAdaptationSemanticCandidateV0`): a third closed variant
   `NEW_PROPOSITION_CANDIDATE { proposed_label, semantic_context_fingerprint,
   candidate_catalog_fingerprint }` — the label is the ONLY added field, persisted create-once,
   fingerprint-bound, and revalidated as a lawful Belief label on load. No identity, no number, no
   relation, no confidence, no reasoning is ever persisted from the provider.
2. **Validator**: the closed candidate-key table gains the NEW variant; the checkpoint/receipt
   coupling becomes "an UPDATE proposal requires its plasticity receipt; a formation INSERT requires
   none, because the checkpointed proposal IS the durable host decision and resume re-derives it
   byte-exactly". `COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED` remains in the closed terminal union
   as a LEGACY value (write-once durable terminals must stay replayable) but is never produced.
3. **Routing** (`resolveBeliefProposalAuthority`, shared by resume and by chain re-verification):
   - EXISTING → frozen plasticity (unchanged);
   - NEW + ADMITTED_NEW → host INSERT proposal (`buildBeliefPropositionInsertProposalV0`), no receipt;
   - NEW + ROUTED_EXISTING → a HOST-derived route output (SUPPORTS on the routed canonical id) is
     echoed through the frozen semantic runner for validation against the exact bound context — **no
     external model call** — and then through the *same* frozen plasticity producer as EXISTING;
   - NEW + REJECTED_* → `REJECTED_SEMANTIC`, no write.
4. **Numeric authority binding**: a formation checkpoint binds a host
   `BELIEF_PROPOSITION_ADMISSION_OUTPUT_FINGERPRINT_PROJECTION` fingerprint over (canonical label,
   key, initial credence, evidence set) instead of a plasticity fingerprint; every continuation
   recomputes it and requires exact equality.
5. **Wiring**: an empty canonical catalog no longer short-circuits — the evidence is offered with a
   lawful 0-length candidate universe, the provider may abstain or propose a NEW label, and only a
   host-admitted formation writes. `SKIPPED_NO_CANDIDATE_PROPOSITIONS` is removed from the turn
   report union (its semantics WAS the deadlock). The report additionally exposes `canonical_label`
   and derives the proposition id for INSERT commits.

## WHAT WAS VERIFIED (offline, deterministic, zero model calls)

`packages/runtime/src/transitions/belief/belief-proposition-formation.test.ts` — Tests A–R:
first formation from an empty genesis catalog (A); abstention writes nothing (B); a second DISTINCT
proposition (C); exact-duplicate routing 0.55 → 0.6000000000000001 through the ordinary plasticity
(D); contradiction via the frozen −0.05 law (E); provider identity attacks (F) and numeric attacks
(G) rejected; malformed/duplicate/unsorted/invisible evidence fails closed (H); canonical
normalization equivalence (I); near duplicates stay distinct (J); durable-candidate tamper on label /
kind / evidence / unknown keys fails closed even with every visible fingerprint recomputed (K);
restart with a fresh durable store image and no journal (L); replay never double-creates (M);
existing-proposition plasticity regression (N); deterministic cognition projection sees the formed
belief (O); no decision/tendency/arbitration consumer integrated (P); two formed propositions restore
deterministically (Q); a NEW candidate under a NON-EMPTY catalog is admitted and never discarded (R).

`packages/runtime/src/session/interactive-belief-adaptation.test.ts` — the same two laws through the
REAL interactive runtime: empty genesis is offered evidence and an abstaining provider writes
nothing; a NEW proposition is formed (0.55) from a lived turn, its duplicate routes to 0.6000000000000001,
later cognition renders `showing 1 of 1 canonical belief item(s)`, and the belief survives a parsed
snapshot restart.

`packages/runtime/src/transitions/belief/belief-adaptation-workflow.test.ts` — the replaced
`SKIPPED`/discard assertions now pin the new law: the durable label-only candidate, the host INSERT
with derived key and 0.55, and the untouched existing proposition.

## FROZEN SEMANTICS RESPECTED

Credence remains **subjective endorsement**, not objective truth probability; `stance(c) = 2c − 1`;
plasticity stays the fixed ±0.05 with exact IEEE-754 arithmetic (no rounding, so 0.55 + 0.05 is
lawfully 0.6000000000000001); arbitration stays `UNIQUE_POSITIVE_MAX` and was not touched;
Relationship stage closure stands; decision admission remains `0`; the cognition prompt, portable
cognition contract, belief renderer, credence legend and cognition evaluator were **not** modified;
no cross-domain arithmetic and no LLM numeric or identity authority exists anywhere in the new code.
