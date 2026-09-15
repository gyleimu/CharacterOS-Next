#!/usr/bin/env python
"""Entry point for the local CharacterOS voice runtime.

    python run.py --port 8181

Paths default to the environment described in docs/voice/README.md and can be
overridden by flags or by the VOICE_* environment variables. The runtime source
lives in the CharacterOS repository; the Python environment, the CosyVoice
checkout and the model weights live outside it.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from pathlib import Path

from voice_runtime.config import DEFAULT_HOST, DEFAULT_PORT, VoiceRuntimeConfig
from voice_runtime.models import RuntimeState
from voice_runtime.server import VoiceRuntimeApp, create_app


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CharacterOS local voice runtime")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--cosyvoice-src", type=Path, default=None, help="CosyVoice checkout")
    parser.add_argument("--tts-model-dir", type=Path, default=None, help="Fun-CosyVoice3 model directory")
    parser.add_argument("--voices-file", type=Path, default=None, help="voice registry JSON path")
    parser.add_argument("--tts-device", default=None, help="auto | cuda:0 | cpu (TTS)")
    parser.add_argument("--asr-device", default=None, help="auto | cuda:0 | cpu (ASR; cpu by default)")
    parser.add_argument("--fp16", dest="fp16", action="store_true", default=None)
    parser.add_argument("--no-fp16", dest="fp16", action="store_false")
    parser.add_argument("--preload", dest="preload", action="store_true", default=None)
    parser.add_argument("--no-preload", dest="preload", action="store_false")
    parser.add_argument("--warmup", dest="warmup", action="store_true", default=None)
    parser.add_argument("--no-warmup", dest="warmup", action="store_false")
    parser.add_argument(
        "--check",
        action="store_true",
        help="load the models, print the resolved status as JSON, and exit",
    )
    return parser.parse_args(argv)


def build_config(args: argparse.Namespace) -> VoiceRuntimeConfig:
    config = VoiceRuntimeConfig()
    config.host = args.host
    config.port = args.port
    if args.cosyvoice_src is not None:
        config.cosyvoice_src = args.cosyvoice_src
    if args.tts_model_dir is not None:
        config.tts_model_dir = args.tts_model_dir
    if args.voices_file is not None:
        config.voices_file = args.voices_file
    if args.tts_device is not None:
        config.tts_device = args.tts_device
    if args.asr_device is not None:
        config.asr_device = args.asr_device
    if args.fp16 is not None:
        config.fp16 = args.fp16
    if args.preload is not None:
        config.preload = args.preload
    if args.warmup is not None:
        config.warmup = args.warmup
    return config


def status_payload(manager) -> dict:
    return {
        "state": manager.state().value,
        "device": manager.tts_device,
        "asr_device": manager.asr_device,
        "asr": manager.asr_status.as_dict(),
        "tts": manager.tts_status.as_dict(),
        "vram": manager.vram(),
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = build_config(args)
    state = VoiceRuntimeApp(config)
    manager = state.manager

    if args.check:
        started = time.perf_counter()
        print(
            f"voice runtime: loading models (tts={manager.tts_device}, asr={manager.asr_device}, "
            f"fp16={config.fp16})",
            flush=True,
        )
        result = manager.preload()
        print(
            f"voice runtime: state={result.value} startup_ms={round((time.perf_counter() - started) * 1000, 1)}",
            flush=True,
        )
        print(json.dumps(status_payload(manager), ensure_ascii=False, indent=2))
        return 0 if result is not RuntimeState.FAILED else 1

    app = create_app(config, state)

    if config.preload:
        # Load in the background so the HTTP surface is up immediately and
        # /health can report LOADING -> READY. CharacterOS polls that instead of
        # guessing from connection failures.
        def load() -> None:
            started = time.perf_counter()
            result = manager.preload()
            print(
                f"voice runtime: state={result.value} "
                f"asr_load_ms={manager.asr_status.load_ms} tts_load_ms={manager.tts_status.load_ms} "
                f"startup_ms={round((time.perf_counter() - started) * 1000, 1)}",
                flush=True,
            )
            if result is RuntimeState.FAILED:
                print(
                    "voice runtime: both models failed to load; /health still answers. "
                    "CharacterOS clients degrade to text.",
                    flush=True,
                )

        threading.Thread(target=load, name="voice-preload", daemon=True).start()

    import uvicorn

    print(f"voice runtime: listening on http://{config.host}:{config.port}", flush=True)
    uvicorn.run(app, host=config.host, port=config.port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
