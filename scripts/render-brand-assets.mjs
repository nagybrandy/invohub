// scripts/render-brand-assets.mjs
// Renders brand rasters (Open Graph cover, square logo) from marketing/brand-assets.html.
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = pathToFileURL(path.join(ROOT, "marketing", "brand-assets.html")).href;
const OUT_DIR = path.join(ROOT, "marketing", "assets");

const TARGETS = [
  { selector: "#og", file: "og-cover.png", deviceScaleFactor: 1 },
  { selector: "#logo", file: "logo-512.png", deviceScaleFactor: 2 },
];

const browser = await chromium.launch();

try {
  for (const target of TARGETS) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1300 },
      deviceScaleFactor: target.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.goto(SOURCE, { waitUntil: "load" });

    const output = path.join(OUT_DIR, target.file);
    await page.locator(target.selector).screenshot({ path: output });
    console.log(`rendered ${target.file}`);

    await context.close();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
