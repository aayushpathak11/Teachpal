import { esc, h, relTime } from "./util.js";
import { flashcard } from "./flashcard.js";
import { mcqCard } from "./mcq.js";
import { explainCard } from "./explain.js";

const MAX_EXPLAIN = 2;
const MAX_MCQ = 6;

// Everything due today, interleaved across chapters and item types: recall cards,
// practice MCQs that are due again, and next-day explain-it-back.
export function dueItems(ctx, now = Date.now()) {
  const { state } = ctx;
  const cards = ctx
    .allCardRefs()
    .filter((r) => state.cards[r.key] && state.cards[r.key].due <= now)
    .sort((a, b) => state.cards[a.key].due - state.cards[b.key].due)
    .map((ref) => ({ type: "card", ref }));
  const mcqs = ctx
    .allMcqs()
    .filter((m) => state.practice[m.id]?.due <= now)
    .sort((a, b) => state.practice[a.id].due - state.practice[b.id].due)
    .slice(0, MAX_MCQ)
    .map((item) => ({ type: "mcq", item }));
  const explains = [];
  for (const ch of ctx.chapters)
    for (const reel of ch.reels) {
      const key = `${ch.id}/${reel.id}`;
      const ex = state.explain[key];
      const quizAt = state.reels[key]?.quiz?.at;
      const due = ex?.due ?? (quizAt ? quizAt + 20 * 36e5 : null); // older progress: a day after the quiz
      if (due != null && due <= now) explains.push({ type: "explain", ch, reel, due });
    }
  explains.sort((a, b) => a.due - b.due);
  return { cards, mcqs, explains: explains.slice(0, MAX_EXPLAIN) };
}

export function dueCount(ctx) {
  const d = dueItems(ctx);
  return d.cards.length + d.mcqs.length + d.explains.length;
}

function interleave({ cards, mcqs, explains }) {
  const out = [];
  const pattern = ["card", "card", "mcq", "card", "explain"];
  const pools = { card: [...cards], mcq: [...mcqs], explain: [...explains] };
  while (pools.card.length || pools.mcq.length || pools.explain.length)
    for (const t of pattern) if (pools[t].length) out.push(pools[t].shift());
  return out;
}

export function renderToday(ctx) {
  const page = h(`<div class="page"><h2>Today</h2><p class="sub">Your mixed daily session: what's due across every chapter.</p><div class="body"></div></div>`);
  const body = page.querySelector(".body");
  const queue = interleave(dueItems(ctx));
  const total = queue.length;
  let done = 0;

  const next = () => {
    const it = queue.shift();
    if (!it) return finish();
    const wrap = h(`<div><div class="session-bar"><i style="width:${(100 * done) / total}%"></i></div><p class="sub">${done + 1} of ${total}</p></div>`);
    const advance = () => {
      done++;
      setTimeout(next, 200);
    };
    if (it.type === "card")
      wrap.append(flashcard(it.ref, ctx.state.cards[it.ref.key], { onGrade: (g) => (ctx.gradeCard(it.ref.key, g), advance()) }));
    if (it.type === "mcq")
      wrap.append(
        mcqCard(it.item, {
          label: `Practice · ${it.item.chapterTitle}`,
          onDone: (r) => (r.record ? ctx.recordMcq(it.item.id, r.correct, r.conf) : advance()),
        })
      );
    if (it.type === "explain") wrap.append(explainCard(it.reel, { onDone: ({ score }) => (ctx.recordExplain(it.ch.id, it.reel.id, score), advance()) }));
    body.replaceChildren(wrap);
    page.scrollTop = 0;
  };

  const finish = () => {
    const now = Date.now();
    const upcoming = [
      ...Object.values(ctx.state.cards).map((c) => c.due),
      ...Object.values(ctx.state.practice).map((p) => p.due),
      ...Object.values(ctx.state.explain).map((x) => x.due),
    ]
      .filter((d) => d > now)
      .sort((a, b) => a - b)[0];
    const started = Object.keys(ctx.state.reels).length > 0;
    body.replaceChildren(
      h(`<div class="empty">
        <div class="big">${started ? "🎉" : "🎬"}</div>
        ${
          started
            ? `<p><b>${done ? `Session done: ${done} item${done > 1 ? "s" : ""}.` : "All caught up."}</b></p>${upcoming ? `<p>Next item due in ${relTime(upcoming - now)}.</p>` : ""}`
            : `<p>Nothing due yet. Watch reels in the Feed and answer their questions to start your daily sessions.</p>`
        }
        <p>Want more? Exam-style practice is in the <b>Practice</b> tab.</p>
        <button class="btn primary" data-practice>Go to Practice</button>
      </div>`)
    );
    body.querySelector("[data-practice]").onclick = () => ctx.goTab("practice");
  };
  next();
  return page;
}
