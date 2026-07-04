// lib/payments/revolut.ts
// Revolut payment link stub — returns placeholder URL until API key is configured.
import type { PaymentLinkRequest, PaymentLinkResult } from "@/lib/payments/types";

export async function createRevolutPaymentLink(
  request: PaymentLinkRequest
): Promise<PaymentLinkResult> {
  const externalId = `revolut-stub-${request.invoiceId}-${Date.now()}`;
  const baseUrl = process.env.REVOLUT_CHECKOUT_BASE ?? "https://pay.revolut.com";
  return {
    provider: "revolut",
    url: `${baseUrl}/stub/${externalId}`,
    externalId,
  };
}
