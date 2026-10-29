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
scripts/audio/record.sh <id>          # prepare → 3 parallel shards → manifest; only changed reels are re-recorded
```
(Set `TTS_PY` and `TTS_MODELS` if the venv or models live elsewhere. When you stop a recording run, match `synth[.]py`; a pattern like `tts/bin/python` also matches your own shell command and kills it.)
Then set `"audio": "audio/<id>/manifest.json"` on the chapter's entry in `content/index.json`. Recording runs at a few times real time on a 4-CPU machine; a 17-reel chapter takes roughly 15-25 minutes with 3 shards and produces about 8 MB of MP3. An interrupted run resumes: reels already recorded with the same voice and text are skipped.

- **Voices:** every reel gets a randomly assigned voice from `docs/voice.json`. The user liked all 9 voices and wants variety, so the feed never sounds monotonous. The assignment is seeded by the chapter id, so it's stable across re-runs; all voices are used before any repeats, and neighbouring reels never share a voice. Change the list only when the user asks.
- Mispronounced words: add a respelling to `docs/pronunciations.json` and re-record. Only the affected reels change, since unchanged ones are skipped.
- After editing a reel's narration, re-record the chapter. Until then, the app uses the device voice for the changed scenes only.
