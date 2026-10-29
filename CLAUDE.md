# TeachPal

Study app: NCERT chapters → narrated reels, quizzes and spaced-repetition recall (RBI Grade B prep).

- **When the user sends a chapter PDF, follow `.claude/skills/add-chapter/SKILL.md` step by step**: plan, write, lint, independent review, web fact-check, revise, report, publish.
- **Content rules learned so far: `docs/content-guidelines.md`.** Read them before writing or reviewing any reel, and add every new lesson (from reviews or the user's feedback) there, so the next chapter benefits.
- Live app and how it's hosted: `HOSTING.md`.
- Narration: the app picks the most natural device voice (voice picker on the Progress tab) and cleans up symbols for speech (`forSpeech` in `js/tts.js`). Pre-recorded Kokoro neural audio is planned but waits on the user allowing the model download.
- Checks: `npm run validate`, `npm test`, `node scripts/pipeline/lint.mjs content/<id>.json`.
- The app is plain ES modules with no build step (`npm start` for local dev); `scripts/build-artifact.mjs` builds the hosted version.
