# TeachPal

Study app: NCERT chapters → narrated reels, quizzes and spaced-repetition recall (RBI Grade B prep).

- **When the user sends a chapter PDF, follow `.claude/skills/add-chapter/SKILL.md` step by step**: plan, write, lint, independent review, web fact-check, revise, report, publish.
- Live app and how it's hosted: `HOSTING.md`.
- Checks: `npm run validate`, `npm test`, `node scripts/pipeline/lint.mjs content/<id>.json`.
- The app is plain ES modules with no build step (`npm start` for local dev); `scripts/build-artifact.mjs` builds the hosted version.
