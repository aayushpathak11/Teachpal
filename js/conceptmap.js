import { esc, h, shuffle } from "./util.js";

// Fill-in-the-link concept map: a chapter's cause-and-effect chain with some
// links blanked. The learner rebuilds the chain from a word bank (generation and
// retrieval), then explains it aloud (elaboration). Distractors come from the
// chapter's other chains, so the bank can't be solved by elimination alone.
export function mapExercise(chain, { pool = [], onScore, onDone, onRewatch }) {
  const n = chain.steps.length;
  const k = Math.max(1, Math.min(n - 1, Math.round(n * 0.4)));
  const blanks = new Set(shuffle([...chain.steps.keys()]).slice(0, k));
  const distractors = shuffle(pool.filter((s) => !chain.steps.includes(s))).slice(0, Math.min(2, k));
  const bank = shuffle([...[...blanks].map((i) => chain.steps[i]), ...distractors]);
  const filled = new Map(); // step index -> bank index
  let selected = [...blanks].sort((a, b) => a - b)[0];

  const el = h(`
    <div class="cmap">
      <div class="kicker">Fill the links</div>
      <h3>${esc(chain.title)}</h3>
      <p class="prompt">Tap a blank, then the phrase that belongs there. Each step leads to the next.</p>
      <ol class="chain"></ol>
      <div class="bank"></div>
      <button class="btn primary big" data-check disabled>Check</button>
      <div class="result"></div>
    </div>`);
  const list = el.querySelector(".chain");
  const bankEl = el.querySelector(".bank");
  const check = el.querySelector("[data-check]");

  const render = () => {
    list.innerHTML = chain.steps
      .map((s, i) => {
        const arrow = i ? `<li class="arrow" aria-hidden="true">↓</li>` : "";
        if (!blanks.has(i)) return `${arrow}<li><div class="step">${esc(s)}</div></li>`;
        const b = filled.get(i);
        return `${arrow}<li><button class="step slot ${b == null ? "empty" : ""} ${selected === i ? "sel" : ""}" data-slot="${i}">${b == null ? "?" : esc(bank[b])}</button></li>`;
      })
      .join("");
    const used = new Set(filled.values());
    bankEl.innerHTML = bank.map((s, j) => `<button class="chip" data-chip="${j}" ${used.has(j) ? "hidden" : ""}>${esc(s)}</button>`).join("");
    check.disabled = filled.size < blanks.size;
  };

  list.addEventListener("click", (e) => {
    const slot = e.target.closest("[data-slot]");
    if (!slot || check.hidden) return;
    const i = +slot.dataset.slot;
    if (filled.has(i)) filled.delete(i); // tap a filled blank to empty it
    selected = i;
    render();
  });
  bankEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    const target = selected != null && blanks.has(selected) && !filled.has(selected) ? selected : [...blanks].sort((a, b) => a - b).find((i) => !filled.has(i));
    if (target == null) return;
    filled.set(target, +chip.dataset.chip);
    selected = [...blanks].sort((a, b) => a - b).find((i) => !filled.has(i));
    render();
  });

  check.onclick = () => {
    let right = 0;
    for (const i of blanks) {
      const ok = bank[filled.get(i)] === chain.steps[i];
      if (ok) right++;
      const slot = list.querySelector(`[data-slot="${i}"]`);
      slot.classList.add(ok ? "right" : "wrong");
      slot.disabled = true;
      if (!ok) slot.insertAdjacentHTML("afterend", `<div class="fix">✓ ${esc(chain.steps[i])}</div>`);
    }
    check.hidden = true;
    bankEl.remove();
    const score = Math.round((10 * right) / blanks.size);
    onScore?.(score);
    el.querySelector(".result").append(
      h(`<div>
        <div class="why ${right === blanks.size ? "" : "bad"}"><b>${right}/${blanks.size} links right.</b> ${
          right === blanks.size ? "The chain is yours." : "Read the corrected chain top to bottom once more."
        }</div>
        <div class="box exam"><h4>Now say it aloud</h4>Explain the whole chain in your own words, saying <i>why</i> each step leads to the next. That's how a Phase 2 answer is built.</div>
        <div class="row">${chain.reelIds?.length && onRewatch ? `<button class="btn" data-rewatch>Re-watch</button>` : ""}<button class="btn primary" data-done>Done</button></div>
      </div>`)
    );
    el.querySelector("[data-done]").onclick = () => onDone?.();
    const rw = el.querySelector("[data-rewatch]");
    if (rw) rw.onclick = () => onRewatch(chain.reelIds[0]);
  };

  render();
  return el;
}
