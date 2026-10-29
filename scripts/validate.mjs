// Validates every chapter listed in content/index.json.
import { readFile } from "node:fs/promises";
import { validateChapter } from "./schema.mjs";

const root = new URL("../content/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", root), "utf8"));
let failed = false;
for (const entry of index.chapters) {
  const ch = JSON.parse(await readFile(new URL(entry.file, root), "utf8"));
  const errors = validateChapter(ch);
  if (ch.id !== entry.id) errors.push(`id "${ch.id}" does not match index entry "${entry.id}"`);
  const scenes = ch.reels.reduce((n, r) => n + r.scenes.length, 0);
  const cards = ch.reels.reduce((n, r) => n + r.cards.length, 0);
  console.log(`${errors.length ? "✗" : "✓"} ${entry.file}: ${ch.reels.length} reels, ${scenes} scenes, ${cards} cards`);
  errors.forEach((e) => console.log("   " + e));
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
