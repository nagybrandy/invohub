// lib/workspaces/active-account.ts
// Which billing account the signed-in person is working in. The client sends
// its choice as a header (apiFetch) and a cookie (iframes, file downloads and
// plain links cannot set headers). It is only a SELECTOR: the server checks
// the person's access to it on every request, so a forged value grants nothing.
export const ACTIVE_ACCOUNT_HEADER = "x-invohub-account";
export const ACTIVE_ACCOUNT_COOKIE = "invohub_account";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * What a client sends when it is explicitly working in the person's OWN
 * account. Without it the server would fall back to the cookie — which another
 * browser tab may have pointed at a different account.
 */
export const SELF_ACCOUNT = "self";

export const isPlausibleAccountId = (value: unknown): value is string => typeof value === "string" && ID_PATTERN.test(value);

/**
 * The requested account id: from the header when it is present and valid,
 * otherwise from the cookie. "self" (header) means the person's own account and
 * is never overridden by the cookie. null = no usable selection.
 */
export function readActiveAccount(headers: Pick<Headers, "get">): string | null {
  const fromHeader = headers.get(ACTIVE_ACCOUNT_HEADER);
  if (fromHeader === SELF_ACCOUNT) return SELF_ACCOUNT;
  if (isPlausibleAccountId(fromHeader)) return fromHeader;
  const cookie = headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === ACTIVE_ACCOUNT_COOKIE) {
        let value: string;
        try {
          value = decodeURIComponent(rest.join("="));
        } catch {
          return null; // a malformed cookie must not break every request
        }
        if (isPlausibleAccountId(value)) return value;
      }
    }
  }
  return null;
}
