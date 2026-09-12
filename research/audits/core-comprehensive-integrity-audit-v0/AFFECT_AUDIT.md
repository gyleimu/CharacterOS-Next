# AFFECT AUDIT — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

## Affect semantics

`CanonicalAffectV0` = `{schema_version, valence: [-1,1], activation: [0,1]}` (`subject-core/src/types/subject-state-v4.ts:55`).
Closed validator: exact keys, finite, range, `-0` rejected, no coercion, no defaults
(`validation/subject-state-v4-values.ts:14-45`). Meaning is consistent across Appraisal → AffectApplication →
recovery → prompt projection (Appraisal produces goal_congruence/intensity; AffectApplication maps them to VA;
recovery decays toward baseline; projection copies raw VA). v3 legacy `AffectV0.active_channels`/`MoodV0` are
rejected by the v4 validator — no split-brain.

## Appraisal → Affect mapping

Equation (frozen): `q = relevance * intensity`;
`uV = 0.25 * q * (2*goal_congruence - 1)`; `uA = 0.1 * q`;
`valence = clamp(valence + uV, -1, 1)`; `activation = clamp(activation + uA, 0, 1)`.
Baseline `(0, 0.2)`, `tau_ticks = 150`. Sign convention correct; activation impulse non-negative;
no cross-wiring; clamp applied after add; one application per event with a journal-derived receipt and
idempotent CAS.

## Update math

- delta sign/weights correct; no double application; no unbounded accumulation (time is contractive).
- Recovery: `f = exp(-elapsed/tau)`; `valence *= f`; `activation = 0.2 + (activation-0.2)*f`.
  Moves both axes toward baseline, stays in bounds, applied once per positive interval
  (`advanceTime` → `BoundedAffectTimeProducerV0`). Unreachable only when ticks = 0 (no commit).
- Numeric edges: NaN/±Inf rejected by validator; `-0` normalized; clamp boundaries exact.

## Recovery / regulation

- Recovery IS reachable in the product (interval_ticks default 1 per turn) and verified in `trace.json`.
- Regulation is the reference byte-exact zero-dynamics producer; only `last_update` changes.
  It does NOT feed affect.

## Persistence

`captureDurableState` stores `affect` in `durable.identity` (observational) and affect lives canonically in the
commit bundle's `next_snapshot`. The canonical value is authoritative; the checkpoint copy is not used to
reconstruct state (finding AUD-22: never cross-checked; consumed only by zero-tick reporting).

## Restore

Authoritative: affect is rebuilt from the canonical head bundle; `trace.json` proves affect round-trips exactly
(valence/activation equal after JSON round-trip + fresh restore). No process-local state is needed.

## Cognition projection

`projectCanonicalAffectForCognitionV0` copies values exactly (no rounding, bins, transforms).
Rendered as `[affect (canonical)] valence=<n> activation=<n>`; hash-bound in the V2 body.

## Prompt semantics

- The line is numeric raw VA with **no legend** (finding AUD-11). Beliefs, familiarity and personality each
  carry explicit semantics; affect does not. The only definition is an unreachable source comment.
- This is the single most likely reason a real model under-uses affect: `valence ∈ [0,1]` is a common
  convention, under which `0` reads as maximally negative instead of neutral.
- No named emotions are present (deliberate and correct given the frozen design).

## Behavioral interpretability

- The value reaches the model byte-exactly and is the only dynamic non-Memory state by default.
- Ordering caveat (AUD-12): cognition sees affect from **before** the current event's AffectApplication, so an
  event's own affective consequence first reaches cognition on the following turn. Any experiment that assumes
  "current event affect is visible to its own cognition" is mis-specified.
- Null controls in the previous ablation showed no objective-answer distortion.

## Affect verdict

`AFFECT_MULTIPLE_ISSUES`

- Implementation math, validation, recovery, persistence and restore are sound.
- Projection is byte-exact but semantically under-specified for a model (no legend) — `AFFECT_PROJECTION_WEAK`.
- The cognition ordering (pre-current-event affect) is a load-bearing design property that is undocumented at
  the experiment level.
- No implementation bug was found in the affect equations.

## Should AFFECT_MARGINAL_VALUE_REPLICATED_SWAP_EXPERIMENT_V0 run now?

`NO`

Exact blocker: the affect prompt line carries no interpretation legend (AUD-11), and the one-turn
affect-visibility lag (AUD-12) is not encoded in the experiment design. Running a higher-powered swap
experiment against an uninterpretable numeric line would measure model convention, not CharacterOS semantics.
Fix/define those two projection semantics first, then run the replicated swap with k≥5 repeats per condition.
