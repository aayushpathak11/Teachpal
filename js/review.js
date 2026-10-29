import { h, relTime } from "./util.js";
import { flashcard } from "./flashcard.js";

// Daily review queue: every card that is due, across all chapters.
export function renderReview(ctx) {
  const page = h(`<div class="page"><h2>Review</h2><p class="sub">Cards come back right before you're likely to forget them.</p><div class="body"></div></div>`);
  const body = page.querySelector(".body");
  let done = 0;

  const next = () => {
    const now = Date.now();
    const refs = ctx.allCardRefs().filter((r) => ctx.state.cards[r.key]);
    const due = refs.filter((r) => ctx.state.cards[r.key].due <= now).sort((a, b) => ctx.state.cards[a.key].due - ctx.state.cards[b.key].due);

    if (!due.length) {
      const upcoming = refs.map((r) => ctx.state.cards[r.key].due).filter((d) => d > now).sort((a, b) => a - b)[0];
      body.replaceChildren(h(`
        <div class="empty">
          <div class="big">${refs.length ? "🎉" : "🎬"}</div>
          ${refs.length
            ? `<p><b>All caught up${done ? `: ${done} card${done > 1 ? "s" : ""} reviewed` : ""}.</b></p><p>Next card due in ${relTime(upcoming - now)}.</p>`
            : `<p>No cards yet. Watch reels in the Feed and answer their questions to build your recall deck.</p>`}
        </div>`));
      return;
    }

    const ref = due[0];
    const wrap = h(`<div><p class="sub">${due.length} due now${done ? ` · ${done} done` : ""}</p></div>`);
    wrap.append(
      flashcard(ref, ctx.state.cards[ref.key], {
        onGrade: (g) => {
          ctx.gradeCard(ref.key, g);
          done++;
          setTimeout(next, 250);
        },
      })
    );
    body.replaceChildren(wrap);
  };
  next();
  return page;
}
