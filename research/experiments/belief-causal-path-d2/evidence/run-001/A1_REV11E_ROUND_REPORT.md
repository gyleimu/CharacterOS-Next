# D2 REVISION 1.1e — A1 TREATMENT POLICY + EXECUTABLE SCORER — ROUND REPORT

**`D2_PREREGISTRATION_FINALIZED_REV1_1E`**
**`D2_A1_STATE_EXPERIMENT_AUTHORISED`**
**`D2_A1_STATE_EXPERIMENT_NOT_STARTED`**
**`D2_MODEL_CALLS = 42`** — **0 calls this round.**

---

## 1. AMENDMENT 1 — THE RECOVERY / INVALID POLICY THAT WAS MISSING

`contract-rev1-1e-a1-state-scoring.ts` (manifest `sha256:91697567fba28d3a…`), superseding exactly two
things:

```
supersedes_scope = [
  "A1 state-experiment invalid/recovery policy",
  "executable operationalization of existing A1 scorer"
]
```

`planned_trials = 12`, `HIGH = 6`, `LOW = 6`, identities fixed by the frozen schedule. One scheduled
trial is one attempt; retry, replacement, deletion, extra replicate, a thirteenth call, executor
fallback, **moving a failed trial to the end of the schedule**, and **replacing an invalid output with a
later valid one** are all forbidden. The denominator always comes from the planned sample.

Invalid covers transport failure, a timeout classified as a failed provider attempt, malformed output,
parser invalid, a token outside the frozen A1 stance vocabulary, and a missing provider result for a
scheduled attempted trial. An invalid trial is not a stance token, does not enter the modal count, and
may not be deleted, replaced or retried.

**`invalid_count >= 1` → `D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS`**, with
scientific positive = false, scientific null = false, HIGH/LOW modal scientific scoring **not executed**,
D2-B not authorised, zero replacement calls. Only twelve transport-valid, parser-valid, token-legal
trials may reach the frozen scorer.

## 2. AMENDMENT 2 — THE SCORER, NOW A CALLABLE PURE FUNCTION

`classifyA1StateExperimentV0` reads only the supplied records, the frozen A1 token vocabulary, the
frozen A1 prediction and the frozen schedule identities. It never reads the clock, provider metadata,
the A0 output pattern, the neutral modal identity, human annotations, any threshold, or mutable global
state.

It first verifies collection integrity (12 records, 6/6 arms, no duplicate, no missing, no extra, every
expected schedule identity present, and every record's arm agreeing with its frozen identity); a failure
there returns `D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE` and **no semantic scoring happens**.
It then refuses any invalid trial before computing anything.

The **unique modal** is mechanised explicitly: the token with a **strictly** highest count; a tie yields
`null`, never "one of the tied modal tokens". This is the operationalisation of the frozen text's
definite singular, and it is the tie rule §0A derived last round.

Positive requires all three frozen conjuncts — HIGH unique modal = `SUPPORTS_PARAPHRASED_PRINCIPLE`,
LOW unique modal = `OPPOSES_PARAPHRASED_PRINCIPLE`, and the two differ — yielding
`CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE`. **No minimum margin, no
percentage threshold, no confidence interval, no effect-size threshold was added**, because none was ever
preregistered. Any other valid outcome is the frozen null row
`BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED`.

## 3. THE THREE OUTCOME CLASSES, KEPT MUTUALLY EXCLUSIVE

**`NULL != INCONCLUSIVE`, and that is the whole point of this amendment.** A provider or parser failure
is not evidence about semantic transfer; reporting it as a semantic-transfer null would be a category
error. So an invalid run reports *inconclusive* and performs **no** modal scoring at all — it does not
merely report a weaker null.

## 4. THE SYNTHETIC AUDIT — THE FROZEN SCORER CALLED, NOT RE-IMPLEMENTED

`a1-state-scorer-audit.ts` calls the shipped function directly, so it cannot pass while the shipped
scorer disagrees. Ten cases, all passing:

| Case | Observed class | B authorised | Scientific scoring | Invalid |
| --- | --- | --- | --- | --- |
| perfect predicted (SUPPORTS×6 / OPPOSES×6) | **POSITIVE** | true | executed | 0 |
| same token both arms | NULL | false | executed | 0 |
| valid opposite direction | NULL | false | executed | 0 |
| HIGH tie (3+3) | NULL | false | executed | 0 |
| one invalid | **INCONCLUSIVE** | false | **not executed** | 1 |
| all invalid | INCONCLUSIVE | false | not executed | 12 |
| duplicate trial identity | INCONCLUSIVE (integrity) | false | not executed | 0 |
| missing trial identity | INCONCLUSIVE (integrity) | false | not executed | 0 |
| out-of-vocabulary token | INCONCLUSIVE | false | not executed | 1 |
| arm contradicts its frozen identity | INCONCLUSIVE (integrity) | false | not executed | 0 |

Case 3 is deliberately **not** reinterpreted as "an effect exists but reversed": the frozen prediction
admits no direction other than the preregistered one, so a reversed direction is a null. The audit also
confirms a supplied schedule that is not the frozen one is refused, and that the contract's twelve
schedule identities are exactly the frozen schedule artifact's identities (position, arm, and each
arm's request hash against the frozen request set) — so the contract cannot drift from the artifact.

**One bug, found by its own check:** the first run of the tampered-schedule check failed — because it was
not a tamper. The value I substituted happened to equal the frozen identity for that position (position
12 is `HIGH` under the frozen ordering), so a genuine forgery would have sailed through a check that
could not fail. The check now flips the arm to its opposite. A test that cannot fail is not a test.

## 5. WHAT WAS NOT TOUCHED

`a1_requests_modified: false`, `a1_schedule_modified: false`, `a1_prediction_modified: false`,
`scientific_positive_criterion_changed: false`, `null_localization_changed: false`,
`a1_state_outputs_seen_before_amendment: false`,
`model_calls_before_amendment_for_a1_treatment: 0`, REV1.1d hash preserved
(`sha256:24e5707ad31d7381…`). No A1 request byte, schedule entry, prediction, paraphrase, token, anchor,
transformer, `r_confirm` or localisation row was modified, and D1 and A0 were untouched.

## 6. ARTIFACTS

`evidence/run-001/a1-state-scorer-audit/` — `a1-state-scorer-audit.json` (the ten cases with their
observed classes, modals, counts and flags, plus the schedule-identity parity table),
`contract-rev1-1e-manifest.json`, `A1_REV11E_MANIFEST.json`

Verified after: the A1 request set (`4ada729e…` / `cc417f77…` / `0bbd6c81…`), the A1 schedule
(`d49962e7…`), the A1 pilot dataset (`4a28b57f…`) and the A0 request set all still recompute. D1
untouched (`02bd7e31…`). No credential appears in any artifact (scanned). `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The twelve frozen HIGH/LOW calls belong to the next round; that is the round in which
LINK 3B is actually measured.
