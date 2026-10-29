// Validates every chapter listed in content/index.json.
import { readFile } from "node:fs/promises";
import { validateChapter, validateMap, validatePractice } from "./schema.mjs";
import { existsSync } from "node:fs";

const root = new URL("../content/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", root), "utf8"));
let failed = false;
for (const entry of index.chapters) {
  const ch = JSON.parse(await readFile(new URL(entry.file, root), "utf8"));
  const errors = validateChapter(ch);
  if (ch.id !== entry.id) errors.push(`id "${ch.id}" does not match index entry "${entry.id}"`);
  const scenes = ch.reels.reduce((n, r) => n + r.scenes.length, 0);
  const cards = ch.reels.reduce((n, r) => n + r.cards.length, 0);
  const prUrl = new URL(`practice/${entry.id}.json`, root);
  let practice = "no practice bank";
  if (existsSync(prUrl)) {
    const pr = JSON.parse(await readFile(prUrl, "utf8"));
    errors.push(...validatePractice(pr, ch).map((e) => `practice: ${e}`));
    practice = `${pr.mcq.length} MCQs, ${(pr.descriptive || []).length} descriptive`;
  }
  let maps = "no concept maps";
  if (entry.maps) {
    const m = JSON.parse(await readFile(new URL(entry.maps, root), "utf8"));
    errors.push(...validateMap(m, ch).map((e) => `maps: ${e}`));
    maps = `${m.chains.length} concept maps`;
  }
  console.log(`${errors.length ? "✗" : "✓"} ${entry.file}: ${ch.reels.length} reels, ${scenes} scenes, ${cards} cards; ${practice}; ${maps}`);
  errors.forEach((e) => console.log("   " + e));
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
