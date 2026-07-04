// app/api/dev/seed+api.ts
// Loads demo data for the authenticated user (development / demo).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { promoteUserToAdmin } from "@/lib/admin/service";
import { seedDemoData } from "@/lib/seed/demo-data";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  let promoteAdmin = false;
  try {
    const body = (await request.json()) as { promoteAdmin?: boolean };
    promoteAdmin = body.promoteAdmin === true;
  } catch {
    // empty body is fine for demo seed
  }

  try {
    if (promoteAdmin) {
      await promoteUserToAdmin(session.user.id);
      return jsonResponse({ ok: true, promoted: true, role: "admin" });
    }

    const result = await seedDemoData(session.user.id);
    return jsonResponse({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed.";
    return jsonResponse({ error: message }, 500);
  }
}
