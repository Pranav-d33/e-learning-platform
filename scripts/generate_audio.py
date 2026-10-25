"""Generates the bundled Early Learning audio clips with Microsoft Edge neural TTS.

Usage: npm run assets:audio   (needs `pip install edge-tts` and network access)

Clips are prototype placeholders. Before production, replace them with recordings
reviewed by a teacher — especially the Hindi set.
"""

import asyncio
import json
import pathlib
import re
import sys

import edge_tts

VOICES = {"en": "en-IN-NeerjaNeural", "hi": "hi-IN-SwaraNeural"}
RATE = "-12%"

# TTS reads a lone capital letter inconsistently ("A" can come out as "uh"),
# so English letter names are spoken from their spelled-out names (Indian English).
EN_LETTER_NAMES = {
    "a": "ay", "b": "bee", "c": "see", "d": "dee", "e": "ee", "f": "ef", "g": "jee",
    "h": "aitch", "i": "eye", "j": "jay", "k": "kay", "l": "el", "m": "em", "n": "en",
    "o": "oh", "p": "pee", "q": "cue", "r": "ar", "s": "es", "t": "tee", "u": "you",
    "v": "vee", "w": "double you", "x": "ex", "y": "why", "z": "zed",
}

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"


def spoken_text(clip):
    match = re.match(r"^/audio/en/name-([a-z])\.mp3$", clip["path"])
    if match:
        return EN_LETTER_NAMES[match.group(1)] + "."
    return clip["text"]


async def render(clip, sem, force):
    out = ROOT / clip["path"].lstrip("/")
    if out.exists() and not force:
        return "skip"
    out.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(3):
            try:
                tts = edge_tts.Communicate(spoken_text(clip), VOICES[clip["lang"]], rate=RATE)
                await tts.save(str(out))
                return "ok"
            except Exception as exc:  # network hiccups: retry, then report
                if attempt == 2:
                    print(f"FAILED {clip['path']}: {exc}", file=sys.stderr)
                    return "fail"
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    manifest = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    force = "--force" in sys.argv
    sem = asyncio.Semaphore(6)
    results = await asyncio.gather(*(render(c, sem, force) for c in manifest))
    print({k: results.count(k) for k in ("ok", "skip", "fail")})
    if "fail" in results:
        sys.exit(1)


asyncio.run(main())
