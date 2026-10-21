// lib/export/csv.ts
// One CSV dialect for every export: UTF-8 with a BOM (accents survive in
// Hungarian Excel), ';' separated, CRLF, decimals with a comma for Hungarian.
import { csvField, csvNumber } from "@/lib/invoices/export-csv";

const SEPARATOR = ";";
const EOL = "\r\n";
const BOM = "﻿";

export { csvField, csvNumber };

export function buildCsv(header: string[], rows: string[][]): string {
  return BOM + [header, ...rows].map((row) => row.map(csvField).join(SEPARATOR)).join(EOL) + EOL;
}
