# D0-V2 RUN REPORT — D0_V2_RUN_001_DEEPSEEK

Run: `research/experiments/decision-probe-v2/evidence/d0-v2-run-001-deepseek`
Protocol: **DecisionProbeV2** (`decision-probe-v2`), frozen in
`research/north-star/DECISION_PROBE_V2_DESIGN.md`
Date: 2026-09-21 · HEAD `02b6c46`
Calls: **36** (primary 9 · C3 9 · FORMAT_ONLY 9 · TOKEN_REMAP 9), zero retries, zero repairs
Local model calls: **0** (human deferred all local execution)
Status: **PERMANENT — do not edit.**

## Verdict

```
DECISION_INSTRUMENT_V2_QUALIFIED
```

| Field | Value |
|---|---|
| `overall_qualification_verdict` | **`DECISION_INSTRUMENT_V2_QUALIFIED`** |
| `qualified_executor_label` | `DECISION_INSTRUMENT_V2_QUALIFIED_ON_DEEPSEEK_FLASH` |
| `primary_measurement_verdict` | `PRIMARY_MEASUREMENT_PASSED` |
| `c3_diagnostic_verdict` | `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` (V2 requirement — met) |
| `format_only_diagnostic_verdict` | `CONSTRUCT_ANCHORS_NOT_NECESSARY` |
| `token_remap_diagnostic_verdict` | `TOKEN_PRIORS_NOT_LOAD_BEARING` |
| `diagnostics_veto` | `false` |
| `d1_gate` | **`PRIMARY_EXECUTOR_V2_QUALIFIED`** |
| `cross_transport_replication_status` | **`PENDING`** |
| `cross_transport_validated` | `false` |
| `d1_executed` | `false` |

## Local executor deferred

`LOCAL_EXECUTOR_V2_DEFERRED.json` was written **before any call**
(`model_calls_before_this_record: 0`): `reason = HUMAN_REQUESTED_NO_LOCAL_MODEL_RUN`,
`qwen_v2_fresh_data_available = false`, `this_is_not_a_failure = true`,
`this_does_not_modify_protocol = true`, `cross_transport_replication_status = PENDING`,
`no_qwen_v2_pass_is_claimed = true`,
`v1_qwen_data_may_not_be_used_as_v2_replication = true`.
No local model was invoked; no Qwen V2 pass is claimed.

## Historical evidence preservation

Untouched: V0 `DECISION_INSTRUMENT_UNQUALIFIED` · V0
`INCONCLUSIVE_BY_MODE_DIVERGENCE` · V1 Qwen `DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B` ·
V1 DeepSeek `EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`. No V2 rule was applied retrospectively.
V1's DeepSeek primary/C3 data was **not** carried forward: this run is fresh data.

## Primary executor identity

| Field | Value |
|---|---|
| requested / effective executor | `deepseek` / `deepseek` |
| family / transport | `openai` / `OpenAiCompatibleTransportV0` |
| model | `deepseek-flash` |
| endpoint | `https://api.deepseek.com` |
| temperature | `0` |
| max_output_tokens | `256` |
| provider_thinking | `disabled` |
| structured enforcement | `PROMPT_CONTRACT_PLUS_HOST_FAIL_CLOSED_PARSER` |
| native schema transmitted | `false` |
| declares_primary_executor | `true` |
| credential | present; value never read, never recorded, never written |

## Semantic contract identity

`semantic_contract_hash = sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53`
— identical to the contract V1's runs used. `protocol-hashes.json` records
`primary_contract_is_v1_contract_byte_identical: true`. **V2 changed no sent byte.**

## Transport equivalence gate

`TRANSPORT_EQUIVALENCE_GATE: PASS` · `all_audits_pass: true`.
Layer A verified present in `messages` for both the primary and FORMAT_ONLY contracts
(measurement task, output object definition, legal tokens, and — for primary — the construct
anchors). The `structured_output` member carries no construct text. Layer B difference
(`native_schema_transmitted: false`) is the preregistered, allowed structural-enforcement
difference. Cross-transport *output* comparison was not performed (local deferred).

## Results — all four phases

| Phase | D0-A (expected ACCEPT) | D0-B (expected REJECT) | D0-C (expected VERIFY) | Rejected | Transport failed |
|---|---|---|---|---|---|
| PRIMARY | `ACCEPT` 3/3 | `REJECT` 3/3 | `VERIFY` 3/3 | 0 | 0 |
| C3 | `ACCEPT` 3/3 | `REJECT` 3/3 | `VERIFY` 3/3 | 0 | 0 |
| FORMAT_ONLY | `ACCEPT` 3/3 | `REJECT` 3/3 | `VERIFY` 3/3 | 0 | 0 |
| TOKEN_REMAP | `ACCEPT` 3/3 | `REJECT` 3/3 | `VERIFY` 3/3 | 0 | 0 |

36/36 calls `DECIDED`; agreement `1.00` in every cell.

## Qualification calculation

1. primary modal == expected for all three fixtures ✓
2. agreement 3/3 ≥ 2/3 ✓
3. schema-rejection rate 0/9 ≤ 0.5 ✓
4. zero transport failures ✓
5–7. `CONSTRUCT_NEUTRALITY` / `FIXTURE_BLINDNESS` / `STATE_BLINDNESS` PASS ✓
8. `TRANSPORT_EQUIVALENCE_GATE` PASS ✓
9. C3 `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` ✓
→ **`DECISION_INSTRUMENT_V2_QUALIFIED`**.

## Diagnostics

**FORMAT_ONLY → `CONSTRUCT_ANCHORS_NOT_NECESSARY`.** With the three anchor definitions removed
but the task, output object and legal tokens retained, DeepSeek still produced the same three
decisions. The anchors are therefore **not required** for this executor to reach the frozen
choices on these fixtures. Non-vetoing; recorded as a limitation of the D0-C fixture's
difficulty, not as an instrument defect.

**TOKEN_REMAP → `TOKEN_PRIORS_NOT_LOAD_BEARING`.** With `OPTION_A/B/C` replacing
`ACCEPT/VERIFY/REJECT` and the anchors retained, the constructs survived unchanged. The result
does not depend on the English meanings of the token names. Non-vetoing.

**Descriptive note, explicitly not a controlled comparison:** V1's `PURE_SUBSTITUTION` on the
local executor also produced `REJECT` on D0-C, while V2's FORMAT_ONLY on DeepSeek produces
`VERIFY`. Those are **different conditions** — V1's control withheld the entire contract (and was
grammar-supported), whereas FORMAT_ONLY retains the task, shape and tokens and has no grammar —
so the two must not be read as a transport contrast. No causal claim is made.

## Cross-transport replication status

`CROSS_TRANSPORT_REPLICATION_PENDING`. `cross_transport_validated: false`. No
`CROSS_TRANSPORT_VALIDATED` claim is made. V1's Qwen data is **not** used as V2 replication.

## Artifact paths

`LOCAL_EXECUTOR_V2_DEFERRED.json` · `preflight.json` · `executor-manifest.json` ·
`protocol-hashes.json` · `fixture-manifest.json` · `binding-manifest.json` ·
`transport-equivalence-report.json` · `trials.json` (36 trials with raw outputs) · `cells.json` ·
`verdict.json` · `RUN_MANIFEST.json` (sha256 of every artifact) · this `REPORT.md`.

V0 and V1 evidence directories are unmodified.

## What this run does NOT establish

- It does **not** validate the instrument cross-transport (`PENDING`).
- It does **not** prove CharacterOS has behavioural causality, that belief matters, that history
  internalization works, or that an artificial subject exists.
- It does **not** show the instrument reads SubjectState rather than executing instructions —
  that is precisely the concern registered as Hostile Review #6, and it is a **D1** question.
- It is **not** evidence about any subject: this is instrument qualification only.

## Next gate

**`PRIMARY_EXECUTOR_V2_QUALIFIED`** with **`CROSS_TRANSPORT_REPLICATION_PENDING`** and
**`D1 NOT EXECUTED`**.

D1 must not start on the strength of this qualification alone. Before it can claim to measure
state rather than prompt compliance it must satisfy the six prerequisites frozen in the V2
hostile-review handoff: (1) state-sensitivity positive control; (2) identical-request noise
control; (3) frame-minimality arm; (4) history-absence contract; (5) lawful state swap;
(6) restart plan.
