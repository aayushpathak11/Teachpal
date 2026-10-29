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

// Practice bank (content/practice/<id>.json): exam-style MCQs and descriptive questions.
export const STATEMENT_OPTIONS = /^(\d( and \d)? only|Both \d and \d|Neither \d nor \d|All of [1-9 ,and]+|None of [1-9 ,and]+)$/;
export function validatePractice(pr, chapter) {
  const errors = [];
  const reelIds = new Set(chapter.reels.map((r) => r.id));
  const ids = new Set();
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  (pr.mcq || []).forEach((m, i) => {
    const p = `mcq[${i}] ${m.id || ""}`;
    if (!str(m.id) || ids.has(m.id)) errors.push(`${p}: missing or duplicate id`);
    ids.add(m.id);
    if (!str(m.q) || !Array.isArray(m.options) || m.options.length !== 4) errors.push(`${p}: needs q and 4 options`);
    if (!Number.isInteger(m.answer) || m.answer < 0 || m.answer > 3) errors.push(`${p}: bad answer index`);
    if (!str(m.why)) errors.push(`${p}: needs why`);
    if (m.reelId && !reelIds.has(m.reelId)) errors.push(`${p}: unknown reelId ${m.reelId}`);
  });
  (pr.descriptive || []).forEach((d, i) => {
    const p = `descriptive[${i}] ${d.id || ""}`;
    if (!str(d.id) || ids.has(d.id)) errors.push(`${p}: missing or duplicate id`);
    ids.add(d.id);
    if (!str(d.q) || !Array.isArray(d.keyPoints) || d.keyPoints.length < 3) errors.push(`${p}: needs q and at least 3 keyPoints`);
    for (const r of d.reelIds || []) if (!reelIds.has(r)) errors.push(`${p}: unknown reelId ${r}`);
  });
  if (!(pr.mcq || []).length) errors.push("practice bank has no MCQs");
  return errors;
}

// Concept-map chains (content/maps/<id>.json): ordered cause-and-effect steps.
export function validateMap(map, chapter) {
  const errors = [];
  const reelIds = new Set(chapter.reels.map((r) => r.id));
  const ids = new Set();
  const all = new Set();
  if (map.chapter !== chapter.id) errors.push(`chapter "${map.chapter}" does not match "${chapter.id}"`);
  (map.chains || []).forEach((c, i) => {
    const p = `chains[${i}] ${c.id || ""}`;
    if (!c.id || ids.has(c.id)) errors.push(`${p}: missing or duplicate id`);
    ids.add(c.id);
    if (!c.title) errors.push(`${p}: needs a title`);
    if (!Array.isArray(c.steps) || c.steps.length < 3) errors.push(`${p}: needs at least 3 steps`);
    for (const s of c.steps || []) {
      if (all.has(s)) errors.push(`${p}: step repeated in this chapter's maps ("${s}"), so a blank could have two answers`);
      all.add(s);
    }
    if (!(c.reelIds || []).length) errors.push(`${p}: needs reelIds`);
    for (const r of c.reelIds || []) if (!reelIds.has(r)) errors.push(`${p}: unknown reelId ${r}`);
  });
  if (!(map.chains || []).length) errors.push("map has no chains");
  return errors;
}
