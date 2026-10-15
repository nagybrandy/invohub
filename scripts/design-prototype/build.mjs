#!/usr/bin/env node
// scripts/design-prototype/build.mjs
// Builds ONE self-contained HTML file with the whole InvoHub web app inside,
// running against an in-memory mock backend with fake users and fake data —
// for handing to a designer (double-click, no server, no network needed).
//
//   npm run design:prototype                 # export + build -> dist-design/invohub-design-prototype.html
//   node scripts/design-prototype/build.mjs --skip-export --dist <existing expo export dir>
//
// How it works:
//   1. `expo export --platform web` produces the real client bundle.
//   2. The bundle, CSS and fonts are inlined into one HTML file.
//   3. Expo Router needs a real URL it can pushState on, which file:// does
//      not give us — so window.location/window.history inside the bundle are
//      rewritten to a virtual location/history (runtime/shell.js).
//   4. fetch("/api/...") is answered by runtime/mock-backend.js.
// Nothing server-side (database, secrets, API routes) is included.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}
const skipExport = process.argv.includes("--skip-export");
const outFile = path.resolve(arg("--out", path.join(repoRoot, "dist-design", "invohub-design-prototype.html")));
const distDir = path.resolve(arg("--dist", path.join(os.tmpdir(), "invohub-design-export")));

if (!skipExport) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log(`[prototype] expo export -> ${distDir}`);
  execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", distDir], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  });
}

const clientDir = path.join(distDir, "client");
const jsDir = path.join(clientDir, "_expo", "static", "js", "web");
const cssDir = path.join(clientDir, "_expo", "static", "css");
const read = (p) => fs.readFileSync(p, "utf8");

const entryName = fs.readdirSync(jsDir).find((f) => f.startsWith("entry-") && f.endsWith(".js"));
if (!entryName) throw new Error(`No entry-*.js in ${jsDir}`);
let js = read(path.join(jsDir, entryName));
let css = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css")).map((f) => read(path.join(cssDir, f))).join("\n");

// --- fonts -> data URIs ------------------------------------------------------
const fontDir = path.join(clientDir, "fonts");
const fontData = {};
for (const f of fs.existsSync(fontDir) ? fs.readdirSync(fontDir) : []) {
  fontData[f] = `data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, f)).toString("base64")}`;
}
css = css.replace(/url\((["']?)([^)"']*?\/fonts\/([^/)"']+))\1\)/g, (m, q, full, file) =>
  fontData[file] ? `url("${fontData[file]}")` : m
);
css = css.replace(/url\((["']?)\/marketing\/[^)"']*\1\)/g, 'url("")');

// --- lazy chunks (expo-web-browser, expo-network) -> data: URLs ---------------
for (const f of fs.readdirSync(jsDir)) {
  if (f === entryName || !f.endsWith(".js")) continue;
  const asData = `data:text/javascript;base64,${fs.readFileSync(path.join(jsDir, f)).toString("base64")}`;
  js = js.split(`/_expo/static/js/web/${f}`).join(asData);
}

// --- virtual location / history ---------------------------------------------
const before = { loc: (js.match(/window\.location/g) || []).length, hist: (js.match(/window\.history/g) || []).length };
js = js
  .replace(/window\.location\b/g, "window.__vloc")
  .replace(/window\.history\b/g, "window.__vhist")
  .replace(/document\.location\b/g, "window.__vloc")
  // destructuring: const { location: r } = window  (react-navigation's useLinking)
  .replace(/\{\s*location\s*:\s*([\w$]+)\s*\}\s*=\s*window\b/g, "{__vloc:$1}=window")
  .replace(/\{\s*history\s*:\s*([\w$]+)\s*\}\s*=\s*window\b/g, "{__vhist:$1}=window")
  // bare `location.` / `typeof location` references (not property accesses like foo.location)
  .replace(/([^.\w$])location\.(hash|origin|pathname|href|protocol|search|host|hostname)\b/g, "$1window.__vloc.$2")
  .replace(/typeof location\b/g, "typeof window.__vloc")
  .replace(/([^.\w$])history\.(pushState|replaceState|state|back|forward|go|length)\b/g, "$1window.__vhist.$2");
console.log(`[prototype] rewrote ${before.loc} window.location + ${before.hist} window.history references`);

// A sandboxed srcDoc <iframe> (the e-mail preview) renders blank when the page
// itself is a file:// document. The prototype has no untrusted content, so the
// attribute is dropped.
js = js.replace(/sandbox:(["'])\1,srcDoc:/g, "srcDoc:");

// Inline <script> hazards: a literal "</script" ends the element early, and a
// "<!--" followed later by "<script" puts the HTML parser in the "double
// escaped" state where "</script>" no longer closes it (the whole rest of the
// page is swallowed and nothing runs). "<\!--" is the same text to JS.
const escapeScript = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const backendJs = read(path.join(here, "runtime", "mock-backend.js"));
const shellJs = read(path.join(here, "runtime", "shell.js"));

const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>InvoHub – design prototípus</title>
<style id="expo-reset">#root,body,html{height:100%}body{overflow:hidden}#root{display:flex}</style>
<style id="app-css">${css}</style>
</head>
<body>
<noscript>A prototípus futtatásához JavaScript szükséges.</noscript>
<div id="root"></div>
<script>${escapeScript(backendJs)}</script>
<script>${escapeScript(shellJs)}</script>
<script>${escapeScript(js)}</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
console.log(`[prototype] wrote ${outFile} (${mb} MB)`);
