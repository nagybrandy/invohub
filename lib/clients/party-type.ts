// lib/clients/party-type.ts
// Whether a partner is a company (any non-natural person, VAT subject or
// not) or a private person (natural person who is not a VAT subject). Drives
// the NAV customerVatStatus (see lib/nav/customer.ts). Stored nullable on
// client.party_type — null means "not specified", inferred from tax data.

export type ClientPartyType = "company" | "private_person";

export function normalizeClientPartyType(raw: unknown): ClientPartyType | null {
  return raw === "company" || raw === "private_person" ? raw : null;
}
