# RESULTS — EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1

**CROSS-EXECUTOR VERDICT: `EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED`**

Under one identical protocol, the local executor shows **no** context-mediation effect at all
(0/10 on every contrast, twice), while the API executor reproduces the **complete** predicted
mediation pattern (all four criteria PASS, twice).

| | LOCAL_QWEN | API_DEEPSEEK |
| --- | --- | --- |
| model | `qwen3.5:9b` (Ollama native, digest `6488c96f…`) | `deepseek-flash` (DeepSeek OpenAI-compatible) |
| schema enforcement | `OLLAMA_NATIVE_FORMAT_GRAMMAR_ENFORCED` | `OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY` |
| pilot host-valid | **1.000** (24/24) | **1.000** (24/24) |
| primary host-valid | **1.000** (40/40) | 0.950 (38/40) |
| replication host-valid | **1.000** (40/40) | 0.950 (38/40) |
| **scientific verdict** | **`LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED`** | **`API_CONTEXT_MEDIATION_REPLICATED`** |

## Primary (40 scenes per executor, paired interleaved)

| executor | C1 `A↔B` | C2 `B↔C` | C3 `B↔D` | C4 `A↔D` | criteria |
| --- | --- | --- | --- | --- | --- |
| LOCAL_QWEN | **0/10** | **0/10** | 0/10 | **0/10** | 1,2,4 FAIL |
| API_DEEPSEEK | **8/8** | **10/10** | **1/10** | **8/8** | **ALL PASS** |

## Replication (40 scenes per executor, frozen code, fresh identities)

| executor | C1 `A↔B` | C2 `B↔C` | C3 `B↔D` | C4 `A↔D` | criteria |
| --- | --- | --- | --- | --- | --- |
| LOCAL_QWEN | **0/10** | **0/10** | 0/10 | **0/10** | 1,2,4 FAIL |
| API_DEEPSEEK | **10/10** | **10/10** | **1/8** | **8/8** | **ALL PASS** |

Both phases agree on every contrast for both executors. Seed checks, semantic non-conflation,
language authority, manipulation checks and accounting (`planned == actual == unique`, duplicates /
missing / extra = 0) are clean everywhere.

## Per-cell behaviour — the mechanism, visible

**LOCAL_QWEN** — every cell, both phases (80/80 host-valid scenes):

| cell | counterpart context readable | observed behaviour |
| --- | --- | --- |
| `A_LOW_NO_CONTEXT` | no | `GENERATIVE_ACT` ×10 |
| `B_HIGH_CONTEXT` | **yes (10/10)** | `GENERATIVE_ACT` ×10 — context present, **never cited** |
| `C_HIGH_CONTEXT_ABLATED` | no | `GENERATIVE_ACT` ×10 |
| `D_LOW_CONTEXT_EQUALIZED` | **yes (10/10)** | `GENERATIVE_ACT` ×10 |

`counterpart_context_cited = 0`, `continuation_success = 0`, `clarification_requested = 0` in all 80
scenes: the local executor produces a conversational act and never uses the retrieved agreement.

**API_DEEPSEEK**:

| cell | context readable | primary | replication |
| --- | --- | --- | --- |
| `A_LOW_NO_CONTEXT` | no | `GENERATIVE_ACT` ×7, `CITES_GENERIC_ONLY` ×3 | `CITES_GENERIC_ONLY` ×8, `GENERATIVE_ACT` ×2 |
| `B_HIGH_CONTEXT` | **yes (10/10)** | **`CITES_COUNTERPART_CONTEXT` ×10**, continuation_success ×10 | **`CITES_COUNTERPART_CONTEXT` ×10**, continuation_success ×10 |
| `C_HIGH_CONTEXT_ABLATED` | no | `CITES_GENERIC_ONLY` ×8, `GENERATIVE_ACT` ×2 | `CITES_GENERIC_ONLY` ×10 |
| `D_LOW_CONTEXT_EQUALIZED` | **yes (10/10)** | **`CITES_COUNTERPART_CONTEXT` ×9** | **`CITES_COUNTERPART_CONTEXT` ×7** |

The API executor's behaviour tracks **context availability**, not familiarity: with the context
present it cites the agreement (B 10/10, D 9/10 and 7/10); with the context ablated it falls back to
the generic default (C 8/10 and 10/10); with no context at all it cannot cite (A).

## What this establishes

1. **`Context Availability → Cognition → Behavior` is real and reproducible — for a sufficiently
   capable executor.** The API executor reads the retrieved counterpart agreement and grounds its
   response in it, 10/10 in both phases, and the effect requires the retrieval (`C2` 10/10 both
   phases: ablating the contribution removes the behaviour).
2. **The familiarity scalar has no independent effect.** With context exactly equalized, high vs
   low familiarity are indistinguishable (`C3` 1/10 and 1/8). This holds for the local executor
   trivially (no effect anywhere) and for the API executor in the strong sense (a large effect that
   does not depend on the scalar).
3. **Executor capability dependence is observed, not inferred.** Same protocol, same corpus, same
   scenario, same prompt bytes, same contract, same thresholds: 0/10 versus 8–10/10 on the same
   contrasts. The only changed variable is the executor model.
4. **The portability fix did its job.** Both executors reached ≥ 0.95 host validity, so for the
   first time the comparison is between two *compliant* executors rather than between one compliant
   executor and one starved of required information.

## Correct interpretation (and what must NOT be claimed)

Correct: *CharacterOS familiarity lawfully changes context access, and the stronger executor can use
the retrieved context to produce a reproducible cognition/behavior difference, while the local
executor does not under the same protocol.*

Not permitted: that DeepSeek proves familiarity is inherently stronger; that familiarity is a
decision weight; that the local executor "cannot" use context in principle (it never did so under
THIS protocol); or that any of this opens decision authority.

## Cost / usage

| item | value |
| --- | --- |
| API requests (pilot + primary + replication) | 207 |
| prompt tokens | 592,184 |
| completion tokens | 308,920 |
| **total tokens** | **901,104** |
| cached tokens | 366,449 |
| reasoning tokens | 265,625 (never read, never scored) |
| **API cost** | **NOT_REPORTED_BY_PROVIDER** (no price data returned; none invented) |
| local tokens | not reported by the frozen native transport (Ollama returns no usage block) |

## Perturbation during the local pilot (recorded, not hidden)

The first pilot attempt ran while **Ollama was down** (`fetch failed` in 2–25 ms on every attempt;
0 tokens; 72 retries). The local half therefore scored `EXECUTOR_HOST_VALIDITY_FAILURE` while the API
half passed. Ollama (v0.34.0) was restarted, the failed run preserved as
`evidence/pilot-provider-down/`, and the pilot re-run in full: both executors then reached 1.000.
No configuration, prompt, threshold or code changed between the failed and successful pilots.

## History preservation

The pre-portability local result (`FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED`, `76b510b`) and
`MODEL_SUBSTITUTION_NOT_ISOLATED` (`6bf3f78`) are preserved untouched. Neither is directly comparable
to this experiment: both ran against the pre-portability prompt. This experiment rebuilt **both**
baselines under the portable contract.
