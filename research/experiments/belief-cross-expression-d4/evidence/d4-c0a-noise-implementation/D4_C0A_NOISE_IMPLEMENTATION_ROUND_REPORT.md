# D4-C0a NOISE/STABILITY IMPLEMENTATION — ROUND REPORT

**`D4_C0A_NOISE_STABILITY_IMPLEMENTED`**
**`D4_C0A_NOISE_STABILITY_EXECUTION_AUTHORISED`**
**`D4_C0A_TARGET_NOT_EXECUTED`** · **`D4_C0B_NOT_PREREGISTERED`** · **`LINK_4_REMAINS_LOCKED`** · **`CHARACTEROS_UNMODIFIED`**
**`MODEL_CALLS_THIS_ROUND = 0`** — no provider call was made, not even to "check" the gate. The evidence
directory contains no `trial-*.json`; `git status packages/` is empty.

---

## 1. §1's EXTRACTION: ALL SEVEN SCIENTIFIC DECISIONS WERE ALREADY FROZEN

Read from the frozen modules, not recalled from an earlier line's implementation:

| decision | frozen source |
| --- | --- |
| construct | `D4C0A_NOISE_GATE.purpose` — "a determinism precondition on a NON-TARGET request" |
| request selection rule | `D4C0A_NOISE_GATE.non_target_request_source` — the named fixture, by frozen manifest order |
| planned calls | `D4C0A_NOISE_GATE.planned_calls` — 6 |
| invalid rule | `D4C0A_NOISE_GATE.invalid_verdict` |
| pass rule | `D4C0A_NOISE_GATE.pass_condition` |
| stop rule | `D4C0A_NOISE_GATE.self_noise_verdict` |
| reachable r values | `D4C0A_NOISE_GATE.reachable_r_values` — `[6]` |

**Missing: 0.** So `D4_C0A_NOISE_DESIGN_BLOCKED_BY_MISSING_FROZEN_DECISION` was not emitted, and no
scientific rule was invented.

**Two things were not frozen**, and `contract-rev3-noise-executable.ts` freezes them at 0 calls
(`noise_outputs_seen_before_amendment: false`, `target_outputs_seen_before_amendment: false`,
`scientific_rule_unchanged: true`):

1. the classifier **name** — `classifyD4C0ANoiseStabilityV0`, an engineering fact;
2. a **target-authorisation rule** — `target_authorised` appears nowhere in the frozen text.

On (2) I recorded a judgement rather than dressing it as a discovery: authorisation is **PROCEDURAL, not
scientific**. The frozen purpose already calls the gate "a precondition", and the frozen reachable outcomes
are exactly `PASS` and `STOP`; a precondition that is not met cannot leave the next stage available. It is
written visibly so a reader who thinks authorisation deserved its own frozen decision can disagree with the
call.

## 2. THE NOISE REQUEST IS REUSED, NOT RE-RENDERED

Resolved by the frozen rule to `D4C0A-QF-A-SUPPORT-TRANSFER`, hash
`sha256:f425b1425d3258ff…`. The audit verifies the frozen qualification artifact's bytes hash to that
value **and** that a deterministic rebuild reproduces the same bytes — so "reuse" is checkable, and a
freshly rendered stimulus was **not** substituted. Confirmed non-target: not a treatment request, not the
canonical pair.

**Prior exposure recorded, not glossed:** the request was called **3 times** during qualification. Those
calls belong only to qualification evidence, do not enter the noise dataset, do not affect the stability
classification, and the denominator stays 6. The stimulus **has been seen before** and
`may_not_be_described_as_never_seen: true`.

## 3. THE CLASSIFIER, AND THE HARD RULE ABOUT CORRECTNESS

`classifyD4C0ANoiseStabilityV0` reads only the frozen records, vocabulary, invalid policy, integrity
requirements and the selected request hash. It never reads qualification correctness, target outputs, an
arm, latency, provider metadata, a clock or a human label.

**Correctness is not stability, and the demonstration needed a correction.** My first assertion pointed at
the `SUPPORTS_B` row — but the selected fixture is `D4C0A-QF-A-SUPPORT-TRANSFER`, whose expected token **is**
`SUPPORTS_B`, so that row **matches** and proves nothing. The evidence is the other two rows:

| row | modal | matched the fixture's expected token | outcome |
| --- | --- | --- | --- |
| `six_identical_token_B` | `OPPOSES_B` | **false** | **PASS** |
| `six_identical_token_C` | `UNCERTAIN_B` | **false** | **PASS** |

Six identical legal tokens that are **not** the fixture's expected token still PASS. A tie now reports
`matched: null` rather than a coincidental value.

**The synthetic matrix**, 8 cases, all as frozen: three six-identical rows PASS with `target_authorised:
true`; five-plus-one, four-plus-two and a 3-3 tie STOP with
`D4C0A_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE`; one invalid and all invalid STOP with
`D4C0A_INCONCLUSIVE_BY_STABILITY_GATE_INVALID_OUTPUTS`; an integrity failure stops too.
**`reachable_r_values: [6]`, `adaptive_replication_present: false`.**

## 4. THE MUTATION HARNESS FORCED A SECOND CONCEPTUAL CORRECTION

§12 requires each mutation to first prove it changed the intended value, then assert the gate fails. It
does — but the run then failed on a row I had mis-classified: **the all-same-different-token row does not
change the gate's result**, because the baseline and the mutant are both six agreeable legal tokens. That
is not a broken mutation; **it is the positive control that proves stability is independent of which legal
token is agreed on.**

Rows are now typed:

| kind | count | requirement | observed |
| --- | --- | --- | --- |
| `FALSIFYING` | 8 | must change the intended value **and** the gate's result | all flip `PASS → STOP` |
| `POSITIVE_CONTROL` | 1 | must change the intended value **and not** change the gate | `PASS → PASS` |

Every row additionally reports `changed_intended_value` — the check that a mutation actually mutated.

## 5. COMPATIBILITY WITH THE TARGET SCORER

The noise gate measures identical-request measurement stability; the target scorer measures
treatment-conditioned directional response. Different questions, so different thresholds are not a
contradiction — the gate can only certify determinism on **one fixed input**, while the target's tolerance
concerns variation across the two **treatment arms**, which the gate cannot observe. **The gate cannot set
`r`**: `r` is 6 before and after, the target stays 6 + 6 = **12**, and the recorded registry shows
`budget_unchanged: true`.

## 6. THE FROZEN, UNEXECUTED PLAN

`D4_C0A_NOISE_SCHEDULE.json` — 6 trials (`NOISE-001..006`), **all referencing the same request hash**,
replicate ordinal absent from the model-facing bytes, `not_yet_executed: true`. Schedule hash
`sha256:00ebd3d10635091c…`, with a check that all six trial hashes are one value.

**Stopped here as required.** No provider call was made even though every gate passed.

## 7. ARTIFACTS

`evidence/d4-c0a-noise-implementation/` — `frozen-noise-decision-audit.json`,
`selected-noise-request-audit.json`, `prior-exposure-report.json`, `noise-classifier-conformance.json`,
`noise-target-scorer-compatibility.json`, `mutation-falsifiability-audit.json`,
`synthetic-noise-classifier-audit.json`, `noise-implementation-manifest.json`,
`contract-rev3-manifest.json`, `D4_C0A_NOISE_SCHEDULE.json`, `d4-c0a-noise-schedule-hash.json`,
`D4_C0A_NOISE_IMPLEMENTATION_VERDICT.json`

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no
credential in any artifact; the revision chain is intact (rev3 preserves rev2 `a1818bc2…` and rev0
`5bac6aa4…`).

**The next round may only:** execute the six frozen noise calls, freeze the dataset before classification,
and classify with the frozen classifier. It may not call the target, design or run C0b, change `r`, modify
CharacterOS, or modify the classifier or its rule.
