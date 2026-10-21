// lib/workspaces/active-account.ts
// Which billing account the signed-in person is working in. The client sends
// its choice as a header (apiFetch) and a cookie (iframes, file downloads and
// plain links cannot set headers). It is only a SELECTOR: the server checks
// the person's access to it on every request, so a forged value grants nothing.
export const ACTIVE_ACCOUNT_HEADER = "x-invohub-account";
export const ACTIVE_ACCOUNT_COOKIE = "invohub_account";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export const isPlausibleAccountId = (value: unknown): value is string => typeof value === "string" && ID_PATTERN.test(value);

/** The requested account id from the header, else the cookie; null when absent or malformed. */
export function readActiveAccount(headers: Pick<Headers, "get">): string | null {
  const fromHeader = headers.get(ACTIVE_ACCOUNT_HEADER);
  if (isPlausibleAccountId(fromHeader)) return fromHeader;
  const cookie = headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === ACTIVE_ACCOUNT_COOKIE) {
        const value = decodeURIComponent(rest.join("="));
        if (isPlausibleAccountId(value)) return value;
      }
    }
  }
  return null;
}
