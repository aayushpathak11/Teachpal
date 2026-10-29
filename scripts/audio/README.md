# Recorded narration (Kokoro)

Narration is recorded with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), an open-source (Apache-2.0) neural voice that runs locally, so no account or API key is needed. The app plays the recordings and falls back to the device voice for any scene whose text changed after recording.

## Setup (once per machine or session)
```bash
python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro-onnx soundfile
mkdir -p .models && for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  curl -sSL -o .models/$f https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f; done
```
ffmpeg must be installed.

## Record a chapter
```bash
node scripts/audio/prepare.mjs content/<id>.json > .work/<id>/audio-job.json
for k in 1 2 3; do .venv-tts/bin/python -I scripts/audio/synth.py .work/<id>/audio-job.json content/audio/<id> .models --shard $k/3 & done; wait
node scripts/audio/merge.mjs .work/<id>/audio-job.json content/audio/<id>
```
Then set `"audio": "audio/<id>/manifest.json"` on the chapter's entry in `content/index.json`. Recording runs at a few times real time on a 4-CPU machine; a 17-reel chapter takes roughly 15-25 minutes with 3 shards and produces about 8 MB of MP3. An interrupted run resumes: reels already recorded with the same voice and text are skipped.

- **Voices:** every reel gets a randomly assigned voice from `docs/voice.json`. The user liked all 9 voices and wants variety, so the feed never sounds monotonous. The assignment is seeded by the chapter id, so it's stable across re-runs; all voices are used before any repeats, and neighbouring reels never share a voice. Change the list only when the user asks.
- Mispronounced words: add a respelling to `docs/pronunciations.json` and re-record. Only the affected reels change, since unchanged ones are skipped.
- After editing a reel's narration, re-record the chapter. Until then, the app uses the device voice for the changed scenes only.
