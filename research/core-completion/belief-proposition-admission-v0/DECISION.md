# BELIEF_PROPOSITION_ADMISSION_V0 — DECISION (ARCHITECTURE SLICE, PARTIAL)

Baseline SHA: `71925f6f103d97ca8918c990358511d3a92c9f6e` (`main`, clean, HEAD == origin/main).
This is an **architecture** slice, not a research result. No causal experiment was run.

## STATUS: LAWS IMPLEMENTED AND EXPORTED — WIRING INTEGRATION AND TESTS **NOT** COMPLETE

I am **not** claiming `BELIEF_PROPOSITION_ADMISSION_V0_READY_FOR_REVIEW`. The admission service
exists, typechecks, is lint-clean and is exported; the production wiring still does not call it,
and the A–M acceptance tests are not written. I stopped rather than leave a half-wired production
path or an unverified claim, and the remaining work is enumerated below so it can be finished or
reassigned without re-deriving anything.

## WHY

Independently audited and confirmed (`BELIEF_PATH_GAP_CONFIRMED`): the canonical Belief catalog of
a normal genesis subject was **permanently empty**. Five verified facts: genesis is the frozen empty
state; the plasticity producer handles only `EXISTING_PROPOSITION ± 0.05` and rejects
`NEW_PROPOSITION_CANDIDATE` as `INELIGIBLE_SEMANTIC_KIND`; with zero propositions there is never an
EXISTING target; no production module constructed an INSERT; the only lawful INSERT was
host-authored fixture state. Net effect: credence could never move and the live cognition consumer
always rendered `showing 0 of 0 canonical belief item(s)`.

Two additional deadlocks were located during this slice:

1. `belief-adaptation-wiring-v0.ts:155-161` — with an empty catalog the wiring returns
   `SKIPPED_NO_CANDIDATE_PROPOSITIONS` **before** the provider is ever called, so no NEW candidate
   can even be proposed.
2. `belief-adaptation-workflow.ts:1017-1024` — a NEW decision is terminalised as
   `COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED` with `canonical_commits: 0` and the label is
   **deliberately discarded** (`TERMINALIZE_GENERIC_STATUS_AND_DISCARD_LABEL`).

## LAW (implemented in `belief-proposition-admission.ts`)

| law | V0 definition |
| --- | --- |
| semantic provider authority | `NEW_PROPOSITION_CANDIDATE` + `proposed_label` only. No `proposition_key`, `initial_credence`, `next_credence`, delta, relation or decision authority is read or accepted. |
| host authority | evidence admission, canonical label, proposition identity, initial numeric state. |
| canonical label | Unicode **NFC** → collapse internal whitespace runs → trim → reject empty → revalidated by the canonical `validateBeliefPropositionLabel`. **No** lowercase rewriting, negation removal, paraphrase, word reordering, translation or synonym merge. |
| proposition identity | `proposition_key = "belief-prop-v0-" + hex(hashEnvelope("characteros-next/belief/proposition-key/v1", {canonical_label}))` — content-addressed, restart- and replay-stable; never random, clock-based, counter-based or model-supplied. The canonical `proposition_id` then adds subject scope via the existing `deriveBeliefPropositionId(subject_id, proposition_key)`. |
| initial credence | Belief-domain frozen stance-zero point (0.5, from `stance(c) = 2c − 1`) + the frozen `BELIEF_PLASTICITY_STEP` (0.05) for the supporting evidence admitted with it ⇒ **0.55**. Explicitly a Belief-domain statement only — **not** a claim that 0.5 is neutral in any other domain. |
| evidence admission | non-empty, unique, raw-ASCII sorted canonical episode refs; membership re-verified by the executor through the sanctioned `validateRefsBelong` boundary. Any failure fails closed with no write. |
| exact duplicates | same canonical label ⇒ same key ⇒ same identity ⇒ **no second INSERT**; the event routes to the existing proposition and its ordinary frozen ±0.05 plasticity (`ROUTED_EXISTING`). |
| near duplicates | `NEAR_DUPLICATE_CANONICALIZATION_V0 = "OUT_OF_SCOPE_V0"` — textually different labels stay distinct propositions by design; no embeddings, LLM merge or fuzzy matching. |
| atomicity | proposition + 0.55 credence + evidence binding become durable in **one** governed INSERT transition through the existing `BeliefTransitionExecutor`; no intermediate 0.5 state is ever persisted (the INSERT contract's `initial_credence` carries 0.55 directly). |
| idempotency | `NO_OP` / `ALREADY_COMMITTED` from the executor are reported as `ROUTED_EXISTING`, never as a second creation; no new global idempotency mechanism was added. |
| decision authority | **none** — no arbitration, tendency, action or runner change. |
| cross-domain | **none** — Affect valence, Relationship familiarity and Personality values are never read as admission or credence weights. |
| plasticity law | untouched; the frozen ±0.05 producer is unchanged and remains the only EXISTING-proposition path. |

## WHAT WAS VERIFIED

- `packages/runtime` typecheck: clean with the new module and the appended barrel exports.
- ESLint on the new module and the barrel: clean (`--max-warnings 0`).
- No existing behaviour changed: nothing in the repository calls the new module yet, so no frozen
  path, test or semantics was altered by this commit.
- The INSERT contract already accepted `proposition_key` + `proposition_label` +
  `initial_credence`, so **no contract change was needed** and none was made.

## WHAT REMAINS (exact checklist, not started)

1. **Wiring integration** (`belief-adaptation-wiring-v0.ts`): replace the empty-catalog early skip
   with an offered-evidence path that runs the exported
   `runBeliefSemanticTargetResolutionV0({memoryRepository}, {subjectState, proposition_ids: [],
   selected_episodes, provider})` — the runner already accepts **zero** candidate ids — and routes
   a `NEW_PROPOSITION_CANDIDATE` decision into `executeBeliefPropositionAdmissionV0`. The
   `RuntimeContext` is `{subject_id, current_logical_time, state_revision}` taken from the snapshot,
   exactly as `belief-adaptation-workflow.ts:1557-1561` builds it.
2. **A frozen test must change with it**: the existing suite asserts the old
   `SKIPPED_NO_CANDIDATE_PROPOSITIONS` disposition, which encoded the pre-admission law. That
   assertion is the deliberate behaviour change of this slice and must be updated rather than
   worked around.
3. **NEW with a NON-EMPTY catalog** (§15's second requirement) still terminates in the workflow's
   frozen discard, because surfacing the label to the wiring would require extending the workflow's
   durable semantic-candidate union, its record validator and its fingerprint-bound
   receipt/checkpoint protocol. I judged that beyond a minimal chain-completion and did **not** do
   it; it needs an explicit decision.
4. **Tests A–M + the negative decision test** (§24–§38) are not written. The admission laws are
   testable in isolation today (`deriveCanonicalBeliefPropositionLabelV0`,
   `deriveBeliefPropositionKeyV0`, `validateBeliefAdmissionEvidenceRefsV0`,
   `decideBeliefPropositionAdmissionV0`), and an end-to-end Test A needs item 1 first.
5. **Cognition-consumer assertion** (Test M) is expected to pass unchanged once item 1 lands, since
   the live executor already projects `belief_item_count`/`belief_items` — but it is unverified.

## FROZEN SEMANTICS RESPECTED

Credence remains **subjective endorsement**, not objective truth probability; `stance(c) = 2c − 1`;
plasticity stays the fixed ±0.05; arbitration stays `UNIQUE_POSITIVE_MAX` and was not touched;
Relationship stage closure stands; decision admission remains `0`; the cognition prompt, portable
cognition contract, belief renderer, credence legend and cognition evaluator were **not** modified;
no cross-domain arithmetic and no LLM numeric or identity authority exists anywhere in the new code.

## RECOMMENDATION

Finish items 1–4 as a bounded continuation before any causal work. The north star
(`lived experience → governed belief → later cognition`) remains **blocked at the wiring step**,
not at the law: the missing laws now exist and are exported; what is missing is the one call site
plus its tests.
