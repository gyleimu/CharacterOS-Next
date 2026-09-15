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
| `VISION_NUM_PREDICT` | `320` | answer length bound |
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

## Limitations (V0)

- Change detection is global per source: a small change in a corner of a
  flickering full-screen video can keep the source "interesting". The minimum
  inference interval is what bounds the model cost.
- Attention is a static three-level enum; nothing automatically raises it yet.
- The observation schema is fixed by prompt, not by grammar. A model that cannot
  follow it produces `INVALID_MODEL_OUTPUT`, i.e. dropped frames rather than
  partial data.
- `frame_ref` (a content address) has no lawful field in the canonical ingress
  and stops at the adapter boundary.
