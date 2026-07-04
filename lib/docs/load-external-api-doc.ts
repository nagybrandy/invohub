// lib/docs/load-external-api-doc.ts
// Loads the external API markdown doc from disk (server-side only).
import fs from "node:fs";
import path from "node:path";

export const EXTERNAL_API_DOC_FILENAME = "external-api.md";
export const EXTERNAL_API_DOC_RELATIVE = `docs/${EXTERNAL_API_DOC_FILENAME}`;

export function getExternalApiDocPath(): string {
  return path.join(process.cwd(), EXTERNAL_API_DOC_RELATIVE);
}

export function loadExternalApiDoc(): string {
  const filePath = getExternalApiDocPath();
  return fs.readFileSync(filePath, "utf8");
}
