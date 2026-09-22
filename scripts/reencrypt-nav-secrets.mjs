#!/usr/bin/env node
// scripts/reencrypt-nav-secrets.mjs
// Owner-only, one-off: rewrites every stored NAV technical-user secret
// (company.nav_technical_password / nav_xml_sign_key / nav_xml_change_key)
// under the CURRENT NAV_CREDENTIALS_KEY + NAV_CREDENTIALS_KEY_ID:
//   - legacy plaintext rows      -> encrypted (gcm2)
//   - legacy gcm1 rows (no kid)  -> gcm2 with the current key id
//   - gcm2 under a previous kid  -> gcm2 under the current kid (key rotation)
//
// Dry run by default (prints counts only). Pass --apply to write.
// Never prints a secret value — only row ids and column names on failure.
// Each UPDATE is compare-and-set on the values read, so a row edited in the
// meantime is skipped (re-run the script to pick it up).
//
// Usage (needs DATABASE_URL + NAV_CREDENTIALS_KEY [+ NAV_CREDENTIALS_KEY_ID,
// NAV_CREDENTIALS_PREVIOUS_KEYS] in the environment or a local .env):
//   node scripts/reencrypt-nav-secrets.mjs            # dry run
//   node scripts/reencrypt-nav-secrets.mjs --apply    # write
import { register } from "node:module";
import { config } from "dotenv";

config({ path: ".env" });
register("./lib/alias-loader.mjs", import.meta.url);

const apply = process.argv.includes("--apply");

const COLUMN_SQL = {
  navTechnicalPassword: "nav_technical_password",
  navXmlSignKey: "nav_xml_sign_key",
  navXmlChangeKey: "nav_xml_change_key",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { isNavCredentialsEncryptionConfigured, currentNavCredentialsKeyId } = await import("@/lib/nav/credentials");
  const { planNavSecretReencryption } = await import("@/lib/nav/reencrypt");

  if (!isNavCredentialsEncryptionConfigured()) {
    console.error("NAV_CREDENTIALS_KEY (or NAV_CREDENTIALS_PREVIOUS_KEYS) is missing or invalid. See .env.example.");
    process.exit(1);
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT id,
           nav_technical_password AS "navTechnicalPassword",
           nav_xml_sign_key       AS "navXmlSignKey",
           nav_xml_change_key     AS "navXmlChangeKey"
      FROM company
     WHERE nav_technical_password IS NOT NULL
        OR nav_xml_sign_key IS NOT NULL
        OR nav_xml_change_key IS NOT NULL`;

  const plan = planNavSecretReencryption(rows);
  const columnCount = plan.updates.reduce((n, u) => n + Object.keys(u.set).length, 0);

  console.log(`Current key id: ${currentNavCredentialsKeyId()}`);
  console.log(`Companies with NAV secrets: ${rows.length}`);
  console.log(`  already current:        ${plan.unchangedRows}`);
  console.log(`  to re-encrypt:          ${plan.updates.length} rows / ${columnCount} values`);
  console.log(`  undecryptable:          ${plan.failures.length}`);
  for (const f of plan.failures) {
    console.log(`    - company ${f.id}: ${f.column} (missing previous key? user must re-enter it)`);
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  let skipped = 0;
  for (const update of plan.updates) {
    for (const [column, next] of Object.entries(update.set)) {
      const col = COLUMN_SQL[column];
      const previous = update.previous[column];
      // Column names come from the fixed COLUMN_SQL map above, never input.
      const result = await sql.query(
        `UPDATE company SET ${col} = $1, updated_at = now() WHERE id = $2 AND ${col} = $3 RETURNING id`,
        [next, update.id, previous]
      );
      if (result.length === 1) written += 1;
      else skipped += 1;
    }
  }
  console.log(`\nWritten: ${written} values. Skipped (changed meanwhile): ${skipped}.`);
}

main().catch((error) => {
  // Name + message only; never the raw error (bound params could include values).
  const message = error instanceof Error ? `${error.name}: ${error.message.split(/\n?\s*params:/i)[0]}` : "unknown error";
  console.error("reencrypt-nav-secrets failed:", message);
  process.exit(1);
});
