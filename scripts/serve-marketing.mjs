// scripts/serve-marketing.mjs
// Dependency-free static server that mirrors production marketing routing for local dev and E2E.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..", "marketing");
const PORT = Number(process.env.MARKETING_PORT ?? 4321);

const MIME_BY_EXT = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/** Maps a request pathname onto a file inside the marketing directory. */
export function resolveMarketingFile(pathname, root = ROOT) {
  const clean = decodeURIComponent(pathname.split("?")[0]).replace(/\/+$/, "");
  const relative = (clean === "" ? "/index.html" : clean).replace(/^\/marketing\//, "/");
  const candidates = relative.endsWith(".html")
    ? [relative]
    : [relative, `${relative}/index.html`, `${relative}.html`];

  for (const candidate of candidates) {
    const absolute = path.resolve(root, `.${candidate}`);
    if (!absolute.startsWith(`${root}${path.sep}`)) {
      continue;
    }
    if (existsSync(absolute) && statSync(absolute).isFile()) {
      return absolute;
    }
  }

  return null;
}

createServer((req, res) => {
  const filePath = resolveMarketingFile(req.url ?? "/");

  if (!filePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
    return;
  }

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
  );
  createReadStream(filePath).pipe(res);
}).listen(PORT, () => {
  console.log(`marketing site ready on http://localhost:${PORT}`);
});
