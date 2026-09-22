// lib/nav/customer.ts
// Derives the NAV OSA 3.0 <customerInfo> content for an invoice's buyer.
//
// CustomerVatStatusType (invoiceData.xsd, fetched 2026-09-22):
//  - DOMESTIC       "Belföldi ÁFA alany" -> customerVatData/customerTaxNumber
//  - OTHER          everything else that is not a natural person: domestic
//                   non-VAT subjects, foreign VAT and non-VAT subjects ->
//                   customerVatData/communityVatNumber (EU) or
//                   /thirdStateTaxId (third country), when known
//  - PRIVATE_PERSON non-VAT-subject natural person (domestic or foreign) —
//                   no customerVatData, customerName or customerAddress may
//                   be sent (NAV's GDPR rule for private-person buyers).
//
// The derivation is deliberately conservative and every judgement call is
// listed in the PR for the owner's NAV sign-off.
import type { Client } from "@/lib/clients/service";
import type { ClientPartyType } from "@/lib/clients/party-type";
import type { Invoice } from "@/lib/invoices/types";
import { countryCodeFromVatNumber, isEuCountryCode, toIsoCountryCode } from "@/lib/nav/country-code";

export type NavBuyerAddress = {
  country?: string;
  postalCode?: string;
  city?: string;
  /** Street, house number etc. -> simpleAddress/additionalAddressDetail. */
  street?: string;
};

export type NavBuyer = {
  name: string;
  taxNumber?: string;
  euVatNumber?: string;
  partyType?: ClientPartyType;
  address: NavBuyerAddress;
};

export type NavTaxNumber = { taxpayerId: string; vatCode?: string; countyCode?: string };

export type NavSimpleAddress = {
  countryCode: string;
  postalCode: string;
  city: string;
  additionalAddressDetail: string;
};

export type NavCustomer =
  | { vatStatus: "PRIVATE_PERSON" }
  | { vatStatus: "DOMESTIC"; taxNumber: NavTaxNumber; name: string; address: NavSimpleAddress | null }
  | {
      vatStatus: "OTHER";
      communityVatNumber?: string;
      thirdStateTaxId?: string;
      name: string;
      address: NavSimpleAddress | null;
    };

/**
 * Hungarian adószám: 8-digit törzsszám, optionally followed by the 1-digit
 * ÁFA-kód (1–5) and the 2-digit területi kód; an "HU" community VAT number
 * yields just the törzsszám.
 */
export function parseHungarianTaxNumber(value: string | undefined | null): NavTaxNumber | null {
  const compact = value?.replace(/[\s-]/g, "").toUpperCase() ?? "";
  const hu = compact.match(/^HU(\d{8})$/);
  if (hu) return { taxpayerId: hu[1] };
  const bare = compact.match(/^(\d{8})$/);
  if (bare) return { taxpayerId: bare[1] };
  const full = compact.match(/^(\d{8})([1-5])(\d{2})$/);
  if (full) return { taxpayerId: full[1], vatCode: full[2], countyCode: full[3] };
  return null;
}

function normalizeVatNumber(value: string | undefined | null): string | null {
  const compact = value?.replace(/[\s.-]/g, "").toUpperCase() ?? "";
  // CommunityVatNumberType: two-letter prefix + 2..13 alphanumerics.
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(compact) ? compact : null;
}

/**
 * The one place the NAV XML reads the buyer's address from. A finalized
 * invoice carries its own buyer-address snapshot (clientZipCode/clientCity/
 * clientAddress/clientCountry, frozen at issue — Áfa tv. 169. § e)), which
 * always wins: renaming or moving the partner later must never change what
 * an issued invoice reports. Only invoices from before the snapshot existed
 * (no snapshot address field at all) fall back to the linked partner.
 */
export function navBuyerAddressOf(invoice: Invoice, client: Client | null): NavBuyerAddress {
  const snapshot = {
    postalCode: invoice.clientZipCode?.trim(),
    city: invoice.clientCity?.trim(),
    street: invoice.clientAddress?.trim(),
  };
  if (snapshot.postalCode || snapshot.city || snapshot.street) {
    const address: NavBuyerAddress = {};
    const country = invoice.clientCountry?.trim() || client?.country?.trim();
    if (country) address.country = country;
    if (snapshot.postalCode) address.postalCode = snapshot.postalCode;
    if (snapshot.city) address.city = snapshot.city;
    if (snapshot.street) address.street = snapshot.street;
    return address;
  }

  if (!client) return {};
  const address: NavBuyerAddress = {};
  const country = invoice.clientCountry?.trim() || client.country;
  if (country) address.country = country;
  if (client.zipCode) address.postalCode = client.zipCode;
  if (client.city) address.city = client.city;
  if (client.address) address.street = client.address;
  return address;
}

/**
 * Buyer as NAV sees it: name, tax number, EU VAT number and address from the
 * invoice snapshot (partner as fallback for pre-snapshot invoices); the party
 * type is only known on the partner.
 */
export function resolveNavBuyer(invoice: Invoice, client: Client | null): NavBuyer {
  return {
    name: invoice.clientName,
    taxNumber: invoice.clientTaxNumber?.trim() || undefined,
    euVatNumber: invoice.clientEuVatNumber?.trim() || client?.euVatNumber?.trim() || undefined,
    partyType: client?.partyType,
    address: navBuyerAddressOf(invoice, client),
  };
}

function toSimpleAddress(address: NavBuyerAddress, fallbackCountry: string | null): NavSimpleAddress | null {
  const countryCode = toIsoCountryCode(address.country) ?? fallbackCountry;
  const postalCode = address.postalCode?.trim();
  const city = address.city?.trim();
  const additionalAddressDetail = address.street?.trim();
  // Every SimpleAddressType child except region is mandatory: omit the whole
  // address rather than emit a schema-invalid one.
  if (!countryCode || !postalCode || !city || !additionalAddressDetail) return null;
  return { countryCode, postalCode, city, additionalAddressDetail };
}

export function deriveNavCustomer(buyer: NavBuyer): NavCustomer {
  if (buyer.partyType === "private_person") return { vatStatus: "PRIVATE_PERSON" };

  const name = buyer.name.trim();
  const countryCode = toIsoCountryCode(buyer.address.country);

  const huTaxNumber = parseHungarianTaxNumber(buyer.taxNumber) ?? parseHungarianTaxNumber(buyer.euVatNumber);
  if (huTaxNumber) {
    return {
      vatStatus: "DOMESTIC",
      taxNumber: huTaxNumber,
      name,
      address: toSimpleAddress(buyer.address, "HU"),
    };
  }

  const communityVatNumber = normalizeVatNumber(buyer.euVatNumber) ?? normalizeVatNumber(buyer.taxNumber);
  const vatCountry = countryCodeFromVatNumber(communityVatNumber);
  if (communityVatNumber && vatCountry && vatCountry !== "HU" && isEuCountryCode(vatCountry)) {
    return {
      vatStatus: "OTHER",
      communityVatNumber,
      name,
      address: toSimpleAddress(buyer.address, vatCountry),
    };
  }

  const foreignTaxId = buyer.taxNumber?.trim();
  if (foreignTaxId && countryCode && countryCode !== "HU" && !isEuCountryCode(countryCode)) {
    return {
      vatStatus: "OTHER",
      thirdStateTaxId: foreignTaxId.slice(0, 50),
      name,
      address: toSimpleAddress(buyer.address, null),
    };
  }

  if (buyer.partyType === "company" || foreignTaxId) {
    return { vatStatus: "OTHER", name, address: toSimpleAddress(buyer.address, null) };
  }

  // No party type and no tax data: previous behaviour (natural person).
  return { vatStatus: "PRIVATE_PERSON" };
}
