# HISTORY_INTERNALIZATION_V1_PHASE0_RERUN — REPORT

**Verdict: `HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_INCONCLUSIVE`**
**Failure class: `PROVIDER_INFRASTRUCTURE_VRAM_EXHAUSTION`**
**Scientific turns executed: 0** · `SCIENTIFIC_MODEL_CALLS` on a required turn: **0** ·
`CHARACTEROS_CORE_SEMANTICS_UNMODIFIED` · **`HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`**

The rerun was prepared and gated correctly, and then **could not be executed**, because the machine
can no longer serve the frozen executor configuration. Nothing was retried, swapped, reconfigured or
redesigned. No scientific turn ran, so there is no scientific result of any kind — neither a null nor
a positive.

---

## 1. RUN-1 FROZEN SEPARATION

Run-1 remains `HISTORY_INTERNALIZATION_V1_INCONCLUSIVE`. Re-verified byte-identical: **27 files, 0
drifted, 0 added**, verifier proven able to fail (`PHASE0_RUN1_FREEZE.json` + `language-and-freeze.ts`).
Its subjects, states, outputs and partial observations were not reused, not re-scored and not admitted
to any denominator. Run-2 was to be a new independent execution of the same frozen design.

## 2. REMEDIATION IDENTITY (frozen before the first call)

```
EXECUTOR_SCHEMA_INVALID                = UNFIXED_MODEL_RELIABILITY_RISK
FAIL_CLOSED_SESSION_POISONING          = CONTAINED_AND_RECOVERABLE_AT_HOST_LAYER
FAILED_TURN_TRANSACTIONAL_ROLLBACK     = NOT_ESTABLISHED
```

The third token stays `NOT_ESTABLISHED` because a FAILED turn **can** change canonical revision/state
and is not rolled back. It is forbidden to claim a failed turn leaves no state mutation.

Host contract classification: `NOT_A_RUNTIME_CORE_CONTRACT_BUG` + `HOST_CONTRACT_ENFORCEMENT_DEFECT`.
The runtime already required the host to stop or restore; no host enforcement existed; `RecoveredSessionV0`
implements that contract.

## 3. FRESH-SUBJECT EQUIVALENCE

`r2-preflight.json` → `initial_state_equivalence_audit`:

| property | value |
| --- | --- |
| canonical initial state identical after identity strip | **true** |
| raw states unequal (so the parity check can fail) | **true** |
| target belief baselines equal | **true** |
| run-1 subject ids reused | **none** |

One deviation, declared: the brief named the subjects `Alice-A-R2` / `Alice-B-R2`. Those literal
identifiers were **not** used as `subject_id`, because `subject_id` is rendered into the model-visible
cognition prompt (`[identity] subject_id=…`), so a bare arm letter there is exactly the identifier
exposure the design forbids. The R2 lineage is kept as a shared prefix and the arm letter is replaced
by a non-semantic suffix (`subject-r2-k7q2-4103` / `subject-r2-k7q2-8267`), so the exposed identifier
still carries zero arm information.

## 4. PROVIDER IDENTITY

`qwen3.5:9b` at `http://127.0.0.1:11434`, digest `6488c96f…` — **identical to run-1's execution**.
No fallback configured, no substitution. Identity did **not** change; **throughput did**.

## 5. SCIENTIFIC SCHEDULE (frozen, and correctly separated)

```
required scientific subject turns = 10        (arm A 5 + arm B 5)
non-scientific bootstrap turns    = 1         (qualification; accounted separately, no endpoint role)
```

The stop rule was expressed in **frozen subject turns**, never in provider calls or observed belief
movement. A policy smoke run at 0 model calls verified both branches before any real call: all-ten-valid
freezes the endpoint; an invalid turn stops the run immediately, quarantines the subject, and **does not
finish the other arm** (verified: 9 cognition calls, not 11).

## 6. MODEL-FACING INVARIANCE

Frozen and honoured at the moment of the failure: **no** structured-output constraint enabled, **no**
schema change, **no** prompt change, **no** reminder, **no** retry, **no** semantic repair, **no**
provider or model change. The known Class A executor risk was deliberately **not** answered with any
of them.

## 7. TEN TURN OUTCOMES — NOT COLLECTED

The run stopped at the **non-scientific bootstrap turn**, before any subject under study existed.

```
MODEL_TRANSPORT_MODEL_TIMEOUT: ollama native cognition transport timed out after 120000ms
```

The frozen 120 s transport bound was reached while the model had produced ~132 tokens.

## 8. EXACT PROVIDER LEDGER — EMPTY OF SCIENTIFIC ATTEMPTS

No scientific turn executed, so the ledger has **no scientific attempts**. The instrumentation that
would have produced the §13 fields (subject_id, scientific_turn_id, runtime_turn_index, call_family,
request_hash, provider_status, parser_status, semantic_status) is implemented and verified at 0 calls
by the policy smoke run; it simply never had a scientific turn to record.

## 9. WHY IT COULD NOT RUN — DIAGNOSIS

| measurement | value |
| --- | --- |
| VRAM used / total, model loaded | **7729 / 8188 MiB** |
| VRAM used, model unloaded | 2557 / 8188 MiB |
| model resident in VRAM | ~5.05 GiB |
| throughput before unload/reload | **0.98 tok/s** (51 tokens in 52.0 s) |
| throughput after a full unload/reload cycle | **3.99 tok/s** |
| GPU temp / SM clock / max | 86 °C / 1950 MHz / 3105 MHz |

**Arithmetic:** 5.05 GiB model + 2.50 GiB desktop = 7.55 GiB against an 8.19 GiB device, leaving no
headroom for the 8192-token KV cache and compute buffers. Every token pages.

**Why run-1 was fine:** when the server started for run-1 it reported **6.9 GiB available** — the
desktop held ~1.1 GiB then and holds ~2.5 GiB now. **The experiment did not change; the machine did.**

## 10. INVALID COUNT

- required scientific turns invalid: **0** (none executed)
- non-scientific bootstrap turns failed: **1**
- this is `PROVIDER_INFRASTRUCTURE`, not a scientific invalidity

## 11–13. CANONICAL BELIEF PRE/POST, ARM DELTAS, DIVERGENCE

**Not computed, and correctly so.** The post-state endpoint is defined only when all ten required
scientific turns are valid; no subject under study was ever created, no pre-state was frozen, and a
quarantined or non-existent state may not enter the state-delta scorer or the arm-divergence scorer.

## 14. DATASET HASH

`r2-dataset.json` records `scored: false` with the reason *"no scientific turn was executed, so there
is no dataset to score"*. No dataset hash is claimed, because there is no dataset.

## 15. FROZEN SCORER OUTPUT

The scorer was **not invoked on scientific data**. The single scoring program detected the missing
execution manifest and took the infrastructure-block path, emitting the frozen inconclusive token.
The scorer itself (`scorePhase0V0`) is unchanged since run-1 and was not reached.

## 16. EVIDENCE-LEVEL UPDATE

**L1 → L1. Nothing raised.** A run that executed no scientific turn cannot move the hierarchy.

## 17. PHASE-1 AUTHORISATION

**Not authorised.** `HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`.

## 18. EXPLICIT NON-CLAIMS

Not established, at any reading: that lived experience changes persistent belief (L2); that persistent
belief alters cognition in a new scenario with the history removed (L3); that it alters decision or
behaviour (L4); that it survives restart (L5); that it separates from a summary baseline (L6); that
the subject has been shaped by its life; that history internalization works; that a failed turn leaves
no state mutation; that the executor schema-invalid risk is fixed; and anything about the model's own
dispositions — **the LLM is an executor; the subject is the canonical state**.

---

## PRECONDITION TO RESUME

Free VRAM so that the model plus its 8192-token KV cache fit alongside the desktop — approximately
**6.5 GiB or more of the 8.19 GiB device free before the model loads**. Verify at server startup that
the available figure is near run-1's 6.9 GiB, then measure a short generation and require **tens of
tokens per second** before submitting any scientific turn.

Resuming must **not** change the model, the provider, the transport configuration (`num_ctx`, the 120 s
bound), the trajectory, the valence table, the turn count, the scorer, the predicate or the invalid
policy. Run-2's directory is a clean scientific slate — zero scientific turns, zero subject states —
so the bootstrap may be re-attempted once the precondition holds, with this failure declared.
