// Turns one chapter PDF into a TeachPal feed (content/<id>.json) using Claude.
//
//   npm install
//   export ANTHROPIC_API_KEY=...        (or `ant auth login`)
//   npm run generate -- path/to/chapter.pdf --id eco11-ch02 --subject "Economics · Class 11" [--exam "RBI Grade B"]
//
// The prompt includes two finished reels from chapter 1 as a style reference, and
// the output is validated before it is written. Review generated "Beyond NCERT"
// facts before relying on them: they are not from the book.

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { validateChapter } from "./schema.mjs";

const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!pdfPath) {
  console.error('Usage: npm run generate -- chapter.pdf --id eco11-ch02 --subject "Economics · Class 11" [--exam "RBI Grade B"]');
  process.exit(1);
}
const id = flag("id", basename(pdfPath).replace(/\.pdf$/i, "").toLowerCase());
const subject = flag("subject", "");
const exam = flag("exam", "RBI Grade B");

const content = new URL("../content/", import.meta.url);
const example = JSON.parse(await readFile(new URL("eco11-ch01.json", content), "utf8"));
const styleReference = JSON.stringify({ ...example, reels: example.reels.slice(2, 4) }, null, 2);

const system = `You are an expert teacher who turns textbook chapters into short, vivid study reels for adult self-learners preparing for the ${exam} exam with no prior background in the subject.

Learning-science rules to follow:
- One concept per reel. Split the chapter into 12-20 reels that cover every exam-relevant idea, fact and number in the chapter, in the chapter's order.
- Each reel has 3-5 scenes. A scene's "say" is spoken narration: conversational, concrete, 2-5 sentences, explaining *why* and not just *what*. Each scene's visual must match what its narration says.
- Use concrete examples and analogies (Indian context where possible) to make abstract ideas stick.
- Material that is NOT in the textbook goes either in a scene marked "extra": true (shown with a "Beyond NCERT" badge) or in the reel's "beyond" field. Only include extra facts you are highly confident are accurate. Never present outside facts as if they were from the book.
- "quiz" tests understanding of the reel's key idea: 4 options, one correct, plausible distractors, "answer" is the 0-based index, "why" explains it.
- "cards" are 2-3 short-answer recall prompts per reel covering the facts most worth remembering (numbers, names, causes, definitions). Answers are short and self-contained.
- "examAngle" is one or two sentences on how this topic shows up in the ${exam} exam or in the chapter's exercise questions.

Scene kinds and their fields (every scene also needs "say", and may have "extra": true):
- hook: emoji, big (short punchy line), sub
- points: heading, items: [{icon (one emoji), text}] (2-5 items)
- stat: value (short, e.g. "85%", "<2%", "32 yrs"), label, optional compare: {value, label}
- bars: heading, unit, bars: [{label, value (number), display (string)}]
- flow: heading, steps: [string] (a cause-and-effect chain, 3-5 steps)
- compare: heading, left: {title, items: [string]}, right: {title, items: [string]}
- quote: text, by
- timeline: heading, events: [{year, text}]

Respond with only the JSON object, with no prose and no markdown fences. Use this top-level shape:
{"id","subject","chapter","title","source","exam","reels":[{"id" (kebab-case, unique),"title","emoji","section","scenes":[...],"beyond","examAngle","quiz":{"q","options","answer","why"},"cards":[{"q","a"}]}]}

Here is an example of the expected style and format, taken from a finished chapter (two reels shown):
${styleReference}`;

const client = new Anthropic();
const pdf = (await readFile(pdfPath)).toString("base64");

async function generate(extraNote) {
  console.log(`Generating reels for ${pdfPath} …`);
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
          {
            type: "text",
            text: `Create the TeachPal feed for this chapter. Use id "${id}"${subject ? `, subject "${subject}"` : ""} and exam "${exam}".${extraNote ? "\n\n" + extraNote : ""}`,
          },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error(`Request declined: ${msg.stop_details?.explanation || "refusal"}`);
  if (msg.stop_reason === "max_tokens") throw new Error("Output hit max_tokens; try splitting the chapter PDF.");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

let chapter;
let errors = [];
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    chapter = await generate(errors.length ? `Your previous attempt had these problems; fix them:\n- ${errors.join("\n- ")}` : "");
    errors = validateChapter(chapter);
  } catch (e) {
    if (e instanceof SyntaxError) errors = [`Output was not valid JSON (${e.message})`];
    else throw e;
  }
  if (!errors.length) break;
  console.warn(`Attempt ${attempt} failed validation:\n  ${errors.join("\n  ")}`);
}
if (errors.length) process.exit(1);

chapter.id = id;
const file = `${id}.json`;
await writeFile(new URL(file, content), JSON.stringify(chapter, null, 2) + "\n");

const indexUrl = new URL("index.json", content);
const index = JSON.parse(await readFile(indexUrl, "utf8"));
index.chapters = index.chapters.filter((c) => c.id !== id);
index.chapters.push({ id, file, title: chapter.title, subject: chapter.subject });
await writeFile(indexUrl, JSON.stringify(index, null, 2) + "\n");

console.log(`✓ Wrote content/${file}: ${chapter.reels.length} reels. Run "npm run validate", then "npm start".`);
