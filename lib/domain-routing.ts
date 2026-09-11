// lib/domain-routing.ts
// Keeps public marketing/legal and authenticated product URLs on their canonical hosts.
const LEGAL_PATHS = new Set([
  "/aszf",
  "/adatkezeles",
  "/cookie-tajekoztato",
  "/impresszum",
]);

const PRODUCT_PREFIXES = [
  "/admin",
  "/clients",
  "/dashboard",
  "/import",
  "/invoices",
  "/login",
  "/onboarding",
  "/products",
  "/receipts",
  "/settings",
];

export type DomainRedirectConfig = {
  marketingHost: string;
  appHost: string;
};

export function getDomainRedirect(
  hostHeader: string | undefined,
  requestUrl: string,
  config: DomainRedirectConfig,
): string | null {
  const host = hostHeader?.split(",")[0].trim().split(":")[0].toLowerCase();
  const pathname = requestUrl.split("?")[0] || "/";
  const suffix = requestUrl.includes("?")
    ? requestUrl.slice(requestUrl.indexOf("?"))
    : "";

  if (host === config.marketingHost && isProductPath(pathname)) {
    return `https://${config.appHost}${pathname}${suffix}`;
  }

  if (
    host === config.appHost &&
    (pathname === "/" || LEGAL_PATHS.has(pathname))
  ) {
    const targetPath = pathname === "/" ? "/login" : pathname;
    const targetHost =
      pathname === "/" ? config.appHost : config.marketingHost;
    return `https://${targetHost}${targetPath}${suffix}`;
  }

  return null;
}

function isProductPath(pathname: string): boolean {
  return PRODUCT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
