// TeachPal content pipeline: chapter PDF → reviewed reels.
//
//   plan → write → [lint → review → coverage → web fact-check → revise] ×N → publish
//
// Each stage is a separate, single-purpose Claude call (the reviewer never sees
// the writer's reasoning), and plain code decides what runs next. The only
// open-ended step is the fact-checker, which may search the web to verify
// "Beyond NCERT" claims.
//
// Generate a chapter:
//   npm run generate -- chapter.pdf --id eco11-ch02 [--subject "Economics · Class 11"] [--exam "RBI Grade B"]
// Review an existing chapter without changing it:
//   npm run review -- chapter.pdf --chapter content/eco11-ch01.json
//
// Options: --rounds N (max fix rounds, default 2) · --no-web (skip web fact-check)
//          --fresh (ignore cached plan/draft in .work/) · --effort low|medium|high|xhigh|max
//          --concurrency N (default 3) · --out DIR (default content/) · --work DIR (default .work/)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { validateChapter } from "../schema.mjs";
import { ClaudeClient, pdfBlock } from "./claude.mjs";
import * as P from "./prompts.mjs";
import { lintChapter, extraClaims, factcheckIssues, coverageIssues, actionable } from "./checks.mjs";
import { buildReport } from "./report.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: "string" },
    subject: { type: "string", default: "" },
    exam: { type: "string", default: "RBI Grade B" },
    chapter: { type: "string" },
    rounds: { type: "string", default: "2" },
    "no-web": { type: "boolean", default: false },
    fresh: { type: "boolean", default: false },
    effort: { type: "string", default: "high" },
    concurrency: { type: "string", default: "3" },
    out: { type: "string", default: join(ROOT, "content") },
    work: { type: "string", default: join(ROOT, ".work") },
    mock: { type: "boolean", default: false },
  },
});

const pdfPath = positionals[0];
if (!pdfPath) {
  console.error("Usage: npm run generate -- chapter.pdf --id <id>   |   npm run review -- chapter.pdf --chapter content/<id>.json");
  process.exit(1);
}
const mode = opt.chapter ? "review" : "generate";
const existing = opt.chapter ? JSON.parse(await readFile(opt.chapter, "utf8")) : null;
const id = existing?.id || opt.id || basename(pdfPath).replace(/\.pdf$/i, "").toLowerCase();
const maxRounds = Number(opt.rounds);
const conc = Number(opt.concurrency);
const work = join(opt.work, id);
await mkdir(work, { recursive: true });

const log = (...a) => console.log(...a);
const client = opt.mock
  ? new (await import("./test/mock-client.mjs")).MockClient()
  : new ClaudeClient({ effort: opt.effort, log });

// ---------- helpers ----------
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}
const save = (name, data) => writeFile(join(work, name), JSON.stringify(data, null, 2));
async function cached(name) {
  if (opt.fresh || !existsSync(join(work, name))) return null;
  log(`  · reusing ${name} from ${work}`);
  return JSON.parse(await readFile(join(work, name), "utf8"));
}

const pdf = (await readFile(pdfPath)).toString("base64");
const system = P.commonSystem(opt.exam);
const ask = (label, text, check, meta) =>
  client.json({ system, content: [pdfBlock(pdf), { type: "text", text }], label, check, meta });

// ---------- output checks (problems are sent back to the model once) ----------
function checkPlan(p) {
  const errs = [];
  if (!Array.isArray(p.facts) || !p.facts.length) errs.push("facts must be a non-empty array");
  if (!Array.isArray(p.reels) || p.reels.length < 8 || p.reels.length > 24) errs.push("plan 12-20 reels");
  if (errs.length) return errs;
  const factIds = new Set(p.facts.map((f) => f.id));
  const assigned = new Set(p.reels.flatMap((r) => r.factIds || []));
  const ids = p.reels.map((r) => r.id);
  if (new Set(ids).size !== ids.length) errs.push("reel ids must be unique");
  for (const f of p.facts) if (f.importance === "high" && !assigned.has(f.id)) errs.push(`high fact ${f.id} is not assigned to any reel`);
  for (const a of assigned) if (!factIds.has(a)) errs.push(`unknown fact id ${a}`);
  return errs;
}

const checkReels = (wanted) => (d) => {
  if (!Array.isArray(d.reels)) return ["reels must be an array"];
  const errs = validateChapter({ id: "x", title: "x", subject: "x", reels: d.reels });
  const got = d.reels.map((r) => r.id);
  for (const w of wanted) if (!got.includes(w)) errs.push(`missing reel "${w}"`);
  for (const g of got) if (!wanted.includes(g)) errs.push(`unexpected reel "${g}"; use exactly these ids: ${wanted.join(", ")}`);
  return errs;
};

const checkReview = (wanted) => (d) => {
  if (!Array.isArray(d.issues) || !Array.isArray(d.scores)) return ["need issues[] and scores[]"];
  const errs = [];
  for (const i of d.issues) {
    if (!wanted.includes(i.reelId)) errs.push(`issue for unknown reel "${i.reelId}"`);
    if (!["blocker", "major", "minor"].includes(i.severity)) errs.push(`bad severity "${i.severity}"`);
  }
  return errs;
};

// ---------- 1. plan ----------
log(`\n▶ ${mode === "review" ? "Reviewing" : "Generating"} "${id}" from ${pdfPath}`);
log("1. Plan: extract facts and outline reels");
let plan = await cached("plan.json");
if (!plan) {
  plan = await ask("plan", P.planPrompt(), checkPlan, { stage: "plan" });
  await save("plan.json", plan);
}
log(`  ${plan.facts.length} facts (${plan.facts.filter((f) => f.importance === "high").length} high-importance), ${plan.reels.length} reels planned`);

// ---------- 2. write ----------
let chapter = existing;
if (mode === "generate") {
  log("2. Write reels");
  chapter = await cached("draft.json");
  if (!chapter) {
    const refFile = join(ROOT, "content", "eco11-ch01.json");
    const styleReference = existsSync(refFile)
      ? JSON.stringify(JSON.parse(await readFile(refFile, "utf8")).reels.slice(2, 4), null, 1)
      : "(none)";
    const batches = chunk(plan.reels, 3);
    const written = await pool(batches, conc, (b, i) => {
      const ids = b.map((r) => r.id);
      return ask(`write ${i + 1}/${batches.length}`, P.writePrompt({ plan, batch: b, styleReference }), checkReels(ids), { stage: "write", ids });
    });
    chapter = {
      id,
      subject: opt.subject || plan.subject || "Textbook chapter",
      chapter: plan.chapterNumber,
      title: plan.title,
      source: basename(pdfPath),
      exam: opt.exam,
      reels: written.flatMap((w) => w.reels),
    };
    await save("draft.json", chapter);
  }
}

// ---------- 3. review / fix loop ----------
const highFacts = plan.facts.filter((f) => f.importance === "high");
const rounds = [];
const factchecks = [];
const scores = new Map();
let carried = []; // minor review issues on reels that weren't re-reviewed
let dirty = new Set(chapter.reels.map((r) => r.id));

for (let round = 1; ; round++) {
  log(`3.${round} Review round ${round}${round > 1 ? ` (${dirty.size} revised reel${dirty.size > 1 ? "s" : ""})` : ""}`);
  const lint = lintChapter(chapter);
  const toReview = chapter.reels.filter((r) => dirty.has(r.id));

  const reviewBatches = chunk(toReview, 4);
  const reviews = await pool(reviewBatches, conc, (b, i) => {
    const ids = b.map((r) => r.id);
    return ask(`review r${round} ${i + 1}/${reviewBatches.length}`, P.reviewPrompt({ reels: b }), checkReview(ids), { stage: "review", ids, reels: b, round });
  });
  const reviewIssues = reviews.flatMap((r) => r.issues.map((i) => ({ ...i, source: "review" })));
  reviews.forEach((r) => r.scores.forEach((s) => scores.set(s.reelId, s)));

  const cov = highFacts.length
    ? await ask(`coverage r${round}`, P.coveragePrompt({ facts: highFacts, reels: chapter.reels }), (d) => (Array.isArray(d.missing) ? [] : ["need missing[]"]), { stage: "coverage", round })
    : { missing: [] };

  let fcIssues = [];
  if (!opt["no-web"]) {
    const claims = extraClaims(toReview);
    const groups = chunk(claims, 8);
    const results = await pool(groups, conc, (g, i) =>
      client.json({
        system: P.factcheckSystem,
        content: [{ type: "text", text: P.factcheckPrompt(g.map(({ id, claim }) => ({ id, claim }))) }],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.min(20, g.length * 2 + 2) }],
        label: `fact-check r${round} ${i + 1}/${groups.length}`,
        check: (d) => (Array.isArray(d.claims) ? [] : ["need claims[]"]),
        meta: { stage: "factcheck", claims: g, round },
      })
    );
    results.forEach((res, i) => factchecks.push({ round, claims: groups[i], results: res.claims }));
    fcIssues = results.flatMap((res, i) => factcheckIssues(res, groups[i]));
  }

  const issues = [...lint, ...reviewIssues, ...carried, ...coverageIssues(cov, highFacts), ...fcIssues];
  const act = actionable(issues);
  rounds.push({ round, issues, actionable: act.length, scoresAll: [...scores.values()] });
  await save(`round-${round}.json`, { issues, coverage: cov });
  const count = (s) => issues.filter((i) => i.severity === s).length;
  log(`  ${count("blocker")} blocker · ${count("major")} major · ${count("minor")} minor`);

  const fixable = [...new Set(act.map((i) => i.reelId).filter((rid) => chapter.reels.some((r) => r.id === rid)))];
  if (!fixable.length || mode === "review" || round > maxRounds) break;

  log(`  revising ${fixable.length} reel${fixable.length > 1 ? "s" : ""}: ${fixable.join(", ")}`);
  const reviseBatches = chunk(chapter.reels.filter((r) => fixable.includes(r.id)), 3);
  const revised = await pool(reviseBatches, conc, (b, i) => {
    const ids = b.map((r) => r.id);
    const problems = act.filter((x) => ids.includes(x.reelId)).map(({ reelId, where, severity, type, problem, fix }) => ({ reelId, where, severity, type, problem, fix }));
    return ask(`revise r${round} ${i + 1}/${reviseBatches.length}`, P.revisePrompt({ reels: b, problems }), checkReels(ids), { stage: "revise", ids, round });
  });
  const byId = new Map(revised.flatMap((r) => r.reels).map((r) => [r.id, r]));
  chapter = { ...chapter, reels: chapter.reels.map((r) => byId.get(r.id) || r) };
  dirty = new Set(fixable);
  carried = issues.filter((i) => i.source === "review" && i.severity === "minor" && !dirty.has(i.reelId));
  await save("draft.json", chapter);
}

// ---------- 4. publish ----------
const finalErrors = validateChapter(chapter);
if (finalErrors.length) {
  console.error("✗ Final content failed validation:\n  " + finalErrors.join("\n  "));
  process.exit(1);
}
const status = actionable(rounds.at(-1).issues).length ? "needs-attention" : "reviewed";
const report = buildReport({ chapter, plan, rounds, factchecks, status, usage: client.usage, cost: client.costUSD(), mode });
await mkdir(join(opt.out, "reports"), { recursive: true });
const reportPath = join(opt.out, "reports", `${id}.md`);
await writeFile(reportPath, report);

if (mode === "generate") {
  const file = `${id}.json`;
  await writeFile(join(opt.out, file), JSON.stringify(chapter, null, 2) + "\n");
  const indexPath = join(opt.out, "index.json");
  const index = existsSync(indexPath) ? JSON.parse(await readFile(indexPath, "utf8")) : { chapters: [] };
  index.chapters = index.chapters.filter((c) => c.id !== id);
  index.chapters.push({ id, file, title: chapter.title, subject: chapter.subject, status });
  await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n");
  log(`\n✓ Wrote ${join(opt.out, file)} (${chapter.reels.length} reels)`);
}
const cost = client.costUSD();
log(`${status === "reviewed" ? "✓" : "⚠"} Status: ${status} · report: ${resolve(reportPath)}`);
log(`  ${client.usage.calls} API calls${cost != null ? ` · ≈ $${cost.toFixed(2)}` : ""}`);
