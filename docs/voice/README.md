# CharacterOS Voice

Voice is CharacterOS's **presentation / interaction channel**: the subject can hear
the user and speak its replies. It is deliberately *not* an authority over
character state.

```text
  CharacterOS canonical state  (affect, regulation, relationship, ...)
        │  read-only projection
        ▼
  SpeechExpressionProjection          deterministic, bounded, unit-tested
        ▼
  SpeechExpressionV0                  tempo / loudness / warmth / hesitation ...
        ▼
  SpeechOutputRequestV0               model-neutral
        ▼
  VoiceTtsAdapterV0 (CosyVoice3)      the ONLY module that knows the model
        ▼
  audio
```

The reverse arrow does not exist. No speech model can write canonical state, and
the voice layer imports **no CharacterOS package at all** — it reaches the subject
only through the narrow `VoiceSubjectPortV0` port, which `product/sandbox`
implements over the existing interactive host.

## Capability summary

| | |
|---|---|
| ASR | `iic/SenseVoiceSmall` via FunASR (CPU, by default) |
| TTS | `FunAudioLLM/Fun-CosyVoice3-0.5B-2512` via the official CosyVoice repo (GPU, fp16) |
| Streaming | real incremental PCM from CosyVoice's streaming generator |
| Microphone | energy-VAD capture on the runtime host |
| Voice identity | default voice + zero-shot reference voices |
| Transport | local HTTP on `127.0.0.1:8181` (no gRPC, no broker, no container) |

---

## 1. Layout: two separate trees

The runtime **source** is version-controlled here. The Python environment, the
CosyVoice checkout, the model weights and the reference voices are **not** — they
live outside the repository because they are large, machine-specific, and partly
licensed material.

```text
D:\Documents\CharacterOS-Next-voice\        <- this git worktree (branch `voice`)
  packages/voice/                            contracts, projection, adapters, session
  product/sandbox/src/voice-*.ts             subject port, CLI, causal demo
  tools/voice-runtime/                       the Python service source
  docs/voice/README.md                       this file

D:\Documents\CharacterOS-VoiceRuntime\       <- NOT in git
  python/                                    standalone CPython 3.10
  CosyVoice/                                 official CosyVoice checkout (with submodules)
  models/Fun-CosyVoice3-0.5B/                ~19 GB of weights
  voices/voices.json                         voice registry + registered reference audio
  out/                                       benchmarks and scratch output
```

Nothing in `CharacterOS-VoiceRuntime` is committed: `.gitignore` excludes model
weights, virtualenvs and generated audio, and the runtime never downloads a voice.

## 2. Build the runtime environment (from scratch, on a new machine)

Requires an NVIDIA GPU with a recent driver. Tested on an RTX 4060 Laptop 8 GB,
16 GB RAM, Windows 11.

```bash
# 1. a self-contained Python 3.10 — no admin rights, nothing installed system-wide
mkdir -p /d/Documents/CharacterOS-VoiceRuntime && cd /d/Documents/CharacterOS-VoiceRuntime
curl -L -o python310.tar.gz \
  "https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.10.21%2B20260901-x86_64-pc-windows-msvc-install_only.tar.gz"
tar -xzf python310.tar.gz          # -> ./python/python.exe

# 2. CosyVoice (submodules are required: the FAQ chain needs Matcha-TTS)
git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git CosyVoice

# 3. model weights (~19 GB)
git clone https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512 models/Fun-CosyVoice3-0.5B
#    ModelScope alternative:
#    python -c "from modelscope import snapshot_download; snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir='models/Fun-CosyVoice3-0.5B')"

# 4. dependencies
./python/python.exe -m pip install "setuptools==75.8.0" wheel
./python/python.exe -m pip install -r tools/voice-runtime/requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cu121
./python/python.exe -m pip install funasr sounddevice
```

### Two dependency traps, both hit for real

* **`pkg_resources` is gone in setuptools ≥ 81.** CosyVoice's import chain needs
  it (`cosyvoice/flow/flow_matching.py`), and `openai-whisper`'s build needs it
  too. Pin `setuptools==75.8.0` **before** anything else.
* **`openai-whisper` must be built without build isolation**, or pip builds it in
  a fresh environment that has the new setuptools and fails:
  `pip install --no-build-isolation "openai-whisper==20231117"`.

## 3. Run the service

```bash
cd <repo>/tools/voice-runtime
<VoiceRuntime>/python/python.exe run.py \
  --cosyvoice-src   D:/Documents/CharacterOS-VoiceRuntime/CosyVoice \
  --tts-model-dir   D:/Documents/CharacterOS-VoiceRuntime/models/Fun-CosyVoice3-0.5B \
  --voices-file     D:/Documents/CharacterOS-VoiceRuntime/voices/voices.json \
  --port 8181
```

The HTTP surface comes up **immediately**; models load in the background, so
`/health` reports `LOADING` and then `READY`. Useful flags: `--no-preload`,
`--no-warmup`, `--fp16/--no-fp16`, `--tts-device`, `--asr-device`, and `--check`
(load, print status as JSON, exit — handy for CI-less smoke checks).

Environment variables mirror the flags: `VOICE_COSYVOICE_SRC`,
`VOICE_TTS_MODEL_DIR`, `VOICE_VOICES_FILE`, `VOICE_TTS_DEVICE`,
`VOICE_ASR_DEVICE`, `VOICE_FP16`, `VOICE_PRELOAD`, `VOICE_WARMUP`.

### Device placement is a measurement, not a guess

`torch.cuda.memory_allocated` reports ~4.2 GB for both models, which looks like it
fits an 8 GB card. It does not: the ONNX Runtime sessions (speech tokenizer,
speaker embedding) and the CUDA context are invisible to that number, and with
both models on the GPU only **261 MiB** was free — synthesis then *stalled* past a
300 s timeout. ASR therefore runs on the **CPU** and TTS on the **GPU**. No
quality, precision or model change is involved, only placement.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `state` (`LOADING`/`READY`/`DEGRADED`/`FAILED`), device, per-model residency, VRAM |
| GET | `/voices` | registered voices — opaque handles, never a filesystem path |
| POST | `/voices/register` | register a zero-shot reference voice (base64 WAV + transcript) |
| POST | `/tts` | one utterance → metadata (+ optional WAV/playback/base64 audio) |
| POST | `/tts/stream` | one utterance → **chunked PCM16LE** as it is generated |
| POST | `/tts/cancel` | stop the in-flight generation and playback |
| POST | `/asr` | base64 WAV → transcript |
| POST | `/asr/listen` | microphone → VAD → transcript |
| GET | `/metrics/last` | measurements for the most recent synthesis |

```bash
curl 127.0.0.1:8181/health
curl -X POST 127.0.0.1:8181/tts -H 'content-type: application/json' \
     -d '{"text":"你好，我是 CharacterOS。","save_path":"out/hello.wav"}'
curl -X POST 127.0.0.1:8181/asr/listen -H 'content-type: application/json' -d '{}'
```

`/tts/stream` is genuinely incremental — chunks come from CosyVoice's own
streaming generator and are forwarded (and played) as they appear, so the time to
first audio is real and not the full generation time.

## 4. Use it from CharacterOS

```bash
# one typed turn, spoken
pnpm --filter @characteros-next/sandbox voice say "你好。"

# one microphone turn
pnpm --filter @characteros-next/sandbox voice listen

# interactive: type, or /mic to speak; replies are spoken
pnpm --filter @characteros-next/sandbox voice
```

Interactive commands: `/mic` (or an empty line) listens, `/stop` cancels the
current speech, `/state` prints the current read-only state and the expression it
projects to, `/exit` leaves.

`CHARACTEROS_VOICE_RUNTIME_URL` (default `http://127.0.0.1:8181`) points at the
service; `CHARACTEROS_VOICE_ID`, `CHARACTEROS_VOICE_LANGUAGE` and
`CHARACTEROS_VOICE_STREAMING` tune the session.

A spoken reply is the **same delivery** as a typed one — it goes through the
existing host and does not create a second delivery. The runtime keeps exactly one
deferred `pending_behavior_outcome` slot, and speech does not add another.

## 5. Causal demo: does state actually change the voice?

```bash
cd product/sandbox
node dist/voice-causal-demo.js ../../artifacts/voice-causal-demo 5
```

One sentence (`我没事。`), four lawful states, only canonical affect varying;
regulation is held at the subject's real genesis values (energy 1, stress 0,
arousal 0.5, fatigue 0 — read from `createInteractiveSubjectSeedV0`, not assumed):

| | valence | activation | directive |
|---|---|---|---|
| A | −0.6 | 0.1 | slow + very soft |
| B | −0.6 | 0.9 | fast + as loud as possible |
| C | +0.6 | 0.1 | slow + very soft |
| D | +0.6 | 0.9 | fast + as loud as possible |

It writes `A*.wav` … `D*.wav` plus `expression.json` (the full state → expression
→ directive → measured-audio record). **Audio is not committed**; the JSON is.

**What this demonstrates, and what it does not.** See §7.

## 6. Performance (measured on RTX 4060 Laptop 8 GB)

> These are the numbers from the FIRST slice, before the realtime work in §6b.
> They were measured while other processes held most of the GPU, which is why
> they are far worse than the steady-state figures below. Both are kept: the
> difference between them is the single most important fact about this machine.

`python benchmark.py --launch --n 10` reproduces these. Warm and cold are kept
separate.

| Metric | Value |
|---|---|
| Startup → READY | 47.1 s (ASR 11.8 s CPU, TTS 31.3 s GPU) |
| Cold TTS | 11 994 ms, audio 1 840 ms, RTF 6.50 |
| Warm TTS median (n=10) | 9 946 ms, RTF 4.75, audio 2 000 ms |
| Warm TTS p95 | 13 812 ms |
| Streaming TTFA median (n=10) | 7 091 ms |
| Streaming TTFA p95 | 15 351 ms |
| ASR median (n=10, CPU) | 781 ms |
| ASR p95 | 2 609 ms |
| VRAM idle / loaded / peak | 2 719 / 6 292 / 6 533 MB |

Variance is large and real (warm TTS ranged 3.4 s – 13.8 s).

## 6b. Realtime work: where the time goes, and what was done about it

### The bottleneck, measured rather than guessed

`/metrics/last` reports the stages timed INSIDE the model, so the breakdown below
is measured, not inferred. Steady state, one short sentence, uncontended:

| Stage | Cost | Notes |
|---|---|---|
| `frontend_zero_shot` | **~585 ms** | reference re-encoding — see below |
| LLM to the first streaming hop | **~2 000 ms** | 28 speech tokens (`token_hop_len` 25 + pre-lookahead 3) |
| `flow_inference` | ~505 ms | flow matching → mel |
| `hift_inference` | ~57 ms | vocoder → waveform |
| **first PCM** | **~3 200 ms** | the sum, which is how the model was confirmed as the source |

`llm_first_token` was **NOT INSTRUMENTABLE** until the LLM was hooked — it runs on
its own thread and CUDA stream, so it is observed by polling the token buffer.

### What was optimized

**Repeated reference conditioning (the one clean win).** `frontend_zero_shot`
re-encodes the reference WAV on every call *and for every sentence*: `load_wav`,
whisper log-mel, the ONNX speech tokenizer on the GPU, kaldi fbank, the ONNX
speaker embedding on the CPU, and the mel extractor. The reference does not change
between sentences, so all of it was waste. It is now memoized (~527 ms → 1.6 ms).

CosyVoice's own `add_zero_shot_spk` cache is **not** used: with a
`zero_shot_spk_id`, `frontend_zero_shot` returns `{**spk2info[id]}` wholesale and
silently DISCARDS the delivery directive, which would break the expression →
delivery mapping. Memoizing the three extraction methods leaves the official call
path untouched.

**Warmup was silently broken.** It read a field only assigned by `synthesize()`,
so the first call raised `AttributeError` and a blanket `except` swallowed it —
warmup had never warmed anything. Consecutive calls measured **86 s, 58 s, 8.0 s,
3.5 s**: three realistic syntheses are now run at startup. This is the difference
between a 90-second first reply and a 4-second one.

### Before / after, same environment window, n=20 each

| Metric | baseline (cache off) | cached | change |
|---|---|---|---|
| TTFA median | 2 713.8 ms | **2 290.1 ms** | −423.7 ms |
| TTFA p95 | 3 099.0 ms | 3 057.6 ms | −41.4 ms |
| `frontend_zero_shot` median | 527.3 ms | **1.6 ms** | −525.7 ms |
| `llm_first_token` median | 80.5 ms | 70.9 ms | — |
| `token2wav` median | 503.8 ms | 563.7 ms | — |
| RTF median | 1.259 | **1.065** | −0.194 |
| RTF p95 | 1.397 | 1.416 | — |

The frontend saving (525.7 ms) accounts for the TTFA saving (423.7 ms) almost
exactly; the residual is run-to-run noise. That is the causal attribution.

### The same measurement under GPU contention

Run earlier the same day, same configs, while other processes held ~7 GB of the
8 GB card:

| Metric | baseline | cached |
|---|---|---|
| TTFA median | 58 961 ms | 32 507 ms |
| RTF median | 27.8 | 18.1 |

**A 20–30× swing from the environment alone.** Evidence: VRAM 8187/8187 MB
saturated, SM clock 930–1590 MHz of a 3105 MHz maximum, 88–89 °C, 44 W of a 79 W
cap. The "laptop GPU throttling" hypothesis is CONFIRMED, and VRAM
oversubscription is the larger of the two effects. Any single-run number from this
machine should be read with that in mind.

### Official acceleration paths, evaluated against this machine

| Path | Verdict |
|---|---|
| vLLM (`load_vllm`) | **UNSUPPORTED** — vLLM has no Windows build |
| TensorRT-LLM (`load_trt`) | **UNSUPPORTED** — needs `import tensorrt`; `tensorrt-cu12` wheels are Linux-only |
| ONNX Runtime GPU | **ALREADY USED** for the speech tokenizer; the flow-decoder ONNX is consumed only by the TensorRT path |
| `torch.compile` | **NOT PURSUED** — not supported by CosyVoice, and unverifiable here |
| fp16 | **ALREADY ENABLED** |
| Smaller `chunk_size` | **NOT WORTH IT** — must match the flow decoder's training-time `static_chunk_size`; changing it risks speech quality |

### Remaining bottleneck

The first streaming hop needs 25 + 3 speech tokens before any audio exists, and
the LLM produces them at roughly 70 ms each. That ~2 s is a floor set by the
model and the backend, not by this runtime, and it is where the remaining TTFA
lives. TensorRT or vLLM would attack it; neither runs on Windows.

## 7. Known limitations

* **The valence axis does not reach the audio yet.** The projection computes a
  distinct `warmth` for positive vs negative valence (and all four quadrants give
  four distinct expressions), but the CosyVoice directive is built only from tempo
  and loudness, so **A and C sound the same**. Three candidate tone directives
  were tested empirically (`温柔`, `平淡`, `很小声音`) and none moved the output
  beyond the model's own run-to-run variation, so none was adopted. Wiring valence
  to a verified channel is the top follow-up.
* **Total audio duration is not a reliable acoustic discriminator.** In the causal
  demo, A→C reported "distinguished" *despite having identical directives* — proof
  that duration differences at this sample size are dominated by model sampling
  variance. This is why the demo reports every comparison against the
  within-fixture spread and refuses to count differences that do not clear it.
  Judging the causal claim ultimately requires listening to the WAVs.
* **Latency is environment-bound.** Uncontended, the runtime reaches TTFA median
  2 290 ms and RTF median 1.065. With other processes holding ~7 GB of the 8 GB
  card it degrades to tens of seconds and RTF ≈ 18–28. The same code, the same
  configuration, a 20–30× swing. See §6b.
* **Degradation is coarse.** ASR and TTS are enabled per-model from `/health`, but
  there is no retry-after-failure or model-restart policy.
* **VAD is calibrated but not adaptive.** The gate measures the room once
  (silence: floor 345.4 → threshold 1381.5) and that measurement is reused. It
  correctly rejected silence 3/3 in a quiet room, exiting at the timeout rather
  than `max_ms`. It does NOT re-measure itself if the room changes, and a loud
  transient during concurrent activity can still trip it — one such transient was
  observed live. `POST /vad/calibrate` re-measures on demand.
* **Barge-in is only partly verified.** The monitor, the calibrated threshold and
  the cancel path are implemented and the cancellation stops generation, but
  interrupting a reply by ACTUALLY SPEAKING could not be tested without a person
  at the microphone. Treat the barge-in latency as unmeasured.

## 7b. What was verified on hardware, and how

| Path | Result | Evidence |
|---|---|---|
| Microphone capture | works | forced 3 s capture → `captured: true`, 3057 ms, transcribed |
| VAD silence rejection | **works** | calibrated (floor 345.4, threshold 1381.5); 3/3 quiet listens → `captured: false`, exit at the 3 s timeout not the 6 s `max_ms` |
| Speaker playback | works | `/tts` with `play: true` → `played: true`, 640 ms audio |
| TTS | works | real WAVs produced; slow+soft directive measurably changes output |
| Streaming | works | chunks read incrementally; TTFA measured client-side |
| ASR | works | TTS output round-tripped back to text |
| Voice identity | works | second reference voice registered; output measurably different |
| Interruption | mechanism verified | abort + `/tts/cancel` stop generation; a live spoken barge-in was NOT performed |
| Sentence pipeline | unit-tested | 28 tests over splitting and queue delivery; ordering, cancellation and failure isolation pinned |

* **Regulation is static.** CharacterOS's reference regulation producer has
  identity dynamics, so `energy`/`stress`/`arousal`/`fatigue` stay at their genesis
  values; only affect varies in practice today.
* The installed ASR/LLM stack prints a `Sliding Window Attention ... sdpa` warning
  from transformers. Output is correct; the warning is cosmetic.

## 8. Disabling Voice entirely

Voice is optional at every layer.

* **Do not start the runtime.** CharacterOS then reports `can speak: NO`,
  `can hear: NO`, prints replies as text, and — verified — completes turns and
  advances canonical state normally (state revision 16 → 25 across a turn with the
  runtime stopped).
* **Run the text product instead**: `pnpm interactive` / `pnpm web` are untouched
  by this work.
* **Build without it**: `packages/voice` is a separate workspace package; nothing
  in `packages/runtime`, `packages/subject-core` or the domain packages imports it,
  and `product/sandbox` reaches it only through the new `voice-*.ts` files.
* **Silence speech but keep listening**: set `CHARACTEROS_VOICE_STREAMING=false`
  and simply do not call the speech path, or construct `VoiceSessionV0` with
  `speak: false`.

## 9. Tests

```bash
pnpm vitest run packages/voice
```

Covers projection determinism and bounds, fail-closed input validation, the
four-quadrant differential, the expression → directive mapping (including a sweep
asserting **no emotion word is ever selected**), transport failure classification
against a real local HTTP double, streaming TTFA, and session degradation for
unavailable / timeout / malformed / projection-failure / silence-from-microphone.
