# D2 A1 STATE EXPERIMENT — PRE-EXECUTION PREREGISTRATION AUDIT — ROUND REPORT

**`D2_A1_STATE_INVALID_HANDLING_NOT_PREREGISTERED`**
**0 model calls this round.** `D2_MODEL_CALLS = 42` (unchanged). The 12-trial HIGH/LOW experiment was
**not** executed. No scorer, tolerance ratio or recovery policy was invented.

---

## §0A — THE SCORER: **PASSED** (`D2_A1_STATE_SCORER_PREREGISTERED`)

`D2A1_PREDICTION` is a unique, pre-frozen criterion and it answers the gate's questions directly:

| Question | Frozen answer |
| --- | --- |
| what HIGH's modal must be | `SUPPORTS_PARAPHRASED_PRINCIPLE` |
| what LOW's modal must be | `OPPOSES_PARAPHRASED_PRINCIPLE` |
| what constitutes a positive | "the HIGH modal token is SUPPORTS and the LOW modal token is OPPOSES and the two differ" |
| exact frozen tokens required | yes — the tokens are named exactly, not described |
| any other threshold | none declared |

The null side is frozen too: the localisation-matrix row `A0_positive_A1_null` supplies
`BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED` with the instruction *do
not run B; do not call this cognitively inert*.

**Ties are not named in the frozen text, and are handled by derivation — recorded here rather than
assumed.** The frozen predicate reads "**the** HIGH modal token is SUPPORTS and **the** LOW modal token
is OPPOSES" — a definite singular. A tied maximum means there is no single modal token, so the
predicate is unsatisfiable and the result falls to the frozen null row: it **fails closed**.

I explicitly **reject the permissive reading** — "a token that achieves the maximum count is *a* modal
token, so a tie may still satisfy the predicate" — because it would let a tied readout manufacture a
positive, and a definite singular does not admit it. Under every reading that respects the singular, a
tie can only ever yield non-positive. This is the material difference from the noise-rule gap found
last round: there the frozen text contained **no** sentence about what was being counted, and one
reading could manufacture a positive; here the sentence exists and points only one way.

Also recorded: `INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` sits in `D2_VERDICTS_REV1` but is bound
to **no trigger anywhere** in the contracts. Vocabulary is not a rule, so it was not used as a tie
verdict.

## §0B — THE FAILURE POLICY: **FAILED** (`D2_A1_STATE_INVALID_HANDLING_NOT_PREREGISTERED`)

The treatment's planned size and arm split are frozen (12 trials at `r = 6`, 6/6, from the frozen
schedule and the stage-gating table). Its **failure policy is not**:

| Required item | Specified for the A1 treatment |
| --- | --- |
| no retry | **no** |
| no replacement | **no** |
| no deletion | **no** |
| no extra replicate | **no** |
| invalid handling | **no** |
| invalid verdict | **no** |

The audit enumerated every rule that could cover it, with the scope each actually claims:

| Rule | Claims to cover the A1 treatment? |
| --- | --- |
| REV1.1c `D2A1_QUALIFICATION_INVALID_RULE` | no — verdict `D2_INSTRUMENT_UNQUALIFIED`, `applies_to` names qualification |
| REV1.1d `D2A1_NEUTRAL_PILOT_INVALID_POLICY` | no — its scope field reads **"A1 neutral pilot ONLY"**, `applied_retroactively_to` is empty, and its text never mentions the HIGH/LOW treatment |

**Rules covering the A1 treatment: 0.** The brief forbids reusing the pilot policy unless the
authoritative contract states that scope, and it does not state it — so reusing it would be an
extension the contract does not make, which is exactly the kind of quiet widening this program has
been refusing since REV1.1b. No tolerance ratio was invented.

Note the asymmetry with §0A, and why it matters: a scorer gap and a failure-policy gap are not the
same size. A scorer that is merely under-specified can be resolved by the frozen text itself (§0A).
How an *invalid trial* enters a denominator cannot: it decides whether the experiment reports a result
at all, and choosing it after seeing outputs is the definition of a post-hoc rule. That is why §0A
passed and §0B did not.

## WHAT WAS NOT DONE

No HIGH/LOW call was made. The runner was not built, the requests were not re-read for execution, and
no interim interpretation was offered. The execution-stage artifacts in the brief's list
(`trial-001..012.json`, `collection-integrity-report.json`, `a1-state-dataset.json`, `modal-report.json`,
`scorer-output.json`, `a1-scientific-verdict.json`, `A1_STATE_EXPERIMENT_MANIFEST.json`) were **not
produced**, because the round stopped at its own gates — and producing a dataset freeze for a run that
cannot lawfully start would be theatre.

Verified afterwards: the A1 request set (`4ada729e…` / `cc417f77…` / `0bbd6c81…`), the A1 schedule
(`sha256:d49962e73ed44995…`, 12 calls at `r = 6`), the A1 pilot dataset (`4a28b57f…`) and the A0
request set all still recompute to their frozen values. D1 untouched (`02bd7e31…`).

## WHAT THE NEXT ROUND NEEDS

A revision freezing, with `model_calls_before_amendment_for_the_a1_treatment = 0`:

1. the treatment's recovery policy (no retry / replacement / deletion / extra replicate, 13th call
   forbidden) and **how an invalid trial enters the final verdict**, with its verdict;
2. the scorer as a **callable pure function**, so the audit can call the frozen procedure rather than
   re-implement it — the REV1.1d pattern, which is what made the last round's invalid-policy proof
   worth anything.

Then the 12 frozen HIGH/LOW calls, and LINK 3B is finally measured.

## ARTIFACTS

`evidence/run-001/a1-state-preregistration-audit/` — `pre-execution-scorer-audit.json` (the §0A
answers, the tie derivation and the rejected permissive reading, and the unbound-vocabulary finding),
`pre-execution-invalid-policy-audit.json` (the rule inventory with each rule's claimed scope, the
presence table and the missing items), `A1_STATE_PREREGISTRATION_VERDICT.json`

No credential appears in any artifact (scanned). `tsc -p tsconfig.auxiliary.json` and
`eslint --max-warnings 0` clean; `pnpm governance` PASS. This round added no amendment and modified no
frozen artifact.
