// app/api/payments+api.ts
// Generate a payment link. Revolut/Barion adapters are stubs (no real
// provider API call) until a real integration ships — see
// lib/payments/availability.ts — so requests for an unavailable provider are
// refused with 501 rather than handed a fake URL.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoice } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { getInvoiceById } from "@/lib/invoices/service";
import { PAYMENT_PROVIDER_UNAVAILABLE_CODE, isPaymentProviderAvailable } from "@/lib/payments/availability";
import { createPaymentLink } from "@/lib/payments/index";
import type { PaymentProvider } from "@/lib/payments/types";

const VALID_PROVIDERS: readonly PaymentProvider[] = ["revolut", "barion", "manual"];

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as {
    invoiceId?: string;
    provider?: PaymentProvider;
  };

  if (!body.invoiceId) {
    return jsonResponse({ error: "invoiceId required." }, 400);
  }

  const provider = body.provider ?? "revolut";
  if (!VALID_PROVIDERS.includes(provider)) {
    return jsonResponse({ error: `Unknown provider "${provider}".` }, 400);
  }

  if (!isPaymentProviderAvailable(provider)) {
    return jsonResponse(
      {
        error: `Payment provider "${provider}" is not available yet.`,
        code: PAYMENT_PROVIDER_UNAVAILABLE_CODE,
      },
      501
    );
  }

  const inv = await getInvoiceById(session.user.id, body.invoiceId);
  if (!inv) return jsonResponse({ error: "Invoice not found." }, 404);

  const totals = calculateInvoiceTotals(inv.lineItems);
  const link = await createPaymentLink(provider, {
    invoiceId: inv.id,
    amount: totals.totalAmount,
    currency: inv.currency,
    description: `Invoice ${inv.invoiceNumber}`,
  });

  await db
    .update(invoice)
    .set({ paymentLink: link.url, updatedAt: new Date() })
    .where(and(eq(invoice.id, inv.id), eq(invoice.userId, session.user.id)));

  return jsonResponse({ payment: link });
}
