// lib/auth-user-fields.ts
// Better Auth `user.additionalFields` config, kept in its own module (no `better-auth`
// import) so it can be unit tested without pulling in the ESM-only better-auth package.
export const authUserAdditionalFields = {
  // `input: false` is load-bearing: Better Auth then ignores any client-supplied
  // `role` on signup (always applies defaultValue instead) and hard-rejects any
  // attempt to set it via the self-service /update-user endpoint. Role changes only
  // happen server-side through lib/admin/service.ts, gated by an admin session.
  role: {
    type: "string",
    required: false,
    defaultValue: "entrepreneur",
    input: false,
  },
  // Non-authoritative: what the signup form's Vállalkozó/Könyvelő picker sent.
  // Safe to accept as client input (`input: true`) because it is NEVER read
  // as an authorization value directly — lib/auth.ts's databaseHooks clamps
  // it through resolveSignupRole() (entrepreneur/accountant only, never
  // "admin") before using it to set the real, still-input:false `role` field
  // at creation time. Self-service /update-user can also touch this field
  // freely; it doesn't matter, since it never controls `role` after signup.
  signupRole: {
    type: "string",
    required: false,
    defaultValue: "entrepreneur",
    input: true,
  },
} as const;
