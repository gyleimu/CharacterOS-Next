"""Local HTTP service exposing speech recognition and synthesis.

This process is a SPEECH SERVICE, not a subject runtime. It holds no
CharacterOS state, receives no canonical state, and cannot influence it: it
turns text into audio and audio into text. A crash here must therefore leave a
CharacterOS session fully correct — the TypeScript side treats every failure as
a degraded speech channel, never as a turn failure.

Endpoints
    GET  /health          liveness, model residency, device, VRAM
    GET  /voices          registered voice identities (opaque handles only)
    POST /voices/register register a zero-shot reference voice
    POST /tts             one utterance -> WAV metadata (+ optional audio/playback)
    POST /tts/stream      one utterance -> chunked PCM16LE as it is generated
    POST /tts/cancel      stop the in-flight generation and playback
    POST /asr             audio bytes -> transcript
    POST /asr/listen      microphone -> VAD -> transcript
    GET  /metrics/last    measurements for the most recent synthesis

Run with `python run.py` (see docs/voice/README.md).
"""

from __future__ import annotations

import asyncio
import base64
import queue
import threading
import time
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import audio as audio_io
from .config import BUNDLED_REFERENCE_TEXT, VoiceRuntimeConfig
from .models import (
    ASR_SAMPLE_RATE,
    SAMPLE_RATE,
    ModelLoadError,
    NotReadyError,
    RuntimeState,
    VoiceModelManager,
)
from .voices import VoiceRegistry, VoiceRegistryError

PCM_CONTENT_TYPE = f"audio/L16; rate={SAMPLE_RATE}; channels=1"
_MAX_SAVE_PATH_CHARS = 500


# --------------------------------------------------------------------------- models
class TtsRequest(BaseModel):
    text: str
    voice_id: str | None = None
    instruct: str | None = None
    play: bool = False
    stream: bool = False
    save_path: str | None = Field(default=None, max_length=_MAX_SAVE_PATH_CHARS)
    return_audio: bool = False
    # Interrupt this utterance when the user starts speaking. Only meaningful
    # together with `play`, because barge-in is about silencing the speaker.
    barge_in: bool = True


class AsrRequest(BaseModel):
    audio_base64: str
    language: str | None = None


class ListenRequest(BaseModel):
    language: str | None = None
    max_ms: int = 15000
    silence_ms: int = 700
    timeout_ms: int = 20000
    fixed_ms: int | None = None


class RegisterVoiceRequest(BaseModel):
    voice_id: str
    display_name: str | None = None
    reference_wav_base64: str
    reference_text: str


# --------------------------------------------------------------------------- app
class VoiceRuntimeApp:
    """Holds the process-wide state: models, voices, cancellation, metrics."""

    def __init__(self, config: VoiceRuntimeConfig) -> None:
        self.config = config
        self.manager = VoiceModelManager(config)
        self.registry = VoiceRegistry(
            path=config.voices_file,
            default_reference_wav=config.resolve_reference_wav(),
            default_reference_text=BUNDLED_REFERENCE_TEXT,
        )
        self.cancel_event = threading.Event()
        self.last_metrics: dict | None = None
        self._started_at = time.perf_counter()
        # VAD state: the noise floor is measured once and reused, so every
        # capture is compared against THIS room rather than a fixed constant.
        self.vad_config = audio_io.VadConfig()
        self.noise_floor: float | None = None
        self.calibrated_at: float | None = None

    # -- helpers ---------------------------------------------------------------
    def begin_generation(self) -> threading.Event:
        """Clears the cancel flag for a new generation and returns the token."""
        self.cancel_event.clear()
        return self.cancel_event

    def uptime_ms(self) -> float:
        return round((time.perf_counter() - self._started_at) * 1000, 1)

    def calibrate_vad(self) -> float:
        """Measures the room's noise floor and caches it."""
        self.noise_floor = audio_io.measure_noise_floor(self.vad_config)
        self.calibrated_at = self.uptime_ms()
        return self.noise_floor

    def ensure_vad(self) -> float | None:
        """Calibrates on first use; never raises into a request path."""
        if self.noise_floor is None:
            try:
                return self.calibrate_vad()
            except audio_io.AudioUnavailableError:
                return None
        return self.noise_floor

    def vad_status(self) -> dict:
        threshold = (
            None
            if self.noise_floor is None
            else round(audio_io.threshold_for(self.noise_floor, self.vad_config), 1)
        )
        return {
            "noise_floor": None if self.noise_floor is None else round(self.noise_floor, 1),
            "threshold": threshold,
            "calibrated_at_ms": self.calibrated_at,
            "margin_factor": self.vad_config.margin_factor,
            "absolute_floor": self.vad_config.absolute_floor,
            "min_speech_ms": self.vad_config.min_speech_ms,
            "silence_ms": self.vad_config.silence_ms,
        }


def create_app(config: VoiceRuntimeConfig, state: VoiceRuntimeApp | None = None) -> FastAPI:
    """Builds the service. `state` may be preloaded by the caller (see run.py)."""
    state = state if state is not None else VoiceRuntimeApp(config)
    app = FastAPI(title="CharacterOS voice runtime", version="0.1.0")
    app.state.voice_runtime = state

    # ------------------------------------------------------------------ health
    @app.get("/health")
    def health() -> JSONResponse:
        return JSONResponse(
            {
                "status": "ok",
                "state": state.manager.state().value,
                "device": state.manager.tts_device,
                "asr_device": state.manager.asr_device,
                "fp16": config.fp16,
                "uptime_ms": state.uptime_ms(),
                "warmup": {
                    "runs": config.warmup_runs,
                    "latencies_ms": state.manager.warmup_latencies_ms,
                    "error": state.manager.warmup_error,
                },
                "reference_cache": (
                    None if state.manager.reference_cache is None else state.manager.reference_cache.stats()
                ),
                "vad": state.vad_status(),
                "asr": state.manager.asr_status.as_dict(),
                "tts": state.manager.tts_status.as_dict(),
                "vram": state.manager.vram(),
            }
        )

    @app.post("/vad/calibrate")
    def vad_calibrate() -> JSONResponse:
        """Measures the room's noise floor so a quiet room stops reading as speech."""
        try:
            state.calibrate_vad()
        except audio_io.AudioUnavailableError as error:
            raise HTTPException(status_code=503, detail=str(error))
        return JSONResponse(state.vad_status())

    # ------------------------------------------------------------------ voices
    @app.get("/voices")
    def voices() -> JSONResponse:
        return JSONResponse({"voices": [v.public_view() for v in state.registry.list()]})

    @app.post("/voices/register")
    def register_voice(payload: RegisterVoiceRequest) -> JSONResponse:
        try:
            raw = base64.b64decode(payload.reference_wav_base64, validate=True)
        except Exception as error:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"reference audio is not valid base64: {error}")
        if len(raw) > config.max_audio_bytes:
            raise HTTPException(status_code=413, detail="reference audio exceeds the size limit")
        target = config.voices_file.parent / f"{payload.voice_id}.wav"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        try:
            profile = state.registry.register(
                voice_id=payload.voice_id,
                display_name=payload.display_name or payload.voice_id,
                reference_wav=target,
                reference_text=payload.reference_text,
            )
        except VoiceRegistryError as error:
            raise HTTPException(status_code=400, detail=str(error))
        return JSONResponse({"voice": profile.public_view()})

    # --------------------------------------------------------------------- TTS
    def _resolve_voice(voice_id: str | None):
        try:
            return state.registry.resolve(voice_id)
        except VoiceRegistryError as error:
            raise HTTPException(status_code=400, detail=str(error))

    @app.post("/tts")
    def tts(payload: TtsRequest) -> JSONResponse:
        voice = _resolve_voice(payload.voice_id)
        token = state.begin_generation()
        started = time.perf_counter()
        chunks: list[np.ndarray] = []
        first_chunk_ms: float | None = None
        try:
            for chunk, sample_rate in state.manager.synthesize(
                payload.text, voice, payload.instruct, stream=False
            ):
                if token.is_set():
                    break
                if first_chunk_ms is None:
                    first_chunk_ms = round((time.perf_counter() - started) * 1000, 1)
                chunks.append(chunk)
                sample_rate_out = sample_rate
        except NotReadyError as error:
            raise HTTPException(status_code=503, detail=str(error))
        except (ModelLoadError, ValueError) as error:
            raise HTTPException(status_code=400, detail=str(error))

        if not chunks:
            raise HTTPException(status_code=500, detail="synthesis produced no audio")
        audio = np.concatenate(chunks)
        total_ms = round((time.perf_counter() - started) * 1000, 1)
        audio_ms = round(len(audio) / sample_rate_out * 1000, 1)

        saved_path = None
        if payload.save_path:
            target = Path(payload.save_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            audio_io.write_wav(target, audio, sample_rate_out)
            saved_path = str(target)

        played = False
        if payload.play:
            try:
                audio_io.play_array(audio, sample_rate_out, token)
                played = True
            except audio_io.AudioUnavailableError as error:
                raise HTTPException(status_code=503, detail=str(error))

        result = {
            "sample_rate": sample_rate_out,
            "audio_ms": audio_ms,
            "total_ms": total_ms,
            "first_chunk_ms": first_chunk_ms,
            "rtf": round((total_ms / 1000) / (audio_ms / 1000), 4) if audio_ms else None,
            "played": played,
            "saved_path": saved_path,
            "cancelled": token.is_set(),
            "audio_base64": (
                base64.b64encode(audio.astype(np.float32).tobytes()).decode("ascii")
                if payload.return_audio
                else None
            ),
        }
        state.last_metrics = {**result, "mode": "tts", "text": payload.text, "instruct": payload.instruct}
        return JSONResponse(result)

    @app.post("/tts/stream")
    async def tts_stream(payload: TtsRequest, request: Request) -> StreamingResponse:
        """Streams PCM16LE as the model produces it.

        The audio is NOT generated in full and then sliced: chunks come from
        CosyVoice's own streaming generator and are forwarded (and played) as
        they appear, which is what makes the measured time-to-first-audio real.
        """
        voice = _resolve_voice(payload.voice_id)
        token = state.begin_generation()
        out_queue: queue.Queue = queue.Queue(maxsize=16)
        sentinel = object()
        worker_metrics: dict = {}

        # BARGE-IN — while the subject is speaking, watch the microphone for the
        # user starting to talk. Onset stops playback and cancels generation, so
        # an interruption actually silences the room instead of only detaching
        # the client. It reuses the SAME calibrated threshold as capture, so a
        # quiet room cannot trigger it.
        monitor: audio_io.SpeechOnsetMonitor | None = None
        if payload.play and payload.barge_in:
            floor = state.ensure_vad()
            if floor is not None:
                monitor = audio_io.SpeechOnsetMonitor(floor, state.vad_config).start()

        def worker() -> None:
            started = time.perf_counter()
            try:
                for chunk, sample_rate in state.manager.synthesize(
                    payload.text, voice, payload.instruct, stream=True
                ):
                    if token.is_set():
                        break
                    if "first_chunk_ms" not in worker_metrics:
                        worker_metrics["first_chunk_ms"] = round(
                            (time.perf_counter() - started) * 1000, 1
                        )
                    out_queue.put((chunk, sample_rate))
            except Exception as error:  # noqa: BLE001 - forwarded to the client
                worker_metrics["error"] = f"{type(error).__name__}: {error}"
            finally:
                worker_metrics["generation_ms"] = round((time.perf_counter() - started) * 1000, 1)
                out_queue.put(sentinel)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        player_holder: dict = {}
        first_audio_ms: float | None = None
        barge_in_at_ms: float | None = None
        samples_sent = 0
        request_started = time.perf_counter()

        async def generate():
            nonlocal first_audio_ms, samples_sent, barge_in_at_ms
            try:
                while True:
                    if await request.is_disconnected():
                        token.set()
                        break
                    # Poll the barge-in monitor between chunks: an interruption
                    # must stop BOTH the speaker and the generator, and the
                    # generator is inside the model manager's lock.
                    if monitor is not None and monitor.triggered():
                        barge_in_at_ms = round((time.perf_counter() - request_started) * 1000, 1)
                        token.set()
                        break
                    item = await asyncio.to_thread(out_queue.get)
                    if item is sentinel:
                        break
                    chunk, sample_rate = item
                    if first_audio_ms is None:
                        first_audio_ms = round((time.perf_counter() - request_started) * 1000, 1)
                    if payload.play:
                        if "player" not in player_holder:
                            player = audio_io.StreamingPlayer(sample_rate)
                            player.__enter__()
                            player_holder["player"] = player
                        await asyncio.to_thread(player_holder["player"].write, chunk)
                    samples_sent += len(chunk)
                    pcm = np.clip(chunk, -1.0, 1.0)
                    yield (pcm * 32767.0).astype("<i2").tobytes()
            finally:
                if monitor is not None:
                    monitor.stop()
                player = player_holder.get("player")
                if player is not None:
                    player.__exit__(None, None, None)
                state.last_metrics = {
                    "mode": "tts/stream",
                    "text": payload.text,
                    "instruct": payload.instruct,
                    "server_first_chunk_ms": worker_metrics.get("first_chunk_ms"),
                    "first_audio_ms": first_audio_ms,
                    "generation_ms": worker_metrics.get("generation_ms"),
                    "audio_ms": round(samples_sent / SAMPLE_RATE * 1000, 1),
                    "cancelled": token.is_set(),
                    "barge_in_at_ms": barge_in_at_ms,
                    "barge_in_threshold": None if monitor is None else round(monitor.threshold, 1),
                    "error": worker_metrics.get("error"),
                    # Where the time actually went, measured inside the model.
                    "stages": state.manager.last_stage_breakdown,
                }

        return StreamingResponse(
            generate(),
            media_type=PCM_CONTENT_TYPE,
            headers={
                "X-Voice-Sample-Rate": str(SAMPLE_RATE),
                "X-Voice-Channels": "1",
                "X-Voice-Encoding": "pcm_s16le",
            },
        )

    @app.post("/tts/cancel")
    def tts_cancel() -> JSONResponse:
        """Stops the in-flight generation and playback. Never touches CharacterOS."""
        state.cancel_event.set()
        return JSONResponse({"cancelled": True})

    @app.get("/metrics/last")
    def metrics_last() -> JSONResponse:
        return JSONResponse(state.last_metrics or {})

    # --------------------------------------------------------------------- ASR
    def _transcribe_bytes(raw: bytes, language: str | None) -> dict:
        if not raw:
            raise HTTPException(status_code=400, detail="audio payload is empty")
        if len(raw) > config.max_audio_bytes:
            raise HTTPException(status_code=413, detail="audio payload exceeds the size limit")
        tmp = config.voices_file.parent / ".asr-tmp.wav"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_bytes(raw)
        started = time.perf_counter()
        try:
            parsed = state.manager.transcribe_file(tmp)
        except NotReadyError as error:
            raise HTTPException(status_code=503, detail=str(error))
        except ModelLoadError as error:
            raise HTTPException(status_code=503, detail=str(error))
        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        return {
            "text": parsed["text"],
            "language": language or parsed["language"],
            "confidence": None,
            # OBSERVATION ONLY — the runtime reports what it heard in the audio
            # and never claims this is the subject's affect.
            "perceived_vocal_affect": {
                "label": parsed["emotion"],
                "event": parsed["event"],
                "authoritative": False,
            },
            "duration_ms": None,
            "latency_ms": latency_ms,
        }

    @app.post("/asr")
    def asr(payload: AsrRequest) -> JSONResponse:
        try:
            raw = base64.b64decode(payload.audio_base64, validate=True)
        except Exception as error:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"audio is not valid base64: {error}")
        return JSONResponse(_transcribe_bytes(raw, payload.language))

    @app.post("/asr/listen")
    def asr_listen(payload: ListenRequest) -> JSONResponse:
        token = state.begin_generation()
        # A forced capture bypasses the gate entirely and needs no calibration.
        floor = None if payload.fixed_ms is not None else state.ensure_vad()
        try:
            capture = audio_io.record_utterance(
                max_ms=payload.max_ms,
                silence_ms=payload.silence_ms,
                timeout_ms=payload.timeout_ms,
                fixed_ms=payload.fixed_ms,
                cancel=token,
                noise_floor=floor,
                config=state.vad_config,
            )
        except audio_io.AudioUnavailableError as error:
            raise HTTPException(status_code=503, detail=str(error))
        if not capture.captured or capture.audio is None:
            return JSONResponse(
                {
                    "text": "",
                    "language": payload.language,
                    "confidence": None,
                    "perceived_vocal_affect": None,
                    "duration_ms": round(capture.duration_ms, 1),
                    "latency_ms": 0.0,
                    "captured": False,
                    # Reported so a caller can see WHY nothing was captured:
                    # an uncalibrated gate and a genuinely silent room look the
                    # same in `captured: false` alone.
                    "noise_floor": None if capture.noise_floor is None else round(capture.noise_floor, 1),
                    "threshold": None if capture.threshold is None else round(capture.threshold, 1),
                    "speech_ms": round(capture.speech_ms, 1),
                }
            )
        tmp = config.voices_file.parent / ".listen-tmp.wav"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        audio_io.write_wav(tmp, capture.audio.astype(np.float32) / 32768.0, ASR_SAMPLE_RATE)
        result = _transcribe_bytes(tmp.read_bytes(), payload.language)
        result["captured"] = True
        result["duration_ms"] = round(capture.duration_ms, 1)
        result["speech_ms"] = round(capture.speech_ms, 1)
        result["noise_floor"] = None if capture.noise_floor is None else round(capture.noise_floor, 1)
        result["threshold"] = None if capture.threshold is None else round(capture.threshold, 1)
        return JSONResponse(result)

    return app
