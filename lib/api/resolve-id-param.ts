// lib/api/resolve-id-param.ts
// Resolves :id from Expo Router params with a request URL fallback (Vercel/serverless).
type IdParams = { id?: string } | undefined;

const API_ID_PATTERNS = [
  /\/api\/v1\/(?:invoices|clients|products)\/([^/]+)/,
  /\/api\/admin\/users\/([^/]+)/,
  /\/api\/(?:invoices|clients|products|receipts|notifications|api-keys|email-templates)\/([^/]+)/,
] as const;

function idFromRequestPath(pathname: string): string {
  for (const pattern of API_ID_PATTERNS) {
    const match = pathname.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return "";
}

export async function resolveIdParam(
  request: Request,
  params?: Promise<IdParams> | IdParams
): Promise<string> {
  const resolved =
    params == null ? undefined : params instanceof Promise ? await params : params;

  const fromRouter = resolved?.id?.trim();
  if (fromRouter) {
    return fromRouter;
  }

  return idFromRequestPath(new URL(request.url).pathname);
}
