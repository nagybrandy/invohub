// scripts/copy-marketing-site.mjs
// Copies the hand-authored marketing site into the exported web client so Vercel can serve it.
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "marketing");
const TARGET = path.join(ROOT, "dist", "client", "marketing");

if (!existsSync(SOURCE)) {
  console.error(`marketing source missing: ${SOURCE}`);
  process.exit(1);
}

if (!existsSync(path.join(ROOT, "dist", "client"))) {
  console.error("dist/client missing — run the web export before copying the marketing site.");
  process.exit(1);
}

await mkdir(TARGET, { recursive: true });
await cp(SOURCE, TARGET, { recursive: true });

const copied = await readdir(TARGET);
console.log(`marketing site copied to dist/client/marketing (${copied.join(", ")})`);
