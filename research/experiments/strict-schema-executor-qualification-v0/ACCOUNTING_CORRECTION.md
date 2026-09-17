# ACCOUNTING CORRECTION — STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0

**Append-only evidence seal.** This document corrects an execution-accounting defect
in the Gate S qualification. It re-runs nothing, re-scores nothing, edits no prior
artifact and draws no scientific conclusion.

## What was wrong

The Gate S qualification ran **twice** against the local grammar control. The second
run overwrote the first run's artifact, so the published artifact records only the
second run's 5 calls while the true execution count is **10**. An independent audit
found this and blocked the result with a single, narrow reason:
`ACTUAL CALL ACCOUNTING INCOMPLETE`. The structural observations themselves were
never in question.

## The true ledger

| run | status | provider / model | calls | completion window (local) | artifact |
| --- | --- | --- | --- | --- | --- |
| 1 | `SUPERSEDED` | `ollama-local` / `qwen3.5:9b` | 5 | 19:38:11 – 19:38:38 | `OVERWRITTEN_NOT_PRESERVED` |
| 2 | `AUTHORITATIVE_PRESERVED_ARTIFACT_RUN` | `ollama-local` / `qwen3.5:9b` | 5 | 19:39:58 – 19:41:53 | preserved |

```
TOTAL_ACTUAL_MODEL_CALLS = 10
TOTAL_LOCAL_OLLAMA_CALLS = 10
EXTERNAL_PROVIDER_CALLS  = 0
DEEPSEEK_CALLS = 0 · OPENAI_CALLS = 0 · ANTHROPIC_CALLS = 0 · GEMINI_CALLS = 0
FIRST_RUN_ARTIFACT_STATUS = OVERWRITTEN_NOT_PRESERVED
FIRST_RUN_RAW_OUTPUTS_RECONSTRUCTED = false
```

The first run's raw model outputs **were not preserved and are not reconstructed**.
Only server-log-derived execution metadata exists for that run.

## Forensic source

`tmp/ollama-serve-restart.log` — the local inference server's access log.

```
SERVER_LOG_FILE_HASH = sha256:51c8e1cc91dec03ecf178743d4fa674131316c44f0054fe8f43a6f4cfd63b06e
```

The log carries **no task or request id field** in this format, so each call is
anchored by date, completion timestamp, duration, **line number and byte offset** —
anchors that survive later appends to the live log. On the run day the log holds 10
`POST /api/chat` records (5 + 5) plus 2 `GET /api/tags` records, which are not model
calls and were excluded from the count.

## Rubric and fix chronology

```
RUBRIC_HASH_PRE_FIRST_CALL = sha256:090dd99b080be17e5e5cea7dbd7a64d6975e5aded739523c846f23d6f4f1d400
RUBRIC_HASH_POST_FIX       = sha256:090dd99b080be17e5e5cea7dbd7a64d6975e5aded739523c846f23d6f4f1d400
RUBRIC_HASH_FINAL          = sha256:090dd99b080be17e5e5cea7dbd7a64d6975e5aded739523c846f23d6f4f1d400
RUBRIC_CHANGED_AFTER_OUTCOME = false

pre-first-call commit : 378180b631bea452001e41cfb182fc22b832623f
post-fix commit       : ee724a11dea25dbe65be48ad09180ce6c311145d
POST_OUTCOME_FIX_LOAD_BEARING_FOR_OLLAMA_GATE_S = false
```

The fix changed only the DeepSeek negative-control dispatch ordering (its state
became `STRICT_FEATURE_UNAVAILABLE` instead of `NOT_TESTED_NO_CREDENTIAL`). It
touched no criterion, prompt, schema, budget or Gate S predicate.

## Full-V8 scope seal

```
FULL_V8_FORMAT_ACCEPTED               = true
FULL_V8_GENERATION_COMPLETED          = false
FULL_V8_SCHEMA_SHAPE_VALID            = NOT_ESTABLISHED
FULL_V8_PRODUCTION_CANONICALIZER_VALID = NOT_TESTED
MAX_LENGTH_SEMANTICS                  = UNVERIFIED
```

S6 asks only whether the full canonical V8 schema is **accepted as the constraint**,
and that is what it evidenced. S6 was not redefined — and this must not be read as
end-to-end V8 compliance.

## Structural verdict wording (unchanged in meaning, now scoped)

`OLLAMA_LOCAL_QWEN3_5_9B_STRUCTURAL_GATE_PASS_UNDER_FROZEN_RUBRIC`

- minimal adversarial enforcement proven (nested object, enum, required key, closed keys)
- full V8 **format** acceptance proven
- full V8 completed-generation validity **NOT** proven
- `maxLength` semantics **UNVERIFIED**
- STRUCTURE only: this is NOT a cognition pass and NOT an executor selection

## Candidate states (unchanged)

`deepseek-api` = `STRICT_FEATURE_UNAVAILABLE` (0 Gate S calls; frozen capability
evidence reused, endpoint never re-probed) · `openai-strict`, `anthropic-strict`,
`gemini-strict` = `NOT_TESTED_NO_CREDENTIAL` (0 calls each).

## Existing cognition evidence (context only, not a verdict)

The historical local `qwen3.5:9b` Familiarity result (`FAMILIARITY_EFFECT_INCONCLUSIVE`,
`host_complete = false`) is recorded as
`WEAK_INCONCLUSIVE_FOR_QUALIFICATION_PURPOSES`. It was not produced by the Gate C
rubric and is **not** re-labelled as a Gate C failure.

## Derived artifact

```
path : tmp/qualification/strict-schema-executor-qualification-accounting-correction.json
hash : sha256:3d8ffe7389f5702f362bceba3e4c4e4c18d260e7eeafd0029f0bf6863172c9ee
```

Generated twice, byte-identical. The original qualification artifact was not edited,
overwritten or regenerated: its core hash and its file hash are both unchanged.

```
ORIGINAL_ARTIFACT_HASH      = sha256:e02e553d2215b96c5199085b730a79b79e6c0a14ef5118f0190ae432395039b2
ORIGINAL_ARTIFACT_FILE_HASH = sha256:401400dec63c5d0c9cf3a9df78e92321e97efcb854db3e0ae7ee57ff41816611
```

## Status

`GATE_C_EXECUTED = false` · `GATE_C_CALLS = 0` ·
`FORMAL_EXECUTOR_CHANGED = false` · `MODEL_CALLS_THIS_REMEDIATION = 0` ·
`PRIMARY_AUTHORIZED = FALSE`.

This seal corrects accounting only. It does not lift the audit's BLOCKED status —
only an independent remediation audit can do that.
