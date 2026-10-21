import { partnerToRemember, productsToRemember } from "@/lib/invoices/remember-entities";

const buyer = { clientName: "Új Partner Kft.", clientTaxNumber: "99999999-2-41", clientZipCode: "1111", clientCity: "Budapest", clientAddress: "Fő u. 1." };

describe("partnerToRemember", () => {
  it("remembers a buyer typed or found by search, with all the details", () => {
    expect(partnerToRemember({ ...buyer, clientEmail: " a@b.hu " }, [])).toEqual({
      name: "Új Partner Kft.", email: "a@b.hu", taxNumber: "99999999-2-41", zipCode: "1111", city: "Budapest", address: "Fő u. 1.",
      euVatNumber: undefined, country: undefined,
    });
  });
  it("does not duplicate a saved partner — by linked id, by törzsszám, or by name", () => {
    expect(partnerToRemember({ ...buyer, clientId: "c1" }, [])).toBeNull();
    expect(partnerToRemember(buyer, [{ name: "Más név", taxNumber: "99999999-1-11" }])).toBeNull();
    expect(partnerToRemember({ ...buyer, clientTaxNumber: undefined }, [{ name: "ÚJ partner kft." }])).toBeNull();
  });
  it("ignores a nameless buyer", () => {
    expect(partnerToRemember({ ...buyer, clientName: "  " }, [])).toBeNull();
  });
});

describe("productsToRemember", () => {
  const li = (description: string, unitPrice: number, extra = {}) => ({ description, unitPrice, vatRate: 27 as const, vatCategory: "normal" as const, unit: "óra", ...extra });
  it("remembers new priced lines once, skips catalog hits and empty or free lines", () => {
    const out = productsToRemember(
      [li("Tanácsadás", 25000), li("tanácsadás", 30000), li("Meglévő", 100), li("", 5), li("Ingyenes", 0)],
      [{ name: "meglévő" }],
      "HUF",
    );
    expect(out).toEqual([{ name: "Tanácsadás", unitPrice: 25000, vatRate: 27, unit: "óra", currency: "HUF" }]);
  });
  it("does not teach the catalog a rate for exempt lines", () => {
    const [p] = productsToRemember([li("AAM szolgáltatás", 1000, { vatCategory: "AAM", vatRate: 0 })], [], "HUF");
    expect(p.vatRate).toBeUndefined();
  });
});
