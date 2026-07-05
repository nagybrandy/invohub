// lib/invoices/pdf-document.ts
// PDFKit wrapper — lazy-loaded to avoid breaking unrelated API routes in Metro bundles.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

type PdfDocumentInstance = InstanceType<typeof import("pdfkit")>;

let pdfkitDataDir: string | null = null;

function getProjectRequire(): NodeRequire {
  // Bundled Expo API routes live under dist/server/...; resolve deps from project root.
  return createRequire(path.join(process.cwd(), "package.json"));
}

export function resolvePdfkitDataDir(): string {
  if (pdfkitDataDir) return pdfkitDataDir;

  const candidates = [
    () => {
      const nodeRequire = getProjectRequire();
      return path.join(
        path.dirname(nodeRequire.resolve("pdfkit/package.json")),
        "js/data"
      );
    },
    () => path.join(process.cwd(), "node_modules/pdfkit/js/data"),
  ];

  for (const candidate of candidates) {
    try {
      const dir = candidate();
      if (fs.existsSync(dir)) {
        pdfkitDataDir = dir;
        return dir;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "PDFKit font data directory not found. Ensure the pdfkit package is installed."
  );
}

function patchPdfKitFontPaths(): () => void {
  const original = fs.readFileSync;
  const dataDir = resolvePdfkitDataDir();

  fs.readFileSync = ((filePath: fs.PathOrFileDescriptor, options?: unknown) => {
    if (typeof filePath === "string" && filePath.endsWith(".afm")) {
      return original(path.join(dataDir, path.basename(filePath)), options as never);
    }
    return original(filePath, options as never);
  }) as typeof fs.readFileSync;

  return () => {
    fs.readFileSync = original;
  };
}

function loadPdfDocumentCtor(): typeof import("pdfkit") {
  return getProjectRequire()("pdfkit") as typeof import("pdfkit");
}

export function createPdfDocument(
  options?: ConstructorParameters<typeof import("pdfkit")>[0]
): PdfDocumentInstance {
  const PDFDocument = loadPdfDocumentCtor();
  return new PDFDocument(options);
}

export function withPdfKitFonts<T>(run: () => T): T {
  const restore = patchPdfKitFontPaths();
  try {
    return run();
  } finally {
    restore();
  }
}
