# PHASE 0 PROVIDER READINESS REPORT

**`PHASE0_PROVIDER_READINESS_GATE_FAIL`**
**`PHASE0_RERUN_REMAINS_BLOCKED_BY_PROVIDER_ENVIRONMENT`**
**`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`** · **`SCIENTIFIC_SUBJECT_TURNS_THIS_ROUND = 0`**
**`CHARACTEROS_CORE_SEMANTICS_UNMODIFIED`**

The gate asked one question, and the answer is no:

> Has this machine returned to a state in which the frozen scientific protocol can be executed
> faithfully — same provider, same model, same digest, same transport configuration, same timeout,
> no fallback?

Three planned probes, three timeouts at the frozen 120 s bound. Nothing was changed to fit the
environment, and nothing was retried.

---

## 1. RUN-2 IS FROZEN, NOT REINTERPRETED

`RUN2_PROVIDER_BLOCK_CLOSURE.json` — the run-2 report was not modified.

```
HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_BLOCKED_BEFORE_SCIENTIFIC_START
classification = PRE_SCIENTIFIC_INFRASTRUCTURE_BLOCK
scientific_subjects_created  = false
scientific_subject_turns     = 0
scientific_dataset_created   = false
scientific_denominator_started = false
scientific_status  = NOT_STARTED
operational_status = BLOCKED
```

It is **not** positive, **not** a scientific null, and **not** a scientific inconclusive. No subject
under study was ever created, so there is no scientific object for any of those verdicts to be about.
Run-2's evidence stays immutable; the next real start gets a new identity, `PHASE0-RUN-3`.

## 2. EXACT PROVIDER ATTEMPT ACCOUNTING

`RUN2_PROVIDER_ATTEMPT_LEDGER.json` — attempts are counted only where generation was actually invoked.

```
scientific_provider_attempts     = 0
non_scientific_provider_attempts = 4
total_provider_attempts          = 4
```

| # | purpose | status | tokens | tok/s |
| --- | --- | --- | --- | --- |
| 1 | run-2 bootstrap/qualification cognition call | **MODEL_TIMEOUT** (120 s) | — | — |
| 2 | throughput diagnostic before reload | COMPLETED | 51 | 0.98 |
| 3 | model unload (`keep_alive=0`) | COMPLETED | — | — |
| 4 | throughput diagnostic after reload | COMPLETED | 51 | 3.99 |

Attempt 1's request hash is recorded as **`NOT_RECORDED`** — the run aborted before persisting its
ledger and the in-memory record was lost. That gap is stated rather than back-filled from a
reconstruction that never ran. `GET /api/tags` and `GET /api/ps` invoke no generation and are listed
separately as health checks, not attempts.

**`SCIENTIFIC_MODEL_CALLS_THIS_ROUND = 0` — never abbreviated to `MODEL_CALLS = 0`.** This round made
four real provider attempts. None was scientific.

## 3. MODEL-VISIBLE SUBJECT-ID POLICY — FROZEN

Confirmed in production source: `conversation-cognition-provider-v2.ts:256` renders
`` `[identity] subject_id=${JSON.stringify(projection.subject_id)}` ``, so **`subject_id` is
model-visible**.

```
MODEL_VISIBLE_SUBJECT_ID_POLICY = OPAQUE_NON_SEMANTIC
future scientific subject ids   = subject-r3-<opaque>
```

Arm membership lives only in experiment metadata. `Alice-A`, `Alice-B`, `positive`, `negative`,
`trusted`, `betrayed` are forbidden in model-visible identity. Classification:
**removal of unnecessary arm-label leakage — not a scientific treatment change.** It constrains only
the identity bytes the executor can read; no prompt semantics, trajectory, proposition, credence law,
scorer or predicate is touched.

## 4. PROVIDER IDENTITY — UNCHANGED, AND CHECKED BEFORE ANY PROBE

`Ollama` at `http://127.0.0.1:11434`, `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` — identical to run-1 and run-2.
The gate refuses to send a probe if the digest changes; it did not change.

## 5. THE FROZEN PROBE CARRIED NO SCIENTIFIC INPUT

`PROVIDER_READINESS_REQUEST.json`, hash
`sha256:00339f4acf551b10c185c0cbbc427b511ec2f4a6c84530dd73075c001c96f338`, frozen before the first
attempt and reused byte-identically by all three. It contains **no** Phase-0 trajectory event, **no**
target proposition, **no** A/B valence span, **no** subject state and **no** arm identity. Its shape is
calibrated from run-1's measured request sizes (system 12,771 bytes; user 4,300–5,584 bytes) against
the frozen 2048-token budget and 8192-token context. The replicate ordinal never enters the request.

## 6. THE CRITERION IS DERIVED, NOT INVENTED

`PROVIDER_CAPACITY_REQUIREMENT.json`. Run-1 persisted its **requests** but **no completion lengths and
no per-call latency**, so any tokens/second threshold would have been fabricated — and §7 forbids
that. The frozen criterion is therefore **functional**:

> all planned probes complete normally, inside the frozen timeout, under the frozen transport
> configuration, with no transport failure, no model timeout, no mid-run reload, and no fallback.

Throughput is recorded as a **descriptive** metric. The stated limitation is explicit: even a PASS
would establish only that a production-shaped request with a long forced output fits the frozen
timeout — it would not prove a worst-case 2048-token output fits.

## 7. THE RESULT

| probe | status | latency | tokens | tok/s |
| --- | --- | --- | --- | --- |
| 1 | **MODEL_TIMEOUT** | 120,167 ms | — | — |
| 2 | **MODEL_TIMEOUT** | 120,222 ms | — | — |
| 3 | **MODEL_TIMEOUT** | 120,152 ms | — | — |

planned = actual = **3**. No probe beyond the plan was sent.

## 8. WHY — SERVER-SIDE EVIDENCE

`PROVIDER_READINESS_SERVER_SIDE_EVIDENCE.json`, from the inference server's own log:

- the three requests are recorded as `500 … 2m0s`, i.e. cancelled at the client's frozen bound;
- the model produced **509 tokens** before cancellation, at a **cumulative 4.39 tok/s**;
- but its **3-second-window rate was 10.46 tok/s and rising** (8.99 → 8.08 → 9.13 → 9.12 → 10.3 → 10.46);
- VRAM at gate time: **7672 / 8188 MiB**, GPU 80 °C, model ~5.05 GiB.

That combination — a cumulative rate far below a rising recent-window rate — is the signature of a
**slow start that recovers**, which is what VRAM pressure looks like: the opening tens of seconds go
into paging the working set in, after which throughput climbs toward the machine's real capability.
The probe demanded roughly 900–1000 output tokens and needed about 7.5 tok/s sustained; the machine
reaches ~10 tok/s in its best window but sustains ~4.4.

**So the environment is marginal, not dead.** It needs roughly a 2× improvement in sustained rate,
which is exactly what removing the paging pressure supplies.

## 9. WHAT WAS NOT DONE

No timeout was raised. `num_ctx` was not lowered. No provider or model was swapped. No generation
setting was changed. No extra probe was sent. **No operator application was terminated and no OS or
GPU setting was altered** — the gate only observes the environment.

## 10. RECOVERY PATH

Free VRAM — close GPU-consuming desktop applications so roughly **6.5 GiB or more of the 8.19 GiB
device is free before the model loads**, or restart the machine — then **re-run this same frozen
gate**. That is *execution-environment restoration*, explicitly not a CharacterOS scientific-design
modification, so long as the model, digest, provider, transport configuration (`num_ctx`,
`num_predict`, temperature, the 120 s timeout, no structured-output constraint) and the frozen
scientific design all stay as they are.

A PASS authorises **`PHASE0-RUN-3`**: a new evidence directory, fresh opaque subjects, the same frozen
scientific design — and no further infrastructure work in that round.

## 11. STATE

```
run-1  HISTORY_INTERNALIZATION_V1_INCONCLUSIVE     (frozen, 27 files verified byte-identical)
run-2  NOT_STARTED / BLOCKED                       (pre-scientific infrastructure block)
gate   FAIL                                        (provider environment)
phase 1  NOT AUTHORISED
evidence hierarchy  L1                             (unchanged — nothing scientific ran)
```
