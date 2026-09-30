# HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0 REPORT

**Verdict: `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE`**

| token | value |
| --- | --- |
| verdict | `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE` |
| evidence hierarchy | **L1 → L1** (unchanged; a level is raised only on a completed positive) |
| `CHARACTEROS_UNMODIFIED` | **yes** — `packages/` clean at `02b6c46e` |
| executor | production Ollama stack, model `qwen3.5:9b`, **no transport substituted** |
| budget | 11 turns frozen; 11 turns executed; 39 model calls total |
| frozen predicate | `delta_A > 0 AND delta_B < 0 AND credence_A_post != credence_B_post` — **not evaluable as preregistered** |

Phase 0 asked one question: *does controlled lived experience reach the persistent canonical belief
state, in the preregistered direction, differently for two identically-initialised subjects?*

It **did not answer it**, because arm B's trajectory did not complete: three of its five turns failed
at the production fail-closed boundary, for reasons that have nothing to do with the belief mechanism.
The frozen policy reserves `INCONCLUSIVE` for exactly this, and it forbids treating an engineering
failure as a scientific null — or re-running to obtain the missing turns. **No turn was re-run, no
event was replaced, no request was modified, and the schedule stopped at exactly 11 turns.**

---

## 1. WHAT HAPPENED, TURN BY TURN

A turn costs four call families (cognition, language, factual-event appraisal, belief-semantic). The
belief-semantic provider — the only family that can move the endpoint — classified as follows:

| turn | arm A classification | arm A credence | arm B classification | arm B credence |
| --- | --- | --- | --- | --- |
| 0 (shared opening, byte-identical text) | SUPPORTS | 0.55 → 0.60 | SUPPORTS | 0.55 → 0.60 |
| 1 | SUPPORTS | 0.60 → 0.65 | **CONTRADICTS** | 0.60 → **0.55** |
| 2 | SUPPORTS | 0.65 → 0.70 | **turn FAILED** | — |
| 3 | SUPPORTS | 0.70 → 0.75 | **turn FAILED** | — |
| 4 | SUPPORTS | 0.75 → **0.80** | **turn FAILED** | — |

Arm A completed five for five, every step in the preregistered `INCREASE` direction, ending at
**0.80**. Arm B committed the preregistered `DECREASE` direction once and then stopped being
measurable at **0.55** — which happens to equal its starting value, but only because that is the net
of one step up (the shared opening) and one step down (the broken-commitment turn).

## 2. WHY ARM B FAILED — ENGINEERING, NOT MECHANISM

`B:turn_2` was rejected by the production validation layer:

```
CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED:
SEMANTIC_COMPLETENESS_FAILED: conversation proposal.response_semantics:
PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance
```

The executor emitted a stance-shaped response without the `subjective_selection` block that response
semantics requires; the runtime failed the turn closed, exactly as designed. Turns 3 and 4 then failed
with `session: ingress must record (CONFLICT)` — the **cascade**: once a turn fails mid-lifecycle the
ingress ledger can no longer admit the next source id, so a single executor error ends the arm's
useful trajectory.

Three properties of this failure matter for anyone reading the result:

1. **It is executor-side, not belief-side.** The belief adaptation chain was never reached on the
   failed turns (`belief_semantic` ran 8 times for 11 turns). Nothing about belief plasticity,
   proposition identity or canonical commit was involved.
2. **It is arm-correlated, and that is itself an observation.** Only arm B failed, and only after the
   subject had read a broken-commitment event. The most economical reading is that the negative
   context made a `PRIMARY_STANCE`-shaped reply more likely — but with n = 1 this is a hypothesis
   about the executor's robustness under negative-valence context, not a measured effect. It is
   recorded because it is a real, actionable fact about the stack: **a local 9B executor can lose a
   whole trajectory to one schema-completeness rejection, and the ingress conflict guarantees the
   loss is not recoverable within the same session.**
3. **It is not a scientific null.** Arm B's 0.55 is an artefact of where the failure landed, not
   evidence that broken-commitment experience fails to lower credence. The opposite is in fact
   observed on the one turn that did complete.

### 2.1 This failure class was already known to the programme

The rejection is an instance of an existing, separately frozen diagnostic contract:
`research/experiments/executor-schema-failure-diagnostic-v0/` already classifies
`SEMANTIC_COMPLETENESS_FAILED` as `RESPONSE_SEMANTICS_INCOMPLETE`, and its own tests construct
exactly the failing shape — `response_semantics: { kind: "PRIMARY_STANCE" }` with no authoritative
`subjective_selection`.

Two consequences:

- Phase 0 did not discover a new failure mode; it **produced the first live instance of a known,
  taxonomised one**, which the existing diagnostic line never got because it has no evidence
  directory and was never executed at scale.
- That diagnostic is scoped to `deepseek-flash`. This instance occurred on `qwen3.5:9b`, so the
  failure class is **not specific to one executor model** — a fact the existing line could not know.
- The diagnostic is explicitly **non-confirmatory** and carries no rate, no p-value and no
  denominator. Nothing here converts it into one: n = 1 failure is a mechanism observation.

## 3. WHAT WAS POSITIVELY ESTABLISHED DESCRIPTIVELY (NOT THE ENDPOINT)

The preregistered endpoint is blocked, but the run is not empty. As
`DESCRIPTIVE_PARTIAL_OBSERVATION` — explicitly **not** admissible as the primary claim, because the
schedule did not complete:

- **Lived experience does reach the persistent canonical belief state.** Seven of the eight
  completed belief-semantic resolutions produced a canonical commit; each moved the target credence
  by exactly the frozen `BELIEF_PLASTICITY_STEP` of 0.05. This is the first time in this programme
  that the *lived-evidence* arrow has been exercised end to end on the production path.
- **The `CONTRADICTS` direction fires.** `B:turn_1` moved credence **down** — the first observed
  case in this programme of negative-valence lived evidence lowering a canonical credence. The
  proposition admits both directions, and the semantic provider is willing to assert both.
- **The matched-opening design worked as intended.** Turn 0's text is byte-identical in both arms,
  and both arms produced the *same* classification (SUPPORTS) and the *same* movement (+0.05). The
  divergence is attributable to the frozen `VALENCE_TABLE` spans and nothing else.
- **No new proposition was admitted.** Both subjects ended with exactly the one seeded proposition —
  so the movement is an `UPDATE` of the frozen target, not a side effect of formation.
- **Only the authored outcome span differed.** The executed-request leakage audit is clean over all 9
  recorded cognition requests: neither arm's prompt ever contained the other arm's subject id, and no
  experiment vocabulary was model-visible.

The single most important sentence: **on the two arm-differing evidence events that did complete,
both arms moved in their predicted and opposite directions.** That is a strong signal. It is not the
endpoint, and this report does not present it as one.

## 4. §14 PERSISTENCE — WHAT WAS AND WAS NOT TESTED

Both post-states carry a **committed canonical bundle**: `commit_ref`, `record_checksum`, `state_hash`
and a `state_revision` (A: 47, B: 24). The credence is therefore in the canonical durable state and
not in executor text, a prompt variable, or an ephemeral adaptation result.

**Not tested: process restart.** That is a later frozen phase and this round's brief forbids adding
it. Durability across restart is **not** established by Phase 0.

## 5. DESCRIPTIVE SECONDARY STATE (§20)

| component | arm A | arm B |
| --- | --- | --- |
| affect | valence 1.0, activation 0.723 | valence 0.407, activation 0.418 |
| relationship | `[]` (no counterpart registered) | `[]` |
| personality | `[]`, `traits_seed {}` (out of scope, factory unsupplied) | `[]`, `traits_seed {}` |

Affect moved in both arms from an identical `{valence 0, activation 0.2}` baseline. **This corrects
the previous round's audit**, which had recorded affect as `PRESENT_BUT_NOT_WIRED_TO_TURNS` — see
`PHASE_0_CORRECTIONS.json`. That audit inferred "not wired to turns" from an *export-surface* fact
(the affect executor is not exported from the runtime index) and a module-boundary fact; neither
implies the executor is not invoked. Affect **is** driven every turn.

Per §20, none of this is an endpoint and none of it may be used to rescue the belief result.

## 6. BUDGET AND CALL ACCOUNTING (§24)

| item | frozen | actual |
| --- | --- | --- |
| turns | 11 (1 qualification + 5 + 5) | **11** |
| belief-semantic calls | 11 (1/turn) | **8** — three turns failed before the adaptation step was reached |
| cognition / language / appraisal | not scientific, upper bound 66 total | 9 / 8 / 14 |
| **total model calls** | ≤ 66 | **39** |

The turn count — the frozen stop rule — was met exactly. The belief-semantic count fell short only
because failures occur before that step; the shortfall is a **consequence** of the failures, not a
deviation from the schedule.

## 7. EVIDENCE HIERARCHY

**L1 → L1. No level was raised.** A level is raised on a completed preregistered positive, and this
run has none. L2 ("lived experience changes canonical state") is **supported descriptively but not
established**, and the distinction is the whole point of the frozen predicate.

What Phase 0 does **not** establish, at any reading:

- that persistent belief alters cognition in a new scenario with the history removed (L3);
- that it alters decision or behaviour (L4) — and D1 already measured a null on an *authored*
  difference, so this cannot be assumed to follow;
- that it survives restart (L5);
- that it separates from a summary baseline (L6);
- that "the subject has been shaped by its life", or that "history internalization works";
- anything about the model's own dispositions. **The LLM is an executor; the subject is the
  canonical state.**

## 8. WHAT THIS ROUND DOES AND DOES NOT AUTHORISE

- **No production change is authorised.** `CHARACTEROS_UNMODIFIED`.
- **No mechanism was added**, and a Failure A would not have authorised one either.
- The executor defect found here (schema-completeness rejection → ingress cascade) is an **executor
  and stack-robustness** finding. Fixing it would be a production change and is **not** authorised by
  this round.
- **No turn may be re-run to supply arm B's missing evidence.** The next attempt at this question is
  a new, separately preregistered run with the executor failure understood — not a repair of this one.

## 9. FILES

All under `research/north-star/history-internalization/phase-0/evidence/run-1/`:
preflight audits (§2/§3/§4/§5/§7/§18/§24), `pre-state-{A,B}.json` and `post-state-{A,B}.json`
(all frozen `scored: false` before scoring), `raw-trials.json` with every turn, every provider input
and output and every recorded cognition request, `executed-leakage-audit.json`,
`collection-integrity.json`, `state-delta-report.json`, `frozen-scorer-output.json`,
`phase-0-verdict.json`, `evidence-hierarchy-update.json`, and `PHASE_0_CORRECTIONS.json`.
The budget revision is `../PHASE_0_BUDGET_REVISION.md`.
