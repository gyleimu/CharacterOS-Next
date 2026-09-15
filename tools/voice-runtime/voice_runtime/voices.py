"""Voice identity registry.

A voice is an EXTERNAL ASSET, not CharacterOS state. CharacterOS only ever
learns a `voice_id`; the reference recording and its transcript stay here on the
runtime side, are never committed, and are never written into canonical subject
state.

Only audio the operator has the right to use may be registered. The runtime
never downloads a voice and never imitates a public figure.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_VOICE_ID = "characteros-default"


class VoiceRegistryError(Exception):
    """Raised for an unknown voice id or an unusable reference recording."""


@dataclass
class VoiceProfile:
    voice_id: str
    display_name: str
    kind: str  # "default" | "zero_shot"
    reference_wav: str | None
    reference_text: str | None
    metadata: dict = field(default_factory=dict)

    def public_view(self) -> dict:
        """The wire shape. The reference path never leaves the runtime."""
        return {
            "schema_version": "voice-profile-v0",
            "voice_id": self.voice_id,
            "display_name": self.display_name,
            "kind": self.kind,
            # Opaque handle: enough for a client to refer to the reference
            # audio, never enough to locate it on disk.
            "reference_handle": None if self.reference_wav is None else f"voice-ref:{self.voice_id}",
        }


class VoiceRegistry:
    """File-backed voice registry with a bundled default voice."""

    def __init__(self, path: Path, default_reference_wav: Path, default_reference_text: str) -> None:
        self.path = path
        self._default_reference_wav = default_reference_wav
        self._default_reference_text = default_reference_text
        self._voices: dict[str, VoiceProfile] = {}
        self._load()

    # -- persistence -------------------------------------------------------------
    def _load(self) -> None:
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                raw = {}
            for entry in raw.get("voices", []):
                try:
                    profile = VoiceProfile(**entry)
                except TypeError:
                    continue
                self._voices[profile.voice_id] = profile
        if DEFAULT_VOICE_ID not in self._voices:
            self._voices[DEFAULT_VOICE_ID] = VoiceProfile(
                voice_id=DEFAULT_VOICE_ID,
                display_name="CharacterOS default",
                kind="default",
                reference_wav=str(self._default_reference_wav),
                reference_text=self._default_reference_text,
                metadata={"note": "bundled CosyVoice demo prompt; replace with your own licensed audio"},
            )
            self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"voices": [asdict(v) for v in self._voices.values()]}
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # -- queries -----------------------------------------------------------------
    def list(self) -> list[VoiceProfile]:
        return [self._voices[k] for k in sorted(self._voices)]

    def get(self, voice_id: str) -> VoiceProfile:
        profile = self._voices.get(voice_id)
        if profile is None:
            raise VoiceRegistryError(f"unknown voice_id {voice_id!r}")
        if profile.reference_wav is None:
            raise VoiceRegistryError(f"voice {voice_id!r} has no reference audio")
        if not Path(profile.reference_wav).exists():
            raise VoiceRegistryError(
                f"voice {voice_id!r} reference audio is missing: {profile.reference_wav}"
            )
        # `reference_text` is optional: the runtime synthesizes through
        # CosyVoice's instruct path, which takes delivery directives rather than
        # the reference transcript. It is kept as documentation of the reference
        # clip and for a future zero-shot path.
        return profile

    def resolve(self, voice_id: str | None) -> VoiceProfile:
        return self.get(voice_id or DEFAULT_VOICE_ID)

    # -- mutation ----------------------------------------------------------------
    def register(
        self,
        voice_id: str,
        display_name: str,
        reference_wav: Path,
        reference_text: str,
        kind: str = "zero_shot",
    ) -> VoiceProfile:
        if not voice_id or voice_id == DEFAULT_VOICE_ID:
            raise VoiceRegistryError("voice_id must be non-empty and may not shadow the default voice")
        if not reference_wav.exists():
            raise VoiceRegistryError(f"reference audio not found: {reference_wav}")
        if not reference_text.strip():
            raise VoiceRegistryError("reference transcript must not be empty")
        profile = VoiceProfile(
            voice_id=voice_id,
            display_name=display_name or voice_id,
            kind=kind,
            reference_wav=str(reference_wav),
            reference_text=reference_text,
        )
        self._voices[voice_id] = profile
        self._save()
        return profile
