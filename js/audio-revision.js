import { esc, h } from "./util.js";
import * as tts from "./tts.js";

// Audio revision with recall pauses: hear a card's question, answer it in your
// head during the pause, then hear the answer. Listening alone is passive; the
// pause turns it into retrieval practice. Recorded Kokoro clips are used when
// they match the card's text, otherwise the device voice.
//   refs: card refs (ctx.allCardRefs() shape); grade: (key, g) => void, or null
//   when the cards aren't due (grading early would distort their schedule).
export function audioRevision(ctx, { refs, title, pauseSec = 5, grade, onExit }) {
  const el = h(`
    <div class="audio-rev">
      <div class="row ar-top"><b class="grow">🎧 ${esc(title)}</b><button class="link" data-exit>Stop</button></div>
      <div class="session-bar"><i></i></div>
      <p class="sub ar-count"></p>
      <div class="fc ar-card">
        <div class="from ar-from"></div>
        <div class="q ar-q"></div>
        <div class="ar-pause" hidden><div class="ar-ring"><span></span></div><p class="prompt">Answer it in your head…</p><button class="btn" data-reveal>Reveal now</button></div>
        <div class="a ar-a" hidden></div>
        <div class="row ar-grade" hidden><button class="btn" data-g="0">✗ Missed it</button><button class="btn primary" data-g="2">✓ Knew it</button></div>
      </div>
      <div class="row ar-controls"><button class="btn" data-pause>⏸ Pause</button><button class="btn" data-skip>Skip ⏭</button></div>
      <p class="prompt">Tip: keep the screen on. ${grade ? "Tap Knew it or Missed it to update the card's schedule; if you don't tap, it just moves on." : "These cards aren't due, so this is extra practice and doesn't change their schedule."}</p>
    </div>`);
  const $ = (s) => el.querySelector(s);
  const settings = { ...ctx.state.settings, muted: false };
  let i = 0;
  let paused = false;
  let stopped = false;
  let run = 0; // bumps on pause/skip so a superseded loop step stops
  let wakeLock = null;
  let knew = 0;
  const graded = new Set();
  let skipWait = null; // resolves the current pause early

  const wait = (ms, my) =>
    new Promise((res) => {
      const t = setTimeout(res, ms);
      skipWait = () => (clearTimeout(t), res());
    }).then(() => my === run && !paused && !stopped);

  const say = async (ref, side, my) => {
    const clip = ctx.cardClip(ref, side);
    const text = side === "q" ? ref.q : ref.a;
    if (clip) {
      const r = await tts.playClip(clip, settings);
      if (r !== "failed") return my === run && !paused && !stopped;
    }
    await tts.speak(text, settings);
    return my === run && !paused && !stopped;
  };

  const show = (ref) => {
    $(".session-bar i").style.width = `${(100 * i) / refs.length}%`;
    $(".ar-count").textContent = `Card ${i + 1} of ${refs.length}`;
    $(".ar-from").textContent = `${ref.reelEmoji || ""} ${ref.reelTitle}`;
    $(".ar-q").textContent = ref.q;
    $(".ar-a").textContent = ref.a;
    $(".ar-a").hidden = true;
    $(".ar-pause").hidden = true;
    $(".ar-grade").hidden = true;
  };

  const step = async () => {
    const my = ++run;
    if (i >= refs.length) return finish();
    const ref = refs[i];
    show(ref);
    if (!(await say(ref, "q", my))) return;
    $(".ar-pause").hidden = false;
    const ring = $(".ar-ring");
    ring.style.setProperty("--dur", `${pauseSec}s`);
    ring.classList.remove("run");
    void ring.offsetWidth; // restart the countdown animation
    ring.classList.add("run");
    $(".ar-ring span").textContent = pauseSec;
    const tick = setInterval(() => {
      const s = $(".ar-ring span");
      if (+s.textContent > 1) s.textContent = +s.textContent - 1;
    }, 1000);
    const go = await wait(pauseSec * 1000, my);
    clearInterval(tick);
    if (!go) return;
    $(".ar-pause").hidden = true;
    $(".ar-a").hidden = false;
    if (grade && !graded.has(ref.key)) $(".ar-grade").hidden = false;
    if (!(await say(ref, "a", my))) return;
    if (!(await wait(2500, my))) return;
    i++;
    step();
  };

  const finish = async () => {
    run++;
    tts.cancel();
    wakeLock?.release?.().catch(() => {});
    el.replaceChildren(
      h(`<div class="empty">
        <div class="big">🎧</div>
        <p><b>Done: ${refs.length} card${refs.length === 1 ? "" : "s"}.</b>${grade && graded.size ? ` You knew ${knew} of the ${graded.size} you marked.` : ""}</p>
        <button class="btn primary" data-back>Back to Revise</button>
      </div>`)
    );
    el.querySelector("[data-back]").onclick = () => onExit?.();
  };

  $(".ar-grade").addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]")?.dataset.g;
    const ref = refs[i];
    if (g == null || !ref || graded.has(ref.key)) return;
    graded.add(ref.key);
    if (+g > 0) knew++;
    grade(ref.key, +g);
    $(".ar-grade").hidden = true;
  });
  $("[data-reveal]").onclick = () => skipWait?.();
  $("[data-skip]").onclick = () => {
    tts.cancel();
    skipWait?.();
    i++;
    paused = false;
    $("[data-pause]").textContent = "⏸ Pause";
    step();
  };
  $("[data-pause]").onclick = () => {
    paused = !paused;
    $("[data-pause]").textContent = paused ? "▶ Resume" : "⏸ Pause";
    if (paused) {
      run++;
      tts.cancel();
      skipWait?.();
    } else step(); // replay the current card from its question
  };
  $("[data-exit]").onclick = () => {
    stopped = true;
    run++;
    tts.cancel();
    skipWait?.();
    wakeLock?.release?.().catch(() => {});
    onExit?.();
  };

  // Keep the screen on while revising, where the browser allows it.
  navigator.wakeLock?.request?.("screen").then((l) => (wakeLock = l)).catch(() => {});
  tts.unlock();
  if (refs.length) step();
  else finish();
  return el;
}
