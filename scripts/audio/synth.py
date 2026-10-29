"""Records a chapter's narration with Kokoro (open-source, runs locally).

  python synth.py <audio-job.json> <out-dir> <models-dir> <voice> [speed]

<voice> is a Kokoro voice name (e.g. hf_alpha) or a blend "a:0.6+b:0.4".
Writes one MP3 per reel plus manifest.json with each segment's start/end and
sentence start times, so the app can play a scene and highlight its captions.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

job_path, out_dir, models, voice_spec = sys.argv[1:5]
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
job = json.load(open(job_path))
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))

def style(spec):
    if "+" not in spec and ":" not in spec:
        return spec
    total = 0
    for part in spec.split("+"):
        name, w = part.split(":")
        total = total + float(w) * k.get_voice_style(name)
    return total

voice = style(voice_spec)
lang = "en-gb" if any(x in voice_spec for x in ("bf_", "bm_")) else "en-us"
SENT_GAP, SEG_GAP = 0.3, 0.6
os.makedirs(out_dir, exist_ok=True)
manifest = {"voice": voice_spec, "speed": speed, "reels": {}}

for n, reel in enumerate(job["reels"], 1):
    chunks, t, segs, sr = [], 0.0, {}, 24000
    for seg in reel["segments"]:
        start, sents = t, []
        for sentence in seg["sentences"]:
            audio, sr = k.create(sentence, voice=voice, speed=speed, lang=lang)
            sents.append(round(t, 3))
            chunks += [audio, np.zeros(int(SENT_GAP * sr), dtype=audio.dtype)]
            t += len(audio) / sr + SENT_GAP
        segs[seg["key"]] = {"h": seg["hash"], "start": round(start, 3), "end": round(t - SENT_GAP + 0.15, 3), "sents": sents}
        chunks.append(np.zeros(int(SEG_GAP * sr), dtype=chunks[-1].dtype))
        t += SEG_GAP
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, np.concatenate(chunks), sr)
    mp3 = f"{reel['id']}.mp3"
    # Constant bitrate keeps seeking to a scene's start time exact in every browser.
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", os.path.join(out_dir, mp3)], check=True)
    os.unlink(tmp.name)
    manifest["reels"][reel["id"]] = {"file": mp3, "segments": segs}
    print(f"[{n}/{len(job['reels'])}] {reel['id']}: {t:.0f}s", flush=True)

json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
print("done")
