// Shape check for chapter content files, shared by validate.mjs and generate-chapter.mjs.

export const SCENE_KINDS = {
  hook: ["big"],
  points: ["heading", "items"],
  stat: ["value", "label"],
  bars: ["heading", "bars"],
  flow: ["heading", "steps"],
  compare: ["heading", "left", "right"],
  quote: ["text", "by"],
  timeline: ["heading", "events"],
};

export function validateChapter(ch) {
  const errors = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const str = (v) => typeof v === "string" && v.trim().length > 0;

  for (const k of ["id", "title", "subject"]) if (!str(ch?.[k])) err(k, "missing string");
  if (!Array.isArray(ch?.reels) || ch.reels.length === 0) {
    err("reels", "must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  ch.reels.forEach((r, i) => {
    const p = `reels[${i}]`;
    if (!str(r.id)) err(p, "missing id");
    else if (ids.has(r.id)) err(p, `duplicate id "${r.id}"`);
    ids.add(r.id);
    if (!str(r.title)) err(p, "missing title");

    if (!Array.isArray(r.scenes) || r.scenes.length === 0) err(p, "scenes must be non-empty");
    else
      r.scenes.forEach((s, j) => {
        const sp = `${p}.scenes[${j}]`;
        const req = SCENE_KINDS[s.kind];
        if (!req) return err(sp, `unknown kind "${s.kind}"`);
        if (!str(s.say)) err(sp, "missing narration 'say'");
        for (const f of req) if (s[f] == null) err(sp, `${s.kind} needs '${f}'`);
        if (s.kind === "points" && !(s.items || []).every((it) => str(it.text))) err(sp, "items need text");
        if (s.kind === "bars" && !(s.bars || []).every((b) => str(b.label) && typeof b.value === "number")) err(sp, "bars need label + numeric value");
        if (s.kind === "flow" && !(s.steps || []).every(str)) err(sp, "steps must be strings");
        if (s.kind === "timeline" && !(s.events || []).every((e) => str(e.year) && str(e.text))) err(sp, "events need year + text");
        if (s.kind === "compare" && !(Array.isArray(s.left?.items) && Array.isArray(s.right?.items))) err(sp, "left/right need items");
      });

    const q = r.quiz;
    if (!q || !str(q.q) || !Array.isArray(q.options) || q.options.length < 2) err(`${p}.quiz`, "needs q + options");
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(`${p}.quiz`, "answer index out of range");

    if (!Array.isArray(r.cards) || r.cards.length === 0) err(`${p}.cards`, "needs at least one card");
    else r.cards.forEach((c, k) => (!str(c.q) || !str(c.a)) && err(`${p}.cards[${k}]`, "needs q + a"));
  });
  return errors;
}
