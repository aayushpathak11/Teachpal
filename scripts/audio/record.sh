#!/bin/bash
# Records (or re-records only the changed reels of) one or more chapters, in 3
# parallel shards, then writes each manifest.
#   scripts/audio/record.sh eco11-ch02 [eco11-ch01 ...]
# TTS_PY (default .venv-tts/bin/python) and TTS_MODELS (default .models) point at
# the Kokoro setup described in scripts/audio/README.md.
cd "$(dirname "$0")/../.." || exit 1
PY="${TTS_PY:-.venv-tts/bin/python}"
MODELS="${TTS_MODELS:-.models}"
for id in "$@"; do
  mkdir -p ".work/$id"
  node scripts/audio/prepare.mjs "content/$id.json" > ".work/$id/audio-job.json" || exit 1
  for k in 1 2 3; do "$PY" -I scripts/audio/synth.py ".work/$id/audio-job.json" "content/audio/$id" "$MODELS" --shard "$k/3" & done
  wait
  node scripts/audio/merge.mjs ".work/$id/audio-job.json" "content/audio/$id"
done
