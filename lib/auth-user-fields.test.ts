// lib/auth-user-fields.test.ts
// Guards the `role` additional-field config wired into Better Auth (lib/auth.ts):
// it must never be settable by the client, at signup or via self-service profile
// update. Role changes are admin-only (lib/admin/service.ts).
import { authUserAdditionalFields } from "@/lib/auth-user-fields";

describe("authUserAdditionalFields.role", () => {
  it("is not client-settable (input: false)", () => {
    // With input:false, Better Auth ignores any `role` sent in a signup payload
    // (e.g. { role: "admin" }) — it always applies defaultValue on create — and
    // throws BAD_REQUEST if a caller tries to set it via /update-user instead.
    expect(authUserAdditionalFields.role.input).toBe(false);
  });

  it("defaults new users to the unprivileged entrepreneur role", () => {
    expect(authUserAdditionalFields.role.defaultValue).toBe("entrepreneur");
  });
});
