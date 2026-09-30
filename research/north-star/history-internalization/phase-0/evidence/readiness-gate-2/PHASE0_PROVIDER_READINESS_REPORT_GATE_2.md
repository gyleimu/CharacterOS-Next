# PROVIDER READINESS GATE — SECOND EXECUTION REPORT

**`PHASE0_PROVIDER_READINESS_GATE_FAIL`**
**`PHASE0_RERUN_REMAINS_BLOCKED_BY_PROVIDER_ENVIRONMENT`**
**`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`** · **`PHASE0_RUN_3_NOT_AUTHORISED`**
`SCIENTIFIC_SUBJECT_TURNS = 0` · `SCIENTIFIC_PROVIDER_ATTEMPTS = 0`

The same frozen gate was executed again, unchanged. It failed again, on the same primary condition:
no probe completed inside the frozen 120 s bound.

---

## 1. NO PROTOCOL AMENDMENT

Verified **byte-identical** to the first execution before the first probe was sent:

| item | value |
| --- | --- |
| request hash | `sha256:00339f4acf551b10c185c0cbbc427b511ec2f4a6c84530dd73075c001c96f338` — **unchanged** |
| system / user bytes | 11,172 / 311 |
| provider · model · digest | Ollama · `qwen3.5:9b` · `6488c96f…` |
| transport configuration | `num_predict` 2048, `num_ctx` 8192, temperature 0, `think` false |
| structured-output constraint | **absent** — no `format` field |
| timeout | **120,000 ms**, frozen |
| planned N | **3** |
| PASS predicate | functional completion under frozen production conditions |

Nothing was adjusted to suit the machine.

## 2. ONE IMPLEMENTATION DEFECT WAS FIXED BEFORE RUNNING — CONFORMANCE, NOT AMENDMENT

The frozen predicate names four conditions: *complete normally, inside the frozen timeout, no mid-run
provider reload, no fallback*. The program's PASS computation drew on only some of them, leaving
digest stability and mid-gate reload **recorded but non-gating** — a predicate that did not test
everything it named. That gap was closed before this execution. The predicate, request bytes, hash,
provider, model, configuration, timeout and N are all unchanged; only the code was made to enforce the
predicate it already stated.

## 3. EXACT CALL ACCOUNTING (from zero, this round)

```
READINESS_PLANNED_PROBES   = 3
READINESS_EXECUTED_PROBES  = 3
planned == actual          = true
SCIENTIFIC_SUBJECT_TURNS   = 0
SCIENTIFIC_PROVIDER_ATTEMPTS = 0
OTHER_NON_SCIENTIFIC_PROVIDER_ATTEMPTS = 0
```

No generation was invoked outside the three planned probes. Environment inspection used only
`GET /api/ps` and `nvidia-smi`, neither of which invokes generation.

## 4. THE RESULT

| probe | status | latency | tokens |
| --- | --- | --- | --- |
| 1 | **MODEL_TIMEOUT** | 120,138 ms | — |
| 2 | **MODEL_TIMEOUT** | 120,195 ms | — |
| 3 | **MODEL_TIMEOUT** | 120,181 ms | — |

```
all_probes_completed_within_the_frozen_timeout = false
all_probes_completed_normally                  = false
all_probes_used_the_same_frozen_request_hash   = true
same_model_digest_throughout                   = true
no_fallback_used                               = STRUCTURALLY_TRUE_BY_CONSTRUCTION
```

## 5. THE ENVIRONMENT DID NOT IMPROVE — IT IS WORSE

This is descriptive information, and explicitly **not** the verdict criterion.

| | first gate | second gate |
| --- | --- | --- |
| tokens produced in 120 s | 509 | **125** |
| cumulative rate | 4.39 tok/s | **1.05 tok/s** |
| recent-window trend | rising to 10.46 tok/s | **oscillating 0.23 – 2.80 tok/s** |
| outcome | FAIL | FAIL |

The first gate showed a slow start that recovered. The second shows a rate that never becomes
workable at all.

**And the decisive structural fact:** the server log reports `load_tensors: offloaded 34/34 layers to
GPU`. The model is fully resident on the device. This is therefore **not** a GPU/CPU split and **not**
a partial-offload problem. The model is on the GPU, the GPU is nearly full (7,886 MiB of 8,188 MiB
with the model resident), and the tokens still crawl.

**Stated plainly: the execution-environment restoration did not achieve workable headroom for this
configuration.** The identical gate rejected the environment both times.

## 6. ONE CRITERION IMPRECISION — RECORDED, NOT PAPERED OVER

`no_provider_reload_midway` reports `false`, because probe 1 ran cold (model not yet resident,
4,728 MiB used) while probes 2 and 3 ran with the model resident (7,886 / 7,864 MiB). That is a **cold
load before the first probe, not a reload between probes** — the check as implemented conflates the
two. It is reported as imprecise rather than as a true mid-gate reload.

It does **not** affect the verdict: the gate failed on the primary conditions, no probe completing
within the frozen timeout, which are unambiguous. It was **not** corrected now, because altering a
criterion after seeing an outcome is exactly what this protocol forbids. It should be fixed before the
gate is next run, and before it can ever matter.

## 7. WHAT WAS NOT DONE

No fourth probe. No retry to success. The timeout was not raised. `num_ctx` was not lowered. No model
or provider was swapped. No generation setting was changed. No provider reload was forced between
probes. No operator process was terminated and no OS or GPU setting was altered. `PHASE0-RUN_3` was
not started.

## 8. INTERPRETATION BOUNDARY

A PASS would only have meant *the current execution environment is sufficient to run the frozen
provider configuration faithfully*. It would **not** have meant Phase 0 will succeed, that the
executor schema-invalid risk is gone, that History Internalization holds, or that belief adaptation
works. This FAIL is likewise **not** a CharacterOS scientific null — nothing scientific ran, and the
evidence hierarchy remains **L1**.

## 9. STATE

```
run-1   HISTORY_INTERNALIZATION_V1_INCONCLUSIVE   (frozen; 27 files re-verified byte-identical)
run-2   NOT_STARTED / BLOCKED                     (pre-scientific infrastructure block)
gate-1  FAIL                                      (provider environment)
gate-2  FAIL                                      (provider environment — worse than gate-1)
phase 1            NOT AUTHORISED
PHASE0_RUN_3       NOT AUTHORISED
evidence hierarchy L1
```

## 10. TO UNBLOCK

Re-run **this same frozen gate** after the machine genuinely sustains the frozen configuration. The
two executions together indicate that the configuration — a ~5.5 GiB model with an 8,192-token
context on an 8 GiB device that is otherwise carrying a desktop — currently does not fit. Only a PASS
authorises `PHASE0-RUN_3`, and that round then returns to the North Star with no further
infrastructure work.
