#!/usr/bin/env node
// scripts/test-smtp-direct.mjs
// Verifies SMTP credentials and sends a test invoice email directly (no HTTP server).
import { config } from "dotenv";

config({ path: ".env" });

const TARGET = process.argv[2] ?? "bendeguznagy55@gmail.com";

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  const users = await sql`SELECT id FROM "user" ORDER BY created_at ASC LIMIT 1`;
  const userId = users[0].id;

  const invoices = await sql`
    SELECT id FROM invoice WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1
  `;
  if (invoices.length === 0) {
    console.error("No invoices found for user.");
    process.exit(1);
  }

  await sql`
    UPDATE company SET invoice_email_to = ${TARGET}, updated_at = NOW() WHERE user_id = ${userId}
  `;

  const invoiceId = invoices[0].id;
  console.log(`Sending invoice ${invoiceId} email to ${TARGET}...`);

  const { sendInvoiceNotificationEmail } = await import("../lib/invoices/send-invoice-email.ts");
  const result = await sendInvoiceNotificationEmail(userId, invoiceId, { to: TARGET });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
