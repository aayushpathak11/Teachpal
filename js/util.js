export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function relTime(ms) {
  const m = Math.round(ms / 60e3);
  if (m < 60) return `${Math.max(1, m)} min`;
  const hrs = Math.round(m / 60);
  if (hrs < 36) return `${hrs} h`;
  return `${Math.round(hrs / 24)} days`;
}

// Grow a textarea with its content so it never scrolls on its own. On phones an
// inner-scrolling textarea swallows the swipe meant to scroll the page.
export function autoGrow(ta) {
  const fit = () => {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  ta.addEventListener("input", fit);
  requestAnimationFrame(fit);
  return fit;
}

// Bring freshly shown feedback into view, below the answer the learner just wrote.
export function reveal(el) {
  requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
}
