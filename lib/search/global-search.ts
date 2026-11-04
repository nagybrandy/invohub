// lib/search/global-search.ts
// Pure helpers for the top-bar global search (SPEC §7.2): the query rules,
// accent-insensitive matching and highlighting, and the grouping of the
// results the existing hooks return. No React, no network: the component
// feeds it what useInvoices / useClients / useProducts loaded.
import type { Href } from "expo-router";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import { routes } from "@/lib/navigation";
import type { Invoice } from "@/lib/invoices/types";
import type { Client } from "@/lib/clients/service";
import type { Product } from "@/lib/products/service";

export const MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 250;
export const MAX_RESULTS_PER_GROUP = 5;

export function normalizeQuery(raw: string): string {
  return raw.trim();
}

export function isSearchable(raw: string): boolean {
  return normalizeQuery(raw).length >= MIN_QUERY_LENGTH;
}

function foldChar(ch: string): string {
  return ch
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Lower-cased, accent-free text plus, for every folded unit, the index of the original character. */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const piece = foldChar(text[i]);
    for (let j = 0; j < piece.length; j += 1) {
      folded += piece[j];
      origin.push(i);
    }
  }
  return { folded, origin };
}

export function matchesQuery(haystack: string | undefined | null, query: string): boolean {
  const needle = fold(normalizeQuery(query)).folded;
  if (!needle || !haystack) return false;
  return fold(haystack).folded.includes(needle);
}

export type HighlightSegment = { text: string; match: boolean };

/** Splits `text` into matching and non-matching runs, keeping the original characters. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const needle = fold(normalizeQuery(query)).folded;
  if (!needle) return [{ text, match: false }];
  const { folded, origin } = fold(text);
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let from = 0;
  while (from <= folded.length - needle.length) {
    const at = folded.indexOf(needle, from);
    if (at === -1) break;
    const start = origin[at];
    const end = origin[at + needle.length - 1] + 1;
    if (start >= cursor) {
      if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
      segments.push({ text: text.slice(start, end), match: true });
      cursor = end;
    }
    from = at + needle.length;
  }
  if (segments.length === 0) return [{ text, match: false }];
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}

export type SearchGroupKey = "invoices" | "clients" | "products";

export type SearchResult = {
  key: string;
  group: SearchGroupKey;
  title: string;
  subtitle: string;
  /** Formatted gross amount (invoices only). */
  amount?: string;
  href: Href;
};

export type SearchGroup = { key: SearchGroupKey; results: SearchResult[] };

function dateLocale(locale: string): string {
  return locale.startsWith("hu") ? "hu-HU" : "en-GB";
}

function joinParts(parts: Array<string | undefined | null>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

function invoiceResult(inv: Invoice, locale: string): SearchResult {
  const totals = calculateInvoiceTotals(inv.lineItems);
  return {
    key: `invoice:${inv.id}`,
    group: "invoices",
    title: inv.invoiceNumber?.trim() ? inv.invoiceNumber : inv.clientName,
    subtitle: joinParts([
      inv.invoiceNumber?.trim() ? inv.clientName : undefined,
      inv.issueDate ? formatDateOnly(inv.issueDate, dateLocale(locale)) : undefined,
    ]),
    amount: formatCurrency(totals.totalAmount, inv.currency),
    href: routes.invoiceDetail(inv.id),
  };
}

function clientResult(client: Client): SearchResult {
  return {
    key: `client:${client.id}`,
    group: "clients",
    title: client.name,
    subtitle: joinParts([client.taxNumber, client.city]),
    href: routes.clientEdit(client.id),
  };
}

function productResult(product: Product): SearchResult {
  const currency = (product.currency ?? "HUF") as Invoice["currency"];
  return {
    key: `product:${product.id}`,
    group: "products",
    title: product.name,
    subtitle: joinParts([
      formatCurrency(product.unitPrice, currency),
      product.unit ? `/ ${product.unit}` : undefined,
    ]).replace(" · / ", " / "),
    href: routes.productEdit(product.id),
  };
}

export type BuildSearchGroupsInput = {
  query: string;
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  /** i18n language; only used to format dates. */
  locale: string;
};

/**
 * Groups in display order (Számlák, Partnerek, Termékek), at most five rows
 * each, empty groups dropped. Invoices come pre-filtered by the API's own
 * search; partners and products (whose hooks have no search option) are
 * filtered here on name, tax number / e-mail and description.
 */
export function buildSearchGroups(input: BuildSearchGroupsInput): SearchGroup[] {
  const query = normalizeQuery(input.query);
  if (!isSearchable(query)) return [];

  const invoices = input.invoices.slice(0, MAX_RESULTS_PER_GROUP).map((inv) => invoiceResult(inv, input.locale));
  const clients = input.clients
    .filter(
      (c) =>
        matchesQuery(c.name, query) ||
        matchesQuery(c.taxNumber, query) ||
        matchesQuery(c.euVatNumber, query) ||
        matchesQuery(c.email, query),
    )
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map(clientResult);
  const products = input.products
    .filter((p) => matchesQuery(p.name, query) || matchesQuery(p.description, query))
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map(productResult);

  const groups: SearchGroup[] = [
    { key: "invoices", results: invoices },
    { key: "clients", results: clients },
    { key: "products", results: products },
  ];
  return groups.filter((group) => group.results.length > 0);
}

export function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((group) => group.results);
}

/** Next row for ArrowDown (+1) / ArrowUp (-1), wrapping; -1 means "none yet". */
export function moveActiveIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : length - 1;
  return (current + delta + length) % length;
}
