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
} as const;
