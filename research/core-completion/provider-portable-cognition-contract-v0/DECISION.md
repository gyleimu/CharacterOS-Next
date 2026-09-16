# PROVIDER_PORTABLE_COGNITION_CONTRACT_V0 — DECISION

Baseline SHA: `6bf3f78977583e4fef9773931f736117e6d439f8` (`main`, clean, HEAD == origin/main).

**Verdict: `PROVIDER_PORTABLE_COGNITION_CONTRACT_READY_FOR_REVIEW`.**

A narrow production/core fix making the complete Cognition Proposal output contract visible to every
executor, so that provider-specific structured-output enforcement can only *reinforce* compliance
and can no longer hand one executor information another never receives.

This is not Relationship work, not Familiarity V3, not a provider-framework refactor and not a
cognition redesign. No scientific experiment was run in this slice.

## The confirmed gap (§1 audit)

An independent walker over the canonical `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`
collected every named requirement (required field names, const literals, enum values — including
nested objects and `oneOf`/`anyOf` branches) and tested each against the real model-facing prompt:

| | before remediation |
| --- | --- |
| total requirements | 80 |
| MODEL_VISIBLE | 70 |
| PROVIDER_ONLY | **10** |

The ten: `schema_version`, `communication_directive`, `cognition.schema_version` + its const
`"cognition-proposal-v0"`, `cognition.reasoning_summary`, `cognition.confidence`,
`cognition.uncertainty`, `clarification_basis.{current_observation_ref, missing_information,
needed_for}`.

Two details of the earlier executor-substitution report were corrected by this audit and are
recorded there: the top-level const (`"conversation-cognition-proposal-v8"`) **was** visible — the
invisible const was the nested one — and the earlier "information-theoretically impossible"
framing is replaced by the accurate frozen statements
`REQUIRED_SCHEMA_SEMANTICS_NOT_FULLY_MODEL_VISIBLE` and
`CROSS_PROVIDER_COMPLIANCE_CANNOT_BE_FAIRLY_COMPARED`. The core claim survived, which is why the
fix was authorized rather than stopped.

## The fix (§3–§6)

ONE canonical schema continues to be the single source of truth. It now drives **three** consumers
instead of two:

1. **model-visible contract** — new: `renderCognitionProposalContractV8(schema)` walks the schema
   and emits the binding `OUTPUT CONTRACT` section, which is appended to
   `CONVERSATION_COGNITION_SYSTEM_PROMPT_V8`. Every REQUIRED field name, exact const literal, enum
   value and required nested shape is spelled out, including the ten that were invisible.
2. **provider structured output** — unchanged: the same schema object is still passed as
   `structured_output`, so Ollama keeps grammar-enforcing it.
3. **parser / validator** — unchanged: not a line of validation, authority or threshold logic was
   touched.

Because the section is generated from the schema object, adding, renaming or removing a required
field changes it automatically. `REQUIRED_SCHEMA_SEMANTICS_NOT_FULLY_MODEL_VISIBLE` cannot silently
return without the regression suite failing.

There is no second, hand-written schema copy: the change adds one renderer and one derived string.

### What was explicitly NOT done

- No validator, required-field, const, enum, factual-authority, source-binding,
  communication-directive or host-validity-threshold change. The remedy is
  `MAKE CONTRACT VISIBLE`, never `MAKE VALIDATOR WEAKER`.
- No provider-architecture refactor, no generic LLM framework, no new abstraction layer.
- No change to Relationship, Belief, Affect, Memory, persistence, Writer Authority or decision
  admission.
- No new cognition semantics: the added text states requirements the host **already enforced**.

## Files changed

| file | change |
| --- | --- |
| `packages/runtime/src/providers/behavior/conversation-cognition-provider-v8.ts` | added `COGNITION_PROPOSAL_CONTRACT_SECTION_HEADER_V8`, `describeCognitionProposalSchemaNodeV8`, `renderCognitionProposalContractV8`; appended the derived contract section to the V8 system prompt |
| `packages/runtime/src/providers/behavior/cognition-proposal-contract-portability.test.ts` | new: regression Tests A–F |

`packages/runtime/src/index.ts` was not modified: the renderer is internal to the provider module
and the system-prompt constant it feeds is already exported.

## Regression tests (§8)

| test | property |
| --- | --- |
| A | every canonical-schema requirement is declared in the model-visible prompt (independent walker; audit surface asserted > 50 requirements so the check cannot be vacuous) and the rendered section is self-sufficient for all REQUIRED names |
| B | both `schema_version` consts are model-visible, and the nested one is confirmed to be a real schema fact |
| C | `communication_directive`, its enum values, and its REQUIRED status are model-visible |
| D | removing ANY required top-level field from the schema removes its declaration from the contract — the guard is sensitive per field, so a future silent omission fails |
| E | with provider structured output present but unenforced, the model still receives the complete contract; the `structured_output` request is still sent for providers that support it |
| F | the grammar-enforcing route and the generic route receive byte-identical messages and the same canonical schema — no route sees provider-specific extra semantics |

No snapshot stands in for any property, and no assertion would pass for two structurally different
outcomes.

## Re-audit after the fix

```
TOTAL requirements: 80 | MODEL_VISIBLE 80 | PROVIDER_ONLY 0
```

## Consequences for the next scientific stage

`EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1` may now be considered, but it must establish **both**
baselines afresh under this portable contract:

- A. local `qwen3.5:9b`
- B. API `deepseek-flash`

with the same portable cognition contract, prompts, schema semantics, corpus, scenario, familiarity
state, retrieval, metrics and thresholds. The pre-fix local V2 runs **must not** be used as the
comparison baseline, because their prompt differed.

Nothing else is authorized by this record: decision admission stays `0`, the Relationship stage
closure stands, and no familiarity or Belief work is opened.
