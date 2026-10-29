// Runs the whole pipeline offline with the mock client and checks that planted
// defects are caught by review/fact-check/coverage and fixed by revision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintChapter, extraClaims } from "../checks.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = (args) => execFileSync("node", [join(root, "scripts/pipeline/run.mjs"), ...args], { encoding: "utf8" });
const ch1 = JSON.parse(readFileSync(join(root, "content/eco11-ch01.json"), "utf8"));

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "teachpal-"));
  const pdf = join(dir, "chapter.pdf");
  writeFileSync(pdf, "%PDF-1.4 mock");
  return { dir, pdf, out: join(dir, "content"), work: join(dir, "work") };
}

test("generate: planted defects are found and fixed", () => {
  const { pdf, out, work } = setup();
  const log = run([pdf, "--id", "mock-ch", "--mock", "--out", out, "--work", work]);
  const chapter = JSON.parse(readFileSync(join(out, "mock-ch.json"), "utf8"));
  const zam = chapter.reels.find((r) => r.id === "zamindari-revenue");
  const trade = chapter.reels.find((r) => r.id === "foreign-trade");
  assert.equal(zam.quiz.answer, 1, "wrong quiz answer was corrected");
  assert.ok(!trade.beyond.includes("1859"), "false Beyond-NCERT date was corrected");

  const round1 = JSON.parse(readFileSync(join(work, "mock-ch", "round-1.json"), "utf8"));
  const types = round1.issues.filter((i) => i.severity !== "minor").map((i) => i.type).sort();
  assert.deepEqual(types, ["coverage", "factcheck", "quiz"]);

  const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
  assert.equal(index.chapters[0].status, "reviewed");
  const report = readFileSync(join(out, "reports", "mock-ch.md"), "utf8");
  assert.match(report, /reviewed \(no blocker or major issues left\)/);
  assert.match(report, /3 blocker\/major issues fixed/);
  assert.match(report, /\| railways \| scene 2 \| clarity/, "minor issue on an unrevised reel is carried into the report");
  assert.match(log, /revising 3 reels/);
});

test("review mode reports problems without editing content", () => {
  const { dir, pdf, out, work } = setup();
  const broken = structuredClone(ch1);
  broken.reels.find((r) => r.id === "zamindari-revenue").quiz.answer = 0;
  const file = join(dir, "broken.json");
  writeFileSync(file, JSON.stringify(broken));
  run([pdf, "--chapter", file, "--mock", "--out", out, "--work", work]);
  const report = readFileSync(join(out, "reports", "eco11-ch01.md"), "utf8");
  assert.match(report, /needs attention/);
  assert.match(report, /\| zamindari-revenue \| quiz \| quiz/);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).reels.find((r) => r.id === "zamindari-revenue").quiz.answer, 0, "input untouched");
});

test("lint flags structural problems; chapter 1 is clean of blockers", () => {
  assert.equal(lintChapter(ch1).filter((i) => i.severity !== "minor").length, 0);
  const bad = structuredClone(ch1);
  bad.reels[0].quiz.options[3] = "All of the above";
  bad.reels[1].quiz.options[1] = bad.reels[1].quiz.options[0];
  bad.reels[2].quiz.answer = 9;
  const kinds = lintChapter(bad).map((i) => `${i.reelId}:${i.severity}`);
  assert.ok(kinds.includes("why-1947:major"));
  assert.ok(kinds.includes("pre-british-handicrafts:major"));
  assert.ok(kinds.includes("national-income-estimates:blocker"));
});

test("extra claims include every Beyond-NCERT field and extra scene", () => {
  const claims = extraClaims(ch1.reels);
  assert.equal(claims.filter((c) => c.where === "beyond").length, ch1.reels.filter((r) => r.beyond).length);
  assert.ok(claims.some((c) => c.id === "drain-of-wealth#scene4"));
});

test("voice assignment: stable, uses every voice before repeating, no neighbours alike", async () => {
  const { assignVoices } = await import("../../audio/prepare-lib.mjs");
  const ids = ["a", "b", "c", "d"];
  const v = assignVoices("eco11-ch01", 13, ids);
  assert.deepEqual(v, assignVoices("eco11-ch01", 13, ids), "same seed, same voices");
  assert.equal(new Set(v.slice(0, 4)).size, 4, "all voices before any repeat");
  assert.ok(v.every((x, i) => i === 0 || x !== v[i - 1]), "no neighbouring repeats");
  assert.notDeepEqual(v, assignVoices("eco11-ch02", 13, ids), "different chapters get different orders");
});
