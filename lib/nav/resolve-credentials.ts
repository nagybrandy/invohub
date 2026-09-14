// lib/nav/resolve-credentials.ts
// Resolves the real NAV Online Számla credentials to use for a company's
// current mode: the company's own technical user (test or production), or
// the shared InvoHub NAV test account (env vars, configured once by the
// owner) when the company hasn't entered its own. Demo mode never needs
// real credentials — callers should branch on mode before calling this.
import type { Company } from "@/lib/companies/service";
import { isNavProductionEnabled, type NavEnvironment } from "@/lib/nav/environment";

export type NavRealCredentials = {
  login: string;
  password: string;
  signKey: string;
  exchangeKey: string;
  /** 8-digit NAV tax number (no VAT/county suffix). */
  taxNumber: string;
  environment: "test" | "production";
  source: "own" | "shared";
};

export class NavCredentialsMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NavCredentialsMissingError";
  }
}

function normalizeTaxNumber(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : undefined;
}

export function hasOwnNavCredentials(company: Company | null | undefined): boolean {
  return !!(
    company?.navTechnicalUser &&
    company?.navTechnicalPassword &&
    company?.navXmlSignKey &&
    company?.navXmlChangeKey &&
    normalizeTaxNumber(company?.taxNumber)
  );
}

export function isSharedNavTestAccountConfigured(): boolean {
  return !!(
    process.env.NAV_TEST_LOGIN &&
    process.env.NAV_TEST_PASSWORD &&
    process.env.NAV_TEST_SIGN_KEY &&
    process.env.NAV_TEST_CHANGE_KEY &&
    normalizeTaxNumber(process.env.NAV_TEST_TAX_NUMBER)
  );
}

function sharedTestCredentials(): NavRealCredentials {
  const login = process.env.NAV_TEST_LOGIN;
  const password = process.env.NAV_TEST_PASSWORD;
  const signKey = process.env.NAV_TEST_SIGN_KEY;
  const exchangeKey = process.env.NAV_TEST_CHANGE_KEY;
  const taxNumber = normalizeTaxNumber(process.env.NAV_TEST_TAX_NUMBER);
  if (!login || !password || !signKey || !exchangeKey || !taxNumber) {
    throw new NavCredentialsMissingError(
      "A közös InvoHub NAV teszt fiók nincs beállítva a szerveren (NAV_TEST_* környezeti változók)."
    );
  }
  return { login, password, signKey, exchangeKey, taxNumber, environment: "test", source: "shared" };
}

function ownCredentials(company: Company, environment: "test" | "production"): NavRealCredentials {
  const login = company.navTechnicalUser;
  const password = company.navTechnicalPassword;
  const signKey = company.navXmlSignKey;
  const exchangeKey = company.navXmlChangeKey;
  const taxNumber = normalizeTaxNumber(company.taxNumber);
  if (!login || !password || !signKey || !exchangeKey || !taxNumber) {
    throw new NavCredentialsMissingError(
      "Hiányzó NAV technikai felhasználó adatok. Töltse ki a Beállítások > Cégadatok NAV szekcióban (technikai felhasználó, jelszó, aláíró kulcs, cserekulcs, adószám)."
    );
  }
  return { login, password, signKey, exchangeKey, taxNumber, environment, source: "own" };
}

/**
 * Resolves the real NAV credentials for `company`'s current mode
 * (company.navEnvironment). Throws NavCredentialsMissingError with a
 * Hungarian, user-facing message when nothing usable is configured. Never
 * call this for demo mode.
 */
export function resolveNavCredentials(company: Company | null): NavRealCredentials {
  const mode: NavEnvironment = company?.navEnvironment ?? "demo";

  if (mode === "demo") {
    throw new NavCredentialsMissingError("Demó módban nincs szükség valódi NAV hitelesítő adatokra.");
  }

  if (mode === "production") {
    if (!isNavProductionEnabled()) {
      throw new NavCredentialsMissingError("Az éles NAV környezet jelenleg nincs engedélyezve ezen a szerveren.");
    }
    if (!company || !hasOwnNavCredentials(company)) {
      throw new NavCredentialsMissingError(
        "Hiányzó NAV technikai felhasználó adatok az éles jelentéshez. Éles környezetben a közös teszt fiók nem használható."
      );
    }
    return ownCredentials(company, "production");
  }

  // test mode: prefer the company's own technical user, else the shared account.
  if (company && hasOwnNavCredentials(company)) {
    return ownCredentials(company, "test");
  }
  return sharedTestCredentials();
}
