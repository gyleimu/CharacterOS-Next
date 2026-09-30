# HISTORY_INTERNALIZATION_V1 — PHASE0_RUN3 REPORT

**`HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE`**
**`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`** · **`EVIDENCE_LEVEL = L1`**

Run-3 was executed through the real production runtime with a healthy machine and the frozen design.
It ended at **A:turn_1**, where the executor produced a response the frozen contract rejects. The run
stopped there. The question this round asked — *does controlled lived experience enter the persistent
canonical belief state?* — **remains open and unanswered**, because the executor did not let the
trajectory finish.

---

## 1. WHAT HAPPENED

| turn | status | revision | belief adaptation |
| --- | --- | --- | --- |
| A:turn_0 (shared opening) | COMPLETE | 0 → 7 | `COMPLETE_COMMITTED`, 0.55 → 0.60 |
| **A:turn_1** | **FAILED** | 7 → 11 | not reached |

```
CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED:
SEMANTIC_COMPLETENESS_FAILED: conversation proposal.response_semantics:
PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance
```

By the frozen policy the run ended immediately: the other arm was **not** finished, no post-state was
frozen, and nothing was scored.

## 2. THE EXECUTOR DEFECT REPRODUCED — BYTE-IDENTICALLY

This is the **same** failure that ended run-1, on a **different subject, different arm, different turn
index**, with a byte-identical error string. Failure Class A (`EXECUTOR_SCHEMA_INVALID`) is therefore
**reproducible**, not an artefact of one subject or one trajectory position. It remains
`UNFIXED_MODEL_RELIABILITY_RISK`, exactly as the remediation round declared.

## 3. THE REMEDIATION WORKED — AND THAT IS WHY THIS RECORD IS CLEAN

In run-1, that single failure produced **two additional spurious failures** — `session: ingress must
record (CONFLICT)` — because the un-advanced turn index reused `turn-<index>`. The record showed three
failures where only one was real, and named the wrong subsystem.

In run-3:

```
invalid scientific turns = 1        (not 3)
extra spurious failures  = 0
other arm finished       = false
post-state frozen        = false
```

Class B (session poisoning) **did not occur**. The host layer surfaced the failure truthfully and the
run stopped cleanly. The remediation converted a three-failure cascade into a single,
correctly-attributed failure — the difference between a record you can reason from and one you cannot.

## 4. A HYPOTHESIS, RECORDED BUT NOT CLAIMED

Both observed Class A failures occurred on turns whose evidence contains a **commitment outcome**;
turns without one completed normally (3 such turns across runs, 0 failures).

That is **n = 2, pooled across two runs with different subjects and arms.** It cannot separate *"the
outcome content invites a stance-shaped reply"* from *"the executor intermittently produces this shape
on any rich turn."* No rate is claimed and no denominator is asserted.

It is recorded because **if it were true, the failure preferentially strikes the very turns that carry
the treatment evidence** — which matters for any future attempt. A future pre-registration should test
it deliberately rather than rediscover it. It authorises no change to the trajectory, wording,
ordering, proposition, model or prompt.

## 5. §24 EXACT ACCOUNTING

```
scientific_subject_turns_planned   = 10
scientific_subject_turns_executed  = 2
scientific_subject_turns_valid     = 1
invalid_scientific_turns           = 1

non_scientific_runtime_operations  = 1        (bootstrap; scientific_turn = false)

provider_attempts_total            = 10
  cognition_attempts               = 3
  language_attempts                = 2
  appraisal_attempts               = 3
  belief_semantic_attempts         = 2
  families sum to total            = true
invalid_provider_attempts          = 0
```

The four units — scientific subject turn, runtime operation, provider attempt, bootstrap operation —
are never merged into one `turns` field.

## 6. §25 EVIDENCE SEPARATION

The run-3 dataset contains **no** run-1 call, run-1 state, run-1 partial observation, run-2 bootstrap
failure or readiness probe. Those are provenance evidence only.

## 7. §2 AUTHORIZATION AND §3/§4 FRESH SUBJECTS

The pre-execution authorization audit passed before any scientific operation: gate-3 verdict PASS,
gate-3 request hash `00339f4a…` unchanged, provider identity unchanged, run-1 artifacts byte-identical
(27 files), run-2 closure unchanged, production tree clean at `02b6c46e`. A drift would have stopped
the round at 0 scientific turns.

Fresh subjects `subject-r3-7p4n-2185` / `subject-r3-7p4n-9047` under
`MODEL_VISIBLE_SUBJECT_ID_POLICY = OPAQUE_NON_SEMANTIC` — same stem, opaque suffix, no arm letter, arm
mapping only in experiment-side metadata. `RUN3_INITIAL_STATE_EQUIVALENCE_AUDIT.json`: canonical
scientific state **equivalent** after identity strip, raw objects **unequal** (so the parity check can
fail), target proposition id and credence equal.

## 8. §5/§7/§9–§11 FROZEN DESIGN AND PROVIDER

The trajectory, `VALENCE_TABLE`, wording, ordering, five turns per arm, proposition, baseline
credence, predicted directions, scorer, invalid policy and stop rule are the frozen ones. Run-1's
partial observations influenced nothing. Provider frozen: Ollama · `qwen3.5:9b` · same digest · same
transport, context, decoding and 120 s timeout · no structured-output constraint · no fallback. Every
turn went through the real production runtime — no authored credence, no manual belief write, no state
patching between turns. The same-turn isolation law was respected.

## 9. §12–§15 STOP-ON-FIRST-INVALID AND QUARANTINE

On the invalid turn the run: persisted the failing artifacts, froze diagnostic state, marked
`subject-r3-7p4n-2185` as `SCIENTIFICALLY_QUARANTINED_AFTER_INVALID_TURN`, ended the entire scientific
run, and did **not** finish the other arm. The quarantined state appears only in
`RUN3_DIAGNOSTIC_STATES.json` — never the post-state endpoint, state delta, divergence, scorer or
restart evidence.

No interim scientific interpretation was formed before all ten turns completed, and none was formed
after: a single valid turn (A:turn_0, the shared opening, byte-identical in both arms) carries no
arm-differing evidence and can never support a between-arm claim.

## 10. §16–§19 POST-STATE, DATASET AND SCORER

No post-state was frozen, because the endpoint is only defined when all ten required turns are valid.
`PHASE0_RUN3_DATASET.json` was written with `scored: false` and hashed; the scorer detected
`all_required_turns_valid = false`, **refused to score**, and emitted the frozen inconclusive token.
The belief-only endpoint was never reached; affect and relationship were recorded descriptively and
determined nothing.

## 11. §28 FINAL STATE

```
run-1   HISTORY_INTERNALIZATION_V1_INCONCLUSIVE
run-2   NOT_STARTED / BLOCKED
gates   FAIL · FAIL · PASS
run-3   INCONCLUSIVE — 1 invalid scientific turn, executor Class A, no cascade
EVIDENCE_LEVEL = L1
HISTORY_INTERNALIZATION_PHASE_1 = NOT AUTHORISED
CHARACTEROS_CORE_SEMANTICS = UNMODIFIED
```

## 12. WHAT STANDS BETWEEN US AND THE ANSWER

Only one thing: **the executor intermittently produces a response shape the frozen contract rejects,
and it is doing so on the turns that carry the treatment evidence.** The CharacterOS side of the chain
is not the blocker — the belief adaptation chain committed on every turn that reached it, in run-1 and
in run-3.

That is an executor-reliability problem, and both available answers to it — grammar-constrained
decoding (already available in the stack, deliberately unapplied) or a different executor — change the
experimental conditions and therefore need an explicit decision. **No run-4 this round. STOP.**
