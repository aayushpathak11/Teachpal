# TeachPal content guidelines

The single source of rules for writing and reviewing reels. The in-chat workflow (`.claude/skills/add-chapter/SKILL.md`) and the API pipeline (`scripts/pipeline/prompts.mjs` embeds this file) both follow it. **When a review or the user teaches us something new, add it here** under the right heading, with the chapter it came from.

## The learner
- An adult preparing for RBI Grade B (Phase 1 GA/ESI, Phase 2 ESI and Finance) with **no background in economics**. They study on a phone, in short sessions.
- Explain every term of art and abbreviation at first use, for example: ESI (Economic and Social Issues, an RBI Grade B Phase 2 paper), GDP, IMR. *(ch01: "ESI" and "GVA" were left unexplained.)*
- Never treat two related measures as the same thing. GDP and GVA are related but different. *(ch01, round 2)*

## Fidelity to NCERT
- Use the book's **exact wording for key verdicts and definitions**, and learners should be able to quote them: "no *sincere* attempt" (not "no official attempt"), "spiced with selfish motives" (not "driven by"), the "sole purpose" line, "stagnation and, not infrequently, unusual deterioration". *(ch01)*
- Don't merge two separate NCERT points into one attributed statement. For example, the "sole purpose" line (1.1) is about the raw-material role only; the market role comes from 1.2. *(ch01)*
- Apply a verdict to exactly what NCERT applied it to. "Spiced with selfish motives" is about the infrastructure efforts, not British rule as a whole. *(ch01)*
- Don't overgeneralise qualifiers. "A considerable number of zamindars" must not become "zamindars". *(ch01)*
- Use the book's time framing: "in colonial India (around independence)", "second half of the 19th century". Don't invent a precise year the book doesn't give. *(ch01)*
- A `quote` scene must be **verbatim** text with a real speaker. If you're paraphrasing, use a `points` scene. Never put quotation marks around your own summary. *(ch01: Box 1.1 and Naoroji)*

## Labelling outside material
- Anything not in the chapter goes in a scene with `"extra": true` or in `beyond`. That includes general definitions, your own calculations (such as the rule of 70), later history (the Planning Commission in 1950), and causal inferences. Inside narration, flag it out loud as "beyond the book". *(ch01)*
- Facts NCERT does mention (books it recommends, the Economic Survey) are book content: credit NCERT and don't label them extra. *(ch01)*
- Outside claims need precise wording. For example: "invisibles" = services, transfers and income, not just services; Tata Sons' 1932 air service, renamed Tata Air Lines in 1938 and Air India in 1946. *(ch01 fact-check)*

## Coverage: what learners must not miss
- Every point in the chapter's **Recap**, and the answer material for **every exercise question** (map each exercise to a reel's `examAngle`). Answer all parts, for example Q15's "volume" as well as its "direction". *(ch01)*
- Names in quotes and sources: who said it, and the year. MCQs ask for names. *(ch01: Lord Elgin)*
- Book–author pairs NCERT cites, and warnings about names that are easy to confuse (R.C. Dutt the author vs R.C. Desai the income estimator). *(ch01)*
- Where NCERT differs from the commonly known fact, teach both and say which one to answer with: railways introduced 1850 vs first passenger train 1853; first census 1881 vs the 1872 non-synchronous count; the book's misprint "Vruce" for Bruce. List these under "Things to keep in mind" in the report. *(ch01)*
- Causes lists must be complete. For high mortality, famines and natural calamities belong alongside health and disease. *(ch01)*

## Quizzes and cards
- Exactly one defensible answer, **even using knowledge from outside NCERT**. A distractor must be clearly wrong, not merely "not the book's answer". *(ch01: Jamdani is also a fine Dhaka muslin.)*
- Tie the stem to NCERT ("According to NCERT…") when sources disagree.
- No "all/none of the above" or "both": the app shuffles options.
- Cards: short, self-contained answers (no more than about 45 words). Add a card for every high-value name, number, date and exact NCERT line.

## Visuals that match the narration
- Every item on screen gets spoken, in the **same order**: timeline events, flow steps, list items. *(ch01: the timeline and narration order didn't match.)*
- No cause-and-effect chain the book doesn't make, unless it's marked extra. *(ch01: "railways → famine")*
- Visuals must not suggest something false. "Railways reach the villages" was wrong, because NCERT says roads carried goods to the nearest station. *(ch01)*
- Write place names and terms out in full on screen (Tamil Nadu, not TN). Use digit emoji (1️⃣ 2️⃣ 3️⃣) for numbered items.

## Narration written for the ear
- Short sentences, conversational, explaining *why*. 2-5 sentences per scene, and no more than about 100 words.
- The app's speech cleanup reads %, ₹, number ranges, <, ~, "e.g." and "WW II" aloud correctly. Still prefer words in `say` ("about 7 percent"). Keep symbols for on-screen text.
- Spell out abbreviations the way they should be spoken, and say a name the way the learner should remember it.

## Voice and pronunciation
- Narration is recorded with Kokoro. The user wanted a natural, Indian-sounding voice, because the device voices sounded robotic.
- When a word is mispronounced (Indian names, Hindi terms, abbreviations), add a respelling to `docs/pronunciations.json`. Abbreviations read letter by letter are written with spaces ("N C E R T").

## Workflow habits
- Run the independent reviewer and the web fact-checker in parallel, each with fresh context. Fix everything major, and the minor issues that are cheap to fix.
- A round-2 review checks only changed reels, and must confirm that round-1 fixes were actually applied. Applying the suggested fix text without re-reading it once caused a new error. *(ch01: GVA)*
- Keep `factIds` on reels; publish the report and the `reviewed` status with the chapter.
