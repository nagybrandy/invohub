// app/api/nav/config+api.ts
// Server-side NAV configuration flags the UI needs before rendering the
// environment picker: is the shared test account set up, is production
// enabled, is secret encryption configured.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { isNavCredentialsEncryptionConfigured } from "@/lib/nav/credentials";
import { isNavProductionEnabled } from "@/lib/nav/environment";
import { isSharedNavTestAccountConfigured } from "@/lib/nav/resolve-credentials";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  return jsonResponse({
    sharedTestAvailable: isSharedNavTestAccountConfigured(),
    productionEnabled: isNavProductionEnabled(),
    encryptionConfigured: isNavCredentialsEncryptionConfigured(),
  });
}
