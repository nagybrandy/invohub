// lib/m2m/demo-user.ts
// Fetch a random NAV test taxpayer snapshot across Adózó API endpoints.
import { createM2mSession } from "@/lib/m2m/auth";
import {
  fetchM2mDetailedTaxpayer,
  fetchM2mMissingDeclarations,
  fetchM2mPublicDebt,
  fetchM2mTaxSummary,
  type AdozoSession,
  type M2mDetailedTaxpayer,
  type M2mMissingDeclaration,
  type M2mPublicDebt,
  type M2mTaxSummary,
} from "@/lib/m2m/adozo";
import { loadM2mCredentialsFromEnv } from "@/lib/m2m/credentials";
import { pickRandomM2mTestTaxpayer, type M2mTestTaxpayer } from "@/lib/m2m/test-fixtures";

export type M2mDemoCheck = {
  name: string;
  ok: boolean;
  resultCode?: string;
  message?: string | null;
};

export type M2mDemoSnapshot = {
  taxpayer: M2mTestTaxpayer;
  environment: "demo" | "test" | "production";
  checks: M2mDemoCheck[];
  taxSummary: M2mTaxSummary | null;
  missingDeclarations: M2mMissingDeclaration[];
  publicDebt: M2mPublicDebt | null;
  detailedTaxpayer: M2mDetailedTaxpayer | null;
  allEndpointsReachable: boolean;
};

export type M2mDemoOptions = {
  taxpayerId?: string;
  seed?: number;
};

async function runChecks(session: AdozoSession, taxpayerId: string) {
  const [taxSummary, missingDeclarations, publicDebt, detailedTaxpayer] = await Promise.all([
    fetchM2mTaxSummary(session, taxpayerId),
    fetchM2mMissingDeclarations(session, taxpayerId),
    fetchM2mPublicDebt(session, taxpayerId),
    fetchM2mDetailedTaxpayer(session, taxpayerId),
  ]);

  const checks: M2mDemoCheck[] = [
    {
      name: "Token + signing key",
      ok: true,
      resultCode: "OK",
      message: "Session created",
    },
    {
      name: "Összesített adószámla",
      ok: taxSummary.ok,
      resultCode: taxSummary.resultCode,
      message: taxSummary.resultMessage,
    },
    {
      name: "Hiányzó bevallás",
      ok: missingDeclarations.ok,
      resultCode: missingDeclarations.resultCode,
      message: missingDeclarations.resultMessage,
    },
    {
      name: "Köztartozás",
      ok: publicDebt.ok || publicDebt.resultCode === "NINCS_ADAT",
      resultCode: publicDebt.resultCode,
      message: publicDebt.resultMessage,
    },
    {
      name: "Tételes adószámla",
      ok: detailedTaxpayer.ok,
      resultCode: detailedTaxpayer.resultCode,
      message: detailedTaxpayer.resultMessage,
    },
  ];

  return {
    checks,
    taxSummary: taxSummary.data,
    missingDeclarations: missingDeclarations.data ?? [],
    publicDebt: publicDebt.data,
    detailedTaxpayer: detailedTaxpayer.data,
  };
}

export async function fetchM2mDemoSnapshot(options: M2mDemoOptions = {}): Promise<M2mDemoSnapshot> {
  const credentials = loadM2mCredentialsFromEnv();
  const taxpayer =
    options.taxpayerId != null
      ? {
          id: options.taxpayerId,
          label: `Custom test ID ${options.taxpayerId}`,
        }
      : pickRandomM2mTestTaxpayer(options.seed);

  const session = await createM2mSession(credentials);
  const adozoSession: AdozoSession = {
    credentials,
    accessToken: session.accessToken,
    signingKey: session.signingKey,
  };

  const result = await runChecks(adozoSession, taxpayer.id);

  return {
    taxpayer,
    environment: credentials.environment,
    ...result,
    allEndpointsReachable: result.checks.every((check) => check.ok),
  };
}
