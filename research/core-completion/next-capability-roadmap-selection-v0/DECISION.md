# CHARACTEROS_NEXT_CAPABILITY_ROADMAP_SELECTION_V0 — DECISION

READ-ONLY roadmap selection. **Real model calls: 0. Production changes: NONE.**
Frozen head at review time: `e6f0786` (`main`, clean, HEAD == origin/main). Core freeze
manifest remains authoritative; nothing was reopened.

## Principal Next Capability

**Belief lived-evidence completion** — `BELIEF_LIVED_EVIDENCE_CAUSAL_COMPLETION_V0`.

## Principal Roadmap Verdict

`CONTINUE_DOMAIN_CAUSAL_COMPLETION`.

## Executive Decision

Belief is the only domain whose production path is provably **inert by construction**:
the adaptation workflow is EXISTING-propositions-only, production genesis holds zero
propositions, so every turn short-circuits to `SKIPPED_NO_CANDIDATE_PROPOSITIONS` with
zero provider calls — the subject can never acquire propositional state from its own lived
evidence. The INSERT capability, the governed writer path, persistence, restore and the
cognition projection all already exist and are tested, and the semantic pipeline already
computes a `NEW_PROPOSITION_CANDIDATE` that is currently **discarded**. Completing that
specific admission link is the highest-value next capability: it creates genuinely new
persistent lived-history content (the north-star claim), reuses frozen architecture, needs
no Core reopen, and unblocks the cross-domain demo and the product panels, which are thin
today precisely because Belief and Personality are empty in production.

## Repository Truth

`main` @ `e6f0786`; worktree clean; HEAD == origin/main; Core freeze manifest in force.
Familiarity investigation closed (see below). Affect Phase 2 closed negative (58/65,
formal NOT RUN, causal unresolved).

## Core Freeze Status

In force (`CORE_FREEZE_READY_WITH_DOCUMENTED_LIMITATIONS`). The selected slice is
domain-specific implementation + harness only; no generic ontology, authority framework,
Memory architecture, persistence or retrieval framework is required.

## Current Project Status Map

| Domain | Status | Decisive evidence |
| --- | --- | --- |
| Persistence | DONE_WITH_LIMITATIONS | v4 authoritative restore everywhere; familiarity/affect/personality durable carriers round-tripped in product tests; a few store-image round-trips untested |
| Memory | DONE | committed episodes, repository revisions, resolved factual evidence, retention/retrieval law |
| Affect | DONE / CAUSAL_UNRESOLVED | canonical affect + projection + persistence; Phase-2 58/65 strict, formal NOT RUN |
| Belief | IMPLEMENTED_BUT_PRODUCTION_INERT | chain, persistence, projection, INSERT executor all exist and are tested; empty genesis + EXISTING-only workflow ⇒ `SKIPPED_NO_CANDIDATE_PROPOSITIONS`, 0 provider calls in production; NEW candidates discarded |
| Relationship Familiarity | IMPLEMENTED / PERSISTENT / RESTORABLE / PROJECTED / DIRECT_CAUSALITY_NOT_ESTABLISHED / SEARCH_FIRST_MECHANISM_VALIDATED / RETRIEVAL_MEDIATED_BEHAVIORAL_CAUSALITY_UNRESOLVED / DELIVERED_SESSION_ACTIVE=NO / ACTIVE_CAUSAL=NO | completion run + search-first run (host-incomplete, instrument non-discriminating) |
| Language Authority | DONE | V10 + realization plan + zero-authority fail-closed; strict V8 contract compliance limits the model (M1-class) |
| Factual Authority | DONE | SOURCE_QUOTE exact-substring + closed host-verifiable derivation registry; whole-proposal fail-closed |
| Product Session | DONE_WITH_LIMITATIONS | CLI + web on one real runtime/host with restart continuity, `/state` `/life` `/memory`; personality disabled; adaptation steps and timeline/diff not surfaced |
| Personality/Tendency | IMPLEMENTED_PACKAGE / PRODUCT_DISABLED | 4-dimension closed registry, genesis prior, semantic channel + deterministic plasticity + governed commit, `soft prior` projection, restart tests; no P0 authoring surface, no provider built, flag `personality_adaptation_enabled: false` |
| Cross-Domain Demo | BLOCKED (content) | honest demo today shows Memory + Relationship only; Belief always empty, Personality ABSENT, Affect causally unresolved |

## Old Roadmap vs Current Reality

| Old step | Reality |
| --- | --- |
| 1 Persistence + Projection Hardening | DONE |
| 2 Affect Completion + Causal Validation | DONE_WITH_LIMITATIONS (implemented; causal NEGATIVE_CLOSED / UNRESOLVED) |
| 3 Relationship Familiarity Causal Completion | NEGATIVE_CLOSED (direct) + UNRESOLVED (retrieval-mediated) |
| 4 Belief Lived-Evidence Completion | **NOT_STARTED — selected now** |
| 5 Personality/Tendency Completion | DONE_WITH_LIMITATIONS (package complete; product enablement NOT_STARTED) |
| 6 Cross-Domain Longitudinal Experiment | NOT_STARTED (blocked by steps 4/5 content gaps) |
| 7 Full CharacterOS vs baselines | NO_LONGER_NEEDED in that form (replaced by the per-channel causal program + the north-star demo) |
| → CORE FREEZE | DONE |
| → PRODUCT | PARTIAL (CLI + web exist; content thin) |

## Familiarity Final Closure Status

`IMPLEMENTED / PERSISTENT / RESTORABLE / PROJECTED / DIRECT_CAUSALITY_NOT_ESTABLISHED /
SEARCH_FIRST_MECHANISM_VALIDATED / RETRIEVAL_MEDIATED_BEHAVIORAL_CAUSALITY_UNRESOLVED /
DELIVERED_SESSION_ACTIVE = NO / ACTIVE_CAUSAL = NO`. No third familiarity experiment; the
post-hoc HIGH convention-citation pattern remains descriptive only.

## Familiarity Lessons Carried Forward

1. Cross-experiment methodology rule: a "used the retrieved evidence" endpoint MUST be
   identified through authoritative provenance (`claim.source_refs ⊆ retrieval selected
   refs`), never by quote length, wording or text similarity.
2. Pre-register host-completeness expectations against the *model's* known compliance
   limits: a strict authority contract with a large evidence set can fail more often
   (14/48 in the search-first run, concentrated in the retrieval-enriched conditions).
3. Matched-corpus controls beat bundled contrasts; ablation by suppressing the mediator
   (never by mutating state) is the reusable device.

## Retrieval Compliance Risk

Recording only: retrieval-enriched HIGH evidence was associated with more V8 compliance
failures in the inconclusive run. Not a causal finding; it is a product-integration risk
to be measured if session search-first is ever wired.

## Stale Truth Metadata

`MECHANICAL_TRUTH_MAINTENANCE` — `PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 =
"NONE"` plus the "no product governed-write path" comments contradict the live familiarity
ingestion. No behavioral consumer. Timing: defer; fix bundled with a later mechanically
related change in the same files (or a tiny dedicated maintenance commit); must not drive
architecture and must not reopen writer authority.

## Belief Current State

Canonical `belief-state-v0` (credence = subjective endorsement, CharacterOS-owned
proposition identity, empty lawful genesis); foundation/plasticity/decision/arbitration
(`stance = 2c−1`, `UNIQUE_POSITIVE_MAX`, ties/≤0 → `NO_SELECTION`); governed mutation via
the one V2 pipeline with producer-scoped issuer; lived-evidence wiring per completed turn
(belief → personality → familiarity ordering); one model-backed semantic call per evidence
window (closed output, fingerprint echo, no retry); persistence/restore and prompt
rendering (`[SUBJECTIVE BELIEF STANCES … STATE_VISIBLE_NOT_CITEABLE]`) all proven offline.

## Belief Missing Work

The single production gap: **proposition admission**. The workflow terminalizes
`NEW_PROPOSITION_CANDIDATE` and discards the label; production genesis has zero
propositions; the wiring therefore skips with zero provider calls. Missing pieces, in
order: (i) a host-authoritative admission path that turns an accepted new-proposition
candidate plus its evidence binding into one lawful INSERT (`proposition_key`,
evidence-grounded label, host-fixed initial credence) through the EXISTING proposal and
executor; (ii) wiring it into the adaptation workflow instead of the discard terminal;
(iii) zero-model gates for the admission law; (iv) one bounded real-model qualification
with a corrected, provenance-based endpoint. Belief semantics, arbitration and the
decision chain are NOT touched.

## Personality Current State

4-dimension closed registry (`agreeableness`/`conscientiousness`/`extraversion`/`openness`,
each with frozen anchors, explicitly no defaults/0.5), creation-only full-registered
genesis prior, semantic-channel → deterministic plasticity (±0.05 step, ≥3 members,
activation ≥1.5) → governed `/personality` replacement, durable ledger, `soft prior`
projection, restart tests, deterministic context-difference proof.

## Personality Missing Work

Product enablement only: author a P0 (no config knob exists), construct the semantic
provider in the product bundle, flip `personality_adaptation_enabled` to true, surface the
per-turn report; then a real-model compliance measurement. Behavioral payoff was twice
`LEVEL_6_NOT_DEMONSTRATED` for the *existing* salience contract — so this is enablement,
not a missing capability.

## Session Retrieval Current State

Executor composition: LIVE (orchestration fires; the production retrieval service selects
counterpart history). Delivered session: INERT (throwing port; familiarity-blind session
query). Fixing it is a `PRODUCT_COMPOSITION_FIX` (no Core reopen) but has no validated
behavioral benefit and carries the compliance risk above.

## Cross-Domain Demo Readiness

Not ready as a *content* demo: with production defaults, Belief is always empty and
Personality is DISABLED, so an honest longitudinal demo would show Memory, Relationship
familiarity, Affect and Regulation only. It becomes compelling only after the selected
Belief completion (and, optionally, Personality enablement).

## Product Demo Readiness

The surface already exists and is honest: CLI + web share one runtime/host with
restart continuity, `/state` `/life` `/memory` inspection, `/observe` `/time`
`/environment` world inputs. What is missing is (a) domain content to display, (b)
timeline/state-diff and adaptation visibility. No generic UI work is justified as the next
capability; the surface can be extended later with one bounded vertical slice.

## Candidate Scorecard

| Candidate | Maturity | Missing work | Cost | Authority risk | Model-compliance risk | Behavior-effect probability | Thesis | Portfolio | Product | Scientific | Core reopen? | Recommended? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A Belief lived-evidence completion | package done; production inert | proposition admission + wiring + gates + bounded qualification | MEDIUM | LOW (existing governed path) | MEDIUM (strict label/fingerprint contract) | MEDIUM | HIGH | HIGH | HIGH | HIGH (only unbuilt domain link) | NO | **YES** |
| B Personality/tendency completion | package done; product disabled | P0 authoring + provider wiring + flag + compliance/behavior measurement | SMALL | LOW | MEDIUM | LOW (twice NOT_DEMONSTRATED) | MEDIUM | MEDIUM | MEDIUM | LOW (confirms known infra) | NO | No |
| C Session search-first integration | mechanism validated; session inert | composition fix (+ read-only review first) | SMALL | LOW | HIGH (mediator compliance risk) | LOW (no validated benefit) | LOW | MEDIUM | LOW | LOW | NO | No |
| D Cross-domain longitudinal demo | Memory/Relationship/Affect only | blocked by A/B content gaps | MEDIUM | LOW | MEDIUM | LOW–MEDIUM | HIGH | HIGH | MEDIUM | LOW | NO | Not yet |
| E Product vertical slice | CLI+web done | timeline/diff/adaptation visibility, multi-subject | MEDIUM | LOW | LOW | N/A (no science) | MEDIUM | HIGH | HIGH | LOW | NO | Not yet |

## Why Candidate A Lost / B Lost / C Lost / D Lost

(A is selected; the four "lost" headings below cover the non-selected candidates in the
order the prompt lists them.)

- **B (Personality)** lost because it is enablement of an existing, already-tested chain
  whose behavioral payoff has twice been `NOT_DEMONSTRATED`; it adds less new persistent
  distinctiveness than creating propositional content from lived evidence, and it does not
  unblock any other candidate by itself.
- **C (Session search-first)** lost because it wires an unvalidated behavioral channel and
  carries the observed compliance risk; per policy its first step would be a read-only
  review returning no user-visible value increase.
- **D (Cross-domain demo)** lost **for now** because the honest demo is thin: production
  Belief is empty and Personality is disabled; after A it becomes genuinely strong.
- **E (Product vertical slice)** lost **for now** because the surface is already built and
  wired; a slice adding timeline/diff views would present mostly empty domains. It is the
  natural *second* step after A (content), possibly combined with B (enablement).

## Selected Capability Why It Wins

Belief lived-evidence completion maximizes
`persistent-history distinctiveness × user-visible demonstrability × reuse of frozen
architecture × probability of completion` while minimizing
`generic infrastructure × authority risk × prompt-loop dependence`: it is the only
provably missing production link, it creates new canonical content from the subject's own
evidence (the thesis claim in its strongest form), it uses an INSERT path that already
exists and is tested, it is domain-specific (no Core reopen), its failure mode is a
lawful no-op, and it turns the product's `Beliefs: ABSENT` panel into living state.

## Expected Engineering Cost

MEDIUM: one governed admission component (domain-specific), one wiring change, zero-model
tests, one bounded experiment harness; no new protocol surface beyond the existing belief
proposal (INSERT already specified), no persistence change, no UI change.

## Expected Model-Call Cost

SMALL: the belief semantic channel already makes exactly one call per evidence window; the
bounded qualification is expected in the 30–60 call range with 0 retries (preregistered
before the run).

## Expected Behavioral-Signal Probability

MEDIUM: the projection link is deterministic (a stance with exact credence reaches the
prompt); whether the delivered behavior changes is plausible but unproven, and the run
must accept a negative result. The endpoint must use authoritative provenance (§3 rule),
never text similarity.

## Thesis Value / Portfolio Value / Product Value

Thesis HIGH (new persistent propositional state acquired from lived evidence, surviving
restart, visible in the model-visible internal context); portfolio HIGH (a belief that
exists only because of the subject's history is easy to explain and hard to dismiss as
prompting); product HIGH (`/state`, `/life` and the web panel start showing real acquired
beliefs, and the demo gains its missing content).

## Core Reopen Required? — NO

## Exact Recommended Next Slice

**`BELIEF_LIVED_EVIDENCE_CAUSAL_COMPLETION_V0`** — implement the host-authoritative
proposition admission (from the already-computed `NEW_PROPOSITION_CANDIDATE` plus its
evidence binding) through the EXISTING belief proposal/executor/authority; wire it into
the adaptation workflow; add zero-model gates (admission law: host-owned identity and
initial credence, evidence-grounded label, no model numeric/identity authority, dedupe,
replay, persistence, restore, projection); then one bounded, preregistered real-model
qualification with a provenance-based endpoint and an accepted-negative policy. Non-goals:
no Belief semantics/arbitration changes, no new dimension ontology, no familiarity work,
no session search-first wiring, no prompt tuning, no product/UI work.

## Mechanical Maintenance Timing

Defer the stale writer-authority metadata fix; bundle it with a later change touching the
same files or do it as a tiny standalone commit after the selected slice. It must not
block, and must not silently redefine any frozen registry.

## Affect Reopened? / Familiarity Reopened? / Production Files Changed / Real Model Calls

NO / NO / NO / 0.

## Confidence

High on both domain audits (source- and test-verified, including the inertness proofs and
the enablement gaps) and on the candidate ranking; medium on the selected slice's
behavioral payoff (probable but unproven, hence the accepted-negative policy).

## Largest Remaining Uncertainty

Whether acquiring a new proposition changes the delivered behavior under the current model
rather than only the model-visible context; and whether the strict label/fingerprint
contract that gates proposition admission will hold up under real-model compliance — both
must be measured, not assumed.
