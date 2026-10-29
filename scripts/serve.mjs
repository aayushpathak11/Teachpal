// Zero-dependency static server: `npm start`, then open the printed URL (use your
// computer's LAN IP on your phone if both are on the same Wi-Fi).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 5173;
const types = { ".mp3": "audio/mpeg", ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!path || path.endsWith("/")) path += "index.html";
  if (path.startsWith("..") || path.startsWith("scripts") || path.startsWith("node_modules")) return res.writeHead(404).end();
  try {
    const body = await readFile(join(root, path));
    const headers = { "content-type": types[extname(path)] || "application/octet-stream", "cache-control": "no-cache", "accept-ranges": "bytes" };
    // Range requests let the audio player jump to a scene inside a reel's MP3.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range) {
      const start = range[1] ? +range[1] : body.length - +range[2];
      const end = range[1] && range[2] ? Math.min(+range[2], body.length - 1) : body.length - 1;
      return res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${body.length}` }).end(body.subarray(start, end + 1));
    }
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`TeachPal running at http://localhost:${port}`));
