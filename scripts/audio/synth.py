"""Records a chapter's narration with Kokoro (open-source, runs locally).

  python synth.py <audio-job.json> <out-dir> <models-dir> [--shard K/N] [--speed 1.0]

Each reel is spoken in the voice the job assigns it (a Kokoro voice name or a
blend like "a:0.6+b:0.4"). Writes <reel>.mp3 and <reel>.json (segment start/end
and sentence start times) per reel. A reel whose existing recording already
matches its voice and text is skipped, so an interrupted run can resume. Run
several shards in parallel, then merge.py to write manifest.json.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

args = sys.argv[1:]
job_path, out_dir, models = args[:3]
shard, nshards = (int(x) for x in (args[args.index("--shard") + 1].split("/") if "--shard" in args else ("1", "1")))
speed = float(args[args.index("--speed") + 1]) if "--speed" in args else 1.0

job = json.load(open(job_path))
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))

def style(spec):
    if "+" not in spec and ":" not in spec:
        return spec
    return sum(float(w) * k.get_voice_style(name) for name, w in (p.split(":") for p in spec.split("+")))

SENT_GAP, SEG_GAP = 0.3, 0.6
os.makedirs(out_dir, exist_ok=True)
mine = [r for i, r in enumerate(job["reels"]) if i % nshards == shard - 1]

for n, reel in enumerate(mine, 1):
    meta_path = os.path.join(out_dir, f"{reel['id']}.json")
    want = {s["key"]: s["hash"] for s in reel["segments"]}
    if os.path.exists(meta_path) and os.path.exists(os.path.join(out_dir, f"{reel['id']}.mp3")):
        old = json.load(open(meta_path))
        if old.get("voice") == reel["voice"] and old.get("speed") == speed and {k2: v["h"] for k2, v in old["segments"].items()} == want:
            print(f"[{shard}/{nshards}] {n}/{len(mine)} {reel['id']}: up to date", flush=True)
            continue
    voice = style(reel["voice"])
    lang = "en-gb" if reel["voice"].split(":")[0].startswith(("bf_", "bm_")) else "en-us"
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
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", os.path.join(out_dir, mp3 + ".tmp.mp3")], check=True)
    os.replace(os.path.join(out_dir, mp3 + ".tmp.mp3"), os.path.join(out_dir, mp3))
    os.unlink(tmp.name)
    json.dump({"file": mp3, "voice": reel["voice"], "speed": speed, "segments": segs}, open(meta_path, "w"), indent=1)
    print(f"[{shard}/{nshards}] {n}/{len(mine)} {reel['id']}: {t:.0f}s ({reel['voice']})", flush=True)
print(f"[{shard}/{nshards}] done", flush=True)
