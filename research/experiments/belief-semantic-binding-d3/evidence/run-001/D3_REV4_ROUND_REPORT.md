# D3 REVISION 4 — THE NOISE RULE AS A STABILITY GATE — ROUND REPORT

**`D3_PREREGISTRATION_FINALIZED_REV4`**
**`D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER`**
**`D3_B_NON_TARGET_NOISE_PILOT_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 9`** — **0 calls this round.**

`contract-rev4-noise-stability-gate.ts`, manifest `sha256:b5f962f03ce6e33a…`, preserving revision 3
(`sha256:07e6a52a8eec4ec3…`).

---

## 1. THE INCOMPATIBILITY

Revision 3 kept the noise pilot's r-extension mapping — `6 → r = 6`, `5 → r = 14`, `≤ 4 → STOP` —
alongside the frozen target scorer's **unanimity** requirement. Those two rules cannot both stand:

> under unanimity, increasing `r` does not *absorb* trial-level variability; it *raises the number of
> agreements required*. Five agreeing trials out of six already fail a six-trial unanimity target, and
> fourteen trials demanding fourteen agreements fail strictly harder.

So `5 → r = 14` could never convert a noisy endpoint into a positive. It could only spend fourteen
further calls confirming a failure. **The branch was self-defeating, not merely useless.** The mapping is
not wrong in general — it suits a *modal-based* confirmation criterion, where extra trials can outvote
noise — it is incompatible with *this* scorer.

Found at `d3_b_noise_calls_before_amendment = 0` and `d3_b_target_calls_before_amendment = 0`, and
classified explicitly as a **scorer-compatibility correction, not outcome-based tuning**.

## 2. THE STABILITY GATE

The pilot still runs six byte-identical calls of the frozen non-target synthetic request. It no longer
enlarges the target sample:

| observed pilot | verdict | `r_confirm_B` | target |
| --- | --- | --- | --- |
| all six legal and all six agree | `D3_B_NOISE_STABILITY_GATE_PASS` | **6** | authorised |
| all six legal, unique modal count ≤ 5 (including a tie) | `D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE` | null | not authorised |
| any invalid | `D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS` | null | not authorised |

**The only reachable `r_confirm_B` is 6.** No extra pilot replicates; no conversion to 14; the frozen
invalid policy applies unchanged.

**The gate is on agreement, not correctness** — and that is deliberate. It requires the six calls to agree
with *each other*; it does **not** require the modal token to equal the fixture's pre-registered expected
relation. This is the distinction the D2 neutral pilot established: agreement is a property of the
executor, correctness is a property of the fixture, and only the former belongs in a noise calibration.

## 3. THE SUPERSEDED BRANCH, RETIRED PROSPECTIVELY

`5 → r_confirm_B = 14` is marked `SUPERSEDED_BEFORE_ANY_D3_B_NOISE_OR_TARGET_OUTPUT`, retired
prospectively, with `history_deleted: false` — the historical contract and the historical classifier
(`classifyD3BNoisePilotV0`) are retained. The audit shows the difference in one line: **on five-plus-one,
the superseded classifier returns `r = 14`; the gate returns
`D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE` and funds nothing.**

## 4. PRESERVED

Target pair, expected target relation, target request, target scorer, the unanimity positive criterion,
vocabulary, anchors, transformer, qualification result and all D1/D2 evidence are untouched — recorded as
explicit `*_changed: false` fields. Target positive still requires all planned trials legal **and** every
relation token equal to the expected relation; any legal dissent yields the frozen valid NULL; any
invalid or integrity failure yields the frozen INCONCLUSIVE. **The target's scientific meaning is
unchanged.**

## 5. BUDGET

| | |
| --- | --- |
| qualification (done) | 9 |
| noise pilot | 6 |
| target, **only if the gate passes** | 6 |
| complete success path | **21** |
| absolute maximum | **21** |
| total if the gate fails | **15** — no target calls |
| superseded maximum | 29 |

D3-A 0, D2-B 0.

## 6. THE NOISE REQUEST IS UNCHANGED, AND ITS PRIOR EXPOSURE IS RECORDED

Still `D3B-QF-A-ALIGNED`, still exactly `sha256:82a8678e044fd802…`, re-verified against the frozen
qualification artifact. No reselection, and no reselection from qualification outputs.

**Stated plainly rather than glossed:** that exact request was already called **3 times** during
qualification. Those calls occurred before this batch, belong exclusively to qualification evidence, are
**not** in the noise pilot dataset, do **not** influence the six-call classification and are **not**
target evidence. The new six calls are a prospectively frozen independent calibration batch — but the
selected calibration request **has** been observed before, and must not be described as a
never-before-seen calibration stimulus. What that does not undermine: the gate reads agreement *among the
six new calls*, and prior exposure cannot make six identical answers more or less agreeing than they are.

## 7. MECHANICAL AUDIT — THE FROZEN GATE CALLED, NOT RE-IMPLEMENTED

Six cases, all passing: six-identical → PASS with `r = 6` and target authorised; five-plus-one → self-noise
inconclusive; four-plus-two → self-noise inconclusive; a 3/3 tie → self-noise inconclusive; one invalid and
six invalid → invalid-inconclusive. `any_path_yields_r_14: false`;
`only_six_mutually_agreeing_calls_authorise_the_target: true`; `r_values_reachable: [6]`.

**One thing the compiler caught that is worth keeping.** Two assertions of the form `r === 14` were
rejected by TypeScript as having no possible overlap — the type system independently confirming that the
gate cannot produce 14. But an assertion that *cannot* be true is an assertion that can never *fail*,
which is the anti-pattern this program has been hunting. The comparisons were widened to `number | null`
so the "never 14" claim is falsifiable at runtime rather than vacuously true.

## 8. ARTIFACTS

`evidence/run-001/rev4/` — `d3-rev4-audit.json` (the six gate cases, the request-identity check and the
prior-exposure record), `contract-rev4-manifest.json`, `D3_REV4_VERDICT.json`

Verified after: the D3-B qualification dataset (`04f232f3…`), D2-A0 (`eb8be177…`), D2-A1 (`2cacbf01…`)
and D1 (`02bd7e31…`) all still recompute. No credential in any artifact. `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The next round may only: run the six-call non-target noise pilot on the frozen noise
request, freeze its dataset before scoring, and classify it with `classifyD3BNoiseStabilityV0` — on PASS,
freeze the six target calls; otherwise stop. It may not call the D3-B target request, widen `r` beyond 6,
execute D3-A, execute D2-B, or modify any frozen artifact.
