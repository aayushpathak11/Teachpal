// Builds the recording job for one chapter: every scene's narration and the quiz
// question, cleaned for speech and split into the same sentences the captions use.
//   node scripts/audio/prepare.mjs content/<id>.json > .work/<id>/audio-job.json
import { readFile } from "node:fs/promises";
import { forSpeech, splitSentences, textHash } from "../../js/tts.js";

const ch = JSON.parse(await readFile(process.argv[2], "utf8"));
const dict = JSON.parse(await readFile(new URL("../../docs/pronunciations.json", import.meta.url), "utf8"));
const respell = (s) =>
  Object.entries(dict)
    .filter(([k]) => !k.startsWith("_"))
    .reduce((t, [w, r]) => t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), r), s);

const segment = (key, text) => ({ key, hash: textHash(text), sentences: splitSentences(text).map((s) => respell(forSpeech(s))) });
const job = {
  chapter: ch.id,
  reels: ch.reels.map((r) => ({
    id: r.id,
    segments: [...r.scenes.map((s, i) => segment(`s${i}`, s.say)), segment("quiz", "Quick check. " + r.quiz.q)],
  })),
};
console.log(JSON.stringify(job, null, 1));
