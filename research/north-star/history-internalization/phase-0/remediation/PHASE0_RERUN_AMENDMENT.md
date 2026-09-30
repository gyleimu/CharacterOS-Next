# PHASE 0 RERUN AMENDMENT

**Frozen before any rerun.** The amendment authorises implementation of a rerun; it does **not**
execute one. `SCIENTIFIC_MODEL_CALLS_THIS_ROUND = 0`.

---

## 1. RUN-1 IS UNCHANGED AND STAYS INCONCLUSIVE

```
PHASE0_RUN1_VERDICT = HISTORY_INTERNALIZATION_V1_INCONCLUSIVE      (frozen, immutable)
DESCRIPTIVE = LIVED_EXPERIENCE_TO_CANONICAL_BELIEF_COMMIT_OBSERVED_IN_PARTIAL_RUN
```

Run-1 is hash-frozen (`PHASE0_RUN1_FREEZE.json`, 27 files). It must never be overwritten,
"repaired", relabelled, or mined for a positive. The following labels remain **forbidden** for it:

```
LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED
HISTORY_INTERNALIZATION_ESTABLISHED
```

## 2. THE INFRASTRUCTURE DEFECT THAT WAS FOUND AND FIXED

A lawful fail-closed left the session unable to accept the next valid turn: the FAILED branch does
not advance the turn index, so the next turn reused `turn-<index>` and died at ingress with a
misleading `CONFLICT`. Full chain in `FAIL_CLOSED_SESSION_POISONING_ROOT_CAUSE.md`; reproduced in
`PHASE0_RUN1_REPRODUCTION.json`; fixed by `recovered-session.ts`; regression in
`remediation.test.ts` (4 tests, all passing).

## 3. EXACT CODE CHANGE

**Production code: NONE.** `packages/` is unmodified at `02b6c46e`.

Changed, all outside `packages/`:

| file | change | kind |
| --- | --- | --- |
| `phase-0/remediation/recovered-session.ts` | new host wrapper enforcing the runtime's documented contract | new host code |
| `phase-0/remediation/remediation.test.ts` | new regression | test |
| `phase-0/harness.ts` | `instrumentPhase0BundleV0` records every provider attempt of every family with a turn label, request hash and result status | **instrumentation only** |
| `phase-0/execute.ts`, `phase-0/smoke.ts` | call the instrumentation | instrumentation only |
| `vitest.config.ts` | include the new remediation test directory | test wiring |

The only change that touches what a scientific turn does is the instrumentation, and it is a
**passive recorder**: it forwards the request object untouched, adds no field to any prompt, and
makes no decision. Verified by 20/20 smoke checks including
`every_attempt_carries_a_turn_label`, `every_attempt_carries_a_request_hash` and
`attempt_sequence_numbers_are_dense`.

## 4. INVARIANCE DECLARATION

| question | answer |
| --- | --- |
| `trajectory_changed` | **false** — the same frozen `VALENCE_TABLE`, the same turn texts, the same turn count |
| `scorer_changed` | **false** — `scorePhase0V0` is untouched, still frozen before any call |
| `scientific_predicate_changed` | **false** — `delta_A > 0 AND delta_B < 0 AND credence_A_post != credence_B_post` |
| `invalid_policy_changed` | **false** — any required invalid trial ⇒ `INCONCLUSIVE`; no retry, no replacement, no extension |
| `belief_semantics_changed` | **false** — no credence law, step, threshold or proposition identity touched |
| `model-facing scientific contract changed` | **false** — no prompt text, no schema sent to the model, no anchor, no vocabulary changed |
| `model-facing BYTES changed` | **no** for every scientific request. The instrumentation wraps transports and forwards the request object by reference; the wire bytes are identical. The attempt recorder observes the payload, it does not alter it |
| `provider / model changed` | **false** — production `OllamaBeliefSemanticProviderV0` + `OllamaNativeCognitionTransportV0`, model `qwen3.5:9b` |
| `executor decoding constraint changed` | **false** — R2 (grammar-constrained decoding) is available and **deliberately not applied**; see `EXECUTOR_ROBUSTNESS_INVARIANT.md §4` |

## 5. WHAT THE RERUN MUST DO

### §19 — fresh subjects, always

The rerun **must not** continue from run-1. New subject ids, new sessions, a fresh pair built from
the frozen identical genesis state. Run-1's partial states (arm A at 0.80, arm B at 0.55 with a
failed trajectory) are **evidence only** and must not seed, warm-start, or be compared as a
baseline for the rerun's subjects.

### §20 — the frozen design is reused verbatim

same target proposition and baseline credence · same trajectory A and B texts · same
`VALENCE_TABLE` · same turn count (5 per arm, plus 1 qualification turn) · same scorer · same
positive / null / inconclusive rules · same provider and model.

**Outcome-informed redesign is forbidden.** Run-1 showed arm A committing five times in the
predicted direction and arm B producing `CONTRADICTS` on its first differing turn. That knowledge
must not influence a single character of the trajectory, a single threshold, or the choice of
proposition. No wording may be optimised.

### Session policy for the rerun

`RecoveredSessionV0` with policy **`STOP`**. On the first FAILED turn the arm is terminated locally
with `SESSION_REQUIRES_RECOVERY` and the run is scored `INCONCLUSIVE` — the scientific policy is
unchanged, and the misleading three-turn cascade is gone.

### §3 instrumentation

Every attempt of every family is now recorded with a turn label, family, request hash and result
status, so the rerun's ledger is complete rather than partially attributable as run-1's was.

## 6. COST AND GATE

Frozen budget: 11 turns (1 qualification + 5 + 5). Run-1's measured cost was 39 model calls; a
completed rerun should be comparable, with a ceiling of 66.

The qualification turn remains the pre-flight gate. It is non-target and cannot contribute to the
endpoint; if it fails, the round stops at the measured call count.

## 7. WHAT THE RERUN STILL WILL NOT ESTABLISH

Even a full positive raises the evidence hierarchy **from L1 to L2 and no further**. It would not
show that persistent belief alters cognition in a new scenario with the history removed (L3), that it
alters decision or behaviour (L4, and D1 already measured a null there), that it survives restart
(L5), or that it separates from a summary baseline (L6). It would not show that "history
internalization works".
