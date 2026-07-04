// lib/auth-cors.ts
// Adds CORS headers for cross-origin Better Auth requests (trustedOrigins alone is not enough).
import { getAuthTrustedOrigins } from "@/lib/auth-trusted-origins";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With";

function isOriginAllowed(origin: string | null): origin is string {
  if (!origin || origin === "null") return false;
  return getAuthTrustedOrigins().some((trusted) => {
    if (trusted.endsWith("://")) {
      return origin.startsWith(trusted);
    }
    return origin === trusted;
  });
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    Vary: "Origin",
  };

  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function authOptionsResponse(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function withAuthCors(
  request: Request,
  handler: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);
  const response = await handler(request);

  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    next.headers.set(key, value);
  }
  return next;
}
