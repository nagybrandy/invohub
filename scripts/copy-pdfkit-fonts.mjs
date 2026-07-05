// scripts/copy-pdfkit-fonts.mjs
// Copies vendored PDFKit font metrics into the Expo server output for Vercel.
import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "assets/pdfkit-data");
const targets = [path.join(process.cwd(), "dist/server/assets/pdfkit-data")];

if (!fs.existsSync(src)) {
  console.error("Missing assets/pdfkit-data — run npm run assets:pdfkit-fonts first.");
  process.exit(1);
}

for (const target of targets) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    if (!file.endsWith(".afm")) continue;
    fs.copyFileSync(path.join(src, file), path.join(target, file));
  }
  console.log(`Copied PDFKit fonts to ${target}`);
}
