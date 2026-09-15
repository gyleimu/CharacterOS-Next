"""Configuration for the local CharacterOS voice runtime.

The runtime SOURCE lives in this repository; the Python environment, the
CosyVoice checkout and the model weights live outside it (see
`docs/voice/README.md`). Nothing here is CharacterOS canonical state — this
process is a speech service, not a subject runtime.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8181
DEFAULT_ASR_MODEL = "iic/SenseVoiceSmall"
DEFAULT_TTS_MODEL_NAME = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"

# The reference voice CosyVoice ships with the repository for its own zero-shot
# demos. Operators are expected to replace it with audio they have the right to
# use; the runtime never downloads a voice and never imitates a public figure.
BUNDLED_REFERENCE_WAV = Path("asset") / "zero_shot_prompt.wav"
BUNDLED_REFERENCE_TEXT = "希望你以后能够做的比我还好呦。"


def _env_path(name: str) -> Path | None:
    raw = os.environ.get(name)
    return Path(raw).expanduser() if raw else None


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass
class VoiceRuntimeConfig:
    """Resolved runtime configuration.

    Every path is explicit so the same source tree can run against a different
    environment (another machine, another model directory) with no code change.
    """

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT

    # --- external runtime assets -------------------------------------------------
    cosyvoice_src: Path = field(default_factory=lambda: _env_path("VOICE_COSYVOICE_SRC") or Path("CosyVoice"))
    tts_model_dir: Path = field(
        default_factory=lambda: _env_path("VOICE_TTS_MODEL_DIR") or Path("models/Fun-CosyVoice3-0.5B")
    )
    voices_file: Path = field(
        default_factory=lambda: _env_path("VOICE_VOICES_FILE") or Path("voices/voices.json")
    )
    asr_model_id: str = field(default_factory=lambda: os.environ.get("VOICE_ASR_MODEL", DEFAULT_ASR_MODEL))
    asr_hub: str = field(default_factory=lambda: os.environ.get("VOICE_ASR_HUB", "ms"))
    tts_model_name: str = DEFAULT_TTS_MODEL_NAME

    # --- device / precision ------------------------------------------------------
    # MEASURED SPLIT, not a guess. On the reference machine (RTX 4060 Laptop,
    # 8 GB) keeping BOTH models on the GPU leaves only ~261 MiB free, which is
    # not enough for TTS generation activations: synthesis stalls instead of
    # finishing. `torch.cuda.memory_allocated` reports ~4.2 GB, but the ONNX
    # Runtime sessions (speech tokenizer, speaker embedding) and the CUDA
    # context add several GB that the torch figure does not include.
    #
    # Running ASR on the CPU frees that headroom and leaves TTS on the GPU. No
    # model quality, precision or configuration is changed by this split — only
    # where each model runs.
    tts_device: str = field(default_factory=lambda: os.environ.get("VOICE_TTS_DEVICE", "auto"))
    asr_device: str = field(default_factory=lambda: os.environ.get("VOICE_ASR_DEVICE", "cpu"))
    fp16: bool = field(default_factory=lambda: _env_bool("VOICE_FP16", True))

    # --- lifetime ----------------------------------------------------------------
    # Both models stay resident: reloading per request would cost tens of seconds
    # of cold start each time. With the CPU/GPU split above the GPU holds only
    # the TTS model, which leaves real headroom.
    preload: bool = field(default_factory=lambda: _env_bool("VOICE_PRELOAD", True))
    warmup: bool = field(default_factory=lambda: _env_bool("VOICE_WARMUP", True))

    # --- limits ------------------------------------------------------------------
    max_text_chars: int = field(default_factory=lambda: _env_int("VOICE_MAX_TEXT_CHARS", 4000))
    max_audio_bytes: int = field(default_factory=lambda: _env_int("VOICE_MAX_AUDIO_BYTES", 32 * 1024 * 1024))

    @staticmethod
    def _resolve(device: str) -> str:
        if device != "auto":
            return device
        try:
            import torch

            return "cuda:0" if torch.cuda.is_available() else "cpu"
        except Exception:  # pragma: no cover - torch is a hard dependency in practice
            return "cpu"

    def resolved_tts_device(self) -> str:
        return self._resolve(self.tts_device)

    def resolved_asr_device(self) -> str:
        return self._resolve(self.asr_device)

    def resolve_reference_wav(self) -> Path:
        return self.cosyvoice_src / BUNDLED_REFERENCE_WAV
