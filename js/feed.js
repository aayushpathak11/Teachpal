import { esc, h, shuffle } from "./util.js";
import { Reel } from "./reel.js";
import { flashcard } from "./flashcard.js";
import * as tts from "./tts.js";

const RECALL_EVERY = 3;

// The scrollable feed: reels, with interleaved recall cards and an end card.
export function createFeed(chapter, ctx) {
  const root = h(`<div class="feed"></div>`);
  const items = [];

  chapter.reels.forEach((reel, i) => {
    items.push({ type: "reel", reel, index: i });
    if ((i + 1) % RECALL_EVERY === 0 && i < chapter.reels.length - 1) items.push({ type: "recall", after: i });
  });
  items.push({ type: "end" });

  items.forEach((it, k) => {
    it.slot = h(`<section class="slot" data-k="${k}"></section>`);
    if (it.type === "reel") {
      it.player = new Reel({ chapter, reel: it.reel, index: it.index, ctx });
      it.slot.append(it.player.el);
    }
    root.append(it.slot);
  });

  let current = null;
  let started = false;

  function activate(it) {
    if (current === it) return;
    if (current?.player) current.player.deactivate();
    tts.cancel();
    current = it;
    ctx.state.lastFeed = { chapter: chapter.id, k: items.indexOf(it) };
    ctx.commit({ quiet: true });
    if (!started) return;
    if (it.type === "reel") it.player.activate();
    if (it.type === "recall") fillRecall(it);
    if (it.type === "end") fillEnd(it);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) activate(items[+e.target.dataset.k]);
    },
    { root, threshold: 0.6 }
  );
  items.forEach((it) => io.observe(it.slot));

  // ---------- recall slot: retrieval practice mixed into the feed ----------
  function fillRecall(it) {
    if (it.filled) return;
    const seenReels = chapter.reels.slice(0, it.after + 1).filter((r) => ctx.state.reels[`${chapter.id}/${r.id}`]);
    const refs = ctx.cardRefs(chapter).filter((ref) => seenReels.some((r) => r.id === ref.reelId) && ctx.state.cards[ref.key]);
    if (!refs.length) {
      it.slot.replaceChildren(h(`
        <div class="card-wrap recall">
          <div class="recall-kicker">Recall break</div>
          <div class="empty"><div class="big">🎬</div>Answer the questions at the end of the reels above to unlock recall cards here.</div>
        </div>`));
      return;
    }
    const now = Date.now();
    const due = refs.filter((r) => ctx.state.cards[r.key].due <= now).sort((a, b) => ctx.state.cards[a.key].due - ctx.state.cards[b.key].due);
    const pick = due[0] || shuffle(refs)[0];
    it.filled = true;
    const wrap = h(`
      <div class="card-wrap recall">
        <div class="recall-kicker">Recall break 🧠</div>
        <p class="recall-sub">Pulling an idea back out of memory is what makes it stick.</p>
      </div>`);
    wrap.append(
      flashcard(pick, ctx.state.cards[pick.key], {
        onGrade: (g) => {
          ctx.gradeCard(pick.key, g);
          wrap.append(h(`<div class="next-hint">Nice. Swipe up to keep going ↑</div>`));
        },
      })
    );
    it.slot.replaceChildren(wrap);
  }

  // ---------- end of chapter ----------
  function fillEnd(it) {
    const results = chapter.reels.map((r) => ctx.state.reels[`${chapter.id}/${r.id}`]?.quiz);
    const answered = results.filter(Boolean);
    const correct = answered.filter((q) => q.correct).length;
    const missed = chapter.reels.filter((r, i) => results[i] && !results[i].correct);
    it.slot.replaceChildren(h(`
      <div class="end">
        <div class="big">🏁</div>
        <h2>Chapter complete</h2>
        <p>${answered.length}/${chapter.reels.length} questions answered · <b>${correct}</b> correct.</p>
        ${missed.length ? `<p>Worth a rewatch: ${missed.map((r) => esc(r.title)).join(", ")}.</p>` : ""}
        <p>Your recall cards are scheduled. Come back to <b>Review</b> each day; that's where the long-term memory gets built.</p>
        <button class="btn primary big" data-review>Go to Review</button>
        <button class="btn" data-top>↑ Back to first reel</button>
      </div>`));
    it.slot.querySelector("[data-review]").onclick = () => ctx.goTab("review");
    it.slot.querySelector("[data-top]").onclick = () => scrollToIndex(0);
  }

  // Scroll the feed itself (scrollIntoView could also scroll the page hosting us).
  function scrollToIndex(k, smooth = true) {
    const slot = items[k]?.slot;
    if (slot) root.scrollTo({ top: slot.offsetTop, behavior: smooth ? "smooth" : "instant" });
  }

  return {
    el: root,
    start() {
      started = true;
      const k = ctx.state.lastFeed?.chapter === chapter.id ? ctx.state.lastFeed.k : 0;
      current = null;
      scrollToIndex(Math.min(k, items.length - 1), false);
      requestAnimationFrame(() => {
        const visible = items.find((it) => Math.abs(it.slot.getBoundingClientRect().top - root.getBoundingClientRect().top) < 5);
        activate(visible || items[0]);
      });
    },
    pause() {
      current?.player?.deactivate();
      current = null;
      started = false;
      tts.cancel();
    },
    jumpToReel(reelId) {
      const k = items.findIndex((it) => it.type === "reel" && it.reel.id === reelId);
      if (k >= 0) ctx.state.lastFeed = { chapter: chapter.id, k };
    },
  };
}
