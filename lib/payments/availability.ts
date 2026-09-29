// lib/payments/availability.ts
// Gates which payment providers may be offered to users/customers.
//
// A provider is only "available" when its adapter makes a real API call to
// the provider using real credentials. lib/payments/revolut.ts and
// lib/payments/barion.ts are currently stub adapters — they never call out
// to Revolut/Barion and always return a placeholder checkout URL, no matter
// what env credentials are configured. Offering that URL anywhere (UI menu,
// API response, email, PDF) means a customer could receive a payment link
// that goes nowhere.
//
// When an adapter is upgraded to a real, credentialed integration, add its
// provider to REAL_PROVIDER_IMPLEMENTATIONS *and* keep its required env var
// listed in PROVIDER_REQUIRED_ENV below — both must hold for the provider to
// be considered available.
import type { PaymentProvider } from "@/lib/payments/types";

/** Providers whose adapter performs a real, credentialed provider API call. */
const REAL_PROVIDER_IMPLEMENTATIONS: ReadonlySet<PaymentProvider> = new Set([]);

/** Env vars required for each real provider's credentials to be considered configured. */
const PROVIDER_REQUIRED_ENV: Partial<Record<PaymentProvider, readonly string[]>> = {
  revolut: ["REVOLUT_API_KEY"],
  barion: ["BARION_POS_KEY"],
};

/** A stable machine-readable code for API responses when a provider is gated off. */
export const PAYMENT_PROVIDER_UNAVAILABLE_CODE = "paymentProviderUnavailable";

/**
 * Whether `provider` may be offered/used right now.
 *
 * - "manual" is always available: it deliberately returns no URL rather than
 *   claiming a link exists, so it never misleads anyone.
 * - "revolut" / "barion" are only available once their adapter is a real
 *   implementation AND its required credentials are configured in env.
 */
export function isPaymentProviderAvailable(provider: PaymentProvider): boolean {
  if (provider === "manual") return true;

  if (!REAL_PROVIDER_IMPLEMENTATIONS.has(provider)) return false;

  const requiredEnv = PROVIDER_REQUIRED_ENV[provider] ?? [];
  return requiredEnv.every((key) => Boolean(process.env[key]?.trim()));
}

/** Filters a list of providers down to the ones currently available. */
export function filterAvailablePaymentProviders(
  providers: readonly PaymentProvider[]
): PaymentProvider[] {
  return providers.filter(isPaymentProviderAvailable);
}
