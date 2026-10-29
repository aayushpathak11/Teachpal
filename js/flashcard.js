import { esc, h } from "./util.js";
import { previewLabel } from "./srs.js";

// Active-recall card: think of the answer first, reveal, then rate how well you knew it.
export function flashcard(ref, card, { onGrade }) {
  const el = h(`
    <div class="fc">
      <div class="from">${esc(ref.reelEmoji || "")} ${esc(ref.reelTitle)}</div>
      <div class="q">${esc(ref.q)}</div>
      <div class="prompt">Say or write the answer before revealing.</div>
      <button class="btn primary big" data-show>Show answer</button>
    </div>`);

  el.querySelector("[data-show]").onclick = () => {
    el.querySelector(".prompt").remove();
    el.querySelector("[data-show]").remove();
    const labels = ["Again", "Hard", "Good", "Easy"];
    el.append(
      h(`<div class="a">${esc(ref.a)}</div>`),
      h(`<div class="grades">${labels
        .map((l, g) => `<button class="g${g}" data-g="${g}">${l}<small>${previewLabel(card, g)}</small></button>`)
        .join("")}</div>`)
    );
    el.querySelector(".grades").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      el.querySelectorAll(".grades button").forEach((x) => (x.disabled = true));
      b.style.outline = "2px solid var(--text)";
      onGrade(+b.dataset.g);
    });
  };
  return el;
}
