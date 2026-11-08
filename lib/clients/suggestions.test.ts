// lib/clients/suggestions.test.ts
import { listPartnerSuggestions } from "@/lib/clients/suggestions";

let mockQueue: unknown[][] = [];
let mockSelectCalls = 0;
jest.mock("@/db", () => {
  const chain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "orderBy"]) c[m] = () => c;
    c.limit = () => Promise.resolve(mockQueue.shift() ?? []);
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(mockQueue.shift() ?? []).then(res);
    return c;
  };
  return { db: { select: () => { mockSelectCalls += 1; return chain(); } } };
});

const row = (o: Record<string, unknown>) => ({
  id: "i1", userId: "A", clientId: null, clientName: "Acme", clientTaxNumber: null,
  issueDate: "2026-10-01", dueDate: "2026-10-09", currency: "EUR", language: "en",
  paymentMethod: "transfer", documentType: "invoice", status: "sent", ...o,
});

beforeEach(() => { mockQueue = []; mockSelectCalls = 0; });

it("uses three queries total (no N+1) and drops foreign-account rows", async () => {
  mockQueue = [
    [row({}), row({ id: "z", userId: "B", clientName: "Foreign", issueDate: "2026-11-01" })],
    [],
    [{ invoiceId: "i1", description: "Dev", quantity: "1", unitPrice: "50", unit: null, vatRate: 0, vatCategory: "AAM", sortOrder: 0 }],
  ];
  const out = await listPartnerSuggestions("A", "");
  expect(mockSelectCalls).toBe(3);
  expect(out.map((s) => s.partner.name)).toEqual(["Acme"]);
  expect(out[0].usual).toMatchObject({ currency: "EUR", paymentTermDays: 8, vat: { rate: 0, category: "AAM" } });
});

it("returns early without partners", async () => {
  mockQueue = [[]];
  expect(await listPartnerSuggestions("A", "x")).toEqual([]);
  expect(mockSelectCalls).toBe(1);
});
