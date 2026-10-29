// Combines the per-reel timing files written by synth.py into manifest.json.
//   node scripts/audio/merge.mjs .work/<id>/audio-job.json content/audio/<id>
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [jobPath, dir] = process.argv.slice(2);
const job = JSON.parse(await readFile(jobPath, "utf8"));
const reels = {};
const missing = [];
for (const r of job.reels) {
  try {
    reels[r.id] = JSON.parse(await readFile(join(dir, `${r.id}.json`), "utf8"));
  } catch {
    missing.push(r.id);
  }
}
await writeFile(join(dir, "manifest.json"), JSON.stringify({ chapter: job.chapter, reels }, null, 1));
console.log(`manifest: ${Object.keys(reels).length}/${job.reels.length} reels${missing.length ? `; not recorded yet: ${missing.join(", ")}` : ""}`);
process.exit(missing.length ? 1 : 0);
