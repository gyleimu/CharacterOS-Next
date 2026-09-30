# PHASE 0 BUDGET REVISION — REV2 (phase boundaries, outputs unseen)

**Frozen before the first call.** `MODEL_CALLS_AT_REVISION_TIME = 0`. No output of any layer of
`HISTORY_INTERNALIZATION_TEST_V1` existed when these boundaries were changed.

This document exists because the V1 preregistration could not produce an exact Phase-0 budget. Per
the round's §24, an inexact budget must be resolved **before** any call, never while running.

---

## 1. THE TWO DEFECTS FOUND BY THE 0-CALL AUDIT

### D1 — the V1 call model was factually wrong

V1 §22 assumed **2 model calls per turn** (cognition + belief semantic). The production turn loop
actually runs four families:

| family | per turn | source |
| --- | --- | --- |
| conversation cognition | 1 | `conversationCognitionTransport` |
| language realization | 1 | `languageTransport` |
| factual event appraisal | ≥1 | `factualEventAppraisalProvider` |
| **belief semantic** | **exactly 1** | `OllamaBeliefSemanticProviderV0` |

Independently confirmed by the earlier real-provider run
(`research/experiments/belief-change-lived-evidence-v0/evidence/run-1-real-provider/summary.json`:
`cognition 3, language 3, appraisal 7, belief_semantic 3` over three turns). A budget of
9 turns × 2 = 18 was therefore wrong by roughly a factor of three, and the V1 figure of 115 could
not be derived from the schedule it claimed to describe.

**Only the belief-semantic calls can move the endpoint.** The other three families are auxiliary:
they are what makes an experience *lived* through the production path, and they are counted and
reported rather than frozen.

### D2 — V1 derived the trajectory length from a calibration phase

V1 set `N = ceil(Δ_required / Δ_measured_per_turn)` **after** a 12-call pre-flight. That makes the
Phase-0 total unknowable before the first call, which is the exact freedom the round's §24 forbids
("do not decide when to stop while running") and which V1's own §22 required be re-frozen.

---

## 2. THE REVISION

**N is now fixed a priori at 5 turns per arm**, not derived from anything measured.

**The stop rule is fixed on TURNS, never on calls and never on an observed effect:**

```
1 qualification turn  +  5 turns arm A  +  5 turns arm B   =  exactly 11 turns, then STOP
```

| item | exact value |
| --- | --- |
| qualification turns (non-target subject, non-target proposition) | **1** |
| trajectory turns, arm A | **5** |
| trajectory turns, arm B | **5** |
| **total turns — the stop rule** | **11** |
| **belief-semantic calls (the only endpoint-bearing calls)** | **11** |
| auxiliary calls | measured, not scientific; frozen upper bound 5/turn |
| **frozen total model-call upper bound** | **66** |

Compare: the V1 preregistration's headline was 115 calls for a protocol that included cognition,
decision, restart, intervention, ablation and baseline phases — none of which Phase 0 runs.

### Why 5 turns per arm, not fewer

- The production ordering law (`interactive-subject-runtime-v0.ts`: turn N's learned state reaches
  only turn N+1) makes a single-turn design unable to express any effect, so `N ≥ 2` is required for
  Failure A to be *diagnostic* rather than unfalsifiable.
- Turn 0's evidence is the observational experience of the opening event, in which both arms are
  **byte-identical**; the informative, arm-differing evidence begins at turn 1. `N = 5` therefore
  yields **4 arm-differing evidence events per arm**, while still leaving the opening turn shared —
  which makes the common-mode contribution explicit instead of confounding it.
- The endpoint is a **directional** predicate. One lawful commit in each arm, in opposite
  directions, with differing post values satisfies it. Five opportunities per arm is the smallest
  count that makes an all-abstention null unlikely enough to be informative rather than ambiguous.
- **This number was not chosen after seeing any effect, and it will not be extended.** If both arms
  abstain, that is Failure A and it ends the round.

---

## 3. WHAT DID *NOT* CHANGE

The scientific content of the V1 preregistration is untouched by this revision:

- the target proposition, its baseline credence and its predicted directions;
- the two-subject design and the initial-state equivalence requirement;
- the frozen `VALENCE_TABLE` and the matched trajectory construction;
- the frozen primary predicate `delta_A > 0 AND delta_B < 0 AND credence_A_post != credence_B_post`;
- the frozen scorer and the invalid/inconclusive policy;
- §15's prohibition on adding a restart check to this round.

The revision changes **only** how many turns are run and how the budget is expressed.

---

## 4. THE EXECUTOR

No transport is substituted. The belief semantic provider is the shipped production
`OllamaBeliefSemanticProviderV0`; the transports are the shipped production
`OllamaNativeCognitionTransportV0`; the appraisal provider is the shipped product composition. The
production Ollama runtime was verified reachable with the production model (`qwen3.5:9b`) — the same
model the earlier real-provider run used. `packages/` is unmodified at `02b6c46e`.

The model identity is recorded as data in every artifact and reported with the result; it is never
baked into a verdict token.

---

## 5. WHY THIS ROUND STILL ENDS AT PHASE 0

Phase 0 answers one question only: does controlled lived experience reach the **persistent canonical
belief state**, in the preregistered direction, differently for two identically-initialised subjects.

A positive result raises the evidence hierarchy from **L1 to L2 and no further**. It would not show
that persistent belief alters cognition (L3), that it alters decision or behaviour (L4), that it
survives restart (L5), or that it separates from a summary baseline (L6). It certainly would not show
that "the subject has been shaped by its life".
