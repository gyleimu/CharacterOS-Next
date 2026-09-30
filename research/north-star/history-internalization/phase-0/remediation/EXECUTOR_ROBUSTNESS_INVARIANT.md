# EXECUTOR ROBUSTNESS INVARIANT

**Frozen before the fix was implemented.** 0 model calls. `packages/` unmodified.

---

## 1. THE INVARIANT

> **A rejected executor response must not leave the subject/session in a partially consumed state
> that makes an otherwise valid subsequent turn structurally impossible.**

Formally, for every turn `T` on session `S`:

```
T fails closed  →  S is either
                     (a) returned to a well-defined post-failure state, or
                     (b) explicitly and observably marked as requiring recovery,
                   and in NEITHER case does a subsequent VALID turn fail for a reason
                   unrelated to its own content.
```

The objective is **fail-closed without session poisoning**. It is explicitly **not** "make the
failed trial succeed".

## 2. WHAT THE ARCHITECTURE CHOSE

The runtime implements branch **(b)**, and its FAILED branch states the obligation on the host:

> *"Fail closed: no index advance, no fabricated delivery. The host must surface this and stop, or
> restore the last durable snapshot."*

That choice is lawful under §1 **provided the host honours it**. It was not honoured, because the
obligation is not discoverable from the API and its violation reports a misleading cause.

## 3. THE REMEDIATION (R1)

`recovered-session.ts` — a host-layer wrapper. It changes no production code.

| obligation | implementation |
| --- | --- |
| snapshot the recovery point before each turn | `snapshot()` before `submitUserText`; a genesis session has no committed bundle, so its recovery point is genesis, reproducible from the same options |
| surface the FAILED condition | every FAILED turn sets `requiresRecovery` and a `recoveryReason` naming the turn and its failure |
| never send a turn into a poisoned session | under `STOP`, later turns return `REFUSED_SESSION_REQUIRES_RECOVERY` locally and **no provider call is made** — the misleading ingress-CONFLICT cascade is structurally unreachable |
| return to a usable state | under `RESTORE_AND_CONTINUE`, restore the pre-failure snapshot (or genesis) and proceed |
| never hide the loss | the discarded turn is recorded; a recovered run never looks uninterrupted |

## 4. WHAT IS EXPLICITLY OUT OF SCOPE

### R2 — schema-constrained decoding: AVAILABLE, NOT APPLIED

The capability exists in the production stack and this was confirmed mechanically:

- `ModelTransportRequestV0` carries `structured_output?: ModelJsonSchemaConstraintV0`
  (`packages/runtime/src/transports/model-transport.ts:78`);
- `OllamaNativeCognitionTransportV0` maps it to Ollama's native `format` field
  (`packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts:235-238`),
  i.e. **grammar-constrained decoding**, and *"Requests without a constraint retain the prior
  byte-identical wire shape."*

**It is NOT applied to the rerun, deliberately.** Adding a decoding constraint changes the executor's
wire bytes relative to run-1, and §18's invariance ideal (`trajectory_changed = false`,
`scorer_changed = false`, `scientific_predicate_changed = false`, `invalid_policy_changed = false`,
`belief_semantics_changed = false`) is worth more than a higher pass probability. It is recorded as
an available, fully-specified option the operator may elect; applying it would make the rerun a
*different-conditions* replication and must be declared as such.

### R3 — deterministic semantics-preserving normalisation: NOT APPLICABLE

The authoritative response contract defines **no** unique, semantics-preserving canonicalisation from
"`PRIMARY_STANCE` with no selected stance" to a valid proposal. There is nothing to normalise. The
condition is a genuine contract violation.

### R4 — semantic guessing / prompt rescue: FORBIDDEN, NOT ENTERED

No `subjective_selection` is invented, no missing field is inferred, no stance is copied, no
malformed payload is silently mapped onto a valid one. The regression test asserts this: the invalid
turn stays `FAILED` and exposes no fabricated behaviour.

## 5. TRANSACTIONAL INTEGRITY AUDIT (§15)

What a failed turn leaves behind, measured on the reproduction:

| property | observed | disposition |
| --- | --- | --- |
| partial subject-state mutation | **YES** — revision advanced 6 → 10 across the failing turn | lawful and documented; the FAILED branch explicitly does not undo pre-cognition canonical work. It is **not** silent: the turn record carries `state_revision_before/after` |
| partial belief commit | **NO** — the failing turn never reached the belief adaptation step (belief-semantic ran 8× for 11 turns) | belief semantics untouched by this failure mode |
| dangling ingress ownership | **YES** — the `turn-<index>` ingress record is consumed and retained | this is the poisoning mechanism; recovery restores the pre-failure ledger |
| revision corruption | **NO** — revisions advance monotonically; no gap or reuse observed | — |
| duplicated evidence | **NO** in run-1 (no turn ran twice) | recovery re-runs a turn from a restored state, so it must be recorded as a recovered step, never as an extra observation |
| stale pending transaction | **NO** — `pending_lifecycle_work` returned to 0 | — |
| session lock retention | **NO** — no lock is held; the retained artefact is a durable ledger record | — |
| next-turn identity conflict | **YES** — the observed CONFLICT | **fixed by R1** |

**Failure metadata that legitimately persists:** the turn outcome record
(`status`, `failure`, `state_revision_before/after`, `logical_time_before/after`, capture of the raw
executor response), and the canonical writes that preceded cognition. Both are intentional and are
preserved so a failed turn is auditable rather than silent.

## 6. SCIENTIFIC POLICY IS A SEPARATE LAYER (§8)

This invariant governs **engineering continuity only**.

```
runtime can continue after a rejected turn   ≠   the scientific run may count it
```

The History Internalization protocol is unchanged and remains, as a hard gate:

```
any required invalid trial  →  the current scientific run is INCONCLUSIVE
```

No retry, no event replacement, no removal of the invalid trial, no trajectory extension, and no
counting of later turns toward the failed run's positive predicate. **Engineering continuity is not
scientific evidence recovery.**

## 7. WHY THIS IS THE MINIMAL FIX

The failure had two layers; only one of them is repairable without changing semantics, and it is the
one that converted a single bad response into three lost turns. The runtime's disposition is
deliberate and documented; the missing piece was the host that honours it. Fixing that piece touches
no belief semantics, no credence law, no threshold, no trajectory, no scorer and no invalid policy —
and it is verified by a regression that also proves the *baseline* defect is real.
