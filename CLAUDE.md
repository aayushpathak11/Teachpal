# TeachPal

Study app: NCERT chapters → narrated reels, quizzes and spaced-repetition recall (RBI Grade B prep).

- **When the user sends a chapter PDF, follow `.claude/skills/add-chapter/SKILL.md` step by step**: plan, write, lint, independent review, web fact-check, revise, report, publish.
- **Content rules learned so far: `docs/content-guidelines.md`.** Read them before writing or reviewing any reel, and add every new lesson (from reviews or the user's feedback) there, so the next chapter benefits.
- Live app and how it's hosted: `HOSTING.md`.
- Narration: every chapter is recorded with the open-source Kokoro voice (`scripts/audio/README.md`; voice in `docs/voice.json`, pronunciation fixes in `docs/pronunciations.json`). The app plays the recordings, falls back to the most natural device voice, and the Progress tab has a voice picker. Don't use unofficial access to commercial TTS services (for example edge-tts).
- Checks: `npm run validate`, `npm test`, `node scripts/pipeline/lint.mjs content/<id>.json`.
- The app is plain ES modules with no build step (`npm start` for local dev); `scripts/build-artifact.mjs` builds the hosted version.
