# OLLAMA_ENVIRONMENT_RESOURCE_DIAGNOSTIC_V0

Run id: `environment-resource-v0-2026-09-05T09-57-37-726Z`

Starting HEAD: `157d9ebf84e971ee5a0dd1d93c5ee577611f0044`

Result: **RESOURCE_PRESSURE_EFFECT_SUGGESTED**

Root-cause update: **ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED / MEDIUM**

Next slice: **READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN**

This is a bounded product-environment diagnostic. It has no canonical,
behavioral or scientific authority, and it did not start R4.

## Safety and pressure protocol

The diagnostic used exactly three serial host-RAM stages: no reservation,
512 MiB and 1024 MiB. The helper allocated touched memory in fixed 16 MiB
chunks, enforced a 768 MiB available-memory floor, checked that floor every
250 ms, had an independently killable PID and a 600000 ms maximum lifetime.
It did not manipulate the pagefile or intentionally load the GPU.

Level 1 PID `92000` reserved exactly 512 MiB and exited cleanly with code 0.
Level 2 PID `87736` reserved exactly 1024 MiB and exited cleanly with code 0.
No safety or timeout stop occurred. No severe paging threshold was observed.
The helpers released their reservations after their stages, and the final
helper-process query was empty.

| Level | Requested / actual pressure | Available RAM before each call | Target assessment |
|---:|---:|---:|---|
| 0 | 0 / 0 MiB | 4,108,087,296 B (3.826 GiB); 3,073,171,456 B (2.862 GiB) | Natural baseline |
| 1 | 512 / 512 MiB | 2,475,376,640 B (2.305 GiB); 2,501,685,248 B (2.330 GiB) | 2.0–2.5 GiB target reached |
| 2 | 1024 / 1024 MiB | 1,963,393,024 B (1.829 GiB); 2,048,086,016 B (1.907 GiB) | Materially stronger, but the preferred 1.0–1.5 GiB range was not reached under the predeclared cap |

After release, available RAM was 3,049,873,408 B after level 1 and
3,131,568,128 B after level 2. The model remained naturally resident, so these
values are not expected to return to the pre-load level-0 snapshot.

## Fixture and provider lock

The exact Representative V1 production-path request was captured offline
before inference and matched its frozen identity:

- POST body: 4522 bytes
- Server-observed full prompt: 1068 tokens on every call
- Request hash: `sha256:4f86bb8094756a96bc8639d33e8b635a4bfb16223629a9a1c8ece05e6e31648d`
- Messages: 2; system content: 1746 bytes; user content: 2515 bytes

All six calls used Ollama `0.33.2`, model `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
`temperature=0`, `think=false`, `stream=false`, `num_predict=2048`,
`timeout_ms=120000`, retry count 0, no seed and no `keep_alive` field.

## Calls

Exactly six strictly serial cognition calls ran. Language calls: 0. Evaluator
calls: 0. There was no warm-up, retry or seventh call. Every call completed
with HTTP 200, no abort and no warning.

| Level | Call | Available RAM | Pressure | Resident | GPU VRAM | Load ms | Prompt eval ms | Eval ms | Total ms | Abort | Warnings | Outcome |
|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|---|---|
| 0 | 0A | 4,108,087,296 B | 0 MiB | No | 743 MiB | 6772.6225 | 776.624 | 9973.095 | 17551 | false | none | SUCCESS |
| 0 | 0B | 3,073,171,456 B | 0 MiB | Yes | 7030 MiB | 1.5661 | 64.313999 | 9997.061 | 10085 | false | none | SUCCESS |
| 1 | 1A | 2,475,376,640 B | 512 MiB | Yes | 7064 MiB | 1.0415 | 204.668 | 10119.486 | 10348 | false | none | SUCCESS |
| 1 | 1B | 2,501,685,248 B | 512 MiB | Yes | 7107 MiB | 1.7338 | 56.971 | 6988.339 | 7069 | false | none | SUCCESS |
| 2 | 2A | 1,963,393,024 B | 1024 MiB | Yes | 7152 MiB | 2.0898 | 333.265 | 7685.155 | 8045 | false | none | SUCCESS |
| 2 | 2B | 2,048,086,016 B | 1024 MiB | Yes | 7108 MiB | 1.0286 | 58.523 | 7041.932 | 7123 | false | none | SUCCESS |

Each result generated 271 tokens. Generation rates were 27.173, 27.108,
26.780, 38.779, 35.263 and 38.484 tokens/s respectively.

## Server-log correlation

The exact server-log slice covers offsets 99270 through 151048 (51778 bytes)
without rotation or truncation. It records exactly six `/api/chat` requests,
six slot releases and one natural model load. All 34/34 model layers were
offloaded to the GPU. It records zero HTTP 500 responses, watchdog warnings,
free-memory-refresh warnings, insufficient-memory warnings, cancellations and
unloads. The sole prompt-cache update took 0.01 ms.

Ollama identified the complete prompt as 1068 tokens on every call. After the
initial call, its runner reused 1064 cached tokens and executed four prompt
tokens. This runner-side view explains why the warm prompt-eval durations are
the relevant like-for-like comparison even though the response envelope keeps
reporting `prompt_eval_count=1068`.

## Trend and interpretation

The only directional degradation was transient prompt processing on the first
call after each new reservation: warm baseline 0B was 64.314 ms, level 1 call
1A was 204.668 ms and level 2 call 2A was 333.265 ms. The repeated calls at the
same pressure returned to 56.971 ms and 58.523 ms. This is a bounded signal
consistent with environmental pressure, but it is neither sustained nor large
enough to establish the historical failure mechanism.

The other measures did not degrade directionally. Resident load duration
stayed around 1–2 ms. Mean pressure-stage total latency was 8708.5 ms at level
1 and 7584 ms at level 2, versus 10085 ms for warm baseline 0B. Mean generation
throughput was 32.779 tokens/s at level 1 and 36.873 tokens/s at level 2, versus
27.108 tokens/s at warm baseline. No warning or timeout appeared. Level-0 0A
is a natural cold-load observation and is not treated as directly comparable
to resident pressure calls.

Accordingly, this is **RESOURCE_PRESSURE_EFFECT_SUGGESTED**, not reproduced:
there is a small first-call prompt-processing association, while end-to-end
latency, generation, server warnings and transport outcomes do not show the R3
pattern.

## R3 boundary

The run did not reproduce R3's 120-second model timeout, approximately
58-second cache update, watchdog warning, free-memory-refresh warning, very
slow prompt processing, cancellation or failed request. It also did not reach
R3's approximately 449 MiB free-RAM state; the lowest call-start measurement
was 1,963,393,024 B (1.829 GiB). The result therefore cannot establish or rule
out behavior under severe scarcity near R3.

The remaining confounders include model residency, Windows paging and file
cache, Ollama scheduling and prompt cache state, WDDM/GPU scheduling and other
background processes. The evidence does not prove that RAM caused R3 and does
not justify a production timeout, retry, warm-up, keep-alive, context,
generation-limit, pagefile, GPU-reservation or RAM-guard change.

## Isolation

The run began with no production diff and created files only under
`research/diagnostics/ollama-environment-resource-v0/`. It did not write to
`research/experiments/` or alter production transport semantics. The separately
authorized next slice is only `READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN`; it
is not implemented here.
