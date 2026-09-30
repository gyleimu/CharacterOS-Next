# PHASE 0 EXECUTOR ROBUSTNESS REMEDIATION — REPORT

**`PHASE0_EXECUTOR_ROBUSTNESS_REMEDIATION_COMPLETE`** · **`PHASE0_RERUN_IMPLEMENTATION_AUTHORISED`**
**`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`** · **`CHARACTEROS_CORE_SEMANTICS_UNMODIFIED`**
**`SCIENTIFIC_MODEL_CALLS_THIS_ROUND = 0`**

| | |
| --- | --- |
| round nature | **necessary infrastructure remediation** — not a scientific experiment |
| model calls | **0** (no scientific call, no real provider call) |
| production code | **unmodified** — `packages/` clean at `02b6c46e` |
| run-1 | hash-frozen, 27 files, verdict `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE`, immutable |
| evidence hierarchy | **L1** — unchanged |
| rerun | **authorised for implementation, not executed** |

---

## 1. WHAT WAS WRONG

Phase 0's arm B lost three of five turns. The cause was **two** defects, not one, and they must not
be merged into "executor failed":

- **Class A — `EXECUTOR_SCHEMA_INVALID`.** The executor emitted
  `response_semantics.kind = PRIMARY_STANCE` while `subjective_selection.kind` remained
  `NO_SUBJECTIVE_SELECTION`, violating the frozen contract at
  `conversation-cognition-proposal.ts:1909`. A **model-reliability** condition. **Not fixed** — fixing
  it by inventing the missing field is forbidden.
- **Class B — `SESSION_POISONED_AFTER_FAIL_CLOSED`.** The lawful fail-closed left the session unable
  to accept the next valid turn. A **transactional-robustness** condition. **Fixed.**

Class B turned one bad response into three lost turns. That is what this round repaired.

## 2. THE REPRODUCTION CAME FIRST — AND FAILED THE FIRST TIME

`reproduce.ts` drives the real runtime with stub transports. The first attempt **did not reproduce**
run-1, and the reason became the round's most useful finding: deleting the `subjective_selection`
**key** trips the *structural* check and routes to the **DEGRADED** branch, which advances the turn
index and is harmless. Only the structurally-valid-but-semantically-incomplete shape reaches the
**FAILED** branch.

So "invalid executor response" is at least two conditions on two code paths with two different
post-turn session states — and only one is poisonous. Had the reproduction been skipped, the
root-cause document would have named the wrong mechanism. After correcting the shape to the
contract-derived one, **all eight observations reproduced**.

## 3. THE ROOT CAUSE, EXACTLY

```
FAILED branch does not advance this.turnIndex   (deliberate, documented)
  + sourceEventId = `turn-${index}`
  + the ingress record for that id is durable
  ⇒ the next turn re-admits `turn-<index>`, gets CONFLICT, and is blamed on the ingress
```

The FAILED branch's own comment documents the obligation — *"The host must surface this and stop, or
restore the last durable snapshot"* — and the DEGRADED branch's comment shows the authors knew the
hazard precisely. **The contract is correct. The recovery path works** (measured:
`DOCUMENTED_RECOVERY_PATH_WORKS`). What did not exist was anything that enforces or surfaces it, and
violating it produced a failure that named the wrong subsystem.

## 4. THE FIX

`recovered-session.ts` — a host-layer wrapper that supplies what the contract assumes: snapshot the
recovery point before each turn; surface a FAILED turn as `SESSION_REQUIRES_RECOVERY`; never send a
turn into a poisoned session; under `RESTORE_AND_CONTINUE`, restore and proceed; never hide a
discarded step.

Chosen over the alternative of changing the runtime's fail-closed disposition, which would alter a
deliberate production semantic and would not roll back the partial canonical writes either. **No
production code was touched.**

## 5. REGRESSION

Four tests, 0 model calls, all passing:

| test | pins |
| --- | --- |
| BASELINE | the defect is real: an unwrapped session produces the misleading ingress `CONFLICT` |
| FIXED (STOP) | the invalid turn stays invalid and fail-closed; the next turn is refused locally with no provider call |
| FIXED (RESTORE_AND_CONTINUE) | the third turn reaches its normal execution path — the required VALID / INVALID / VALID sequence |
| NO COERCION | the invalid turn exposes no fabricated behaviour and no upgraded commit |

## 6. R2 WAS AUDITED AND DELIBERATELY NOT APPLIED

Grammar-constrained decoding **is** available in the production stack:
`ModelTransportRequestV0.structured_output` → Ollama's native `format`
(`ollama-native-cognition-transport.ts:235-238`), with unconstrained requests keeping their prior
byte-identical wire shape.

It is **not applied**, because adding a decoding constraint changes the executor's wire bytes
relative to run-1, and §18's invariance ideal is worth more than a higher pass probability. It is
specified in `EXECUTOR_ROBUSTNESS_INVARIANT.md §4` as an option the operator may elect, with its
consequence stated: the rerun would become a different-conditions replication.

## 7. THE AFFECT CORRECTION, WITH REAL PROVENANCE

The previous round's correction has now been traced to a **producer function → transition → durable
write** chain: `completePendingLifecycleWork()` → appraisal provider →
`affectWriter.applyForEvent()` (`explicit-v4-session-authority-v0.ts:687`, constructed at `:402`) →
`CanonicalAffectApplicationExecutorV0` → canonical affect commit.

- **`EXPERIENCE_TO_AFFECT_WIRED` = true**, route `TURN_LIFECYCLE_APPRAISAL_TO_AFFECT_APPLICATION`.
- **`DEDICATED_EXPERIENCE_TO_AFFECT_ADAPTER_WIRING_UNRESOLVED`** — there is **no** dedicated
  episode-ref-fed adapter for affect, unlike belief and relationship. Claiming one would conflate two
  different mechanisms.

## 8. THE EXACT LEDGER

`PHASE0_RUN1_EXECUTION_LEDGER.json`: **39 attempts, reconciled exactly** with the runtime tally —
cognition 9, language 8, appraisal 14, belief-semantic 8 — with the four "why" questions answered
numerically rather than approximately.

One honest gap: run-1 recorded payloads for only two of the four families, so its **appraisal**
attempts have an exact total but **no per-turn attribution, permanently**. That is reported as
unavailable rather than guessed, and the instrumentation that caused it is **fixed** — verified by
20/20 smoke checks including per-family coverage, turn labels and request hashes.

## 9. WHAT THIS ROUND DOES NOT DO

- It does **not** make the invalid turn valid. The scientific invalid policy is unchanged: any
  required invalid trial ⇒ `INCONCLUSIVE`.
- It does **not** authorise Phase 1.
- It does **not** re-run Phase 0. A rerun is authorised **for implementation** only; executing it is
  a separate decision.
- It does **not** re-open, strengthen or re-word anything to obtain a positive. Run-1's observation
  that arm A committed five times and arm B produced `CONTRADICTS` is recorded and must not inform a
  single character of the rerun.

## 10. RESIDUAL RISK

Class A is unfixed. A rerun can hit it again, and the scientific policy will then return
`INCONCLUSIVE` again. What changed is the consequence: the run now stops cleanly at the failing turn
with a truthful condition, instead of burning three turns and reporting a misleading cause.
