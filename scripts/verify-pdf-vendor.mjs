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

// Optional: exercise generateInvoicePdf when tsx/ts-node available via dynamic import in CI later.
void pathToFileURL;
