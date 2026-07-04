#!/usr/bin/env node
// scripts/test-api-invoice-email.mjs
// Creates a test invoice via external API and reports email delivery status.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

config({ path: ".env" });

const BASE_URL = process.env.EXPO_PUBLIC_AUTH_BASE_URL ?? "http://localhost:8081";
const TARGET_EMAIL = process.argv[2] ?? "bendeguznagy55@gmail.com";

function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function generatePublicKey() {
  return `ih_pk_${crypto.randomBytes(16).toString("hex")}`;
}

function generateSecretKey() {
  return `ih_sk_${crypto.randomBytes(24).toString("hex")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required in .env");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const users = await sql`SELECT id, email FROM "user" ORDER BY created_at ASC LIMIT 1`;
  if (users.length === 0) {
    console.error("No users found. Sign up first.");
    process.exit(1);
  }
  const user = users[0];

  await sql`
    UPDATE company
    SET invoice_email_to = ${TARGET_EMAIL}, updated_at = NOW()
    WHERE user_id = ${user.id}
  `;

  const existingCompany = await sql`SELECT id FROM company WHERE user_id = ${user.id} LIMIT 1`;
  if (existingCompany.length === 0) {
    await sql`
      INSERT INTO company (id, user_id, name, invoice_email_to, created_at, updated_at)
      VALUES (${`cmp_${Date.now()}`}, ${user.id}, ${"InvoHub Test Kft."}, ${TARGET_EMAIL}, NOW(), NOW())
    `;
  }

  const publicKey = generatePublicKey();
  const secretKey = generateSecretKey();
  const keyId = `key_${Date.now()}`;

  await sql`
    INSERT INTO api_key (id, user_id, name, public_key, secret_hash, enabled, created_at, updated_at)
    VALUES (
      ${keyId},
      ${user.id},
      ${"API email test"},
      ${publicKey},
      ${hashSecret(secretKey)},
      true,
      NOW(),
      NOW()
    )
  `;

  const payload = {
    clientName: "API Test Client Kft.",
    status: "sent",
    currency: "EUR",
    lineItems: [
      {
        description: "API invoice email test",
        quantity: 1,
        unitPrice: 150,
        vatRate: 27,
      },
    ],
    sendEmail: true,
    emailTo: TARGET_EMAIL,
  };

  console.log(`User: ${user.email}`);
  console.log(`Target email: ${TARGET_EMAIL}`);
  console.log(`POST ${BASE_URL}/api/v1/invoices`);

  const response = await fetch(`${BASE_URL}/api/v1/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicKey}:${secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  console.log("Status:", response.status);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok) {
    process.exit(1);
  }

  if (body.email?.sent) {
    console.log(`\nEmail queued/sent to ${body.email.to}`);
  } else {
    console.log(`\nEmail NOT sent: ${body.email?.error ?? "unknown error"}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
