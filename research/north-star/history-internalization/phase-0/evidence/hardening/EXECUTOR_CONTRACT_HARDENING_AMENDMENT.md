# EXECUTOR CONTRACT HARDENING — AMENDMENT

**Not applied.** This document records what was *evaluated*, what was *proven*, and why no constraint
was adopted. It amends nothing, because the evaluation did not reach a defensible fix.

---

## 1. THE GOAL

Express, at generation time, an invariant the authoritative validator already enforces after
generation:

```
response_semantics.kind == "PRIMARY_STANCE"  =>  subjective_selection.kind == "SUBJECTIVE_SELECTION"
```

This is a **hoist**: move an existing reject condition from post-generation validation into a
generation constraint. It is not a new CharacterOS semantic rule.

## 2. WHAT THE AUDIT ESTABLISHED

| question | answer |
| --- | --- |
| does the request already carry a schema? | **yes** — `conversation-cognition-provider-v8.ts:635`, mapped to the provider's native `format` at `ollama-native-transport.ts:238-240` |
| does the current schema express the invariant? | **no** — `response_semantics` and `subjective_selection` are constrained independently; there is no cross-field construct anywhere in it |
| is the invariant stated in the prompt? | **yes** — rule 17 says PRIMARY_STANCE is "lawful only with SUBJECTIVE_SELECTION". The model was *told* the rule and violated it anyway. Asking harder is not the answer, and §9 forbids prompt rescue |
| is the failure class a legal member of the schema's accepted set? | **yes** — which is exactly why it passed structure and failed semantics |

**CASE A is refuted**, and it was refuted for an interesting reason: a schema *is* present and *is*
enforced structurally. It simply does not cover this rule.

## 3. THE TWO CANDIDATE ENCODINGS, BOTH CHECKED LOCALLY AT 0 PROVIDER CALLS

```
IF_THEN                  forbids_target = true    accepted_set_matches_intended = TRUE
ONE_OF_AS_FIRST_SENT     forbids_target = false   accepted_set_matches_intended = false
ONE_OF_CORRECTED         forbids_target = true    accepted_set_matches_intended = false
```

**`if/then` is contract-equivalent.** `oneOf` is not a safe fallback in either form: as first written
it did not forbid the target at all, and once corrected it **over-constrains** — it would also reject
legitimate outputs such as `(FACT, SELECTED)`, which the authoritative validator accepts. A faithful
`oneOf` encoding would have to enumerate every legal combination of all response modes against all
semantic completeness rules, which is a rewrite of the production schema whose equivalence could not
be established here.

## 4. WHAT THE PROVIDER DID WITH THE VALID INSTRUMENT

```
IF_THEN probe 1: schema accepted = true,  emitted (STANCE, NONE) = TRUE   <- the forbidden combination
IF_THEN probe 2: schema accepted = true,  emitted (STANCE, NONE) = TRUE   <- the forbidden combination
```

The provider **accepts** an `if/then` schema and **silently ignores** the conditional. The constraint
did not constrain.

## 5. VERDICT

```
CONSTRAINED_OUTPUT_CANNOT_FAITHFULLY_ENFORCE_REPRODUCED_FAILURE_CLASS
EXECUTOR_SWAP_DECISION_REQUIRED
```

No qualification (`N = 6`) was run, because §11 gates it on CASE A being resolved or a CASE B
equivalence audit passing, and neither holds.

## 6. THE BOUNDARY THIS RESPECTS

```
generation_constraint_changed = false
wire_request_changed          = false
prompt_semantic_content_changed = false
belief_semantics_changed      = false
trajectory_changed            = false
event_wording_changed         = false
target_proposition_changed    = false
scorer_changed                = false
invalid_policy_changed        = false
provider_changed              = false
model_changed                 = false
model_digest_changed          = false
```

Nothing was changed, so nothing has to be declared as changed. Had the constraint been adopted, the
honest declaration would have had to say `generation_constraint_changed = true` and
`wire_request_changed = true` — it would **not** have been "the conditions were unchanged".

## 7. TWO INSTRUMENT DEFECTS I FOUND IN MY OWN WORK, AND KEPT IN THE RECORD

1. **The first `oneOf` schema did not forbid the combination it targeted.** Branch 2 left `mode` free,
   so `(STANCE, NONE)` was a lawful member of the union. Its `IGNORED` reading was an artefact of the
   instrument. Caught by computing the accepted set **locally, at 0 provider calls**, instead of
   trusting the schema's intent.
2. **The audit's intended-acceptor modelled the conditional alone**, not `structural validator AND
   conditional`, which produced false divergences for structurally invalid documents.

Both are retained in the record. The law they re-teach: **a constraint that does not constrain proves
nothing, and an instrument must be validated locally before it is spent on provider calls.** The
`if/then` result survives this scrutiny because its instrument was verified equivalent *before* it was
sent.

## 8. WHAT HAPPENS NEXT — AN OPERATOR DECISION, NOT MINE

- **Option 1** — keep `qwen3.5:9b` and accept the reliability risk, bounded by the contained-failure
  protocol and whatever retry policy the scientific invalid policy permits.
- **Option 2** — replace the executor as infrastructure: fresh subjects, fresh execution identity, the
  same frozen trajectories, scorer and endpoint, the executor recorded as a **changed infrastructure
  condition**, and provider readiness plus contract qualification re-run.

This round performs neither.
