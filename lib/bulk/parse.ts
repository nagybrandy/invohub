// lib/bulk/parse.ts
// File → raw rows. CSV (',' ';' or tab, quoted fields, BOM) and Excel
// (.xlsx/.xls, first sheet) both end up as the same array of
// header-normalised string records.
import * as XLSX from "xlsx";

export type RawRow = Record<string, string>;

const normHeader = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC-4180-style CSV tokenizer (quotes, doubled quotes, newlines inside quotes). */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToRecords(matrix: string[][]): RawRow[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map(normHeader);
  const records: RawRow[] = [];
  for (const cells of matrix.slice(1)) {
    if (cells.every((c) => String(c ?? "").trim() === "")) continue; // skip blank lines
    const rec: RawRow = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = String(cells[i] ?? "").trim();
    });
    records.push(rec);
  }
  return records;
}

export function parseCsvRecords(text: string): RawRow[] {
  return rowsToRecords(parseCsvText(text));
}

const pad = (n: number) => String(n).padStart(2, "0");

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value);
}

export function parseSpreadsheetRecords(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  return rowsToRecords(matrix.map((r) => r.map(cellToString)));
}

/** Picks the parser from the file name / contents. */
export async function parseBulkFile(file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer();
  if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) return parseSpreadsheetRecords(buffer);
  return parseCsvRecords(new TextDecoder("utf-8").decode(buffer));
}
