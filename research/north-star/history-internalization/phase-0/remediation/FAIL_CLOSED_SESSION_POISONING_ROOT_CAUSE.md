# FAIL-CLOSED SESSION POISONING — ROOT CAUSE

**0 model calls. Reproduced, not inferred.** Evidence: `PHASE0_RUN1_REPRODUCTION.json`,
`PHASE0_RECOVERY_PROBE.json`, `remediation.test.ts`.

---

## 1. THE CHAIN, MECHANICALLY RECONSTRUCTED

Everything below was reproduced with stub transports against the real runtime before the code was
read for causes. `reproduce.ts` drives it deterministically.

```
B turn 2
  ↓ executor emits response_semantics.kind = PRIMARY_STANCE
    while subjective_selection.kind = NO_SUBJECTIVE_SELECTION
  ↓ conversation-cognition-proposal.ts:1909
    "PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance"
  ↓ CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED / SEMANTIC_COMPLETENESS_FAILED
  ↓ the response is rejected and the turn THROWS
  ↓ interactive-subject-runtime-v0.ts:768 catch block
    builds a status="FAILED" outcome with `failure: TURN_FAILED_CLOSED: …`
    and — deliberately, per its own comment — does NOT advance this.turnIndex
  ↓ consequently the ingress event for `turn-2` remains recorded, and the
    canonical writes that preceded cognition (time advance, factual-event admission,
    observable-context commit, appraisal) remain committed: state_revision 17 → 21
B turn 3
  ↓ submitUserText computes index = this.turnIndex = 2  (unchanged)
    and sourceEventId = "turn-2"                        (unchanged)
  ↓ explainable: the source event id is a pure function of the unadvanced index
  ↓ admitFactualEvent("turn-2", …) → ingressLedger.recordIngressEvent({source_event_id:"turn-2"})
    → kind = CONFLICT   (that id is already recorded)
  ↓ explicit-v4-session-authority-v0.ts:798
    throw new Error(`session: ingress must record (CONFLICT)`)
  ↓ caught by the same catch block → turn 3 reported FAILED, blaming the ingress
B turn 4
  ↓ identical: index still 2, same id, same CONFLICT. The session never recovers.
```

Reproduced observations (all eight hold):

| observation | result |
| --- | --- |
| turn 0 (valid) passed | yes |
| turn 1 (semantically incomplete) failed closed | yes |
| the failure is the schema/semantics rejection | yes |
| the failed turn did **not** advance the turn index | yes |
| the failed turn **did** advance canonical state (rev +4) | yes |
| the next **valid** turn was rejected at ingress | yes |
| it reused the same `source_event_id` | yes |
| the poisoned next turn reproduced | yes |

## 2. ANSWERS TO THE BRIEF'S SPECIFIC QUESTIONS

| question | answer |
| --- | --- |
| which function consumed the ingress? | `ExplicitV4SessionAuthorityV0.admitFactualEvent` (`:781`) via `ingressLedger.recordIngressEvent`, called early in `submitUserText` (`:515`) |
| which advanced the revision? | the pre-cognition canonical work of the same turn: time advance, factual-event admission, observable-context commit and the appraisal/affect lifecycle. Measured: revision 6 → 10 on the failing turn |
| which persisted partial state? | the same committed canonical bundles. They are **not** rolled back |
| which retained transaction ownership? | nothing holds a lock — the ingress **ledger record** is the retained artefact. It is durable session state, so a re-used `source_event_id` is permanently poisoned for that session |
| which failed to roll back? | the FAILED branch. By design: its comment says *"Fail closed: no index advance, no fabricated delivery."* |
| which caused the next-turn CONFLICT? | the combination of (a) the un-advanced index, (b) `sourceEventId = \`turn-${index}\``, and (c) the durable ingress record |

## 3. TWO FAILURE CLASSES — KEPT SEPARATE

### FAILURE CLASS A — `EXECUTOR_SCHEMA_INVALID`

The model's output violates the frozen response-semantics contract. In run-1:

```
CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED:
SEMANTIC_COMPLETENESS_FAILED: … PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance
```

**Nature:** model reliability. **Is it fixed here?** No — and it must not be fixed by inventing the
missing field (§9). **Is it affected by this round's remediation?** No.

**A first reproduction attempt did NOT reproduce this** and the reason matters: deleting the
`subjective_selection` **key** trips the *structural* schema check first
(`CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID: unexpected keys`) and routes to the **DEGRADED**
branch — which *does* advance the index and is not poisonous. Only the structurally-valid but
semantically-incomplete shape reaches the FAILED branch. So "the model produced a bad response" is
not one condition but at least two, on two different code paths with two different outcomes.

### FAILURE CLASS B — `SESSION_POISONED_AFTER_FAIL_CLOSED`

A **lawful** fail-closed leaves the session unable to accept an otherwise valid, independent turn.
**Nature:** transactional robustness. **Is it fixed here?** Yes — see §5.

The two must never be collapsed into "executor failed". A is a model problem; B is an architecture
problem, and B is the one that turned one bad response into three lost turns.

## 4. WHAT IS *NOT* WRONG

- **The FAILED branch is not a bug.** Its comment documents the contract precisely: *"The host must
  surface this and stop, or restore the last durable snapshot."* The behaviour is intentional and
  correct.
- **The DEGRADED branch shows the authors knew the exact hazard.** Its comment: *"Leaving the index
  behind would make the NEXT message reuse the same source event id and fail closed with an ingress
  CONFLICT — i.e. a 'graceful' degradation that permanently bricks the subject."* They handled it
  for DEGRADED and chose the opposite disposition for FAILED — legitimately, because a FAILED turn
  has no committed delivery and the host is expected to intervene.
- **The recovery path works.** Measured: `PHASE0_RECOVERY_PROBE.json` →
  `DOCUMENTED_RECOVERY_PATH_WORKS`. Restoring the durable snapshot taken before the failing turn
  yields a session that accepts the next valid turn (`completed = true`), while the unwrapped
  session rejects it (`completed = false`).

## 5. THE ACTUAL DEFECT, STATED PRECISELY

> The contract is real, correct and **recoverable**. It exists only in a source comment. Nothing
> enforces it, nothing surfaces it, and violating it produces a **misleading** failure: a valid turn
> reports `session: ingress must record (CONFLICT)`, which names the ingress and not the real
> condition — "this session needs recovery".

That is why Phase 0's harness (the host) walked into it: the documented obligation was invisible to
the caller, and the symptom pointed at the wrong subsystem.

## 6. WHY THE FIX IS AT THE HOST LAYER

The minimal remediation is **not** to change the runtime's fail-closed disposition — that would
alter a deliberate, documented production semantic, and it would not roll back the partial canonical
writes either. It is to supply the host layer the contract assumes: snapshot before each turn,
detect the FAILED condition, and either refuse locally with a truthful condition or restore. See
`EXECUTOR_ROBUSTNESS_INVARIANT.md` and `recovered-session.ts`. **`packages/` is unmodified.**
