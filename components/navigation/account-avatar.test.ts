// components/navigation/account-avatar.test.ts
import { accountAvatarFill, accountInitials, AVATAR_FILLS, hashString } from "@/components/navigation/account-avatar";

describe("accountInitials", () => {
  it("takes the first letters of the first two words", () => {
    expect(accountInitials("Kovács Anna e.v.")).toBe("KA");
    expect(accountInitials("Nagyon hosszú cégnév Kft.")).toBe("NH");
    expect(accountInitials("Teszt Elek")).toBe("TE");
  });

  it("handles one word, accents and a leading lowercase letter", () => {
    expect(accountInitials("Ügyfél")).toBe("Ü");
    expect(accountInitials("öt tesó")).toBe("ÖT");
  });

  it("skips non-letter words and falls back to IH", () => {
    expect(accountInitials("42 Kft")).toBe("K");
    expect(accountInitials("")).toBe("IH");
    expect(accountInitials(undefined)).toBe("IH");
  });
});

describe("accountAvatarFill", () => {
  it("the active account is always primary", () => {
    expect(accountAvatarFill("ws-1", true)).toBe("bg-primary");
    expect(accountAvatarFill("anything", true)).toBe("bg-primary");
  });

  it("other accounts get a stable fill from the fixed list, keyed by id", () => {
    const first = accountAvatarFill("ws-aaaaaa", false);
    expect(AVATAR_FILLS).toContain(first as (typeof AVATAR_FILLS)[number]);
    for (let i = 0; i < 5; i += 1) expect(accountAvatarFill("ws-aaaaaa", false)).toBe(first);
  });

  it("uses all four hues across many ids and only token classes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(accountAvatarFill(`ws-${i}`, false));
    expect(seen.size).toBe(4);
    for (const fill of AVATAR_FILLS) expect(fill).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("hashes deterministically", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });
});
