"""Benchmark the local voice runtime with real measurements.

Measures, separately and without mixing them:

  startup   process start -> READY (plus per-model load times reported by /health)
  cold TTS  the very first synthesis after load (excluded from warm statistics)
  warm TTS  n repeated syntheses of one short sentence
  streaming n repeated streamed syntheses, recording time-to-first-audio
  ASR       n repeated transcriptions of one fixed WAV

Usage
    python benchmark.py --launch --n 10 --out results.json

`--launch` starts run.py as a child process and measures startup itself; without
it the script benchmarks an already-running service. Every number printed here
is measured on this machine — nothing is estimated.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path

import requests

TEXT = "你好，我是 CharacterOS。"
NEUTRAL_INSTRUCT = "You are a helpful assistant. <|endofprompt|>"
DEFAULT_URL = "http://127.0.0.1:8181"


def percentile(values: list[float], p: float) -> float:
    """Nearest-rank percentile; exact for the small samples used here."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, int(round((p / 100.0) * len(ordered) + 0.5)) - 1))
    return ordered[rank]


def gpu_memory_mb() -> tuple[float, float] | None:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.free", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        ).stdout.strip()
        used, free = (float(x) for x in out.split(","))
        return used, free
    except Exception:  # noqa: BLE001
        return None


def wait_ready(url: str, timeout_s: float = 600.0) -> tuple[str, float]:
    """Polls /health until the runtime leaves LOADING. Returns (state, seconds)."""
    started = time.perf_counter()
    while time.perf_counter() - started < timeout_s:
        try:
            health = requests.get(f"{url}/health", timeout=10).json()
        except Exception:  # noqa: BLE001 - not up yet
            time.sleep(0.5)
            continue
        if health.get("state") != "LOADING":
            return health.get("state", "UNKNOWN"), time.perf_counter() - started
        time.sleep(1.0)
    return "TIMEOUT", time.perf_counter() - started


def summarize(label: str, latencies: list[float]) -> dict:
    return {
        "label": label,
        "n": len(latencies),
        "median_ms": round(statistics.median(latencies), 1),
        "p95_ms": round(percentile(latencies, 95), 1),
        "min_ms": round(min(latencies), 1),
        "max_ms": round(max(latencies), 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--n", type=int, default=10)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--launch", action="store_true", help="start the runtime as a child process")
    parser.add_argument("--cosyvoice-src", type=Path, default=None)
    parser.add_argument("--tts-model-dir", type=Path, default=None)
    parser.add_argument("--voices-file", type=Path, default=None)
    parser.add_argument("--sample-wav", type=Path, default=None, help="WAV used for the ASR benchmark")
    args = parser.parse_args()

    results: dict = {"n": args.n, "text": TEXT}
    results["vram_idle_mb"] = gpu_memory_mb()
    child: subprocess.Popen | None = None

    if args.launch:
        here = Path(__file__).resolve().parent
        cmd = [sys.executable, str(here / "run.py"), "--port", str(args.url.rsplit(":", 1)[-1])]
        if args.cosyvoice_src:
            cmd += ["--cosyvoice-src", str(args.cosyvoice_src)]
        if args.tts_model_dir:
            cmd += ["--tts-model-dir", str(args.tts_model_dir)]
        if args.voices_file:
            cmd += ["--voices-file", str(args.voices_file)]
        child = subprocess.Popen(cmd, cwd=str(here))
        print(f"launched: {' '.join(cmd)}", flush=True)

    try:
        state, startup_s = wait_ready(args.url)
        health = requests.get(f"{args.url}/health", timeout=30).json()
        results["startup"] = {
            "state": state,
            "process_to_ready_s": round(startup_s, 2),
            "asr_load_ms": health["asr"]["load_ms"],
            "tts_load_ms": health["tts"]["load_ms"],
            "asr_device": health["asr"]["device"],
            "tts_device": health["tts"]["device"],
            "fp16": health["fp16"],
            "uptime_ms_at_ready": health["uptime_ms"],
        }
        print(f"READY state={state} in {startup_s:.1f}s (asr {health['asr']['load_ms']}ms, "
              f"tts {health['tts']['load_ms']}ms)", flush=True)
        results["vram_loaded_mb"] = gpu_memory_mb()

        # ---- cold TTS (first synthesis; kept out of the warm statistics) -------
        t0 = time.perf_counter()
        cold = requests.post(
            f"{args.url}/tts",
            json={"text": TEXT, "instruct": NEUTRAL_INSTRUCT},
            timeout=600,
        ).json()
        results["cold_tts"] = {
            "total_ms": round((time.perf_counter() - t0) * 1000, 1),
            "reported_total_ms": cold.get("total_ms"),
            "audio_ms": cold.get("audio_ms"),
            "rtf": cold.get("rtf"),
        }
        print(f"cold TTS: {results['cold_tts']}", flush=True)

        # ---- warm TTS ---------------------------------------------------------
        warm: list[float] = []
        rtf_samples: list[float] = []
        peak_used = 0.0
        for i in range(args.n):
            t0 = time.perf_counter()
            body = requests.post(
                f"{args.url}/tts", json={"text": TEXT, "instruct": NEUTRAL_INSTRUCT}, timeout=600
            ).json()
            warm.append((time.perf_counter() - t0) * 1000)
            if body.get("rtf"):
                rtf_samples.append(body["rtf"])
            mem = gpu_memory_mb()
            if mem:
                peak_used = max(peak_used, mem[0])
            print(f"  warm[{i}] {round(warm[-1],1)}ms audio={body.get('audio_ms')}ms rtf={body.get('rtf')}",
                  flush=True)
        results["warm_tts"] = summarize("warm_tts", warm)
        results["warm_tts"]["rtf_median"] = round(statistics.median(rtf_samples), 3) if rtf_samples else None
        results["warm_tts"]["audio_ms"] = body.get("audio_ms")

        # ---- streaming --------------------------------------------------------
        ttfa: list[float] = []
        stream_total: list[float] = []
        first_chunk_ms: list[float] = []
        for i in range(args.n):
            t0 = time.perf_counter()
            first = None
            first_len = 0
            with requests.post(
                f"{args.url}/tts/stream",
                json={"text": TEXT, "instruct": NEUTRAL_INSTRUCT},
                stream=True,
                timeout=600,
            ) as resp:
                for chunk in resp.iter_content(chunk_size=None):
                    if not chunk:
                        continue
                    if first is None:
                        first = (time.perf_counter() - t0) * 1000
                        first_len = len(chunk)
            ttfa.append(first if first is not None else float("nan"))
            stream_total.append((time.perf_counter() - t0) * 1000)
            first_chunk_ms.append(first_len / 2 / 24000 * 1000)
            print(f"  stream[{i}] ttfa={round(ttfa[-1],1)}ms total={round(stream_total[-1],1)}ms "
                  f"first_chunk_audio={round(first_chunk_ms[-1],1)}ms", flush=True)
        results["streaming"] = summarize("streaming_ttfa", ttfa)
        results["streaming"]["total"] = summarize("streaming_total", stream_total)
        results["streaming"]["first_chunk_audio_ms_median"] = round(statistics.median(first_chunk_ms), 1)
        results["streaming"]["final_rtf_median"] = round(
            statistics.median([t / 1000 / (body.get("audio_ms", 1) / 1000) for t in stream_total]), 3
        )

        # ---- ASR --------------------------------------------------------------
        sample = args.sample_wav
        if sample is None:
            sample = Path(os.environ.get("VOICE_BENCH_WAV", "")) if os.environ.get("VOICE_BENCH_WAV") else None
        if sample is None or not sample.exists():
            # Fall back to a WAV produced by this run so the ASR numbers are real.
            sample = Path(__file__).resolve().parent.parent.parent / "out" / "bench-asr.wav"
            requests.post(
                f"{args.url}/tts",
                json={"text": TEXT, "instruct": NEUTRAL_INSTRUCT, "save_path": str(sample)},
                timeout=600,
            )
        raw = sample.read_bytes()
        asr_latencies: list[float] = []
        for i in range(args.n):
            t0 = time.perf_counter()
            body = requests.post(
                f"{args.url}/asr",
                json={"audio_base64": base64.b64encode(raw).decode("ascii")},
                timeout=300,
            ).json()
            asr_latencies.append((time.perf_counter() - t0) * 1000)
            print(f"  asr[{i}] {round(asr_latencies[-1],1)}ms text={body.get('text')!r}", flush=True)
        results["asr"] = summarize("asr", asr_latencies)
        results["asr"]["sample_wav"] = str(sample)
        results["asr"]["transcript"] = body.get("text")

        results["vram_peak_observed_mb"] = peak_used or None
        results["vram_final_mb"] = gpu_memory_mb()
    finally:
        if child is not None:
            child.terminate()
            try:
                child.wait(timeout=20)
            except subprocess.TimeoutExpired:
                child.kill()

    print(json.dumps(results, ensure_ascii=False, indent=2))
    if args.out:
        args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"written: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
