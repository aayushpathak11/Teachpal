// Zero-dependency static server: `npm start`, then open the printed URL (use your
// computer's LAN IP on your phone if both are on the same Wi-Fi).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!path || path.endsWith("/")) path += "index.html";
  if (path.startsWith("..") || path.startsWith("scripts") || path.startsWith("node_modules")) return res.writeHead(404).end();
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream", "cache-control": "no-cache" }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`TeachPal running at http://localhost:${port}`));
