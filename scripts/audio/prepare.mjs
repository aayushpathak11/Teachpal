// Builds the recording job for one chapter: every scene's narration and the quiz
// question, cleaned for speech and split into the same sentences the captions use.
// Each reel gets a voice from docs/voice.json: shuffled with a seed from the
// chapter id (so re-runs give the same voices), all voices used before any
// repeats, and never the same voice twice in a row.
//   node scripts/audio/prepare.mjs content/<id>.json > .work/<id>/audio-job.json
import { readFile } from "node:fs/promises";
import { forSpeech, splitSentences, textHash } from "../../js/tts.js";
import { assignVoices } from "./prepare-lib.mjs";

const ch = JSON.parse(await readFile(process.argv[2], "utf8"));
const dict = JSON.parse(await readFile(new URL("../../docs/pronunciations.json", import.meta.url), "utf8"));
const { voices } = JSON.parse(await readFile(new URL("../../docs/voice.json", import.meta.url), "utf8"));

const respell = (s) =>
  Object.entries(dict)
    .filter(([k]) => !k.startsWith("_"))
    .reduce((t, [w, r]) => t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), r), s);

const assigned = assignVoices(ch.id, ch.reels.length, voices.map((v) => v.id));
const segment = (key, text) => ({ key, hash: textHash(text), sentences: splitSentences(text).map((s) => respell(forSpeech(s))) });
const job = {
  chapter: ch.id,
  reels: ch.reels.map((r, i) => ({
    id: r.id,
    voice: assigned[i],
    segments: [...r.scenes.map((s, k) => segment(`s${k}`, s.say)), segment("quiz", "Quick check. " + r.quiz.q)],
  })),
};
console.log(JSON.stringify(job, null, 1));
