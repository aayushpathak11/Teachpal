# Learning principles for TeachPal features

Every new feature is checked against this list before it's built. The research basis is in the first conversation: Dunlosky et al. 2013, Roediger & Karpicke 2006, Bjork's "desirable difficulties", and the pretesting and hypercorrection effects.

| Principle | What it means for features |
|---|---|
| Retrieval practice | The learner produces the answer before seeing it. Free recall (writing, explaining) beats recognition (MCQ), and both beat re-reading. |
| Spacing | Anything learned comes back on the SRS schedule. Missed items come back sooner. Daily short sessions beat marathons. |
| Interleaving | Practice mixes topics and chapters instead of blocking them. |
| Pretesting | Asking the question before teaching improves memory of the answer, even when the first attempt is wrong. |
| Hypercorrection | Confidently wrong answers, corrected right away, stick best, so collect confidence and give immediate feedback. |
| Elaboration and self-explanation | "Why?" and "How does this connect?" prompts; explaining in your own words; linking to news and other chapters. |
| Generation | Building a concept map beats viewing one; filling a gap beats reading the full answer. |
| Dual coding and concrete examples | Visuals paired with narration; real Indian examples. |
| Avoid the fluency illusion | Passive features (audio replay, summaries) are supplements and need recall pauses. Effortless isn't the same as learned. |
| Calibration | Analytics compare confidence with accuracy and forecast forgetting; no vanity metrics. |

## v2 (built and live)
1. **Exam practice:** interleaved MCQ sets with confidence ratings and immediate feedback; wrong answers go back into the SRS. Closed-book Phase 2 descriptive answers with AI feedback, and the model answer shown only after submitting.
2. **Pretest:** each reel's question is shown before the reel plays.
3. **Next-day explain-it-back,** with AI "why?" follow-ups.
4. **Mixed daily session** across chapters, prioritising what's about to be forgotten.

## v3 (built and live)
1. **Mixed test** (Practice): MCQs and written answers from every chapter in one sitting, weak and unseen questions first, with per-chapter results. *(interleaving, retrieval)*
2. **Audio revision with recall pauses** (Revise): question, a 3/5/8-second thinking pause with a countdown, then the answer; due cards can be graded hands-free. Card audio is recorded with Kokoro alongside the narration, with the device voice as fallback. *(retrieval during passive time, avoiding the fluency illusion)*
3. **Fill-in-the-link concept maps** (Revise, and scheduled into Today): cause-and-effect chains per chapter (`content/maps/`) with random blanks and distractors from the chapter's other chains, then "say it aloud". *(generation, elaboration; spaced 1/4/14 days by score)*
4. **Current-affairs linker** (Revise): paste a news item; Claude links it to studied reels and drafts 2-3 cards that join the SRS. Without AI, the learner links it and writes the card. *(elaboration, spacing)*
5. **Calibration analytics** (Progress): accuracy by confidence level and by chapter, plus a "sure but wrong" danger list with re-watch links. *(calibration, hypercorrection)*

## Ideas for later
- Forgetting forecast per chapter (predicted recall from SRS intervals) to choose what to revise before the exam.
- Exam-date mode: compress intervals so everything is reviewed at least once in the last two weeks.
- Previous-year RBI Grade B question tagging, to show which reels map to asked topics.
