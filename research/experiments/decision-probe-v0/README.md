# decision-probe-v0 — research/evaluation-only structured decision measurement instrument

**Status: IMPLEMENTED (offline-verified). NOT RUN. Design frozen.**

Formal design, evidence base and the D0/D1 protocols:
[`research/north-star/DECISION_PROBE_V0_DESIGN.md`](../../north-star/DECISION_PROBE_V0_DESIGN.md)

## What it is

Given a request the **production path already built and rendered**, the instrument

1. preserves that request's `messages` (byte-exact, or production-prefix + a frozen override
   block),
2. substitutes the declared **output** contract for a closed-set decision
   (`ACCEPT` | `VERIFY` | `REJECT`),
3. makes exactly **one** transport call — no retry, no repair, no fallback,
4. validates the answer against the frozen closed set, failing closed, and
5. emits a record carrying request, schema and record hashes plus a fidelity audit.

## What it is not

Not a Core mechanism. Not a production behavior policy. Not an action planner, arbitration
engine, goal system or agent framework. It creates no belief, appraisal, relationship,
personality, goal, plan, utility, policy, learned preference or memory. It renders no subject
data and owns no subject semantics. It is imported by nothing in `packages/` or `product/`.

## Why it exists

The production cognition contract has no decision atom: in
`conversation-cognition-provider-v8.ts` the nested `cognition` wire object **requires**
`action_intent` and types it `{ type: "null" }`. The belief-specific closed-set relation
surface (`state_action_relations`) is an unwired island whose own law says "no final action".
The remaining live closed sets are response *shapes*, whose closest measured analogue returned
`INPUT_EFFECT_ONLY` with hard controls at zero.

So a research-only measurement endpoint is the only lawful way to ask a structured-decision
question **without** changing a frozen production contract. See the design document §2.

## Files

| File | Contents |
|---|---|
| `contract.ts` | frozen vocabulary + definitions, JSON Schema, override block, strict fail-closed parser, request builder, fidelity audit |
| `probe.ts` | one-call driver producing a hash-carrying `DecisionProbeRunRecordV0` |
| `fixtures.ts` | the three frozen D0 fixtures and the frozen D0 protocol constants |
| `decision-probe-v0.test.ts` | 41 offline tests, **0 model calls** |

## Running the tests

```
npx vitest run research/experiments/decision-probe-v0/
```

Fully offline (stub transports). No Ollama, no credential, no network. Included in the
repository's default `pnpm test` via `vitest.config.ts`.

## Phase D0 (not yet run)

D0 qualifies the instrument on three fixtures whose expected decisions are derivable from the
observation alone (so a **genesis** subject suffices — no formation, no belief adaptation, no
lived history):

| Fixture | Expected |
|---|---|
| `D0-A-OBVIOUS-ACCEPT` | `ACCEPT` |
| `D0-B-OBVIOUS-REJECT` | `REJECT` |
| `D0-C-AMBIGUOUS-VERIFY` | `VERIFY` |

`r_pilot = 3` replicates per (fixture, mode), two modes, 18 calls minimum. Verdicts:
`DECISION_INSTRUMENT_QUALIFIED`, `DECISION_INSTRUMENT_UNQUALIFIED`,
`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`, `INCONCLUSIVE_BY_DECISION_NOISE`,
`INCONCLUSIVE_BY_MODE_DIVERGENCE`.

**Hard interpretation rule:** an executor that cannot use this contract is an *executor*
limitation. It must never be reported as evidence that CharacterOS state has no effect.

**Remaining work before D0 can run:** the projection-capture binding that produces, for a
genesis subject and a fixture observation, the exact `ModelTransportRequestV0` the production
path would send. The instrument deliberately does not build requests, so that it can never
render subject data of its own.
