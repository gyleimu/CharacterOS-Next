# D0-V1 RUN REPORT — D0_V1_RUN_002_DEEPSEEK (PRIMARY EXECUTOR)

Run: `research/experiments/decision-probe-v1/evidence/d0-v1-run-002-deepseek-deepseek-flash`
Protocol: **DecisionProbeV1** (`decision-probe-v1`), frozen in
`research/north-star/DECISION_PROBE_V1_DESIGN.md`
Date: 2026-09-21 · HEAD `02b6c46`
Calls: **27** (9 primary + 9 control + 9 C3), zero retries, zero repairs
Status: **PERMANENT — do not edit.**

## Verdict

```
EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE
```

**D1 LOCKED.**

| Field | Value |
|---|---|
| primary measurement mode | `DECISION_INSTRUMENT_V1_QUALIFIED_ON_DEEPSEEK_FLASH` |
| control diagnostic | **`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`** (veto-equivalent outcome) |
| C3 diagnostic | `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` |
| override identity | `OVERRIDE_IDENTITY_HELD` |
| **overall qualification verdict** | **`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`** |
| `declares_primary_executor` | `true` |
| `d1_unlock_eligible` | `false` |

The overall verdict is governed by the frozen V1 rule that a control emitting **zero** schema-valid
decisions is a veto-equivalent outcome. The measurement mode passing does not override it.

## Executor manifest

| Field | Value |
|---|---|
| family / transport | `openai` / `OpenAiCompatibleTransportV0` |
| model | `deepseek-flash` |
| endpoint | `https://api.deepseek.com` |
| requested / effective executor | `deepseek` (ENVIRONMENT) / `deepseek` |
| temperature | `0` |
| max_output_tokens | `256` |
| provider_thinking | `disabled` (provider-specific parameter, recorded) |
| `context_window_tokens` | `NOT_APPLICABLE_CLOUD_FAMILY` |
| structured_output_support | `SCHEMA_NOT_FORWARDED_PROMPT_CONTRACT_AND_HOST_PARSER_ONLY` |
| credential | `MODEL_API_KEY` present; value never read, never printed, never written |

## Primary measurement mode — `SUBSTITUTION_WITH_OVERRIDE`

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 3 | 0 | 0 | `VERIFY` | 1.00 | `VERIFY` | ✅ |

All five measurement-mode conditions of the frozen rule are satisfied.

## PURE_SUBSTITUTION diagnostic (veto-equivalent outcome triggered)

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 0 | 0 | 0 | 3 | — | — | `ACCEPT` | ❌ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 0 | 3 | — | — | `REJECT` | ❌ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 0 | 0 | 3 | — | — | `VERIFY` | ❌ |

All 9 calls: `outcome: REJECTED`, `rejection_code: NOT_JSON`, `transport_failure: null`.

### Mechanism — established from the raw output, not assumed

The control raw output is a **complete V8 conversation-cognition proposal**:

```
{"schema_version":"conversation-cognition-proposal-v8","factual_assessment":{"claims":[{"kind":"SOURCE_QUOTE", …
```

`JSON.parse` fails with **`Unterminated string at position 974`** — the response was truncated at the
frozen 256-token output budget. The causal chain is structural:

1. The cloud transport **never transmits** `response_format` / `json_schema`
   (`model-transport.ts`: the body carries only `provider_request_options`(optional), `model`,
   `messages`, `temperature`, `max_tokens`; zero occurrences of either key in the file).
2. `PURE_SUBSTITUTION` transmits no construct definitions by design.
3. Therefore the model receives **no signal at all** that a decision object is required, and it
   follows the production system prompt instead — emitting a V8 proposal.
4. A V8 proposal greatly exceeds the 256-token budget frozen for the tiny decision object → truncation.
5. The fail-closed parser correctly rejects it.

This is **not** evidence that the executor "cannot follow a swapped schema". It never received one.

### Frozen rule applied literally

`contract.ts` records: *"Fails to emit any schema-valid decision → still a veto-equivalent finding:
`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`"*. The rule is applied as written. **It is not
reinterpreted after the fact to obtain a pass.**

## C3 diagnostic

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 3 | 0 | 0 | `VERIFY` | 1.00 | `VERIFY` | ✅ |

→ `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE`, on the primary executor, using the frozen C3 paraphrase
(`sha256:0f08be8e…`) byte-identically to the Qwen run.

## V1-C4 override identity

`OVERRIDE_IDENTITY_HELD` — one override block hash across all 9 primary cells; the C3 block hash is
distinct. No `PROTOCOL_VIOLATION_OVERRIDE_DRIFT`.

## Protocol equivalence (preflight, before any call)

`QWEN_TO_PRIMARY_PROTOCOL_EQUIVALENT`, `forbidden_differences_found: []`.
`c3_manifest_hash` and `v1_override_block_hash` match the Qwen run; fixtures compared canonically.

## Disclosure — a defect in the V1 control design, found only now

V1's `PURE_SUBSTITUTION` control was designed and first validated on a **grammar-enforcing**
transport (Ollama native), where substituting only the schema genuinely tests schema compliance.
On a transport that **never transmits the schema**, the same control is **uninformative about
executor capability**: it measures the absence of any instruction, not compliance.

A protocol revision would need to address this — for example by conditioning the veto-equivalent
clause on the transport actually transmitting the schema, or by redesigning the control to keep the
construct definitions and vary something else. **That decision belongs to a future round and is not
applied here.** This run's verdict follows the frozen rules as written.

## Disclosure — a driver label bug, corrected without new calls

The driver printed the primary verdict as `DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B` — a
hardcoded, false label for a DeepSeek run. The driver now derives the executor tag from the executor
manifest, and an explicit `overall_qualification_verdict` applies the control veto rule.
`VERDICT_CORRECTION.json` (in this directory) records the recomputation **from the unchanged
`trials.json`** with **0 new model calls**. The original `verdict.json` is left byte-identical and its
mislabel is documented rather than silently overwritten. No protocol rule, threshold, fixture,
expected token, C3 wording or scoring was changed.

## Artifact paths

`V1_C3_PARAPHRASE_MANIFEST.json`, `PREREGISTRATION.json`, `audit-manifest.json`,
`inherited-parameter-manifest.json`, `executor-manifest.json`, `fixture-manifest.json`,
`binding-manifest.json`, `trials.json` (27 trials with raw outputs), `cells.json`, `verdict.json`,
`VERDICT_CORRECTION.json`, `RUN_MANIFEST.json`, this `REPORT.md`.

## What this run does NOT establish

- It does **not** qualify the primary executor; the overall verdict is the veto-equivalent one.
- It does **not** unlock D1. **D1 is LOCKED.**
- It is **not** evidence about CharacterOS state: no belief, no formation, no lived history.
- It does **not** reopen, reinterpret or upgrade any V0 verdict or the Qwen V1 qualification.
