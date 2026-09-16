"""Latency instrumentation and the reference-conditioning memo.

Two concerns, both measured rather than assumed:

1. `ReferenceConditioningCache` removes work that CosyVoice repeats on EVERY
   call and for EVERY sentence. `frontend_zero_shot` re-encodes the reference
   WAV from scratch each time: `load_wav`, whisper log-mel, the ONNX speech
   tokenizer on the GPU, kaldi fbank, the ONNX speaker embedding on the CPU, and
   the mel extractor. Measured at ~585 ms per call on the reference machine, and
   a multi-sentence reply pays it once per sentence. It is pure repeated work —
   the reference audio does not change between sentences.

   The official `add_zero_shot_spk` cache is NOT usable here: when a
   `zero_shot_spk_id` is supplied, `frontend_zero_shot` returns
   `{**spk2info[id]}` wholesale and therefore DISCARDS the delivery directive
   that `frontend_instruct2` passed in, which would silently break the
   expression -> delivery mapping. Memoizing the three extraction methods
   instead leaves the official call path completely unchanged.

   The cached tensors ARE mutated in place by `frontend_zero_shot`
   (`speech_feat_len[:] = ...`), so every return is a clone rather than the
   cached object.

2. `LatencyRecorder` times the stages of one synthesis so the runtime can report
   where the time went, instead of the caller having to guess.
"""

from __future__ import annotations

import copy
import os
import statistics
import threading
import time
from typing import Any

import torch


def _clone(value: Any) -> Any:
    """Deep-ish clone: tensors are copied, containers are rebuilt."""
    if torch.is_tensor(value):
        return value.clone()
    if isinstance(value, tuple):
        return tuple(_clone(item) for item in value)
    if isinstance(value, list):
        return [_clone(item) for item in value]
    if isinstance(value, dict):
        return {key: _clone(item) for key, item in value.items()}
    return copy.deepcopy(value)


class ReferenceConditioningCache:
    """Memoizes the expensive per-call reference-audio extraction."""

    METHODS = ("_extract_speech_token", "_extract_spk_embedding", "_extract_speech_feat")

    def __init__(self, frontend: Any) -> None:
        self._frontend = frontend
        self._cache: dict[tuple, Any] = {}
        self.hits = 0
        self.misses = 0

    def install(self) -> "ReferenceConditioningCache":
        for name in self.METHODS:
            original = getattr(self._frontend, name)
            setattr(self._frontend, name, self._wrap(name, original))
        return self

    def _key(self, name: str, prompt_wav: Any) -> tuple:
        """Keyed on identity AND mtime/size, so replacing the reference resets it.

        The path is resolved to an absolute path first. Without that, warmup
        (which holds a relative path) and a real request (whose voice registry
        entry is absolute) produce DIFFERENT keys for the same file, so the first
        request after warmup missed and paid the full re-encode — measured at
        1415 ms instead of ~2 ms.
        """
        try:
            path = os.path.realpath(str(prompt_wav))
        except OSError:
            path = str(prompt_wav)
        try:
            info = os.stat(path)
            return (name, path, info.st_mtime_ns, info.st_size)
        except OSError:
            # Unreadable path: never cache, and let the original raise.
            return (name, path, time.monotonic_ns(), 0)

    def _wrap(self, name: str, original: Any) -> Any:
        def wrapper(prompt_wav: Any) -> Any:
            key = self._key(name, prompt_wav)
            if key in self._cache:
                self.hits += 1
                return _clone(self._cache[key])
            value = original(prompt_wav)
            self._cache[key] = _clone(value)
            self.misses += 1
            return _clone(value)

        return wrapper

    def stats(self) -> dict:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "cached_references": len({key[1] for key in self._cache}),
            "entries": len(self._cache),
        }

    def clear(self) -> None:
        self._cache.clear()


class LatencyRecorder:
    """Times the stages of one synthesis and reports them as a breakdown.

    Stages that the installed backend cannot expose are reported as
    NOT INSTRUMENTABLE rather than estimated.
    """

    def __init__(self) -> None:
        self._marks: dict[str, float] = {}
        self._order: list[str] = []
        self._started: float | None = None

    def start(self) -> None:
        self._marks.clear()
        self._order.clear()
        self._started = time.perf_counter()

    def mark(self, name: str) -> None:
        if self._started is None:
            return
        if name not in self._marks:
            self._order.append(name)
        self._marks[name] = (time.perf_counter() - self._started) * 1000

    def begin(self, name: str) -> None:
        """Records the START of a stage (only the first occurrence counts)."""
        if self._started is None or f"{name}:begin" in self._marks:
            return
        self._marks[f"{name}:begin"] = (time.perf_counter() - self._started) * 1000

    def end(self, name: str) -> None:
        if self._started is None or f"{name}:begin" not in self._marks:
            return
        started = self._marks[f"{name}:begin"]
        self.mark(name)
        self._marks[f"{name}:duration"] = round(self._marks[name] - started, 1)

    def breakdown(self, extra: dict | None = None) -> dict:
        """Stage timestamps plus derived durations, in milliseconds."""
        result: dict[str, Any] = dict(extra or {})
        for name in self._order:
            result[name] = round(self._marks[name], 1)
        for name in list(self._marks):
            if name.endswith(":duration"):
                result[name] = self._marks[name]
            if name.endswith(":begin"):
                key = name[: -len(":begin")]
                if f"{key}:duration" not in self._marks:
                    result[f"{key}_start"] = round(self._marks[name], 1)
        return result


def summarise(values: list[float]) -> dict:
    """Median/p95/min/max for a latency sample. Empty samples stay honest."""
    if not values:
        return {"n": 0, "median_ms": None, "p95_ms": None, "min_ms": None, "max_ms": None}
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, int(round(0.95 * len(ordered) + 0.5)) - 1))
    return {
        "n": len(values),
        "median_ms": round(statistics.median(ordered), 1),
        "p95_ms": round(ordered[rank], 1),
        "min_ms": round(ordered[0], 1),
        "max_ms": round(ordered[-1], 1),
    }


class StageProfiler:
    """Times the stages INSIDE the CosyVoice call, so the runtime can report
    where the time went rather than the caller guessing.

    Stages the installed backend does not expose stay absent from the breakdown
    instead of being estimated. Inference is serialized by the model manager's
    lock, so a single shared recorder is sufficient and cannot interleave.
    """

    def __init__(self, model: Any) -> None:
        self._model = model
        self._recorder = LatencyRecorder()
        self._enabled = False
        self.llm_first_token_ms: float | None = None
        self.llm_total_ms: float | None = None

    def install(self) -> "StageProfiler":
        frontend = self._model.frontend
        for name in (
            "text_normalize",
            "_extract_speech_feat",
            "_extract_speech_token",
            "_extract_spk_embedding",
            "frontend_zero_shot",
        ):
            original = getattr(frontend, name)
            setattr(frontend, name, self._timed(name, original))

        core = self._model.model
        core.flow.inference = self._timed("flow_inference", core.flow.inference)
        core.hift.inference = self._timed("hift_inference", core.hift.inference)
        core.token2wav = self._timed("token2wav", core.token2wav)

        original_llm_job = core.llm_job

        def timed_llm_job(text, prompt_text, llm_prompt_speech_token, llm_embedding, uuid):
            started = time.perf_counter()
            seen: list[float | None] = [None]

            def monitor() -> None:
                # The LLM runs on its own thread and stream, so its progress is
                # observed by polling the buffer it appends to. 2 ms is far below
                # the token interval, so the measurement resolution is adequate.
                while seen[0] is None:
                    if len(core.tts_speech_token_dict.get(uuid, [])) > 0:
                        seen[0] = (time.perf_counter() - started) * 1000
                        return
                    if core.llm_end_dict.get(uuid, False):
                        return
                    time.sleep(0.002)

            watcher = threading.Thread(target=monitor, daemon=True)
            watcher.start()
            try:
                return original_llm_job(text, prompt_text, llm_prompt_speech_token, llm_embedding, uuid)
            finally:
                watcher.join(timeout=5)
                if self._enabled:
                    if seen[0] is not None:
                        self.llm_first_token_ms = round(seen[0], 1)
                    self.llm_total_ms = round((time.perf_counter() - started) * 1000, 1)

        core.llm_job = timed_llm_job
        return self

    def _timed(self, name: str, fn: Any) -> Any:
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            started = time.perf_counter()
            try:
                return fn(*args, **kwargs)
            finally:
                if self._enabled:
                    self._record(name, (time.perf_counter() - started) * 1000)

        return wrapper

    def _record(self, name: str, value: float) -> None:
        # Only the FIRST occurrence per stage is kept: for a multi-sentence reply
        # the frontend runs once per sentence, and the number that explains TTFA
        # is the first one.
        if name not in self._recorder._marks:  # noqa: SLF001 - single-writer by design
            self._recorder._marks[name] = value  # noqa: SLF001

    def begin(self) -> None:
        self._recorder._marks.clear()  # noqa: SLF001
        self._recorder._order.clear()  # noqa: SLF001
        self.llm_first_token_ms = None
        self.llm_total_ms = None
        self._enabled = True

    def breakdown(self) -> dict:
        self._enabled = False
        stages = {name: round(value, 1) for name, value in self._recorder._marks.items()}  # noqa: SLF001
        if self.llm_first_token_ms is not None:
            stages["llm_first_token"] = self.llm_first_token_ms
        if self.llm_total_ms is not None:
            stages["llm_total"] = self.llm_total_ms
        return stages
