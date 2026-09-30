# HISTORY INTERNALIZATION TEST V1 — PREREGISTRATION

**Status:** `HISTORY_INTERNALIZATION_V1_DESIGN_READY` · **`MODEL_CALLS_THIS_ROUND = 0`** ·
**`CHARACTEROS_UNMODIFIED`**
**Version:** V1 · **Frozen:** 2026-09-21 · **Executed:** NO — this document authorises no calls by itself.

**Highest governing principle:** **THE LLM IS AN EXECUTOR, NOT THE SUBJECT.** The subject is the canonical
state and its persistent transition rules. The model renders cognition *from* that state. Every claim below
is a claim about the state and its causal reach, never about the model's dispositions.

---

## 1. SCIENTIFIC QUESTION

> **A long-lived artificial subject — does it form a persistent internal change because of a life it
> actually lived, and do those changes continue to causally influence future cognition and behaviour
> without re-reading the raw history?**

Decomposed into the five propositions the experiment must actually measure:

- **P1** a lived trajectory changes canonical internal state;
- **P2** that state change **persists**;
- **P3** with the raw history removed, the state change still alters **cognition**;
- **P4** the alteration is **caused by the state**, not by residual context — demonstrated by intervention;
- **P5** the alteration is **not** reproducible by a stateless or summary baseline.

## 2. NORTH STAR LINK

Experience → Persistent Internal Change → Current State → Cognition → Decision / Behaviour.

The belief micro-line closed the "State → Cognition" link for an **authored** difference (D2-A0) and left
"State → Decision" a measured null (D1). This experiment attacks the **entry point** the whole chain
depends on: does *lived* experience reach the state at all. Nothing in the micro-line may be re-opened
under cover of this experiment (see the handoff artifact).

## 3. EXISTING EVIDENCE (reused, not re-measured)

| proposition | status | source |
| --- | --- | --- |
| canonical belief state is authorable, lawful and isolated | `ESTABLISHED` | D1 |
| canonical belief state is legible to the executor as a stance on its proposition | `ESTABLISHED` | D2-A0, 6/6 both arms |
| the canonical state reaches the production projection | `ESTABLISHED` | D2-A0 on real production state |
| the three-field belief record is not what blocks composition | `ESTABLISHED` | D4-C1, 4 cells 6/6 |
| a lived-evidence → belief-adaptation chain is **wired and driven every turn**, durable, write-once | `VERIFIED IN PRODUCTION CODE` | `belief-adaptation-wiring-v0.ts`; `interactive-subject-runtime-v0.ts:633,678-685` |
| relationship familiarity is likewise driven per turn | `VERIFIED IN PRODUCTION CODE` | `:705` |
| personality adaptation is **not driven** (optional factory, unsupplied) | `VERIFIED IN PRODUCTION CODE` | `explicit-v4-session-authority-v0.ts:597` |
| affect application is present but not wired to turns | `VERIFIED IN PRODUCTION CODE` | `affect-application-executor-v0.ts` |
| no same-turn self-causation: turn N's learned state can only influence turn N+1 | `FROZEN PRODUCTION LAW` | `interactive-subject-runtime-v0.ts:690` |

Full detail: `HISTORY_INTERNALIZATION_EVIDENCE_MAP.md`, `evidence/v1/CURRENT_EXPERIENCE_INTERNALIZATION_PATHS.json`.

## 4. MISSING EVIDENCE (what only this experiment can supply)

- **M1** whether *lived* evidence moves credence at all — D1 used an **authored** difference and therefore
  says nothing about the channel.
- **M2** whether a lived state change survives restart *behaviourally* (state fidelity is tested; the
  behavioural survival is not).
- **M3** whether a state difference generalises to a **new scenario, new characters, new topic**.
- **M4** whether the effect is **state-mediated** rather than context-mediated (no intervention has ever
  been run).
- **M5** whether the effect separates from a **profile-summary baseline**.

**M1 is a precondition, not a measurement.** If it fails, the experiment stops — see §20 Failure A.

## 5. SUBJECT INITIALIZATION

Two subjects, **new characters** unused by D1–D4, created from the **same** production seed:

- `createInteractiveSubjectSeedV0` → `materializeSubjectStateV4V0`, then
  `createInMemorySubjectCoreFacadeForExplicitV4V0`.
- **Alice-A** and **Alice-B** differ **only** in identity fields (`subject_id`, display name). Everything
  else — every canonical component, every initial value, every proposition set — must be **byte-identical**.
- **Frozen parity check (must pass before any trajectory call):** canonicalise both initial `SubjectStateV4`
  values with the program's canonical JSON; strip the identity fields by an explicit, frozen field list;
  require the remaining bytes to be **equal**, and require the *raw* bytes to be **unequal** (a parity check
  that cannot fail is not a check).
- Initial belief component: **empty proposition set** (no seeded credence). Seeding a credence would import
  D1's authored-difference method and destroy the experiment's point.

## 6. CONTROLLED TRAJECTORY A

A **lived** trajectory: turns driven through the production turn loop so the per-turn adaptation chains fire
naturally. Not an authored state injection.

- **Frozen turn text set** `TRAJ_TURNS[1..N]`, one utterance pair per turn (user event, subject reply),
  authored once, hash-frozen.
- The trajectory's evidence concerns a **single target proposition family** carried by the events.
- Every turn declares the **same** salience (the production default `0.5`) — no salience is varied between
  subjects.
- Turn count `N` is set by the §22 pre-flight calibration, then frozen.
- **Frozen consequence of the production ordering law** (`interactive-subject-runtime-v0.ts:690`: turn N's
  learned state can only influence turn N+1): an effect of turn 1 on turn 1 is **inexpressible by
  construction**, so `N ≥ 2` is required for any trajectory effect to exist at all, and a single-turn
  trajectory would make Failure A **unfalsifiable rather than diagnostic**. `N = 12` satisfies this.

## 7. CONTROLLED TRAJECTORY B

Generated from trajectory A by **exactly one substitution**: a frozen `VALENCE_TABLE` mapping each
evidence-bearing span of A to its **matched opposite-valence** span in B. Matched on:

- turn count, turn index, ordering, and inter-turn timing;
- event type, participant roles, and utterance **syntactic shape**;
- utterance length (within a frozen tolerance) and salience;
- topic domain and named entities.

**Mechanical diff requirement:** a frozen `diffTrajectoriesV0(A, B)` must report that A and B differ on
**exactly the spans in `VALENCE_TABLE`** and on **no other byte**, and that they are equal on every matched
dimension. A diff that reports any other difference **invalidates the trajectory pair before execution**.

## 8. HISTORY REMOVAL PROTOCOL

The test phase runs in a **new session** built from the **persisted canonical state only**:

1. Serialise the canonical `SubjectStateV4` through the production persistence path.
2. Destroy the trajectory session: no episode store, no transcript, no trajectory runtime retained.
3. Restore a session from the serialised state via the production restore path.
4. Test-phase requests therefore contain **the canonical state block and nothing else derived from the
   trajectory**.

**The state block is the legitimate carrier** — the experiment measures whether the state carries the
effect. Therefore the leakage audit must distinguish the carrier from a leak: the *proposition labels and
credences in the state* are permitted; *raw trajectory text and episode metadata* are prohibited.

## 9. LEAKAGE AUDIT

Frozen as an executable check that must run and pass on the **exact bytes** of every test-phase request
before that request is sent. Forbidden substrings, each with a positive-control mutation proving the check
can fail:

- every trajectory turn's verbatim utterance text (both A's and B's);
- any trajectory `episode_ref` or observational-experience id;
- any trajectory timestamp or turn ordinal;
- the arm labels (`TRAJECTORY_A`, `TRAJECTORY_B`, `ALICE_A`, `ALICE_B`) and any arm-identifying mapping;
- the `VALENCE_TABLE` keys;
- any per-subject expected-output token or scoring key;
- the request hash.

Additionally: the audit must run on the **frozen test request bytes** (not on a re-render), following the
program's established rule that the audit calls the frozen procedure rather than re-implementing it.

## 10. TEST SCENARIOS

**Five scenarios**, all with **new characters, new setting and new topic**, none appearing in either
trajectory, each interrogating a different domain from §12's list:

| id | domain interrogated |
| --- | --- |
| `S1-TRUST` | trust in a new person |
| `S2-RISK` | willingness to take a risk |
| `S3-EXPECT` | expectation about a future event |
| `S4-RELATION` | stance toward an unfamiliar relationship |
| `S5-DECIDE` | a structured choice |

Each scenario is **state-blind with respect to the trajectory** (§9) and identical for A and B **byte for
byte except the state block**. Frozen as a request pair; the pair's only permitted difference is the state
block, verified by the same mechanical-diff rule as §7.

## 11. CANONICAL STATE READOUT

Read at three checkpoints, and stored as canonical JSON:

- `STATE_T0` — after initialization (parity-checked, §5);
- `STATE_T1` — after the trajectory;
- `STATE_T2` — after restart restore.

Readout reports, per component: belief propositions (`proposition_id`, `proposition_label`, `credence`),
relationship familiarity, and presence/absence of personality and affect components. The readout is a
**state** readout, produced by the production read paths — never by parsing model output.

## 12. BEHAVIOURAL READOUT

Per scenario, the subject produces a response through the production cognition path. Frozen observables
recorded per scenario, in the domains the brief names: trust, risk, expectation, belief, relationship,
affect, decision, behaviour.

**Primary observables are cognitive** (what the subject attends to, expects, and asserts). **Decision and
behaviour observables are secondary and explicitly registered as at-risk-of-null**, because D1 measured a
null on authored credence → structured decision. Reporting a decision null here is a valid result, not a
failure of the experiment.

## 13. STATE INTERVENTION

The strongest available causal control.

- Build a **counterfactual** pair at the canonical level: `A′ = A` with B's **belief component** and `B′ = B`
  with A's belief component, using the product's own seed/commit path (the D1 method).
- Re-run the five scenarios for `A′` and `B′` from a restored session with history absent.
- **Prediction:** the response difference pattern must **follow the state**, not the subject — `A′` behaves
  like `B` and `B′` like `A` on whatever dimension differed.
- **Only the belief component is swapped.** Swapping everything would make the control uninformative about
  which carrier matters.

## 14. ABLATION

- Build `A₀` = A with the belief component reset to `STATE_T0`'s (empty) proposition set; likewise `B₀`.
- Re-run the five scenarios.
- **Prediction:** if the trajectory-induced difference is carried by the belief component, the A-vs-B
  difference **collapses** under ablation.
- Ablation is run **after** intervention, not instead of it: intervention shows the state *is sufficient*,
  ablation shows it is *necessary*.

## 15. RESTART PHASE

- Shut down the subject runtime entirely; release in-memory state.
- Restore from the **durable store** via the production restore path.
- Confirm `STATE_T2` equals `STATE_T1` under canonical comparison (state fidelity).
- Re-run the five scenarios with history still absent.
- **Prediction:** a difference that existed before restart is still present after it.

## 16. BASELINES

| baseline | what it is | what it tests |
| --- | --- | --- |
| **B0 stateless** | a fresh subject each turn, no persistent state, identical scenario text | the effect requires persistence at all |
| **B1 profile summary** | the trajectory's *content* supplied as a **text summary** in the prompt instead of canonical state | the effect requires **state**, not merely information |
| **B2 CharacterOS** | the canonical-state subject under test | the object of study |

**B1 is the baseline that matters.** Beating B0 is nearly guaranteed and is not the claim. The claim is that
a canonical, restorable, intervention-sensitive state carries the effect in a way a summary does not.

## 17. METRICS

- **Primary:** `cross_scenario_cognition_difference_rate` — over the five scenarios, the fraction in which
  the frozen classifier judges A's and B's cognitive observables to differ on the target dimension.
  Reported with a Wilson 95% interval; `Δ_min = 0.50` as in the program's established convention.
- **Secondary:** `state_sensitivity_of_cognition` (intervention arm), `ablation_reversal_rate`,
  `restart_retention_rate`, `baseline_separation_margin` (B2 vs B1).
- **Supporting:** per-component canonical state delta `T0→T1`; belief credence trajectory.

## 18. FROZEN SCORING RULES

Frozen **before any call**, as executable pure functions with their own qualification:

- `classifyScenarioDifferenceV0` — per scenario, per dimension: does A differ from B. Must be **able to
  return both verdicts** on constructed inputs, and must **fail closed** on unparseable output (unparseable
  ≠ different).
- `classifyStateDeltaV0` — per component: changed / unchanged, from canonical state only.
- **Ties and ambiguity fail closed** to `NOT_DIFFERENT`, per the program's standing law.
- **A single authorised scorer per metric**, frozen and named, checked by an audit that *calls* it rather
  than re-implementing it.
- Scorers are frozen **before the pre-flight**, so that the pre-flight cannot be scored post hoc.

## 19. INVALID POLICY

- A call that is a refusal, a truncation, or produces output the frozen parser cannot read is **`INVALID`** —
  **not** a null, and **not** a difference.
- ≥2 invalid calls in any five-scenario block → that block is `INCONCLUSIVE`.
- Any invalid call in the **pre-flight** → `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE`; **no retry, no
  substitution, no re-run**.
- `NULL ≠ INCONCLUSIVE`: a scored block with no difference is a **valid null** and is a scientific result.
- No request may be modified after the first trajectory call; no model, timeout, parser or generation
  setting may be changed in response to an anomalous cell.

## 20. FALSIFICATION CRITERIA

Each failure names **exactly which causal link does not exist**. These are the outcomes the design is built
to be able to report honestly.

| id | condition | verdict it forces |
| --- | --- | --- |
| **A** | the pre-flight shows the belief component does **not** move under lived evidence | `HISTORY_INTERNALIZATION_V1_BLOCKED_BY_ARCHITECTURAL_GAP` — the link **Experience → State** does not exist in production. **No further stage runs.** |
| **B** | state moves (`T0→T1` differs) but no cross-scenario cognition difference | the link **State → Cognition** is not established for a *lived* difference (note: D2-A0 established it for an *authored* one — the discrepancy itself is the finding) |
| **C** | cognition differs but the intervention arm does **not** follow the state | the difference is **not state-mediated** — it is context-mediated; the canonical-state claim fails |
| **D** | the effect is present pre-restart but absent post-restart | **State persistence** fails behaviourally, despite state fidelity |
| **E** | the effect matches **B1 (profile summary)** as well as B2 | CharacterOS is **not distinguishable from a summary**; the architecture earns nothing |

A **null** on any of B–E is a first-class result. A null does **not** authorise adding a mechanism.

## 21. CLAIM BOUNDARIES

**What a positive result would license:**

- that a lived trajectory changed canonical state (P1/P2);
- that the change altered cognition in a **new** scenario with the history removed (P3);
- that the alteration was **caused by the state** (P4, via intervention);
- that it separated from a summary baseline (P5).

**What it would NOT license — regardless of outcome:**

- any claim about the **model's** internal dispositions. The LLM is an executor; the subject is the state.
  "Alice changed her mind" means *the canonical state changed and the executor rendered it*, never that the
  model internalised anything.
- any claim about the **personality** or **affect** channels — both are out of scope (§4, and both are
  un-driven in production).
- any claim about **subjective experience**, feeling, or consciousness.
- any claim about **generalization** beyond the five tested scenarios.
- any authorisation to **modify CharacterOS**. Even a fully positive result licenses only further
  measurement.
- any re-opening of the belief micro-line's deferred hypotheses (`DEFERRED_LOCALIZATION_HYPOTHESES`).

## 22. CALL BUDGET

Accounting convention: one **turn** through the production loop costs **1 cognition call + 1 belief-adaptation
semantic call = 2 calls**. The pre-flight **measures** the actual per-turn count; if it differs, the budget
is recomputed and re-frozen **before** any trajectory call.

| phase | calls | derivation |
| --- | --- | --- |
| **0 · pre-flight calibration** | 12 | 3 turns × 2 subjects × 2 calls — establishes M1 and sets `N` |
| **1 · trajectories** | 48 | `N = 12` turns × 2 subjects × 2 calls |
| **2 · test (history removed)** | 10 | 5 scenarios × 2 subjects |
| **3 · state intervention** | 10 | 5 scenarios × 2 counterfactual subjects |
| **4 · ablation** | 10 | 5 scenarios × 2 ablated subjects |
| **5 · restart** | 10 | 5 scenarios × 2 subjects |
| **6 · baselines** | 15 | B0: 5 × 1; B1: 5 × 2 |
| **total** | **115** | frozen |

`N = 12` is the **initial** value; the pre-flight sets it by a frozen rule:
`N = ceil(Δ_required / Δ_measured_per_turn)`, capped at 24, with `Δ_required` frozen as the smallest credence
change the §18 state classifier reports as `changed`. If the rule yields a cap-exceeding `N`, the experiment
stops as **Failure A**.

## 23. STOP RULES

1. **Pre-flight gate.** If M1 fails at phase 0, **STOP** with Failure A. Phases 1–6 do not run.
2. **Trajectory gate.** After phase 1, if `STATE_T0` and `STATE_T1` are canonically identical for **both**
   subjects, **STOP** with Failure A. If only **one** subject's state moved, **STOP** as
   `INCONCLUSIVE_TRAJECTORY_ASYMMETRY` — the control failed, not the hypothesis.
3. **Phase independence.** Each phase is scored and frozen before the next begins. No phase may be
   re-run, extended, or supplemented with extra replicates.
4. **No rescue.** No request, scorer, prompt, model or generation setting may change once phase 1 begins.
5. **No mechanism.** A null never authorises implementing a new mechanism. This experiment measures
   already-wired paths only.
6. **Final stop.** After phase 6 is scored and frozen, **STOP** — regardless of verdict.

---

## CAUSAL EVIDENCE HIERARCHY

The levels are **ordinal and cumulative**: a claim at level *k* requires levels 0..*k*−1 to have been
established. The current program sits at **Level 1**.

| level | claim | how it is established | current status |
| --- | --- | --- | --- |
| **L0** | the executor can render a supplied state at all, state-blind | D3-B / D4-C0a / D4-C1 (state-blind capabilities) | `ESTABLISHED` |
| **L1** | canonical state is authorable, lawful, and legible as a stance | D1, D2-A0 | `ESTABLISHED` |
| **L2** | **lived** experience changes canonical state | phase 0 + phase 1 | **`MISSING` — the target of this experiment** |
| **L3** | the lived state change alters cognition in a **new** scenario with history removed | phase 2 | `MISSING` |
| **L4** | the alteration is **caused by the state** (intervention reverses/follows it) | phase 3 (+ phase 4 for necessity) | `MISSING` |
| **L5** | the alteration **survives restart** | phase 5 | `MISSING` |
| **L6** | the alteration **separates from baselines** (B0 and, decisively, B1) | phase 6 | `MISSING` |

**Reading rule.** A partially positive result is reported at the **highest contiguous level reached**. A
result that reaches L2 and stops is a **meaningful, publishable finding** — it would be the first evidence
in this program that lived experience reaches the canonical state. It must not be narrated as "history
internalization works".

## VERDICT VOCABULARY (frozen)

`HISTORY_INTERNALIZATION_V1_BLOCKED_BY_ARCHITECTURAL_GAP` (Failure A) ·
`HISTORY_INTERNALIZATION_V1_VALID_NULL_AT_L{k}` · `HISTORY_INTERNALIZATION_V1_POSITIVE_TO_L{k}` ·
`HISTORY_INTERNALIZATION_V1_INCONCLUSIVE` · `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE_TRAJECTORY_ASYMMETRY`

---

## WHAT THIS ROUND DID NOT DO

`MODEL_CALLS_THIS_ROUND = 0`. No pilot was run to "see how it looks". No trajectory, no test, no
production change, no new mechanism, no new module. The audit that produced
`CURRENT_EXPERIENCE_INTERNALIZATION_PATHS.json` read production code and wrote only research artifacts.
`CHARACTEROS_UNMODIFIED`.
