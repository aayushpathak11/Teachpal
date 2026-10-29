// Progress lives in localStorage on this device. Every access is guarded so the
// app still works (without persistence) in private windows or blocked storage.

const KEY = "teachpal:v1";

function blank() {
  return { cards: {}, reels: {}, days: [], settings: { rate: 1, muted: false }, lastFeed: null };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
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
