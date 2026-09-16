# STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — specification

The measurement protocol for the **next** confirmatory Belief→Cognition experiment. It replaces
the single-draw paired identity law that V0 used (and that the independent audit called
`NULL_CRITERION_MIS-CALIBRATED_TO_EXECUTOR_NOISE`) with a distribution-level law.

**This document is a design artifact. It performs no model calls and contains no experiment
results.** All numbers below are computed offline and exactly: see
`evidence/power-analysis.json` (`sha256:505d2a2d5fb2f8932921286b1708119ab04eca8d71dd8657a460aa56ecc04d8a`, produced by `cli.ts power`), which is
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
cognition influence. This is a **protocol-level scientific/policy convention**, not a natural
discontinuity of any kind: 0.5 is not a physical or psychological threshold, it is the majority
boundary of the binary policy class this protocol measures. Under that convention a 0.20 shift is
the smallest one that can carry a subject from "usually withholds" (≤ 0.40) across the majority
boundary (0.50) at the low end of the planned baseline band, and smaller thresholds are rejected on
the estimator's own terms: a threshold below 0.20 is not considered large enough, under this
protocol's binary policy interpretation, to justify the confirmatory budget.

**The paired flip rate is not the scale of `Δ_min`.** V0's ≈ 0.30–0.40 agreement-on-identical-inputs
figure is evidence only that the executor is stochastic and that a single-draw identity criterion is
unusable; it is a property of the instrument, not a difference between response probabilities, and it
is never compared against `Δ_min`.

**`ε = 0.15`** — the residual `|pB − pD|` tolerated after mediator equalization. Justification: it
is strictly below `Δ_min`, so a residual at the margin cannot by itself produce a claimable effect;
`ε = 0.10` (half of `Δ_min`) is scientifically tighter and is offered as the HIGH_CONFIDENCE
protocol at twice the cost, while `ε = 0.20` (= `Δ_min`) does not protect the mediation claim at all
and is offered only for screening.

**Executor stochasticity is not the equivalence margin.** Paired disagreement and `ε` are different
estimands and must not be conflated: one is about the instrument, the other about response
probabilities.

## 6. Hard gates (all executable, all wired into the verdict)

`HOST_VALIDITY_OVERALL` ≥ 0.95 · `HOST_VALIDITY_PER_CELL_MINIMUM` ≥ 0.90 of scheduled ·
`INVALID_IMBALANCE_AUDIT` spread ≤ 0.05 · `RAW_HISTORY_ISOLATION` = 0 leaks ·
`RETRIEVAL_ISOLATION` · `NON_BELIEF_STATE_EQUALITY` · `NON_BELIEF_PROMPT_EQUIVALENCE` ·
`B_D_INPUT_IDENTITY` · `INTERVENTION_BELIEF_STABILITY` · `FRESH_PROCESS_RESTORE` = all scenes ·
`TRUTH_CONFLATION` = 0 flags · `CALL_ACCOUNTING` planned = actual = unique, 0 duplicate/missing/extra.

### 6b. Truth-conflation gate: scan surface and interpretation boundary

**Scan surface (closed).** The classifier reads EXACTLY these frozen field paths of the confirmatory
cognition proposal and nothing else:

```
cognition.reasoning_summary
cognition.current_intent
factual_assessment.claims[*].text
clarification_basis.missing_information
clarification_basis.needed_for
```

The confirmatory design is cognition-only, so no delivered-behaviour text exists. A future variant
that keeps the production language stage must add its path to this list **in the preregistration
commit, before any scientific call**; free text outside the list is out of scope by construction.

**Mechanism.** `NEGATION_AWARE_CERTAINTY_ASSERTION_V1`: deterministic, host-side, sentence-local, with
a 60-character backward negation window. No LLM judge, no trained model, no NLP parser.

**Interpretation boundary.** `0 flags` proves only `NO_DETERMINISTIC_CLASSIFIER_FLAG`. It does **not**
prove the semantic absence of objective-truth conflation and must never be reported that way.

**Both error directions are disclosed and pinned in tests.**

*False positives* (a human would not call these conflation, the guardrail flags them because the
disclaimer sits outside the backward window or in a later sentence):

```
"Someone said it is guaranteed."
"Is it guaranteed? No. It is uncertain."
"Guaranteed. Well, not really."
"It is guaranteed true, which is not something I can verify."
```

*False negatives* (a genuine certainty assertion the guardrail misses because an unrelated negation
cue sits inside the window):

```
"This is not false, it is guaranteed."
"No doubt it is true for sure."
"Without doubt it is guaranteed."
"Never doubt that it is guaranteed."
"It is not only likely but guaranteed."
```

The gate is a guardrail against the most explicit conflation, not a semantic truth detector.

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

## 10. PHASE A — executor calibration (one calibration N: 50)

`N_cal = SAMPLING.calibration_draws = 50` for EVERY protocol option; there is no per-protocol
calibration size. One byte-identical calibration input is drawn 50 times (fresh process each time).
Its only jobs: prove the pipeline is viable (non-degenerate proportion, acceptable schema/transport
failure rate), measure the executor's trial-to-trial flip rate, and confirm the noise model.

It **cannot** measure A/B/C/D treatment separation, and it may modify **nothing**: not `Δ_min`, not
`ε`, not the evaluator, not the statistics, not the confirmatory N, not the treatment. Its data never
enters a confirmatory denominator. `N_cal = 50` bounds `p̂` to ±0.14 (worst case, 95 % Wilson) —
enough to detect gross degeneracy; ±0.05 precision would need ≈ 385 draws and is not needed.

> Calibration draws (`50`) and confirmatory draws are disjoint; a protocol's total request count is
> `4 · N · 2 + 50`.

## 10b. PHASE B — treatment-development pilot (EXPLORATORY ONLY)

Verifying that the frozen treatment is expected to separate the cells by ≥ 0.40 is **not** something
executor calibration can do. The only lawful sources for that expectation are (i) the offline design
assumption and (ii) an independent **treatment-development pilot**.

1. the pilot happens **before** the final `PREREGISTRATION_COMMIT`;
2. it is **EXPLORATORY ONLY** and is never marked confirmatory;
3. its data never enters the calibration denominator, primary, replication or any pooled
   confirmatory result;
4. if the pilot leads to changing the history, scenario, intervention, treatment strength, evaluator,
   N or margins, the design must be finalized again → deterministic precheck → **NEW
   PREREGISTRATION_COMMIT** → **new immutable manifest** → confirmatory calls from zero;
5. confirmatory scenario/trial identities may never reuse exploratory observations;
6. formal confirmatory calls may never tune the treatment afterwards.

If the pilot shows `< 0.40`, returning to exploratory design and changing the treatment is allowed —
and then every earlier pilot observation stays exploratory and discarded for confirmation, and the
final design must be re-preregistered.

## 11. Preregistration timeline, code state and manifest

The future sequence is fixed:

1. offline methodology design;
2. optional exploratory treatment-development pilot (PHASE B);
3. finalize histories, scenario, intervention, margins, N, evaluator, statistics;
4. deterministic precheck;
5. create + push the **PREREGISTRATION_COMMIT** (exact SHA recorded);
6. verify the tree is clean and `HEAD == origin/main == preregistration SHA`;
7. create the **immutable freeze manifest**;
8. executor calibration (PHASE A) under the formal frozen protocol;
9. primary; 10. replication; 11. result/evidence; 12. `RESULT_COMMIT`.

At run start the harness re-checks `HEAD == PREREGISTRATION_COMMIT` and otherwise stops with
`SCIENTIFIC_CODE_STATE_MISMATCH`; every scene records `formal_run_code_sha = PREREGISTRATION_COMMIT`.

**N is frozen once the PREREGISTRATION_COMMIT exists.** Formal (post-preregistration) calibration may
decide only `RUN` or `STOP`; it may not modify N, `Δ_min`, `ε`, the evaluator, the treatment or the
scenario. A calibration failure means STOP / invalidate readiness — never "recompute N now". If the
calibration genuinely needs to influence N or the design, it must have happened in the exploratory
stage (step 2), followed by a fresh preregistration.

**The scientific freeze is BYTE-level, not semantic-level.** Any byte change to a listed frozen path —
comments, formatting, type-only edits and dead-code cleanup included — changes the git blob and
therefore invalidates the manifest. There is no "it was only a type fix, keep running" exemption. If a
frozen byte must change after formal calls, the run is invalid: new preregistration commit → new
manifest → start from zero.

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

## 15. Cost model (request counts exact; token figures ESTIMATE_ONLY)

| protocol | N/cell | calibration | confirmatory requests | cognition requests (total) | token estimate |
| --- | --- | --- | --- | --- | --- |
| LOW_COST | 120 | 50 | 4 × 120 × 2 = 960 | **1010** | ≈ 6.6–8.7 M |
| RECOMMENDED | 200 | 50 | 4 × 200 × 2 = 1600 | **1650** | ≈ 10.7–14.2 M |
| HIGH_CONFIDENCE | 400 | 50 | 4 × 400 × 2 = 3200 | **3250** | ≈ 21.1–28.0 M |

Calibration is `SAMPLING.calibration_draws = 50` for every protocol (one calibration N, no special
cases). Token estimates use the frozen law `requests × [6500, 8600]`, from V0's measured per-call
envelope (≈ 4.4 k prompt + 2.1–4.2 k completion, `reasoning_tokens` included in completion but never
scored): **ESTIMATE_ONLY**.

Cognition-only scenes: the confirmatory design makes ONE cognition request per scene (the primary
outcome is the directive), so language requests are **0 by design**. If a future variant keeps the
production turn's language stage, V0's measured ratio was 46 language calls per 104 cognition calls
(≈ 0.44); at that ratio add ≈ 445 (LOW_COST), ≈ 725 (RECOMMENDED) or ≈ 1430 (HIGH_CONFIDENCE)
requests — **ESTIMATE_ONLY**. **API COST: `NOT_REPORTED_BY_PROVIDER`** — no frozen price table
exists, and none is assumed.

## 16. Decision rule and recommendation

Exact joint success probability of the whole conjunction (offline, no model calls), for a symmetric
alternative `pA = pC = 0.30`, `pB = pD = 0.30 + Δ`. **All power figures assume scheduled N = valid N,
i.e. zero invalid scenes**; the real protocol allows a per-cell 90 % host-validity floor, so each
option also carries `joint_success_probability_at_valid_floor` computed exactly at the floored N.

| N/cell | Δ = 0.30 | Δ = 0.40 | Δ = 0.50 | minimum Δ for joint ≥ 0.80 |
| --- | --- | --- | --- | --- |
| 120 (ε=0.20) | 0.101 | 0.719 | 0.973 | 0.45 |
| 200 (ε=0.15) | 0.218 | **0.879** | 0.966 | 0.40 |
| 400 (ε=0.15) | 0.627 | 0.997 | 0.9998 | 0.35 |
| 400 (ε=0.10) | 0.540 | 0.853 | 0.942 | 0.35 |

**RECOMMENDED = N 200/cell, `Δ_min` 0.20, ε 0.15** (1650 cognition requests, two phases):
superiority component ≥ 0.986 across the band, equivalence component ≥ 0.823 at the worst-case
baseline, exact joint 0.879 at a true separation of 0.40 — 0.826 if every cell falls to the 90 %
host-validity floor — and 0.97 at a separation of 0.50.

**Two phases, not one.** A success verdict requires the full conjunction independently in primary
**and** replication, so the experiment-level success probability is approximately the square of the
per-phase number: 0.879² ≈ **0.773** for the recommended design (0.826² ≈ 0.682 at the validity
floor). The per-phase joint must never be quoted as the whole experiment's probability.

**Precondition the design imposes on the treatment:** an independent exploratory
treatment-development pilot (PHASE B — never the executor calibration) must show the frozen treatment
separates the cells by **≥ 0.40** in `P(REALIZE)`; below that the conjunction is not economically
confirmable — at Δ = 0.30 the recommended N = 200 design reaches only ≈ **0.218** joint success
probability per phase — and the honest response is to strengthen the treatment design before the
confirmatory freeze, not to spend the requests.

**LOW_COST** (N 120, ε 0.20, 1010 requests) is screening grade: with `ε = Δ_min` a pass cannot support
a full mediation claim; it decides whether to fund the recommended run.
**HIGH_CONFIDENCE** (N 400, ε 0.10, 3250 requests) bounds the residual at half the smallest claimable
effect and tolerates a weaker treatment (Δ ≥ 0.35), **but its equivalence component does NOT reach the
0.80 planning target across the declared baseline band** (band minimum ≈ 0.757). A higher name is not
a claim that every component is stronger: its superiority component is the strongest of the three
options, its equivalence component is weaker than the recommended design's.

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
