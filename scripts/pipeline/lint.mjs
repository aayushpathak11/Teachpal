// Deterministic checks for one chapter file, used by the in-chat workflow.
//   node scripts/pipeline/lint.mjs content/<id>.json            → lint issues
//   node scripts/pipeline/lint.mjs content/<id>.json --claims   → Beyond-NCERT claims to fact-check
import { readFile } from "node:fs/promises";
import { lintChapter, extraClaims, lintPractice } from "./checks.mjs";
import { existsSync, readFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
const ch = JSON.parse(await readFile(file, "utf8"));
if (flag === "--claims") {
  console.log(JSON.stringify(extraClaims(ch.reels).map(({ id, claim }) => ({ id, claim })), null, 1));
} else {
  const issues = lintChapter(ch);
  const prFile = file.replace(/content\/([^/]+)\.json$/, "content/practice/$1.json");
  if (prFile !== file && existsSync(prFile)) issues.push(...lintPractice(JSON.parse(readFileSync(prFile, "utf8"))));
  for (const i of issues) console.log(`${i.severity.padEnd(7)} ${i.reelId || "chapter"} · ${i.where}: ${i.problem}`);
  console.log(`${issues.length} lint issue(s); ${issues.filter((i) => i.severity !== "minor").length} blocker/major`);
  process.exit(issues.some((i) => i.severity === "blocker") ? 1 : 0);
}
