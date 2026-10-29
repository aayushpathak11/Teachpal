// Markdown review report: what was checked, what was fixed, and what still needs a human.
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function buildReport({ chapter, plan, rounds, factchecks, status, usage, cost, mode }) {
  const last = rounds.at(-1) || { issues: [], scores: [] };
  const open = last.issues;
  const bySev = (s) => open.filter((i) => i.severity === s);
  const fixed = rounds.slice(0, -1).reduce((n, r) => n + r.actionable, 0);
  const scores = new Map(last.scoresAll?.map((s) => [s.reelId, s]) || []);
  const high = plan?.facts?.filter((f) => f.importance === "high") || [];
  const missingIds = new Set(last.issues.filter((i) => i.type === "coverage").map((i) => i.problem.match(/fact (\S+):/)?.[1]));

  const lines = [
    `# Review report: ${chapter.title}`,
    "",
    `**Status: ${status === "reviewed" ? "✅ reviewed (no blocker or major issues left)" : "⚠️ needs attention (see open issues)"}**`,
    "",
    `- Mode: ${mode === "review" ? "review of existing content (no edits made)" : "generated, reviewed and revised"}`,
    `- ${chapter.reels.length} reels · ${chapter.reels.reduce((n, r) => n + r.scenes.length, 0)} scenes · ${chapter.reels.reduce((n, r) => n + r.cards.length, 0)} recall cards`,
    `- Review rounds: ${rounds.length}${fixed ? ` · ${fixed} blocker/major issues fixed along the way` : ""}`,
    `- Coverage: ${high.length - missingIds.size}/${high.length} high-importance facts covered`,
    `- API usage: ${usage.calls} calls, ${usage.input + usage.cacheWrite + usage.cacheRead} input tokens (${usage.cacheRead} from cache), ${usage.output} output tokens, ${usage.searches} web searches${cost != null ? ` ≈ $${cost.toFixed(2)}` : ""}`,
    "",
    "## Open issues",
    "",
  ];
  if (!open.length) lines.push("None.", "");
  for (const sev of ["blocker", "major", "minor"]) {
    const list = bySev(sev);
    if (!list.length) continue;
    lines.push(`### ${sev} (${list.length})`, "", "| Reel | Where | Type | Problem | Suggested fix |", "|---|---|---|---|---|");
    list.forEach((i) => lines.push(`| ${esc(i.reelId || "chapter")} | ${esc(i.where)} | ${esc(i.type)} | ${esc(i.problem)} | ${esc(i.fix)} |`));
    lines.push("");
  }

  lines.push("## Reel scores (reviewer, 1-5)", "", "| # | Reel | Accuracy | Clarity | Engagement |", "|---|---|---|---|---|");
  chapter.reels.forEach((r, i) => {
    const s = scores.get(r.id) || {};
    lines.push(`| ${i + 1} | ${esc(r.title)} | ${s.accuracy ?? "–"} | ${s.clarity ?? "–"} | ${s.engagement ?? "–"} |`);
  });
  lines.push("");

  const checked = factchecks.flatMap((f) => f.results.map((r) => ({ ...r, claim: f.claims.find((c) => c.id === r.id) })));
  if (checked.length) {
    lines.push("## Beyond-NCERT fact-check (web)", "", "| Claim | Verdict | Correction | Sources |", "|---|---|---|---|");
    const latest = new Map(checked.map((c) => [c.id, c]));
    for (const c of latest.values()) {
      const text = c.claim?.claim?.split("\n")[0] || c.id;
      lines.push(`| ${esc(text.length > 140 ? text.slice(0, 137) + "…" : text)} | ${esc(c.verdict)} | ${esc(c.correction || "")} | ${(c.sources || []).slice(0, 3).map((u) => `<${u}>`).join(" ")} |`);
    }
    lines.push("");
  }

  if (missingIds.size) {
    lines.push("## Facts not yet covered", "");
    high.filter((f) => missingIds.has(f.id)).forEach((f) => lines.push(`- **${f.id}** (§${f.section}): ${f.text}`));
    lines.push("");
  }
  lines.push("_AI review lowers the error rate but doesn't remove it. Spot-check the numbers before exam day._", "");
  return lines.join("\n");
}
