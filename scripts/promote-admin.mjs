#!/usr/bin/env node
// scripts/promote-admin.mjs
// Owner-only CLI to grant the "admin" role to an existing user by email.
// This is now the ONLY supported way to create an admin outside the admin panel itself
// (see app/api/admin/users/[id]+api.ts) — there is no in-app self-promotion path.
//
// Usage:
//   DATABASE_URL=postgresql://... node scripts/promote-admin.mjs someone@example.com
// or, with a local .env file present:
//   node scripts/promote-admin.mjs someone@example.com
import { config } from "dotenv";

config({ path: ".env" });

const email = process.argv[2]?.trim().toLowerCase();

async function main() {
  if (!email) {
    console.error("Usage: node scripts/promote-admin.mjs <email>");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.");
    process.exit(1);
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  const users = await sql`SELECT id, email, role FROM "user" WHERE email = ${email} LIMIT 1`;
  if (users.length === 0) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }

  const target = users[0];
  if (target.role === "admin") {
    console.log(`${email} is already an admin.`);
    process.exit(0);
  }

  await sql`UPDATE "user" SET role = 'admin', updated_at = NOW() WHERE id = ${target.id}`;
  console.log(`Promoted ${email} (was "${target.role}") to admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
