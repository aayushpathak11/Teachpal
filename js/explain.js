import { esc, h } from "./util.js";
import { askJSON, explainPrompt, followUpPrompt } from "./ai.js";

// Explain-it-back: a day after a reel, the learner explains it from memory;
// AI points out gaps and asks one "why?" follow-up (elaborative interrogation).
// Without AI, the learner compares against the reel's key facts and rates themselves.
export function explainCard(reel, { onDone }) {
  const el = h(`
    <div class="fc explain">
      <div class="from">${esc(reel.emoji || "")} Explain it back</div>
      <div class="q">In your own words: ${esc(reel.title)}</div>
      <div class="prompt">From memory, no peeking. 3–6 sentences. Explain the <i>why</i>, not just the facts.</div>
      <textarea rows="6" id="explain-${esc(reel.id)}" placeholder="Type, or use your keyboard's microphone to speak…"></textarea>
      <button class="btn primary big" data-check disabled>Check my explanation</button>
      <div class="result"></div>
    </div>`);
  const ta = el.querySelector("textarea");
  const btn = el.querySelector("[data-check]");
  const out = el.querySelector(".result");
  ta.addEventListener("input", () => (btn.disabled = ta.value.trim().split(/\s+/).length < 8));

  btn.onclick = async () => {
    btn.disabled = true;
    ta.readOnly = true;
    out.innerHTML = `<div class="box">Thinking…</div>`;
    const res = await askJSON(explainPrompt(reel, ta.value.trim()));
    const d = res.data;
    if (d && Number.isFinite(+d.score)) {
      const score = Math.max(0, Math.min(10, Math.round(+d.score)));
      out.innerHTML = `
        <div class="score">${score}<small>/10</small></div>
        ${d.good ? `<div class="box good"><h4>What you got right</h4>${esc(d.good)}</div>` : ""}
        ${(d.missed || []).length ? `<div class="box"><h4>Missing or off</h4><ul>${d.missed.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
        ${d.followUp ? `<div class="box exam"><h4>Why? One follow-up</h4><p>${esc(d.followUp)}</p>
          <textarea rows="3" id="followup-${esc(reel.id)}" placeholder="Your answer…"></textarea>
          <div class="row"><button class="btn" data-skip>Skip</button><button class="btn primary" data-fu>Answer</button></div><div class="fu-out"></div></div>` : ""}`;
      const finish = () => onDone({ score });
      if (!d.followUp) return out.append(nextBtn(finish));
      out.querySelector("[data-skip]").onclick = () => finish();
      out.querySelector("[data-fu]").onclick = async (e) => {
        const ans = out.querySelector(`#followup-${CSS.escape(reel.id)}`).value.trim();
        if (!ans) return;
        e.target.disabled = true;
        const fo = out.querySelector(".fu-out");
        fo.innerHTML = `<div class="prompt">Checking…</div>`;
        const r2 = await askJSON(followUpPrompt(reel, d.followUp, ans));
        fo.innerHTML = r2.data?.feedback
          ? `<div class="why ${r2.data.correct ? "" : "bad"}">${r2.data.correct ? "✅" : "💡"} ${esc(r2.data.feedback)}</div>`
          : `<div class="prompt">${esc(r2.error || "Couldn't check that one.")}</div>`;
        out.querySelector("[data-skip]")?.remove();
        fo.append(nextBtn(finish));
      };
    } else {
      // Self-check fallback against the reel's key facts.
      out.innerHTML = `
        ${res.error ? `<div class="box warn">${esc(res.error)}</div>` : ""}
        <div class="box"><h4>Compare with the key facts</h4><ul>${reel.cards.map((c) => `<li>${esc(c.a)}</li>`).join("")}</ul></div>
        <div class="prompt">How well did your explanation match?</div>
        <div class="grades3"><button class="btn" data-s="2">Missed most</button><button class="btn" data-s="6">Partly</button><button class="btn" data-s="9">Got it</button></div>`;
      out.querySelector(".grades3").onclick = (e) => {
        const s = e.target.closest("[data-s]")?.dataset.s;
        if (s) onDone({ score: +s });
      };
    }
  };
  return el;
}

function nextBtn(fn) {
  const b = h(`<button class="btn primary big">Next</button>`);
  b.onclick = fn;
  return b;
}
