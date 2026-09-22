// lib/payments/index.ts
// Payment provider router — selects Revolut or Barion adapter.
import { isPaymentProviderAvailable } from "@/lib/payments/availability";
import { createBarionPaymentLink } from "@/lib/payments/barion";
import { createRevolutPaymentLink } from "@/lib/payments/revolut";
import type { PaymentLinkRequest, PaymentLinkResult, PaymentProvider } from "@/lib/payments/types";

/** Thrown by createPaymentLink when `provider` is gated off — see lib/payments/availability.ts. */
export class PaymentProviderUnavailableError extends Error {
  constructor(readonly provider: PaymentProvider) {
    super(`Payment provider "${provider}" is not available.`);
    this.name = "PaymentProviderUnavailableError";
  }
}

export async function createPaymentLink(
  provider: PaymentProvider,
  request: PaymentLinkRequest
): Promise<PaymentLinkResult> {
  if (!isPaymentProviderAvailable(provider)) {
    throw new PaymentProviderUnavailableError(provider);
  }

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
