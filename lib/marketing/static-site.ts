// lib/marketing/static-site.ts
// Maps public marketing routes onto the exported static site shipped in dist/client/marketing.

/** Directory (relative to the exported client root) holding the static marketing site. */
export const MARKETING_STATIC_DIR = "marketing";

/** Routes served from hand-authored HTML instead of the Expo Router app. */
const HTML_ROUTES: Record<string, string> = {
  "/": "index.html",
};

function normalizePathname(url: string): string {
  const withoutQuery = url.split("?")[0].split("#")[0];

  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return "";
  }

  if (!decoded.startsWith("/")) {
    decoded = `/${decoded}`;
  }

  const collapsed = decoded.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return collapsed === "" ? "/" : collapsed;
}

/**
 * Returns the client-relative file for a marketing route, or null when the
 * request should fall through to the Expo Router application.
 */
export function resolveMarketingHtmlPath(url: string): string | null {
  const pathname = normalizePathname(url);
  const file = HTML_ROUTES[pathname];

  return file ? `${MARKETING_STATIC_DIR}/${file}` : null;
}

/** True when the request targets a static marketing asset such as CSS, JS, or SVG. */
export function isMarketingAssetPath(url: string): boolean {
  return normalizePathname(url).startsWith(`/${MARKETING_STATIC_DIR}/`);
}
