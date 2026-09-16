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

## The blocker (verified, and information-theoretic)

The frozen cognition proposal requires the top-level `schema_version` field with the **exact
literal value** `"cognition-proposal-v0"`. Measured on the real frozen prompt (system + user,
14,788 characters combined):

```
contains "schema_version":          false
contains "communication_directive": false
contains "cognition-proposal-v0":   false
```

- `conversation-cognition-provider-v8.ts:218` defines `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`
  and `:373` passes it **only** as `structured_output`. The system prompt names four of the seven
  required keys but not `schema_version` or `communication_directive`.
- The LOCAL transport maps the constraint to Ollama's grammar-enforced `format`; that grammar —
  not the model — supplies the missing field name and literal. That is why `qwen3.5:9b` was
  104/104 schema-compliant in V2.
- The API provider has no equivalent: `json_schema` returns
  `400 "This response_format type is unavailable now"`; `json_object` guarantees syntax only.
- **No model, however strong, can emit an unknown constant**, so schema-valid output is
  impossible through this provider. Every API model tried fails identically —
  `deepseek-flash`, `deepseek-v4-flash` (the required model) and, in three calls made before the
  instruction to avoid it, `deepseek-v4-pro`.

Making the substitution isolatable would require either naming the keys in the prompt (changes
prompt semantics — forbidden), relaxing the parser/closed schema (forbidden), or adding a
provider-agnostic schema-enforcement layer to the shipped provider (production architecture
change — §17 instructs STOP and report). None was done.

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
