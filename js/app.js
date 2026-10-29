import { loadState, saveState, resetState, markActive, streak, mergeState } from "./store.js";
import * as sync from "./sync.js";
import { newCard, grade } from "./srs.js";
import { createFeed } from "./feed.js";
import { renderToday, dueCount } from "./today.js";
import { renderPractice } from "./practice.js";
import { scheduleMcq, scheduleExplain, firstExplainDue } from "./schedule.js";
import { renderProgress } from "./progress.js";
import { renderRevise } from "./revise.js";
import { newsCardRefs } from "./news.js";
import { esc, h } from "./util.js";
import * as tts from "./tts.js";
import { textHash } from "./tts.js";

const view = document.getElementById("view");
const startEl = document.getElementById("start");
const startBtn = document.getElementById("start-btn");
const titleEl = document.getElementById("chapter-title");

const cardKey = (chId, reelId, i) => `${chId}/${reelId}/${i}`;

const ctx = {
  state: loadState(),
  chapters: [],
  chapter: null,
  practice: {}, // chapterId -> practice bank (MCQs, descriptive questions)

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
  // A recorded narration segment for this scene ("s0", "s1", …) or the quiz, if
  // the learner uses the recorded voice and the recording matches the current text.
  clipFor(ch, reel, key) {
    const v = ctx.state.settings.voiceURI;
    if (v && v !== "recorded") return null;
    const rec = ch.audio?.reels?.[reel.id];
    const seg = rec?.segments?.[key];
    if (!seg) return null;
    const card = /^c(\d+)([qa])$/.exec(key);
    const text = card ? reel.cards[+card[1]]?.[card[2]] : key === "quiz" ? "Quick check. " + reel.quiz.q : reel.scenes[+key.slice(1)]?.say;
    if (!text || seg.h !== textHash(text)) return null;
    return { src: `${ch.audioBase}${rec.file}`, start: seg.start, end: seg.end, sents: seg.sents };
  },

  // Every card in the reviews: chapter cards plus cards saved from the news.
  allCardRefs() {
    return [...ctx.chapters.flatMap((ch) => ctx.cardRefs(ch)), ...newsCardRefs(ctx)];
  },

  // Recorded audio for a card's question ("q") or answer ("a"), for audio revision.
  cardClip(ref, side) {
    const ch = ctx.chapters.find((c) => c.id === ref.chapterId);
    const reel = ch?.reels.find((r) => r.id === ref.reelId);
    return reel ? ctx.clipFor(ch, reel, `c${ref.key.split("/").pop()}${side}`) : null;
  },

  allMcqs() {
    return ctx.chapters.flatMap((ch) => (ctx.practice[ch.id]?.mcq || []).map((m) => ({ ...m, chapterId: ch.id, chapterTitle: ch.title })));
  },

  allEssays() {
    return ctx.chapters.flatMap((ch) => (ctx.practice[ch.id]?.descriptive || []).map((d) => ({ ...d, chapterId: ch.id, chapterTitle: ch.title })));
  },

  recordMcq(id, correct, conf) {
    ctx.state.practice[id] = scheduleMcq(ctx.state.practice[id], correct, conf);
    markActive(ctx.state);
    ctx.commit();
  },

  recordEssay(id, r) {
    ctx.state.essays[id] = { score: r.score, ai: r.ai, last: r.last, answer: String(r.answer).slice(0, 3000) };
    markActive(ctx.state);
    ctx.commit();
  },

  recordExplain(chId, reelId, score) {
    const k = `${chId}/${reelId}`;
    ctx.state.explain[k] = scheduleExplain(ctx.state.explain[k], score);
    markActive(ctx.state);
    ctx.commit();
  },

  recordMap(chId, chainId, score) {
    const k = `${chId}/${chainId}`;
    ctx.state.maps[k] = scheduleExplain(ctx.state.maps[k], score);
    markActive(ctx.state);
    ctx.commit();
  },

  // A news item linked to the chapters; its cards start tomorrow, like a reel's.
  saveNews(item) {
    const now = Date.now();
    const id = now.toString(36);
    ctx.state.news[id] = { ...item, id, at: now, last: now };
    item.cards.forEach((_, i) => (ctx.state.cards[`news/${id}/${i}`] = newCard(now, { dueNow: false })));
    markActive(ctx.state);
    ctx.commit();
  },

  // Kept as a marker (not removed) so a sync from another device doesn't bring it back.
  deleteNews(id) {
    const n = ctx.state.news[id];
    if (!n) return;
    n.cards.forEach((_, i) => delete ctx.state.cards[`news/${id}/${i}`]);
    ctx.state.news[id] = { id, deleted: true, last: Date.now(), cards: [] };
    ctx.commit();
  },

  recordPretest(ch, reel, choice) {
    ctx.state.pretest[`${ch.id}/${reel.id}`] = { at: Date.now(), last: Date.now(), choice, correct: choice === reel.quiz.answer };
    ctx.commit({ quiet: true });
  },

  recordQuiz(ch, reel, correct) {
    const now = Date.now();
    ctx.state.reels[`${ch.id}/${reel.id}`] = { seen: now, quiz: { correct, at: now } };
    const ek = `${ch.id}/${reel.id}`;
    if (!ctx.state.explain[ek]) ctx.state.explain[ek] = { due: firstExplainDue(now), attempts: 0, last: now }; // explain it back tomorrow
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
  const due = ctx.chapters.length ? dueCount(ctx) : 0;
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
    const render = { today: renderToday, practice: renderPractice, revise: renderRevise, progress: renderProgress }[name];
    pageEl.replaceChildren(render(ctx));
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
  ctx.chapters = await Promise.all(
    index.chapters.map(async (c) => {
      const ch = { ...(await (await fetch(`content/${c.file}`)).json()), status: c.status };
      if (c.practice) ctx.practice[ch.id] = await fetch(`content/${c.practice}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (c.maps) ch.maps = await fetch(`content/${c.maps}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (c.audio) {
        ch.audioBase = `content/${c.audio.replace(/[^/]+$/, "")}`;
        ch.audio = await fetch(`content/${c.audio}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      }
      return ch;
    })
  );
  selectChapter(ctx.state.lastFeed?.chapter || ctx.chapters[0].id);
  tts.setPreferredVoice(ctx.state.settings.voiceURI);
  refreshChrome();

  const ch = ctx.chapter;
  document.getElementById("start-sub").innerHTML = `<b>${esc(ch.title)}</b><br>${ch.reels.length} reels · ${ctx.cardRefs(ch).length} recall cards`;
  startBtn.disabled = false;

  sync.connect(
    () => ctx.state,
    (remote) => {
      ctx.state = mergeState(ctx.state, remote);
      tts.setPreferredVoice(ctx.state.settings.voiceURI);
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
