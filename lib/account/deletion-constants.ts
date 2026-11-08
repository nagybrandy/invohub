// lib/account/deletion-constants.ts
// Shared by the server (request scheduling) and the UI copy. No imports, so
// client code never pulls in the database layer.

/** Cancellable waiting period between request and (future) closure. Product proposal, not a legal figure. */
export const DELETION_GRACE_DAYS = 30;
