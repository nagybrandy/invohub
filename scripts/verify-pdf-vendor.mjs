// scripts/verify-pdf-vendor.mjs
// Smoke test: generate a PDF using vendored pdfkit (simulates Vercel runtime).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const vendorPkg = path.join(root, "dist/server/vendor/node_modules/pdfkit/package.json");

if (!fs.existsSync(vendorPkg)) {
  console.error("Missing vendored pdfkit. Run npm run vercel-build first.");
  process.exit(1);
}

const nodeRequire = createRequire(vendorPkg);
const PDFDocument = nodeRequire(".");
const fontDir = path.join(root, "dist/server/assets/pdfkit-data");
const originalReadFileSync = fs.readFileSync;

fs.readFileSync = (filePath, options) => {
  if (typeof filePath === "string" && filePath.endsWith(".afm")) {
    return originalReadFileSync(path.join(fontDir, path.basename(filePath)), options);
  }
  return originalReadFileSync(filePath, options);
};

const doc = new PDFDocument({ size: "A4", margin: 48 });
const chunks = [];
doc.on("data", (chunk) => chunks.push(chunk));
await new Promise((resolve, reject) => {
  doc.on("end", resolve);
  doc.on("error", reject);
  doc.font("Helvetica-Bold").fontSize(18).text("InvoHub PDF vendor smoke test", 48, 48);
  doc.end();
});

fs.readFileSync = originalReadFileSync;

const pdf = Buffer.concat(chunks);
if (pdf.subarray(0, 4).toString() !== "%PDF") {
  console.error("PDF generation failed.");
  process.exit(1);
}

console.log(`PDF vendor smoke test OK (${pdf.length} bytes)`);

// Embedded-font smoke test (AC11 of
// docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md): a Vercel
// bundling regression that drops the vendored TTFs must fail the build, not
// silently ship a PDF that mis-renders Hungarian. Registers the bundled TTF
// under a non-standard name (see lib/invoices/pdf-fonts.ts's header comment
// for why a base-14 name like "Helvetica" would silently *not* embed it),
// draws a pangram covering every accented Hungarian letter, and asserts the
// output is a real PDF with an embedded (not merely referenced) font
// program.
const embeddedFontPath = path.join(root, "dist/server/assets/pdf-fonts/NotoSans-Regular.ttf");
if (!fs.existsSync(embeddedFontPath)) {
  console.error(
    `Missing vendored embedded font: ${path.relative(root, embeddedFontPath)}. Run npm run vercel-build first.`
  );
  process.exit(1);
}

const fontDoc = new PDFDocument({ size: "A4", margin: 48 });
const fontChunks = [];
fontDoc.on("data", (chunk) => fontChunks.push(chunk));
await new Promise((resolve, reject) => {
  fontDoc.on("end", resolve);
  fontDoc.on("error", reject);
  fontDoc.registerFont("InvoHubSansVendorCheck", embeddedFontPath);
  fontDoc.font("InvoHubSansVendorCheck").fontSize(18).text("Árvíztűrő tükörfúrógép", 48, 48);
  fontDoc.end();
});

if (fontDoc._font?.constructor?.name !== "EmbeddedFont") {
  console.error(
    `Embedded font vendor check failed: doc._font was ${fontDoc._font?.constructor?.name}, expected EmbeddedFont.`
  );
  process.exit(1);
}

const fontPdf = Buffer.concat(fontChunks);
if (fontPdf.subarray(0, 4).toString() !== "%PDF") {
  console.error("Embedded font vendor check: PDF generation failed.");
  process.exit(1);
}
if (!fontPdf.includes("FontFile2")) {
  console.error("Embedded font vendor check: no FontFile2 stream found — the TTF was not embedded.");
  process.exit(1);
}

console.log(`Embedded PDF font vendor check OK (${fontPdf.length} bytes)`);

// Optional: exercise generateInvoicePdf when tsx/ts-node available via dynamic import in CI later.
void pathToFileURL;
