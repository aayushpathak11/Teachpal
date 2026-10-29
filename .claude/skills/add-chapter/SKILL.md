---
name: add-chapter
description: Turn a textbook chapter PDF the user shares in chat into reviewed TeachPal reels and publish them to the hosted app. Use whenever the user sends a new chapter PDF or asks to add, regenerate or re-review a chapter.
---

# Add a chapter to TeachPal (in-chat workflow)

The user studies for RBI Grade B with no background in economics. They send one NCERT chapter PDF at a time in chat. There is no Anthropic API key, so Claude runs every stage itself in the session, following the same stages as `scripts/pipeline/run.mjs`. The prompts for those stages are in `scripts/pipeline/prompts.mjs`, and they are the spec for each stage.

Do every step, in order. Don't skip the review or the fact-check, even for a short chapter.

**Before writing anything, read `docs/content-guidelines.md`.** It holds every lesson from earlier chapters' reviews and the user's feedback. Writing follows it, the reviewer checks against it, and step 9 adds to it.

## 0. Sync first
- Hosted app: see `HOSTING.md` for the artifact URL. The **artifact is the durable copy** (GitHub push may be blocked and this container is temporary).
- If `content/` here is missing chapters that the live app has, pull them back with the Artifact tool: `action: "read"`, `url`, `paths: ["content/index.json", "content/<id>.json", …]`. Then copy them into `content/`.

## 1. Read and plan
- Read the whole PDF with `Read` and `pages`, in chunks of 8 or fewer, including the boxes, figure captions, exercises and the "Work These Out" boxes.
- Choose an id: `<subject><class>-ch<NN>` (e.g. `eco11-ch02`), or for other books `<book>-ch<NN>`.
- Write `.work/<id>/plan.json` as described in `planPrompt()`: every exam-relevant fact as an atomic statement with section and importance, plus 12-20 reels (one concept each, in chapter order) with factIds. Every high-importance fact must be assigned to a reel.

## 2. Write
- Follow `docs/content-guidelines.md` point by point. In particular: NCERT's exact wording for verdicts, verbatim-only quote scenes, everything outside the book labelled extra, every on-screen item narrated in order, jargon explained, Recap and every exercise question covered, quizzes with exactly one defensible answer even using outside knowledge.
- Write `content/<id>.json` following `writePrompt()` and the style of `content/eco11-ch01.json`: 3-5 scenes per reel, spoken-style narration that explains *why*, concrete Indian examples, a quiz with exactly one defensible answer (no "all/none of the above"; the app shuffles options), 2-3 recall cards, `beyond`, and `examAngle`.
- Use the book's exact numbers and names. Anything not from the book goes in a scene with `"extra": true` or in `beyond`, never attributed to NCERT.
- Keep `factIds` on each reel.

## 3. Deterministic checks
- `npm run validate` must pass.
- `node scripts/pipeline/lint.mjs content/<id>.json`: fix every blocker and major issue.

## 4. Independent review (fresh context)
Spawn a **general-purpose subagent** as the reviewer. It must not be given your reasoning, only:
- the PDF path, the chapter file path and `.work/<id>/plan.json`
- the instructions from `reviewPrompt()` plus `coveragePrompt()` (high-importance facts only)
- `docs/content-guidelines.md`, with the instruction to flag any breach of it
- the output shape `{"issues":[{reelId, where, severity, type, problem, fix}], "scores":[{reelId, accuracy, clarity, engagement}], "missing":[{factId, reelId, note}]}`, saved to `.work/<id>/review-<round>.json`

Tell it to read the PDF itself and to report only real problems.

## 5. Web fact-check (fresh context)
- `node scripts/pipeline/lint.mjs content/<id>.json --claims` lists every Beyond-NCERT claim.
- Spawn a second **general-purpose subagent** with `factcheckSystem` from `prompts.mjs` and those claims. It verifies each claim with WebSearch/WebFetch, preferring government, RBI, Census, encyclopaedia and academic sources. It saves `{"claims":[{id, verdict, correction, sources}]}` to `.work/<id>/factcheck-<round>.json`.
- Steps 4 and 5 run in parallel (both in the background).

## 6. Revise and re-check (at most 2 rounds)
- Fix every blocker and major issue: reviewer issues, missing facts, and fact-check verdicts `false`, `partly` or `unverifiable` (correct the claim, or remove it).
- Re-run steps 3-5 on the **changed reels only**, then stop when no blocker or major issues remain, or after 2 rounds.
- Minor issues: fix the ones that are clearly right and cheap to fix, and list the rest in the report.

## 7. Report
Write `content/reports/<id>.md` with these sections: Status (reviewed / needs attention), counts (reels, scenes, cards, review rounds, issues fixed), coverage (x/y high-importance facts), open issues by severity, reviewer scores per reel, a fact-check table (claim, verdict, correction, sources), and any facts still not covered.

## 8. Publish
- Add the chapter to `content/index.json` with `"status": "reviewed"` or `"needs-attention"`.
- `npm run validate && npm test`
- `node scripts/build-artifact.mjs` (writes `dist/artifact/`)
- Republish to the **same URL** from `HOSTING.md` with the Artifact tool: `file_path: dist/artifact/index.html`, `url`, and `files` mapping only what changed (at minimum `content/index.json` and `content/<id>.json`, plus `content/reports/<id>.md`; any changed `js/*.js` or `css/app.css` too). Omit `capabilities` so the db declaration is kept, and omit `icon`.
- Commit on the working branch and try to push; if the push is refused, say so in one line.

## 9. Learn: save the lessons
- For every issue that the reviewer, the fact-checker or the user found and that could recur in other chapters, add a one-line rule to `docs/content-guidelines.md` under the right heading, tagged with the chapter id.
- If a script could catch it reliably, add a check to `scripts/pipeline/checks.mjs` (it runs in `lint.mjs` and the API pipeline), and confirm it raises no false alarm on the existing chapters.
- The user's preferences (tone, voice, depth, format) go in the guidelines too.

## 10. Tell the user
In a few lines: what the chapter now contains, what the review caught and fixed, any open issues to be careful about, and that the app has updated (reload it). Mention reels they had trouble with if the progress data shows it (`ArtifactData` `get` on `progress/<their id>` is readable by the owner).
