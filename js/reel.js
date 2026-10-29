import { esc, h, shuffle } from "./util.js";
import { renderScene } from "./scenes.js";
import * as tts from "./tts.js";

const GRADIENTS = [
  ["#3b1f78", "#120a2a"], ["#0f5c5a", "#06201f"], ["#7a2647", "#22091a"], ["#1d4f91", "#08162b"],
  ["#7a4a12", "#231504"], ["#2f6b2a", "#0b1d0a"], ["#5a2a86", "#170a24"], ["#8a2d2d", "#250b0b"],
];
const RATES = [1, 1.25, 1.5, 0.9];

export class Reel {
  constructor({ chapter, reel, index, ctx }) {
    Object.assign(this, { chapter, reel, index, ctx });
    this.sceneIdx = 0;
    this.active = false;
    this.paused = false;
    this.mode = "scenes"; // "scenes" | "quiz" | "info"
    this.el = this.build();
  }

  get settings() {
    return this.ctx.state.settings;
  }

  build() {
    const [a, b] = GRADIENTS[this.index % GRADIENTS.length];
    const r = this.reel;
    const el = h(`
      <div class="reel" style="--reel-bg: linear-gradient(165deg, ${a} 0%, ${b} 75%)">
        <div class="reel-head">
          <div class="segments">${r.scenes.map(() => `<div class="seg"><i></i></div>`).join("")}<div class="seg quiz-seg"><i></i></div></div>
          <div class="reel-meta">
            <span class="num">${this.index + 1}/${this.chapter.reels.length}</span>
            <span class="ttl">${esc(r.emoji || "")} ${esc(r.title)}</span>
            ${r.section ? `<span class="sec">§${esc(r.section)}</span>` : ""}
          </div>
        </div>
        <div class="stage"></div>
        <div class="tapzones"><div data-tap="prev"></div><div data-tap="pause"></div><div data-tap="next"></div></div>
        <div class="paused-ind">⏸</div>
        <div class="caption"></div>
        <div class="side">
          <button data-act="sound" aria-label="Sound on/off"></button>
          <button data-act="rate" aria-label="Narration speed"></button>
          <button data-act="info" aria-label="Beyond the book and exam angle">➕</button>
          <button data-act="quiz" aria-label="Jump to question">❓</button>
        </div>
        <div class="panel quiz-panel" hidden></div>
        <div class="panel info-panel" hidden></div>
      </div>`);

    this.stage = el.querySelector(".stage");
    this.caption = el.querySelector(".caption");
    this.segs = [...el.querySelectorAll(".seg")];
    this.quizPanel = el.querySelector(".quiz-panel");
    this.infoPanel = el.querySelector(".info-panel");

    el.querySelector(".tapzones").addEventListener("click", (e) => {
      const t = e.target.dataset.tap;
      if (t === "prev") this.go(this.sceneIdx - 1);
      else if (t === "next") this.go(this.sceneIdx + 1);
      else if (t === "pause") this.togglePause();
    });
    el.querySelector(".side").addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "sound") this.toggleSound();
      if (act === "rate") this.cycleRate();
      if (act === "info") this.showInfo();
      if (act === "quiz") this.showQuiz();
    });
    this.el = el;
    this.syncSide();
    this.renderStage(0);
    return el;
  }

  syncSide() {
    const s = this.settings;
    const snd = this.el.querySelector('[data-act="sound"]');
    snd.textContent = s.muted ? "🔇" : "🔊";
    this.el.querySelector('[data-act="rate"]').innerHTML = `<small>${s.rate}×</small>`;
    this.caption.classList.toggle("hidden", false);
  }

  // ---------- lifecycle (driven by the feed) ----------
  activate() {
    this.active = true;
    this.paused = false;
    this.el.classList.remove("is-paused");
    this.syncSide();
    if (this.mode === "scenes") this.play(this.sceneIdx);
  }

  deactivate() {
    this.active = false;
    tts.cancel();
    this.segs[this.sceneIdx]?.classList.remove("run");
  }

  // ---------- scenes ----------
  renderStage(i) {
    this.stage.replaceChildren(renderScene(this.reel.scenes[i]));
  }

  setSegments(i, durMs) {
    this.segs.forEach((s, k) => {
      s.classList.toggle("done", k < i);
      s.classList.remove("run", "paused");
    });
    const cur = this.segs[i];
    if (cur && durMs) {
      void cur.offsetWidth; // restart the CSS animation
      cur.style.setProperty("--dur", durMs + "ms");
      cur.classList.add("run");
    }
  }

  async play(i) {
    const scenes = this.reel.scenes;
    if (i < 0) i = 0;
    if (i >= scenes.length) return this.showQuiz();
    this.sceneIdx = i;
    this.mode = "scenes";
    this.paused = false;
    this.el.classList.remove("is-paused");
    this.quizPanel.hidden = true;
    this.infoPanel.hidden = true;

    const scene = scenes[i];
    this.renderStage(i);
    const sentences = tts.splitSentences(scene.say);
    this.caption.innerHTML = sentences.map((s) => `<span>${esc(s)} </span>`).join("");
    const spans = [...this.caption.children];
    const { rate, muted } = this.settings;
    const clip = this.ctx.clipFor(this.chapter, this.reel, `s${i}`);
    this.setSegments(i, clip ? ((clip.end - clip.start) * 1000) / rate : tts.estimateMs(scene.say, rate));

    const opts = {
      rate,
      muted,
      onSentence: (k) => {
        spans.forEach((sp, j) => (sp.style.opacity = j === k ? 1 : 0.45));
        if (spans[k]) this.caption.scrollTop = spans[k].offsetTop - 10;
      },
    };
    // Recorded narration when available; the device voice otherwise or if it fails.
    let cancelled = clip ? await tts.playClip(clip, opts) : "failed";
    if (cancelled === "failed") cancelled = await tts.speak(scene.say, opts);
    if (cancelled || !this.active || this.paused || this.sceneIdx !== i || this.mode !== "scenes") return;
    this.segs[i].classList.add("done");
    this.play(i + 1);
  }

  go(i) {
    if (this.mode !== "scenes") return;
    this.play(Math.max(0, i));
  }

  togglePause() {
    if (this.mode !== "scenes") return;
    if (this.paused) return this.play(this.sceneIdx);
    this.paused = true;
    tts.cancel();
    this.el.classList.add("is-paused");
    this.segs[this.sceneIdx]?.classList.add("paused");
  }

  toggleSound() {
    this.settings.muted = !this.settings.muted;
    this.ctx.commit();
    this.syncSide();
    if (this.mode === "scenes" && !this.paused) this.play(this.sceneIdx);
  }

  cycleRate() {
    const i = RATES.indexOf(this.settings.rate);
    this.settings.rate = RATES[(i + 1) % RATES.length];
    this.ctx.commit();
    this.syncSide();
    if (this.mode === "scenes" && !this.paused) this.play(this.sceneIdx);
  }

  // ---------- info panel: beyond the book + exam angle ----------
  showInfo() {
    const r = this.reel;
    tts.cancel();
    const prevMode = this.mode;
    this.mode = "info";
    this.infoPanel.innerHTML = `
      <div class="kicker">Go deeper</div>
      <h3>${esc(r.title)}</h3>
      ${r.beyond ? `<div class="box extra"><h4>🔭 Beyond NCERT</h4>${esc(r.beyond)}</div>` : ""}
      ${r.examAngle ? `<div class="box exam"><h4>🎯 ${esc(this.chapter.exam || "Exam")} angle</h4>${esc(r.examAngle)}</div>` : ""}
      <div class="row"><button class="btn primary" data-close>Back to reel</button></div>`;
    this.infoPanel.hidden = false;
    this.infoPanel.querySelector("[data-close]").onclick = () => {
      this.infoPanel.hidden = true;
      if (prevMode === "quiz") {
        this.mode = "quiz";
      } else {
        this.mode = "scenes";
        this.play(this.sceneIdx);
      }
    };
  }

  // ---------- end-of-reel retrieval question ----------
  showQuiz() {
    tts.cancel();
    this.mode = "quiz";
    this.infoPanel.hidden = true;
    this.setSegments(this.segs.length - 1, 0);
    this.segs[this.segs.length - 1].classList.add("done");
    const q = this.reel.quiz;
    const p = this.quizPanel;
    const order = shuffle(q.options.map((_, i) => i)); // new order each time, so position can't be memorised
    p.innerHTML = `
      <div class="kicker">Quick check · answer before you scroll</div>
      <h3>${esc(q.q)}</h3>
      <div class="opts">${order.map((i, pos) => `<button class="opt" data-i="${i}">${String.fromCharCode(65 + pos)}. ${esc(q.options[i])}</button>`).join("")}</div>
      <div class="after"></div>`;
    p.hidden = false;
    p.scrollTop = 0;
    if (this.active) {
      const clip = this.ctx.clipFor(this.chapter, this.reel, "quiz");
      (clip ? tts.playClip(clip, this.settings) : Promise.resolve("failed")).then((r) => {
        if (r === "failed" && this.mode === "quiz") tts.speak("Quick check. " + q.q, this.settings);
      });
    }

    p.querySelector(".opts").addEventListener("click", (e) => {
      const btn = e.target.closest(".opt");
      if (!btn || btn.disabled) return;
      tts.cancel();
      const chosen = +btn.dataset.i;
      const correct = chosen === q.answer;
      p.querySelectorAll(".opt").forEach((b) => {
        const i = +b.dataset.i;
        b.disabled = true;
        if (i === q.answer) b.classList.add("right");
        else if (i === chosen) b.classList.add("wrong");
      });
      this.ctx.recordQuiz(this.chapter, this.reel, correct);
      const r = this.reel;
      p.querySelector(".after").innerHTML = `
        <div class="why ${correct ? "" : "bad"}"><b>${correct ? "✅ Correct!" : "❌ Not quite."}</b> ${esc(q.why || "")}</div>
        <div class="box"><h4>🧠 Added to your recall deck</h4>${r.cards.length} card${r.cards.length > 1 ? "s" : ""} from this reel will come back ${correct ? "tomorrow" : "later today, since you missed this one"}.</div>
        ${r.beyond ? `<div class="box extra"><h4>🔭 Beyond NCERT</h4>${esc(r.beyond)}</div>` : ""}
        ${r.examAngle ? `<div class="box exam"><h4>🎯 ${esc(this.chapter.exam || "Exam")} angle</h4>${esc(r.examAngle)}</div>` : ""}
        <div class="row"><button class="btn" data-replay>↺ Replay reel</button></div>
        <div class="next-hint">Swipe up for the next reel ↑</div>`;
      p.querySelector("[data-replay]").onclick = () => this.play(0);
    });
  }
}
