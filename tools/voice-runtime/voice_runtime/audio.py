"""Microphone capture (with a simple energy VAD) and speaker playback.

Deliberately small: an energy gate with an adaptive noise floor, not a trained
VAD model. The goal is "the subject can hear the user", not a robust meeting
transcriber, so no extra model and no diarization is involved.

`sounddevice` (PortAudio) is imported lazily so that a machine without an audio
device can still run the HTTP service for file-based TTS/ASR.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import numpy as np

MIC_SAMPLE_RATE = 16000
_BLOCK_MS = 30
_ABSOLUTE_FLOOR = 180.0  # int16 RMS below this is never treated as speech
_NOISE_FACTOR = 3.0
_CALIBRATION_BLOCKS = 10


class AudioUnavailableError(Exception):
    """Raised when no audio device can be opened."""


@dataclass
class CaptureResult:
    audio: np.ndarray | None  # int16 mono
    captured: bool
    duration_ms: float
    speech_detected_ms: float


def _rms(block: np.ndarray) -> float:
    if block.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(block.astype(np.float64)))))


def record_utterance(
    max_ms: int = 15000,
    silence_ms: int = 700,
    timeout_ms: int = 20000,
    fixed_ms: int | None = None,
    cancel: threading.Event | None = None,
) -> CaptureResult:
    """Records one utterance from the default microphone.

    Returns `captured=False` when only silence was heard before `timeout_ms`,
    which is an ordinary outcome rather than an error. `fixed_ms` bypasses the
    VAD entirely and records exactly that long, which makes benchmarks and
    automated checks deterministic.
    """
    try:
        import sounddevice as sd
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"sounddevice unavailable: {error}") from error

    blocksize = int(MIC_SAMPLE_RATE * _BLOCK_MS / 1000)
    frames: list[np.ndarray] = []
    started = time.perf_counter()
    speech_ms = 0.0
    trailing_silence_ms = 0.0
    noise_floor: float | None = None
    in_speech = False
    calibration_blocks = 0 if fixed_ms else _CALIBRATION_BLOCKS

    try:
        with sd.InputStream(
            samplerate=MIC_SAMPLE_RATE, channels=1, dtype="int16", blocksize=blocksize
        ) as stream:
            while True:
                if cancel is not None and cancel.is_set():
                    break
                block, _overflow = stream.read(blocksize)
                block = np.asarray(block, dtype=np.int16).reshape(-1)
                elapsed_ms = (time.perf_counter() - started) * 1000

                if fixed_ms is not None:
                    frames.append(block)
                    if elapsed_ms >= fixed_ms:
                        break
                    continue

                level = _rms(block)

                if calibration_blocks > 0:
                    frames.append(block)
                    calibration_blocks -= 1
                    if calibration_blocks == 0:
                        noise_floor = _rms(np.concatenate(frames))
                        frames = []
                    continue

                threshold = max(_ABSOLUTE_FLOOR, (noise_floor or 0.0) * _NOISE_FACTOR)

                if level > threshold:
                    in_speech = True
                    speech_ms += _BLOCK_MS
                    trailing_silence_ms = 0.0
                    frames.append(block)
                elif in_speech:
                    trailing_silence_ms += _BLOCK_MS
                    frames.append(block)
                    if trailing_silence_ms >= silence_ms:
                        break
                else:
                    # Not yet speaking: keep a small rolling pre-roll so the
                    # first phoneme is not clipped.
                    frames.append(block)
                    if len(frames) > 6:
                        frames.pop(0)

                if elapsed_ms >= max_ms:
                    break
                if not in_speech and elapsed_ms >= timeout_ms:
                    break
    except AudioUnavailableError:
        raise
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"microphone capture failed: {error}") from error

    duration_ms = (time.perf_counter() - started) * 1000
    if not frames:
        return CaptureResult(None, False, duration_ms, speech_ms)
    audio = np.concatenate(frames).astype(np.int16)
    # `fixed_ms` mode is a deliberate forced capture; VAD mode requires speech.
    captured = True if fixed_ms is not None else speech_ms > 0
    return CaptureResult(audio, captured, duration_ms, speech_ms)


def play_array(audio: np.ndarray, sample_rate: int, cancel: threading.Event | None = None) -> None:
    """Plays a complete buffer, blocking until done or cancelled."""
    try:
        import sounddevice as sd
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"sounddevice unavailable: {error}") from error
    if cancel is not None and cancel.is_set():
        return
    try:
        sd.play(np.asarray(audio, dtype=np.float32), sample_rate)
        sd.wait()
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"playback failed: {error}") from error


class StreamingPlayer:
    """Plays chunks as they arrive, so audio starts before generation finishes.

    Writing each chunk to an open output stream is what makes the measured
    time-to-first-audio meaningful: the first chunk is audible while the rest of
    the utterance is still being generated.
    """

    def __init__(self, sample_rate: int) -> None:
        self.sample_rate = sample_rate
        self._stream = None
        self._sd = None

    def __enter__(self) -> "StreamingPlayer":
        try:
            import sounddevice as sd
        except Exception as error:  # noqa: BLE001
            raise AudioUnavailableError(f"sounddevice unavailable: {error}") from error
        self._sd = sd
        self._stream = sd.OutputStream(
            samplerate=self.sample_rate, channels=1, dtype="float32"
        )
        self._stream.start()
        return self

    def write(self, chunk: np.ndarray) -> None:
        if self._stream is None:
            raise AudioUnavailableError("streaming player is not open")
        self._stream.write(np.asarray(chunk, dtype=np.float32).reshape(-1, 1))

    def __exit__(self, *_exc) -> None:
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            finally:
                self._stream = None


def write_wav(path, audio: np.ndarray, sample_rate: int) -> None:
    """Writes float32 mono audio to a 16-bit PCM WAV."""
    import soundfile as sf

    clipped = np.clip(np.asarray(audio, dtype=np.float32), -1.0, 1.0)
    sf.write(str(path), clipped, sample_rate, subtype="PCM_16")
