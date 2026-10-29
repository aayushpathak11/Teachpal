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
.venv-tts/bin/python -I scripts/audio/synth.py .work/<id>/audio-job.json content/audio/<id> .models "$(node -p "require('./docs/voice.json').voice")"
```
Then set `"audio": "audio/<id>/manifest.json"` on the chapter's entry in `content/index.json`. Recording runs at about 3× real time on a CPU (a 17-reel chapter takes about 9 minutes) and produces about 8 MB of MP3.

- The voice is set in `docs/voice.json` (a Kokoro voice name, or a blend such as `hf_alpha:0.6+bf_emma:0.4`). It's the user's choice; don't change it without asking.
- Mispronounced words: add a respelling to `docs/pronunciations.json` and re-record that chapter.
- After editing a reel's narration, re-record the chapter. Until then, the app uses the device voice for the changed scenes only.
