// lib/invoices/pdf-document.ts
// PDFKit wrapper — lazy-loaded to avoid breaking unrelated API routes in Metro bundles.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

type PdfDocumentInstance = InstanceType<typeof import("pdfkit")>;

let pdfkitDataDir: string | null = null;

function resolvePdfkitDataDir(): string {
  if (pdfkitDataDir) return pdfkitDataDir;

  const nodeRequire = createRequire(
    typeof __filename !== "undefined" ? __filename : path.join(process.cwd(), "package.json")
  );
  pdfkitDataDir = path.join(
    path.dirname(nodeRequire.resolve("pdfkit/package.json")),
    "js/data"
  );
  return pdfkitDataDir;
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
  const nodeRequire = createRequire(
    typeof __filename !== "undefined" ? __filename : path.join(process.cwd(), "package.json")
  );
  return nodeRequire("pdfkit") as typeof import("pdfkit");
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
