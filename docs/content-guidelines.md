# TeachPal content guidelines

The single source of rules for writing and reviewing reels. The in-chat workflow (`.claude/skills/add-chapter/SKILL.md`) and the API pipeline (`scripts/pipeline/prompts.mjs` embeds this file) both follow it. **When a review or the user teaches us something new, add it here** under the right heading, with the chapter it came from.

## The learner
- An adult preparing for RBI Grade B (Phase 1 GA/ESI, Phase 2 ESI and Finance) with **no background in economics**. They study on a phone, in short sessions.
- Explain every term of art and abbreviation at first use, for example: ESI (Economic and Social Issues, an RBI Grade B Phase 2 paper), GDP, IMR. *(ch01: "ESI" and "GVA" were left unexplained.)*
- **Core technical concepts get conceptual clarity, not just a gloss** (the user asked for this). A concept the chapter depends on (balance of payments, fiscal deficit, foreign exchange reserves, devaluation, disinvestment, FDI vs FII and similar) gets its own reel, or at least a full scene, with:
  - a plain-language definition,
  - an everyday analogy (e.g. the balance of payments as a household's earnings and spending with the outside world),
  - a real Indian example, and
  - a recall card.

  The reviewer checks that a beginner could explain each one afterwards. *(user, ch03)*
- Never treat two related measures as the same thing. GDP and GVA are related but different. *(ch01, round 2)*
- Terms to gloss at first use include PSU (public sector undertaking), excise duty (a tax on goods produced in the country), foreign exchange (foreign currency needed to pay for imports), the Directive Principles (guidelines in the Constitution for state policy), and "commanding heights" (complete state control of the industries vital to the economy). *(ch02)*

## Fidelity to NCERT
- Use the book's **exact wording for key verdicts and definitions**, and learners should be able to quote them: "no *sincere* attempt" (not "no official attempt"), "spiced with selfish motives" (not "driven by"), the "sole purpose" line, "stagnation and, not infrequently, unusual deterioration". *(ch01)*
- Don't merge two separate NCERT points into one attributed statement. For example, the "sole purpose" line (1.1) is about the raw-material role only; the market role comes from 1.2. *(ch01)*
- Apply a verdict to exactly what NCERT applied it to. "Spiced with selfish motives" is about the infrastructure efforts, not British rule as a whole. *(ch01)*
- Don't overgeneralise qualifiers. "A considerable number of zamindars" must not become "zamindars". *(ch01)*
- Use the book's time framing: "in colonial India (around independence)", "second half of the 19th century". Don't invent a precise year the book doesn't give. *(ch01)*
- A `quote` scene must be **verbatim** text with a real speaker. If you're paraphrasing, use a `points` scene. Never put quotation marks around your own summary. *(ch01: Box 1.1 and Naoroji)*
- When NCERT words the same idea differently in the text, the Recap and the exercises, teach **both** and say where each comes from: "marketed" (text) vs "marketable" surplus (Exercise 5); land reforms as "change in ownership" (text) vs "improvements in agriculture" (Exercise 19); "self-reliance" (text) vs "self-sufficiency" (Recap); "best features of socialism without its drawbacks" (text) vs "of socialism and capitalism" (Recap). These aren't outside material, so they don't go in `beyond`. *(ch02)*
- Teach the Recap's causal credits exactly. For example, food self-sufficiency is credited to land reforms **and** the Green Revolution, and industry's rising GDP share to import substitution. *(ch02)*
- Examples must illustrate exactly what NCERT used them for. "Cuba, China" are examples of economies mostly run on socialist principles, not of "no private property". *(ch02, blocker)*
- A verbatim quote on screen is also read verbatim in the narration (introduce it, then read it word for word). *(ch02)*
- Don't describe NCERT's numbers with your own arithmetic ("the table rounds 40.59 to 40.5" is wrong: it would round to 40.6). Just state both figures and where each comes from. *(ch02)*
- Name the source of a box when NCERT gives one (Box 2.5 is from Thomas Sowell's *Basic Economics*). *(ch02)*

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
- The correct option must not stand out by length or detail. Write the wrong options to be as long and as specific as the right one. *(ch01/ch02: in 18 of 38 quizzes the longest option was the answer, and neither reviewer caught it. Lint now flags it as major.)*
- Cards: short, self-contained answers (no more than about 45 words). Add a card for every high-value name, number, date and exact NCERT line.
- `examAngle` must give the answer material, not just name the exercise: "Exercise 11: not necessarily, because…". Every exercise question, including each matching pair, needs a reel that answers it and a card. *(ch02)*

## Practice banks (MCQs and written questions)
- Tie the stem to NCERT ("According to NCERT…") whenever outside sources could argue another option. For example, historians record gold and silver inflows, and others link the "pivot of the Empire" idea to Curzon. *(practice review, ch01)*
- Vary which statement code is right; "1 only" was right in 6 of 9 at first. Don't repeat an option label ("Services: … / Services: …"). The lint flags both. *(practice review)*
- Key points must answer the exact question asked. Definitions get the definition as the core point; extras are marked "(Optional)", so a correct standard answer can't lose marks. Accept both NCERT terms where they differ. *(c2d3, c2d5)*
- Don't credit an achievement to the wrong cause in a rubric. Industry's GDP-share rise is credited to import substitution (Recap); diversification is credited to the public sector. *(c2d16)*
- When NCERT's "present" figures are out of date, say so in the `why` (₹1 crore SSI limit vs today's MSME limits). *(c2m16)*

## Visuals that match the narration
- Every item on screen gets spoken, in the **same order**: timeline events, flow steps, list items. *(ch01: the timeline and narration order didn't match.)*
- No cause-and-effect chain the book doesn't make, unless it's marked extra. *(ch01: "railways → famine")*
- Visuals must not suggest something false. "Railways reach the villages" was wrong, because NCERT says roads carried goods to the nearest station. *(ch01)*
- Write place names and terms out in full on screen (Tamil Nadu, not TN). Use digit emoji (1️⃣ 2️⃣ 3️⃣) for numbered items.
- Put only dated facts against a year on a timeline. "1893: born; studied at Presidency and Cambridge" wrongly dates the studies. *(ch02)*

## Narration written for the ear
- Short sentences, conversational, explaining *why*. 2-5 sentences per scene, and no more than about 100 words.
- The app's speech cleanup reads %, ₹, number ranges, <, ~, "e.g." and "WW II" aloud correctly. Still prefer words in `say` ("about 7 percent"). Keep symbols for on-screen text.
- Spell out abbreviations the way they should be spoken, and say a name the way the learner should remember it.

## Voice and pronunciation
- Narration is recorded with Kokoro. The user wanted a natural, Indian-sounding voice, because the device voices sounded robotic. They liked all 9 sample voices and asked for **a random voice per reel**, for variety (`docs/voice.json`; never the same voice twice in a row).
- Write narration that works in any of the voices: no first-person persona or gendered self-reference ("as a teacher, I…").
- When a word is mispronounced (Indian names, Hindi terms, abbreviations), add a respelling to `docs/pronunciations.json`. Abbreviations read letter by letter are written with spaces ("N C E R T").

## Workflow habits
- Run the independent reviewer and the web fact-checker in parallel, each with fresh context. Fix everything major, and the minor issues that are cheap to fix.
- A round-2 review checks only changed reels, and must confirm that round-1 fixes were actually applied. Applying the suggested fix text without re-reading it has caused new errors twice. *(ch01: GVA; ch02: a fix dated the Directive Principles to 1948.)* Read every suggested fix against the PDF before pasting it in.
- Keep `factIds` on reels; publish the report and the `reviewed` status with the chapter.
