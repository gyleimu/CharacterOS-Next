# decision-probe-v2 — transport-aware measurement protocol (frozen, not run)

**Status: PROTOCOL FROZEN. NOT RUN. ZERO MODEL CALLS.**

Design, transport-confound analysis and the ten-question hostile review:
[`research/north-star/DECISION_PROBE_V2_DESIGN.md`](../../north-star/DECISION_PROBE_V2_DESIGN.md)

## What V2 changes

**Nothing in the sent bytes.** V2's primary semantic contract is byte-identical to DecisionProbeV1's
override block (`sha256:c484554d…`), proved by a test asserting request-level equality. What changes
is protocol interpretation and control structure:

| | V1 | V2 |
|---|---|---|
| measurement contract | `SUBSTITUTION_WITH_OVERRIDE` | **inherited byte-identically** |
| anchor-necessity control | `PURE_SUBSTITUTION` — transport-dependent, vetoing | `FORMAT_ONLY_DIAGNOSTIC` — transport-symmetric, **non-vetoing** |
| C3 | diagnostic | **qualification requirement** (V2's bar is higher) |
| transport equivalence | not gated | `TRANSPORT_EQUIVALENCE_GATE`, mandatory |
| token-name confound | untested | `TOKEN_REMAP_DIAGNOSTIC` |
| V0/V1 verdicts | — | untouched; `applies_retrospectively_*: false` |

## The three layers

| Layer | Contents | Cross-transport rule |
|---|---|---|
| **A** semantic measurement contract | task · output shape · legal tokens · construct anchors | **identical** — this is the instrument |
| **B** structural enforcement | native grammar / prompt-only / host parser | may differ; enforces FORM, never MEANING |
| **C** experimental subject information | projection · observation · state | D1's variable; never in the contract |

## Why the V1 control failed

`PURE_SUBSTITUTION` on a native-schema transport gives the executor a legal output **structure** it
can comply with; on a prompt-only transport the provider receives no schema at all, so the executor
does not know a DecisionProbe exists — DeepSeek emitted V8 proposals and truncated at the frozen
256-token budget. **Two different interventions under one name.** A control whose meaning depends on
the transport cannot veto an instrument across transports.

## The veto principle

A control may veto only if it observes the executor failing at a contract it **was actually given**.
A diagnostic that withholds information on purpose measures that information's *necessity* — a
behavioural change is evidence it is load-bearing, not that the instrument is broken.

## Files

| File | Contents |
|---|---|
| `contract.ts` | frozen V2 protocol: inherited contract, FORMAT_ONLY and TOKEN_REMAP constructions, veto rules, qualification rule, verdict vocabulary |
| `audits.ts` | `TRANSPORT_EQUIVALENCE_GATE` + construction audits + the inherited V1 gates |
| `audit.test.ts` | 12 offline tests, 0 model calls |
| `README.md` | this file |

## Running the audits

```
npx vitest run research/experiments/decision-probe-v2/
```

## Frozen call plan (`READY_TO_RUN_D0_V2_QWEN`)

Per executor: `primary 9` → `C3 9` → `FORMAT_ONLY 9` → `TOKEN_REMAP 9` = **36** (27 if the operator
records an explicit decision to skip TOKEN_REMAP, in which case the round reports
`TOKEN_REMAP_DIAGNOSTIC_NOT_RUN` and the token-name confound stays open). Qwen first, then DeepSeek
as a separate numbered run. **V1's DeepSeek data may not be carried forward as a V2 pass.**

**D1 remains LOCKED**, and even after a V2 qualification it must satisfy the six prerequisites in
Hostile Review #10 before it can claim to measure state rather than prompt compliance.
