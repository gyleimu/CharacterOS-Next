"""Model lifetime and inference for the local voice runtime.

Owns the two speech models (SenseVoiceSmall for ASR, Fun-CosyVoice3 for TTS),
their load state, and GPU serialization.

Lifetime policy for the first version: BOTH MODELS STAY RESIDENT, but they do
not share a device. Measured on the reference machine (RTX 4060 Laptop, 8 GB),
putting both on the GPU leaves ~261 MiB free and synthesis STALLS, because the
ONNX Runtime sessions and the CUDA context are not visible to
`torch.cuda.memory_allocated`. ASR therefore runs on the CPU and TTS on the GPU:
no quality, precision or model change, only placement. See `config.py`.

Inference is serialized behind one lock because a single consumer GPU cannot run
two generations at once; queueing is correct and predictable.
"""

from __future__ import annotations

import sys
import threading
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

import numpy as np

from .config import VoiceRuntimeConfig
from .voices import VoiceProfile

SAMPLE_RATE = 24000  # CosyVoice3 output rate, fixed by the model config.
ASR_SAMPLE_RATE = 16000  # SenseVoice input rate.

# Prefix CosyVoice3 expects before the <|endofprompt|> delimiter.
INSTRUCT_PREFIX = "You are a helpful assistant. "
INSTRUCT_TERMINATOR = "<|endofprompt|>"


class RuntimeState(str, Enum):
    """Lifecycle of the runtime as a whole.

    LOADING  models are being brought up; requests may be rejected as not ready.
    READY    both ASR and TTS are usable.
    DEGRADED exactly one of them is usable; the other failed to load.
    FAILED   neither is usable.
    """

    LOADING = "LOADING"
    READY = "READY"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"


@dataclass
class ModelStatus:
    loaded: bool = False
    model_id: str = ""
    device: str = ""
    load_ms: float | None = None
    error: str | None = None

    def as_dict(self) -> dict:
        return {
            "loaded": self.loaded,
            "model_id": self.model_id,
            "device": self.device,
            "load_ms": self.load_ms,
            "error": self.error,
        }


class ModelLoadError(Exception):
    """Raised when a model cannot be loaded or used."""


class NotReadyError(Exception):
    """Raised when a request needs a model that is not loaded."""


def _to_mono_float32(tensor) -> np.ndarray:
    """CosyVoice yields torch tensors shaped [1, T]; convert for transport."""
    array = tensor.detach().to("cpu").numpy()
    if array.ndim == 2:
        array = array[0]
    return np.ascontiguousarray(array.astype(np.float32))


class VoiceModelManager:
    """Loads, holds and runs the ASR and TTS models."""

    def __init__(self, config: VoiceRuntimeConfig) -> None:
        self.config = config
        self.tts_device = config.resolved_tts_device()
        self.asr_device = config.resolved_asr_device()
        self.tts_status = ModelStatus(model_id=config.tts_model_name, device=self.tts_device)
        self.asr_status = ModelStatus(model_id=config.asr_model_id, device=self.asr_device)
        self._tts = None
        self._asr = None
        # Inference lock: one consumer GPU cannot run two generations at once,
        # so requests queue instead of thrashing.
        self._lock = threading.Lock()
        # Load lock: a background preload and an early request must not race into
        # loading the same model twice.
        self._load_lock = threading.Lock()
        # True while preload is in flight, so /health reports LOADING rather
        # than a premature DEGRADED (one model up, the other still loading).
        self._loading = False
        self._path_ready = False

    # ------------------------------------------------------------------ paths
    def _prepare_paths(self) -> None:
        """Make the external CosyVoice checkout importable (README/FAQ requirement)."""
        if self._path_ready:
            return
        src = self.config.cosyvoice_src
        if not src.exists():
            raise ModelLoadError(f"CosyVoice source not found: {src}")
        matcha = src / "third_party" / "Matcha-TTS"
        for candidate in (str(matcha), str(src)):
            if candidate not in sys.path:
                sys.path.insert(0, candidate)
        self._path_ready = True

    # -------------------------------------------------------------------- TTS
    def _ensure_tts(self) -> None:
        with self._load_lock:
            self._ensure_tts_locked()

    def _ensure_tts_locked(self) -> None:
        if self._tts is not None:
            return
        if self.tts_status.error is not None:
            raise ModelLoadError(f"TTS previously failed to load: {self.tts_status.error}")
        started = time.perf_counter()
        try:
            self._prepare_paths()
            from cosyvoice.cli.cosyvoice import AutoModel  # type: ignore

            model_dir = self.config.tts_model_dir
            if not model_dir.exists():
                raise ModelLoadError(f"TTS model directory not found: {model_dir}")
            self._tts = AutoModel(model_dir=str(model_dir), fp16=self.config.fp16)
            self.tts_status.loaded = True
        except Exception as error:  # noqa: BLE001 - reported as status, not raised upward
            self.tts_status.error = f"{type(error).__name__}: {error}"
            raise ModelLoadError(self.tts_status.error) from error
        finally:
            self.tts_status.load_ms = round((time.perf_counter() - started) * 1000, 1)

    # -------------------------------------------------------------------- ASR
    def _ensure_asr(self) -> None:
        with self._load_lock:
            self._ensure_asr_locked()

    def _ensure_asr_locked(self) -> None:
        if self._asr is not None:
            return
        if self.asr_status.error is not None:
            raise ModelLoadError(f"ASR previously failed to load: {self.asr_status.error}")
        started = time.perf_counter()
        try:
            from funasr import AutoModel  # type: ignore

            self._asr = AutoModel(
                model=self.config.asr_model_id,
                device=self.asr_device,
                disable_update=True,
                hub=self.config.asr_hub,
            )
            self.asr_status.loaded = True
        except Exception as error:  # noqa: BLE001
            self.asr_status.error = f"{type(error).__name__}: {error}"
            raise ModelLoadError(self.asr_status.error) from error
        finally:
            self.asr_status.load_ms = round((time.perf_counter() - started) * 1000, 1)

    # ---------------------------------------------------------------- startup
    def preload(self) -> RuntimeState:
        """Brings both models up. A single model failure degrades rather than kills.

        The runtime is deliberately NOT all-or-nothing: if TTS fails but ASR
        works (or the reverse), the working half stays usable and the state is
        reported as DEGRADED so the caller can degrade gracefully too.
        """
        self._loading = True
        try:
            for ensure in (self._ensure_asr, self._ensure_tts):
                try:
                    ensure()
                except ModelLoadError:
                    continue
            if self.config.warmup:
                self._warmup()
        finally:
            self._loading = False
        return self.state()

    def _warmup(self) -> None:
        """Runs one short synthesis so the first real request is not the cold one.

        Warmup failures are non-fatal: they only mean the first request will pay
        the cold cost.
        """
        if self._tts is None:
            return
        try:
            with self._lock:
                for _ in self._stream_tts("你好。", self._default_prompt(None, "你好。"), stream=False):
                    break
        except Exception:  # noqa: BLE001 - warmup is best effort
            pass

    def state(self) -> RuntimeState:
        if self._loading:
            return RuntimeState.LOADING
        tts_ok = self.tts_status.loaded
        asr_ok = self.asr_status.loaded
        if tts_ok and asr_ok:
            return RuntimeState.READY
        if tts_ok or asr_ok:
            return RuntimeState.DEGRADED
        # Nothing loaded and preload is not running: either still lazy (nothing
        # requested yet) or genuinely failed.
        if self.tts_status.error is None and self.asr_status.error is None:
            return RuntimeState.LOADING
        return RuntimeState.FAILED

    def devices(self) -> dict:
        return {"tts": self.tts_device, "asr": self.asr_device}

    # ------------------------------------------------------------ prompt text
    def _default_prompt(self, instruct: str | None, text: str) -> str:
        """Kept for symmetry; the real prompt builder is `build_prompt_text`."""
        return self.build_prompt_text(instruct, self.config.resolve_reference_wav())

    def build_prompt_text(self, instruct: str | None, voice: VoiceProfile | Path) -> str:
        """Builds the CosyVoice3 prompt text for one utterance.

        The reference transcript is deliberately NOT appended. Measured on
        Fun-CosyVoice3-0.5B-2512 with one reference clip and one utterance:

            zero_shot, prompt = prefix + <|endofprompt|> + transcript   2.40 s, clean
            instruct2, instruct = prefix + <|endofprompt|>              1.92 s, clean
            instruct2, instruct = prefix + <|endofprompt|> + transcript 5.24 s, WRONG

        In the instruct path the model treats text after the delimiter as text to
        SYNTHESIZE, so appending the transcript makes it speak the reference
        recording's words before the utterance (confirmed by transcribing the
        output back: "希望你以后能够做的比我还好哟。你好，我是characteros。"). The
        official instruct example therefore passes the instruction only, and this
        runtime standardises on that single path so that neutral and directive
        utterances are generated identically apart from the directive.
        """
        directive = instruct if instruct else f"{INSTRUCT_PREFIX}{INSTRUCT_TERMINATOR}"
        if not directive.endswith(INSTRUCT_TERMINATOR):
            directive = f"{directive}{INSTRUCT_TERMINATOR}"
        return directive

    # -------------------------------------------------------------------- TTS
    def _stream_tts(self, text: str, prompt_text: str, stream: bool):
        """Yields float32 mono chunks. Caller must hold the lock."""
        prompt_wav = self._prompt_wav
        assert self._tts is not None
        for output in self._tts.inference_instruct2(
            text, prompt_text, str(prompt_wav), stream=stream
        ):
            yield _to_mono_float32(output["tts_speech"])

    def synthesize(
        self,
        text: str,
        voice: VoiceProfile,
        instruct: str | None,
        stream: bool,
    ):
        """Generator of (chunk, sample_rate) for one utterance.

        Yields incrementally when `stream=True`, which is what makes the
        streaming endpoint genuinely streaming rather than pre-sliced audio.
        """
        if not text.strip():
            raise ValueError("cannot synthesize empty text")
        if len(text) > self.config.max_text_chars:
            raise ValueError(f"text exceeds {self.config.max_text_chars} characters")
        self._ensure_tts()
        if self._tts is None:
            raise NotReadyError("TTS is not available")
        self._prompt_wav = Path(voice.reference_wav or "")
        if not self._prompt_wav.exists():
            raise ModelLoadError(f"reference audio missing: {self._prompt_wav}")
        prompt_text = self.build_prompt_text(instruct, voice)
        with self._lock:
            for chunk in self._stream_tts(text, prompt_text, stream):
                yield chunk, SAMPLE_RATE

    # -------------------------------------------------------------------- ASR
    def transcribe_file(self, wav_path: Path) -> dict:
        """Transcribes one WAV file and returns text plus non-authoritative tags."""
        self._ensure_asr()
        if self._asr is None:
            raise NotReadyError("ASR is not available")
        with self._lock:
            result = self._asr.generate(
                input=str(wav_path),
                cache={},
                language="auto",
                use_itn=True,
                batch_size_s=60,
                merge_vad=True,
                merge_length_s=15,
            )
        return self._parse_asr_result(result)

    @staticmethod
    def _parse_asr_result(result) -> dict:
        import re

        from funasr.utils.postprocess_utils import rich_transcription_postprocess  # type: ignore

        raw = result[0]["text"] if result else ""
        tag_block = re.match(r"^(?:<\|[^|]+\|>)+", raw)
        tags = re.findall(r"<\|([^|]+)\|>", tag_block.group(0)) if tag_block else []
        return {
            "text": rich_transcription_postprocess(raw) if raw else "",
            "raw_text": raw,
            "language": tags[0] if len(tags) > 0 else None,
            # Reported to CharacterOS as OBSERVATION ONLY. It describes the
            # audio, not the subject, and is never written into canonical affect.
            "emotion": tags[1] if len(tags) > 1 else None,
            "event": tags[2] if len(tags) > 2 else None,
        }

    # ------------------------------------------------------------------- VRAM
    def vram(self) -> dict | None:
        try:
            import torch

            if not torch.cuda.is_available():
                return None
            free, total = torch.cuda.mem_get_info()
            return {
                "total_mb": round(total / 1024 / 1024, 1),
                "used_mb": round((total - free) / 1024 / 1024, 1),
                "allocated_mb": round(torch.cuda.memory_allocated() / 1024 / 1024, 1),
                "peak_allocated_mb": round(torch.cuda.max_memory_allocated() / 1024 / 1024, 1),
            }
        except Exception:  # noqa: BLE001
            return None
