// lib/payments/index.ts
// Payment provider router — selects Revolut or Barion adapter.
import { createBarionPaymentLink } from "@/lib/payments/barion";
import { createRevolutPaymentLink } from "@/lib/payments/revolut";
import type { PaymentLinkRequest, PaymentLinkResult, PaymentProvider } from "@/lib/payments/types";

export async function createPaymentLink(
  provider: PaymentProvider,
  request: PaymentLinkRequest
): Promise<PaymentLinkResult> {
  switch (provider) {
    case "revolut":
      return createRevolutPaymentLink(request);
    case "barion":
      return createBarionPaymentLink(request);
    case "manual":
      return {
        provider: "manual",
        url: "",
        externalId: `manual-${request.invoiceId}`,
      };
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
