// lib/invoices/remember-entities.ts
// "Intelligent" partner and product memory: once an invoice has been issued
// to a buyer or with a line that is not in the catalog yet, remember it, so
// the next invoice offers it while typing (PartnerPicker / LineItemRow
// autocomplete) instead of making the user type it all again.
//
// Pure: decides WHAT to remember; the composer posts it (best effort — a
// failed save here must never fail the invoice that was just issued).
import type { Client, ClientInput } from "@/lib/clients/service";
import type { Product, ProductInput } from "@/lib/products/service";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();
/** The 8-digit törzsszám of an adószám — the part that identifies the company. */
const stem = (taxNumber: string | undefined | null) => (taxNumber ?? "").replace(/\D/g, "").slice(0, 8);

type BuyerFields = Pick<
  Invoice,
  "clientId" | "clientName" | "clientTaxNumber" | "clientZipCode" | "clientCity" | "clientAddress" | "clientCountry" | "clientEuVatNumber"
> & { clientEmail?: string };

/** The buyer to save as a partner, or null when it is already one (or has no name). */
export function partnerToRemember(invoice: BuyerFields, clients: Pick<Client, "name" | "taxNumber">[]): ClientInput | null {
  if (invoice.clientId) return null;
  const name = invoice.clientName?.trim();
  if (!name) return null;
  const tax = stem(invoice.clientTaxNumber);
  const known = clients.some((c) => (tax && stem(c.taxNumber) === tax) || norm(c.name) === norm(name));
  if (known) return null;
  return {
    name,
    email: invoice.clientEmail?.trim() || undefined,
    taxNumber: invoice.clientTaxNumber?.trim() || undefined,
    euVatNumber: invoice.clientEuVatNumber?.trim() || undefined,
    zipCode: invoice.clientZipCode?.trim() || undefined,
    city: invoice.clientCity?.trim() || undefined,
    address: invoice.clientAddress?.trim() || undefined,
    country: invoice.clientCountry?.trim() || undefined,
  };
}

/** Line items whose description is not in the product catalog yet (deduped, priced lines only). */
export function productsToRemember(
  lineItems: Pick<InvoiceLineItem, "description" | "unitPrice" | "vatRate" | "vatCategory" | "unit">[],
  products: Pick<Product, "name">[],
  currency: string,
): ProductInput[] {
  const seen = new Set(products.map((p) => norm(p.name)));
  const out: ProductInput[] = [];
  for (const li of lineItems) {
    const name = li.description?.trim();
    if (!name || !(li.unitPrice > 0) || seen.has(norm(name))) continue;
    seen.add(norm(name));
    out.push({
      name,
      unitPrice: li.unitPrice,
      // Only a taxed line has a rate worth remembering; AAM/TAM/FAD lines
      // would otherwise teach the catalog a 0% rate.
      vatRate: li.vatCategory === "normal" || li.vatCategory === undefined ? li.vatRate : undefined,
      unit: li.unit,
      currency,
    });
  }
  return out;
}
