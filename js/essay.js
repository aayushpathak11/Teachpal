import { autoGrow, esc, h, reveal } from "./util.js";
import { askJSON, gradeEssayPrompt } from "./ai.js";

const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// Closed-book written answer for a Phase 2 style question. The model answer and
// key points stay hidden until the learner has submitted their own attempt.
export function essayView(item, { saved, onResult, onBack }) {
  const el = h(`
    <div class="essay">
      <button class="link" data-back>← All questions</button>
      <div class="kicker">${esc(item.source || "Descriptive")} · about ${item.words || 150} words</div>
      <h3>${esc(item.q)}</h3>
      <p class="prompt">Closed book: write from memory, then get feedback.</p>
      <textarea id="essay-${esc(item.id)}" rows="6" placeholder="Write your answer here…"></textarea>
      <div class="row"><span class="wc">0 words</span><button class="btn primary" data-submit disabled>Get feedback</button></div>
      <div class="result"></div>
    </div>`);
  const ta = el.querySelector("textarea");
  const wc = el.querySelector(".wc");
  const submit = el.querySelector("[data-submit]");
  const result = el.querySelector(".result");
  if (saved?.answer) ta.value = saved.answer;
  const fit = autoGrow(ta);
  const update = () => {
    const n = words(ta.value);
    wc.textContent = `${n} word${n === 1 ? "" : "s"}`;
    submit.disabled = n < 15;
  };
  ta.addEventListener("input", update);
  update();
  el.querySelector("[data-back]").onclick = onBack;

  submit.onclick = async () => {
    const answer = ta.value.trim();
    submit.disabled = true;
    ta.readOnly = true;
    ta.blur(); // close the phone keyboard so the feedback has room
    result.innerHTML = `<div class="box">Thinking… (AI feedback can take up to a minute)</div>`;
    reveal(result);
    const res = await askJSON(gradeEssayPrompt(item, answer));
    const d = res.data;
    if (d && Number.isFinite(+d.score)) {
      const covered = new Set((d.covered || []).map(Number));
      result.innerHTML = `
        <div class="score">${Math.max(0, Math.min(10, Math.round(+d.score)))}<small>/10</small></div>
        ${d.strengths ? `<div class="box good"><h4>What worked</h4>${esc(d.strengths)}</div>` : ""}
        <div class="box"><h4>Key points</h4><ul class="kp">${item.keyPoints
          .map((k, i) => `<li class="${covered.has(i + 1) ? "ok" : "no"}">${covered.has(i + 1) ? "✓" : "✗"} ${esc(k)}</li>`)
          .join("")}</ul></div>
        ${(d.improve || []).length ? `<div class="box"><h4>To improve</h4><ul>${d.improve.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ${d.modelAnswer ? `<div class="box"><button class="btn" data-model aria-expanded="false">Show model answer</button><p class="model" hidden>${esc(d.modelAnswer)}</p></div>` : ""}
        <button class="btn" data-again>Try again</button>`;
      const modelBtn = result.querySelector("[data-model]");
      if (modelBtn) {
        modelBtn.onclick = () => {
          const p = result.querySelector(".model");
          p.hidden = !p.hidden;
          modelBtn.textContent = p.hidden ? "Show model answer" : "Hide model answer";
          modelBtn.setAttribute("aria-expanded", String(!p.hidden));
        };
      }
      onResult({ score: Math.round(+d.score), answer, last: Date.now(), ai: true });
    } else {
      // Self-check fallback: the learner marks which key points they covered.
      result.innerHTML = `
        ${res.error ? `<div class="box warn">${esc(res.error)}</div>` : ""}
        <div class="box"><h4>Self-check: tick the points your answer covered</h4>
          ${item.keyPoints.map((k, i) => `<label class="tick"><input type="checkbox" id="kp-${esc(item.id)}-${i}"> ${esc(k)}</label>`).join("")}
          <button class="btn primary" data-score>Score my answer</button></div>`;
      result.querySelector("[data-score]").onclick = () => {
        const ticked = result.querySelectorAll("input:checked").length;
        const score = Math.round((10 * ticked) / item.keyPoints.length);
        result.querySelector("[data-score]").replaceWith(h(`<div class="score">${score}<small>/10</small></div>`));
        onResult({ score, answer, last: Date.now(), ai: false });
        result.append(h(`<button class="btn" data-again>Try again</button>`));
        result.querySelector("[data-again]").onclick = again;
      };
    }
    result.querySelector("[data-again]")?.addEventListener("click", again);
    submit.hidden = true;
    reveal(result);
  };
  function again() {
    ta.readOnly = false;
    ta.value = "";
    result.innerHTML = "";
    submit.hidden = false;
    update();
    fit();
    ta.focus();
  }
  return el;
}
