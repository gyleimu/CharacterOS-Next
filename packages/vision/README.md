# @characteros-next/vision — Visual Perception / Vision Adapter

A standalone, pluggable, local-only adapter that periodically **looks** at the
user's camera and desktop, decides cheaply whether anything changed, and only
then asks a local `MiniCPM-V 4.6` model for ONE structured observation.

It is deliberately **not** part of the cognition stack. It reports observed facts
into a sink; the product layer maps them onto the existing CharacterOS input
boundary (`submitExternalObservationV0`). It cannot express emotion, belief,
memory, relationship, personality, desire or action — those stay in the core.

```
camera  ─┐                                  ┌─ change detection (64×36 grayscale)
desktop ─┴─ one ffmpeg process per source ──┤
                                            └─ full-res still (loopback socket)
                                                        │
                                          change? ──────┘  (min interval + single flight)
                                                        ▼
                                             MiniCPM-V 4.6 (Ollama / llama.cpp)
                                                        ▼
                                        strict JSON validation (fail closed)
                                                        ▼
                                             dedupe → VisualObservationV0
                                                        ▼
                                          VisionObservationSinkV0
```

This package imports **no** CharacterOS package and has **zero npm
dependencies**. The dependency arrow is `product → vision`, never `vision → core`.

## Why one ffmpeg process per source

Two Windows behaviours were verified empirically and shaped the design:

1. **A DirectShow camera is exclusive.** A second ffmpeg process cannot open the
   same device, so the still for the model cannot come from a second capture.
2. **The `image2pipe` MJPEG demuxer buffers until end-of-stream**, so a decoder
   chained onto a live stream does not emit frames incrementally.

A single process therefore produces both signals at once:

| output | content | purpose |
| --- | --- | --- |
| stdout | `rawvideo` grayscale, 64×36, one frame per capture tick | change detection, **no decode in Node** |
| `127.0.0.1:<port>` | MJPEG, full analysis width | the still handed to the model |

Consequences: no image ever leaves the machine, no image is decoded in Node, no
still is written to disk, and a running source costs one process and a few KB/s
of pipe traffic.

## Requirements

- **Windows** (the desktop source uses `gdigrab`, the camera source `dshow`).
- **ffmpeg** on `PATH`, or `VISION_FFMPEG_PATH` set:
  `winget install --id Gyan.FFmpeg -e`
- A local vision model runtime (see below).

## Model setup — MiniCPM-V 4.6 (~1.3B)

### Ollama (default, verified)

```bash
ollama pull minicpm-v4.6      # 1.6 GB on disk (Q4)
ollama list                   # expect: minicpm-v4.6:latest
```

The adapter talks to `http://127.0.0.1:11434` (native `/api/chat`, raw base64
images, `format: "json"`). `VISION_KEEP_ALIVE` controls VRAM residency; `stop()`
unloads the model explicitly (`keep_alive: 0`).

### llama.cpp / GGUF (alternative, via `llama-server`)

Official weights: `openbmb/MiniCPM-V-4.6-gguf` (Apache-2.0) — includes
`MiniCPM-V-4_6-Q4_K_M.gguf` and the required `mmproj-model-f16.gguf` vision
projector.

```bash
llama-server -m MiniCPM-V-4_6-Q4_K_M.gguf --mmproj mmproj-model-f16.gguf --port 8080
```

Then point the adapter at the OpenAI-compatible surface:

```bash
VISION_PROVIDER=openai-compatible
VISION_ENDPOINT=http://127.0.0.1:8080
VISION_MODEL=MiniCPM-V-4.6
```

No code changes are needed — both providers sit behind one interface.

## Configuration

Everything below is optional; the adapter is usable with an empty environment.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VISION_ENABLED` | `true` | master switch |
| `VISION_CAMERA_ENABLED` / `VISION_DESKTOP_ENABLED` | `true` | per-source switch |
| `VISION_ATTENTION` | `NORMAL` | `IDLE` \| `NORMAL` \| `FOCUSED` (look cadence only) |
| `VISION_FFMPEG_PATH` | `ffmpeg` | ffmpeg executable |
| `VISION_CAMERA_DEVICE_INDEX` | `0` | DirectShow video device index |
| `VISION_CAMERA_DEVICE_NAME` | – | explicit device name (skips enumeration) |
| `VISION_CAMERA_INPUT_SIZE` | – | e.g. `1280x720` |
| `VISION_DESKTOP_REGION` | – | `1280x720+10+20` or `1280,720,10,20` |
| `VISION_ANALYSIS_WIDTH` | `1280` | longest side sent to the model |
| `VISION_THUMB_WIDTH` / `VISION_THUMB_HEIGHT` | `64` / `36` | change-detection thumbnail |
| `VISION_DESKTOP_STREAM_FPS` / `VISION_CAMERA_STREAM_FPS` | `2` / `1` | capture ticks per second |
| `VISION_STILL_FPS` | `1` | full-resolution still refresh rate |
| `VISION_MIN_INFERENCE_INTERVAL_DESKTOP_MS` / `..._CAMERA_MS` | `3000` / `5000` | hard floor between model calls |
| `VISION_CHANGE_THRESHOLD_DESKTOP` / `..._CAMERA` | `0.012` / `0.02` | mean absolute thumbnail difference |
| `VISION_HASH_DISTANCE_DESKTOP` / `..._CAMERA` | `0.08` / `0.12` | normalized perceptual-hash distance |
| `VISION_PROVIDER` | `ollama` | `ollama` \| `openai-compatible` |
| `VISION_ENDPOINT` | `http://127.0.0.1:11434` | model runtime |
| `VISION_MODEL` | `minicpm-v4.6` | model name |
| `VISION_TIMEOUT_MS` | `60000` | per-call timeout |
| `VISION_NUM_PREDICT` | `900` | answer length bound |
| `VISION_KEEP_ALIVE` | `5m` | model residency |
| `VISION_THINK` | `false` | thinking phase, where supported |
| `VISION_DEDUPE_HISTORY` | `3` | remembered observation keys per source |
| `VISION_DEBUG_SAVE_FRAMES` | `false` | write analysed stills to disk |
| `VISION_DEBUG_FRAMES_DIR` | `vision-debug-frames` | destination for the above |

### Attention levels

| level | desktop cadence | camera cadence |
| --- | --- | --- |
| `IDLE` | 5000 ms | 10000 ms |
| `NORMAL` | 1000 ms | 2000 ms |
| `FOCUSED` | 500 ms | 1000 ms |

Attention changes **how often a still is looked at**. It never relaxes the
minimum inference interval, change detection, or single-flight backpressure.
Call `VisionPerceptionV0.setAttentionLevel(level)` to change it at runtime.

## Privacy boundary

- Inference is **local only**. There is no cloud path, no telemetry, no upload —
  the provider interface only ever speaks to a configured localhost endpoint.
- Stills live in memory only. They are never written to disk unless
  `VISION_DEBUG_SAVE_FRAMES=true`.
- The still socket binds to `127.0.0.1` on an ephemeral port.
- Logs carry `timestamp`, `source`, `latency_ms`, `change_score`,
  `observation_id` and an error code — never image bytes, never screen text.
- `stop()` releases the camera, the model (VRAM) and all timers; `pause()`
  releases the camera while keeping the model warm.

## Metrics

`getMetrics()` returns exact counters: `frames_captured`,
`frames_skipped_cadence`, `frames_dropped_no_change`, `frames_dropped_rate_limit`,
`frames_dropped_superseded`, `frames_analyzed`, `observations_emitted`,
`observations_deduplicated`, `model_errors`, `invalid_model_outputs`,
`sink_errors`, `capture_errors`, `inference_calls`,
`inference_calls_per_minute`, `average_inference_latency_ms`, plus a per-source
breakdown.

## Structured output is enforced by the decoder

A 1.3B model does not follow a prose type signature. Measured on the real
desktop with MiniCPM-V 4.6 (`temperature 0`, `think: false`):

| prompt / decoding | result |
| --- | --- |
| prose type signature, `format: "json"` | `"confidence": 5` (1-10 scale), `entities` as an array of strings |
| prose + filled example, `format: "json"` | correct shape, but invalid JSON (missing comma) on 3/3 deterministic runs |
| **JSON Schema as decoding grammar** | valid JSON, exact shape, 3/3 runs |

So the runtime is handed `OBSERVATION_JSON_SCHEMA_V0` as a grammar. The bounds
inside it (`maxItems`, `maxLength`) are load-bearing: a text-dense screen made
the model enumerate on-screen text past the token budget, truncating the answer
mid-JSON. Capping the grammar took a failing call from `900` truncated tokens to
a complete `133`-token answer.

`parseModelObservationV0` remains the fail-closed backstop. Nothing malformed is
ever coerced, repaired, or degraded into natural language — it becomes
`INVALID_MODEL_OUTPUT` and is dropped.

## Deduplication

Two layers, both embedding-free:

1. an exact normalized key (`observationDedupeKeyV0`) — case, punctuation and
   whitespace insensitive, over description + semantic fields;
2. a token-set Jaccard similarity against the recent window
   (default threshold `0.7`), because the acceptance runs showed the model
   restating one unchanged scene four different ways. Two observations that
   differ only in wording are not two experiences.

## Measured behaviour (RTX 4060 Laptop 8 GB, Windows)

| measurement | value |
| --- | --- |
| warm inference, one observation | **1.5 - 1.6 s** (≈93 tok/s, 125-136 output tokens, ~750 prompt tokens) |
| cold inference (model loaded from disk) | 4 - 11 s |
| desktop-only run, 95 s | 187 frames captured, 114 skipped by cadence, **52 dropped as unchanged**, 6 model calls (3.8/min), 6 observations |
| camera + desktop run, 5.7 min | 1017 frames captured, 612 skipped by cadence, **252 dropped as unchanged**, 8 model calls (**1.4/min**), 8 observations, 0 errors, 0 restarts |
| node process | 7-112 MB resident, ~0.8 % of one core |
| ffmpeg (both sources, persistent) | ~121 MB each, ~12.6 % of one core combined |

The dominant risk is **VRAM contention, not this adapter**: with a resident 9B
chat model (5.6 GB) on the same 8 GB card, per-observation latency measured
**18-43 s** instead of ~1.5 s, because the vision model kept being evicted. On
an 8 GB laptop GPU a resident chat model and a resident vision model cannot both
be fast.

## Limitations (V0)

- Change detection is global per source: a small change anywhere on a busy
  screen keeps the source "interesting", and the minimum inference interval is
  what ultimately bounds the model cost.
- Attention is a static three-level enum; nothing automatically raises it yet
  (`setAttentionLevel` is the hook, deliberately not wired to cognition).
- Readability is partial: the model reliably identifies the application, the
  activity and the composition of a screen, but does not transcribe small
  on-screen text verbatim.
- Entity `type` values come from the model and are occasionally field names
  rather than object kinds; they are normalized to lawful identifier refs but
  not otherwise policed.
- `frame_ref` (a content address) has no lawful field in the canonical ingress
  and stops at the adapter boundary.
- Vision can only report to a subject the product has already persisted: the
  frozen ingress refuses to invent one, and the runner fails closed with
  guidance instead.
