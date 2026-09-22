// lib/receipts/send-receipt-email.ts
import { getCompanyByUserId } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { resolveSenderIdentity } from "@/lib/email/sender";
import { formatCurrency } from "@/lib/invoices/calculations";
import { getReceiptById } from "@/lib/receipts/service";

export type SendReceiptEmailResult = {
  ok: boolean;
  error?: string;
  to?: string[];
};

function buildReceiptHtml(receipt: {
  receiptNumber: string;
  totalAmount: number;
  currency: string;
  issuedAt: string;
  qrUrl: string;
  clientName?: string;
}, companyName: string): string {
  const formattedAmount = formatCurrency(receipt.totalAmount, receipt.currency as any);
  const date = new Date(receipt.issuedAt).toLocaleDateString("hu-HU");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1f305e; margin-bottom: 8px;">${companyName} — Nyugta</h2>
      <p style="color: #666; margin-bottom: 24px;">Nyugta szám: <strong>${receipt.receiptNumber}</strong></p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Dátum:</td>
          <td style="padding: 8px 0; text-align: right;"><strong>${date}</strong></td>
        </tr>
        ${receipt.clientName ? `<tr>
          <td style="padding: 8px 0; color: #666;">Vevő:</td>
          <td style="padding: 8px 0; text-align: right;">${receipt.clientName}</td>
        </tr>` : ""}
        <tr style="border-top: 2px solid #6495ed;">
          <td style="padding: 12px 0; color: #1f305e; font-size: 18px;"><strong>Összesen:</strong></td>
          <td style="padding: 12px 0; text-align: right; color: #1f305e; font-size: 18px;"><strong>${formattedAmount}</strong></td>
        </tr>
      </table>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${receipt.qrUrl}" style="display: inline-block; background: #6495ed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Nyugta ellenőrzése
        </a>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        Ez az e-mail automatikusan készült az InvoHub rendszerben.
      </p>
    </div>
  `;
}

export async function sendReceiptEmail(
  userId: string,
  receiptId: string,
  to: string | string[]
): Promise<SendReceiptEmailResult> {
  const receipt = await getReceiptById(userId, receiptId);
  if (!receipt) {
    return { ok: false, error: "Receipt not found." };
  }

  const toList = Array.isArray(to) ? to : [to];
  if (toList.length === 0) {
    return { ok: false, error: "No recipient email provided." };
  }

  const company = await getCompanyByUserId(userId);
  const companyName = company?.name ?? "InvoHub";
  const sender = await resolveSenderIdentity(userId, company);

  const html = buildReceiptHtml(receipt, companyName);
  const subject = `Nyugta: ${receipt.receiptNumber} — ${companyName}`;

  const result = await sendEmail({
    to: toList,
    subject,
    html,
    fromName: sender.fromName,
    replyTo: sender.replyTo,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, to: toList };
}
