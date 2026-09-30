# BELIEF_STATE_SENSITIVITY_D1_DESIGN

Status: **PREREGISTRATION ONLY. NOT EXECUTED. ZERO MODEL CALLS MADE IN THIS ROUND.**
Repository: `D:\Documents\CharacterOS-Next` · branch `main` · HEAD `02b6c46`
Date: 2026-09-21
Lineage: North Star audit → `CONTROLLED_BELIEF_INTERNALIZATION_V1_DESIGN.md`
(`CURRENT_BELIEF_SEMANTICS_INSUFFICIENT_FOR_DECISIVE_V1`) → DecisionProbeV0/V1/V2
→ `DECISION_INSTRUMENT_V2_QUALIFIED_ON_DEEPSEEK_FLASH` → this document.

---

# REVISION 1 — FINALIZED (four human-review fixes)

This revision supersedes the named sections below. Everything else in this document stands
unchanged: the proposition, the HIGH/LOW semantics, the history-absence principle, the D1
scientific claim, the non-claims, the state-isolation proof, and the null matrix N0–N7.

Machine-readable companion: `research/experiments/belief-state-sensitivity-d1/` —
`PREREG.md`, `D1_PROBE_MANIFEST.json`, `contract.ts`, `audit.test.ts` (21 offline tests).

Frozen hashes (recorded before any model call):

| Artifact | Hash |
|---|---|
| primary measurement contract (DecisionProbeV2, unchanged) | `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53` |
| probe manifest | `sha256:0189a4a0aeedade58450d36a9ec51c32545e24fef451e7c47f6a45cd12ec84ce` |
| frame-minimal contract | `sha256:f32bc0285baf0dadcd8f7c25f047300f9630b2addbf6dd5c47d922ae20d7f356` |
| preregistration | `sha256:a4c326eb62647b75def011d621fc6ccf0ef9e3d363cb18042992a2e586585c59 (REVISION 1, superseded)` |

## FIX 1 — supersedes "Noise Pilot" and "Statistical / Decision Rule"

The pilot condition is frozen: `STATE_NEUTRAL = 0.50`, probe `P1`, the frozen primary frame, the
frozen observation, **6 byte-identical** requests. `STATE_NEUTRAL` is **noise calibration only** —
never a treatment arm, never in the primary estimand, never a dose-response level, and it does not
change the HIGH/LOW hypothesis. The pilot never observes a HIGH or LOW output before `r_confirm`
is fixed.

`r_confirm` is a **deterministic function** of `modal_count` (the only input): 6 → r = 6;
5 → r = 14; ≤ 4 → **STOP**, `INCONCLUSIVE_BY_DECISION_NOISE`. It is computed as the smallest
`r ∈ [6, 20]` whose Wilson-95 upper bound on the pilot's point-estimate same-request disagreement
is ≤ 0.40 — an independent test recomputes the table and asserts minimality. The positive criterion
requires the between-level disagreement to **exceed that ceiling AND reach Δ_min = 0.50**.
No researcher discretion remains.

## FIX 2 — supersedes "Probe Manifest" / "Primary Probe" / "Near Transfer" / "Negative Control"

The literal probe bytes are frozen and hashed: `D1-P1-AWAITING-INSPECTION` (primary),
`D1-P2-BOOKING-CHANGE` (near transfer), `D1-P3-DIRECT-COUNT` (negative control). P1 is
underdetermined **even given the anchors** (no source endorsement, no cheap-check statement, no
contradiction); P2 is a genuine near transfer in a different domain, not a rewording; P3 is a
claim/action situation whose disposition the observation settles, with a frozen expected decision,
and it **still maps onto the closed set** — it is not a bare arithmetic question. No probe contains
a decision token or an anchor phrase (audited).

## FIX 3 — supersedes "Frame-Minimality"

FRAME_MINIMAL is now **mandatory and unconditional**: it runs whether the Full Frame contrast is
positive or null. It removes exactly **three** non-essential measurement prose lines — the opening
banner, the closing banner, and the imperative *"Choose exactly one decision for the claim
presented in the observation."* — while keeping the supersede clause, the law-preservation clause,
the one-JSON-object rule, the required/optional members, and **all three construct anchors**.
Byte-diff audited; it is not a second instrument.

| Full | Minimal | Verdict |
|---|---|---|
| positive | positive, same direction | `FRAME_ROBUST_STATE_SENSITIVITY` |
| positive | null | `STATE_EFFECT_FRAME_DEPENDENT` |
| null | positive | `MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY` |
| — | opposite directions | `INCONCLUSIVE_BY_FRAME_INTERACTION` |
| null | null | `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` (only if separation, noise and probe validity all passed) |

`FRAME_ROBUST_STATE_SENSITIVITY` is required for the strongest claim.

## FIX 4 — supersedes "State Swap"

Renamed **`STATE_REVERSAL_WITHIN_IDENTITY_CROSSOVER`**. One canonical identity; HIGH and LOW
materialised lawfully with every other field byte-identical; the direction re-tested on an
**independent fresh construction** of the same two states.

It proves a **within-identity canonical belief intervention** — the decision follows the credence
value, not a single artifact instance. It does **not** prove cross-identity mediation; a second
identity would require its own separate preregistration, and the overclaiming verdict
`STATE_MEDIATION_NOT_SUPPORTED` is removed from the vocabulary.

## Updated positive verdict rule

Requires all twelve conditions listed in `PREREG.md`: state isolation · state separation · history
absence · exact qualified instrument hash · noise pilot with deterministic `r_confirm` frozen
before any treatment call · literal probe manifest frozen before treatment calls · P1 exceeding the
noise criterion in the pre-registered direction · P2 same direction (else `SCENARIO_BOUND`) · P3 not
moving · no opposite-direction frame interaction · within-identity reversal moving the decision with
the belief value · no post-hoc retries, wording changes or replicate changes. The strongest claim
additionally requires `FRAME_ROBUST_STATE_SENSITIVITY`.

## Updated call budget

Core (A–F) = **`6 + 10r`**: **66 / 146 / 206** calls at r = 6 / 14 / 20, plus a conditional restart
of `2r` → 78 / 174 / 246. **The budget table in the Call Budget section below is stale and must be
read as this formula** (FRAME_MINIMAL is now mandatory and the reversal replication arm was added).

---

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

---

## Scientific Verdict

```
D1_PREREGISTRATION_READY
```

D1 is designable **now**, with no mechanism change: the instrument is qualified on the primary
executor, the belief system can lawfully express and materialise the counterfactual states, and
the intervention seam exists. Two design problems had to be solved first and both are solved
below rather than deferred: the **lexical leakage** between the previously selected proposition
and the `VERIFY` construct (§ Lexical-Leakage Analysis), and the fact that the frozen D0 fixtures
are **answerable without any subject state** (§ Probe Manifest).

**D1 NOT EXECUTED.** Human/reviewer approval is required before any real call.

---

## Exact Claim

> With current observation, executor, measurement contract, history availability, identity, tools
> and request structure held **fixed**, changing **one** lawful canonical belief credence produces
> a structured decision change that (a) exceeds the executor's measured same-request self-noise,
> (b) follows the pre-registered direction, and (c) moves with the belief value under a lawful
> state swap.

Core estimand: *effect of a legal belief-state manipulation on the structured decision under fixed
current input.*

---

## Explicit Non-Claims

D1 does **not** answer — and no outcome may be read as answering — any of:

- whether a belief can be **formed** from a life (no lived-history formation is used);
- whether history is internalized (that is the History Internalization V1 question);
- whether personality forms, or whether relationships have causal force;
- whether a persistent artificial subject exists;
- whether CharacterOS beats Persona / Summary / RAG / long-context baselines (no baselines here);
- anything about human-like cognition.

Even a fully successful D1 yields **only** the claim in § D1 Success Claim.

---

## Selected Proposition

Three candidates were constructed and judged against: expressible by the existing belief system ·
no new semantics · formable/legally materialisable · clear pre-registered direction against the
frozen construct set · not a recall task · **no lexical overlap with a decision token or anchor**.

| # | Candidate canonical label | Direction (HIGH →) | Token/anchor overlap | Verdict |
|---|---|---|---|---|
| **P-verify** | `It is worth verifying a claim before acting on it.` | VERIFY | **severe** — see below | **REJECTED for D1** |
| **CAUTION** | `Caution is warranted when the conclusion rests on information I have not seen myself.` | VERIFY | none | **SELECTED** |
| OWN-INSPECTION | `My own inspection is worth more than a secondhand report.` | VERIFY | none, but "report" is close to the probe's source framing | rejected — weaker separation from the probe text |

### Selected: `CAUTION`

```
Caution is warranted when the conclusion rests on information I have not seen myself.
```

Why it wins: it states a **disposition toward action under unseen information**, which is exactly
what the primary probe must leave open; it contains no decision token and no anchor wording; its
HIGH direction is unambiguous (more caution → do not act yet → `VERIFY` when a check exists); it
requires no semantic the belief system lacks (it is a plain proposition with a credence).

`P-verify` is retained in the record but **not used in D1**.

---

## Lexical-Leakage Analysis

Frozen `VERIFY` anchor (in the measurement contract):

> `the claim should be checked against an independent source before it is acted on`

`P-verify` label: `It is worth **verifying** a claim **before acting on it**.`

| Overlap | Detail |
|---|---|
| `verifying` ↔ `checked` | same concept, near-synonymous verb |
| `before acting on it` ↔ `before it is acted on` | **near-verbatim phrase** |
| `a claim` ↔ `the claim` | same referent noun |

**Assessment: severe.** A HIGH-credence subject would see a belief line that restates the `VERIFY`
anchor, and the resulting `VERIFY` output could be produced by lexical priming rather than by any
decision consequence of the state. This is not hypothetical: V2's `FORMAT_ONLY` and `TOKEN_REMAP`
diagnostics just showed that this executor reaches the frozen decisions from the *task and legal
tokens* with anchors removed and labels replaced — i.e. it is highly responsive to whatever text is
salient. A state line that echoes the anchor would be maximally salient.

**Mitigation is by design, not by assertion:** the selected `CAUTION` label shares no token and no
anchor phrase with the contract; the probe text never contains the belief label; and the design
includes a **state-line lexical audit** (§ State Isolation Proof, item 9) that fails the run if the
rendered belief line and the rendered contract share any 6-gram. **The proposition is not silently
swapped** — the rejection of `P-verify` for D1 is recorded here with its reason.

---

## Legal State Construction

D1 uses **no lived-history formation**. HIGH / LOW are **experimentally authored lawful
counterfactual states**, built through the existing production seams:

```
genesis seed (SubjectStateV4GenesisSeedV0)
  → materializeSubjectStateV4V0        (production genesis authoring, validated)
  → one proposition present with the frozen canonical label
  → single credence field set to the level value
```

No JSON patching, no invariant bypass, no unsafe mutation, no production hack. The construction is
the same class already used by the repository's own tests to author lawful belief fixtures, and it
is **labelled honestly** as `CANONICAL_INTERVENTION_VIA_AUTHORED_SEED` in every artifact — it is a
lawful canonical state, not a plasticity-produced one.

---

## State Isolation Proof

Before any call, a full-state diff must show that **only the pre-registered belief component
differs**:

| # | Check | Requirement |
|---|---|---|
| 1 | `proposition_key` | identical across levels |
| 2 | `canonical_label` | identical byte-for-byte across levels |
| 3 | credence | **the only differing field**, and equal to the declared level value |
| 4 | affect | identical |
| 5 | relationships | identical |
| 6 | personality | identical |
| 7 | memory state / episodes | identical (zero episodes) |
| 8 | context / identity anchors / traits_seed / regulation | identical |
| 9 | **state-line lexical audit** | the rendered belief line shares **no 6-gram** with the rendered measurement contract, and contains no decision token |

Any failure → **`D1_BLOCKED_BY_STATE_ISOLATION_FAILURE`**, 0 calls.

---

## State Separation Gate

Levels are **not** chosen mechanically. The update law is ±0.05 per evidence step with stance-zero
`c = 0.5` and `stance(c) = 2c − 1`; saturation returns `NO_CHANGE`, so both bounds are real limits.

| Level | Credence | Stance | Margin to bound |
|---|---|---|---|
| `STATE_HIGH` | **0.80** | +0.60 | 0.20 = 4 plasticity steps |
| `STATE_LOW` | **0.20** | −0.60 | 0.20 = 4 plasticity steps |

Separation **0.60** — the two stances are exact opposites, both comfortably interior.

`STATE_NEUTRAL` (0.50, the frozen stance-zero) is **declared but deferred** from the primary round:
it costs another full arm and the primary estimand is binary. If D1 is positive and a
dose-response is wanted, a NEUTRAL arm is a separate preregistration.

`STATE_SEPARATION_GATE`: `|HIGH − LOW| ≥ 0.40` **and** both levels within `[0.05, 0.95]` **and**
the rendered belief lines differ in the credence value only. Failure →
**`INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION`**, and a behavioural null may **not** be reported.

---

## Noise Pilot

Mandatory, and it runs **before** the contrast is examined.

- Same subject state, same observation, same contract, same executor, same generation settings,
  **byte-identical request**, `r_pilot = 6` repeats of the primary probe.
- Outputs: per-probe modal decision, agreement fraction, and a Wilson interval for the
  same-request disagreement rate `p̂`.
- **`r_confirm` is derived from the pilot, not chosen in advance:** the smallest `r` such that the
  pre-registered decision rule can separate the expected effect from `p̂`, bounded to `[6, 20]`.
- If no `r ≤ 20` separates them → **`INCONCLUSIVE_BY_DECISION_NOISE`** and the run stops after the
  pilot. This is not a null on the hypothesis.

Prior knowledge, used for budgeting only: this executor *family* has twice before shown large
same-request instability at temperature 0 (a 30–40 % flip rate in `belief-causal-validation-v0`; a
directive flip on an identical repeat in `non-memory-state-value-ablation-v0`). Temperature 0 is
**not** assumed deterministic.

**Decision threshold:** an effect counts only if the between-level disagreement **exceeds the upper
bound** of the pilot noise band on the primary probe at the frozen `r_confirm`.

---

## Probe Manifest

**The frozen D0 fixtures cannot be used.** V2 demonstrated that A/B/C are decided correctly even
with the anchors removed and the tokens renamed — the observation alone determines the answer. A
probe whose answer is fixed by its own text cannot be moved by subject state, so it would guarantee
a null for reasons unrelated to the hypothesis.

D1 probes are therefore **underdetermined by the observation alone, even given the anchors**: the
observation must not make it determinate whether the information is sufficient (which would force
`ACCEPT`), whether a check is available and worthwhile (which would force `VERIFY`), or whether the
claim is contradicted (which would force `REJECT`).

| # | Family | Shape | Pre-registered direction |
|---|---|---|---|
| **P1** | **Primary** — state-relevant ambiguous | a secondhand claim about equipment state that the subject has not seen; there **is** a chance to look, but it costs time and the job is already behind; nothing in the text settles whether the account is good enough | `HIGH` → `VERIFY` more often than `LOW`; `LOW` → `ACCEPT` more often than `HIGH` |
| **P2** | **Near transfer** | the same disposition in a different surface: a scheduling/commitment claim from a third party, where checking means asking someone else, and the cost is stated but not quantified | same direction as P1 |
| **P3** | **Negative control** | a claim whose evaluation has **nothing** to do with caution-under-unseen-information (a determinate arithmetic/definitional matter) | `HIGH` ≈ `LOW`; no directional difference |

Every probe: novel, never lived, single turn (`messages.length === 2`), frozen text, frozen
direction, registered before any call.

---

## Primary Probe

`P1` as above. The primary endpoint family is the frozen DecisionProbeV2 structured decision:

```
ACCEPT | VERIFY | REJECT
```

Frozen pre-registered prediction, written before any call:

```
HIGH: VERIFY modal, expected ACCEPT < VERIFY
LOW : ACCEPT modal, expected ACCEPT > VERIFY
```

The observation deliberately does **not** state that a check is cheap (which would force `VERIFY`
from the anchors alone) nor that the account is reliable (which would force `ACCEPT`). Subjects may
legitimately choose either; the belief is the tie-breaker under test.

---

## Near Transfer

`P2` — same belief, different surface form and domain. Purpose: distinguish "the state influences a
disposition" from "the state primes one specific scenario". A direction that survives both is
evidence for the former; a direction present only in `P1` is recorded as `SCENARIO_BOUND`.

---

## Negative Control

`P3` — a determinate question with a correct answer reachable from the observation. Purpose: detect
a **generic** shift (any state difference moving any decision). If `HIGH ≠ LOW` here, the state
effect lacks specificity → **`STATE_EFFECT_NOT_SPECIFIC`**, which caps the strongest available
verdict regardless of how large the `P1` contrast is.

---

## Full Frame

The **frozen DecisionProbeV2 primary contract, unchanged** (`sha256:c484554d…`). D1 does not modify
the instrument, the override, the anchors, the vocabulary, the parser, the thresholds or the
scoring. The only thing that differs between arms in the Full Frame is the canonical belief
credence.

---

## Frame-Minimality

Required by the V2 hostile-review handoff (item 3). Purpose: rule out that the DecisionProbe frame
is so salient that the executor follows the measurement instruction and never consults SUBJECT DATA.

`FRAME_MINIMAL` must still define the output object, the closed-set decisions and the necessary
construct semantics — **it may not change the decision construct and must not become a second
instrument.** It compresses only non-essential measurement prose (the delimiter banner, the
restatement of the task, the "nothing else changes" clause), keeping the anchors and the output
object verbatim.

**Interpretation, pre-registered:**

| Full frame | Frame-minimal | Meaning |
|---|---|---|
| `HIGH ≈ LOW` | `HIGH ≠ LOW` | `MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY` — the frame, not the state, dominated. **Not** evidence that belief is inert. |
| same direction in both | — | strengthens the state-sensitivity evidence |
| opposite directions | — | `INCONCLUSIVE_BY_FRAME_INTERACTION` |

Frame-minimality is a **sensitivity diagnostic**, never a second primary.

---

## History Absence Contract

Byte-auditable. The cognition request must contain **none** of:

episodic history · retrieval snippets · summaries · historical explanation · provenance · training
evidence · hidden state-construction metadata · formation feedback · episode ids · arm labels ·
the belief label duplicated into the task slot.

**Permitted, and required:** the canonical belief projection inside the normal production subject
state block — D1 exists to test exactly that.

Mechanical checks, per call: `refs ∩ FORMATION_SET = ∅` (trivially, zero episodes); the
`[PRIOR FACTUAL MEMORY]` block absent; no forbidden substring; `messages.length === 2`; and the
**request-minus-belief-line rendered for HIGH and LOW must be byte-identical**, so the only
arm-dependent byte in the entire request is the credence value. Any violation →
`D1_HISTORY_ABSENCE_VIOLATED`, the affected calls are invalid, and the run stops.

---

## State Swap

The decisive causal intervention, and it is cheap because HIGH/LOW are themselves lawful
counterfactual states.

```
Arm 1:  identity A + STATE_HIGH
Arm 2:  identity A + STATE_LOW
Swap:   the two canonical states exchanged between the two subjects
```

**Minimal design, deliberately:** one subject identity with a lawful counterfactual state pair is
sufficient to identify the effect, so a second experimental identity is **not** created merely for
symmetry. The swap arm exists to show the decision **follows the belief value, not the identity or
any request artifact**: after swapping, each identity's decision must move to what the *other*
state predicted.

| Observation | Verdict |
|---|---|
| decisions follow the reversed belief value | `BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED` (within-identity crossover shown) |
| decisions follow the identity/request, not the value | `STATE_REVERSAL_DOES_NOT_TRACK_BELIEF` (within-identity; the overclaiming cross-identity verdict was removed in REVISION 1) |
| reversal is null while the direct contrast was positive | `STATE_REVERSAL_DOES_NOT_TRACK_BELIEF` |

---

## Restart Plan

Executed **only if** the direct contrast is positive. Otherwise it is `RESTART_NOT_RUN`.

```
materialise the frozen state
  → persist (fresh process)
  → terminate (runtime discarded, not reused)
  → new OS process, restore
  → require origin === "RESTORED" and credence restored EXACTLY (bit equality)
  → re-render the frozen probe and require the request-minus-belief-line to be byte-identical
  → repeat the frozen probe at the frozen r
  → the post-restart contrast must lie inside the pre-declared tolerance of the pre-restart one
```

Verdicts: `RESTART_EFFECT_RETAINED` · `RESTART_EFFECT_LOST` (state identical, effect gone — a
first-class failure, reported as such) · `RESTORE_NOT_EXACT` (a restore defect, not a scientific
result).

---

## Sequential Stopping Rules

Registered order, each gate stopping the run before the next phase's calls are spent:

| Gate | Condition | Calls spent |
|---|---|---|
| G1 State isolation | any § State Isolation Proof check fails | **0** |
| G2 State separation | `|HIGH − LOW| < 0.40` or a level within 0.05 of a bound | **0** |
| G3 History absence | any contract check fails | **0** |
| G4 Instrument | DecisionProbeV2 contract hash ≠ the qualified one | **0** |
| G5 Noise pilot | no `r ≤ 20` separates the effect from `p̂` | pilot only |
| G6 Primary contrast | strong separation + low noise + `HIGH ≈ LOW` | primary + control |
| G7 Branch | positive contrast → run **swap**; null contrast → run **frame-minimal** before concluding | one branch only |
| G8 Restart | only after a positive direct contrast | conditional |

If the primary contrast is absent at low noise and adequate separation, the run does **not** proceed
to swap or restart.

---

## Statistical / Decision Rule

1. **Primary statistic:** the paired difference in the primary probe's decision distribution between
   `STATE_HIGH` and `STATE_LOW`, over the frozen `r_confirm`, expressed as the disagreement rate with
   the pre-registered direction.
2. **Decision:** positive only if the between-level disagreement **exceeds the upper bound of the
   pilot noise band**, the direction matches the pre-registration on the primary probe, and the
   negative control does not move.
3. **Descriptive discipline:** counts and rates are reported as descriptive. **No significance
   claim** is made unless the preregistration defines a test and the data satisfy it.
4. **Denominators:** every arm's valid/invalid counts are published; invalid calls stay in the
   denominator; no retry, no replacement, no cherry-picking.
5. **No run-time changes:** no added replicates, no reworded probe, no adjusted threshold after any
   observation.

---

## Null Verdict Matrix

| ID | Condition | Verdict |
|---|---|---|
| **N0** | state separation gate failed | `INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` |
| **N1** | noise too high to resolve the effect | `INCONCLUSIVE_BY_DECISION_NOISE` |
| **N2** | separation strong, noise low, `HIGH ≈ LOW` | `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` |
| **N3** | free-text explanation changes, structured decision does not | **not** decision causality — recorded as `LANGUAGE_ONLY_EFFECT` |
| **N4** | primary contrast exists but the negative control moves too | `STATE_EFFECT_NOT_SPECIFIC` |
| **N5** | full frame null, frame-minimal positive | `MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY` |
| **N6** | within-identity reversal does not move the decision with the state | `STATE_REVERSAL_DOES_NOT_TRACK_BELIEF` |
| **N7** | within-identity reversal moves the decision with the belief value | `BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED` |
| — | state isolation / history absence / instrument hash failure | `D1_BLOCKED_BY_STATE_ISOLATION_FAILURE` · `D1_HISTORY_ABSENCE_VIOLATED` · `D1_BLOCKED_BY_INSTRUMENT_MISMATCH` |

N0 and N1 are **not** behavioural nulls and must never be reported as "belief has no effect".

---

## Positive Verdict Rule

`BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED` requires **all** of:

1. state isolation proof ✓ and separation gate ✓;
2. history-absence contract ✓ on every call;
3. instrument hash equals the qualified DecisionProbeV2 contract;
4. primary probe: between-level disagreement **above the pilot noise band**, direction as
   pre-registered, at the frozen `r_confirm`;
5. near-transfer probe: same direction (else the result is capped at `SCENARIO_BOUND`);
6. negative control: no directional movement;
7. frame branch: no `INCONCLUSIVE_BY_FRAME_INTERACTION`;
8. swap: decisions follow the belief value.

Any missing item caps the claim at the corresponding weaker verdict.

---

## Call Budget

DeepSeek (`deepseek-flash`), primary executor. `r_confirm` is pilot-determined, bounded `[6, 20]`.

| Phase | Composition | Calls |
|---|---|---|
| A — state construction + offline validation | 0 | **0** |
| B — noise pilot | `P1` × 6 byte-identical repeats | **6** |
| C — primary contrast | `P1`, `P2` × 2 levels × `r` | 4r |
| D — negative control | `P3` × 2 levels × `r` | 2r |
| E — frame-minimality (**only if C is null**) | `P1` × 2 levels × `r` | 2r |
| F — swap (**only if C is positive**) | 2 swap arms × `r` | 2r |
| G — restart (**only if C is positive**) | pre/post × `r` | 2r |
| **Minimum** (`r = 6`, C positive) | 6 + 24 + 12 + 12 + 12 | **66** |
| **Expected** (`r = 10`, C positive) | 6 + 40 + 20 + 20 + 20 | **106** |
| **Maximum** (`r = 20`, C positive) | 6 + 80 + 40 + 40 + 40 | **206** |
| Maximum with a null C instead of positive | 6 + 80 + 40 + 40 + 0 | **166** |

"Expected" assumes the pilot shows moderate instability (the historical prior for this family).
The sequential rules make the *typical* spend far smaller than the maximum: a null at G6 costs
`6 + 4r + 2r` and stops. This is one to two orders of magnitude below the full History
Internalization V1 trajectory and it answers exactly one question.

---

## Artifact Plan

`research/experiments/belief-state-sensitivity-d1/`
with `PREREG.md` (frozen before any call, hashed), `contract.ts` (frozen constants: probe texts,
directions, levels, `r` bounds, thresholds, verdict vocabulary), `evidence/run-001/` containing:
state-isolation diff, separation-gate report, history-absence audit per call, executor manifest,
contract hash, noise-pilot report, per-phase trials with **raw outputs**, per-cell distributions,
swap and restart records, `verdict.json`, `RUN_MANIFEST.json` (sha256 of every artifact), `REPORT.md`.

Nothing in `research/experiments/decision-probe-v0|v1|v2/` is modified. The belief mechanism, the
production V8 contract and DecisionProbeV2 are **not touched**.

---

## Implementation Handoff

Buildable with existing seams only:

| Need | Existing seam |
|---|---|
| lawful counterfactual belief state | `SubjectStateV4GenesisSeedV0` + `materializeSubjectStateV4V0` |
| production request for a subject + observation | the V0/V2 binding (`captureProductionRequestForFixtureV0`) |
| the qualified instrument | `research/experiments/decision-probe-v2/` (`probe-v2.ts`, frozen contract) |
| executor | `OpenAiCompatibleTransportV0` / `deepseek-flash`, generation as frozen in D0-V2 |
| restore | `PersistedSubjectEnvelopeV1` exact-reconstruction restore |
| hashing / audit | `hashEnvelope`, `canonicalJsonString` |

Deliverables: `contract.ts` (frozen constants), `state-construction.ts`, `probes.ts`,
`d1.ts` (the sequential driver with the gate ladder), `audit.test.ts` (offline: isolation proof,
separation gate, history-absence contract, frame-minimal construction, request-minus-belief-line
byte equality — **0 model calls**).

**Constraints on the implementer:** no mechanism change; no belief-system change; no instrument
change; no probe rewording after freeze; no added replicates; invalid calls stay in the
denominator; every phase gate recorded before the next phase's calls.

---

## Explicit Unlock Criteria

D1 may be executed only when **all** hold:

1. reviewer/human approval of this preregistration;
2. `PREREG.md` hashed before the first call;
3. Phase A offline gates **all PASS** (state isolation, separation, history absence, instrument hash,
   frame-minimal construction, request-minus-belief-line byte equality);
4. the DecisionProbeV2 contract hash on every call equals
   `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53`;
5. `r_confirm` frozen from the pilot **before** any HIGH/LOW call;
6. the local executor remains deferred (`CROSS_TRANSPORT_REPLICATION_PENDING`), and no
   cross-transport claim is made from D1.

Even after a fully positive D1, the standing state remains:
**`CROSS_TRANSPORT_REPLICATION_PENDING`** and — if the D1 result is positive but the history
question is untouched — **`HISTORY_INTERNALIZATION_NOT_TESTED`**.

---

## D1 Success Claim

The maximum claim D1 may license, in the strictest true form:

> For the qualified primary executor, under a fixed current observation and a fixed measurement
> contract, a **lawfully manipulated canonical belief credence** causally influenced the
> **structured decision** in the pre-registered direction, above measured self-noise, specifically
> (the negative control did not move) and in a way that followed the belief value under a lawful
> swap — with the belief state having been **authored experimentally, not formed from lived
> experience**.

Not claimable: lived history changed the subject · personality formed · long-term identity proven ·
CharacterOS beats Persona/RAG · human-like cognition.

---

## Failure Consequence

If the primary contrast is absent under **adequate state separation, low noise, underdetermined
probes, both framings, and a valid intervention**, then the honest conclusion is:

```
BELIEF STATE IS CURRENTLY BEHAVIORALLY INERT
```

and the following are **forbidden** as responses: strengthening belief, raising its prompt weight,
writing "you must follow your beliefs", modifying DecisionProbe, or swapping the proposition until
it passes. The negative result is accepted and reported first; any remediation is a **separate**
preregistration with its own justification.

---

## Final Gate

```
D1_PREREGISTRATION_READY
D1 NOT EXECUTED
```

This round made **0 model calls**, formed no lived-history trajectory, and changed no mechanism.
Real calls require reviewer/human approval of this document.
