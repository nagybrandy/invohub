// app/api/auth/[...auth]+api.ts
// Expo Router API route that mounts the Better Auth handler for all /api/auth/* requests.
import { authOptionsResponse, withAuthCors } from "@/lib/auth-cors";
import { auth } from "@/lib/auth";

export function OPTIONS(request: Request) {
  return authOptionsResponse(request);
}

export function GET(request: Request) {
  return withAuthCors(request, auth.handler);
}

export function POST(request: Request) {
  return withAuthCors(request, auth.handler);
}
