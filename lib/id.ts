// lib/id.ts
// Generates URL-safe unique IDs for domain entities.
export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
