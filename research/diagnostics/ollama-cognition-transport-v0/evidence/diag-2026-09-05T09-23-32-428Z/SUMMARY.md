# OLLAMA_COGNITION_TRANSPORT_DIAGNOSTIC_V0 — Run Summary (Rerun)

Run id: `diag-2026-09-05T09-23-32-428Z` (second run; first run: `diag-2026-09-05T06-59-25-470Z`)
Executed at HEAD `93ad28678f5bc4fa380abf75a4e2e069af3568a0` (== origin/main, worktree clean).
This is a diagnostic observation, NOT a scientific experiment. No PASS/FAIL claim.

## Environmental note (recorded honestly)

The Ollama server was found STOPPED when this rerun began (it had been running
during the first run). It was started via the normal Windows `ollama app.exe`
launcher at 17:20–17:21 local (PIDs: `ollama` 93560, `ollama app` 88160), before
any evidence capture. The server.log rotated on restart; the log window below
covers the fresh file from offset 4658. No model preload: pre-run `/api/ps` was
`models:[]` and the first model touch was call 1.

## Result category

**DIAGNOSTIC_NO_REPRODUCTION** — all four neutral cognition calls completed
successfully; the R3 failure mode (MODEL_TIMEOUT at 120000 ms) did not reproduce.

## Provider lock (verified before any model call)

- Ollama version: `0.33.2` (expected `0.33.2` — match)
- Model: `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` (exact match)
- Transport: `OllamaNativeCognitionTransportV0` (built dist seam); config as sent on the
  wire: `temperature=0`, `think=false`, `stream=false`, `num_predict=2048`,
  `timeout_ms=120000`, no seed field, no retries
- Same fixture as the first run: request_hash identical across ALL calls of BOTH runs
  (`sha256:b07626e1d9a46de76009de612840fb326b62364049a70616d2296987b1b8bad9`, 229 bytes)

## Call table (exact recorded values)

| Call | Initial residency | RAM/GPU state | Request bytes | Fetch elapsed | Body elapsed | Total elapsed | Abort | Terminal stage | Outcome | Ollama prompt/generation timing |
|------|-------------------|---------------|---------------|---------------|--------------|---------------|-------|----------------|---------|---------------------------------|
| 01 | NOT resident (`/api/ps` `models:[]`) | free RAM 3771.77 MB / 16.34 GB; GPU 1139/8188 MiB, 34%, 71 °C | 229 | 8150 ms | 0 ms | 8152 ms | false | COMPLETED | SUCCESS | load 7959.45 ms; prompt_eval 122.88 ms / 29 tok; eval 42.50 ms / 2 tok |
| 02 | resident (5.49 GB VRAM) | free RAM 2001.37 MB; GPU 7210/8188 MiB, 57%, 76 °C | 229 | 170 ms | 0 ms | 172 ms | false | COMPLETED | SUCCESS | load 2.10 ms; prompt_eval 79.42 ms / 4 tok; eval 77.25 ms / 2 tok |
| 03 | resident | resident | 229 | 108 ms | 0 ms | 110 ms | false | COMPLETED | SUCCESS | load 1.75 ms; prompt_eval 63.46 ms / 4 tok; eval 32.98 ms / 2 tok |
| 04 | resident | resident | 229 | 110 ms | 0 ms | 112 ms | false | COMPLETED | SUCCESS | load 1.04 ms; prompt_eval 64.54 ms / 4 tok; eval 36.40 ms / 2 tok |

All four requests share one `request_hash`; distinct `trace_id` per call.

## Cross-run contrast (run 1 → run 2, same machine/model/request)

| Signal | Run 1 (06:59Z) | Run 2 (09:23Z) |
|---|---|---|
| Cold load_duration | 19757.27 ms | 7959.45 ms (2.5× faster) |
| Cold prompt_eval_duration | 1846.45 ms (29 tok) | 122.88 ms (29 tok, 15× faster) |
| Cold eval_duration | 2002.28 ms | 42.50 ms |
| GPU discovery watchdog WARN | present (`context deadline exceeded`) | absent |
| "unable to refresh free memory" WARN | present | absent |
| System free RAM at load | 398.5 MiB | 3.5 GiB |
| GPU temperature | 87 °C | 71 °C |
| Warm calls | ~115–121 ms | ~110–172 ms |

## Diagnostic questions (evidence-supported answers)

1. **Did call 1 timeout?** No (8152 ms vs 120000 ms deadline).
2. **Was the model resident before call 1?** No — natural cold state, no warm-up.
3. **Did residency change after call 1?** Yes — `qwen3.5:9b` fully VRAM-resident (5490081790 bytes), remained resident through call 4; no unload events.
4. **Did latency materially improve across calls?** Yes — 8152 → 172 → 110 → 112 ms.
5. **Did any call approach 120 seconds?** No.
6. **Did abort occur before a Response was received?** No — `abort_triggered=false` in all traces.
7. **Did any call reach BODY_READ?** Yes — all four (0 ms body time each).
8. **Large Ollama durations?** Call 1 only: `load_duration` 7959.45 ms (dominant). All other phases sub-80 ms.
9. **Did RAM/GPU state correlate with slow calls?** The slow call is again fully explained by the load phase. This run had 3.5 GiB free RAM (vs 398 MiB in run 1) and a clean GPU discovery — and the load was 2.5× faster; the cold prompt-eval was 15× faster. Two runs cannot establish correlation, but the startup-phase variance tracks environmental pressure directionally.
10. **Server log events?** load: full sequence (34/34 layers offloaded, `model loaded`). cache update: prompt-prefix cache effective (29 → 4 tokens from call 2 on). release: per-task slot releases only. cancel: zero. runner delay/resource warnings: NONE this run (both run-1 warnings absent).
11. **Did the original R3 failure mode reproduce?** No.

## Root-cause update

**Category: PROVIDER_STARTUP_OR_RESIDENCY_SUSPECTED — confidence MEDIUM (revised upward from first run, still not proven).**

Two independent runs of the identical neutral request show the entire latency
and instability surface lives in the provider startup/load phase: 8–20 s cold
load with phase-internal warnings (run 1: GPU discovery watchdog timeout +
free-memory refresh failure under ~400 MiB free RAM) vs uniformly fast resident
calls (~110–170 ms). The load phase is the only phase with observed variability
large enough to matter against a 120000 ms deadline if compounded by heavier
contention or repeated reloads. Four-plus-four successful calls do NOT prove
reliability is fixed.

## Next slice

**READY_FOR_EXTENDED_DIAGNOSTIC** — same as after run 1. The instrumentation
reliably isolates every phase across runs; reproducing the failure likely
requires an extended diagnostic under deliberate memory/VRAM pressure or
load/unload churn. No transport defect observed in either run.

## Execution integrity

- Exactly 4 cognition calls, 0 language calls, 0 evaluator calls; strictly serial.
- No warm-up (first model touch = call 1). No retries. No Promise.race. No
  keep_alive/preload/unload/restart DURING the run. Transport untouched.
- Server start before evidence capture is disclosed above; it restored the
  host's normal state (the first run also began with the server already up).
- Executed via a one-off `tmp/` orchestrator (identical to run 1, not committed)
  importing the frozen `fixture.ts` unmodified; fixture/runner SHA-256 recorded
  in `manifest.json`. Incremental event persistence preserved per-call evidence.

## Artifacts

`manifest.json`, `provider-lock.json`, `ollama-process-prerun.json`,
`snapshot-prerun.json`, `snapshot-after-call-1..4.json`, `log-window.json`,
`log-window.txt` (43037 bytes of the fresh `server.log`, offsets 4658→47695),
`call-01..04/{trace.json,events.json,recording.json,error.json}`, `summary.json`.
