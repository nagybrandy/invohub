import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import { nextSort, sortInvoices } from "@/lib/lists/invoice-sort";

const a = makeInvoice({ id: "a", issueDate: "2026-10-01", dueDate: "2026-10-30", lineItems: [makeLineItem({ unitPrice: 300 })] });
const b = makeInvoice({ id: "b", issueDate: "2026-10-20", dueDate: "2026-10-25", lineItems: [makeLineItem({ unitPrice: 100 })] });
const c = makeInvoice({ id: "c", issueDate: "2026-10-10", dueDate: "2026-11-05", lineItems: [makeLineItem({ unitPrice: 200 })] });

describe("sortInvoices", () => {
  it("sorts by issue date, newest first when descending", () => {
    expect(sortInvoices([a, b, c], { key: "issued", direction: "desc" }).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(sortInvoices([a, b, c], { key: "issued", direction: "asc" }).map((i) => i.id)).toEqual(["a", "c", "b"]);
  });
  it("sorts by due date and by gross amount", () => {
    expect(sortInvoices([a, b, c], { key: "due", direction: "asc" }).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(sortInvoices([a, b, c], { key: "gross", direction: "desc" }).map((i) => i.id)).toEqual(["a", "c", "b"]);
  });
  it("does not mutate its input", () => {
    const input = [a, b, c];
    sortInvoices(input, { key: "gross", direction: "asc" });
    expect(input.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("nextSort", () => {
  it("toggles the direction of the active column", () => {
    expect(nextSort({ key: "issued", direction: "desc" }, "issued")).toEqual({ key: "issued", direction: "asc" });
    expect(nextSort({ key: "issued", direction: "asc" }, "issued")).toEqual({ key: "issued", direction: "desc" });
  });
  it("starts a new column ascending", () => {
    expect(nextSort({ key: "issued", direction: "desc" }, "due")).toEqual({ key: "due", direction: "asc" });
  });
});
