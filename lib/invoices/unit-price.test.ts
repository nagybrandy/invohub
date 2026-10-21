import { displayUnitPrice, grossFromNet, netFromGross, storedUnitPrice } from "@/lib/invoices/unit-price";
import type { InvoiceLineItem } from "@/lib/invoices/types";

const normal27 = { vatRate: 27, vatCategory: "normal" } as const;

describe("unit price net/gross", () => {
  it("backs the net out of a gross 25 000 Ft at 27% and round-trips to the cent", () => {
    const net = netFromGross(25000, normal27);
    expect(net).toBeCloseTo(19685.039370, 6);
    expect(grossFromNet(net, normal27)).toBe(25000);
  });

  it("round-trips arbitrary cent amounts at every Hungarian rate", () => {
    for (const rate of [0, 5, 18, 27] as const) {
      for (const gross of [0.01, 99.99, 1234.56, 25000, 399999.99]) {
        const item = { vatRate: rate, vatCategory: "normal" } as const;
        expect(grossFromNet(netFromGross(gross, item), item)).toBe(gross);
      }
    }
  });

  it("treats gross as net on lines without a VAT component (AAM, TAM, fordított adózás…)", () => {
    for (const vatCategory of ["AAM", "TAM", "FAD", "ATK"] as const) {
      expect(netFromGross(25000, { vatRate: 0, vatCategory })).toBe(25000);
      // even if a stale rate is left on the line
      expect(netFromGross(25000, { vatRate: 27, vatCategory })).toBe(25000);
    }
  });

  it("displays and stores according to the chosen mode", () => {
    const item = { id: "1", description: "x", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" } as InvoiceLineItem;
    expect(displayUnitPrice(item, "net")).toBe(1000);
    expect(displayUnitPrice(item, "gross")).toBe(1270);
    expect(storedUnitPrice(750, item, "net")).toBe(750);
    expect(storedUnitPrice(1270, item, "gross")).toBe(1000);
  });
});
