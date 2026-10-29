// Builds dist/artifact/: the app laid out for hosting as a claude.ai artifact.
// The artifact host supplies <html>/<head>/<body> and the viewport meta, and runs
// no service worker, so the page keeps only its title, stylesheet and script.
import { readFile, writeFile, mkdir, cp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "dist", "artifact");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const html = await readFile(join(root, "index.html"), "utf8");
const title = html.match(/<title>.*?<\/title>/s)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].trim();
await writeFile(
  join(out, "index.html"),
  `${title}\n<meta name="description" content="Chapter-to-reels study feed with quizzes and spaced repetition.">\n<link rel="stylesheet" href="css/app.css">\n${body}\n`
);
for (const dir of ["css", "js", "content"]) await cp(join(root, dir), join(out, dir), { recursive: true });

const files = [];
const walk = async (d, rel = "") => {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(join(d, e.name), r);
    else if (r !== "index.html") files.push(r);
  }
};
await walk(out);
console.log(JSON.stringify(Object.fromEntries(files.map((f) => [f, `dist/artifact/${f}`])), null, 1));
