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
