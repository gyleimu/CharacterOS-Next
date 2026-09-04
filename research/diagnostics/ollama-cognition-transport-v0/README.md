# OLLAMA_COGNITION_TRANSPORT_DIAGNOSTIC_V0

Neutral, manual, diagnostic-only reproduction for the instrumented
`OllamaNativeCognitionTransportV0` (OLLAMA_COGNITION_TRANSPORT_INSTRUMENTATION_V0).

This directory is **NOT** the V0/V1 experiment protocol, **NOT** part of gates or
CI, and carries **zero canonical authority**. It never touches
`research/experiments/` and never runs automatically.

## What it distinguishes

Four byte-identical neutral calls against the production transport, each fully
traced, plus local health snapshots, so the following can be separated:

| Question | Trace/snapshot field |
| --- | --- |
| When did the request start? | `ModelTransportTraceV0.request_started_at`, `STARTED` event |
| Did the timeout abort fire, and when? | `abort_triggered`, `abort_triggered_elapsed_ms`, `ABORT_TRIGGERED` event, `timeout_deadline_at` |
| When did the fetch Response arrive? | `fetch_response_elapsed_ms`, `RESPONSE_HEADERS_RECEIVED` event, `response_status` |
| How long did the body read take? | `body_read_elapsed_ms`, `BODY_READ_STARTED`/`BODY_READ_COMPLETED` events |
| What did the raw failure look like? | `raw_error_name`, `raw_error_message`, `raw_error_cause_code`, `failure_code` |
| What did Ollama itself report? | `ollama.total_duration/load_duration/prompt_eval_*/eval_*/done_reason` |
| What was local resource state? | `snapshot-start|midway|final.json` (server version, loaded models, process memory) |
| Were request bytes stable? | `request_hash` / `request_bytes` in each `call-0N/trace.json` |

## Known-gap visibility (not a repair)

The timeout timer guards **only** the fetch await. A stall during
`response.json()` is observable (`BODY_READ_STARTED` without
`BODY_READ_COMPLETED`, terminal trace with `terminal_stage: "BODY_READ"` or a
hung call) — the instrumentation makes the preserved gap visible without
changing it.

## Running (manual, deliberate)

```sh
node research/diagnostics/ollama-cognition-transport-v0/runner.ts --model <tag> \
  [--base-url http://127.0.0.1:11434] [--out <dir>]
```

Requires a previously built runtime (`pnpm build`): the runner imports the
built public seam `packages/runtime/dist/index.js` only.

## Artifacts

```
<out>/
  summary.json                 protocol identity, config, per-call summary rows
  snapshot-start.json          local health snapshot before call 1
  snapshot-midway.json         local health snapshot after call 2
  snapshot-final.json          local health snapshot after call 4
  call-0N/trace.json           final ModelTransportTraceV0 (or null)
  call-0N/events.json          ordered ModelTransportTraceEventV0 list
  call-0N/error.json           thrown-error bounded copy (or null)
  call-0N/recording.json       wall-clock window of the call
```

The runner asserts nothing and repairs nothing — every value is observational.
