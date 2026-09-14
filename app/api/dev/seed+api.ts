// app/api/dev/seed+api.ts
// Loads demo data for the authenticated user (development / demo only — see
// lib/dev/seed-guard.ts). Admin promotion has moved to scripts/promote-admin.mjs
// (owner-run CLI) and the admin panel (app/api/admin/users/[id]+api.ts); this route
// never grants roles.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { isDevSeedAllowed } from "@/lib/dev/seed-guard";
import { seedDemoData } from "@/lib/seed/demo-data";

export async function POST(request: Request) {
  // Behave as if the route doesn't exist when seeding isn't explicitly enabled —
  // don't leak its presence with a 403.
  if (!isDevSeedAllowed()) {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const result = await seedDemoData(session.user.id);
    return jsonResponse({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed.";
    return jsonResponse({ error: message }, 500);
  }
}
