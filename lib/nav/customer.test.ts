// lib/nav/customer.test.ts
import {
  deriveNavCustomer,
  navBuyerAddressOf,
  parseHungarianTaxNumber,
  resolveNavBuyer,
  type NavBuyer,
} from "@/lib/nav/customer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import type { Client } from "@/lib/clients/service";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cl-1",
    userId: "u1",
    name: "Acme Kft.",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function buyer(overrides: Partial<NavBuyer> = {}): NavBuyer {
  return {
    name: "Acme Kft.",
    address: { country: "HU", postalCode: "1052", city: "Budapest", street: "Váci utca 1." },
    ...overrides,
  };
}

describe("parseHungarianTaxNumber", () => {
  it("splits a full 11-digit adószám into taxpayerId / vatCode / countyCode", () => {
    expect(parseHungarianTaxNumber("12345678-2-42")).toEqual({
      taxpayerId: "12345678",
      vatCode: "2",
      countyCode: "42",
    });
    expect(parseHungarianTaxNumber("12345678 1 13")).toEqual({
      taxpayerId: "12345678",
      vatCode: "1",
      countyCode: "13",
    });
  });

  it("accepts a bare 8-digit törzsszám (no vatCode/countyCode) and an HU community VAT number", () => {
    expect(parseHungarianTaxNumber("12345678")).toEqual({ taxpayerId: "12345678" });
    expect(parseHungarianTaxNumber("HU12345678")).toEqual({ taxpayerId: "12345678" });
  });

  it("rejects foreign VAT numbers and malformed input", () => {
    expect(parseHungarianTaxNumber("DE123456789")).toBeNull();
    expect(parseHungarianTaxNumber("1234")).toBeNull();
    expect(parseHungarianTaxNumber("12345678-9-99")).toBeNull(); // vatCode must be 1-5
    expect(parseHungarianTaxNumber(undefined)).toBeNull();
  });
});

describe("navBuyerAddressOf (single accessor for the buyer address)", () => {
  it("reads the linked client's address today", () => {
    const address = navBuyerAddressOf(
      makeInvoice(),
      makeClient({ country: "Magyarország", zipCode: "1052", city: "Budapest", address: "Váci utca 1." })
    );
    expect(address).toEqual({ country: "Magyarország", postalCode: "1052", city: "Budapest", street: "Váci utca 1." });
  });

  it("returns an empty address when there is no linked client", () => {
    expect(navBuyerAddressOf(makeInvoice(), null)).toEqual({});
  });
});

describe("resolveNavBuyer", () => {
  it("takes name + tax number from the invoice snapshot, EU VAT number / party type / address from the client", () => {
    const result = resolveNavBuyer(
      makeInvoice({ clientName: "Snapshot Kft.", clientTaxNumber: "11111111-2-41" }),
      makeClient({ name: "Renamed Kft.", taxNumber: "99999999-2-41", euVatNumber: "HU11111111", partyType: "company", city: "Budapest" })
    );
    expect(result.name).toBe("Snapshot Kft.");
    expect(result.taxNumber).toBe("11111111-2-41");
    expect(result.euVatNumber).toBe("HU11111111");
    expect(result.partyType).toBe("company");
    expect(result.address.city).toBe("Budapest");
  });
});

describe("deriveNavCustomer", () => {
  it("DOMESTIC: Hungarian tax number -> customerTaxNumber, name and a full HU simpleAddress", () => {
    const customer = deriveNavCustomer(buyer({ taxNumber: "12345678-2-42" }));
    expect(customer).toEqual({
      vatStatus: "DOMESTIC",
      taxNumber: { taxpayerId: "12345678", vatCode: "2", countyCode: "42" },
      name: "Acme Kft.",
      address: { countryCode: "HU", postalCode: "1052", city: "Budapest", additionalAddressDetail: "Váci utca 1." },
    });
  });

  it("DOMESTIC: defaults a blank country to HU for a Hungarian taxpayer", () => {
    const customer = deriveNavCustomer(
      buyer({ taxNumber: "12345678-2-42", address: { postalCode: "1052", city: "Budapest", street: "Váci utca 1." } })
    );
    expect(customer.vatStatus).toBe("DOMESTIC");
    expect(customer.vatStatus === "DOMESTIC" && customer.address?.countryCode).toBe("HU");
  });

  it("omits the address (null) rather than emitting an incomplete simpleAddress", () => {
    const customer = deriveNavCustomer(
      buyer({ taxNumber: "12345678-2-42", address: { country: "HU", city: "Budapest" } })
    );
    expect(customer.vatStatus === "DOMESTIC" && customer.address).toBeNull();
  });

  it("PRIVATE_PERSON: explicit private person — no tax data, name or address at all", () => {
    const customer = deriveNavCustomer(buyer({ partyType: "private_person", name: "Kiss Anna" }));
    expect(customer).toEqual({ vatStatus: "PRIVATE_PERSON" });
  });

  it("PRIVATE_PERSON: explicit private person wins even if a stray tax number is present", () => {
    expect(deriveNavCustomer(buyer({ partyType: "private_person", taxNumber: "12345678-1-42" }))).toEqual({
      vatStatus: "PRIVATE_PERSON",
    });
  });

  it("PRIVATE_PERSON: legacy partner with no party type and no tax data (previous behaviour)", () => {
    expect(deriveNavCustomer(buyer({ taxNumber: undefined, euVatNumber: undefined }))).toEqual({
      vatStatus: "PRIVATE_PERSON",
    });
  });

  it("OTHER (EU): foreign EU VAT number -> communityVatNumber + name + address", () => {
    const customer = deriveNavCustomer(
      buyer({
        name: "Muster GmbH",
        euVatNumber: "de 123 456 789",
        address: { country: "Németország", postalCode: "10115", city: "Berlin", street: "Hauptstr. 1" },
      })
    );
    expect(customer).toEqual({
      vatStatus: "OTHER",
      communityVatNumber: "DE123456789",
      name: "Muster GmbH",
      address: { countryCode: "DE", postalCode: "10115", city: "Berlin", additionalAddressDetail: "Hauptstr. 1" },
    });
  });

  it("OTHER (EU): an EU VAT number typed into the tax-number field is recognised too", () => {
    const customer = deriveNavCustomer(
      buyer({ taxNumber: "ATU12345678", address: { country: "AT", postalCode: "1010", city: "Wien", street: "Ring 1" } })
    );
    expect(customer.vatStatus).toBe("OTHER");
    expect(customer.vatStatus === "OTHER" && customer.communityVatNumber).toBe("ATU12345678");
  });

  it("OTHER (EU): derives the address country from the VAT prefix when the country field is blank", () => {
    const customer = deriveNavCustomer(
      buyer({ euVatNumber: "EL123456789", address: { postalCode: "10431", city: "Athens", street: "Odos 1" } })
    );
    expect(customer.vatStatus === "OTHER" && customer.address?.countryCode).toBe("GR");
  });

  it("OTHER (third country): non-EU country + tax id -> thirdStateTaxId", () => {
    const customer = deriveNavCustomer(
      buyer({
        name: "Example Inc.",
        taxNumber: "12-3456789",
        address: { country: "USA", postalCode: "10001", city: "New York", street: "5th Ave 1" },
      })
    );
    expect(customer).toEqual({
      vatStatus: "OTHER",
      thirdStateTaxId: "12-3456789",
      name: "Example Inc.",
      address: { countryCode: "US", postalCode: "10001", city: "New York", additionalAddressDetail: "5th Ave 1" },
    });
  });

  it("OTHER: a company with no tax data (e.g. a domestic non-VAT-subject association) keeps name + address, no vat data", () => {
    const customer = deriveNavCustomer(buyer({ partyType: "company", name: "Horgász Egyesület" }));
    expect(customer).toEqual({
      vatStatus: "OTHER",
      name: "Horgász Egyesület",
      address: { countryCode: "HU", postalCode: "1052", city: "Budapest", additionalAddressDetail: "Váci utca 1." },
    });
  });
});
