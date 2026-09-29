// lib/account/no-hard-delete.test.ts
// Regression guard: no code path may hard-delete the `user` row, because
// every FK from `user` cascades into issued invoices that must be retained
// for 8 years (docs/decisions/2026-09-22-invoice-retention-on-account-deletion.md).
// lib/auth.ts can't be imported under Jest (ESM-only better-auth), so its
// guard wiring is asserted on the source text.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["app", "lib", "hooks", "components", "scripts", "db"];
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;

function listSources(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(rel));
    else if (EXTENSIONS.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const HARD_DELETE_PATTERNS: RegExp[] = [
  /\.delete\(\s*user\s*\)/, // drizzle: db.delete(user)
  /\.delete\(\s*schema\.user\s*\)/,
  /delete\s+from\s+"?user"?\b/i, // raw SQL
  /internalAdapter\.deleteUser\s*\(/,
  /auth\.api\.(deleteUser|removeUser)\s*\(/,
];

describe("user row hard-delete guard", () => {
  it("no source file hard-deletes the user row", () => {
    const offenders: string[] = [];
    for (const file of SCAN_DIRS.flatMap(listSources)) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const pattern of HARD_DELETE_PATTERNS) {
        if (pattern.test(text)) offenders.push(`${file} (${pattern})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Better Auth deleteUser is disabled and guarded, and closed accounts can't get sessions", () => {
    const authSource = fs.readFileSync(path.join(ROOT, "lib/auth.ts"), "utf8");
    expect(authSource).toMatch(/deleteUser:\s*\{\s*enabled:\s*false,\s*beforeDelete:\s*blockUserHardDelete/);
    expect(authSource).toMatch(/delete:\s*\{\s*before:\s*blockUserHardDelete/);
    expect(authSource).toMatch(/before:\s*makeClosedAccountSessionGuard\(isAccountClosed\)/);
  });
});
