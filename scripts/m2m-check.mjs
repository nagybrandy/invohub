#!/usr/bin/env node
// scripts/m2m-check.mjs
// Owner tool: verifies the NAV M2M (Adózó) TEST credentials in .env by
// running a real token + nonce exchange against m2m-dev.nav.gov.hu.
// Never prints secret values. Run with: npm run m2m:check
import { register } from "node:module";
import { config } from "dotenv";

config({ path: ".env" });
register("./lib/alias-loader.mjs", import.meta.url);

async function main() {
  console.log("NAV M2M (Adózó) TEST kapcsolat ellenőrzése…\n");

  const { isM2mConfigured, loadM2mCredentialsFromEnv, M2mConfigError } = await import(
    "@/lib/m2m/credentials"
  );

  if (!isM2mConfigured()) {
    console.error(
      "✗ Hiányoznak az M2M_* környezeti változók (.env). Lásd .env.example — " +
        "M2M_CLIENT_ID, M2M_CLIENT_SECRET, M2M_USERNAME, M2M_PASSWORD, M2M_SIGNATURE_KEY_FIRST, M2M_NONCE."
    );
    process.exit(1);
  }

  const { createM2mSession } = await import("@/lib/m2m/auth");
  const { fetchM2mTaxSummary } = await import("@/lib/m2m/adozo");
  const { pickRandomM2mTestTaxpayer } = await import("@/lib/m2m/test-fixtures");

  let credentials;
  try {
    credentials = loadM2mCredentialsFromEnv();
  } catch (error) {
    console.error(`✗ ${error instanceof M2mConfigError ? error.message : error}`);
    process.exit(1);
  }

  console.log("1/2 Token + aláíró kulcs (nonce redeem)…");
  let session;
  try {
    session = await createM2mSession(credentials);
    console.log(`  ✓ Sikeres — accessToken hossza: ${session.accessToken.length} karakter.\n`);
  } catch (error) {
    console.error(`  ✗ Sikertelen: ${error instanceof Error ? error.message : error}\n`);
    console.error(
      "Ellenőrizd: client id/secret, felhasználónév/jelszó, aláíró kulcs első fele és a nonce\n" +
        "helyes-e, és hogy a regisztráció aktív-e a m2m-dev.nav.gov.hu felületen."
    );
    process.exit(1);
  }

  const taxpayer = pickRandomM2mTestTaxpayer();
  console.log(`2/2 Összesített adószámla lekérdezés (teszt azonosító: ${taxpayer.id})…`);
  try {
    const result = await fetchM2mTaxSummary(
      { credentials, accessToken: session.accessToken, signingKey: session.signingKey },
      taxpayer.id
    );
    if (result.ok) {
      console.log(`  ✓ Sikeres — eredménykód: ${result.resultCode}.\n`);
    } else {
      console.log(
        `  ⚠ A lekérdezés lefutott, de nem sikeres eredménnyel tért vissza: ${result.resultCode ?? "?"} ${
          result.resultMessage ?? ""
        }\n`
      );
    }
  } catch (error) {
    console.error(`  ✗ Sikertelen: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }

  console.log("Minden ellenőrzés sikeres. A NAV M2M teszt fiók használatra kész.");
}

main().catch((error) => {
  console.error(`Váratlan hiba: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
