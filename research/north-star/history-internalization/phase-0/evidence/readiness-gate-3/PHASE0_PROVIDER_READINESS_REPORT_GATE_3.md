# PROVIDER READINESS GATE — THIRD EXECUTION REPORT

**`PHASE0_PROVIDER_READINESS_GATE_PASS`**
**`PHASE0_RUN_3_AUTHORISED`** · **`PHASE0_FRESH_RERUN_AUTHORISED`**
**`SCIENTIFIC_SUBJECT_TURNS_THIS_ROUND = 0`** · **`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`**

The identical frozen gate was executed a third time. **3/3 probes completed inside the frozen
timeout.** The machine can now faithfully run the frozen configuration. Run-3 is authorised for the
next round and was **not** started here.

---

## 1. GATE 1 AND GATE 2 ARE PRESERVED

Their artifacts, verdicts, measured throughput and environment snapshots are untouched. **Both remain
FAIL**, and the reason is unchanged and sufficient:

```
planned probes = 3
completed within the frozen timeout = 0
timeouts = 3
```

A correction made after gate 2 does **not** retroactively change gate 2, and must not.

## 2. THE CONFORMANCE CORRECTION — AND WHY IT WAS LOAD-BEARING

§2 asked for one ambiguity to be fixed at 0 provider calls: `no_provider_reload_midway` conflated a
cold initial load with a mid-sequence reload. The frozen semantics are now implemented literally in
`reload-detection.ts`:

- **Allowed** — the model starts unloaded, the **first** planned probe causes exactly one initial
  load, and the same resident model serves every remaining probe.
- **Forbidden** — any unload, second load, digest change or provider restart **within the planned
  sequence**.

**This correction decided the outcome.** Under the old rule (`every probe's pre-state must equal
probe 1's pre-state`), this run's timeline — probe 1 starting cold, probes 2 and 3 starting resident —
would have been reported as a mid-gate reload, and a demonstrably healthy machine would have been
**rejected**. Observed timeline this run: `011111`, transitions 1, loads 1, unloads 0 →
`mid_gate_reload = false`.

It rescued nothing: gates 1 and 2 both failed on unambiguous primary conditions, and neither verdict
moves. The correction was written and audited **before** this execution.

## 3. §4 FALSIFIABILITY AUDIT — 0 PROVIDER CALLS

`RELOAD_DETECTION_SYNTHETIC_AUDIT.json`. Each row mutates the **observation timeline the detector
reads**, and asserts the mutation actually changed those bytes before checking the verdict — a
mutation that mutates nothing proves nothing.

| case | kind | expected | observed | mutated |
| --- | --- | --- | --- | --- |
| A cold start then resident | POSITIVE_CONTROL | false | **false** | baseline |
| B explicit unload between probes | FALSIFYING | true | **true** | yes |
| C digest change between probes | FALSIFYING | true | **true** | yes |
| D resident throughout | POSITIVE_CONTROL | false | **false** | yes |
| E second load transition | FALSIFYING | true | **true** | yes |

5/5 rows ok, falsifiable = true. The detector's own `detection_scope` records its limit honestly: a
silent unload-and-reload completing entirely *between* two sample points while ending resident is not
observable.

## 4. §5 IMPLEMENTATION FREEZE, RECORDED BEFORE GENERATION

```
scientific_content_changed          = false
readiness_predicate_changed         = false
request_bytes_changed               = false
provider_config_changed             = false
implementation_conformance_changed  = true
```

Source hash, synthetic audit result and implementation manifest were frozen in
`READINESS_IMPLEMENTATION_MANIFEST.json` before the first probe.

## 5. §6 FROZEN REQUEST — BYTE-FOR-BYTE

```
request hash   sha256:00339f4acf551b10c185c0cbbc427b511ec2f4a6c84530dd73075c001c96f338
```

Unchanged from gates 1 and 2. The gate serializes the contract's request object directly, so the
comparison is over the **exact bytes transmitted**, not a parsed structure. Config identical:
`num_predict` 2048, `num_ctx` 8192, temperature 0, `think` false, **no** structured-output field,
timeout **120,000 ms**, N = 3.

## 6. §7 PROVIDER IDENTITY — CHECKED BEFORE PROBE 1

Ollama · `qwen3.5:9b` · digest `6488c96f…` — matches the frozen digest. No drift, so the gate
proceeded. A change would have stopped the run before probe 1.

## 7. §9 THE THREE PROBES

| probe | status | latency | tokens | tok/s |
| --- | --- | --- | --- | --- |
| 1 | **COMPLETED** | 51,710 ms | 1,492 | 35.29 |
| 2 | **COMPLETED** | 44,320 ms | 1,492 | 33.82 |
| 3 | **COMPLETED** | 46,980 ms | 1,492 | 31.89 |

Identical frozen bytes each time, identical completion length each time. Exactly three probes were
sent: no retry, no fourth probe, no unload/reload as optimisation, no timeout or config change.

**All criteria PASS:** completed within the frozen timeout ✓ · completed normally ✓ · same frozen
request hash ✓ · same model digest throughout ✓ · no mid-gate reload ✓ · no fallback
(`STRUCTURALLY_TRUE_BY_CONSTRUCTION` — there is no fallback path in the code, recorded as such rather
than as a check that can never fail).

## 8. §8 ENVIRONMENT — DESCRIPTIVE ONLY

VRAM 1,236 / 8,188 MiB before the first probe, GPU 68 °C, model cold. **No VRAM threshold gates this
verdict** — the functional predicate does. Across the three executions:

| | gate 1 | gate 2 | gate 3 |
| --- | --- | --- | --- |
| probes completed | 0/3 | 0/3 | **3/3** |
| tokens in the window | 509 / 120 s | 125 / 120 s | **1,492 / ~45 s** |
| rate | 4.39 tok/s | 1.05 tok/s | **31.9–35.3 tok/s** |
| outcome | FAIL | FAIL | **PASS** |

The environment was restored to roughly run-1's working conditions; the frozen configuration now fits
with headroom.

## 9. §12 EXACT ACCOUNTING

```
READINESS_PLANNED_PROBES   = 3
READINESS_EXECUTED_PROBES  = 3      planned == actual: true
SCIENTIFIC_SUBJECT_TURNS   = 0
SCIENTIFIC_PROVIDER_ATTEMPTS = 0
READINESS_PROVIDER_ATTEMPTS = 3
OTHER_NON_SCIENTIFIC_PROVIDER_ATTEMPTS = 0
```

`SCIENTIFIC_MODEL_CALLS = 0` is **not** abbreviated to `MODEL_CALLS = 0`. This round made three real
provider attempts; none was scientific. Environment inspection used only `GET /api/tags`,
`GET /api/ps` and `nvidia-smi`, which invoke no generation — and the previous rounds' diagnostics were
deliberately not repeated, so `OTHER` stays exactly zero.

## 10. §8/§10 FROZEN SCOPE OF THIS AUTHORIZATION

```
NEXT_EXECUTION_ID              = PHASE0_RUN_3
MODEL_VISIBLE_SUBJECT_ID_POLICY = OPAQUE_NON_SEMANTIC
FRESH_SUBJECTS_REQUIRED         = true
scientific_denominator_created  = false
run_3_started_this_round        = false
```

It authorizes **execution only**: a new evidence directory, fresh opaque subjects, the same frozen
scientific design, the same provider identity. No scientific denominator was created and Run-3 was
not begun.

## 11. INTERPRETATION BOUNDARY

PASS means one thing: **the current execution environment is sufficient to run the frozen provider
configuration faithfully.** It does **not** mean Phase-0 will succeed, that the executor
schema-invalid risk is gone (it remains `UNFIXED_MODEL_RELIABILITY_RISK`), that History
Internalization holds, or that belief adaptation works. It is not a scientific result; the evidence
hierarchy remains **L1**.

## 12. STATE

```
run-1   HISTORY_INTERNALIZATION_V1_INCONCLUSIVE     (frozen)
run-2   NOT_STARTED / BLOCKED                       (pre-scientific infrastructure block)
gate-1  FAIL · gate-2 FAIL · gate-3 PASS            (all three preserved)
PHASE0_RUN_3              AUTHORISED — next round, nothing else this round
HISTORY_INTERNALIZATION_PHASE_1   NOT AUTHORISED
CHARACTEROS_CORE_SEMANTICS        UNMODIFIED
```
