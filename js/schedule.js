// Scheduling for the v2 practice items (cards use srs.js). See
// docs/learning-principles.md: misses come back soon, confident misses sooner
// (hypercorrection), and explain-it-back starts the day after a reel.
const MIN = 60e3;
const DAY = 864e5;

// MCQ result: conf is "guess" | "unsure" | "sure".
export function scheduleMcq(prev, correct, conf, now = Date.now()) {
  const p = prev || { attempts: 0, correct: 0, streak: 0 };
  const streak = correct ? (p.streak || 0) + 1 : 0;
  let due;
  if (!correct) due = now + (conf === "sure" ? 10 * MIN : 60 * MIN);
  else if (conf === "sure") due = now + Math.min(60, 3 * 2 ** (streak - 1)) * DAY;
  else due = now + 1 * DAY; // right but unsure: check again tomorrow
  return { attempts: p.attempts + 1, correct: p.correct + (correct ? 1 : 0), streak, conf, lastCorrect: correct, last: now, due };
}

export function firstExplainDue(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(4, 0, 0, 0); // available from early tomorrow
  return d.getTime();
}

export function scheduleExplain(prev, score, now = Date.now()) {
  const days = score >= 8 ? 14 : score >= 5 ? 4 : 1;
  return { ...(prev || {}), attempts: (prev?.attempts || 0) + 1, lastScore: score, last: now, due: now + days * DAY };
}
