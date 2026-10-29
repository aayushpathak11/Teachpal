// Progress lives in localStorage on this device. Every access is guarded so the
// app still works (without persistence) in private windows or blocked storage.

const KEY = "teachpal:v1";

function blank() {
  return { cards: {}, reels: {}, practice: {}, essays: {}, explain: {}, pretest: {}, maps: {}, news: {}, days: [], settings: { rate: 1, muted: false, pretest: true }, lastFeed: null };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...blank(), ...JSON.parse(raw) };
      s.settings = { ...blank().settings, ...s.settings };
      return s;
    }
  } catch {}
  return blank();
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function resetState() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  return blank();
}

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function markActive(state) {
  const today = dayKey();
  if (!state.days.includes(today)) state.days = [...state.days.slice(-400), today];
}

export function streak(state) {
  const days = new Set(state.days);
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // streak survives until the day is over
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Combine progress from two devices: newest review wins per card, newest quiz per
// reel, study days are unioned. Position in the feed stays per device.
export function mergeState(local, remote) {
  const out = { ...local, cards: { ...remote.cards }, reels: { ...remote.reels } };
  for (const [k, c] of Object.entries(local.cards || {})) {
    const r = out.cards[k];
    if (!r || (c.last || 0) > (r.last || 0) || ((c.last || 0) === (r.last || 0) && c.reps > r.reps)) out.cards[k] = c;
  }
  for (const [k, v] of Object.entries(local.reels || {})) {
    const r = out.reels[k];
    if (!r || (v.quiz?.at || 0) > (r.quiz?.at || 0)) out.reels[k] = v;
  }
  // v2/v3 items: keep whichever side touched each entry last.
  for (const k of ["practice", "essays", "explain", "pretest", "maps", "news"]) {
    out[k] = { ...(remote[k] || {}) };
    for (const [id, v] of Object.entries(local[k] || {})) if (!out[k][id] || (v.last || 0) >= (out[k][id].last || 0)) out[k][id] = v;
  }
  out.days = [...new Set([...(remote.days || []), ...(local.days || [])])].sort().slice(-400);
  out.settings = { ...local.settings, ...(remote.settings || {}) };
  out.lastFeed = local.lastFeed || remote.lastFeed || null;
  return out;
}
