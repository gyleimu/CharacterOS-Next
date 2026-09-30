# BELIEF_CAUSAL_PATH_LOCALIZATION_D2 — PREREGISTRATION

> **REVISION 1.1 IS AUTHORITATIVE, TOGETHER WITH THE FROZEN MACHINE-READABLE CONTRACTS.**
> Machine-readable authority: `research/experiments/belief-causal-path-d2/contract-rev1-1.ts`
> (supersedes `contract-rev1.ts` on four scopes only; `contract.ts` is the first-round record).
> REVISION 1 manifest hash `sha256:af836f0ab074f91e513cc179c296c78ece3fe91a4e53566743fe228304e64afc`
> is **preserved**; REVISION 1.1 manifest hash is
> `sha256:e3ff9366242d05d434addc038e0e92fa56ebf811525adb942cb426377250a63e`.
> Call-budget **labels** are corrected by `contract-rev1-1a-budget-erratum.ts`
> (manifest hash `sha256:eb08f5dc08f754fdffeba923367360cacbff1cb609e7619748cfc6407daeddc1`;
> supersedes scope = call-budget labels only; **no number and no scientific design changed**).
> > **D2 model calls before amendment: 0. D1 untouched.** The Markdown below is the first-round
> design; where it disagrees with REVISION 1 / 1.1, **the contracts win**.

---

# REVISION 1.1 — EXECUTION-SEMANTICS CLARIFICATION

This revision re-designs nothing. It freezes three execution semantics that were ambiguous, and
syncs this document to REVISION 1.

## The six-link causal graph (REVISION 1)

```
canonical_belief → projection → structural_readout → proposition_semantic_uptake → epistemic_appraisal → structured_decision
     LINK 1          LINK 2        LINK 3A (D2-A0)        LINK 3B (D2-A1)            LINK 4 (D2-B)      LINK 5 (D1 null)
```

LINK 1 and LINK 2 were established by D1 **without any model call**. LINK 5 is D1's frozen null:
`BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED`, dataset hash
`sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908`. **No successor stage may
run before its predecessor is qualified.**

## A0 / A1 split

| stage | link | asks | endpoint |
|---|---|---|---|
| **D2-A0** | 3A | can the executor read endorsement **direction and approximate magnitude** out of the production projection? | five buckets `ENDORSES_STRONGLY … DOUBTS_STRONGLY` |
| **D2-A1** | 3B | can it transfer the canonical endorsement onto a **differently-worded** formulation that never appears in the state? | `SUPPORTS_… / UNCERTAIN_ABOUT_… / OPPOSES_…` |
| **D2-B** | 4 | is a legible state **used** while processing an underdetermined observation? | `EPISTEMIC_CONFIDENCE = HIGH / MODERATE / LOW` |

A0's scientific name is **structural / numeric legibility**: a positive there is *not* semantic
uptake, *not* cognition use, *not* a behaviour effect. Its prediction semantics are frozen as two
separate verdicts: the **directional** criterion (`STRUCTURAL_DIRECTION_LEGIBLE`) is the **primary
qualification requirement** and is what unlocks A1; the **magnitude** criterion
(`STRUCTURAL_MAGNITUDE_CALIBRATED`) is a **secondary calibration diagnostic**. Both are reported;
there is no post-hoc choice between them.

## Three independent transformers

`buildD2StructuralReadoutRequestV0` · `buildD2SemanticReadoutRequestV0` · `buildD2AppraisalRequestV0`

Each takes a **pristine production V8 request**, substitutes the V8 structured output exactly once,
appends its own measurement contract exactly once, carries its own frozen contract hash, preserves
the production prefix byte-for-byte and fails on an already-transformed request. **DecisionProbeV2
is neither reused nor modified**, and `buildV2Request` is untouched.

## FIX 1 — instrument qualification follows stage gating

Each instrument is qualified **inside its own stage**. All three are **never** qualified up front.

| stage | qualification | then | then | unlocks |
|---|---|---|---|---|
| **A0** | 9 calls (3 state-blind fixtures × 3 replicates) | A0 neutral pilot = 6 | A0 HIGH/LOW = `2r_A0` | A1, only if A0 reaches its frozen positive verdict |
| **A1** | 9 calls | A1 neutral pilot = 6 | A1 HIGH/LOW = `2r_A1` | B, only if A1 is positive |
| **B** | 9 calls | B neutral pilot = 6 | B P1/P2 HIGH/LOW = `4r_B` | nothing further |

A failed qualification ends the run. A failed pilot ends the stage. **A null treatment result does
not unlock the next stage.**

## Per-endpoint neutral pilots

Each endpoint has **its own** 6-call byte-identical NEUTRAL pilot, with the deterministic mapping
`6→6`, `5→14`, `≤4→STOP` (`INCONCLUSIVE_BY_DECISION_NOISE`). Pilots are **never shared** between
endpoints, and D1's `VERIFY 6/6` is **not** D2 noise evidence — the three measurement contracts
differ, so one endpoint's self-noise says nothing about another's.

## FIX 2 — corrected call budget

| stage | formula | r=6 | r=14 | r=20 |
|---|---|---|---|---|
| A0 | `9 + 6 + 2r` | 27 | 43 | 55 |
| A1 | `9 + 6 + 2r` | 27 | 43 | 55 |
| B | `9 + 6 + 4r` | 39 | 71 | 95 |

### Named stop points (REVISION 1.1a erratum — labels corrected, no number changed)

| named stop point | calls | what it means |
|---|---|---|
| `ABSOLUTE_MINIMUM` | **9** | the A0 qualification alone fails; a qualification failure is itself a legitimate stop, so this is the cheapest possible D2 run |
| `A0_PILOT_STOP_MINIMUM` | **15** | A0 qualification passes, the A0 neutral pilot fails (9 + 6) |
| `MINIMUM_COMPLETED_A0_STATE_EXPERIMENT` | **27** | A0 qualification and pilot pass and the A0 state experiment runs to completion at r = 6 (9 + 6 + 12) |
| `A1_QUALIFICATION_STOP_AFTER_A0_R6` | **36** | A0 stage fully complete at r = 6, then A1 qualification fails |
| `A1_PILOT_STOP_AFTER_A0_R6` | **42** | A0 complete, A1 qualification passes, the A1 pilot fails |
| `A0_AND_A1_STATE_EXPERIMENTS_COMPLETE_A1_NOT_QUALIFYING_R6` | **54** | both state experiments run to completion at r = 6 and A1 does not qualify |
| `B_QUALIFICATION_STOP_AFTER_A0_A1_R6` | **63** | A0 + A1 fully qualifying, then B qualification fails |
| `B_PILOT_STOP_AFTER_A0_A1_R6` | **69** | A0 + A1 fully qualifying, B qualification passes, the B pilot fails |
| `FULL_PIPELINE_ALL_R6` | **93** | every stage qualifies and every state experiment completes, all pilots at `modal_count = 6` |
| `ABSOLUTE_MAXIMUM` | **205** | every stage at r = 20 (55 + 55 + 95) |

The two earlier sequential labels are **superseded and recorded, not silently overwritten**:
`minimum overall = 27` is now `MINIMUM_COMPLETED_A0_STATE_EXPERIMENT` (it described a path in which
the A0 qualification *and* pilot had already succeeded, so it was never the minimum), and
`A0 passes, A1 fails = 54` is now
`A0_AND_A1_STATE_EXPERIMENTS_COMPLETE_A1_NOT_QUALIFYING_R6` (the old label did not say *where* A1
failed). **No figure changed; only the labels.**

**REVISION 1's `minimum 45` and `expected 63` are VOID** — recorded as superseded, not silently
overwritten. The reason the floor drops: with stage gating, an A0 failure costs only that stage's
9 + 6 + `2r` calls. **The maximum 205 is unchanged.** D1's 66 calls are not reused.

## FIX 3 — narrowed A1 claim scope

The paraphrase bytes are unchanged and **no additional paraphrase was added**:

```
the view that a finding depending mainly on secondhand report is to be held with reserve
```

This is a **preregistered near-semantic-transfer probe**. It is semantically close to the canonical
CAUTION proposition, but it is **not** a logically exhaustive equivalent of
`information I have not seen myself`.

- **A1 positive** licenses `CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE`.
- **A1 null** must be reported as *semantic uptake was not established for the **preregistered
  paraphrase** transfer*. It may **not** be extended to "the proposition is globally semantically
  unreadable", nor to "semantic uptake is absent in general".

The matrix breakpoint remains `representation → proposition-semantic transfer`, carrying this
limitation.

## Localization matrix

| row | verdict | breakpoint |
|---|---|---|
| A0 null | `BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED` | projection → structural readout (stop; no A1, no B) |
| A0+ A1 null | `BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED` | representation → proposition-semantic transfer (**"cognitively inert" is forbidden here**) |
| A0+ A1+ B null | `BELIEF_STATE_SEMANTICALLY_LEGIBLE_BUT_COGNITIVELY_INERT` | semantic uptake → appraisal use (**only row where "cognitively inert" is licensed**) |
| A0+ A1+ B+ D1 null | `BELIEF_EFFECT_PRESENT_IN_APPRAISAL_BUT_LOST_BEFORE_STRUCTURED_DECISION` | appraisal → decision mapping |

## Claims / non-claims

**D2 can at most establish:** whether the projection is structurally legible; whether the canonical
proposition's endorsement transfers to a preregistered differently-worded formulation; whether a
legible state is used at the appraisal-construct level; and **where the chain breaks first**.

**D2 can never establish:** behavioural causality of belief (D2 has no decision endpoint of its own);
that D1's null was wrong; that a positive readout is behavioural evidence; that the model saying it
"considered the belief" is causal evidence; lived-history formation; history internalization;
autonomous belief formation; cross-transport replication (still `PENDING`); human-like cognition;
personality or relationship effects.

**Prohibited, verbatim:** modifying / re-running / remediating / reinterpreting D1 · strengthening
the CAUTION credence · using 0 or 1 extreme credences to hunt for an effect · adding any "you must
follow this belief" instruction · raising the belief's prompt priority · swapping the proposition
until something turns positive · treating a positive semantic readout as behavioural causality ·
using the model's own statement that it considered the belief as causal evidence · using LLM
explanation, chain-of-thought or self-report as causal evidence in any stage.

---

## Next authorised calls

```
D2_PREREGISTRATION_FINALIZED_REV1_1
D2_A0_AUTHORISED
D2 NOT EXECUTED
D2_MODEL_CALLS = 0
```

The next round's **first and only** batch of calls is **A0 instrument qualification — exactly 9
calls**, with state-blind fixtures that contain no CharacterOS canonical state and no treatment. A
positive qualification proves only that the measurement contract works; it is **not** CharacterOS
evidence. **If A0 qualification fails, the A0 neutral pilot must not run.**


---

# FIRST-ROUND DESIGN (preserved; superseded where it disagrees with REVISION 1.1)

Status: **DESIGN / PREREGISTRATION ONLY. NOT EXECUTED. ZERO MODEL CALLS.**
Repository: `D:\Documents\CharacterOS-Next` · HEAD `02b6c46`
Machine-readable frozen constants: `research/experiments/belief-causal-path-d2/contract.ts`
Predecessor: `BELIEF_STATE_SENSITIVITY_D1_DESIGN.md` (frozen at a null)

**Verdict: `D2_PREREGISTRATION_READY`**

---

## 1. D1 null — formal handoff

| field | value |
|---|---|
| D1 verdict | `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` |
| D1 dataset hash | `sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908` |
| D1 core schedule hash | `sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371` |
| D1 model calls | 66 (6 pilot + 60 core) |
| D1 may be modified / re-run / remediated / reinterpreted | **NO** |

**Established by D1 without any model call (links 1–2):**

- **LINK 1 — Canonical Belief.** A lawful counterfactual credence 0.80 / 0.20 materialises through production genesis authoring, and the full-state isolation diff is **exactly** `["/beliefs/items/0/credence"]` — it is the only canonical state difference.
- **LINK 2 — Projection.** The production V2 projection carries the belief line, and the fully certified model-facing request contains it byte-exactly; request isolation holds after the two frozen normalisations (Revision 3 for the request, Revision 4 for the post-observation state).

**Left unlocalised by D1 (links 3–5):**

- **LINK 3 — Semantic Uptake.** Can the executor recover the proposition's endorsement meaning from the projection *at all*?
- **LINK 4 — Appraisal/Cognition.** Is a legible state *used* while processing the current observation?
- **LINK 5 — Structured Decision.** Does a cognition-level difference survive into the decision?

**What D1 actually showed.** The decision did not move **at all**: `delta_verify = delta_accept = 0.000` against a frozen Wilson ceiling of `0.3903` and `Δ_min = 0.50`, on all five blocks. Two conditions make that null informative rather than vacuous: the negative control was **valid** (`ACCEPT` modal 6/6 in both arms → `NEGATIVE_CONTROL_HELD`, so the executor does discriminate between these constructs on this probe family), and the frame-minimal diagnostic was **also** null (so "the measurement frame suppressed the state" is already excluded — that hypothesis required Full null / Minimal positive).

---

## 2. D2 causal graph

```
canonical_belief ──► projection ──► semantic_uptake ──► appraisal_cognition ──► structured_decision
   LINK 1              LINK 2            LINK 3                LINK 4                 LINK 5
  [D1: established, no model call]   [D1: established, no model call]   [unlocalised]
```

| link | status | tested by |
|---|---|---|
| 1 canonical belief | `MECHANICALLY_ESTABLISHED_BY_D1_WITHOUT_MODEL_CALLS` | D1 state isolation + separation gates |
| 2 projection | `MECHANICALLY_ESTABLISHED_BY_D1_WITHOUT_MODEL_CALLS` | D1 request certification |
| 3 semantic uptake | `UNLOCALISED` | **D2-A** |
| 4 appraisal / cognition | `UNLOCALISED` | **D2-B** |
| 5 structured decision | `UNLOCALISED` | frozen D1 result, combined in D2-C |

**Law:** no link may be tested before its predecessor is qualified. D2-B is not authorised until D2-A qualifies.

---

## 3. D2-A measurement contract — semantic readout

A **research-only instrument**, not a behaviour endpoint. It asks whether the executor can recover the subject's endorsement stance from the production canonical projection.

**Frozen closed set (5 buckets, ordered):**

```
ENDORSES_STRONGLY | ENDORSES_MILDLY | UNDECIDED | DOUBTS_MILDLY | DOUBTS_STRONGLY
```

**Frozen anchors** (scale semantics only — they never say which bucket matches which credence, never mention the subject's state, level or arm):

- `ENDORSES_STRONGLY` — the subject would treat the proposition as settled in its favour and would rely on it without reservation
- `ENDORSES_MILDLY` — leans in favour while still leaving room for doubt
- `UNDECIDED` — no stance either way
- `DOUBTS_MILDLY` — leans against while still leaving room for doubt
- `DOUBTS_STRONGLY` — would treat the proposition as settled against it and would rely on its denial without reservation

**Pre-registered prediction** (written before any call): HIGH 0.80 → `ENDORSES_STRONGLY`; LOW 0.20 → `DOUBTS_STRONGLY`.

**Primary criterion:** the modal bucket for HIGH lies in the endorsing set AND the modal bucket for LOW lies in the doubting set AND **the two modal buckets differ**.

**Fixed:** same canonical identity · same HIGH = 0.80 / LOW = 0.20 · same CAUTION proposition · **the unmodified production projection path** · no history · same primary executor.

**A positive D2-A licenses exactly one claim — `CANONICAL_BELIEF_PROJECTION_SEMANTICALLY_LEGIBLE` — and NOT behavioural causality.**

---

## 4. Semantic-readout construct audit

| requirement | how D2-A satisfies it |
|---|---|
| state-blind instrument | the readout never names a credence, a level, an arm or a treatment; the stimulus is the projection itself |
| no answer written into the task | the question never states which bucket is correct for any state; the anchors define only what each bucket *means* |
| no arm labels | no `HIGH` / `LOW` / `arm` / `treatment` token may appear anywhere in the model-facing request (audited) |
| same projection path | the stimulus is the unmodified production canonical projection; no hand-written subject data |
| no action token | the closed set contains no `ACCEPT` / `VERIFY` / `REJECT` and no action vocabulary |
| not a behaviour endpoint | the readout is orthogonal to D1's decision endpoint by construction |
| distinguishable from a trivial echo | the executor must map a numeric credence onto a *scale of stances* using the anchors; echoing the number does not satisfy any bucket |

**Known limitation, stated up front.** The credence value is literally present in the projection, so D2-A is partly a *lookup* task. That is intentional: if the executor cannot even perform the lookup-plus-scale-mapping, **no** downstream causal use is possible, and that is precisely the first thing worth ruling out. A positive D2-A therefore establishes legibility, not use — which is exactly why LINK 4 needs D2-B.

---

## 5. Leakage audit (freezable, mechanical)

The D2-A request must be audited for all of:

| class | check |
|---|---|
| arm labels | no `HIGH`, `LOW`, `arm`, `treatment`, `credence`, `experiment` as words in SUBJECT DATA or the contract |
| answer hints | no phrase that names a bucket alongside a state; no "the subject endorses" style pre-statement |
| action tokens | no `ACCEPT` / `VERIFY` / `REJECT` anywhere in the D2-A contract |
| history | no `[PRIOR FACTUAL MEMORY]`, no episode ids, no summaries, no provenance, no formation metadata (word-boundary matching, never raw substrings — `information` must not match `formation`) |
| state construction metadata | no seed, authoring or intervention vocabulary |
| duplicate stimulus | the belief line appears **exactly once** |
| cross-arm request isolation | after the frozen Revision 3 normalisation, the HIGH and LOW requests must be byte-identical |

Any failure → `D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE`, **0 calls**.

---

## 6. State isolation reuse plan

D2 reuses D1's machinery verbatim; **no new state semantics are introduced.**

| need | reused artifact (all already frozen and verified) |
|---|---|
| lawful counterfactual state | `world-a1.ts` `buildArmWorldV0` / the parameterised builder — production genesis authoring, belief container the only authored field |
| isolation proof | `diffPathsOf` — HIGH vs LOW must again yield exactly `["/beliefs/items/0/credence"]` (post-observation: the Revision 4 four-path set, normalised back to credence-only) |
| separation gate | 0.80 / 0.20, separation 0.60, both interior |
| projection + request | `buildCognitiveContextProjectionV2ForExplicitV4` + the production V8 renderers |
| request isolation | `normalizeArmSpecificBytes` (Revision 3, unchanged) + `auditNormalizedEquivalenceV0` |
| post-observation isolation | Revision 4 normalisation (unchanged) |
| instrument application | the frozen `buildV2Request` applied exactly once, with the D2-A readout contract substituted for the DecisionProbe contract |

**Explicitly not reused:** the D1 decision endpoint. D2-A's endpoint is the readout; reusing D1's endpoint would make D2-A a re-run of D1, which is forbidden.

---

## 7. Preregistered verdict vocabulary

**Stage-level:**

`D2_PREREGISTRATION_READY` · `D2_DESIGN_BLOCKED` · `D2A_INSTRUMENT_QUALIFIED` · `D2A_INSTRUMENT_UNQUALIFIED`

**Scientific:**

`CANONICAL_BELIEF_PROJECTION_SEMANTICALLY_LEGIBLE` · `BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED` · `BELIEF_STATE_LEGIBLE_BUT_COGNITIVELY_INERT` · `BELIEF_EFFECT_PRESENT_UPSTREAM_BUT_LOST_BEFORE_DECISION` · `CONSISTENT_WITH_D1_NULL_BEING_DECISION_BOUND`

**Inconclusive / blocked:**

`INCONCLUSIVE_BY_DECISION_NOISE` · `INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` · `D2_BLOCKED_BY_STATE_ISOLATION_FAILURE` · `D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE` · `D2_B_NOT_AUTHORISED_BEFORE_D2_A_QUALIFIES`

### Localisation matrix (D2-C)

| row | condition | verdict | where to look next |
|---|---|---|---|
| **A null** | the readout does not track the state | `BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED` | representation / projection semantics; **do not run D2-B** |
| **A+ B null** | reads correctly, appraisal does not follow | `BELIEF_STATE_LEGIBLE_BUT_COGNITIVELY_INERT` | the cognition-side consumption path, not the projection |
| **A+ B+ D1 null** | appraisal moves, decision does not | `BELIEF_EFFECT_PRESENT_UPSTREAM_BUT_LOST_BEFORE_DECISION` | the downstream decision/action mapping |

---

## 8. Call budget

| phase | formula | min | max |
|---|---|---|---|
| Phase 0 offline gates | 0 | **0** | 0 |
| **D2-A** semantic readout | `2r`, `r ∈ [6, 20]` | **12** | 40 |
| **D2-B** appraisal construct (only if D2-A qualifies) | `2r` per probe family (P1, P2) | **24** | 80 |
| **Total if both run** | | **36** | **120** |

D2 is a **separate** budget: D1's 66 calls are **not** reused as D2 evidence. No model call before the Phase 0 gates pass.

---

## 9. Sequential stopping rules

| gate | condition | consequence |
|---|---|---|
| **G1** state isolation | HIGH/LOW diff must be exactly `["/beliefs/items/0/credence"]` (or Revision 4's four-path set normalised back) | `D2_BLOCKED_BY_STATE_ISOLATION_FAILURE`, **0 calls** |
| **G2** leakage | any §5 class fails | `D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE`, **0 calls** |
| **G3** request certification | the D2-A request must pass the same byte-exact normalised HIGH/LOW equivalence D1 used | stop, **0 calls** |
| **G4** pilot | a 6-replicate same-request neutral pilot; if no `r ≤ 20` separates the expected effect from the observed noise | `INCONCLUSIVE_BY_DECISION_NOISE` |
| **G5** D2-A | if the readout does not track the state | `BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED`; **do not run D2-B** |
| **G6** D2-B | authorised only after D2-A qualifies | else `D2_B_NOT_AUTHORISED_BEFORE_D2_A_QUALIFIES` |

---

## 10. Explicit claims / non-claims

**D2 can establish at most:**

1. whether the canonical belief projection is **semantically legible** to the executor (D2-A);
2. whether a legible state is **used** when processing an underdetermined observation, at the appraisal-construct level (D2-B);
3. **where the chain breaks first** — the localisation matrix (D2-C).

**D2 can never establish, and must never be reported as:**

- that belief has behavioural causality — D2 has no decision endpoint of its own;
- that D1's null was wrong, or any reinterpretation of D1;
- that a positive semantic readout is behavioural evidence;
- that the model's own statement that it "considered the belief" is causal evidence;
- lived-history formation, history internalization, autonomous belief formation;
- cross-transport replication (still `PENDING` from the DecisionProbe line);
- human-like cognition, personality or relationship effects.

**Prohibited, verbatim:** modifying / re-running / remediating / reinterpreting D1 · strengthening the CAUTION credence · using 0 or 1 extreme credences to hunt for an effect · adding any "you must follow this belief" instruction · raising the belief's prompt priority · swapping the proposition until something turns positive · treating a positive semantic readout as behavioural causality · using the model's own statement that it considered the belief as causal evidence · using LLM explanation, chain-of-thought or self-report as causal evidence in any stage.

---

## Bottom line

D1 proved links 1 and 2 **without spending a model call**, and its null is *informative* because the negative control was valid and the frame-minimal diagnostic was also null. D2 exists to name the first break: **legibility** (D2-A, 12–40 calls) before **use** (D2-B, 24–80 calls), with a pre-registered matrix that makes each outcome point somewhere specific next.

The most likely first answer, stated before the fact so it cannot be spun afterwards: on the D1 probe family this executor produced a decision determined by the observation alone, and a five-bucket readout of the *stated* credence is a different and much easier task. If D2-A fails, the finding is about the projection's legibility, not about belief. If D2-A passes and D2-B fails, the finding is `BELIEF_STATE_LEGIBLE_BUT_COGNITIVELY_INERT` — which would be the single most useful architectural fact this programme could currently produce.
