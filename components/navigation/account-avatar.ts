// components/navigation/account-avatar.ts
// Initials and the deterministic avatar colour for billing accounts (SPEC
// §5.5): the active account is --primary; every other account gets one of four
// token-safe fills, chosen by a stable hash of its id so a company keeps its
// colour across sessions and devices.
export const AVATAR_FILLS = ["bg-ok", "bg-warn", "bg-navy", "bg-primary-press"] as const;

/** Up to two initials: "Kovács Anna e.v." -> "KA". */
export function accountInitials(name: string | undefined | null): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));
  if (words.length === 0) return "IH";
  const picked = words.length === 1 ? [words[0]] : [words[0], words[1]];
  return picked
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("hu-HU");
}

/** Small, stable string hash (FNV-1a, 32 bit). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function accountAvatarFill(id: string, active: boolean): string {
  if (active) return "bg-primary";
  return AVATAR_FILLS[hashString(id) % AVATAR_FILLS.length];
}
