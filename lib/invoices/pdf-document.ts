// lib/invoices/pdf-document.ts
// PDFKit wrapper with vendored font metrics for Vercel/serverless.
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

let pdfkitDataDir: string | null = null;

const FONT_MARKER = "Helvetica.afm";

function collectSearchRoots(): string[] {
  const roots = new Set<string>();

  roots.add(process.cwd());

  if (typeof __filename !== "undefined") {
    let dir = path.dirname(__filename);
    for (let depth = 0; depth < 10; depth += 1) {
      roots.add(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return [...roots];
}

function hasFontData(dir: string): boolean {
  return fs.existsSync(path.join(dir, FONT_MARKER));
}

function fontDirCandidates(root: string): string[] {
  return [
    path.join(root, "dist/server/assets/pdfkit-data"),
    path.join(root, "dist/server/vendor/node_modules/pdfkit/js/data"),
    path.join(root, "assets/pdfkit-data"),
    path.join(root, "node_modules/pdfkit/js/data"),
  ];
}

export function resolvePdfkitDataDir(): string {
  if (pdfkitDataDir) return pdfkitDataDir;

  for (const root of collectSearchRoots()) {
    for (const dir of fontDirCandidates(root)) {
      if (hasFontData(dir)) {
        pdfkitDataDir = dir;
        return dir;
      }
    }
  }

  throw new Error(
    "PDFKit font data directory not found. Ensure assets/pdfkit-data is bundled with the deployment."
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

export function createPdfDocument(
  options?: ConstructorParameters<typeof PDFDocument>[0]
): PdfDocumentInstance {
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
