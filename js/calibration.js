import { esc, h } from "./util.js";

// Calibration: does "Sure" really mean right? Built from the confidence the
// learner gives on every practice MCQ (docs/learning-principles.md: calibration).
// Overconfident topics are the dangerous ones: they feel known, so they get skipped.
const LEVELS = [
  ["guess", "Guessing"],
  ["unsure", "Unsure"],
  ["sure", "Sure"],
];
const MIN_SURE = 5; // attempts needed before judging calibration

export function calibration(ctx) {
  const meta = new Map(ctx.allMcqs().map((m) => [m.id, m]));
  const levels = Object.fromEntries(LEVELS.map(([k]) => [k, { n: 0, right: 0 }]));
  const chapters = new Map();
  const danger = new Map(); // reel -> confident mistakes on the latest try
  for (const [id, p] of Object.entries(ctx.state.practice || {})) {
    const m = meta.get(id);
    if (!m) continue;
    const log = p.log || (p.conf ? [[p.conf, p.lastCorrect ? 1 : 0]] : []);
    const c = chapters.get(m.chapterId) || { title: m.chapterTitle, sure: 0, sureRight: 0, low: 0, lowRight: 0 };
    for (const [conf, right] of log) {
      if (!levels[conf]) continue;
      levels[conf].n++;
      levels[conf].right += right;
      if (conf === "sure") {
        c.sure++;
        c.sureRight += right;
      } else {
        c.low++;
        c.lowRight += right;
      }
    }
    chapters.set(m.chapterId, c);
    if (p.conf === "sure" && !p.lastCorrect) {
      const k = `${m.chapterId}/${m.reelId}`;
      danger.set(k, { chapterId: m.chapterId, reelId: m.reelId, n: (danger.get(k)?.n || 0) + 1 });
    }
  }
  return { levels, chapters, danger: [...danger.values()].sort((a, b) => b.n - a.n) };
}

function verdict({ levels }) {
  const s = levels.sure;
  const low = { n: levels.guess.n + levels.unsure.n, right: levels.guess.right + levels.unsure.right };
  if (s.n + low.n === 0) return "Answer a few practice MCQs (they ask how sure you are) and your calibration appears here.";
  const out = [];
  if (s.n >= MIN_SURE) {
    const acc = s.right / s.n;
    out.push(
      acc >= 0.9
        ? `When you say "Sure" you're right ${Math.round(acc * 100)}% of the time: well calibrated. Trust that feeling.`
        : `When you say "Sure" you're right only ${Math.round(acc * 100)}% of the time. Some things feel known but aren't, so slow down on "obvious" questions and re-check the topics below.`
    );
  } else out.push(`Mark a few more answers "Sure" (${s.n}/${MIN_SURE} so far) to judge whether that feeling can be trusted.`);
  if (low.n >= MIN_SURE && low.right / low.n >= 0.7)
    out.push(`When guessing or unsure you still get ${Math.round((100 * low.right) / low.n)}% right: you know more than you think. Commit to answers more often.`);
  return out.join(" ");
}

export function calibrationSection(ctx) {
  const cal = calibration(ctx);
  const bar = ([k, label]) => {
    const { n, right } = cal.levels[k];
    const pct = n ? Math.round((100 * right) / n) : 0;
    return `<div class="cal-row"><span class="cal-l">${label}</span><span class="cal-track"><i class="cal-${k}" style="width:${pct}%"></i></span><span class="cal-v">${n ? `${pct}% <small>of ${n}</small>` : "–"}</span></div>`;
  };
  const chRows = [...cal.chapters.values()]
    .filter((c) => c.sure + c.low)
    .map((c) => {
      const over = c.sure - c.sureRight;
      return `<li>${esc(c.title)}: <b>${c.sure ? Math.round((100 * c.sureRight) / c.sure) + "%" : "–"}</b> right when sure${over ? ` · <span class="bad-t">${over} confident mistake${over > 1 ? "s" : ""}</span>` : ""}</li>`;
    })
    .join("");
  const el = h(`
    <div>
      <div class="section-h">Confidence check (calibration)</div>
      <div class="box">
        <p class="cal-verdict">${esc(verdict(cal))}</p>
        <div class="cal">${LEVELS.map(bar).join("")}</div>
        <p class="prompt">Accuracy by how sure you said you were, over your practice MCQs. Ideally "Sure" is near 100% and "Guessing" is low.</p>
        ${chRows ? `<h4>By chapter</h4><ul class="cal-ch">${chRows}</ul>` : ""}
      </div>
      ${cal.danger.length ? `<div class="section-h">Danger zone: sure, but wrong</div><div class="reel-list danger-list"></div>` : ""}
    </div>`);
  const list = el.querySelector(".danger-list");
  for (const d of cal.danger.slice(0, 6)) {
    const ch = ctx.chapters.find((c) => c.id === d.chapterId);
    const reel = ch?.reels.find((r) => r.id === d.reelId);
    if (!reel) continue;
    const row = h(`<button class="reel-row"><span class="e">${esc(reel.emoji || "⚡")}</span><span class="t">${esc(reel.title)}<small>${esc(ch.title)} · ${d.n} confident mistake${d.n > 1 ? "s" : ""}</small></span><span class="pill no">re-watch</span></button>`);
    row.onclick = () => ctx.openReel(ch.id, reel.id);
    list.append(row);
  }
  return el;
}
