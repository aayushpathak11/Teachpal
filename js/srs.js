// A compact SM-2 style scheduler. Intervals are in days.
// Grades: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy.

const MIN = 60e3;
const DAY = 864e5;
export const MATURE_DAYS = 21;

export function newCard(now, { dueNow }) {
  return { reps: 0, ease: 2.5, ivl: 0, lapses: 0, due: dueNow ? now : now + DAY, last: null };
}

function nextInterval(c, g) {
  if (g === 0) return 0;
  if (g === 1) return c.reps === 0 ? 1 : Math.max(1, c.ivl * 1.2);
  if (g === 2) return c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(c.ivl + 1, c.ivl * c.ease);
  return c.reps === 0 ? 3 : c.reps === 1 ? 5 : Math.max(c.ivl + 2, c.ivl * c.ease * 1.3);
}

export function grade(card, g, now = Date.now()) {
  const c = { ...card, last: now };
  const ivl = Math.round(nextInterval(card, g) * 10) / 10;
  if (g === 0) {
    c.reps = 0;
    c.lapses += 1;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.ivl = 0;
    c.due = now + 10 * MIN;
    return c;
  }
  if (g === 1) c.ease = Math.max(1.3, c.ease - 0.15);
  if (g === 3) c.ease += 0.15;
  c.reps += 1;
  c.ivl = ivl;
  c.due = now + ivl * DAY;
  return c;
}

export function previewLabel(card, g) {
  if (g === 0) return "10m";
  const d = nextInterval(card, g);
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

// 0..1 rough "how well do I know this" for progress bars.
export function strength(card) {
  if (!card) return 0;
  return Math.min(1, card.ivl / MATURE_DAYS);
}
