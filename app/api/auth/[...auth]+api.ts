// app/api/auth/[...auth]+api.ts
// Expo Router API route that mounts the Better Auth handler for all /api/auth/* requests.
import { auth } from "@/lib/auth";

export function GET(request: Request) {
  return auth.handler(request);
}

export function POST(request: Request) {
  return auth.handler(request);
}
