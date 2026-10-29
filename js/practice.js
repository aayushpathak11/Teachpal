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

  const home = () => {
    const stats = (ids) => {
      const tried = ids.filter((id) => ctx.state.practice[id]);
      const right = tried.filter((id) => ctx.state.practice[id].lastCorrect).length;
      return tried.length ? `${right}/${tried.length} right last time` : "not started";
    };
    body.replaceChildren(
      h(`<div>
        <div class="section-h">Phase 1 · MCQ sets</div>
        <div class="box practice-start">
          <label for="mcq-scope">Chapters</label>
          <select id="mcq-scope"><option value="">All chapters, mixed</option>${banks.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")}</select>
          <button class="btn primary big" data-start>Start ${SET_SIZE} questions</button>
          <p class="prompt">Questions you missed come first. You'll rate your confidence before seeing each answer.</p>
        </div>
        <div class="section-h">Phase 2 · Written answers</div>
        <div class="essay-list"></div>
      </div>`)
    );
    body.querySelector("[data-start]").onclick = () => runSet(body.querySelector("#mcq-scope").value);
    const list = body.querySelector(".essay-list");
    for (const ch of banks) {
      const items = ctx.practice[ch.id].descriptive || [];
      if (!items.length) continue;
      list.append(h(`<div class="list-h">${esc(ch.title)} · MCQs: ${stats(ctx.practice[ch.id].mcq.map((m) => m.id))}</div>`));
      for (const it of items) {
        const s = ctx.state.essays[it.id];
        const row = h(`
          <button class="reel-row">
            <span class="t"><small>${esc(it.source || "")}</small>${esc(it.q)}</span>
            ${s ? `<span class="pill ${s.score >= 7 ? "ok" : s.score >= 4 ? "na" : "no"}">${s.score}/10</span>` : `<span class="pill na">new</span>`}
          </button>`);
        row.onclick = () => openEssay(it);
        list.append(row);
      }
    }
  };

  const openEssay = (it) => {
    body.replaceChildren(essayView(it, { saved: null, onResult: (r) => ctx.recordEssay(it.id, r), onBack: home }));
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
      body.querySelector("[data-home]").onclick = home;
      body.querySelector("[data-again]").onclick = () => runSet(chapterId);
    };
    show();
  };

  if (!banks.length) body.replaceChildren(h(`<div class="empty"><div class="big">📝</div>No practice questions yet.</div>`));
  else home();
  return page;
}
