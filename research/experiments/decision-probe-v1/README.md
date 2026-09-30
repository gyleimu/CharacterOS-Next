# decision-probe-v1 — frozen measurement protocol (audits + inheritance)

**Status: PROTOCOL FROZEN. NOT RUN.**

Design, hostile review and the full rationale:
[`research/north-star/DECISION_PROBE_V1_DESIGN.md`](../../north-star/DECISION_PROBE_V1_DESIGN.md)

## What V1 changes

V1 changes **no measurement parameter**. It changes *which mode is the measurement contract*,
*what counts as evidence*, and *what must be audited*:

| | V0 | V1 |
|---|---|---|
| Measurement mode | `SUBSTITUTION_WITH_OVERRIDE` | `SUBSTITUTION_WITH_OVERRIDE` (unchanged) |
| `PURE_SUBSTITUTION` | qualification control with **veto** | **format/semantic-contract diagnostic**, non-veto; retained claim narrowed to `SCHEMA_SUBSTITUTION_HONORED` |
| Gates | none | `CONSTRUCT_NEUTRALITY` + `FIXTURE_BLINDNESS` + `STATE_BLINDNESS`, all mandatory |
| Controls | — | `V1-C3 DEFINITION_PARAPHRASE_CONTROL` (mandatory), `V1-C4 OVERRIDE_IDENTITY_ACROSS_ARMS` (mandatory downstream), `V1-C5` optional diagnostic |
| Version token | `decision-probe-v0` | `decision-probe-v1` — the **only** contract delta |

Everything else — the override text, the three definitions, the vocabulary, the JSON schema
shape, the three fixtures, the expected decisions, `r_pilot`, the thresholds, the executor and
every generation setting — is inherited **byte-identically**. A test proves the round-trip:
substituting the V1 token back to the V0 token reproduces V0's override block exactly.

## The three gates

```
CONSTRUCT_NEUTRALITY — every line of the override block is classified against a frozen,
                       index-aligned table; no STATE_GUIDANCE, no CONDITION_GUIDANCE
FIXTURE_BLINDNESS   — no fixture text, id, marker, expected-token mapping or 6-gram
STATE_BLINDNESS     — no subject-state vocabulary; one individually justified exception
                       ("SUBJECT DATA", the production section name, inside a binding clause)
```

Per-line classification (frozen, index-aligned):

| Lines | Category |
|---|---|
| 4 | `VOCABULARY_DEFINITION` (the "Decision meanings" header + ACCEPT / VERIFY / REJECT) |
| 9 | `OUTPUT_CONTRACT` (header, format rules, required/optional members, footer) |
| 3 | `MEASUREMENT_INSTRUCTION` (supersede format rules; preserve existing laws; choose exactly one) |
| 1 | `OTHER` (blank separator) |
| **0** | `STATE_GUIDANCE`, `CONDITION_GUIDANCE` — **forbidden** |

## V0 preservation

`research/experiments/decision-probe-v0/` is **untouched**: contract, evidence, and both run
directories (`d0q-formal-qwen35-9b` = `DECISION_INSTRUMENT_UNQUALIFIED`,
`d0q-run-002-qwen35-9b` = `INCONCLUSIVE_BY_MODE_DIVERGENCE`). A test re-verifies **every
recorded artifact hash** in both runs, so any future edit to V0 fails the suite rather than
passing silently.

## Running the audits

```
npx vitest run research/experiments/decision-probe-v1/
```

Fully offline, 0 model calls. Included in the default `pnpm test` via `vitest.config.ts`.

## Next gate

`READY_TO_RUN_D0_V1_QWEN` — 18 calls on `qwen3.5:9b`, plus `V1-C3`. **D1 remains LOCKED** until
the project's primary executor holds its own V1 qualification
(`DECISION_INSTRUMENT_V1_QUALIFIED_ON_<EXECUTOR>`).
