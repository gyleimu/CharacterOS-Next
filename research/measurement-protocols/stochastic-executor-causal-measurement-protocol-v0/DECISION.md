# STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — DECISION

**Verdict: `STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0_READY_FOR_AUDIT`**

Baseline: `main` @ `c18505fb150640e7b9e2dda8f0bbcca137f25e98`.
**Model calls: 0. Production changes: 0.** Everything added lives under
`research/measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/` plus one
tooling line in `vitest.config.ts` (the integrity tests must run inside the repository's own gate).

V0 is untouched and stays closed at `BELIEF_CAUSAL_RESULT_INCONCLUSIVE` /
`BELIEF_COGNITION_EFFECT_OBSERVED` / `DIRECTIONALLY_SUPPORTED_NOT_REPLICATED`. Nothing in this slice
rewrites V0 evidence, re-seals its manifest, changes its thresholds, deletes its invalid scenes,
pools it into anything, or re-interprets it as replicated.

## Why the slice exists

The V0 audit established, from V0's own evidence, that `B_HIGH_BELIEF` and
`D_LOW_BELIEF_MEDIATOR_EQUALIZED` had **byte-identical** model-facing requests yet disagreed in 4/8
(primary) and 3/10 (replication) paired trials. The instrument's same-input flip rate is therefore
≈ 0.30–0.40, while the frozen null tolerance was `≤1/10`. The criterion was mis-calibrated to the
executor's noise (`NULL_CRITERION_MIS-CALIBRATED_TO_EXECUTOR_NOISE`): a paired single-draw identity
test can never certify equivalence for a stochastic generator. This slice designs the replacement.

## What was delivered

| deliverable | artifact |
| --- | --- |
| protocol specification (frozen design) | `PROTOCOL.md` |
| frozen contract + executable hard-gate registry | `contract.ts` |
| verdict law (single place a success claim can be produced) | `verdict.ts` |
| deterministic statistics implementation | `statistics.ts` (Wilson, Newcombe, TOST, exact binomial and factorized exact joint enumeration) |
| offline power / sensitivity analysis | `power.ts` → `evidence/power-analysis.json` (`sha256:505d2a2d5fb2f8932921286b1708119ab04eca8d71dd8657a460aa56ecc04d8a`) |
| negation-aware truth-conflation classifier | `conflation.ts` |
| manifest + report hash laws and the HEAD-independent verifier | `hashing.ts` |
| read-only V0 evidence/defect verifier | `v0-verification.ts` → `evidence/v0-verification.json` |
| integrity tests A–I + gate-wiring + classifier suites | `integrity.test.ts` (24 tests, run by `pnpm test`) |
| recommendation table (LOW_COST / RECOMMENDED / HIGH_CONFIDENCE) | `evidence/power-analysis.json` `options` |

## Decisions taken (all with their reasons)

1. **Estimand change.** Cells are response *distributions*; contrasts compare probabilities. The
   B/D control becomes a TOST equivalence question about `pB − pD`, not a draw-matching question.
   *Why:* paired disagreement and difference-of-probabilities are different estimands; conflating
   them is what made V0 undecidable.
2. **`Δ_min = 0.20`.** A **protocol-level scientific/policy convention** for "the smallest shift worth
   calling a meaningful cognition influence" in a binary policy class — not a natural discontinuity
   (0.5 is the majority boundary of the measured outcome, nothing more) and not a comparison against
   V0's paired flip rate. Smaller thresholds are rejected on the estimator's own terms: below 0.20 the
   shift is not considered large enough to justify the confirmatory budget.
   *Cost:* N=140 for ≥ 0.93 superiority power at a true effect of 0.40 (band-restricted).
3. **`ε = 0.15`.** Strictly below `Δ_min`, so a residual at the margin cannot manufacture a
   claimable effect. `ε = 0.10` (half of `Δ_min`) is offered as HIGH_CONFIDENCE with a **disclosed
   trade-off**: its equivalence power over the declared baseline band is ≈ 0.757, below the 0.80
   planning target, so the name does not mean "every component is stronger". `ε = 0.20` does not
   protect the mediation claim and is labelled screening only.
4. **Design effect 0.40, not `Δ_min`.** A minimum-effect test has ≈ α power at exactly `Δ_min`
   (measured 0.022 at N=200), so the design must be powered above the threshold.
5. **RECOMMENDED = N 200/cell, ε 0.15** (1650 cognition requests over two phases + 50 calibration
   draws): superiority ≥ 0.986, equivalence band minimum ≈ 0.823, exact joint 0.879 per phase at
   Δ = 0.40 (0.826 if every cell falls to the 90 % host-validity floor). The binding constraint is
   the equivalence component, and the joint is the honest quantity: per-contrast power does not add
   up to experiment-level success (at N=200 with Δ=0.30 the joint is only 0.218), and **two phases are
   required**, so the experiment-level probability is ≈ J² ≈ 0.773.
6. **Treatment precondition (PHASE B, exploratory).** An independent exploratory
   treatment-development pilot — never the executor calibration — must show a ≥ 0.40 separation;
   below it the conjunction is not economically confirmable (at Δ = 0.30 the recommended N = 200
   design reaches only ≈ 0.218 joint success per phase) and the honest move is to strengthen the
   treatment, not to buy more draws. Pilot data never enters any confirmatory denominator, and a
   treatment change forces a new preregistration commit.
7. **Cell stability removed** from the success law; host validity, minimum usable N and the interval
   tests replace it. Majority class becomes descriptive only.
8. **One primary analysis law**, no p-value shopping; the conjunction is the multiplicity control.
9. **Calibration is separated** from confirmatory evidence (50 byte-identical draws, viability and
   noise estimation only, never a confirmatory denominator, never a source of N or margins).
10. **Replication must independently satisfy the conjunction**; pooling is descriptive only.
11. **A pruning hazard was designed out:** baselines at or above 0.60 leave no headroom for a 0.20
    claim threshold, so the protocol declares a planning band `[0.20, 0.60]` and reports
    ceiling-limited cells as UNDECIDABLE rather than failed.
12. **Evidence-integrity laws rewritten** so the two V0 defects cannot recur: the manifest core
    excludes timestamps, HEAD and worktree state and is verified from git blobs, and the report law
    pins exactly one core (`report minus report_hash`).
13. **Truth-conflation classifier replaced** by a deterministic, sentence-local, negation-aware rule
    that never flags an explicit disclaimer (including V0's false positive) and still catches every
    positive certainty assertion in its case suite.
14. **Every hard gate is executable and consumed by the verdict** — proven by a test that violates
    each gate in turn and asserts that none can yield the success verdict.

## Evidence-integrity findings on V0 (read-only, no modification)

`evidence/v0-verification.json`: all six archived V0 evidence files still hash identically to the V0
result commit; the manifest core contains `frozen_at_utc`, `repository.head` and
`tracked_tree_dirty_outside_experiment`, so the stored `manifest_hash` cannot be re-derived at any
later commit; and the stored `report_hash` reproduces under *neither* plausible law (whole file minus
`report_hash`, nor the implicit `{verdict, primary, replication}` sub-core), so no auditor can
determine which law authored it. Both defects are structural in V0 and are removed by the protocol's
laws for future experiments.

## Remediation after the independent methodology audit

The audit returned `FREEZE_BLOCKED_MINIMAL_REMEDIATION_REQUIRED` on `086185a` and named four MAJORs.
All were fixed without touching the statistical core, `Δ_min`, `ε`, the recommended N, or the hash and
gate architectures:

* **M1 — mislabelled power row.** The row printed as `600 (ε=0.15)` was in fact `400 (ε=0.15)`; it is
  relabelled and now carries the artifact's exact values (0.627136 / 0.997261 / 0.999752, minimum
  separation 0.35). The grid was not extended and no number was recomputed for a different N.
* **M2 — `equivalence_power_min` semantics.** For every protocol option the field is now the TRUE
  minimum over the declared planning band `[0.20, 0.60]`: LOW_COST 0.86253, RECOMMENDED 0.82317,
  HIGH_CONFIDENCE 0.75714. The last one crosses the 0.80 planning target, and that trade-off is now
  disclosed in the option's `claim_strength`, in `PROTOCOL.md` §16 and here.
* **M3 — calibration double standard.** Every protocol uses `SAMPLING.calibration_draws = 50`; the
  LOW_COST special case of 30 is gone and its total is `4·120·2 + 50 = 1010` everywhere.
* **M4 — phases conflated.** Executor calibration (PHASE A) and the treatment-development pilot
  (PHASE B) are now separate, with the pilot explicitly `EXPLORATORY_ONLY`, excluded from every
  confirmatory denominator, forbidden from reusing trial identities, and requiring a new
  preregistration commit after any treatment change.

Also applied: the `Δ_min` rationale no longer compares anything against the paired flip rate and is
stated as a protocol-level convention; the false "even 600 draws/cell reach only ≈ 0.63" claim is
replaced by the artifact's true numbers (recommended N=200 reaches 0.218 per phase at Δ = 0.30); a
BYTE-level freeze declaration; the conflation classifier's exact closed scan surface plus both error
directions, disclosed and pinned by tests; the power tables' zero-invalid assumption with exact
validity-floor joints (recommended 0.826); the two-phase experiment-level note (J² ≈ 0.773); token
estimates recomputed as `requests × [6500, 8600]`; and a graceful `{ok: false}` for a missing frozen
blob in the manifest verifier.

The power artifact was regenerated (`sha256:505d2a2d5fb2f8932921286b1708119ab04eca8d71dd8657a460aa56ecc04d8a`) and two consecutive offline generations are
byte-identical.

## Offline power analysis (exact enumeration, no simulation seed)

* `superiority_table`: 5 baselines × 5 effects × 16 N values, exact.
* `equivalence_table`: equivalence power by ε and N, exact.
* `joint_design_table` / `minimum_separation_for_joint_80`: the exact joint success probability of
  the whole conjunction, computed by factorized exact enumeration (O(n³) inner accumulation, no
  Monte Carlo) for N up to 800.
* V0 stress test: at V0's N=10 the distributional superiority component would have had 0.175 power
  and the equivalence component 0.000 — which is why V0's design could not decide, independently of
  which criterion it used.

## Proven / not proven

**Proven (offline, deterministic):** the laws are internally consistent and implemented; the gate
registry is complete and every gate can block a success verdict; the hash laws verify offline
without consulting HEAD and detect forged contract/evaluator bytes; the report hash round-trips and
detects mutation; the classifier handles the specified positives and negatives; the power tables are
exact and reproducible; the recommended protocol is affordable, powered and auditable.

**Not proven:** that the future treatment will actually separate the cells by ≥ 0.40 (the protocol
makes this a pre-freeze precondition rather than an assumption); that the equivalence component will
pass in a real run; that the executor's noise is stationary across sessions (calibration must be
re-run inside each future run); that cognition-only scenes behave identically to full production
turns (the protocol measures cognition, not delivered behaviour, by design).

## Residual risks

* **Cost.** The recommended run is ≈ 1650 cognition requests and the high-confidence variant ≈ 3250;
  at V0's measured pace this is hours of wall time and ≈ 9–23 M tokens (no price table exists, so
  API cost is `NOT_REPORTED_BY_PROVIDER`).
* **Model drift.** DeepSeek may change `deepseek-flash` between the preregistration commit and the
  run; the protocol records the model id and configuration but cannot pin the provider's weights.
  A calibration failure is the only detector.
* **Band assumption.** The planning band `[0.20, 0.60]` is a design assumption; a cell outside it is
  declared UNDECIDABLE, which weakens the claim rather than invalidating the run.
* **Classifier scope.** The conflation rule is sentence-local; it will miss certainty assertions
  phrased without its markers (documented false-negative direction), and the gate is therefore a
  guardrail, not a semantic guarantee.
* **Harness reuse.** The future experiment must not import V0's runner as-is; V0's scene protocol
  needs the distributional sampling and the new accounting, and V0's evidence must never enter a
  confirmatory denominator.

## Next step

The protocol is ready for independent methodological audit. **No confirmatory experiment was run**
and none should start before that audit, a `PREREGISTRATION_COMMIT`, and a calibration phase.
