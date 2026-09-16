// scripts/prepare-server-pdf-deps.mjs
// Vendors pdfkit and its dependency tree into dist/server for Vercel lambdas.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const vendorRoot = path.join(root, "dist/server/vendor");
const fontSrc = path.join(root, "assets/pdfkit-data");
const fontTargets = [
  path.join(root, "dist/server/assets/pdfkit-data"),
  path.join(vendorRoot, "node_modules/pdfkit/js/data"),
];

// The embedded Latin-Extended-A TTFs (see assets/fonts/pdf/README.md and
// lib/invoices/pdf-fonts.ts) need their own bundle path — same
// committed-asset pattern as the AFM fonts above, but pdf-fonts.ts's
// resolvePdfFontFiles() only looks in dist/server/assets/pdf-fonts, so a
// missing copy here means every PDF silently falls back to transliterated
// Helvetica in production (loud at request time via console.error, but this
// script should fail the build instead of letting that ship unnoticed).
const embeddedFontSrc = path.join(root, "assets/fonts/pdf");
const embeddedFontFiles = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf"];
const embeddedFontTarget = path.join(root, "dist/server/assets/pdf-fonts");

function destForPackage(name) {
  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    return path.join(vendorRoot, "node_modules", scope, pkg);
  }
  return path.join(vendorRoot, "node_modules", name);
}

function resolvePackageDir(name) {
  try {
    const entry = require.resolve(name);
    let dir = path.dirname(entry);
    while (dir !== path.dirname(dir)) {
      const pkgJson = path.join(dir, "package.json");
      if (fs.existsSync(pkgJson)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
        if (pkg.name === name) {
          return dir;
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    return null;
  }
  return null;
}

function copyPackageTree(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);

  const srcDir = resolvePackageDir(name);
  if (!srcDir) {
    console.warn(`Skipping missing package: ${name}`);
    return;
  }

  const destDir = destForPackage(name);
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true, dereference: true });
  console.log(`Vendored ${name} -> ${path.relative(root, destDir)}`);

  const pkg = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf8"));
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    copyPackageTree(dep, seen);
  }
}

if (!fs.existsSync(fontSrc)) {
  console.error("Missing assets/pdfkit-data — run npm run assets:pdfkit-fonts first.");
  process.exit(1);
}

for (const file of embeddedFontFiles) {
  if (!fs.existsSync(path.join(embeddedFontSrc, file))) {
    console.error(
      `Missing ${path.join("assets/fonts/pdf", file)} — see assets/fonts/pdf/README.md for provenance.`
    );
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(root, "dist/server"))) {
  console.error("Missing dist/server — run expo export -p web first.");
  process.exit(1);
}

copyPackageTree("pdfkit");

for (const target of fontTargets) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(fontSrc)) {
    if (!file.endsWith(".afm")) continue;
    fs.copyFileSync(path.join(fontSrc, file), path.join(target, file));
  }
  console.log(`Copied PDFKit fonts to ${path.relative(root, target)}`);
}

fs.mkdirSync(embeddedFontTarget, { recursive: true });
for (const file of embeddedFontFiles) {
  fs.copyFileSync(path.join(embeddedFontSrc, file), path.join(embeddedFontTarget, file));
}
console.log(`Copied embedded PDF fonts to ${path.relative(root, embeddedFontTarget)}`);
