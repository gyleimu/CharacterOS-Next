# P2.3.4.2a — REGULATION_V0 Reference Contract

**Status: NORMATIVE FOR REGULATION_V0 REFERENCE IMPLEMENTATION**

**From-scratch principle:** REGULATION_V0 intentionally does almost nothing. That is a feature, not a bug. It gives CharacterOS-Next a deterministic, auditable Regulation baseline without pretending that unvalidated psychology is already known.

**Subordinate to (jointly frozen, read-only authority):**

- `docs/architecture/subjectstate-v0-spec.md` (SubjectState V0)
- `docs/architecture/transition-contracts.md` (Transition Contracts)
- `docs/implementation/p2-1-contract-freeze.md` (P2.1 Contract Freeze)
- `docs/implementation/p2-3-runtime-plan.md` (P2.3 Runtime Plan)
- `docs/implementation/p2-3-4-fast-ema-v0-reference-contract.md` (FAST_EMA_V0 Reference Contract)

This contract specifies ONLY the internal deterministic behaviour of one reference `RegulationProducer` implementation. It does not modify any frozen schema, error code, writable path, ownership tuple, commit protocol, or acceptance oracle.

**Decision driver (P2.3.4.2 correct-HEAD audit):** `REFERENCE_CONTRACT_REQUIRED`.

---

## 1. Core Decision — Identity / State-Preserving Baseline

REGULATION_V0 is the minimal deterministic **IDENTITY / STATE-PRESERVING** reference baseline. Its purpose is engineering conformance only.

For every positive-elapsed TimeTransition:

```text
energy_next  = energy_current
stress_next  = stress_current
arousal_next = arousal_current
fatigue_next = fatigue_current
```

Only canonical time bookkeeping advances:

```text
last_update_next = logical_time_after
```

This is **intentional**. REGULATION_V0 does NOT implement: stress recovery, fatigue recovery, arousal settling, energy regeneration, suppression, reappraisal, inhibition, homeostasis, affect modulation.

**Explicit rationale:** the committed contracts provide Regulation schema, write ownership, TimeTransition participation and atomicity requirements — but provide **ZERO** Regulation-specific dynamics parameters (no frozen recovery rate, decay rate, target value, gain, threshold, cooldown, or coupling coefficient). Therefore REGULATION_V0 MUST NOT invent numeric regulation dynamics.

> Identity dynamics are chosen to minimize uncontracted psychological semantics. This is a reference engineering baseline, not a model of human regulation.

## 2. Non-Scientific Status

REGULATION_V0 **is:**

- deterministic
- replayable
- minimal
- state-preserving
- engineering reference baseline
- replaceable (a different reference producer may supersede it without core-architecture change)

REGULATION_V0 **is NOT:**

- psychological theory
- a homeostasis model
- emotion regulation theory
- biologically plausible dynamics
- evidence of realism
- the final CharacterOS regulation mechanism

Forbidden characterizations: "human-like", "realistic regulation", "psychologically valid" (and equivalents).

## 3. Write Ownership (frozen, unchanged)

```text
producer: "regulation"
domain:   "regulation"
path:     /regulation
```

Output is **one complete `RegulatoryStateV0` replacement** (full `FieldReplacementV0`; no partial writes exist under V0).

REGULATION_V0 MUST NOT write: `/affect`, `/mood`, `/context`, `/memory_state/**`, `/mechanism_config`, identity, traits, beliefs, relationships, runtime metadata, trace window.

SubjectCore remains the sole canonical mutator (Producer != Mutator; freeze §7.1–§7.2; `ownership.ts` binding `("regulation","regulation")`, transitions `["Time","CognitionAction"]`).

## 4. Input Authority — Least Privilege

This contract explicitly closes the audit finding `OVERBROAD_PORT_SURFACE` (P2.3.1 DRAFT port exposing full `SubjectStateV0` without `elapsed_ticks`).

REGULATION_V0 may consume ONLY the information required by the reference rule:

| # | Required semantic input | Source |
|---|---|---|
| 1 | current `RegulatoryStateV0` | authoritative pre-transition snapshot projection |
| 2 | `elapsed_ticks` | canonical Time `time_input` truth |
| 3 | canonical `logical_time_before` | `RuntimeContext.current_logical_time` (read model) |
| 4 | canonical `logical_time_after` | derived, §6 |

If the existing runtime context already provides the canonical time anchors, the later implementation MAY use a **narrow immutable projection** of that context. Normative minimal input shape for the future slice:

```text
RegulationProducerInputV0 (closed) = {
  context: RuntimeContext,          // subject_id / current_logical_time / state_revision
  regulation: RegulatoryStateV0,    // pre-transition authoritative copy
  elapsed_ticks: number             // non-negative safe integer; null is not admissible in Time mode
}
```

It MUST NOT receive or consume the full `SubjectStateV0` merely for convenience.

**Forbidden semantic inputs:** current Affect, current Mood, Appraisal, Context state, MemoryState, MemoryRepository, Retrieval, identity, traits, beliefs, relationships, LLM, wall clock, randomness.

**mechanism_config:** REGULATION_V0 MUST NOT consume `legacy_reference_defaults` (those are FAST_EMA_V0 affect parameters). No regulation-specific config exists in V0 (`mechanism_config.thresholds` / `feature_flags` are frozen zero-key closed objects; any key rejects). **Therefore REGULATION_V0 dynamics are parameter-free.**

## 5. Time Semantics (scope: TimeTransition only)

REGULATION_V0 exists in P2.3.4 only for **TimeTransition**.

- **ObservationTransition MUST NOT invoke REGULATION_V0** (frozen §5.2 Observation required deltas are affect + context; no regulation).
- **CognitionAction:** regulation ownership exists in frozen tables for the future, but REGULATION_V0 P2.3.4 scope does NOT define CognitionAction regulation dynamics → **DEFERRED**. Do not implement during P2.3.4.

**`elapsed_ticks == 0`:** existing TimeTransition durable NO_OP semantics apply (TIME-NOOP-001):

- RegulationProducer **not invoked** (invocation count 0)
- no RegulationDelta, no AffectDelta
- no canonical revision increment, no trace mutation

**`elapsed_ticks > 0`:** REGULATION_V0 is invoked exactly once and emits exactly one valid regulation-domain delta.

## 6. Exact State Equation (normative)

For every positive-elapsed TimeTransition, let `R_t` = current `RegulatoryStateV0`:

```text
energy_next  = energy_current
stress_next  = stress_current
arousal_next = arousal_current
fatigue_next = fatigue_current
```

**No arithmetic transformation is applied to these four scalars.** This is normative for REGULATION_V0.

### last_update bookkeeping

```text
last_update_next = logical_time_after
logical_time_after = logical_time_before + elapsed_ticks
```

per existing TimeTransition authority (transition-contracts §12 time-value three-sources: `logical_time_after` is the derived output; checked safe-integer addition; overflow = canonical `INVALID_LOGICAL_TIME`).

MUST NOT use `Date.now`, system clock, or producer-local counters. **REGULATION_V0 does not derive time independently**; it applies the canonical derivation rule to canonical inputs only.

## 7. Large Elapsed Semantics

REGULATION_V0 has no trajectory equation dependent on elapsed magnitude. Therefore for `elapsed = 1`, `elapsed = 10`, `elapsed = 1_000_000`:

- the four regulation scalars remain **byte-equivalent** to the input values;
- only `last_update` changes, to the canonical `logical_time_after`.

No loops are required merely because elapsed is large (identity is O(1) by construction).

## 8. Numeric Rules

Because the four scalars are state-preserving, REGULATION_V0 MUST NOT:

- clamp a valid input into a different value
- normalize toward a target
- apply epsilon
- round decimals
- add hidden constants

Input must already satisfy frozen `RegulatoryStateV0` validation (`energy/stress/arousal/fatigue ∈ [0,1]`, finite only; freeze §6.3). If producer-facing input is malformed: **fail closed**. Do not silently repair invalid canonical state.

`-0` normalization: values pass through unchanged; normalization to `0` applies only where existing canonical numeric/serialization rules already require it (consistent with FAST_EMA_V0 §12 hygiene). No additional numerical semantics are invented.

## 9. Producer Ordering (P2.3.4 Time semantics)

AffectProducer (FAST_EMA_V0) and RegulationProducer (REGULATION_V0) both conceptually consume the **SAME canonical pre-transition state**.

REGULATION_V0 does NOT consume the same-transition proposed AffectDelta. The current implementation may call producers sequentially for orchestration, but **call order MUST NOT imply causal dependency**:

```text
Affect FAST_EMA_V0 ┐
                   ├── both based on authoritative pre-state
Regulation REGULATION_V0 ┘
                   ↓
          one canonical proposal
                   ↓
             SubjectCore commit
```

## 10. FAST_EMA_V0 Interaction (mutual separation, deliberate)

Frozen for REGULATION_V0:

- **REGULATION_V0 does NOT read Affect or Mood.**
- **FAST_EMA_V0 does NOT read RegulationState** (FAST_EMA_V0 contract §3 input-authority tables contain no regulation fields; the committed implementation reads none).
- **There is NO indirect regulation→affect seam in P2.3.4.** This is deliberate; the seam must not be invented.

Any future mechanism such as "stress modifies affect decay", "fatigue modifies appraisal response", or "regulation suppresses channel intensity" requires a **NEW versioned contract**. Do not smuggle such behaviour into REGULATION_V0.

## 11. Mood Non-Direct-Set (restated, not weakened)

- RegulationProducer has **no `/mood` ownership** (frozen: `/mood` belongs to domain `affect`).
- REGULATION_V0 **cannot emit MoodDelta**.
- FAST_EMA_V0 remains the reference owner of Mood derivation through the committed EMA recurrence.
- **P2.3.4.2 MUST NOT weaken this boundary.**

## 12. Atomicity

For TimeTransition with `elapsed_ticks > 0`, one canonical proposal contains:

```text
Affect domain delta:     /affect + /mood
Regulation domain delta: /regulation
```

Both must commit atomically (one CAS, one revision increment, one TraceEntry).

If REGULATION_V0 fails validation (malformed input, producer exception, invalid delta shape):

- no Affect mutation, no Mood mutation, no Regulation mutation
- no revision increment, no trace append
- **no partial commit** (all-or-nothing; A11/TR-ATOMIC-001 semantics)

## 13. Delta Shape

```text
DomainDeltaV0 {
  producer: "regulation",
  domain:   "regulation",
  expected_repository_revision: null,          // non-memory domain rule (freeze §7.2)
  operations: [
    {
      path: "/regulation",
      value: RegulatoryStateV0 {
        energy:      current.energy,
        stress:      current.stress,
        arousal:     current.arousal,
        fatigue:     current.fatigue,
        last_update: logical_time_after
      }
    }
  ],                                           // exactly one operation
  provenance_refs: []                          // see §14: empty is contract-legal
}
```

Operations obey existing canonical ordering rules (single operation trivially sorted; path literals restricted to the 13 writable paths).

## 14. Version / Provenance

- Do NOT add new SubjectState fields.
- Do NOT change the frozen producer literal `"regulation"` (ProducerName is a closed enum; authorization bindings use the literal).
- REGULATION_V0 version identity is an **ENGINEERING PROVENANCE** concept, carried by:
  - this committed reference contract,
  - implementation identity (reference class/factory naming in the implementation slice),
  - executable conformance tests (§15),
  - Git provenance.
- Do NOT invent a fake `CanonicalRef` merely to encode "REGULATION_V0". If `DomainDelta.provenance_refs` has no genuine authoritative reference object, it **may remain empty** (existing contract permits empty ref arrays).
- Do not weaken reference validation.

## 15. Parameter Provenance Table

| Semantic | Source Class |
|---|---|
| RegulatoryState field ranges `[0,1]` + finite-only | **FROZEN** (freeze §6.3; spec §16) |
| Regulation write ownership (`("regulation","regulation")`, Time/CognitionAction) | **FROZEN** (freeze §7.2; ownership.ts) |
| positive Time requires RegulationDelta | **FROZEN** (p2-3-runtime-plan §5.1) |
| elapsed=0 → durable NO_OP | **FROZEN** (TIME-NOOP-001; transition-contracts §13) |
| energy identity | **REGULATION_V0 REFERENCE POLICY** |
| stress identity | **REGULATION_V0 REFERENCE POLICY** |
| arousal identity | **REGULATION_V0 REFERENCE POLICY** |
| fatigue identity | **REGULATION_V0 REFERENCE POLICY** |
| last_update = logical_time_after | **REGULATION_V0 REFERENCE POLICY** (derivation rule itself FROZEN: transition-contracts §12) |
| Regulation reads Affect/Mood | **FORBIDDEN IN REGULATION_V0** |
| regulation recovery coefficient | **NOT PRESENT / PROHIBITED** |
| regulation decay coefficient | **NOT PRESENT / PROHIBITED** |
| threshold / gain / cooldown | **NOT PRESENT / PROHIBITED** |
| FAST_EMA parameter reuse | **PROHIBITED** |

**No other trajectory-changing numeric literal exists in REGULATION_V0.** Any implementation magic number is a contract violation.

## 16. Conformance Test Requirements (future implementation slice)

| # | Requirement |
|---|---|
| R1 | Determinism: same regulation + same elapsed/time ⇒ byte-identical delta |
| R2 | Identity scalars: positive elapsed ⇒ energy/stress/arousal/fatigue unchanged |
| R3 | last_update: positive elapsed ⇒ exactly `logical_time_after` |
| R4 | elapsed 0: Time executor durable NO_OP ⇒ producer invocation count 0 |
| R5 | elapsed 1: single-tick identity + bookkeeping |
| R6 | large elapsed (e.g. 1_000_000): scalars still unchanged; no loop dependency |
| R7 | boundary values: `0` / `1` / `0.5` preserved exactly |
| R8 | malformed input (NaN / Infinity / out-of-range / wrong shape) ⇒ fail closed, no delta |
| R9 | no mutation: input RegulatoryState bytes unchanged (deep-frozen input survives) |
| R10 | least privilege: producer input does not expose full SubjectState (closed narrow input shape) |
| R11 | forbidden access: zero access to Affect / Mood / Context / Memory / Retrieval / LLM / wall clock |
| R12 | atomic Time integration: real FAST_EMA_V0 + real REGULATION_V0 ⇒ exactly one canonical commit (+1, one trace, domains affect+regulation) |
| R13 | Regulation failure atomicity: invalid regulation output / producer failure ⇒ Affect + Mood + Regulation all `+0` |
| R14 | replay: same initial state + Time input ⇒ same proposal fingerprint, same resulting state hash, same trace identity |
| R15 | no Affect/Mood writing: Regulation delta contains only `/regulation` |

## 17. Contract Consistency Review

Compared against the seven authoritative documents:

| Document | Relevant clause(s) | Finding |
|---|---|---|
| `subjectstate-v0-spec.md` §16 | RegulatoryState minimal scalars; "V0 不实现完整 homeostasis" | Consistent: identity implements no homeostasis |
| `transition-contracts.md` §12/§13 | time three-sources; Time requires regulation producer participation; NO_OP | Consistent: identity delta satisfies participation; derivation rule reused verbatim |
| `micl-design.md` §23 | regulation = minimal Time support; mood slow baseline | Consistent: no dynamics required beyond participation |
| `p1-5-engineering-acceptance-contract.md` A5/A8 | affect continuity; time semantics | Consistent: no A-group mandates regulation dynamics; identity preserves +1/NO_OP semantics |
| `p2-1-contract-freeze.md` §6.3/§7.2 | field ranges; writable paths; producer literals; `expected_repository_revision=null` for non-memory | Consistent: delta shape conforms exactly |
| `p2-3-runtime-plan.md` §2.1/§5.1 | regulation partition `/regulation`, Time; "不扩张 homeostasis 模型"; required deltas elapsed>0 | Consistent: identity does not expand the model |
| `p2-3-4-fast-ema-v0-reference-contract.md` §1/§3 | scope excludes regulation ownership; FAST_EMA inputs contain no regulation | Consistent: mutual separation matches both contracts |

**No higher contract requires non-identity regulation dynamics.** Verdict: **CONTRACT_READY**.

---

**FINAL PRINCIPLE:** REGULATION_V0 intentionally does almost nothing. That is a feature, not a bug. It gives CharacterOS-Next a deterministic, auditable Regulation baseline without pretending that unvalidated psychology is already known.
