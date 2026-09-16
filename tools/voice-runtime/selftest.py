"""Self-tests for the voice runtime's pure logic.

Covers the parts that need neither a GPU nor an audio device, so they can run
anywhere:

  - the VAD threshold is DERIVED from the measured noise floor rather than
    hardcoded, and the absolute floor still wins in a silent room
  - the reference-conditioning cache returns CLONES (the caller mutates tensors
    in place) and invalidates when the reference file changes
  - the latency recorder reports only stages it actually observed

Run:  python selftest.py
"""

from __future__ import annotations

import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch  # noqa: E402

from voice_runtime.audio import VadConfig, threshold_for  # noqa: E402
from voice_runtime.perf import (  # noqa: E402
    LatencyRecorder,
    ReferenceConditioningCache,
    summarise,
)

failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if condition:
        print(f"  ok   {message}")
    else:
        print(f"  FAIL {message}")
        failures.append(message)


class FakeFrontend:
    """Counts how often each extraction actually runs."""

    def __init__(self) -> None:
        self.counts = {"_extract_speech_token": 0, "_extract_spk_embedding": 0, "_extract_speech_feat": 0}

    def _make(self, name: str, size: int):
        def method(prompt_wav):
            self.counts[name] += 1
            # Mirrors the real signature: a tensor plus a length tensor.
            return torch.arange(size, dtype=torch.float32), torch.tensor([size], dtype=torch.int32)

        return method

    def _extract_speech_token(self, prompt_wav):
        return self._make("_extract_speech_token", 4)(prompt_wav)

    def _extract_spk_embedding(self, prompt_wav):
        return self._make("_extract_spk_embedding", 5)(prompt_wav)

    def _extract_speech_feat(self, prompt_wav):
        return self._make("_extract_speech_feat", 6)(prompt_wav)


def test_vad_threshold() -> None:
    print("VAD threshold")
    quiet = threshold_for(10.0)
    boxy = threshold_for(120.0)
    check(quiet == VadConfig().absolute_floor, "a silent room falls back to the absolute floor")
    check(boxy > quiet, "a louder room produces a higher threshold")
    check(boxy == 120.0 * VadConfig().margin_factor, "threshold = noise floor * margin")
    # A different margin must produce a different threshold: nothing is hardcoded.
    stricter = threshold_for(120.0, VadConfig(margin_factor=8.0))
    check(stricter > boxy, "raising the margin raises the threshold")
    check(VadConfig().min_speech_ms > 0, "onset requires sustained energy, not a single loud block")


def test_reference_cache() -> None:
    print("reference conditioning cache")
    with tempfile.TemporaryDirectory() as folder:
        reference = os.path.join(folder, "reference.wav")
        with open(reference, "wb") as handle:
            handle.write(b"reference-bytes")

        frontend = FakeFrontend()
        cache = ReferenceConditioningCache(frontend).install()

        first = frontend._extract_speech_token(reference)
        second = frontend._extract_speech_token(reference)
        check(frontend.counts["_extract_speech_token"] == 1, "the second call does not re-encode")
        check(bool(torch.equal(first[0], second[0])), "the cached value is returned intact")

        # The real frontend mutates the tensors it is given in place, so a hit
        # must be a clone or the cache would be corrupted.
        first[0][0] = 999.0
        third = frontend._extract_speech_token(reference)
        check(float(third[0][0]) != 999.0, "a caller's in-place mutation cannot corrupt the cache")

        stats = cache.stats()
        check(stats["hits"] >= 2 and stats["misses"] == 1, f"hit/miss accounting is correct ({stats})")

        # Replacing the recording must invalidate the entry.
        time.sleep(0.01)
        with open(reference, "wb") as handle:
            handle.write(b"different-reference-bytes")
        frontend._extract_speech_token(reference)
        check(
            frontend.counts["_extract_speech_token"] == 2,
            "changing the reference file invalidates the cached conditioning",
        )

        for name in ("_extract_spk_embedding", "_extract_speech_feat"):
            getattr(frontend, name)(reference)
            getattr(frontend, name)(reference)
            check(frontend.counts[name] == 1, f"{name} is memoized too")


def test_latency_recorder() -> None:
    print("latency recorder")
    recorder = LatencyRecorder()
    recorder.start()
    recorder.begin("frontend")
    time.sleep(0.01)
    recorder.end("frontend")
    recorder.mark("first_chunk")
    breakdown = recorder.breakdown()
    check("frontend" in breakdown and "frontend:duration" in breakdown, "a completed stage is reported")
    check(breakdown["first_chunk"] >= breakdown.get("frontend", 0), "marks are monotonic within a request")
    check("llm" not in breakdown, "a stage that never ran is absent, not estimated")

    empty = summarise([])
    check(empty["n"] == 0 and empty["median_ms"] is None, "an empty sample stays honest instead of reporting 0")
    sample = summarise([10.0, 20.0, 30.0, 40.0, 50.0])
    check(sample["median_ms"] == 30.0 and sample["p95_ms"] == 50.0, f"median/p95 are correct ({sample})")


def main() -> int:
    test_vad_threshold()
    test_reference_cache()
    test_latency_recorder()
    print()
    if failures:
        print(f"{len(failures)} FAILED")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("all self-tests passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
