# RESULTS — EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0

**VERDICT: `MODEL_SUBSTITUTION_NOT_ISOLATED`**

The local executor could not be replaced by the available API executor in a way that isolates
`EXECUTOR_MODEL` as the only changed variable, so no scientific comparison was authorized and
none was run. The LOCAL result `FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED` is untouched and
remains the valid familiarity result.

Model substitution is blocked by a **verified impossibility**, not by a configuration slip:

> The frozen cognition proposal requires the top-level `schema_version` field with the **exact
> literal value** `"cognition-proposal-v0"`. That field name and that literal appear **nowhere** in
> the model-facing input — neither in the system prompt nor in the user prompt. They reach the
> executor **only** through the provider's structured-output constraint.

Measured on the real frozen prompt (`system` + `user`, 14,788 characters combined):

```
COMBINED prompt contains "schema_version":          false
COMBINED prompt contains "communication_directive": false
COMBINED prompt contains "cognition-proposal-v0":   false
```

The system prompt names four of the seven required top-level keys (`response_semantics`,
`subjective_selection`, `clarification_basis`, `factual_assessment`) but not the other three.
Consequently:

- On the LOCAL executor the constraint is mapped to Ollama's grammar-enforced `format`, so the
  grammar — not the model — supplies the missing field name and literal. That is why `qwen3.5:9b`
  was **104/104 schema-compliant** in V2.
- On the API provider there is no equivalent: `response_format: {"type":"json_schema", …}` returns
  `400 "This response_format type is unavailable now"`, and `{"type":"json_object"}` guarantees
  JSON syntax only.
- **No model, however strong, can emit an unknown constant.** Schema-valid output is therefore
  information-theoretically impossible through this provider, which is why every API model tried
  fails identically:

| # | model id | max_tokens | outcome |
| --- | --- | --- | --- |
| 1 | `deepseek-v4.1-flash` (first supplied name) | 2048 | `400` — provider rejects the name |
| 2 | `deepseek-flash` (**the canonical executor**) | 2048 | `200` — transport, credential and model validated |
| 3–6 | `deepseek-flash` | 2048 / 8192 | 3× schema-invalid, 1× empty response |
| 7–10 | `deepseek-flash` | 8192 | 3× schema-invalid, 1× empty response |
| 11–12 | `deepseek-flash` (confirmation, canonical id) | 8192 | 1× schema-invalid, 1× empty response |

An alias probe also returned `200` for `deepseek-v4-flash`; the canonical id supplied by the
operator is **`deepseek-flash`**, which is the id used for all recorded evidence and in
`executor-config.json` / `manifest.json`. Three `deepseek-v4-pro` calls were made **before** the
instruction to avoid that tier arrived; no pro call was made afterwards, and all pro evidence was
removed from the artifact set.

Every failure is the same two missing/misnamed fields (`schema_version` absent;
`directive: "REALIZE_CURRENT_INTENT"` instead of `communication_directive: {kind: …}`), and the
content the models DO produce is semantically on-target: one proposal correctly cited the
counterpart agreement as its first claim (`"alice and the subject agreed to keep the rollback
checklist in the shared review doc."`, source `F3`) with `current_intent` "…as the shared review
doc, per the prior agreement…". The executor is capable; the **interface** is not portable.

## Why this cannot be repaired inside the constraints

Both available repairs are explicitly forbidden by the task, and a third would be a production
architecture change:

| repair | why it is not permitted |
| --- | --- |
| state the key list in the prompt | changes prompt semantics — §8 forbids it, and the attestation below would become false |
| relax the parser / closed schema / source binding | §6 forbids it |
| add a provider-agnostic schema-enforcement layer to the shipped provider | production architecture change — §17 says STOP and report |

Per §17 this is reported, not implemented. No production file was modified.

## What WAS achieved and verified (all reusable)

- `prepare` is fully green: **15/15 deterministic checks PASS with 0 API calls**, including
  `A 1/32 < B 4/32`, `B == C` and `A == D` familiarity, `A`/`C` counterpart context = 0,
  `B ↔ D` identical source ids / order / text / count, seeds clean, corpus identical.
- **PROMPT EQUIVALENCE ATTESTED.** Every cell's model-facing prompt is byte-identical to the
  LOCAL V2 execution's real recorded prompt after normalizing only the run-identity tokens
  (observation ref, projection hash). `attestation.all_prompts_identical_after_normalization = true`
  → `LOCAL_V2_PROMPT_SEMANTICS == API_EXPERIMENT_PROMPT_SEMANTICS`. The non-isolation is therefore
  **not** a prompt problem.
- A research-only OpenAI-compatible transport (`api-transport.ts`) implementing the existing
  production `ModelTransportV0` port, with: env-only credentials, a `localhost`/Ollama-port
  **no-local-fallback guard** that fails closed, a frozen transport-only retry policy with
  identical input, token accounting from provider `usage`, mandatory transport-level redaction,
  and a non-reversible key fingerprint for attribution.
- The frozen V2 scientific modules are imported **unmodified**, so cells, credits, corpus,
  scenario, gates, contrasts, thresholds and structured outcomes cannot drift.

## Accounting (real API usage, no fabricated cost)

| item | value |
| --- | --- |
| scientific executions run | **0** (not authorized — non-isolation) |
| exploratory API requests (preserved evidence) | 11 scene-level calls; 8 counted provider requests |
| prompt tokens | 28,353 |
| completion tokens | 28,709 |
| total tokens | **57,062** |
| API cost | **NOT_REPORTED_BY_PROVIDER** (DeepSeek returns `usage` only; no price data, none invented) |
| seed | `SEED_UNSUPPORTED_BY_PROVIDER` — no determinism claim is made |

Add the two direct transport probes (a `json_schema` capability probe and a response-shape probe,
216 tokens) for a total of 57,278 tokens against the configured executor.

## Local baseline preserved

`research/experiments/relationship-familiarity-context-mediation-final-replication-v2/` was read
only, never written. Its verdict, evidence and `FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED`
result stand unchanged, and the Relationship stage closure stands.
