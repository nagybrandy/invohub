#!/usr/bin/env node
// scripts/create-test-user.mjs
// Creates (or reuses) a real account for authenticated Playwright E2E runs — via Better
// Auth's own server API, so it goes through the same password hashing / hooks as a real
// signup — then seeds it with demo data (clients, invoices, receipts, …) so the
// authenticated specs in e2e/web/*.spec.ts have something to assert on.
//
// Usage:
//   DATABASE_URL=postgresql://... \
//   E2E_TEST_EMAIL=e2e-test@invohub.test \
//   E2E_TEST_PASSWORD='a-strong-password' \
//     node scripts/create-test-user.mjs
//
// Run this once against a scratch/dev database before `npm run test:e2e:web` with the
// same E2E_TEST_EMAIL / E2E_TEST_PASSWORD exported — see TESTING.md.
//
// NEVER run this against a production database.
import { config } from "dotenv";

config({ path: ".env" });

const email = process.env.E2E_TEST_EMAIL?.trim().toLowerCase();
const password = process.env.E2E_TEST_PASSWORD;
const name = process.env.E2E_TEST_NAME ?? "InvoHub E2E Test";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Point it at a scratch/dev Neon database — never production."
    );
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD first.");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("Refusing to run against a production environment.");
    process.exit(1);
  }

  const { auth } = await import("../lib/auth.ts");
  const { seedDemoData } = await import("../lib/seed/demo-data.ts");

  let userId;
  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });
    userId = result.user.id;
    console.log(`Created test user ${email} (${userId}).`);
  } catch (e) {
    const isAlreadyExists =
      e && typeof e === "object" && "status" in e && e.status === "UNPROCESSABLE_ENTITY";
    if (!isAlreadyExists) throw e;

    console.log(`${email} already exists, reusing it.`);
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    const users = await sql`SELECT id FROM "user" WHERE email = ${email} LIMIT 1`;
    if (users.length === 0) {
      console.error(`Sign-up said "already exists" but no user row was found for ${email}.`);
      process.exit(1);
    }
    userId = users[0].id;
  }

  console.log(`Seeding demo data for ${email}...`);
  const result = await seedDemoData(userId);
  console.log(JSON.stringify(result, null, 2));
  console.log("Done. Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD to these values when running Playwright.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
