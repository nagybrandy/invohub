#!/usr/bin/env node
// scripts/nav-check.mjs
// Owner tool: verifies the NAV Online Számla TEST credentials in .env by
// running a real tokenExchange + queryTaxpayer against the NAV TEST server.
// Never prints secret values. Run with: npm run nav:check
import { register } from "node:module";
import { config } from "dotenv";

config({ path: ".env" });
register("./lib/alias-loader.mjs", import.meta.url);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✗ Hiányzik a(z) ${name} környezeti változó (.env). Lásd .env.example.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  console.log("NAV Online Számla TEST kapcsolat ellenőrzése…\n");

  requireEnv("NAV_SOFTWARE_ID");
  requireEnv("NAV_TEST_LOGIN");
  requireEnv("NAV_TEST_PASSWORD");
  requireEnv("NAV_TEST_SIGN_KEY");
  requireEnv("NAV_TEST_CHANGE_KEY");
  const taxNumberRaw = requireEnv("NAV_TEST_TAX_NUMBER");
  const taxNumber = taxNumberRaw.replace(/\D/g, "").slice(0, 8);

  const { createNavRealClient } = await import("@/lib/nav/real-client");

  const credentials = {
    login: process.env.NAV_TEST_LOGIN,
    password: process.env.NAV_TEST_PASSWORD,
    signKey: process.env.NAV_TEST_SIGN_KEY,
    exchangeKey: process.env.NAV_TEST_CHANGE_KEY,
    taxNumber,
    environment: "test",
    source: "shared",
  };

  const client = createNavRealClient("test");

  console.log("1/2 tokenExchange…");
  let exchangeToken;
  try {
    const result = await client.tokenExchange(credentials);
    exchangeToken = result.exchangeToken;
    console.log(`  ✓ Sikeres — a kapott exchangeToken hossza: ${exchangeToken.length} karakter.\n`);
  } catch (error) {
    console.error(`  ✗ Sikertelen: ${error instanceof Error ? error.message : error}\n`);
    console.error(
      "Ellenőrizd: a technikai felhasználó/jelszó/aláíró kulcs/cserekulcs helyes-e, és hogy a technikai\n" +
        "felhasználó a NAV Online Számla TESZT felületén aktiválva van-e (onlineszamla-test.nav.gov.hu)."
    );
    process.exit(1);
  }
  void exchangeToken;

  console.log(`2/2 queryTaxpayer (saját adószám: ${taxNumber})…`);
  try {
    const result = await client.queryTaxpayer(credentials, taxNumber);
    if (result.valid) {
      console.log(`  ✓ Sikeres — NAV szerint érvényes adóalany: ${result.name || "(név nélkül)"}.\n`);
    } else {
      console.log("  ⚠ A lekérdezés lefutott, de a NAV szerint ez az adószám nem érvényes.\n");
    }
  } catch (error) {
    console.error(`  ✗ Sikertelen: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }

  console.log("Minden ellenőrzés sikeres. A NAV teszt fiók használatra kész.");
}

main().catch((error) => {
  console.error(`Váratlan hiba: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
