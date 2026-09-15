#!/usr/bin/env python3
"""Run the billed nRouter endpoint canaries and write a CSV report."""

from __future__ import annotations

import argparse
import csv
import io
import os
import sys
import wave
from pathlib import Path
from typing import Callable


ENDPOINTS = (
    ("GET", "/v1/models"),
    ("POST", "/v1/messages"),
    ("POST", "/v1/chat/completions"),
    ("POST", "/v1/responses"),
    ("POST", "/v1/embeddings"),
    ("POST", "/v1/images/generations"),
    ("POST", "/v1/audio/speech"),
    ("POST", "/v1/audio/transcriptions"),
    ("POST", "/v1/audio/translations"),
    ("POST", "/v1/videos"),
)


def required(name: str, default: str | None = None) -> str:
    value = os.getenv(name) or default
    if not value:
        raise RuntimeError(f"{name} is required for the live endpoint matrix")
    return value


def silent_wav() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8_000)
        audio.writeframes(b"\x00\x00" * 8_000)
    return output.getvalue()


def run(output: Path) -> int:
    from nroutersdk import nRouter

    key = required("NROUTER_API_KEY")
    base_url = required("NROUTER_BASE_URL", "https://api.nrouter.ai/v1")
    models = {
        "messages": required("NROUTER_LIVE_MESSAGES_MODEL", "claude-haiku-4-5-20251001"),
        "chat": required("NROUTER_LIVE_CHAT_MODEL", "gpt-4.1-mini"),
        "responses": required("NROUTER_LIVE_RESPONSES_MODEL", "gpt-4.1-mini"),
        "embeddings": required("NROUTER_LIVE_EMBEDDINGS_MODEL", "text-embedding-3-small"),
        "images": required("NROUTER_LIVE_IMAGE_MODEL", "gpt-image-1-mini"),
        "speech": required("NROUTER_LIVE_SPEECH_MODEL", "tts-1"),
        "transcription": required("NROUTER_LIVE_TRANSCRIPTION_MODEL", "whisper-1"),
        "translation": required("NROUTER_LIVE_TRANSLATION_MODEL", "whisper-1"),
        "video": required("NROUTER_LIVE_VIDEO_MODEL", "sora-2"),
    }
    audio = silent_wav()

    rows: list[dict[str, str]] = []
    with nRouter(api_key=key, base_url=base_url) as client:
        probes: list[tuple[str, str, str, Callable[[], object]]] = [
            ("GET", "/v1/models", "", lambda: client.nrouter_models.list()),
            (
                "POST",
                "/v1/messages",
                models["messages"],
                lambda: client.messages.create(
                    model=models["messages"],
                    max_tokens=2,
                    messages=[{"role": "user", "content": "Reply OK"}],
                ),
            ),
            (
                "POST",
                "/v1/chat/completions",
                models["chat"],
                lambda: client.chat.completions.create(
                    model=models["chat"],
                    max_tokens=2,
                    messages=[{"role": "user", "content": "Reply OK"}],
                ),
            ),
            (
                "POST",
                "/v1/responses",
                models["responses"],
                lambda: client.responses.create(
                    model=models["responses"], input="Reply OK", max_output_tokens=16
                ),
            ),
            (
                "POST",
                "/v1/embeddings",
                models["embeddings"],
                lambda: client.embeddings.create(model=models["embeddings"], input="nRouter"),
            ),
            (
                "POST",
                "/v1/images/generations",
                models["images"],
                lambda: client.images.generate(
                    model=models["images"], prompt="A small blue circle on white", size="1024x1024"
                ),
            ),
            (
                "POST",
                "/v1/audio/speech",
                models["speech"],
                lambda: client.audio.speech.create(
                    model=models["speech"], voice="alloy", input="OK"
                ),
            ),
            (
                "POST",
                "/v1/audio/transcriptions",
                models["transcription"],
                lambda: client.audio.transcriptions.create(
                    model=models["transcription"], file=("silence.wav", audio, "audio/wav")
                ),
            ),
            (
                "POST",
                "/v1/audio/translations",
                models["translation"],
                lambda: client.audio.translations.create(
                    model=models["translation"], file=("silence.wav", audio, "audio/wav")
                ),
            ),
            (
                "POST",
                "/v1/videos",
                models["video"],
                lambda: client.videos.create(
                    model=models["video"], prompt="A blue circle on a white background"
                ),
            ),
        ]

        for method, endpoint, model, probe in probes:
            try:
                client.last_response = None
                probe()
                meta = client.last_response
                request_id = meta.request_id if meta else None
                if not request_id:
                    raise AssertionError("response did not include x-nr-request-id")
                rows.append(
                    {
                        "method": method,
                        "endpoint": endpoint,
                        "model": model,
                        "status": "success",
                        "request_id_present": "true",
                        "error": "",
                    }
                )
            except Exception as exc:  # continue so the report shows every endpoint
                rows.append(
                    {
                        "method": method,
                        "endpoint": endpoint,
                        "model": model,
                        "status": "failure",
                        "request_id_present": "false",
                        "error": str(exc).replace("\n", " ")[:500],
                    }
                )

    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "method",
                "endpoint",
                "model",
                "status",
                "request_id_present",
                "error",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    return int(any(row["status"] != "success" for row in rows))


def self_test() -> int:
    assert len(ENDPOINTS) == 10
    assert len(set(ENDPOINTS)) == len(ENDPOINTS)
    assert silent_wav().startswith(b"RIFF")
    print("OK: 10 endpoint probes and valid WAV fixture")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("sdk-sentinel-endpoints.csv"))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    return self_test() if args.self_test else run(args.output)


if __name__ == "__main__":
    sys.exit(main())
