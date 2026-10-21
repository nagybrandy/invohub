// app/api/workspaces+api.ts
// The billing accounts the signed-in PERSON can work in (their own plus any
// workspace they own or were invited to), and creating a new workspace.
// Uses requireActor: managing accounts is about the person, not the account
// currently selected.
import { jsonResponse, requireActor, unauthorizedResponse } from "@/lib/api/session";
import { readActiveAccount } from "@/lib/workspaces/active-account";
import { WorkspaceLimitError, createWorkspace, listAccounts } from "@/lib/workspaces/service";

export async function GET(request: Request) {
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const accounts = await listAccounts({ id: session.user.id, name: session.user.name });
  const requested = readActiveAccount(request.headers);
  // The selection is honoured only if the person really has access to it.
  const active = accounts.find((a) => a.id === requested) ?? accounts[0];
  return jsonResponse({ accounts, activeId: active.id });
}

export async function POST(request: Request) {
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return jsonResponse({ error: "A name of 2–120 characters is required.", code: "invalidName" }, 400);
  }
  try {
    const workspace = await createWorkspace(session.user.id, name);
    return jsonResponse({ workspace }, 201);
  } catch (error) {
    if (error instanceof WorkspaceLimitError) {
      return jsonResponse({ error: "Too many billing accounts.", code: "workspaceLimit" }, 409);
    }
    throw error;
  }
}
