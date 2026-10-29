import { esc, h } from "./util.js";

// Each scene kind becomes a small animated "slide". Elements with .pop fade in
// one after another (--i sets the order) so the visuals track the narration.

const tag = (s) => (s.extra ? `<span class="extra-tag pop" style="--i:0">Beyond NCERT</span>` : "");
const heading = (s) => (s.heading ? `<h3 class="pop" style="--i:0">${esc(s.heading)}</h3>` : "");

const render = {
  hook: (s) => `
    <div class="scene s-hook">${tag(s)}
      ${s.emoji ? `<div class="emo pop" style="--i:0">${esc(s.emoji)}</div>` : ""}
      <div class="big pop" style="--i:1">${esc(s.big)}</div>
      ${s.sub ? `<div class="sub pop" style="--i:2">${esc(s.sub)}</div>` : ""}
    </div>`,

  points: (s) => `
    <div class="scene s-points">${tag(s)}${heading(s)}
      <ul>${s.items.map((it, i) => `<li class="pop" style="--i:${i + 1}"><span class="ic">${esc(it.icon || "•")}</span><span>${esc(it.text)}</span></li>`).join("")}</ul>
    </div>`,

  stat: (s) => `
    <div class="scene s-stat">${tag(s)}
      <div class="val pop" style="--i:0" data-count>${esc(s.value)}</div>
      <div class="lbl pop" style="--i:1">${esc(s.label)}</div>
      ${s.compare ? `<div class="vs pop" style="--i:3"><div class="val" data-count>${esc(s.compare.value)}</div><div class="lbl">${esc(s.compare.label)}</div></div>` : ""}
    </div>`,

  bars: (s) => {
    const max = Math.max(...s.bars.map((b) => b.value), 1);
    return `
    <div class="scene s-bars">${tag(s)}${heading(s)}
      ${s.bars.map((b, i) => `
        <div class="bar pop" style="--i:${i + 1}">
          <div class="bar-l"><span>${esc(b.label)}</span><b>${esc(b.display ?? b.value + (s.unit || ""))}</b></div>
          <div class="track"><div class="fillbar" data-w="${(b.value / max) * 100}"></div></div>
        </div>`).join("")}
    </div>`;
  },

  flow: (s) => `
    <div class="scene s-flow">${tag(s)}${heading(s)}
      <ol>${s.steps.map((st, i) => `<li class="pop" style="--i:${i + 1}">${i ? `<span class="arrow">↓</span>` : ""}<span class="step">${esc(st)}</span></li>`).join("")}</ol>
    </div>`,

  compare: (s) => `
    <div class="scene s-compare">${tag(s)}${heading(s)}
      <div class="cols">
        ${[s.left, s.right].map((c, i) => `
          <div class="col pop" style="--i:${i * 2 + 1}"><h4>${esc(c.title)}</h4><ul>${c.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </div>`,

  quote: (s) => `
    <div class="scene s-quote">${tag(s)}
      <blockquote class="pop" style="--i:0">${esc(s.text)}</blockquote>
      <cite class="pop" style="--i:2">— ${esc(s.by)}</cite>
    </div>`,

  timeline: (s) => `
    <div class="scene s-timeline">${tag(s)}${heading(s)}
      <ol>${s.events.map((e, i) => `<li class="pop" style="--i:${i + 1}"><div class="yr">${esc(e.year)}</div><div class="ev">${esc(e.text)}</div></li>`).join("")}</ol>
    </div>`,
};

export function renderScene(scene) {
  const el = h((render[scene.kind] || render.hook)(scene));
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) animate(el);
  else el.querySelectorAll(".fillbar").forEach((b) => (b.style.width = b.dataset.w + "%"));
  return el;
}

function animate(el) {
  el.querySelectorAll(".fillbar").forEach((b, i) => setTimeout(() => (b.style.width = b.dataset.w + "%"), 450 * (i + 1) + 150));

  // Count up the number inside values like "85%", "<2%", "32 yrs", "218".
  el.querySelectorAll("[data-count]").forEach((node, k) => {
    const m = node.textContent.match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const [, pre, num, post] = m;
    const target = parseFloat(num);
    const decimals = (num.split(".")[1] || "").length;
    const start = performance.now() + k * 1300;
    node.textContent = pre + (0).toFixed(decimals) + post;
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - start) / 900));
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = pre + (target * eased).toFixed(decimals) + post;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
