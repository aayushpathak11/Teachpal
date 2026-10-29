import { esc, h } from "./util.js";
import { MATURE_DAYS, strength } from "./srs.js";
import { streak } from "./store.js";
import { syncStatus } from "./sync.js";
import * as tts from "./tts.js";

const DAY = 864e5;

export function renderProgress(ctx) {
  const { state } = ctx;
  const now = Date.now();
  const refs = ctx.allCardRefs();
  const cards = refs.map((r) => state.cards[r.key]).filter(Boolean);
  const quizzes = Object.values(state.reels).map((r) => r.quiz).filter(Boolean);
  const acc = quizzes.length ? Math.round((100 * quizzes.filter((q) => q.correct).length) / quizzes.length) : null;

  const prac = Object.values(state.practice || {});
  const pracAcc = prac.length ? Math.round((100 * prac.filter((p) => p.lastCorrect).length) / prac.length) : null;
  const sure = prac.filter((p) => p.conf === "sure");
  const calib = sure.length ? Math.round((100 * sure.filter((p) => p.lastCorrect).length) / sure.length) : null;
  const essays = Object.values(state.essays || {});
  const essayAvg = essays.length ? (essays.reduce((s, e) => s + e.score, 0) / essays.length).toFixed(1) : null;

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
      <p class="sub">${streak(state) ? `🔥 ${streak(state)}-day streak` : "Study today to start a streak"} · ${
        { synced: "☁️ Synced to your Claude account", syncing: "☁️ Syncing…", offline: "⚠️ Sync paused, saved on this device", local: "Saved on this device" }[syncStatus()]
      }</p>
      <div class="stats">
        <div class="stat-tile"><div class="n">${Object.keys(state.reels).length}</div><div class="l">reels completed</div></div>
        <div class="stat-tile"><div class="n">${acc == null ? "–" : acc + "%"}</div><div class="l">quiz accuracy</div></div>
        <div class="stat-tile"><div class="n">${cards.filter((c) => c.ivl < MATURE_DAYS).length}</div><div class="l">cards learning</div></div>
        <div class="stat-tile"><div class="n">${cards.filter((c) => c.ivl >= MATURE_DAYS).length}</div><div class="l">cards mastered (21+ day gap)</div></div>
        <div class="stat-tile"><div class="n">${pracAcc == null ? "–" : pracAcc + "%"}</div><div class="l">practice MCQs right (latest try)</div></div>
        <div class="stat-tile"><div class="n">${calib == null ? "–" : calib + "%"}</div><div class="l">right when you said "Sure"</div></div>
        <div class="stat-tile"><div class="n">${essayAvg ?? "–"}</div><div class="l">average written-answer score /10</div></div>
        <div class="stat-tile"><div class="n">${Object.values(state.explain || {}).filter((x) => x.attempts).length}</div><div class="l">reels explained back</div></div>
      </div>
      <div class="section-h">Reviews due, next 7 days</div>
      <div class="forecast">${forecast
        .map((n, d) => `<div class="fcol"><span class="fn">${n || ""}</span><div class="fbar" style="height:${(n / fmax) * 55}px"></div><span>${dayName(d)}</span></div>`)
        .join("")}</div>
      <div class="section-h">Narration voice</div>
      <div class="voice-box">
        <div class="row"><select id="voice-select" aria-label="Narration voice"></select><button class="btn" data-preview>▶ Preview</button></div>
        <p class="voice-tip">The recorded voice sounds the most natural. ★ = a natural-sounding device voice. If a device voice sounds robotic, add a better one to your device:
          <b>iPhone</b>: Settings → Accessibility → Spoken Content → Voices → English → download an "Enhanced" or "Premium" voice.
          <b>Android</b>: install Speech Services by Google, then download English (India).
          <b>Windows</b>: open the app in Microsoft Edge, which has "Natural" voices. Then reload.</p>
      </div>
      <div class="section-h">Learning settings</div>
      <label class="setting"><input type="checkbox" id="set-pretest" ${state.settings.pretest !== false ? "checked" : ""}> <span><b>Guess first.</b> Show each new reel's question before it plays. Trying first, even wrongly, makes the answer stick.</span></label>
      <div class="chapters"></div>
      <button class="danger" data-reset>Reset all progress</button>
    </div>`);

  const sel = page.querySelector("#voice-select");
  const hasRecorded = ctx.chapters.some((c) => c.audio);
  const usingRecorded = () => hasRecorded && (!state.settings.voiceURI || state.settings.voiceURI === "recorded");
  const fillVoices = () => {
    const list = tts.englishVoices();
    const cur = tts.currentVoice();
    const rec = hasRecorded ? `<option value="recorded" ${usingRecorded() ? "selected" : ""}>★ TeachPal natural voices (recorded, a new voice each reel)</option>` : "";
    sel.innerHTML =
      rec +
      list.map((v) => `<option value="${esc(v.voiceURI)}" ${!usingRecorded() && v === cur ? "selected" : ""}>${tts.voiceScore(v) >= 40 ? "★ " : ""}${esc(v.name)} (${esc(v.lang)})</option>`).join("");
    if (!rec && !list.length) sel.innerHTML = `<option>No voices on this device (captions only)</option>`;
    sel.disabled = !rec && !list.length;
  };
  fillVoices();
  tts.onVoicesChanged(fillVoices);
  const preview = () => {
    const ch = ctx.chapter;
    const clip = usingRecorded() && ctx.clipFor(ch, ch.reels[0], "s0");
    const opts = { ...state.settings, muted: false };
    if (clip) return tts.playClip(clip, opts);
    tts.speak("In 1947, about 85 percent of Indians depended on agriculture. Let's see why it stagnated.", opts);
  };
  sel.onchange = () => {
    state.settings.voiceURI = sel.value;
    if (sel.value !== "recorded") tts.setPreferredVoice(sel.value);
    ctx.commit({ quiet: true });
    preview();
  };
  page.querySelector("[data-preview]").onclick = preview;

  page.querySelector("#set-pretest").onchange = (e) => {
    state.settings.pretest = e.target.checked;
    ctx.commit({ quiet: true });
  };

  const chWrap = page.querySelector(".chapters");
  for (const ch of ctx.chapters) {
    chWrap.append(h(`<div class="section-h">${esc(ch.title)}${ch.status === "reviewed" ? " · ✅ reviewed" : ch.status === "needs-attention" ? " · ⚠️ needs attention" : ""}</div>`));
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

  // Two-step confirm inside the page (hosted pages can't show browser dialogs).
  const resetBtn = page.querySelector("[data-reset]");
  resetBtn.onclick = () => {
    if (resetBtn.dataset.armed) return ctx.reset();
    resetBtn.dataset.armed = "1";
    resetBtn.textContent = "Tap again to erase all progress, streaks and cards";
    setTimeout(() => {
      delete resetBtn.dataset.armed;
      resetBtn.textContent = "Reset all progress";
    }, 4000);
  };
  return page;
}
