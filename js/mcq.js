import { esc, h, shuffle } from "./util.js";
import { STATEMENT } from "./statement.js";

// An exam-style MCQ: pick an answer, say how sure you are, then see feedback.
// Asking for confidence before revealing the answer is what lets a confident
// mistake be flagged (and corrected) the moment it happens.
export function mcqCard(item, { label = "", onDone }) {
  const order = item.options.every((o) => STATEMENT.test(o)) ? item.options.map((_, i) => i) : shuffle(item.options.map((_, i) => i));
  const el = h(`
    <div class="fc mcq">
      ${label ? `<div class="from">${esc(label)}</div>` : ""}
      <div class="q mcq-q">${esc(item.q).replace(/\n/g, "<br>")}</div>
      <div class="opts">${order.map((i, pos) => `<button class="opt" data-i="${i}">${String.fromCharCode(65 + pos)}. ${esc(item.options[i])}</button>`).join("")}</div>
      <div class="conf" hidden>
        <div class="prompt">How sure are you?</div>
        <div class="row"><button class="btn" data-c="guess">Guessing</button><button class="btn" data-c="unsure">Unsure</button><button class="btn" data-c="sure">Sure</button></div>
      </div>
      <div class="after"></div>
    </div>`);
  let chosen = null;
  el.querySelector(".opts").addEventListener("click", (e) => {
    const b = e.target.closest(".opt");
    if (!b || b.disabled) return;
    el.querySelectorAll(".opt").forEach((x) => x.classList.toggle("picked", x === b));
    chosen = +b.dataset.i;
    el.querySelector(".conf").hidden = false;
  });
  el.querySelector(".conf").addEventListener("click", (e) => {
    const c = e.target.closest("[data-c]")?.dataset.c;
    if (!c || chosen == null) return;
    const correct = chosen === item.answer;
    el.querySelector(".conf").remove();
    el.querySelectorAll(".opt").forEach((b) => {
      b.disabled = true;
      const i = +b.dataset.i;
      if (i === item.answer) b.classList.add("right");
      else if (i === chosen) b.classList.add("wrong");
    });
    const note =
      !correct && c === "sure"
        ? `<div class="box warn"><h4>⚡ Confident mistake</h4>You were sure, and it was wrong. Read the explanation twice: corrected confident mistakes are the ones you remember best. It'll come back in a few minutes.</div>`
        : !correct
          ? `<div class="box"><h4>🔁 Coming back soon</h4>This one returns later today.</div>`
          : c !== "sure"
            ? `<div class="box"><h4>👍 Right, but not sure yet</h4>It'll come back tomorrow to make it stick.</div>`
            : "";
    el.querySelector(".after").innerHTML = `
      <div class="why ${correct ? "" : "bad"}"><b>${correct ? "✅ Correct." : "❌ Not quite."}</b> ${esc(item.why)}</div>${note}
      <button class="btn primary big" data-next>Next</button>`;
    el.querySelector("[data-next]").onclick = () => onDone?.({ correct, conf: c });
    onDone?.({ correct, conf: c, record: true });
  });
  return el;
}
