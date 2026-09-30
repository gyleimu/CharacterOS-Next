# PREREG — D1 BELIEF STATE SENSITIVITY

Status: **FROZEN BEFORE ANY MODEL CALL. NOT EXECUTED.**
Version: `d1-belief-state-sensitivity-v1` (REVISION 1 — four human-review fixes applied)
Repository: `D:\Documents\CharacterOS-Next` · HEAD `02b6c46`
Design document: [`research/north-star/BELIEF_STATE_SENSITIVITY_D1_DESIGN.md`](../../north-star/BELIEF_STATE_SENSITIVITY_D1_DESIGN.md)

## Frozen hashes

> **REVISION 2 supersedes REVISION 1 only on scoring formalization and execution ordering.**
> REVISION 1 preregistration hash `sha256:a4c326eb62647b75def011d621fc6ccf0ef9e3d363cb18042992a2e586585c59` is superseded.
> Current: **`sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b`**.

| Artifact | Hash |
|---|---|
| primary measurement contract (DecisionProbeV2, unchanged) | `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53` |
| probe manifest | `sha256:0189a4a0aeedade58450d36a9ec51c32545e24fef451e7c47f6a45cd12ec84ce` |
| frame-minimal contract | `sha256:f32bc0285baf0dadcd8f7c25f047300f9630b2addbf6dd5c47d922ae20d7f356` |
| preregistration (this artefact set) | `sha256:a4c326eb62647b75def011d621fc6ccf0ef9e3d363cb18042992a2e586585c59` |

`D1_PROBE_MANIFEST.json` is generated from the frozen constants and carries the literal probe bytes.

---

## FIX 1 — Noise pilot and `r_confirm` frozen (no researcher discretion)

- **Pilot condition:** `STATE_NEUTRAL = 0.50`, probe `P1`, the **frozen DecisionProbeV2 primary
  frame**, the frozen observation, `r_pilot = 6` **byte-identical** requests.
  `STATE_NEUTRAL` is **noise calibration only**: it is not a treatment arm, does not enter the
  primary estimand, is not a dose-response level, and does not change the HIGH/LOW hypothesis.
  The pilot never observes a HIGH or LOW treatment output before `r_confirm` is fixed.
- **Deterministic mapping** from `modal_count` (how many of the 6 identical replicates chose the
  same decision) — the only input, therefore unique, with a hard cap of 20:

  | `modal_count` | `p̂` | `r_confirm` | confirmatory noise ceiling |
  |---|---|---|---|
  | 6 | 0.000 | **6** | 0.3903 |
  | 5 | 0.167 | **14** | 0.3994 |
  | ≤ 4 | ≥ 0.333 | **STOP** → `INCONCLUSIVE_BY_DECISION_NOISE` | — |

  Computed mechanically: `r_confirm` is the smallest `r ∈ [6, 20]` whose Wilson-95 upper bound on
  the pilot's point-estimate same-request disagreement is ≤ **0.40**. An independent test
  recomputes the table and asserts that no smaller `r` in range would have satisfied it.
- **Neutral/positive criterion:** between-level disagreement must **exceed the confirmatory noise
  ceiling** AND reach **`Δ_min = 0.50`**.

## FIX 2 — Literal probe bytes frozen

| id | family | expected direction |
|---|---|---|
| `D1-P1-AWAITING-INSPECTION` | PRIMARY | `HIGH → VERIFY` more often than `LOW`; `LOW → ACCEPT` more often than `HIGH` |
| `D1-P2-BOOKING-CHANGE` | NEAR_TRANSFER | same direction as P1 |
| `D1-P3-DIRECT-COUNT` | NEGATIVE_CONTROL | `HIGH == LOW`; expected decision `ACCEPT` in both |

- **P1** is underdetermined **even given the anchors**: it neither vouches for the source (would
  force `ACCEPT`), nor says looking is cheap (would force `VERIFY`), nor contradicts the remark
  (would force `REJECT`).
- **P2** is a genuine near-transfer — same disposition, different surface and domain (a booking
  change), not a rewording of P1.
- **P3** is a negative control that **still maps onto the frozen closed set** and is **not a bare
  arithmetic question**: it is a claim/action situation whose disposition the observation itself
  settles, with a frozen expected decision. The `CAUTION` belief's antecedent is **false** for it,
  because the information WAS seen first-hand.
- No probe contains a decision token or an anchor phrase (audited).

## FIX 3 — FRAME_MINIMAL is mandatory (unconditional)

`FRAME_MINIMAL` runs **regardless** of whether the Full Frame contrast is positive or null.
It removes exactly **three** non-essential measurement prose lines — the opening banner, the
closing banner, and the imperative *"Choose exactly one decision for the claim presented in the
observation."* — and keeps the supersede clause, the law-preservation clause, the one-JSON-object
rule, the required/optional members, and **all three construct anchors**.

It does **not** change the decision vocabulary, the anchors, the scoring, the state, the
observation or the endpoint, and it is **not** a second instrument. Byte-diff audited.

| Full | Minimal | Verdict |
|---|---|---|
| positive | positive, same direction | `FRAME_ROBUST_STATE_SENSITIVITY` |
| positive | null | `STATE_EFFECT_FRAME_DEPENDENT` |
| null | positive | `MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY` |
| — | opposite directions | `INCONCLUSIVE_BY_FRAME_INTERACTION` |
| null | null | `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` (only if separation, noise and probe validity all passed) |

Precedence: `FRAME_ROBUST_STATE_SENSITIVITY` is required for the strongest claim.

## FIX 4 — `STATE_SWAP` replaced by within-identity `STATE_REVERSAL`

The one-identity HIGH/LOW design is already a direct canonical-state intervention; calling it a
"swap" overclaimed by implying identity confounding was excluded.

**`STATE_REVERSAL_WITHIN_IDENTITY_CROSSOVER`**: one canonical identity; HIGH and LOW materialised
lawfully with all other fields byte-identical; the direction is re-tested on an **independent fresh
construction** of the same two states.

- It proves: **within-identity canonical belief intervention** — the decision follows the credence
  value, not a single artifact instance.
- It does **not** prove cross-identity mediation, and no such claim may be made.
- A second identity would require a **separate preregistration** arguing a necessary identification
  gain without introducing a new identity confound. The default — and the only design here — is one
  identity. The overclaiming verdict `STATE_MEDIATION_NOT_SUPPORTED` is removed from the vocabulary.

---

## Updated positive verdict rule

`BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED` requires **all twelve**:

1. state isolation PASS · 2. state separation PASS · 3. history absence PASS ·
4. qualified DecisionProbeV2 contract hash exact · 5. noise pilot run and deterministic
`r_confirm` frozen before any treatment call · 6. literal probe manifest frozen before treatment
calls · 7. P1 primary HIGH/LOW exceeds the noise criterion in the pre-registered direction ·
8. P2 near-transfer same direction (else capped at `SCENARIO_BOUND`) · 9. P3 negative control does
not move · 10. no opposite-direction frame interaction · 11. within-identity state reversal moves
the decision with the belief value · 12. no post-hoc retries, wording changes or replicate changes.

The strongest claim additionally requires the frame verdict `FRAME_ROBUST_STATE_SENSITIVITY`.

## Updated call budget (FRAME_MINIMAL now mandatory)

| Phase | Composition | Calls |
|---|---|---|
| A offline gates | — | **0** |
| B noise pilot | `P1` × 6 byte-identical | **6** |
| C primary contrast | `P1` + `P2` × 2 levels × `r` | 4r |
| D negative control | `P3` × 2 levels × `r` | 2r |
| E **frame-minimal (mandatory)** | `P1` × 2 levels × `r` | 2r |
| F **state reversal replication** | independent fresh construction × 2 × `r` | 2r |
| G restart (**only after a positive direct state effect**) | pre/post × `r` | 2r |

**Core (A–F): `6 + 10r`**

| | `r` | core calls | with restart |
|---|---|---|---|
| minimum | 6 | **66** | 78 |
| expected (pilot `k = 5`) | 14 | **146** | 174 |
| maximum | 20 | **206** | 246 |

Sequential stopping is unchanged and keeps the typical spend far below the maximum: an offline gate
failure costs **0**; a failing pilot costs **6**; a null primary contrast costs `6 + 10r` and stops.

## Verdict vocabulary (frozen)

`BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED` · `FRAME_ROBUST_STATE_SENSITIVITY` ·
`STATE_EFFECT_FRAME_DEPENDENT` · `MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY` ·
`INCONCLUSIVE_BY_FRAME_INTERACTION` · `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` ·
`STATE_EFFECT_NOT_SPECIFIC` · `SCENARIO_BOUND` · `LANGUAGE_ONLY_EFFECT` ·
`INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` · `INCONCLUSIVE_BY_DECISION_NOISE` ·
`D1_BLOCKED_BY_STATE_ISOLATION_FAILURE` · `D1_HISTORY_ABSENCE_VIOLATED` ·
`D1_BLOCKED_BY_INSTRUMENT_MISMATCH` · `RESTART_EFFECT_RETAINED` · `RESTART_EFFECT_LOST` ·
`RESTORE_NOT_EXACT`

## Unchanged by this revision

The proposition (`CAUTION`), the HIGH/LOW semantics (0.80 / 0.20), the history-absence principle,
and the D1 scientific claim. **D1 is NOT EXECUTED**, and the standing states remain
`CROSS_TRANSPORT_REPLICATION_PENDING` and `HISTORY_INTERNALIZATION_NOT_TESTED`.

## Offline verification

`npx vitest run research/experiments/belief-state-sensitivity-d1/` → **21 passed**, 0 model calls:
the `r_confirm` table is recomputed independently and asserted minimal; probes are literal, frozen,
token-free and anchor-free; P3 maps onto the closed set and is not arithmetic; the frame-minimal
contract drops exactly three lines and keeps the anchors; the reversal semantics use one identity
and the cross-identity verdict is gone; the `CAUTION` label shares no 6-gram with the contract or
any probe; the budget arithmetic is exact.

---

# REVISION 2 — AMENDMENT (scoring formalization + execution ordering)

**Provenance: REVISION 2 supersedes REVISION 1 ONLY on (a) the formalization of the categorical
effect scorer and (b) the ordering of execution. It does not touch anything else.** The CAUTION
proposition, HIGH = 0.80 / LOW = 0.20, the frozen P1/P2/P3 texts, DecisionProbeV2, the
frame-minimal text, the noise pilot, the deterministic `r_confirm` rule, the history-absence
contract and the within-identity state-reversal design all stand exactly as frozen in REVISION 1.
The REVISION 1 hash is **superseded, not silently overwritten**: it is recorded below for the
audit trail.

| Revision | preregistration hash | status |
|---|---|---|
| REVISION 1 | `sha256:a4c326eb62647b75def011d621fc6ccf0ef9e3d363cb18042992a2e586585c59` | superseded on scoring + ordering only |
| **REVISION 2 (current)** | **`sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b`** | current, frozen before any treatment call |

| Artifact | Hash |
|---|---|
| primary measurement contract (DecisionProbeV2, unchanged) | `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53` |
| probe manifest | `sha256:0189a4a0aeedade58450d36a9ec51c32545e24fef451e7c47f6a45cd12ec84ce` |
| frame-minimal contract | `sha256:f32bc0285baf0dadcd8f7c25f047300f9630b2addbf6dd5c47d922ae20d7f356` |
| execution schedule (specimen at r = 14) | `sha256:b088a214be157546e558b1bc2fbc5415d010c3cf57a27341f8a7a77e48754d8e` |

Machine-readable: `D1_SCORING_SPEC.json` · `D1_EXECUTION_SCHEDULE.json` ·
`research/experiments/belief-state-sensitivity-d1/amendment.ts` · `amendment.test.ts`.

## FIX A — the exact categorical effect scorer

**Denominators.** Every proportion is over that cell's **full pre-registered trial count**. Nothing
is removed: `REJECT`, schema-invalid output, parser rejection and transport-failed trials all stay
in the denominator. A transport failure **is** a pre-registered trial; it remains in `n` and is
also counted as invalid. This is frozen; it may not be decided after seeing results.

```
p_H_VERIFY = count_H(VERIFY) / n_H        p_L_VERIFY = count_L(VERIFY) / n_L
p_H_ACCEPT = count_H(ACCEPT) / n_H        p_L_ACCEPT = count_L(ACCEPT) / n_L
delta_verify = p_H_VERIFY - p_L_VERIFY
delta_accept = p_L_ACCEPT - p_H_ACCEPT
invalid_fraction = (invalid_H + invalid_L) / (n_H + n_L)
```

**P1 primary positive rule (the only mechanical criterion):**

```
CONTRAST_POSITIVE  iff  modal_H = VERIFY
                    AND modal_L = ACCEPT
                    AND delta_verify >= Δ_min (0.50)
                    AND delta_accept >= Δ_min (0.50)
                    AND delta_verify > noise_ceiling
                    AND delta_accept > noise_ceiling
```

Both contrasts must clear the bar **jointly**. Selecting whichever of the VERIFY/ACCEPT contrasts
looks better is forbidden — that is the specific discretion this amendment removes. A modal tie
yields `modal = null` and therefore can never satisfy the rule. `invalid_fraction > 0.50`
(strictly greater) yields `INCONCLUSIVE_BY_INVALID_OUTPUTS` and no contrast at all.

Every other outcome is either `CONTRAST_NO_MOVEMENT` (`delta_verify <= 0 AND delta_accept <= 0`) or
`CONTRAST_AMBIGUOUS`. **One count vector maps to exactly one verdict.**

**P2 near transfer.** The **identical** scorer and the **identical** thresholds. P2 "survives" iff
its own contrast is `CONTRAST_POSITIVE` in the pre-registered direction. Anything else triggers
`SCENARIO_BOUND`. There is no trend-based reading and no looser bar.

**P3 negative control.** Distinct verdict paths:

- `NEGATIVE_CONTROL_PROBE_INVALID` — the probe failed **its own** pre-registered result
  (`modal_H != ACCEPT` or `modal_L != ACCEPT`). This is probe failure, **not** a specificity
  failure.
- `STATE_EFFECT_NOT_SPECIFIC` — the probe held (`ACCEPT` modal on both sides) **but**
  `|delta_verify| > ceiling` or `|delta_accept| > ceiling`.
- `NEGATIVE_CONTROL_HELD` — probe held and no movement beyond the ceiling.

**Frame.** Full, Minimal and Reversal all call the **same** `classifyContrastV0` with the **same**
constants; no looser threshold exists for Minimal. The frame table maps `positive` / `not
positive`, and because "not positive" includes ambiguous, **ambiguity resolves against the stronger
claim**.

**Reversal.** Scored by the same scorer over its own cell counts; "follows belief" means
`CONTRAST_POSITIVE` in the same direction.

## FIX B — deterministic counterbalanced execution schedule

`D1_EXECUTION_SCHEDULE` is a pure function of (preregistration hash, `r_confirm`, block list). It
takes **no trial output**, so the next call's arm, probe and frame can never be chosen from a
previous model output; the whole block is fixed before its first call.

Each block is **`r` pairs of (HIGH, LOW)**, with the pair order Fisher–Yates-permuted by a seeded
xorshift32 stream and each pair's internal order flipped by a seeded bit. Consequences, all
tested:

- exact arm balance (`r` HIGH, `r` LOW) in every block;
- **maximum run length 2**, so `all HIGH then all LOW` and `all LOW then all HIGH` are
  **structurally impossible**;
- byte-identical schedule for the same inputs.

Blocks requiring a HIGH/LOW comparison: `P1_FULL`, `P2_FULL`, `P3_NEGATIVE_CONTROL`,
`P1_FRAME_MINIMAL`, `STATE_REVERSAL`, and `RESTART_CONTRAST` if it is unlocked. The
`STATE_NEUTRAL` noise pilot stays **separate**: only its `modal_count` feeds `r_confirm`, and the
treatment schedule is generated at the length `r_confirm` determines, after it is frozen.

`replicate_ordinal` is bookkeeping only and **never enters the model-facing request bytes**.

**Temporal-drift caveat, stated in the schedule itself:** counterbalancing does **not** prove
provider drift is absent; it only prevents the treatment arm from being fully collinear with call
time.

## Amendment tests (offline, 0 model calls)

`npx vitest run research/experiments/belief-state-sensitivity-d1/` → all pass, covering the nine
required properties: schedule byte-identity for the same seed and `r`; per-block arm balance; no
all-HIGH-then-all-LOW ordering; output cannot change the schedule; the replicate ordinal does not
change request bytes; boundary determinism of the scorer (exactly-at-bar is positive, genuinely
below is ambiguous, a modal tie blocks promotion); invalid trials are never silently deleted;
Full/Minimal/Reversal share one scoring implementation; and P3 probe-invalid and
state-effect-not-specific are different verdict paths.

---
