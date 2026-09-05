# OLLAMA_NATURAL_LOW_RESOURCE_REPRODUCTION_V0

Run id: `natural-low-resource-v0-2026-09-05T13-43-02-170Z`

Starting HEAD: `f515f599ae8c97391cb50480cce917399dc038b4`

Result: **NATURAL_LOW_RESOURCE_TIMEOUT_REPRODUCED**

Root-cause update: **ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED / HIGH**

Next slice: **READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN**

This is a natural-state product transport diagnostic. It has no canonical,
behavioral or scientific authority, and it did not start R4.

## Natural resource gate

The diagnostic observed the user's existing workload without terminating,
suspending, reprioritizing or changing its affinity. No artificial RAM helper,
GPU stressor or other pressure process was present before or after the run.

Ollama was not running, so the protocol-authorized normal application was
started from `ollama app.exe`. No model preload or warm-up generation was
issued. Immediately before the only cognition call:

- Windows free physical RAM: **600,756,224 bytes**
- Node available RAM: **379,207,680 bytes**
- Ollama's model-load report: **528.8 MiB system memory free**, 1.1 GiB swap free
- Committed bytes / commit limit: **37,179,662,336 / 41,037,828,096 bytes**
- Pagefile current usage: **3588 MiB**
- Paging: **8258 pages input/s**, 679 page reads/s
- DeltaForce PID/start: `89712`, `2026-09-05T19:12:55.2812697+08:00`
- DeltaForce working set/private memory: **3,320,827,904 / 13,636,542,464 bytes**
- Ollama model residency: **NOT_RESIDENT**
- GPU: **4266/8188 MiB**, 5% utilization, 85 C

The exact 1 GiB natural-window gate passed. Ollama server PID `98764` and app
PID `96948` were recorded; starting the normal application was the sole server
intervention.

## Frozen request and provider

The unchanged Representative V1 request was verified offline before inference:

- POST body: **4522 bytes**
- Server-observed prompt: **1068 tokens**
- Request hash: `sha256:4f86bb8094756a96bc8639d33e8b635a4bfb16223629a9a1c8ece05e6e31648d`

Provider lock matched Ollama `0.33.2`, model `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
`temperature=0`, `think=false`, `stream=false`, `num_predict=2048`,
`timeout_ms=120000`, retry count 0, no seed and no `keep_alive` field.

## Call and safety stop

Exactly one cognition call was executed. It consumed one of the four permitted
slots and timed out after 120014 ms. Language calls: 0. Evaluator calls: 0.
There was no retry, warm-up or second call.

| Call | Available RAM | DeltaForce WS/private | Residency | GPU | Load | Prompt | Generation | Total | Abort | Warnings | Outcome |
|---:|---:|---:|---|---|---|---|---|---:|---|---|---|
| 1 | 600,756,224 B Windows; 379,207,680 B Node | 3,320,827,904 / 13,636,542,464 B | NOT_RESIDENT | 4266/8188 MiB; 5%; 85 C | Transport envelope unavailable; server startup 25.03 s | Envelope unavailable; server reached 1064 tokens in 41.78 s | Envelope unavailable; 100 tokens observed at 2.09 tok/s | 120014 ms | true at 120003 ms; BEFORE_FETCH_RESPONSE | GPU watchdog; free-memory refresh; HTTP 500 | MODEL_TIMEOUT |

The runtime monitor sampled 236 times. Available RAM reached a minimum of
5,795,840 bytes while the event loop's largest observed gap remained 525 ms.
After the timeout, Windows free physical RAM was 184,213,504 bytes; paging had
risen to 42,411 pages input/s and 5833 page reads/s. The pagefile grew
automatically from 23,552 to 33,553 MiB allocated, with 5079 MiB in use. The
runner therefore stopped the remaining calls with
`SEVERE_PAGING_THRESHOLD_OBSERVED`.

## Ollama server evidence

Starting the normal application replaced/truncated the previous log after its
recorded 152789-byte offset. The evidence preserves the complete new server
lifecycle from byte 0 through byte 43427.

The log records:

- one `GPU discovery watchdog timed out` warning;
- one `unable to refresh free memory, using old values` warning;
- 528.8 MiB free system memory at model scheduling;
- limited VRAM handling and 32/34 layers offloaded to GPU;
- llama-server startup in 25.03 seconds;
- prompt progress at 512 tokens / 7.87 s, 556 / 15.94 s and 1064 / 41.78 s;
- generation progress of 100 tokens at 2.09 tokens/s;
- HTTP 500 after 1m59s, followed by cancel and slot release;
- one 0.01 ms prompt-cache update, so R3's slow cache-update signature was not reproduced.

The transport trace independently records `MODEL_TIMEOUT`, abort at 120003 ms,
terminal stage `BEFORE_FETCH_RESPONSE`, no response headers and the exact frozen
request hash and byte count.

## Direct comparison

| Evidence | Available RAM | Request | Cold/result | Historical signatures |
|---|---:|---|---|---|
| R3 | about 449 MiB | 4234–4280 B / 980–997 tokens | first 9 calls timed out at 120 s | watchdog, free-memory warning, very slow prompt/cache processing |
| Healthy Representative V1 | about 3.5 GiB | 4522 B / 1068 tokens | 21.224 s cold; 6.792–7.318 s warm | no warnings or timeout |
| Natural low-resource V0 | 600,756,224 B Windows; Ollama reported 528.8 MiB | same 4522 B / 1068 tokens | cold call timed out at 120.014 s | watchdog, free-memory warning, 41.78 s prompt prefill, 2.09 tok/s generation, HTTP 500, cancel/release |

This materially reproduces the R3 transport and warning pattern under a
naturally occurring low-resource environment. The match is substantially
stronger than the prior bounded artificial-pressure run, whose safely tested
floor was 1.829 GiB and which produced no timeout or resource warning.

## Causal boundary

The result strongly supports **environmental resource contention** as the R3
failure class. It does not prove that low available RAM alone caused R3. This
natural state simultaneously included severe paging, high commit pressure,
limited VRAM, a concurrent GPU workload, Windows/WDDM scheduling and cold model
startup. Those factors were intentionally left untouched and therefore remain
confounded.

The evidence does not justify a timeout, retry, warm-up, keep-alive, model
residency, pagefile or production transport change. The separately authorized
next slice is `READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN`; it is not
implemented here.

## Isolation

The run began with no protected-path changes and wrote only under
`research/diagnostics/ollama-natural-low-resource-v0/`. DeltaForce retained the
same PID and start time and received zero mutations. Production transport and
the frozen Representative V1 fixture were unchanged.
