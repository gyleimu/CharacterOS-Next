# RELATIONSHIP_FAMILIARITY_CAUSAL_CLOSURE_V0 — DECISION

READ-ONLY closure review. **Real model calls: 0. Production changes: NONE.**
Machine verification: [`inventory.mjs`](./inventory.mjs) → [`inventory.json`](./inventory.json)
(31/31 checks, all claims source- or artifact-verified).

Frozen head at review time: `0773d91` (`main`, worktree clean, HEAD == origin/main).

---

## Principal Root Cause

`BEHAVIORAL_LATITUDE_WAS_SUPPRESSED_BY_SCENARIO`.

Evidence: in `RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0` all 40 scenes returned the
**same** endpoint class and the **same** delivered text (1 distinct text across 40
scenes): every turn designated `PRIMARY_FACT` over the one authorized convention quote,
because that quote fully answered the turn. The ablating condition — with no familiarity
material at all — produced the identical answer, so the answer was determined by the
evidence, not by the state. The scenario therefore had no behavioral latitude in which
any state（familiarity 或其他）could act. `DIRECT_PROJECTION_DOES_NOT_MATERIALLY_AFFECT_BEHAVIOR_IN_TESTED_SCENARIOS`
and `SEARCH_MEDIATION_WAS_EXPERIMENTALLY_NEUTRALIZED` are also literally true of that
experiment, but they are descriptions of its design and scope, not independent causes;
`MODEL_INSENSITIVE_TO_FAMILIARITY_PROJECTION` is NOT supported, because no
latitude-preserving scenario was ever run.

## Direct Projection Channel Status

`DIRECT_PROJECTION_CAUSALITY_NOT_ESTABLISHED`.

0/8 LOW↔HIGH paired differences and 0/8 HIGH↔HIGH_ABLATED differences, with both cells
internally stable (16/16) and the run host-complete, support exactly this narrow reading:
under matched raw Memory, in these scenarios, the rendered familiarity value
(`presence`/`level k/32`) and the strategy annotation did not move the preregistered
endpoint. It does not support "familiarity can never affect behavior".

## Search-First Channel Status

`SEARCH_FIRST_CAUSAL_CHANNEL_UNTESTED`.

Traced from the actual prior harnesses (not from names):

| Experiment | Search-first leg exercised? | Corpora identical? | Recorded verdict |
| --- | --- | --- | --- |
| `familiarity-causal-behavior-v0` | Yes — arm B issued 1 query, `ATTEMPTED_WITH_USABLE_EVIDENCE`, `episode:alice-08` became model-visible | NO — arm A 1 episode, arm B 16; convention only in B | `INVALID_EXPERIMENT` (A arm failed the artificial envelope; complete=false) |
| `familiarity-causal-behavior-v1` (r3) | Yes — all 8 arm-B executions issued the query and selected `episode:alice-08` (reaching the language input) | NO — same 1-vs-16 design | `SAFETY_GROUNDING_FAIL`, complete=false, 9/16 cognition timeouts, 0/7 directional |
| `relationship-familiarity-behavior-real-provider-v0` | Attempted ×8 in HIGH but **rehearsed EMPTY** (`ATTEMPTED_EMPTY`) | YES — one shared episode, identical `memory_binding_hash`, identical evidence refs | `…_REAL_PROVIDER_BEHAVIOR_INCOMPLETE` |
| `…_CAUSAL_COMPLETION_V0` (this program) | Deliberately neutralized (matched evidence) | YES | `…_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED` |

No real-model experiment has ever combined **identical corpora** + **non-empty retrieved
evidence** + **host-complete run**. The end-to-end "retrieved evidence becomes
model-visible" leg is proven only by deterministic mechanism suites (real
`InMemoryRetrievalService` + the production executor):
`relationship-interaction-familiarity-retrieval-orchestration.test.ts`,
`relationship-familiarity-retrieval-normal-execution.test.ts`,
`relationship-familiarity-retrieved-evidence-integration.test.ts`.

## Feature Overall Status

`FAMILIARITY_DIRECT_CHANNEL_NEGATIVE_SEARCH_CHANNEL_UNTESTED`.

## Principal Verdict

`RUN_ONE_SEARCH_FIRST_CAUSAL_EXPERIMENT`.

## Executive Decision

Close the direct-projection experiment as a scoped negative; do **not** overgeneralize;
run exactly one bounded, preregistered SEARCH_FIRST experiment on the **same candidate
corpus** with a search-policy ablation, then either grant `ACTIVE_CAUSAL` **qualified as
retrieval-mediated** (if it passes) or close familiarity causality for the current
model/runtime (if it fails). `ACTIVE_CAUSAL` stays `NO` until then.

**Mandatory scope caveat (new finding of this review):** in the *shipped session
composition* the search-first channel is currently **INERT** —
`explicit-v4-session-authority-v0.ts:559` gives the cognition executor a retrieval port
that throws (`"session: retrieval is performed by the session authority"`), so every
`SEARCH_FIRST` attempt records `RETRIEVAL_FAILED` and adds no evidence, while the
session's own retrieval query (`:805-815`) is familiarity-blind (`entity_refs =
active_entity_refs`, `max_candidates: 8`, no strategy input). The orchestration itself is
live and unconditional (`cognition-action-transition-executor.ts:555-559`) and works
whenever a real retrieval port is wired — which is how the mechanism suites and the
`…_COMPLETION_V0` harness compose it. Therefore the recommended experiment is
**executor-composition-scoped**: a positive result establishes the capability's
retrieval-mediated causality under the frozen production executor + the production
retrieval service, and would then justify a *separate, feature-specific product decision*
about whether the session's own retrieval should honor the frozen strategy. It would not
by itself be evidence about today's shipped session. No Core change is requested here.

## Repository Truth

`main` @ `0773d91`; worktree clean; HEAD == origin/main; Core freeze manifest
(`research/core-completion/core-freeze-manifest-v0/`, status
`CORE_FREEZE_READY_WITH_DOCUMENTED_LIMITATIONS`) remains authoritative. No Core contract
was reopened or reinterpreted.

## Previous Experiment Valid? / What It Proved / Did Not Prove

Valid as evidence for the direct projection channel: preregistered, host-complete
(40/40), frozen model digest, matched Memory (attested: only the two familiarity lines +
revision/hash metadata differ between LOW and HIGH), fresh-process authoritative restore
per scene, live Cognition V8 / Language V10, zero retries.

Proved: familiarity is persistently written, restored, projected and model-visible; the
directly rendered familiarity state did not change the preregistered endpoint or the
delivered behavior under matched Memory in two convention-dominated scenarios.

Did not prove: anything about a latitude-preserving scenario; anything about
model insensitivity; anything about the retrieval-ordering channel; anything about other
models or digests; and it is not a global "familiarity is not causal" result.

## Production Causal Surface

Two and only two mechanisms exist; no additional path was found (inventory §2–§5):

**Channel A — direct model-visible projection.** Canonical familiarity → read projection
(`presence`, `canonical_value`, `ordinal_level`/`ordinal_max`, `STATE_VISIBLE_NOT_CITEABLE`)
→ influence artifact → rendered in the model-facing cognition prompt.
Code: `relationship-interaction-familiarity-read-projection.ts`,
`relationship-interaction-familiarity-cognition-influence.ts`,
`conversation-cognition-provider-v2.ts:222-239,275-276` (feeds V3→V4→V8), plus the legacy
`conversation-cognition-provider.ts` path.

**Channel B — retrieval orchestration.** Influence artifact → priority retrieval query →
validated result → `recent_retrieval_refs` → model-visible evidence (and language
`memory_episode_contents`).
Code: `relationship-interaction-familiarity-retrieval-orchestration.ts:118-138,157-246`,
`cognition-action-transition-executor.ts:545-577,710`, union at `:291-303` (v4) / `:426-435` (v3).

## Direct Projection Code Path / Search-First Code Path / Threshold

As above. Threshold: `COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0 = 2`
(`relationship-interaction-familiarity-cognition-influence.ts:92`); rule at `:115-124`:
`presence === "PRESENT" && ordinal_level >= 2 → COUNTERPART_CONTEXT_SEARCH_FIRST` else
`BASIC_CONTEXT_FIRST`; active-counterpart gate at `:139-150` (only counterparts whose ref
appears in `context.active_entity_refs`, sorted). Nothing here is changed.

## Exact Retrieval Behavior

Only `SEARCH_FIRST` influences trigger anything: exactly one query per triggering
influence; the query is host-owned (`buildInteractionFamiliarityCounterpartQueryV0`,
`:118-138`) with `semantic_reference = counterpart_ref`, `entity_refs = [counterpart_ref]`,
`relationship_refs = []`, `temporal = {now, window_start: null}`,
`current_context_refs = sorted-unique(focus ∪ environment)`,
`salience_constraints = {min_declared_score: null, max_candidates: 16}` — the query
contains no familiarity/threshold logic. The result is validated with the existing law
(`validateMemoryRetrievalResult`, subject/revision checks); outcomes are closed
(`ATTEMPTED_WITH_USABLE_EVIDENCE` / `ATTEMPTED_EMPTY` / `RETRIEVAL_FAILED`, per-attempt,
plus `no_priority_request_count`). Selected refs are unioned (dedup + sort) into
`recent_retrieval_refs`, which is what the model sees. Deterministic: same state + same
port behaviour ⇒ same query, same refs (frozen query fingerprint).

## Previous Memory Matching / Why Search-First Was Neutralized

The completion experiment injected a retrieval service that returned an empty selection
for every condition, so the priority query (issued only under `SEARCH_FIRST`) added
nothing; LOW and HIGH therefore had identical `recent_retrieval_refs`, identical working
refs and the same resolvable factual evidence, and the attested input diff was confined
to the two familiarity lines + revision/hash metadata. The real-provider experiment did
the same by design (strict isolation, `high.retrieval_attempts = 1`, zero added
evidence). Both were correct for their estimand (isolating the state), and both leave the
mediation pathway untested.

## Memory Difference: Confound Or Mediator?

**Mediator** (frozen per §6): if the causal path is
`familiarity → retrieval ordering → retrieved evidence → behavior`, the retrieved
evidence is the causal mediator, not a confound. The confound would be a *different
candidate corpus, world, query or model* between conditions — which §7 forbids.

## Same-Corpus Requirement / Can Same Corpus Be Used?

Required: identical candidate records, bytes, refs, counterpart identities, current
observation, query, model, settings, Belief/Affect/Regulation/Personality, factual
authority and environment; only the familiarity-mediated orchestration may differ.

Feasible: YES. The `…_COMPLETION_V0` harness already persists **one identical 16-episode
repository revision for every condition** (only the number of admitted interactions
differs), and its scene runner takes the retrieval port as an injected dependency while
the orchestration itself is production code. Wiring the *production* retrieval service
(`RepositoryBackedMemoryRetrievalServiceV0`, the class the session uses; or the
production `InMemoryRetrievalService` with a predeclared identical corpus) into the
executor composition gives both conditions the same computable candidate corpus, with the
production orchestration deciding whether a priority query is issued.

## Existing Experimental Seam

`research/experiments/relationship-familiarity-causal-completion-v0/` (scene workers with
fresh-process restore, matched-observation admission, request capture, line-level diff
attestation, request-id isolation, bounded runner, per-scene evidence). The retrieval port
is an existing dependency seam (`RuntimeDependencyContainer.retrieval`), used exactly as
the frozen mechanism suites use it. No new infrastructure.

## Can Search Policy Be Ablated Without State Corruption?

YES, with existing seams and no state change:
- primary ablation: for the `HIGH_SEARCH_ABLATED` condition, the retrieval port returns
  no evidence (the orchestration still fires and records `ATTEMPTED_EMPTY`), so the
  *mediation* is removed while the canonical state and Channel A's strategy line stay
  intact — the same device the frozen real-provider experiment used by design;
- optional secondary (if a cleaner contrast is wanted): the already-established
  request-level transform that replaces only the strategy line with `BASIC_CONTEXT_FIRST`,
  attested as the sole diff.

## Generic Core Change Required? / Search-First Experiment Feasible?

`NO` / `SEARCH_FIRST_EXPERIMENT_FEASIBLE_WITH_EXISTING_FROZEN_CORE` (executor-composition
scope; see the Executive Decision caveat).

## Proposed Conditions / Candidate Corpus / Scenario Semantics / Endpoint

Conditions (preregistered, bounded): `LOW_FULL` (1/32 → `BASIC_CONTEXT_FIRST`, 0 priority
queries), `HIGH_FULL` (16/32 → `SEARCH_FIRST`, 1 priority query returning the
counterpart-context item), `HIGH_SEARCH_ABLATED` (same 16/32 restored state, same corpus,
port returns no evidence). Desired pattern (§19): `LOW_FULL ≠ HIGH_FULL` **and**
`HIGH_SEARCH_ABLATED` returns toward `LOW_FULL`.

Corpus (identical in all conditions): one counterpart-specific prior-context/convention
episode (the retrieved item), one generic/basic context episode that both conditions can
see, and one distractor episode that neither strategy should surface.

Scenario: multiple fact-compatible admissible responses, **no unique authoritative quote
that mechanically determines the answer**; task types where retrieved counterpart context
can legitimately change communication strategy (shorthand vs explicit framing, redundant
introduction or not) without implying trust/liking/safety/intimacy.

Endpoint: predeclared classes over the host-validated V8 atom plus whether the delivered
claim cites the retrieved counterpart-context evidence (e.g. `USES_RETRIEVED_COUNTERPART_CONTEXT`,
`ASKS_FOR_FRAMING`, `GENERIC_ANSWER`, `OTHER_FACT`, `UNCLASSIFIED`) — protocol-level, no
free-text similarity, no post-hoc classes.

## Retrieval Attestation / Authority / Leakage / Model Freeze / Budget

Attestation per condition (§21): candidate-corpus hash, executed queries in order with
fingerprints, selected refs with content hashes and rank, model-visible retrieved context,
the familiarity projection lines, the response atom, and the final behavior.

Authority (§17): unchanged — familiarity may cause retrieval; it never makes a retrieved
proposition true; all `SOURCE_QUOTE` / host-verifiable derivation contracts stay active,
and any citation of a retrieved ref must pass them.

Leakage (§46): no condition labels; attested allowlisted diffs only.

Model/provider: `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, temperature 0,
think/stream false, `num_predict` 2048, server version pinned and verified before/after
(mismatch ⇒ hard `MODEL_BASELINE_CHANGED` stop).

Budget (§33): bounded, preregistered; e.g. 3 conditions × 8 replicates × 2 scenarios = 48
scenes ⇒ ≤ 96 generation calls + ≤ 2 readiness ≤ 100. No retries, no repair.

## Positive Interpretation / Negative Interpretation / ACTIVE_CAUSAL Criterion

Positive: familiarity exhibited a **retrieval-mediated** behavioral causal effect under
the frozen CharacterOS runtime (executor composition); then — and only then —
`relationship_core_interaction_familiarity_v0` may become `ACTIVE_CAUSAL` with the
qualifier "retrieval-mediated", and NOT "directly changed the model's preferences".

Negative (§23/§36): search ordering differs, retrieved context differs, authority stays
clean, behavior identical ⇒ close familiarity causality for the current model/runtime
with **both** frozen channels tested; status
`IMPLEMENTED / PERSISTENT / PROJECTED / BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED`; no prompt
tuning, no new loops.

Mechanism failure (§24): if `SEARCH_FIRST` is present in the projection but the
orchestration does not change what the port receives/returns in the harness composition,
report `RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_MECHANISM_FAILED` and recommend only a
feature-specific implementation review.

## Stale Writer Constant Audit / Truth-Metadata Fix Needed?

`STALE_TRUTH_METADATA`. `PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE"`
(`historical-writer-authority-registry.ts:572`) and its comment "There is still NO product
governed-write path", plus the membrane comment "registry at ZERO entries … every ordinary
production V2 record keeps writer_authority = null"
(`writer-authority-membrane.ts:29-32`) and
`relationship-governed-write-authority-service.ts:40-44`, contradict the executable
production path: the familiarity ingestion mints governed writer authority and commits
non-null `writer_authority` records (verified by the ingestion tests, the product session
paths, and the qualification run's own commits). The constant has **no behavioral
consumer** — only one registry-test assertion and a root re-export.

Fix needed: YES, but only as a **later mechanical truth-maintenance** change (update the
literal/comment/test to "exactly ONE product governed-write path: the interaction
familiarity ingestion"). Do not reinterpret any frozen registry to make text consistent,
and do not let stale text reopen writer authority or block causal closure.

## Affect Reopened? / Core Reopened? / New Relationship Features?

NO / NO / NO.

## Recommended Next Slice

Exactly one: **`RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0`**
(preregistered, bounded, executor-composition scope as specified above; existing frozen
Core only; no Core modification, no prompt tuning, negative result accepted).

## Production Files Changed / Real Model Calls

NO / 0.

## Confidence

High on the causal-surface inventory and on the session-inertness finding (source-verified
by two independent passes and by this review's own inventory script). High on the
classification of the three prior experiments (each backed by its frozen artifacts).
High on the direct-channel negative being scoped, not global. Medium-high on the value of
one SEARCH_FIRST experiment: the mechanism is proven to work when a port is wired, so the
experiment is decidable; its product relevance depends on the session-wiring caveat.

## Largest Remaining Uncertainty

Whether the retrieval-ordering channel, once actually fed (identical corpus, non-empty
selection, real model), changes behavior at all — and whether the shipped session should
be wired to honor the frozen strategy if it does. Both are unanswered today; neither can
be answered by more prompt-level familiarity work.
