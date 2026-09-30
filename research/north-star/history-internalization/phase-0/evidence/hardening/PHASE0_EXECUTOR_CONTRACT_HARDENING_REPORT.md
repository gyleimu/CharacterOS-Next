# PHASE0 EXECUTOR CONTRACT HARDENING — REPORT

**`CONSTRAINED_OUTPUT_CANNOT_FAITHFULLY_ENFORCE_REPRODUCED_FAILURE_CLASS`**
**`EXECUTOR_SWAP_DECISION_REQUIRED`**
`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED` · `EVIDENCE_LEVEL = L1` ·
`SCIENTIFIC_PROVIDER_ATTEMPTS = 0`

The question was whether the same executor could be made reliable by enforcing, at generation time,
a contract it already has — without touching the scientific task. The answer is **no, not on this
provider**, and the answer is proven rather than assumed.

---

## 1. RUN-3 IS FROZEN

`RUN3_FREEZE.json` — 17 files hashed. Run-3 stays `HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE`.
Its failed turn was not repaired, its event was not re-run, no later turns were appended, and the
partial belief commit was not reinterpreted as success.

## 2. BLOCKER CLAIM — CORRECTED

```
CURRENT_EXECUTION_BLOCKER = EXECUTOR_OUTPUT_CONTRACT_RELIABILITY
BELIEF_ADAPTATION_COMMIT_OBSERVED_ON_REACHED_VALID_TURNS = true
CHARACTEROS_BELIEF_MECHANISM_CLEARED = false
```

The forbidden claim *"CharacterOS mechanism is proven not to be the blocker"* is **not** made: the
full Phase-0 protocol has never completed, so the mechanism cannot be cleared. What is established is
narrower — on every valid turn that reached the adaptation chain, a canonical commit occurred.

## 3. THE FAILURE, RECONSTRUCTED FROM SOURCE

Two independent runs produced a **byte-identical** error, on different subjects, arms and turn
indices:

```
CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED:
SEMANTIC_COMPLETENESS_FAILED: conversation proposal.response_semantics:
PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance
```

The executable rule, read from `conversation-cognition-proposal.ts:1909`:

```
response_semantics.kind == "PRIMARY_STANCE" AND subjective_selection.kind != "SUBJECTIVE_SELECTION"
  => REJECT
```

equivalent to `PRIMARY_STANCE => SELECTIVE stance` — a **cross-field conditional**, which is not
expressible by required keys, closed keys, JSON well-formedness or enum membership. The reproduced
failure is the proof: **structural validity is not semantic validity.**

**Instrumentation gap, stated plainly:** the raw malformed payload was **not preserved** in either
run. Neither turn record carries a raw executor response. The failing shape was therefore *derived*
from the authoritative rule rather than *observed* — which is the stronger route anyway, since the
rule defines the whole family and a sample defines one member. Fix recorded for future runs: persist
the raw executor response on every turn, valid or invalid.

## 4. §4 THE CRITICAL QUESTION — ANSWERED

**Yes, the request already carries a schema.** `conversation-cognition-provider-v8.ts:635` sets
`structured_output`, the Ollama-native transport maps it to the provider's `format`
(`:238-240`), and the runtime passes it through (`:265-267`).

**No, that schema does not express the invariant.** `response_semantics` is a `oneOf` over response
modes including a bare `{kind: "PRIMARY_STANCE"}`; `subjective_selection` is an independent `oneOf`
over `{NO_SUBJECTIVE_SELECTION}` and `{SUBJECTIVE_SELECTION, …}`. There is **no cross-field construct
anywhere in it**, so the failing combination is a lawful member of its accepted set.

**CASE A is refuted** — and for a sharper reason than "no schema": a schema is present and enforced
structurally, it simply does not cover this rule. Also noteworthy: **the prompt already states the
invariant in words** (rule 17: PRIMARY_STANCE "lawful only with SUBJECTIVE_SELECTION"). The model was
told the rule and broke it anyway. Asking harder was never the answer, and §9 forbids prompt rescue.

## 5. §5/§6 WHICH CASE — WITH THE INSTRUMENTS CHECKED FIRST

| encoding | forbids the targeted combination | accepted set matches the intended acceptor |
| --- | --- | --- |
| `if/then` | **true** | **true** — contract-equivalent |
| `oneOf` as first sent | **false** | false |
| `oneOf` corrected | true | **false — over-constrains** |

The corrected `oneOf` would also reject legitimate outputs such as `(FACT, SELECTED)`, which the
authoritative validator accepts. A faithful `oneOf` would have to enumerate every legal combination of
all response modes against all semantic completeness rules — a rewrite of the production schema whose
equivalence could not be established here.

Then the valid instrument was sent:

```
IF_THEN probe 1: schema accepted, emitted the FORBIDDEN combination
IF_THEN probe 2: schema accepted, emitted the FORBIDDEN combination
```

**The provider accepts an `if/then` schema and silently ignores the conditional.** Four probes, no
retry, no prompt strengthening, no Phase-0 content in any of them.

```
CASE C — CONSTRAINED_OUTPUT_CANNOT_FAITHFULLY_ENFORCE_REPRODUCED_FAILURE_CLASS
```

Per the brief, the constraint is therefore **not applied**, and **no qualification (`N = 6`) was run**,
because §11 gates it on CASE A resolving or a CASE B equivalence audit passing.

## 6. TWO DEFECTS IN MY OWN INSTRUMENTS, KEPT IN THE RECORD

1. **The first `oneOf` schema did not forbid the combination it targeted** — its second branch left
   `mode` free, so `(STANCE, NONE)` was lawful. Its `IGNORED` reading was an artefact of the
   instrument, not a fact about the provider.
2. **The audit's intended-acceptor modelled the conditional alone**, not `structural validator AND
   conditional`, producing false divergences on structurally invalid documents.

Both were caught by computing acceptance sets **locally at 0 provider calls** instead of trusting the
schema's stated intent. The law they re-teach: *a constraint that does not constrain proves nothing,
and an instrument must be validated locally before it is spent on provider calls.* The `if/then`
result survives that scrutiny because its instrument was verified equivalent **before** it was sent —
and that is exactly why the verdict is trustworthy.

## 7. WHY THE EXECUTOR SWAP IS SECOND CHOICE, AND WHY IT IS NOW ON THE TABLE

A swap changes latent reasoning, instruction following, semantic interpretation and response policy
all at once — so it is not the first answer to a pure output-contract problem. But a
contract-equivalent constraint **cannot be shown to work** on this provider, and the North Star does
not require binding to any particular model. Executor replacement is therefore now an available
infrastructure decision.

## 8. WHAT THIS ROUND DID NOT DO

No Phase-0 turn executed. No production change. No prompt change. No model or provider change. No
constraint adopted. No qualification calls. Nothing about the scientific design, scorer, predicate or
invalid policy touched. `packages/` unmodified at `02b6c46e`.

## 9. FINAL STATE

```
run-1  HISTORY_INTERNALIZATION_V1_INCONCLUSIVE      (frozen)
run-2  NOT_STARTED / BLOCKED                        (pre-scientific infrastructure block)
run-3  HISTORY_INTERNALIZATION_V1_PHASE0_RUN3_INCONCLUSIVE  (frozen, 17 files)
gates  FAIL · FAIL · PASS
hardening  CASE C — constrained output cannot faithfully enforce the reproduced failure class
EVIDENCE_LEVEL = L1
HISTORY_INTERNALIZATION_PHASE_1 = NOT AUTHORISED
CHARACTEROS_CORE_SEMANTICS = UNMODIFIED
```

**The decision now rests with the operator:** keep the executor and accept the reliability risk under
the contained-failure protocol, or replace the executor as infrastructure — fresh subjects, new
execution identity, the same frozen science, and the executor recorded as a changed condition.
