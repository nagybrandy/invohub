// lib/api/session.ts
// Resolves the authenticated user from an API request via Better Auth.
import { auth } from "@/lib/auth";

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }
  return session;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}
