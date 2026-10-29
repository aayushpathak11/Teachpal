import { loadState, saveState, resetState, markActive, streak, mergeState } from "./store.js";
import * as sync from "./sync.js";
import { newCard, grade } from "./srs.js";
import { createFeed } from "./feed.js";
import { renderReview } from "./review.js";
import { renderProgress } from "./progress.js";
import { esc, h } from "./util.js";
import * as tts from "./tts.js";

const view = document.getElementById("view");
const startEl = document.getElementById("start");
const startBtn = document.getElementById("start-btn");
const titleEl = document.getElementById("chapter-title");

const cardKey = (chId, reelId, i) => `${chId}/${reelId}/${i}`;

const ctx = {
  state: loadState(),
  chapters: [],
  chapter: null,

  commit({ quiet } = {}) {
    saveState(ctx.state);
    sync.schedule();
    if (!quiet) refreshChrome();
  },

  cardRefs(ch) {
    return ch.reels.flatMap((r) =>
      r.cards.map((c, i) => ({ key: cardKey(ch.id, r.id, i), chapterId: ch.id, reelId: r.id, reelTitle: r.title, reelEmoji: r.emoji, q: c.q, a: c.a }))
    );
  },
  allCardRefs() {
    return ctx.chapters.flatMap((ch) => ctx.cardRefs(ch));
  },

  recordQuiz(ch, reel, correct) {
    const now = Date.now();
    ctx.state.reels[`${ch.id}/${reel.id}`] = { seen: now, quiz: { correct, at: now } };
    reel.cards.forEach((_, i) => {
      const k = cardKey(ch.id, reel.id, i);
      const existing = ctx.state.cards[k];
      if (!existing) ctx.state.cards[k] = newCard(now, { dueNow: !correct });
      else if (!correct) existing.due = Math.min(existing.due, now); // a miss pulls the cards forward
    });
    markActive(ctx.state);
    ctx.commit();
  },

  gradeCard(key, g) {
    ctx.state.cards[key] = grade(ctx.state.cards[key], g);
    markActive(ctx.state);
    ctx.commit();
  },

  goTab(name) {
    showTab(name);
  },

  openReel(chId, reelId) {
    selectChapter(chId);
    feed.jumpToReel(reelId);
    showTab("feed");
  },

  reset() {
    ctx.state = resetState();
    ctx.commit({ quiet: true });
    feeds.clear();
    selectChapter(ctx.chapters[0].id);
    showTab("progress");
  },
};

// ---------- chrome ----------
function refreshChrome() {
  const now = Date.now();
  const due = Object.values(ctx.state.cards).filter((c) => c.due <= now).length;
  const badge = document.getElementById("due-badge");
  badge.hidden = !due;
  badge.textContent = due > 99 ? "99+" : due;
  const s = streak(ctx.state);
  document.getElementById("streak").textContent = s ? `🔥 ${s}` : "";
}

function renderTitle() {
  if (ctx.chapters.length > 1) {
    const sel = h(`<select aria-label="Chapter" style="max-width:100%;background:transparent;color:inherit;border:0;font:inherit">${ctx.chapters
      .map((c) => `<option value="${esc(c.id)}" ${c.id === ctx.chapter.id ? "selected" : ""}>${esc(c.title)}</option>`)
      .join("")}</select>`);
    sel.onchange = () => {
      selectChapter(sel.value);
      showTab("feed");
    };
    titleEl.replaceChildren(sel);
  } else titleEl.textContent = ctx.chapter.title;
}

// ---------- feed per chapter (kept alive so scroll position survives tab switches) ----------
const feeds = new Map();
let feed = null;
let tab = "feed";
const pageEl = h(`<div style="height:100%"></div>`);

function selectChapter(id) {
  ctx.chapter = ctx.chapters.find((c) => c.id === id) || ctx.chapters[0];
  if (!feeds.has(ctx.chapter.id)) feeds.set(ctx.chapter.id, createFeed(ctx.chapter, ctx));
  feed?.pause();
  feed = feeds.get(ctx.chapter.id);
  renderTitle();
}

function showTab(name) {
  tab = name;
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  feed.pause();
  if (name === "feed") {
    view.replaceChildren(feed.el);
    feed.start();
  } else {
    pageEl.replaceChildren(name === "review" ? renderReview(ctx) : renderProgress(ctx));
    view.replaceChildren(pageEl);
  }
  refreshChrome();
}

document.querySelector(".tabbar").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) showTab(b.dataset.tab);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) sync.flush();
  if (document.hidden) feed?.pause();
  else if (tab === "feed" && startEl.hidden) feed?.start();
});

// ---------- boot ----------
async function boot() {
  const index = await (await fetch("content/index.json")).json();
  ctx.chapters = await Promise.all(index.chapters.map(async (c) => ({ ...(await (await fetch(`content/${c.file}`)).json()), status: c.status })));
  selectChapter(ctx.state.lastFeed?.chapter || ctx.chapters[0].id);
  refreshChrome();

  const ch = ctx.chapter;
  document.getElementById("start-sub").innerHTML = `<b>${esc(ch.title)}</b><br>${ch.reels.length} reels · ${ctx.cardRefs(ch).length} recall cards`;
  startBtn.disabled = false;

  sync.connect(
    () => ctx.state,
    (remote) => {
      ctx.state = mergeState(ctx.state, remote);
      saveState(ctx.state);
      refreshChrome();
      if (tab !== "feed") showTab(tab); // re-render review/progress with merged data
    }
  );
  startBtn.onclick = () => {
    tts.unlock();
    startEl.hidden = true;
    showTab("feed");
  };
}

boot().catch((err) => {
  document.getElementById("start-sub").textContent = "Couldn't load chapter content. Serve this folder over http (npm start), not as a file.";
  console.error(err);
});

if ("serviceWorker" in navigator && location.protocol === "https:" && !window.claude) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
