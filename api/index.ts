// api/index.ts
// Vercel serverless entry — serves exported client assets, then Expo Router SSR/API.
// @ts-nocheck — CommonJS entry; __dirname is provided by the Node runtime.
const fs = require("node:fs");
const path = require("node:path");
const { createRequestHandler } = require("expo-server/adapter/vercel");
const { getDomainRedirect } = require("../lib/domain-routing");

const CLIENT_DIR = path.join(__dirname, "../dist/client");
const SERVER_DIR = path.join(__dirname, "../dist/server");

const expoHandler = createRequestHandler({
  build: SERVER_DIR,
});

const MIME_BY_EXT = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/vnd.microsoft.icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveClientFile(pathname) {
  try {
    const decoded = decodeURIComponent(pathname.split("?")[0]);
    const relative = decoded.replace(/^\/+/, "");
    const absolute = path.resolve(CLIENT_DIR, relative);
    const clientRoot = `${CLIENT_DIR}${path.sep}`;

    if (absolute !== CLIENT_DIR && !absolute.startsWith(clientRoot)) {
      return null;
    }

    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return null;
    }

    return absolute;
  } catch {
    return null;
  }
}

function serveClientFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);

  if (ext === ".js" || ext === ".css" || ext === ".woff2" || ext === ".woff") {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

module.exports = async (req, res) => {
  const canonicalRedirect = getDomainRedirect(
    req.headers["x-forwarded-host"] ?? req.headers.host,
    req.url ?? "/",
    {
      marketingHost: process.env.MARKETING_HOST ?? "invohub.hu",
      appHost: process.env.APP_HOST ?? "app.invohub.hu",
    },
  );

  if (canonicalRedirect) {
    res.statusCode = 308;
    res.setHeader("Location", canonicalRedirect);
    res.end();
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const filePath = resolveClientFile(req.url ?? "/");
    if (filePath) {
      serveClientFile(req, res, filePath);
      return;
    }
  }

  return expoHandler(req, res);
};
