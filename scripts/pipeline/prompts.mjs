// Prompts for each pipeline stage. Every stage that reads the chapter shares one
// system prompt (so the cached prefix, system + PDF, is reused); the stage's job
// goes in the user message after the PDF.

export const commonSystem = (exam) => `You are part of TeachPal's content pipeline. TeachPal turns one textbook chapter (the attached PDF) into a feed of short narrated study "reels" for adult self-learners preparing for the ${exam} exam who have no prior background in the subject.

The chapter PDF is the source of truth. Anything presented as coming from the book must match it exactly: numbers, dates, names and attributions. Material from outside the book is allowed only when you are highly confident it is accurate, and it must always be labelled as extra.

Each message gives you one stage of the pipeline. Do exactly that stage and respond with only the JSON object it asks for: no prose and no markdown fences.`;

export const SCENE_GUIDE = `Scene kinds and their fields (every scene also needs "say", the spoken narration, and may have "extra": true when its content is not from the book):
- hook: emoji, big (short punchy line), sub
- points: heading, items: [{icon (one emoji), text}] (2-5 items)
- stat: value (short, e.g. "85%", "<2%", "32 yrs"), label, optional compare: {value, label}
- bars: heading, unit, bars: [{label, value (number), display (string)}]
- flow: heading, steps: [string] (a cause-and-effect chain, 3-5 steps)
- compare: heading, left: {title, items: [string]}, right: {title, items: [string]}
- quote: text, by
- timeline: heading, events: [{year, text}]`;

const REEL_SHAPE = `{"id","title","emoji","section","factIds":[...],"scenes":[...],"beyond","examAngle","quiz":{"q","options":[4 strings],"answer":<0-based index>,"why"},"cards":[{"q","a"}]}`;

export const planPrompt = () => `STAGE: PLAN

1. Extract every exam-relevant fact from the chapter as short, atomic statements, in chapter order. Include numbers, dates, names, definitions, causes, effects, classifications and examples, and include facts from boxes, figure captions and the exercises' scope. Give each one an id (F1, F2, …), its section number, and an importance: "high" for facts likely to be examined (numbers, dates, names, definitions, lists, anything an exercise question targets), otherwise "medium".
2. Plan 12-20 reels. Each reel covers one concept, and the reels follow the chapter's order. Assign every fact id to exactly one reel; every "high" fact must be assigned. For each reel give id (kebab-case, unique), title (clear and a little catchy), section, factIds, and angle (one sentence on the hook and a concrete example or analogy to use).

Respond with: {"title","subject" (e.g. "Economics · Class 11 · Indian Economic Development"),"chapterNumber","sections":[{"number","title"}],"facts":[{"id","section","text","importance"}],"reels":[{"id","title","section","factIds","angle"}]}`;

export const writePrompt = ({ plan, batch, styleReference }) => `STAGE: WRITE

Write the reels listed under "Reels to write". The full plan is included so you know what neighbouring reels cover; don't repeat their material.

Rules (they come from learning science):
- Each reel has 3-5 scenes. "say" is spoken narration: conversational, 2-5 sentences, explaining *why* and not just *what*, with numbers written the way they should be read aloud. Each scene's visual must show what its narration says.
- Cover every fact listed for the reel, using the book's exact numbers and names.
- Use concrete examples and analogies (Indian context where possible). Explain any jargon the first time it appears.
- Outside material goes either in a scene marked "extra": true or in the reel's "beyond" field, and only if you are highly confident it is accurate. Never attribute outside facts to NCERT or the book.
- "quiz" checks understanding of the reel's key idea: 4 options, exactly one defensible correct answer, plausible distractors, no "all/none of the above". "why" explains the answer.
- "cards" are 2-3 short-answer recall prompts for the facts most worth remembering. Answers are short and self-contained.
- "examAngle": one or two sentences on how this shows up in the exam or in the chapter's exercises.

${SCENE_GUIDE}

Plan:
${JSON.stringify(plan, null, 1)}

Reels to write (keep their id, title, section and factIds):
${JSON.stringify(batch, null, 1)}

Style reference: two finished reels from another chapter. Match their tone, depth and format:
${styleReference}

Respond with: {"reels":[${REEL_SHAPE}, …]}`;

export const reviewPrompt = ({ reels }) => `STAGE: REVIEW

You are a strict reviewer, and you did not write these reels. Check each one against the attached chapter and report real problems only. An empty list is a fine answer.

Check for:
- fidelity: every claim not marked extra is supported by the chapter, and numbers, dates, names and attributions are exact. Nothing from outside the book is presented as NCERT's.
- accuracy: extra content you believe is wrong, outdated or doubtful.
- quiz: exactly one defensible correct answer, "answer" points to it, distractors are plausible but clearly wrong, and "why" is correct.
- cards: answerable from the reel, correct, unambiguous and short.
- alignment: each scene's visual matches its narration, and the narration sounds natural read aloud.
- clarity: a beginner with no background could follow it, with jargon explained at first use.

Severity: "blocker" = factually wrong or misleading. "major" = would confuse a learner, or a quiz or card is flawed. "minor" = polish.
"where" is "scene N" (1-based), "quiz", "cards", "beyond" or "examAngle". "fix" must be concrete.
Also score every reel from 1 to 5 on accuracy, clarity and engagement.

Reels:
${JSON.stringify(reels, null, 1)}

Respond with: {"issues":[{"reelId","where","severity","type","problem","fix"}],"scores":[{"reelId","accuracy","clarity","engagement"}]}`;

export const coveragePrompt = ({ facts, reels }) => `STAGE: COVERAGE

Below are the high-importance facts extracted from the chapter, followed by the reels. For each fact, decide whether a learner who watched the reels and answered their quiz and cards would learn it. List only the facts that are missing or misstated, and name the reel each one fits best.

Facts:
${JSON.stringify(facts, null, 1)}

Reels:
${JSON.stringify(reels, null, 1)}

Respond with: {"missing":[{"factId","reelId","note"}]}`;

export const revisePrompt = ({ reels, problems }) => `STAGE: REVISE

Fix every problem listed for these reels. Change only what's needed, and keep each reel's id, factIds, structure and style. If a fact-check found extra content false or unverifiable, correct it with the given correction or remove it. If a fact is reported missing, work it into a scene, card or the quiz without bloating the reel.

${SCENE_GUIDE}

Problems:
${JSON.stringify(problems, null, 1)}

Reels:
${JSON.stringify(reels, null, 1)}

Respond with the corrected reels: {"reels":[${REEL_SHAPE}, …]}`;

export const factcheckSystem = `You are a meticulous fact-checker for exam-preparation material. The claims you receive were added to study reels as context from outside the textbook. Use web search to verify each claim's specific details: dates, numbers, names and attributions. Prefer authoritative sources (government and RBI publications, Census, encyclopaedias, academic work). For each claim, choose a verdict:
- "supported": correct as stated
- "partly": the claim is broadly right but a detail is wrong (give the correction)
- "false": the claim is wrong (give the correction)
- "unverifiable": you could not confirm it from reliable sources
When you are done, reply with only the JSON object: {"claims":[{"id","verdict","correction","sources":[urls]}]}`;

export const factcheckPrompt = (claims) => `Fact-check these claims:\n${JSON.stringify(claims, null, 1)}`;
