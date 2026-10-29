import { esc, h, shuffle } from "./util.js";
import { mcqCard } from "./mcq.js";
import { essayView } from "./essay.js";

const SET_SIZE = 10;

// Choose a practice set: due/missed questions first, then unseen, then the
// least recently seen, interleaved across chapters.
function pickSet(ctx, chapterId) {
  const now = Date.now();
  const P = ctx.state.practice;
  const rank = (m) => {
    const p = P[m.id];
    if (!p) return 1;
    if (p.due <= now) return 0;
    return 2 + p.last / 1e13;
  };
  const byChapter = new Map();
  for (const m of shuffle(ctx.allMcqs()).filter((m) => !chapterId || m.chapterId === chapterId))
    (byChapter.get(m.chapterId) || byChapter.set(m.chapterId, []).get(m.chapterId)).push(m);
  for (const list of byChapter.values()) list.sort((a, b) => rank(a) - rank(b));
  const lists = [...byChapter.values()];
  const out = [];
  while (out.length < SET_SIZE && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < SET_SIZE) out.push(l.shift());
  return out;
}

export function renderPractice(ctx) {
  const page = h(`<div class="page"><h2>Practice</h2><p class="sub">Exam-style questions. Phase 1: MCQs. Phase 2: written answers.</p><div class="body"></div></div>`);
  const body = page.querySelector(".body");
  const banks = ctx.chapters.filter((c) => ctx.practice[c.id]);

  // One chapter scope for the whole tab, so the written list stays short.
  // "" = all chapters mixed: interleaved MCQs, and one summary row per chapter.
  const MIXED = "";
  let scope = ctx.state.settings.practiceChapter;
  if (scope === undefined || (scope !== MIXED && !banks.some((c) => c.id === scope)))
    scope = banks.some((c) => c.id === ctx.chapter?.id) ? ctx.chapter.id : banks[0]?.id;
  const setScope = (id) => {
    scope = id;
    ctx.state.settings.practiceChapter = id;
    ctx.commit({ quiet: true });
    home();
  };

  const stats = (ids) => {
    const tried = ids.filter((id) => ctx.state.practice[id]);
    const right = tried.filter((id) => ctx.state.practice[id].lastCorrect).length;
    return tried.length ? `${right}/${tried.length} right last time` : "not started";
  };
  const essayStats = (items) => {
    const done = items.filter((it) => ctx.state.essays[it.id]);
    if (!done.length) return `${items.length} questions · not started`;
    const avg = done.reduce((a, it) => a + ctx.state.essays[it.id].score, 0) / done.length;
    return `${done.length}/${items.length} answered · average ${avg.toFixed(1)}/10`;
  };

  const home = (focusId) => {
    const ch = banks.find((c) => c.id === scope);
    const mcqs = ch ? ctx.practice[ch.id].mcq : banks.flatMap((c) => ctx.practice[c.id].mcq);
    body.replaceChildren(
      h(`<div>
        <div class="box practice-start">
          <label for="practice-scope">Chapter</label>
          <select id="practice-scope">${banks.map((c, i) => `<option value="${esc(c.id)}">${i + 1}. ${esc(c.title)}</option>`).join("")}<option value="">All chapters, mixed</option></select>
        </div>
        <div class="section-h">Phase 1 · MCQ sets</div>
        <div class="box practice-start">
          <p class="prompt">${mcqs.length} questions${ch ? "" : " from every chapter, interleaved"} · ${stats(mcqs.map((m) => m.id))}</p>
          <button class="btn primary big" data-start>Start ${Math.min(SET_SIZE, mcqs.length)} questions</button>
          <p class="prompt">Questions you missed come first. You'll rate your confidence before seeing each answer.</p>
        </div>
        <div class="section-h">Phase 2 · Written answers</div>
        <div class="essay-list"></div>
      </div>`)
    );
    const sel = body.querySelector("#practice-scope");
    sel.value = scope;
    sel.onchange = () => setScope(sel.value);
    body.querySelector("[data-start]").onclick = () => runSet(scope);
    const list = body.querySelector(".essay-list");

    if (!ch) {
      // Mixed: a short summary per chapter instead of every question.
      for (const c of banks) {
        const items = ctx.practice[c.id].descriptive || [];
        if (!items.length) continue;
        const row = h(`<button class="reel-row"><span class="t">${esc(c.title)}<small>${esc(essayStats(items))}</small></span><span class="pill na">Open</span></button>`);
        row.onclick = () => setScope(c.id);
        list.append(row);
      }
      return;
    }
    const items = ctx.practice[ch.id].descriptive || [];
    if (!items.length) return list.append(h(`<p class="prompt">No written questions for this chapter yet.</p>`));
    list.append(h(`<div class="list-h">${esc(essayStats(items))}</div>`));
    for (const it of items) {
      const s = ctx.state.essays[it.id];
      const row = h(`
        <button class="reel-row" data-id="${esc(it.id)}">
          <span class="t"><small>${esc(it.source || "")}</small>${esc(it.q)}</span>
          ${s ? `<span class="pill ${s.score >= 7 ? "ok" : s.score >= 4 ? "na" : "no"}">${s.score}/10</span>` : `<span class="pill na">new</span>`}
        </button>`);
      row.onclick = () => openEssay(it);
      list.append(row);
    }
    // Coming back from an answer: return to the same spot in the list.
    const back = focusId && list.querySelector(`[data-id="${CSS.escape(focusId)}"]`);
    if (back) requestAnimationFrame(() => back.scrollIntoView({ block: "center" }));
  };

  const openEssay = (it) => {
    body.replaceChildren(essayView(it, { saved: null, onResult: (r) => ctx.recordEssay(it.id, r), onBack: () => home(it.id) }));
    page.scrollTop = 0;
  };

  const runSet = (chapterId) => {
    const set = pickSet(ctx, chapterId);
    const results = [];
    let i = 0;
    const show = () => {
      if (i >= set.length) return summary();
      const m = set[i];
      const wrap = h(`<div><div class="session-bar"><i style="width:${(100 * i) / set.length}%"></i></div><p class="sub">Question ${i + 1} of ${set.length}</p></div>`);
      wrap.append(
        mcqCard(m, {
          label: m.chapterTitle,
          onDone: (r) => {
            if (r.record) {
              results.push({ m, ...r });
              ctx.recordMcq(m.id, r.correct, r.conf);
            } else {
              i++;
              show();
            }
          },
        })
      );
      body.replaceChildren(wrap);
      page.scrollTop = 0;
    };
    const summary = () => {
      const right = results.filter((r) => r.correct).length;
      const sure = results.filter((r) => r.conf === "sure");
      const sureRight = sure.filter((r) => r.correct).length;
      const missed = results.filter((r) => !r.correct);
      body.replaceChildren(
        h(`<div>
          <div class="score">${right}<small>/${results.length}</small></div>
          <div class="box"><h4>Confidence check</h4>${
            sure.length
              ? `When you said "Sure", you were right ${sureRight} of ${sure.length} times.${sureRight < sure.length ? " Confident mistakes come back in a few minutes in Today." : " Well calibrated."}`
              : "You weren't sure of any answer. Those questions return tomorrow."
          }</div>
          ${missed.length ? `<div class="box"><h4>Re-watch</h4><div class="rewatch"></div></div>` : ""}
          <div class="row"><button class="btn" data-home>Back</button><button class="btn primary" data-again>Another set</button></div>
        </div>`)
      );
      const rw = body.querySelector(".rewatch");
      for (const r of missed) {
        const ch = ctx.chapters.find((c) => c.id === r.m.chapterId);
        const reel = ch?.reels.find((x) => x.id === r.m.reelId);
        if (!reel) continue;
        const b = h(`<button class="reel-row"><span class="e">${esc(reel.emoji || "▶")}</span><span class="t">${esc(reel.title)}</span></button>`);
        b.onclick = () => ctx.openReel(ch.id, reel.id);
        rw.append(b);
      }
      body.querySelector("[data-home]").onclick = () => home();
      body.querySelector("[data-again]").onclick = () => runSet(chapterId);
    };
    show();
  };

  if (!banks.length) body.replaceChildren(h(`<div class="empty"><div class="big">📝</div>No practice questions yet.</div>`));
  else home();
  return page;
}
