# RUN-4 PREREGISTRATION — PHASE 0 ON THE SWAPPED (CLOUD) EXECUTOR

**`RUN4_PREREGISTRATION_FROZEN`** · **`RUN4_NOT_EXECUTED`** · **`MODEL_CALLS_THIS_ROUND = 0`**
`PHASE_1_NOT_AUTHORISED` · `CHARACTEROS_UNMODIFIED` · `PACKAGES_UNMODIFIED`

Frozen before run-4's first scientific call. Machine-readable constants live in
[`contract-run4.ts`](contract-run4.ts); the executor condition and its changed/unchanged declaration
live in [`EXECUTOR_SWAP_AMENDMENT.md`](EXECUTOR_SWAP_AMENDMENT.md).

---

## 1. WHAT RUN-4 IS

The **same** Phase-0 REV2 protocol — same trajectories, same valence table, same target proposition,
same scorer, same predicate, same invalid policy, same evidence-hierarchy ceiling — executed on the
**swapped executor** with **fresh subject identities**.

| | run-1 / run-3 | run-4 |
| --- | --- | --- |
| executor | `qwen3.5:9b` (Ollama native) | `deepseek-flash` (`api.deepseek.com`) |
| subject A / B | `subject-k7q2-4103` / `subject-k7q2-8267` | `subject-r4h6-2903` / `subject-r4h6-7514` |
| in-run qualification subject | `subject-q0v8-3319` | `subject-r4q7-6128` |
| science | REV2 contract | REV2 contract, reused by reference |
| verdict | `..._INCONCLUSIVE` (frozen) | not yet produced |

## 2. WHY IT IS WORTH RUNNING, AND WHAT IT COSTS

The local executor produced, twice and byte-identically, a semantic contract rejection
(`PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance`) that cannot be enforced at
generation time on that provider (`CONSTRAINED_OUTPUT_CANNOT_FAITHFULLY_ENFORCE_REPRODUCED_FAILURE_CLASS`).
The swap is the operator's selected response. Readiness and the contract qualification have both
passed on the swapped condition — but the qualification used a **non-target** fixture, so it does not
establish that the swapped executor survives the **scientific** request. Run-4 is the only thing that
can answer that.

This is a **measurement**, not a mechanism. Nothing in CharacterOS changes.

## 3. THE IN-RUN QUALIFICATION TURN IS A GATE, AND IT IS NOT ENOUGH ON ITS OWN

The frozen schedule begins with one non-target qualification turn, and a failure there stops the
round. But the frozen evidence shows that gate is **weak**: run-1's own
`qualification.json` records `turn_status: COMPLETE` and `lawful_terminal_observed: true` — the local
executor passed it, and then failed at `B:turn_2`. A passing qualification turn therefore does **not**
certify the rest of the run.

That is recorded here so no reader treats a passed qualification as a prediction of run-4's outcome.
The complement — a multi-turn non-target qualification — has already been run separately
(`cloud-qualification.ts`, REV2, 6/6, 0 reproductions of the failure class) and is the stronger signal
available before the science.

## 4. BUDGET

```
schedule        1 qualification turn + 5 arm A turns + 5 arm B turns = 11 turns
ceiling         66 model calls  (P0_MAX_TOTAL_MODEL_CALLS, reused from ../contract.ts)
run-1 measured  39 calls for the same shape
```

Executor-swap overhead already spent and **not** part of this budget: 1 readiness identity request,
3 readiness probes, 6 REV1 qualification turns, 6 REV2 qualification turns. None of those is
scientific evidence.

## 5. STOP RULES

1. The qualification turn is a pre-flight gate. A failure stops the round before any scientific turn.
2. Any scientific turn that does not reach `COMPLETE` makes the run `INCONCLUSIVE`. **No retry, no
   substitution, no extension.**
3. The frozen schedule runs exactly once, in the frozen order. The turn count is never adjusted while
   running.
4. Pre-state and post-state are frozen with `scored: false` and hashed **before** the scorer runs, and
   scoring is a separate program.
5. Once the first scientific call is made, no request, prompt, scorer, predicate, timeout, budget or
   generation setting may change.

## 6. WHAT THE LEAKAGE AUDIT MUST STILL PROVE

`executed_leakage` now forbids **both** the fresh identities and every consumed one
(`P0_RUN4_FORBIDDEN_INHERITED_IDS`: `subject-k7q2-4103`, `subject-k7q2-8267`, `subject-q0v8-3319`,
`subject-qcf-5213`, `subject-qcf-7748`). The mapping from arm to identity travels with the run; the
offline suite proves the audit is **deaf** without it, which is the failure this parameterisation
exists to prevent.

## 7. OUTCOMES, AND WHAT EACH ONE MEANS

| outcome | token | meaning |
| --- | --- | --- |
| positive | `LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED` | lived evidence moved canonical credence in the preregistered directions, differently for two identically-initialised subjects. Evidence hierarchy `L1 -> L2`. |
| `FAILURE_A` | `HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED` | the link Experience → State is not demonstrated on this condition. The round ends; the pre-named rescues are forbidden. |
| inconclusive | `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE` | an engineering failure was correctly attributed. **Not** a scientific null. |

**`L2` does not mean “history internalization works.”** The frozen meaning is exactly: lived experience
changes canonical state. `L3` (the change alters cognition in a new scenario with the raw history
absent) remains untested by run-4.

## 8. FORBIDDEN CLAIMS

The standard ceiling applies unchanged, plus (`P0_RUN4_FORBIDDEN_CLAIMS`):

```
run-4 is comparable to run-1 or run-3
the local executor was the cause of the earlier inconclusive runs
the D1 null is overturned or re-opened
the swapped executor is contract-compliant in general
```

Run-4's result is **executor-conditional**: a statement about CharacterOS with `deepseek-flash`.
Run-1 and run-3 are frozen and untouched; D1 is frozen and untouched.

## 9. WHAT RUN-4 DOES NOT AUTHORISE

No `PHASE_1`. No `PHASE_0` mechanism change. No production or `packages/` change. No re-opening of the
belief micro-line's `DEFERRED_LOCALIZATION_HYPOTHESES`. No claim about the model's internal
dispositions: the LLM is an executor, the subject is the state.
