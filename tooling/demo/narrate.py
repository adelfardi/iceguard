# /// script
# requires-python = ">=3.10"
# dependencies = ["kokoro-onnx>=0.4", "soundfile", "numpy"]
# ///
"""Add an AI voice-over (Kokoro TTS, fully local) to docs/demo.mp4.

Reads narration.json (voice + timed segments), synthesises each segment, lays them on one
audio track at their start time, writes subtitles, then muxes everything with ffmpeg:

    out/narration.wav   the voice track
    out/demo-narrated.srt
    out/demo-narrated.mp4

Run with `npm run narrate` (uses uv + the ffmpeg-static binary already installed here).
The Kokoro model files are downloaded once into models/ (see README).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
OUT = HERE / "out"
GAP = 0.25  # minimum silence (s) kept between two segments


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def probe_duration(ffmpeg: str, video: Path) -> float:
    # ffmpeg-static ships without ffprobe: read "Duration: HH:MM:SS.xx" from ffmpeg's banner.
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", str(video)], capture_output=True, text=True).stderr
    for line in err.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    sys.exit(f"Could not read the duration of {video}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ffmpeg", required=True)
    ap.add_argument("--video", default=str(HERE.parent.parent / "docs" / "demo.mp4"))
    ap.add_argument("--script", default=str(HERE / "narration.json"))
    args = ap.parse_args()

    video = Path(args.video)
    cfg = json.loads(Path(args.script).read_text())
    OUT.mkdir(exist_ok=True)

    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    clips, rate = [], None
    for seg in cfg["segments"]:
        audio, rate = kokoro.create(seg["text"], voice=cfg["voice"], speed=cfg["speed"], lang=cfg["lang"])
        clips.append((seg["start"], audio, seg["text"]))

    # Place each clip at its start time; if the previous one runs over, push this one back
    # (and say so, so the script can be tightened) rather than overlapping two voices.
    placed, cursor, overruns = [], 0.0, []
    for start, audio, text in clips:
        at = max(start, cursor + GAP if placed else start)
        if at > start + 0.05:
            overruns.append(f"  +{at - start:.1f}s  {text[:60]}…")
        dur = len(audio) / rate
        placed.append((at, dur, audio, text))
        cursor = at + dur

    video_dur = probe_duration(args.ffmpeg, video)
    total = max(video_dur, cursor) + cfg.get("outroSeconds", 0)
    track = np.zeros(int(total * rate) + 1, dtype=np.float32)
    for at, _dur, audio, _text in placed:
        i = int(at * rate)
        track[i:i + len(audio)] += audio
    sf.write(OUT / "narration.wav", track, rate)

    with open(OUT / "demo-narrated.srt", "w") as srt:
        for n, (at, dur, _audio, text) in enumerate(placed, 1):
            srt.write(f"{n}\n{srt_time(at)} --> {srt_time(at + dur)}\n{text}\n\n")

    # Hold the last frame so the voice (and the outro) can finish past the end of the recording.
    pad = total - video_dur
    subprocess.run([
        args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video), "-i", str(OUT / "narration.wav"),
        "-filter_complex", f"[0:v]tpad=stop_mode=clone:stop_duration={pad:.2f}[v]",
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
        # YouTube-friendly audio: loudness-normalised, 48 kHz stereo.
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        "-t", f"{total:.2f}", str(OUT / "demo-narrated.mp4"),
    ], check=True)

    print(f"video {video_dur:.1f}s -> narrated {total:.1f}s, {len(placed)} segments")
    for at, dur, _a, text in placed:
        print(f"  {at:5.1f}s  {dur:4.1f}s  {text[:70]}")
    if overruns:
        print("Segments pushed back because the previous line ran long (shorten the text):")
        print("\n".join(overruns))
    print(f"Wrote {OUT / 'demo-narrated.mp4'} and {OUT / 'demo-narrated.srt'}")


if __name__ == "__main__":
    main()
