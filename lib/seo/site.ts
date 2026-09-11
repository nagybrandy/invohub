// lib/seo/site.ts
// Absolute marketing-site URL helpers for canonical, OG, sitemap, and JSON-LD.

const DEFAULT_MARKETING_ORIGIN = "https://invohub.hu";

export function getMarketingOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv =
    env.NEXT_PUBLIC_SITE_URL ??
    env.EXPO_PUBLIC_SITE_URL ??
    env.SITE_URL ??
    (env.MARKETING_HOST ? `https://${env.MARKETING_HOST}` : undefined);

  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/+$/, "");
  }

  return DEFAULT_MARKETING_ORIGIN;
}

export function absoluteUrl(
  pathname: string,
  origin = getMarketingOrigin(),
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin.replace(/\/+$/, "")}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
}

export const SITE_NAME = "InvoHub";
export const SITE_LOCALE = "hu_HU";
export const DEFAULT_OG_IMAGE_PATH = "/assets/brand/invohub-logo-lockup.png";
