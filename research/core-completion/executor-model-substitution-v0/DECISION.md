# EXECUTOR_MODEL_SUBSTITUTION_V0 — DECISION

Baseline SHA: `76b510b39c64a7e7c0f0fdc85b38c652b013d8b6` (`main`, clean, HEAD == origin/main).
Experiment: `research/experiments/executor-model-substitution-v0/`.

## Verdict

**`MODEL_SUBSTITUTION_NOT_ISOLATED`** — the local executor could not be replaced in a way that
isolates `EXECUTOR_MODEL` as the only changed variable, so no scientific execution was run and no
comparison between local and API executors is claimed.

## Stage-closure status

`RELATIONSHIP_FAMILIARITY_STAGE_CLOSED` **stands**. It was reopened ONLY for executor-substitution
falsification — to test whether the closed negative was an artefact of the local executor — and
**not** for architecture iteration. The falsification attempt did not produce a testable
substitution, so the closure is unchanged, decision admission remains **0**, and familiarity
keeps no decision authority.

## The blocker (verified; corrected after the §1 audit)

`REQUIRED_SCHEMA_SEMANTICS_NOT_FULLY_MODEL_VISIBLE`, with the immediate consequence
`CROSS_PROVIDER_COMPLIANCE_CANNOT_BE_FAIRLY_COMPARED`.

An independent audit of the canonical `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA` against the
real model-facing prompt (system + user) measured **80 requirements: 70 model-visible, 10
provider-only** — `schema_version`, `communication_directive`, `cognition.schema_version` and its
const `"cognition-proposal-v0"`, `cognition.reasoning_summary`, `cognition.confidence`,
`cognition.uncertainty`, and `clarification_basis.{current_observation_ref, missing_information,
needed_for}`.

**Correction of this record's first version.** It claimed the invisible const was the top-level
`"cognition-proposal-v0"` and called the block "information-theoretically impossible". Both were
wrong or overstated: the top-level const is `"conversation-cognition-proposal-v8"` and **is**
model-visible; the invisible const is the **nested** `cognition.schema_version`; and a model can
in principle emit an unstated field by accident, so the honest statement is that the requirement
set was not fully model-visible and cross-provider compliance could not be fairly compared.

The core claim survived the audit — required semantics genuinely lived only in the provider channel
— so the remediation was authorized rather than stopped.

- `conversation-cognition-provider-v8.ts:218` defines `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`
  and `:373` passes it **only** as `structured_output`. The system prompt named four of the seven
  required top-level keys but not `schema_version` or `communication_directive`.
- The LOCAL transport maps the constraint to Ollama's grammar-enforced `format`, so the grammar
  supplied the missing names and literals; that is why `qwen3.5:9b` was 104/104 schema-compliant
  in V2.
- The API provider has no equivalent: `json_schema` returns
  `400 "This response_format type is unavailable now"`; `json_object` guarantees syntax only.
- Every API model tried therefore failed identically — `deepseek-flash`, `deepseek-v4-flash`
  (alias) and, in three calls made before the instruction to avoid it, `deepseek-v4-pro`.

The fix is `MAKE CONTRACT VISIBLE`, not `MAKE VALIDATOR WEAKER` — see
`research/core-completion/provider-portable-cognition-contract-v0/DECISION.md`. Re-audited after
the fix: **80/80 model-visible, 0 provider-only**.

## What was achieved instead

- **Prompt equivalence attested**: every cell's API-experiment prompt is byte-identical to the
  LOCAL V2 execution's recorded prompt after normalizing only the run-identity tokens, so the
  non-isolation is not a prompt issue.
- `prepare` green: 15/15 deterministic checks, 0 API calls, including the V2 familiarity ordering,
  `A`/`C` counterpart-context count 0, and `B ↔ D` identical source ids/order/text/count.
- A reusable research-only OpenAI-compatible transport implementing the existing production
  `ModelTransportV0` port: env-only credentials, a fail-closed **no-local-fallback** guard, a
  frozen transport-only retry policy with identical input, provider `usage` token accounting,
  mandatory transport-level redaction and a non-reversible key fingerprint.
- Secret hygiene verified by scan: the credential literal appears nowhere in the repository or
  artifacts.

## Consequences for future executor substitution

A provider substitution for this harness is only isolatable if the candidate provider can be held
to the SAME output constraint the local provider gives. Concretely, a future attempt needs one of:

1. a provider whose strict schema mode actually works (JSON-Schema/grammar enforced), **or**
2. an explicit, architecture-level decision to make the proposal schema provider-portable —
   which is a production change requiring its own authorization, **not** an experiment-side edit.

Until then, executor-substitution results for this harness would conflate
`EXECUTOR_MODEL` with `SCHEMA_ENFORCEMENT_STRENGTH` and must not be reported as a capability
comparison.

## Production boundary

`ARCHITECTURE_CHANGES = NONE`. `git diff` outside `research/` is empty; no production file, no
Writer Authority file, no Belief/Affect/Memory change and no decision-admission change.

## Local result preserved

`relationship-familiarity-context-mediation-final-replication-v2/evidence/**` was read only.
`FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED` stands as the valid familiarity result.
