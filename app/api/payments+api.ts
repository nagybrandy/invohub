// app/api/payments+api.ts
// Generate payment link (Revolut/Barion stub).
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoice } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { getInvoiceById } from "@/lib/invoices/service";
import { createPaymentLink } from "@/lib/payments/index";
import type { PaymentProvider } from "@/lib/payments/types";

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

  const inv = await getInvoiceById(session.user.id, body.invoiceId);
  if (!inv) return jsonResponse({ error: "Invoice not found." }, 404);

  const totals = calculateInvoiceTotals(inv.lineItems);
  const provider = body.provider ?? "revolut";
  const link = await createPaymentLink(provider, {
    invoiceId: inv.id,
    amount: totals.totalAmount,
    currency: inv.currency,
    description: `Invoice ${inv.invoiceNumber}`,
  });

  await db
    .update(invoice)
    .set({ paymentLink: link.url, updatedAt: new Date() })
    .where(eq(invoice.id, inv.id));

  return jsonResponse({ payment: link });
}
