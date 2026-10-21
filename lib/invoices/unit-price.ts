// lib/invoices/unit-price.ts
// Unit price entry as net OR gross. The invoice always stores the NET unit
// price (that is what totals, the PDF and the NAV XML are computed from); when
// the user types a gross price (e.g. brutto 25 000 Ft) we back-calculate the
// net, so nobody has to do it by hand.
//
// Only a taxed ("normal") line has a VAT component — for AAM/TAM/FAD/… the
// rate is 0 and gross === net.
import type { InvoiceLineItem } from "@/lib/invoices/types";

export type UnitPriceMode = "net" | "gross";

function effectiveRate(item: Pick<InvoiceLineItem, "vatRate" | "vatCategory">): number {
  return item.vatCategory === "normal" || item.vatCategory === undefined ? item.vatRate : 0;
}

/** Net unit price for a typed gross one. Kept to 6 decimals so gross → net → gross round-trips to the cent. */
export function netFromGross(gross: number, item: Pick<InvoiceLineItem, "vatRate" | "vatCategory">): number {
  const net = gross / (1 + effectiveRate(item) / 100);
  return Math.round(net * 1_000_000) / 1_000_000;
}

/** Gross unit price to show for a stored net one, rounded to the cent. */
export function grossFromNet(net: number, item: Pick<InvoiceLineItem, "vatRate" | "vatCategory">): number {
  return Math.round(net * (1 + effectiveRate(item) / 100) * 100) / 100;
}

/** The number the unit-price field should display in the given mode. */
export function displayUnitPrice(item: InvoiceLineItem, mode: UnitPriceMode): number {
  return mode === "gross" ? grossFromNet(item.unitPrice, item) : item.unitPrice;
}

/** The net unit price to store for what was typed in the given mode. */
export function storedUnitPrice(typed: number, item: Pick<InvoiceLineItem, "vatRate" | "vatCategory">, mode: UnitPriceMode): number {
  return mode === "gross" ? netFromGross(typed, item) : typed;
}
