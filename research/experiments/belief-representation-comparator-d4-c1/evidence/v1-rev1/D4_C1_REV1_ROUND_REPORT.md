# D4-C1 REVISION 1 — TEMPORAL COMPARATOR CONTROLS — ROUND REPORT

**`D4_C1_PREREGISTRATION_FINALIZED_REV1`**
**`D4_C1_RECORD_STABILITY_IMPLEMENTATION_AUTHORISED`**
**`D4_C1_TARGET_SCHEDULE_FROZEN`**
**`D4_C1_TARGET_NOT_EXECUTED`** · `D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN` · `LINK_4_REMAINS_LOCKED` · `CHARACTEROS_UNMODIFIED`
**`MODEL_CALLS_THIS_ROUND = 0`** · `git status packages/` empty.

`contract-rev1-temporal-and-reference.ts`, manifest `sha256:265368c5a94f7b76…`, preserving revision 0
(`sha256:0e115f94c79b8eb8…`, verified equal). `scientific_content_changed: false`.

---

## 1. THE EXPLICIT REFERENCE REPRODUCES C0a BYTE-FOR-BYTE

§1's gate was the round's most important check, and it passed on the strictest reading:

- the frozen C0a target requests were **reconstructed from the frozen pieces** — base text, contract,
  schema, binding renderer, arm bindings — and their hashes match the frozen values
  (`0bad19fc…` SUPPORT, `bd195ef5…` OPPOSE);
- the C1 explicit cells were built independently and are **byte-identical**: hash equal **and** the
  system and user messages equal as strings;
- **`semantic_equivalence_was_not_accepted_as_sufficient: true`** — the check is bytes, not intent;
- had it failed, the run would have stopped and reported the differing bytes.

**One durability gap closed:** C0a's target request *bytes* were never written to disk — only their hashes
were frozen in its schedule. This round persists them
(`c0a-frozen-target-{support,oppose}-request.json`) so the identity is durable for every later round.

## 2. FOUR-WAY ISOLATION

| pair | differing lines | all differences are the stance value |
| --- | --- | --- |
| every one of the six cell pairs | **1** | **yes** |

After the frozen sentinel normalisation the four requests collapse to **one distinct form**, and
`treatment_correlated_differences: 0`. The allowed difference classes are exactly two: **stance polarity**
(`SUPPORTS` vs `OPPOSES`, or `0.80` vs `0.20`) and **representation form** (explicit lexical stance vs the
production three-field belief record).

**§4's claim boundary is frozen in the wording itself:** the record condition may be described only as
*"CURRENT CHARACTEROS BELIEF-RECORD REPRESENTATION IN A MATCHED STATE-BLIND RESEARCH FRAME"*. Calling it
"the production CharacterOS condition" is forbidden, because production placement, the full subject state
and the production framing are all deliberately removed — C1 measures **representation-form usability**,
not production-context usability.

## 3. THE 24-CALL BLOCKED TEMPORAL DESIGN

**`RERUN_BOTH_CONDITIONS_CONTEMPORANEOUSLY`** stands as a **provider-drift control, not a cost decision**:
a hosted model with no pinned revision makes a cross-session comparison unattributable.

Six four-trial blocks, **each containing exactly one of each cell**:

| block | order |
| --- | --- |
| 1 | E-SUPPORT, E-OPPOSE, R-OPPOSE, R-SUPPORT |
| 2 | E-OPPOSE, R-SUPPORT, E-SUPPORT, R-OPPOSE |
| 3 | R-SUPPORT, R-OPPOSE, E-OPPOSE, E-SUPPORT |
| 4 | R-OPPOSE, E-SUPPORT, R-SUPPORT, E-OPPOSE |
| 5 | E-SUPPORT, E-OPPOSE, R-OPPOSE, R-SUPPORT |
| 6 | E-OPPOSE, R-SUPPORT, E-SUPPORT, R-OPPOSE |

Per-cell totals **6 / 6 / 6 / 6**; the ordering rule is a balanced-Latin-square row keyed on the block
index, so it is deterministic, outcome-blind, and independent of latency, timestamps, qualification or
stability token identities, and human choice. Neither forbidden structure — 12 explicit then 12 record, or
12 SUPPORT then 12 OPPOSE — appears.

**Temporal balance, measured rather than asserted:** `max_consecutive_same_representation: 3`,
`max_consecutive_same_stance: 2`, with every cell's ordinal positions recorded
(E-SUPPORT at 1, 7, 12, 14, 17, 23).

**A small honesty note:** I estimated the representation run as 2 before running the audit; the audit
computed **3** (a run crossing the block-2/block-3 boundary). The reported number is the computed one —
which is the reason the audit computes these metrics instead of asserting them.

**The claim is bounded as required:** the design *reduces systematic collinearity* between representation
and execution-time ordering. It does **not** "eliminate all provider drift" — no within-session design can,
and that phrasing is frozen as forbidden.

## 4. THE RECORD-FORM STABILITY FIXTURE

A **non-target** synthetic proposition (`A clamp should always be used when gluing a joint.`) at credence
`0.95` — not an experimental value — with its `proposition_id` **derived by the production derivation**,
never hand-written:

```
{"proposition_id":"belief-prop-v0-ac9a923f23c86246…","proposition_label":"A clamp should always be used when gluing a joint.","credence":0.95}
```

Verified: it does **not** use the canonical A/B target pair. It measures identical-request self-consistency
of the measurement path on the **record input form**; its outputs enter the comparator dataset **not at
all**, and the 24 target trials are **not** used as a stability pilot.

**Correctness stays out of the stability verdict**, exactly as in C0a and D3: six-of-six agreement passes
even when the token is not the fixture's expected one, and no contrary rule is frozen anywhere.

## 5. PRESERVED, AND THE NEXT-ROUND BOUNDARY

Record bytes, credences, A/B literals, the explicit relation, the measurement contract, its anchors, the
vocabulary, the scorer, the C0a historical result and CharacterOS production code are all unchanged.
**Requalification stays 0** because the measurement instrument did not change; the new variable is the
stance representation. The scorer's acceptance region is unchanged (unique modal **and** ≥ 4 of 6).

**The next round may only:** implement the frozen record-cell renderer and the record-form stability
fixture, pass a zero-call offline conformance gate, freeze the implementation hashes, execute **only** the
six record-form stability calls, freeze that dataset, classify, and **stop**. It may **not** run the
24-call target in the same round.

## ARTIFACTS

`research/experiments/belief-representation-comparator-d4-c1/evidence/v1-rev1/` —
`reference-identity-audit.json`, `c0a-frozen-target-support-request.json`,
`c0a-frozen-target-oppose-request.json`, `four-way-isolation-audit.json`, `target-schedule-24.json`,
`record-stability-fixture.json`, `contract-rev1-manifest.json`, `D4_C1_REV1_VERDICT.json`

D4-C0a's dataset recomputes (`8a6ca2c8…`). `tsc -p tsconfig.auxiliary.json` and
`eslint --max-warnings 0` clean; `pnpm governance` PASS; no credential in any artifact.

**Stopped here.** No model was called, CharacterOS was not modified, and the target was not executed.
