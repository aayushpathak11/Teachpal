// Deterministic checks that need no model: schema, structure and quiz/card hygiene.
// Issues use the same shape as the AI reviewer's so they flow through one fix loop.
import { validateChapter } from "../schema.mjs";

const words = (s) => String(s || "").split(/\s+/).filter(Boolean).length;
const issue = (reelId, where, severity, problem, fix) => ({ reelId, where, severity, type: "lint", problem, fix, source: "lint" });

export function lintChapter(ch) {
  const out = [];
  for (const e of validateChapter(ch)) {
    const m = e.match(/^reels\[(\d+)\]/);
    out.push(issue(m ? ch.reels[+m[1]]?.id : null, e.split(":")[0], "blocker", e, "Make the reel match the content schema."));
  }
  if (ch.reels.length < 8 || ch.reels.length > 24) out.push(issue(null, "chapter", "minor", `${ch.reels.length} reels; aim for 12-20`, "Merge or split reels."));

  const seenCardQs = new Map();
  for (const r of ch.reels) {
    const n = r.scenes?.length || 0;
    if (n < 3 || n > 6) out.push(issue(r.id, "scenes", "minor", `${n} scenes; aim for 3-5`, "Adjust the number of scenes."));
    (r.scenes || []).forEach((s, i) => {
      const where = `scene ${i + 1}`;
      // Lessons from ch01's reviews (docs/content-guidelines.md).
      if (s.kind === "timeline") {
        const years = (s.events || []).map((e) => e.year.trim()).filter((y) => /^\d{4}$/.test(y)); // plain years only
        const missing = years.filter((y) => !String(s.say).includes(y));
        if (missing.length) out.push(issue(r.id, where, "minor", `timeline year(s) ${missing.join(", ")} shown but never spoken`, "Narrate every timeline event, in the on-screen order."));
        const spoken = years.filter((y) => String(s.say).includes(y)).sort((a, b) => String(s.say).indexOf(a) - String(s.say).indexOf(b));
        if (missing.length === 0 && spoken.join() !== years.join()) out.push(issue(r.id, where, "minor", "timeline events are narrated in a different order from the screen", "Narrate the events in on-screen order."));
      }
      if (s.kind === "quote" && /\b(NCERT|Box\s*\d)/i.test(s.by || "")) out.push(issue(r.id, where, "minor", `quote attributed to "${s.by}"; quote scenes must be verbatim`, "Use the book's exact words, or switch to a points scene."));
      const screen = JSON.stringify({ ...s, say: undefined });
      const abbr = screen.match(/\b(TN|AP|UP|MP|WB|J&K|GVA|IMR|ESI)\b/g);
      if (abbr && !abbr.every((a) => String(s.say).includes(a) || /\(/.test(screen))) out.push(issue(r.id, where, "minor", `abbreviation on screen without explanation: ${[...new Set(abbr)].join(", ")}`, "Write it out in full or explain it at first use."));
      if (/\b(both|all|none) of the above\b/i.test(s.say || "")) out.push(issue(r.id, where, "minor", "narration refers to 'the above'", "Name the items instead."));
      const w = words(s.say);
      if (w < 12) out.push(issue(r.id, where, "minor", `narration is only ${w} words`, "Explain the visual in 2-5 sentences."));
      if (w > 100) out.push(issue(r.id, where, "minor", `narration is ${w} words (too long for one scene)`, "Split the scene or tighten the narration."));
    });
    const opts = r.quiz?.options || [];
    if (opts.length !== 4) out.push(issue(r.id, "quiz", "minor", `${opts.length} options; use 4`, "Give exactly 4 options."));
    if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) out.push(issue(r.id, "quiz", "major", "duplicate quiz options", "Make every option distinct."));
    if (opts.some((o) => /\b(all|none|both) of the (above|these)\b/i.test(o)))
      out.push(issue(r.id, "quiz", "major", "'all/none of the above' breaks when the app shuffles options", "Replace it with a concrete option."));
    if ((r.cards || []).length < 2) out.push(issue(r.id, "cards", "minor", "fewer than 2 recall cards", "Add a card for another key fact."));
    for (const c of r.cards || []) {
      if (words(c.a) > 45) out.push(issue(r.id, "cards", "minor", `card answer is ${words(c.a)} words: "${c.q}"`, "Shorten the answer or split the card."));
      const key = c.q.trim().toLowerCase();
      if (seenCardQs.has(key)) out.push(issue(r.id, "cards", "minor", `duplicate card question (also in ${seenCardQs.get(key)}): "${c.q}"`, "Remove or rephrase one of them."));
      else seenCardQs.set(key, r.id);
    }
  }
  return out;
}

// Outside-the-book content to send to the web fact-checker.
export function extraClaims(reels) {
  const claims = [];
  for (const r of reels) {
    if (r.beyond) claims.push({ id: `${r.id}#beyond`, reelId: r.id, where: "beyond", claim: r.beyond });
    (r.scenes || []).forEach((s, i) => {
      if (!s.extra) return;
      const { say, kind, extra, ...visual } = s;
      claims.push({ id: `${r.id}#scene${i + 1}`, reelId: r.id, where: `scene ${i + 1}`, claim: `${say}\n(on screen: ${JSON.stringify(visual)})` });
    });
  }
  return claims;
}

export function factcheckIssues(results, claims) {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const sev = { false: "blocker", partly: "major", unverifiable: "major" };
  return (results.claims || [])
    .filter((c) => sev[c.verdict] && byId.has(c.id))
    .map((c) => ({
      reelId: byId.get(c.id).reelId,
      where: byId.get(c.id).where,
      severity: sev[c.verdict],
      type: "factcheck",
      problem: `Fact-check: ${c.verdict}`,
      fix: c.correction || "Remove the claim or rephrase it so it only states what can be verified.",
      sources: c.sources || [],
      source: "factcheck",
    }));
}

export function coverageIssues(result, facts) {
  const byId = new Map(facts.map((f) => [f.id, f]));
  return (result.missing || [])
    .filter((m) => byId.has(m.factId))
    .map((m) => ({
      reelId: m.reelId,
      where: "reel",
      severity: "major",
      type: "coverage",
      problem: `Missing or misstated fact ${m.factId}: "${byId.get(m.factId).text}"${m.note ? ` (${m.note})` : ""}`,
      fix: "Work this fact into the reel accurately.",
      source: "coverage",
    }));
}

export const actionable = (issues) => issues.filter((i) => i.severity === "blocker" || i.severity === "major");
