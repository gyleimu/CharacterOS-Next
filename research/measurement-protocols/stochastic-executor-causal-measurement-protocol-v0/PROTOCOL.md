# STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — specification

The measurement protocol for the **next** confirmatory Belief→Cognition experiment. It replaces
the single-draw paired identity law that V0 used (and that the independent audit called
`NULL_CRITERION_MIS-CALIBRATED_TO_EXECUTOR_NOISE`) with a distribution-level law.

**This document is a design artifact. It performs no model calls and contains no experiment
results.** All numbers below are computed offline and exactly: see
`evidence/power-analysis.json` (`sha256:f39e1fc9…`, produced by `cli.ts power`), which is
reproducible byte-for-byte at any commit.

## 1. Measurement model

For a fixed model-facing input `X`, the executor returns a draw from `Y ~ P(Y | X)`. The estimand
per cell is a probability, not an output:

```
p_cell = P(REALIZE_CURRENT_INTENT | frozen cell input)
```

No contrast is ever decided by whether two draws happened to match.

## 2. Outcome

`communication_directive.kind` ∈ {`REALIZE_CURRENT_INTENT`, `CLARIFY_MISSING_CONTEXT`} — the frozen
production field. Free-text sentiment, keyword matching, manual judgement and LLM judges are
forbidden as outcomes, and the production cognition schema is never modified.

## 3. Cells and estimands

| cell | durable state | model-facing mediator |
| --- | --- | --- |
| A | LOW belief | as stored |
| B | HIGH belief | as stored |
| C | HIGH belief | target item removed (research-only view) |
| D | LOW belief | target presented with the HIGH credence (research-only view) |

| contrast | estimand | question | claim type |
| --- | --- | --- | --- |
| C1 | ΔAB = pB − pA | total belief-mediated cognition effect | superiority ≥ Δ_min |
| C2 | ΔBC = pB − pC | mediator necessity | superiority ≥ Δ_min |
| C4 | ΔDA = pD − pA | mediator sufficiency | superiority ≥ Δ_min |
| C3 | ΔBD = pB − pD | residual direct history / canonical-state effect | **equivalence** \|ΔBD\| < ε |

## 4. Statistical law (ONE primary analysis)

* per cell: **Wilson** score interval for the binomial proportion;
* per contrast: **Newcombe** hybrid-score interval for the difference of two independent
  proportions (closed form, no continuity correction, no black-box package);
* **superiority** (C1/C2/C4): one-sided minimum-effect test — the lower bound of the 97.5 %
  interval must exceed `Δ_min`;
* **equivalence** (C3): TOST — the 90 % interval for `pB − pD` must lie entirely inside
  `(−ε, +ε)`;
* **multiplicity**: none beyond the conjunction. Every contrast must pass simultaneously, which is
  strictly more conservative than any single α. Choosing among tests after seeing results is
  forbidden; every other number this harness can print is secondary reporting.

**Minimum-effect tests are not 50 %-powered at their own threshold.** At a true effect equal to
`Δ_min` the rule fires only at ≈ α (measured: 0.022 at N=200). The design must therefore be powered
for a true effect comfortably above `Δ_min`; the protocol's design effect is `Δ_min + 0.20`.

## 5. Margins

**`Δ_min = 0.20`** — the smallest Belief-mediated shift in `P(REALIZE)` worth calling a meaningful
cognition influence. Justification: the outcome is a binary policy class, so a shift is
"meaningful" when it can flip the subject's default policy; at the low end of the plausible
baseline band a 0.20 shift carries a subject from "usually withholds" (≤ 0.40) across the majority
boundary (0.50). Smaller thresholds are inside the executor's own trial-to-trial variation (V0
measured ≈ 0.30–0.40 disagreement on byte-identical inputs) and could be produced by prompt or
state artifacts rather than by the mediator.

**`ε = 0.15`** — the residual `|pB − pD|` tolerated after mediator equalization. Justification: it
is strictly below `Δ_min`, so a residual at the margin cannot by itself produce a claimable effect;
`ε = 0.10` (half of `Δ_min`) is scientifically tighter and is offered as the HIGH_CONFIDENCE
protocol at twice the cost, while `ε = 0.20` (= `Δ_min`) does not protect the mediation claim at all
and is offered only for screening.

**Executor stochasticity is not the equivalence margin.** A 30–40 % paired flip rate is a property
of the *instrument*; `ε` bounds a difference between *response probabilities*. They are different
estimands and must not be conflated.

## 6. Hard gates (all executable, all wired into the verdict)

`HOST_VALIDITY_OVERALL` ≥ 0.95 · `HOST_VALIDITY_PER_CELL_MINIMUM` ≥ 0.90 of scheduled ·
`INVALID_IMBALANCE_AUDIT` spread ≤ 0.05 · `RAW_HISTORY_ISOLATION` = 0 leaks ·
`RETRIEVAL_ISOLATION` · `NON_BELIEF_STATE_EQUALITY` · `NON_BELIEF_PROMPT_EQUIVALENCE` ·
`B_D_INPUT_IDENTITY` · `INTERVENTION_BELIEF_STABILITY` · `FRESH_PROCESS_RESTORE` = all scenes ·
`TRUTH_CONFLATION` = 0 flags · `CALL_ACCOUNTING` planned = actual = unique, 0 duplicate/missing/extra.

`contract.ts` defines them as ONE registry (`HARD_GATE_EVALUATORS`) and `deriveVerdict` consumes that
registry; an integrity test violates every gate individually and asserts that none of them can be
bypassed into a success verdict. A declared-but-unwired gate is therefore impossible.

## 7. Invalid scenes, validity and denominators

Invalid scenes are scheduled, reported and never deleted or imputed. Estimates use host-valid draws
only. If any cell retains less than 90 % of its scheduled draws, or if the invalid-rate spread across
cells exceeds 0.05, the result cannot be a success. There is no outcome-dependent imputation and no
denominator change after the fact.

## 8. Cell stability: REMOVED

The V0 `cell_stability_min = 7/10` (a deterministic-majority notion) is **dropped** from the success
law. Under a distributional law it is redundant with the interval-based tests, and in V0 it silently
coupled "an invalid scene exists" to "the cell is unstable". Its place is taken by the host-validity
gates plus minimum usable N plus the interval width implied by the chosen N. Majority class per cell
is reported as a descriptive statistic only.

## 9. Replication and pooling

Primary and replication use identical N, cells, scenario, histories, model, configuration, margins
and evaluator. **Replication must independently satisfy the full conjunction**; the success verdict
requires both phases. Pooled analysis is descriptive only and can never rescue a failed phase.
V0 contributes nothing to any future confirmatory count.

## 10. Calibration phase

Before the confirmatory freeze, one byte-identical calibration input is drawn `N_cal = 50` times
(fresh process each time). Its only jobs: prove the pipeline is viable (non-degenerate proportion,
acceptable schema/transport failure rate), measure the trial-to-trial flip rate, and confirm the
noise model. It may NOT modify the treatment, the margins, the evaluator or the confirmatory N
(those come from the offline power analysis), and it never enters a confirmatory denominator.
`N_cal = 50` bounds `p̂` to ±0.14 (worst case, 95 % Wilson) — enough to detect degenerate behaviour;
±0.05 precision would need ≈ 385 draws and is not needed before the freeze.

## 11. Preregistration, code state and manifest

1. finish contract + metrics + margins + N + scenario + histories + intervention + evaluator + runner;
2. run every deterministic precheck;
3. commit and push — this commit is the **PREREGISTRATION_COMMIT** (exact SHA recorded);
4. verify the worktree is clean and `HEAD == origin/main == PREREGISTRATION_COMMIT`;
5. only then may the first scientific model call happen. At run start the harness re-checks
   `HEAD == PREREGISTRATION_COMMIT` and otherwise stops with `SCIENTIFIC_CODE_STATE_MISMATCH`.
   Every scene records `formal_run_code_sha = PREREGISTRATION_COMMIT`.

**The freeze manifest is immutable once the first scientific call is made.** No re-seal, no hash
rewrite, no `code_hashes` replacement, no timestamp update. If any runtime code change turns out to
be necessary after the run started, the run is `INVALIDATED`; the only lawful path is fix → new
preregistration commit → new manifest → restart from zero.

## 12. Manifest and report hash laws

```
manifest_core = { schema_version, protocol_id, preregistration_commit_sha,
                  code_blob_hashes*, design }          # *hashes of the git BLOBS at that commit
manifest_hash = sha256(canonicalJson(manifest_core))    # sorted keys, UTF-8, no whitespace

report_core   = report minus { report_hash }
report_hash   = sha256(canonicalJson(report_core))
```

Forbidden inside the core: `manifest_hash`, any generated-at timestamp, the current HEAD, worktree
dirtiness, or any other value that changes after the run. The verifier therefore never consults the
current checkout: it recomputes the core hash and re-hashes each recorded git blob from the object
database (`git cat-file blob <sha>:<path>`), so an old manifest stays verifiable at any later commit.
The recorded commit identity is inside the hashed core, so it cannot be swapped after the fact.

## 13. Result commit

After the scientific run, only evidence, results, report and decision may be added. Runner, contract,
evaluator, intervention and statistics code may not change; if they must, the experiment is invalid.
When every gate, the secret scan and the evidence verification have passed, a separate
**RESULT_COMMIT** records the outcome, naming both SHAs explicitly
(`PREREGISTRATION_COMMIT` ≠ `RESULT_COMMIT`).

## 14. Retry law

Only 429, 5xx, timeout and transport resets are retried, at most 3 attempts, with the byte-identical
request and a fixed backoff. Schema-invalid output and unwanted behaviour are never retried.

## 15. Cost model (all values ESTIMATE_ONLY except request counts)

| protocol | N/cell | calibration | cognition requests | token envelope |
| --- | --- | --- | --- | --- |
| LOW_COST | 120 | 30 | 990 | ≈ 5.5–7.0 M |
| RECOMMENDED | 200 | 50 | 1650 | ≈ 9.2–11.6 M |
| HIGH_CONFIDENCE | 400 | 50 | 3250 | ≈ 18.2–22.8 M |

Cognition-only scenes: the confirmatory design makes ONE cognition request per scene (the primary
outcome is the directive), so language requests are **0 by design**. If a future variant keeps the
production turn's language stage, V0's measured ratio was 46 language calls per 104 cognition calls
(≈ 0.44); at that ratio add ≈ 435 (LOW_COST), ≈ 725 (RECOMMENDED) or ≈ 1430 (HIGH_CONFIDENCE)
requests — **ESTIMATE_ONLY**. Per-call token envelope from V0's measured cognition calls
(≈ 4.4 k prompt + 2.1–4.2 k completion, `reasoning_tokens` excluded from scoring): ESTIMATE_ONLY.
**API COST: `NOT_REPORTED_BY_PROVIDER`** — no frozen price table exists, and none is assumed.

## 16. Decision rule and recommendation

Exact joint success probability of the whole conjunction (offline, no model calls), for a symmetric
alternative `pA = pC = 0.30`, `pB = pD = 0.30 + Δ`:

| N/cell | Δ = 0.30 | Δ = 0.40 | Δ = 0.50 | minimum Δ for joint ≥ 0.80 |
| --- | --- | --- | --- | --- |
| 120 (ε=0.20) | 0.101 | 0.719 | 0.973 | 0.45 |
| 200 (ε=0.15) | 0.218 | **0.879** | 0.966 | 0.40 |
| 400 (ε=0.10) | 0.540 | 0.853 | 0.942 | 0.35 |
| 600 (ε=0.15) | 0.627 | 0.997 | 1.000 | ≤ 0.35 |

**RECOMMENDED = N 200/cell, `Δ_min` 0.20, ε 0.15** (1650 cognition requests, two phases):
superiority component ≥ 0.986 across the band, equivalence component ≥ 0.823 at the worst-case
baseline, exact joint 0.88 at a true separation of 0.40 and 0.97 at 0.50.

**Precondition the design imposes on the treatment:** the calibration/pilot evidence must show the
frozen treatment separates the cells by **≥ 0.40** in `P(REALIZE)`; below that the conjunction is not
economically confirmable (at Δ = 0.30 even 600 draws/cell reach only ≈ 0.63) and the honest response
is to strengthen the treatment design before the confirmatory freeze — not to spend the requests.

**LOW_COST** (N 120, ε 0.20, 990 requests) is screening grade: with `ε = Δ_min` a pass cannot support
a full mediation claim; it decides whether to fund the recommended run.
**HIGH_CONFIDENCE** (N 400, ε 0.10, 3250 requests) bounds the residual at half the smallest claimable
effect and tolerates a weaker treatment (Δ ≥ 0.35).

## 17. Verdicts

`BELIEF_CAUSAL_INFLUENCE_REPLICATED` (all four constraints + every hard gate, in **both** phases) ·
`BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED` (valid protocol, no superiority contrast reaches `Δ_min`) ·
`BELIEF_CAUSAL_RESULT_INCONCLUSIVE` (neither: some constraint undecided or the invalidity audit
fails) · the specific confounder verdicts (`…CONFOUNDED_BY_RAW_HISTORY`, `…BY_MEMORY_RETRIEVAL`,
`…BY_NON_BELIEF_STATE`, `BELIEF_MEDIATOR_EQUALIZATION_FAILED`, `…HOST_VALIDITY_GATE_FAILED`,
`…TRUTH_CONFLATION_FAILED`, `…ACCOUNTING_FAILED`, `EXPERIMENT_INVALID`) when their gate fails.

## 18. What V0 supplies

Only two things: evidence that the executor is stochastic on byte-identical input, and a plausible
parameter range for the planning tables. V0 contributes **no** confirmatory observation, no N, no
replication and no pooled analysis; the next experiment starts from zero.
