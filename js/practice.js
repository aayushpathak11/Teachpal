import { esc, h, shuffle } from "./util.js";
import { mcqCard } from "./mcq.js";
import { essayView } from "./essay.js";

const SET_SIZE = 10;
// Mixed test: MCQs and written answers from every chapter, in one sitting.
const TESTS = { quick: { mcq: 8, written: 1, label: "Quick · 8 MCQs + 1 written" }, full: { mcq: 15, written: 3, label: "Full · 15 MCQs + 3 written" } };

// Choose a practice set: due/missed questions first, then unseen, then the
// least recently seen, interleaved across chapters.
function pickSet(ctx, chapterId, size = SET_SIZE) {
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
  while (out.length < size && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < size) out.push(l.shift());
  return out;
}

// Written questions for a mixed test: never-tried first, then the lowest scores,
// then the oldest attempts, taking one chapter at a time so they spread out.
function pickWritten(ctx, n) {
  const E = ctx.state.essays;
  const rank = (d) => (E[d.id] ? 1 + E[d.id].score / 11 + (E[d.id].last || 0) / 1e15 : Math.random() / 10);
  const byChapter = new Map();
  for (const d of ctx.allEssays()) (byChapter.get(d.chapterId) || byChapter.set(d.chapterId, []).get(d.chapterId)).push(d);
  const lists = shuffle([...byChapter.values()].map((l) => l.sort((a, b) => rank(a) - rank(b))));
  const out = [];
  while (out.length < n && lists.some((l) => l.length)) for (const l of lists) if (l.length && out.length < n) out.push(l.shift());
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
        <div class="section-h">Mixed test · all chapters</div>
        <div class="box practice-start">
          <p class="prompt">MCQs and written answers from all ${banks.length} chapters, shuffled together like the real exam. Weak and unseen questions come first.</p>
          <div class="row">${Object.entries(TESTS).map(([k, t]) => `<button class="btn ${k === "quick" ? "primary" : ""}" data-test="${k}">${t.label}</button>`).join("")}</div>
        </div>
        <div class="section-h">By chapter</div>
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
    body.querySelectorAll("[data-test]").forEach((b) => (b.onclick = () => runTest(TESTS[b.dataset.test])));
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

  const runTest = (t) => {
    const mcqs = pickSet(ctx, MIXED, t.mcq);
    const written = pickWritten(ctx, t.written);
    // Spread the written questions evenly between the MCQs.
    const queue = [];
    const gap = Math.ceil(mcqs.length / (written.length + 1));
    let w = 0;
    mcqs.forEach((m, i) => {
      queue.push({ type: "mcq", m });
      if (w < written.length && (i + 1) % gap === 0) queue.push({ type: "written", d: written[w++] });
    });
    while (w < written.length) queue.push({ type: "written", d: written[w++] });
    const results = [];
    let i = 0;
    const show = () => {
      if (i >= queue.length) return testSummary(t, results);
      const q = queue[i];
      const wrap = h(`<div><div class="session-bar"><i style="width:${(100 * i) / queue.length}%"></i></div><p class="sub">Mixed test · ${i + 1} of ${queue.length}</p></div>`);
      const next = () => {
        i++;
        show();
      };
      if (q.type === "mcq")
        wrap.append(
          mcqCard(q.m, {
            label: q.m.chapterTitle,
            onDone: (r) => {
              if (!r.record) return next();
              results.push({ type: "mcq", m: q.m, ...r });
              ctx.recordMcq(q.m.id, r.correct, r.conf);
            },
          })
        );
      else
        wrap.append(
          essayView(q.d, {
            saved: null,
            label: `Written · ${q.d.chapterTitle}`,
            onResult: (r) => {
              results.push({ type: "written", d: q.d, score: r.score });
              ctx.recordEssay(q.d.id, r);
            },
            onNext: next,
          })
        );
      body.replaceChildren(wrap);
      page.scrollTop = 0;
    };
    show();
  };

  const testSummary = (t, results) => {
    const mcq = results.filter((r) => r.type === "mcq");
    const right = mcq.filter((r) => r.correct).length;
    const sure = mcq.filter((r) => r.conf === "sure");
    const sureRight = sure.filter((r) => r.correct).length;
    const written = results.filter((r) => r.type === "written");
    const avg = written.length ? written.reduce((a, r) => a + r.score, 0) / written.length : null;
    // Per chapter, so a weak chapter stands out.
    const byCh = new Map();
    for (const r of mcq) {
      const c = byCh.get(r.m.chapterTitle) || { right: 0, n: 0 };
      c.n++;
      c.right += r.correct ? 1 : 0;
      byCh.set(r.m.chapterTitle, c);
    }
    const weakReels = [
      ...mcq.filter((r) => !r.correct).map((r) => [r.m.chapterId, r.m.reelId]),
      ...written.filter((r) => r.score < 5).map((r) => [r.d.chapterId, r.d.reelIds?.[0]]),
    ];
    body.replaceChildren(
      h(`<div>
        <div class="stats">
          <div class="stat-tile"><div class="n">${right}/${mcq.length}</div><div class="l">MCQs right</div></div>
          <div class="stat-tile"><div class="n">${avg == null ? "–" : avg.toFixed(1)}</div><div class="l">written average /10${written.length ? ` (${written.length} answered)` : " (skipped)"}</div></div>
        </div>
        <div class="box"><h4>By chapter</h4><ul class="kp">${[...byCh].map(([title, c]) => `<li class="${c.right === c.n ? "ok" : "no"}">${c.right}/${c.n} · ${esc(title)}</li>`).join("")}</ul></div>
        <div class="box"><h4>Confidence check</h4>${
          sure.length ? `When you said "Sure", you were right ${sureRight} of ${sure.length} times.${sureRight < sure.length ? " Confident mistakes come back in a few minutes in Today." : " Well calibrated."}` : "You weren't sure of any answer. Those questions return tomorrow."
        }</div>
        ${weakReels.length ? `<div class="box"><h4>Re-watch</h4><div class="rewatch"></div></div>` : ""}
        <div class="row"><button class="btn" data-home>Back</button><button class="btn primary" data-again>Another test</button></div>
      </div>`)
    );
    const rw = body.querySelector(".rewatch");
    const seen = new Set();
    for (const [chId, reelId] of weakReels) {
      const ch = ctx.chapters.find((c) => c.id === chId);
      const reel = ch?.reels.find((x) => x.id === reelId);
      if (!reel || seen.has(`${chId}/${reelId}`)) continue;
      seen.add(`${chId}/${reelId}`);
      const b = h(`<button class="reel-row"><span class="e">${esc(reel.emoji || "▶")}</span><span class="t">${esc(reel.title)}<small>${esc(ch.title)}</small></span></button>`);
      b.onclick = () => ctx.openReel(ch.id, reel.id);
      rw.append(b);
    }
    body.querySelector("[data-home]").onclick = () => home();
    body.querySelector("[data-again]").onclick = () => runTest(t);
    page.scrollTop = 0;
  };

  if (!banks.length) body.replaceChildren(h(`<div class="empty"><div class="big">📝</div>No practice questions yet.</div>`));
  else home();
  return page;
}
