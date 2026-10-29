// Asking Claude from inside the hosted app (the artifact's `sample` capability),
// on the learner's own Claude account. Every AI feature has a no-AI fallback, so
// the app still works locally, signed out, or if the learner declines.

let samplePromise = null;
let disabled = false;

function getSample() {
  if (disabled) return Promise.resolve(null);
  if (!samplePromise) samplePromise = window.claude?.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);
  return samplePromise;
}

export async function aiAvailable() {
  return !!(await getSample());
}

const MESSAGES = {
  not_granted: "AI feedback is off because Claude wasn't allowed for this app. Use the self-check below.",
  sampling_disabled: "AI feedback isn't available on this account. Use the self-check below.",
  rate_limited: "You've hit a usage limit for now. Try again later, or use the self-check below.",
  session_expired: "Please sign in to Claude again to get AI feedback.",
  invalid_json: "The feedback came back garbled. Tap the button to try again.",
  refused: "Claude couldn't give feedback on that answer. Try rephrasing it.",
  upstream_error: "Couldn't reach Claude just now. Tap the button to try again.",
};
const PERMANENT = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

// Resolves to {data} or {error: message, fallback: bool}. Never throws.
export async function askJSON(prompt, { signal } = {}) {
  const sample = await getSample();
  if (!sample) return { error: null, fallback: true };
  try {
    const data = await sample.json(prompt, { signal });
    return { data };
  } catch (e) {
    if (e?.code === "cancelled") return { error: null, cancelled: true };
    if (PERMANENT.has(e?.code)) disabled = true;
    return { error: MESSAGES[e?.code] || MESSAGES.upstream_error, fallback: PERMANENT.has(e?.code) };
  }
}

const clip = (s, n) => String(s || "").slice(0, n);

export function gradeEssayPrompt(item, answer) {
  return `You are an examiner for the RBI Grade B Phase 2 "Economic and Social Issues" paper. Grade a learner's answer to an NCERT-based question. Be encouraging but strict and specific. Judge meaning, not exact wording. Use only the key points and NCERT knowledge; don't invent facts.

Question: ${item.q}
Target length: about ${item.words || 150} words.
Key points a full answer covers (the rubric):
${item.keyPoints.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Learner's answer:
"""
${clip(answer, 6000)}
"""

Reply with only this JSON:
{"score": <integer 0-10>, "covered": [<numbers of key points the answer covers>], "missed": [<numbers of key points it misses or gets wrong>], "strengths": "<one sentence>", "improve": ["<up to 3 concrete tips on content, structure or wording>"], "modelAnswer": "<a model answer of about ${item.words || 150} words, using NCERT's terms>"}`;
}

export function explainPrompt(reel, explanation) {
  const notes = [...reel.scenes.map((s) => s.say), ...reel.cards.map((c) => `${c.q} ${c.a}`)].join("\n");
  return `A learner preparing for the RBI Grade B exam studied a short lesson titled "${reel.title}" (NCERT Class 11 Economics). From memory, without notes, they explained it in their own words. Compare the explanation with the lesson notes. Be warm, specific and brief.

Lesson notes:
"""
${clip(notes, 6000)}
"""

Learner's explanation:
"""
${clip(explanation, 4000)}
"""

Reply with only this JSON:
{"score": <integer 0-10 for how completely and correctly they explained the key ideas>, "good": "<one sentence on what they got right>", "missed": ["<up to 3 key ideas they missed or got wrong, each under 20 words>"], "followUp": "<one 'why' or 'how' question that makes them explain a cause or connection from the notes>"}`;
}

export function followUpPrompt(reel, question, answer) {
  const notes = reel.scenes.map((s) => s.say).join("\n");
  return `A learner studying "${reel.title}" (NCERT Class 11 Economics) was asked a follow-up question. Judge their answer against the lesson notes.

Lesson notes:
"""
${clip(notes, 5000)}
"""

Question: ${question}
Learner's answer:
"""
${clip(answer, 2000)}
"""

Reply with only this JSON:
{"correct": <true or false>, "feedback": "<at most 2 sentences: confirm or correct them, including the right explanation>"}`;
}
