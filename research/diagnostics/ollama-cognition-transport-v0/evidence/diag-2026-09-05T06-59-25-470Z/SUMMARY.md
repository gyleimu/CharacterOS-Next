# OLLAMA_COGNITION_TRANSPORT_DIAGNOSTIC_V0 — Run Summary

Run id: `diag-2026-09-05T06-59-25-470Z`
Executed at HEAD `3795d3685a7ec3562638309a542a418242ae406f` (== origin/main, worktree clean).
This is a diagnostic observation, NOT a scientific experiment. No PASS/FAIL claim.

## Result category

**DIAGNOSTIC_NO_REPRODUCTION** — all four neutral cognition calls completed
successfully; the R3 failure mode (MODEL_TIMEOUT at 120000 ms) did not reproduce.

## Provider lock (verified before any model call)

- Ollama version: `0.33.2` (expected `0.33.2` — match)
- Model: `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` (exact match)
- Transport: `OllamaNativeCognitionTransportV0` (built dist seam; production provider wrapper `LlmCognitionProviderV0` wraps this transport in production — the diagnostic targets the transport layer directly)
- Config as sent on the wire (verified via trace `request_hash` over 229 bytes): `temperature=0`, `think=false`, `stream=false`, `num_predict=2048`, `timeout_ms=120000`, no seed field, no retries
- Ollama processes: `ollama` PID 87716, `ollama app` PID 86776 (start times in `ollama-process-prerun.json`)

## Call table (exact recorded values)

| Call | Initial residency | RAM/GPU state | Request bytes | Fetch elapsed | Body elapsed | Total elapsed | Abort | Terminal stage | Outcome | Ollama prompt/generation timing |
|------|-------------------|---------------|---------------|---------------|--------------|---------------|-------|----------------|---------|---------------------------------|
| 01 | NOT resident (`/api/ps` `models:[]`) | free RAM 505.98 MB / 16.34 GB; GPU 2728/8188 MiB, 89%, 87 °C | 229 | 23660 ms | 1 ms | 23663 ms | false | COMPLETED | SUCCESS | load 19757.27 ms; prompt_eval 1846.45 ms / 29 tok; eval 2002.28 ms / 2 tok |
| 02 | resident (5.49 GB VRAM) | free RAM 605.59 MB; GPU 7847/8188 MiB, 100%, 86 °C | 229 | 120 ms | 0 ms | 121 ms | false | COMPLETED | SUCCESS | load 2.10 ms; prompt_eval 69.27 ms / 4 tok; eval 33.87 ms / 2 tok |
| 03 | resident | free RAM ~same; GPU resident | 229 | 119 ms | 0 ms | 120 ms | false | COMPLETED | SUCCESS | load 2.09 ms; prompt_eval 66.05 ms / 4 tok; eval 31.35 ms / 2 tok |
| 04 | resident | free RAM ~same; GPU resident | 229 | 114 ms | 0 ms | 115 ms | false | COMPLETED | SUCCESS | load 1.54 ms; prompt_eval 66.31 ms / 4 tok; eval 31.47 ms / 2 tok |

All four requests share one `request_hash` (`sha256:b07626e1d9a46de76009de612840fb326b62364049a70616d2296987b1b8bad9`) — byte-identical neutral inputs. Distinct `trace_id` per call.

## Diagnostic questions (evidence-supported answers)

1. **Did call 1 timeout?** No. Max elapsed 23663 ms vs 120000 ms deadline.
2. **Was the model resident before call 1?** No — pre-run `/api/ps` showed `models:[]`. Natural cold state; no warm-up was sent.
3. **Did residency change after call 1?** Yes — `qwen3.5:9b` became fully VRAM-resident (5490081790 bytes) and remained resident through call 4; no unload events in the log window.
4. **Did latency materially improve across calls?** Yes — 23663 → 121 → 120 → 115 ms (~197× after residency).
5. **Did any call approach 120 seconds?** No.
6. **Did abort occur before a Response was received?** No — `abort_triggered=false` in all traces.
7. **Did any call reach BODY_READ?** Yes — all four (BODY_READ_STARTED → BODY_READ_COMPLETED; 1 ms / 0 ms / 0 ms / 0 ms).
8. **Large Ollama durations?** Call 1 only: `load_duration` 19757.27 ms (dominant), `prompt_eval_duration` 1846.45 ms (cold, 29 tokens), `eval_duration` 2002.28 ms (first inference after load, 2 tokens). Warm calls: all sub-70 ms.
9. **Did RAM/GPU state correlate with slow calls?** The single slow call is fully explained by cold model load (19.76 s of 23.66 s). System free RAM was critically low the whole window (398–605 MB of 15.2–16.3 GiB, also logged by Ollama itself); free VRAM was sufficient (7047 MiB free at fit time; model used 4987 MiB). n=1 cold call — no correlation claim.
10. **Server log events?** load: full load sequence logged (mmap disabled `reason=windows_cuda`, 34/34 layers offloaded, CUDA0 buffer 4717.38 MiB, `srv llama_server: model loaded`). cache update: prompt-prefix cache visibly effective (prompt_eval 29 → 4 tokens from call 2 on). release: per-task slot releases only (normal completions). cancel: zero. runner delay/resource warnings: `WARN runner.go:584 "llama-server GPU discovery watchdog timed out" error="context deadline exceeded"`, followed by `WARN "unable to refresh free memory, using old values"`, and `system memory … free="398.5 MiB"` at load scheduling time.
11. **Did the original R3 failure mode reproduce?** No.

## Root-cause update

**Category: PROVIDER_STARTUP_OR_RESIDENCY_SUSPECTED — confidence MEDIUM.**

The dominant latency source in this window is the provider startup/load phase
(19.76 s cold load under a GPU-discovery watchdog timeout warning and ~400–600 MB
free system RAM). Warm resident calls complete in ~120 ms. This is consistent
with (but does not prove) the hypothesis that R3's MODEL_TIMEOUT windows arose
when load/startup latency stacked with concurrent memory pressure or repeated
model (re)loads. Four successful calls do NOT prove reliability is fixed.

## Next slice

**READY_FOR_EXTENDED_DIAGNOSTIC** — instrumentation works and isolates every
phase; four calls in a quiet window could not reproduce the failure. An extended
diagnostic under concurrent memory/load pressure (and/or a longer cold/warm
alternation) is the evidence-backed next step. No reliability repair is
justified by this run; no transport defect was observed.

## Execution integrity

- Exactly 4 cognition calls, 0 language calls, 0 evaluator calls; strictly serial.
- No warm-up (first model touch = call 1). No retries. No Promise.race. No
  keep_alive/preload/unload/restart. Transport untouched during and after the run.
- Executed via a one-off `tmp/` orchestrator (not committed) that imports the
  frozen fixture (`fixture.ts`) unmodified and the built production transport
  from `packages/runtime/dist`; fixture/runner SHA-256 recorded in `manifest.json`.
  Evidence persistence was incremental, so even a stalled call would have left
  its events; a stall watchdog only annotates and never aborts the transport.

## Artifacts

`manifest.json`, `provider-lock.json`, `ollama-process-prerun.json`,
`snapshot-prerun.json`, `snapshot-after-call-1..4.json`, `log-window.json`,
`log-window.txt` (43981 bytes of `server.log`, offsets 169567→213548),
`call-01..04/{trace.json,events.json,recording.json,error.json}`, `summary.json`.
