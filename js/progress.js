import { esc, h } from "./util.js";
import { MATURE_DAYS, strength } from "./srs.js";
import { streak } from "./store.js";

const DAY = 864e5;

export function renderProgress(ctx) {
  const { state } = ctx;
  const now = Date.now();
  const refs = ctx.allCardRefs();
  const cards = refs.map((r) => state.cards[r.key]).filter(Boolean);
  const quizzes = Object.values(state.reels).map((r) => r.quiz).filter(Boolean);
  const acc = quizzes.length ? Math.round((100 * quizzes.filter((q) => q.correct).length) / quizzes.length) : null;

  const forecast = Array.from({ length: 7 }, (_, d) => {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    const until = end.getTime() + d * DAY;
    return cards.filter((c) => c.due < until && (d === 0 || c.due >= until - DAY)).length;
  });
  const fmax = Math.max(...forecast, 1);
  const dayName = (d) => (d === 0 ? "Today" : new Date(now + d * DAY).toLocaleDateString(undefined, { weekday: "short" }));

  const page = h(`
    <div class="page">
      <h2>Progress</h2>
      <p class="sub">🔥 ${streak(state)}-day streak</p>
      <div class="stats">
        <div class="stat-tile"><div class="n">${Object.keys(state.reels).length}</div><div class="l">reels completed</div></div>
        <div class="stat-tile"><div class="n">${acc == null ? "–" : acc + "%"}</div><div class="l">quiz accuracy</div></div>
        <div class="stat-tile"><div class="n">${cards.filter((c) => c.ivl < MATURE_DAYS).length}</div><div class="l">cards learning</div></div>
        <div class="stat-tile"><div class="n">${cards.filter((c) => c.ivl >= MATURE_DAYS).length}</div><div class="l">cards mastered (21+ day gap)</div></div>
      </div>
      <div class="section-h">Reviews due, next 7 days</div>
      <div class="forecast">${forecast
        .map((n, d) => `<div class="fcol"><span class="fn">${n || ""}</span><div class="fbar" style="height:${(n / fmax) * 55}px"></div><span>${dayName(d)}</span></div>`)
        .join("")}</div>
      <div class="chapters"></div>
      <button class="danger" data-reset>Reset all progress</button>
    </div>`);

  const chWrap = page.querySelector(".chapters");
  for (const ch of ctx.chapters) {
    chWrap.append(h(`<div class="section-h">${esc(ch.title)}</div>`));
    const list = h(`<div class="reel-list"></div>`);
    ch.reels.forEach((r) => {
      const rs = state.reels[`${ch.id}/${r.id}`];
      const own = ctx.cardRefs(ch).filter((x) => x.reelId === r.id).map((x) => state.cards[x.key]);
      const m = own.length ? own.reduce((s, c) => s + strength(c), 0) / own.length : 0;
      const pill = !rs?.quiz ? `<span class="pill na">not yet</span>` : rs.quiz.correct ? `<span class="pill ok">✓ quiz</span>` : `<span class="pill no">✗ quiz</span>`;
      const row = h(`
        <button class="reel-row">
          <span class="e">${esc(r.emoji || "▶")}</span>
          <span class="t">${esc(r.title)}<small>§${esc(r.section || "")} · memory ${Math.round(m * 100)}%</small></span>
          <span class="mastery"><i style="width:${m * 100}%"></i></span>
          ${pill}
        </button>`);
      row.onclick = () => ctx.openReel(ch.id, r.id);
      list.append(row);
    });
    chWrap.append(list);
  }

  page.querySelector("[data-reset]").onclick = () => {
    if (confirm("Reset all progress, streaks and recall cards on this device?")) ctx.reset();
  };
  return page;
}
