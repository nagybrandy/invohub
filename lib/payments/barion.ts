// lib/payments/barion.ts
// Barion payment link stub — returns placeholder URL until POS key is configured.
import type { PaymentLinkRequest, PaymentLinkResult } from "@/lib/payments/types";

export async function createBarionPaymentLink(
  request: PaymentLinkRequest
): Promise<PaymentLinkResult> {
  const externalId = `barion-stub-${request.invoiceId}-${Date.now()}`;
  const baseUrl = process.env.BARION_CHECKOUT_BASE ?? "https://secure.barion.com";
  return {
    provider: "barion",
    url: `${baseUrl}/Pay?id=${externalId}`,
    externalId,
  };
}
