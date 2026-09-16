"""Microphone capture (calibrated energy VAD) and speaker playback.

The gate is an energy detector with a MEASURED noise floor, not a magic
constant. The first version used a fixed threshold that, in a quiet room, still
triggered on ambient noise and ran to `max_ms`. This version:

  1. measures the room's noise floor once (median RMS over ~1.2 s, so a transient
     during calibration cannot skew it) and caches it,
  2. derives the speech threshold as `noise_floor * margin`, with an absolute
     floor below which nothing is ever treated as speech,
  3. requires `min_speech_ms` of sustained energy before declaring onset, which
     rejects keyboard clicks and other short transients,
  4. ends the utterance after `silence_ms` of quiet, with a short hangover so a
     natural pause inside a sentence does not cut the user off.

Still deliberately not a neural VAD: the goal is "the subject can hear the user",
and a calibrated energy gate is enough for that in a single-room, single-speaker
setting. `sounddevice` is imported lazily so a machine without an audio device
can still serve file-based TTS/ASR.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import numpy as np

MIC_SAMPLE_RATE = 16000
_BLOCK_MS = 30


class AudioUnavailableError(Exception):
    """Raised when no audio device can be opened."""


@dataclass
class VadConfig:
    """Gate parameters. Defaults suit a quiet room with a close microphone."""

    # Multiplier applied to the measured noise floor.
    margin_factor: float = 4.0
    # int16 RMS below this is never speech, whatever the floor says.
    absolute_floor: float = 120.0
    # Sustained energy required before onset is declared (rejects transients).
    min_speech_ms: int = 150
    # Quiet time that ends the utterance.
    silence_ms: int = 700
    # Extra capture after the last speech block, so trailing phonemes survive.
    hangover_ms: int = 180
    calibration_ms: int = 1200


@dataclass
class CaptureResult:
    audio: np.ndarray | None  # int16 mono
    captured: bool
    duration_ms: float
    speech_ms: float
    noise_floor: float | None = None
    threshold: float | None = None


def _rms(block: np.ndarray) -> float:
    if block.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(block.astype(np.float64)))))


def measure_noise_floor(config: VadConfig | None = None) -> float:
    """Measures ambient noise as the MEDIAN block RMS (robust to a transient)."""
    cfg = config or VadConfig()
    try:
        import sounddevice as sd
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"sounddevice unavailable: {error}") from error

    blocksize = int(MIC_SAMPLE_RATE * _BLOCK_MS / 1000)
    wanted = max(3, cfg.calibration_ms // _BLOCK_MS)
    levels: list[float] = []
    try:
        with sd.InputStream(
            samplerate=MIC_SAMPLE_RATE, channels=1, dtype="int16", blocksize=blocksize
        ) as stream:
            for _ in range(wanted):
                block, _overflow = stream.read(blocksize)
                levels.append(_rms(np.asarray(block, dtype=np.int16).reshape(-1)))
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"microphone calibration failed: {error}") from error
    return float(np.median(levels)) if levels else 0.0


def threshold_for(noise_floor: float, config: VadConfig | None = None) -> float:
    cfg = config or VadConfig()
    return max(cfg.absolute_floor, noise_floor * cfg.margin_factor)


def record_utterance(
    max_ms: int = 15000,
    silence_ms: int = 700,
    timeout_ms: int = 20000,
    fixed_ms: int | None = None,
    cancel: threading.Event | None = None,
    noise_floor: float | None = None,
    config: VadConfig | None = None,
) -> CaptureResult:
    """Records one utterance from the default microphone.

    Returns `captured=False` when no speech cleared the gate before
    `timeout_ms`, which is an ordinary outcome rather than an error. A genuinely
    quiet room now falls into this branch instead of running to `max_ms`.
    `fixed_ms` bypasses the gate entirely, which is what makes benchmarks
    deterministic.
    """
    cfg = config or VadConfig()
    try:
        import sounddevice as sd
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"sounddevice unavailable: {error}") from error

    if fixed_ms is None and noise_floor is None:
        noise_floor = measure_noise_floor(cfg)
    threshold = None if noise_floor is None else threshold_for(noise_floor, cfg)

    blocksize = int(MIC_SAMPLE_RATE * _BLOCK_MS / 1000)
    frames: list[np.ndarray] = []
    started = time.perf_counter()
    speech_ms = 0.0
    trailing_silence_ms = 0.0
    preroll: list[np.ndarray] = []
    in_speech = False
    onset_blocks = max(1, cfg.min_speech_ms // _BLOCK_MS)
    consecutive_speech = 0

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
                is_speech = threshold is not None and level > threshold

                if not in_speech:
                    # Keep a rolling pre-roll so the first phoneme is not clipped.
                    preroll.append(block)
                    if len(preroll) > 8:
                        preroll.pop(0)
                    consecutive_speech = consecutive_speech + 1 if is_speech else 0
                    if consecutive_speech >= onset_blocks:
                        in_speech = True
                        speech_ms = consecutive_speech * _BLOCK_MS
                        frames.extend(preroll)
                        preroll = []
                        trailing_silence_ms = 0.0
                else:
                    if is_speech:
                        speech_ms += _BLOCK_MS
                        trailing_silence_ms = 0.0
                    else:
                        trailing_silence_ms += _BLOCK_MS
                    frames.append(block)
                    if trailing_silence_ms >= cfg.silence_ms:
                        # Keep the hangover, drop the rest of the silence.
                        keep = int(max(0, cfg.hangover_ms) // _BLOCK_MS)
                        drop = int(trailing_silence_ms // _BLOCK_MS) - keep
                        if drop > 0:
                            frames = frames[:-drop] if drop < len(frames) else frames
                        break

                if elapsed_ms >= max_ms:
                    break
                if not in_speech and elapsed_ms >= timeout_ms:
                    break
    except AudioUnavailableError:
        raise
    except Exception as error:  # noqa: BLE001
        raise AudioUnavailableError(f"microphone capture failed: {error}") from error

    duration_ms = (time.perf_counter() - started) * 1000
    if not frames or not in_speech:
        return CaptureResult(None, False, duration_ms, speech_ms, noise_floor, threshold)
    audio = np.concatenate(frames).astype(np.int16)
    return CaptureResult(audio, True, duration_ms, speech_ms, noise_floor, threshold)


class SpeechOnsetMonitor:
    """Watches for the START of user speech, for barge-in during playback.

    Runs its own input stream so it can be active while audio is playing. It
    reports onset only after `min_speech_ms` of sustained energy above the same
    calibrated threshold, so the tail of the subject's own speech bleeding back
    through the speakers does not immediately self-interrupt.
    """

    def __init__(self, noise_floor: float, config: VadConfig | None = None) -> None:
        self._config = config or VadConfig()
        self._threshold = threshold_for(noise_floor, self._config)
        self._onset = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.error: str | None = None
        # Speak louder than this and it counts as an interruption regardless of
        # the adaptive threshold, so a raised voice always wins.
        self._absolute = self._threshold * 1.5

    def start(self) -> "SpeechOnsetMonitor":
        self._thread = threading.Thread(target=self._run, name="barge-in-monitor", daemon=True)
        self._thread.start()
        return self

    def _run(self) -> None:
        try:
            import sounddevice as sd
        except Exception as error:  # noqa: BLE001
            self.error = f"sounddevice unavailable: {error}"
            return
        blocksize = int(MIC_SAMPLE_RATE * _BLOCK_MS / 1000)
        needed = max(1, self._config.min_speech_ms // _BLOCK_MS)
        streak = 0
        try:
            with sd.InputStream(
                samplerate=MIC_SAMPLE_RATE, channels=1, dtype="int16", blocksize=blocksize
            ) as stream:
                while not self._stop.is_set():
                    block, _overflow = stream.read(blocksize)
                    level = _rms(np.asarray(block, dtype=np.int16).reshape(-1))
                    if level > self._threshold:
                        streak += 1
                        if streak >= needed or level > self._absolute:
                            self._onset.set()
                            return
                    else:
                        streak = 0
        except Exception as error:  # noqa: BLE001
            self.error = f"barge-in monitor failed: {error}"

    def wait(self, timeout_s: float) -> bool:
        """True when speech started before the timeout."""
        return self._onset.wait(timeout_s)

    def triggered(self) -> bool:
        """Non-blocking check, for a playback loop that must poll anyway."""
        return self._onset.is_set()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)

    @property
    def threshold(self) -> float:
        return self._threshold


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
        self._stream = sd.OutputStream(samplerate=self.sample_rate, channels=1, dtype="float32")
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
