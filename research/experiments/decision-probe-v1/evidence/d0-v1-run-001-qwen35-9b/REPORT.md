# D0-V1 RUN REPORT — D0_V1_RUN_001_QWEN

Run: `research/experiments/decision-probe-v1/evidence/d0-v1-run-001-qwen35-9b`
Protocol: **DecisionProbeV1** (`decision-probe-v1`), frozen in
`research/north-star/DECISION_PROBE_V1_DESIGN.md`
Date: 2026-09-21 · HEAD `02b6c46`
Calls: **27** (9 primary + 9 control + 9 C3), zero retries, zero repairs
Status: **PERMANENT — do not edit.**

## Verdict

```
DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B
```

| Field | Value |
|---|---|
| `primary_measurement_mode_verdict` | `DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B` |
| `control_diagnostic_verdict` | `CONSTRUCT_NOT_INSTANTIATED_BY_SCHEMA_ALONE (D0-C-AMBIGUOUS-VERIFY)` |
| `c3_diagnostic_verdict` | `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` |
| `override_identity` | `OVERRIDE_IDENTITY_HELD` |
| `audits_all_pass` | `true` |
| `executor_declares_primary` | `false` |
| `d1_unlock_eligible` | **`false`** |

**Final gate: `D1 LOCKED_PENDING_PRIMARY_EXECUTOR_D0_V1`.**

## Executor manifest

| Field | Value |
|---|---|
| family / transport | `ollama` / `OllamaNativeCognitionTransportV0` |
| model | `qwen3.5:9b` |
| model_digest | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| endpoint | `http://127.0.0.1:11434` |
| temperature | `0` |
| cognition num_predict | `256` |
| context_window_tokens | `8192` |
| think | `false` |
| **declares_primary_executor** | **`false`** |

## Primary measurement mode — `SUBSTITUTION_WITH_OVERRIDE`

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 3 | 0 | 0 | `VERIFY` | 1.00 | `VERIFY` | ✅ |

## PURE_SUBSTITUTION diagnostic (non-veto by V1 rule)

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `VERIFY` | ❌ |

Verdict: `CONSTRUCT_NOT_INSTANTIATED_BY_SCHEMA_ALONE (D0-C-AMBIGUOUS-VERIFY)` — identical to V0's
control-mode behaviour. Its retained, load-bearing finding: the executor **does** honour a swapped
JSON schema (A and B are produced correctly from a request whose system prompt says nothing about
the three-token scale), so `SCHEMA_SUBSTITUTION_HONORED` holds. Per the V1 rule this does **not**
veto the measurement mode.

## V1-C3 — DEFINITION_PARAPHRASE_CONTROL (preregistered before any call)

`V1_C3_PARAPHRASE_MANIFEST.json` and `PREREGISTRATION.json` were written, hashed and audited
**before the first model call** (`model_calls_before_this_record: 0`).

| Definition | Original (V0/V1) | Frozen C3 paraphrase |
|---|---|---|
| ACCEPT | the available information is sufficient and the claim should be acted on without further checking | the material in hand is enough, so the claim can be relied on immediately |
| VERIFY | the claim should be checked against an independent source before it is acted on | the claim should be confirmed against a separate party before being relied on |
| REJECT | the claim should not be accepted and should not be acted on | the claim should be set aside and not relied on |

Hashes: C3 block `sha256:711030fdc1a65155a445c2e95a603a3ef23aa5bc0fb70c3699cb44d0dbb6e38c`,
original block `sha256:3c9fea388a6527f891de4042fd226fae7e101a1d472e9b67d9a80d01da4cf236`,
manifest `sha256:0f08be8e59f22c01fabbf24d9a2c18cdb5dad1f6ecf02d58d2030ca645f63157`.

**Four preregistration audits, all PASS:**

| Audit | Result | Evidence |
|---|---|---|
| `C3_CONSTRUCTION` | PASS | exactly lines 11/12/13 changed — the three definition lines and nothing else; line count unchanged |
| `C3_LEXICAL_SEPARATION` | PASS | no occurrence of `check`, `checked`, `checking`, `verify`, `verification`, `independent`, `source`, `act`, `acted`, `acting`; no shared 6-gram with any of the 3 frozen fixtures |
| `C3_SYMMETRY` | PASS | word counts ACCEPT 14 / VERIFY 13 / REJECT 10 (spread 3 ≤ 6); same unpunctuated single-clause style as the originals |
| `C3_STRUCTURAL_EQUIVALENCE` | PASS | both wordings satisfy the same frozen disposition+condition skeleton for all three tokens |

**Declared limitation:** semantic equivalence is `DECLARED_BY_AUTHOR_NOT_MECHANICALLY_PROVEN`.
Only construction, lexical separation, symmetry and skeleton conformance are machine-verified.

| Fixture | ACCEPT | VERIFY | REJECT | Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 3 | 0 | 0 | `VERIFY` | 1.00 | `VERIFY` | ✅ |

Verdict: **`CONSTRUCT_RESPONSE_PARAPHRASE_STABLE`**.

## V1-C4 — OVERRIDE_IDENTITY_ACROSS_ARMS

All 9 primary cells carry **one** override block hash:
`sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53`.
The C3 block hash is distinct (it *is* the control variable), as required. Verdict
`OVERRIDE_IDENTITY_HELD`. No `PROTOCOL_VIOLATION_OVERRIDE_DRIFT`.

## Interpretation of the C3 result

The paraphrase removes every flagged lexical overlap term and every shared 6-gram with the
fixtures, keeps the constructs symmetric, and leaves the three tokens untouched. Under it,
D0-C still yields `VERIFY` 3/3 and A/B are unchanged. **This is evidence against the
hypothesis that the ambiguous-case result is driven by shallow lexical overlap between the
frozen override and the D0-C fixture text.**

It does **not** close the question. Not proven by this run: (a) that *no* lexical effect exists —
the paraphrase shares the referent noun `claim` and the general notion of reliance, both of which
are load-bearing measurement vocabulary; (b) that the construct is applied rather than
pattern-matched at a *semantic* level shallower than intended; (c) that the D0-C fixture is
strongly discriminative — it may be suggestive enough that any executor with the definitions
selects the middle option. (b) and (c) are sensitivity questions for the belief experiment's
probe design, not validity questions for this instrument, and they remain open.

## Noise

27/27 calls schema-valid; 0 rejections; 0 transport failures; agreement `1.00` in every one of the
9 cells. Self-noise was not a limiting factor in this run.

## Artifact paths

| File | Contents |
|---|---|
| `V1_C3_PARAPHRASE_MANIFEST.json` | paraphrase bytes, hashes, all four audits (written first) |
| `PREREGISTRATION.json` | order, manifest hash, timestamp, `model_calls_before_this_record: 0` |
| `audit-manifest.json` | the three V1 gates (`CONSTRUCT_NEUTRALITY`, `FIXTURE_BLINDNESS`, `STATE_BLINDNESS`), all PASS |
| `inherited-parameter-manifest.json` | V0→V1 inheritance ledger + frozen qualification rule |
| `executor-manifest.json` | provider, model, digest, endpoint, generation settings, primary declaration |
| `fixture-manifest.json` | the three frozen fixtures + the frozen D0 protocol |
| `binding-manifest.json` | per fixture: observation ref/scene/task, provenance chain, production hashes |
| `trials.json` | all 27 trials with raw outputs, request/override/record hashes, latencies |
| `cells.json` | per-cell distributions for all three phases |
| `verdict.json` | all four verdicts + override identity |
| `RUN_MANIFEST.json` | `sha256` of every artifact above |

## What this run does NOT establish

- It does **not** qualify the project's primary executor; `declares_primary_executor = false`.
- It does **not** unlock D1. **D1 is LOCKED.**
- It is **not** evidence about CharacterOS state: no belief, no formation, no lived history.
- It does **not** recalculate, reinterpret or upgrade any V0 verdict. V0's
  `DECISION_INSTRUMENT_UNQUALIFIED` and `INCONCLUSIVE_BY_MODE_DIVERGENCE` stand unchanged.
- It does **not** prove the belief-internalization claim, nor anything about history.

## Next gate

`D1 LOCKED_PENDING_PRIMARY_EXECUTOR_D0_V1` — the next step is the primary executor's own D0-V1
qualification, not belief-state sensitivity.
