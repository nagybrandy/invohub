// lib/search/global-search.test.ts
import {
  MAX_RESULTS_PER_GROUP,
  MIN_QUERY_LENGTH,
  buildSearchGroups,
  flattenGroups,
  highlightSegments,
  isSearchable,
  matchesQuery,
  moveActiveIndex,
  normalizeQuery,
} from "@/lib/search/global-search";
import type { Invoice } from "@/lib/invoices/types";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-00017",
    clientName: "Nordic Trade Bt.",
    issueDate: "2026-11-01",
    dueDate: "2026-11-09",
    status: "sent",
    currency: "HUF",
    lineItems: [{ id: "l1", description: "x", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }],
    ...overrides,
  } as Invoice;
}

describe("query rules", () => {
  it("needs at least two characters after trimming", () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(isSearchable("")).toBe(false);
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("no")).toBe(true);
    expect(isSearchable("  no  ")).toBe(true);
  });

  it("normalizeQuery trims", () => {
    expect(normalizeQuery("  Nordic ")).toBe("Nordic");
  });
});

describe("matchesQuery", () => {
  it("ignores case and accents", () => {
    expect(matchesQuery("Árvíztűrő Kft.", "arvizturo")).toBe(true);
    expect(matchesQuery("Nordic Trade", "TRADE")).toBe(true);
    expect(matchesQuery("Nordic Trade", "xyz")).toBe(false);
  });

  it("an empty needle matches nothing", () => {
    expect(matchesQuery("anything", "")).toBe(false);
  });
});

describe("highlightSegments", () => {
  it("splits the text around the match, keeping the original characters", () => {
    expect(highlightSegments("Nordic Trade Bt.", "nordic")).toEqual([
      { text: "Nordic", match: true },
      { text: " Trade Bt.", match: false },
    ]);
  });

  it("highlights every occurrence", () => {
    expect(highlightSegments("ab-ab", "ab")).toEqual([
      { text: "ab", match: true },
      { text: "-", match: false },
      { text: "ab", match: true },
    ]);
  });

  it("matches without accents but returns the accented text", () => {
    expect(highlightSegments("Árvíztűrő", "arviz")).toEqual([
      { text: "Árvíz", match: true },
      { text: "tűrő", match: false },
    ]);
  });

  it("returns one plain segment when nothing matches or the query is empty", () => {
    expect(highlightSegments("Nordic", "zzz")).toEqual([{ text: "Nordic", match: false }]);
    expect(highlightSegments("Nordic", "")).toEqual([{ text: "Nordic", match: false }]);
    expect(highlightSegments("", "no")).toEqual([]);
  });

  it("does not treat regex characters specially", () => {
    expect(highlightSegments("a.b (c)", ".b (")).toEqual([
      { text: "a", match: false },
      { text: ".b (", match: true },
      { text: "c)", match: false },
    ]);
  });
});

describe("buildSearchGroups", () => {
  const clients = [
    { id: "c1", name: "Nordic Trade Bt.", taxNumber: "46789901-2-17", city: "Győr" },
    { id: "c2", name: "Pixel Műhely Kft.", taxNumber: "12345678-1-42", city: "Budapest" },
  ] as never[];
  const products = [
    { id: "p1", name: "Nordic webdesign", unitPrice: 50000, currency: "HUF" },
    { id: "p2", name: "Hosting", unitPrice: 5000, currency: "HUF" },
  ] as never[];

  it("builds invoice, client and product groups, in that order, without empty ones", () => {
    const groups = buildSearchGroups({
      query: "nordic",
      invoices: [invoice({})],
      clients,
      products,
      locale: "hu",
    });
    expect(groups.map((g) => g.key)).toEqual(["invoices", "clients", "products"]);
    expect(groups[1].results.map((r) => r.title)).toEqual(["Nordic Trade Bt."]);
    expect(groups[2].results.map((r) => r.title)).toEqual(["Nordic webdesign"]);
  });

  it("an invoice row carries number, partner, date and the gross amount", () => {
    const [group] = buildSearchGroups({ query: "nordic", invoices: [invoice({})], clients: [], products: [], locale: "hu" });
    const row = group.results[0];
    expect(row.title).toBe("INV-2026-00017");
    expect(row.subtitle).toContain("Nordic Trade Bt.");
    expect(row.subtitle).toContain("2026");
    expect(row.amount).toMatch(/1.?270/);
    expect(row.href).toBe("/invoices/inv-1");
  });

  it("a draft without a number falls back to the partner name as its title", () => {
    const [group] = buildSearchGroups({
      query: "nordic",
      invoices: [invoice({ invoiceNumber: "", status: "draft" })],
      clients: [],
      products: [],
      locale: "hu",
    });
    expect(group.results[0].title).toBe("Nordic Trade Bt.");
  });

  it("matches partners by tax number and shows tax number and city", () => {
    const groups = buildSearchGroups({ query: "4678", invoices: [], clients, products: [], locale: "hu" });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("clients");
    expect(groups[0].results[0].subtitle).toBe("46789901-2-17 · Győr");
    expect(groups[0].results[0].href).toEqual("/clients/c1/edit");
  });

  it("caps every group at five results", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `Nordic ${i}` })) as never[];
    const groups = buildSearchGroups({ query: "nordic", invoices: [], clients: many, products: [], locale: "hu" });
    expect(MAX_RESULTS_PER_GROUP).toBe(5);
    expect(groups[0].results).toHaveLength(5);
  });

  it("returns nothing for a too short query", () => {
    expect(buildSearchGroups({ query: "n", invoices: [invoice({})], clients, products, locale: "hu" })).toEqual([]);
  });
});

describe("flattenGroups / moveActiveIndex", () => {
  it("flattens in display order", () => {
    const flat = flattenGroups([
      { key: "invoices", results: [{ key: "i1" }, { key: "i2" }] },
      { key: "clients", results: [{ key: "c1" }] },
    ] as never);
    expect(flat.map((r: { key: string }) => r.key)).toEqual(["i1", "i2", "c1"]);
  });

  it("arrow keys wrap around and start from the first / last row", () => {
    expect(moveActiveIndex(-1, 1, 3)).toBe(0);
    expect(moveActiveIndex(-1, -1, 3)).toBe(2);
    expect(moveActiveIndex(0, 1, 3)).toBe(1);
    expect(moveActiveIndex(2, 1, 3)).toBe(0);
    expect(moveActiveIndex(0, -1, 3)).toBe(2);
    expect(moveActiveIndex(0, 1, 0)).toBe(-1);
  });
});
