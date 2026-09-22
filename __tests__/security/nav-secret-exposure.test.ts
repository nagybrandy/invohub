// __tests__/security/nav-secret-exposure.test.ts
// Static regression guard for NAV technical-user secrets: which modules may
// touch the secret columns at all, and which may decrypt them. A new
// reference outside these allowlists must be reviewed (and added here
// deliberately) — see docs/audits/2026-09-22-nav-credential-security.md.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SECRET_FIELDS = /\b(navTechnicalPassword|navXmlSignKey|navXmlChangeKey|nav_technical_password|nav_xml_sign_key|nav_xml_change_key)\b/;
const DECRYPT_CALL = /\b(decryptNavSecret|decryptNavSecretOrPassthrough|openCompanyNavSecrets)\s*\(/;

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const sourceFiles = ["app", "lib", "hooks", "components"].flatMap(walk);
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("NAV secret exposure guard", () => {
  it("admin, v1 external API and API-key code never reference the NAV secret columns", () => {
    const sensitiveSurfaces = sourceFiles.filter((f) =>
      /^(app\/api\/admin|app\/\(app\)\/admin|lib\/admin|app\/api\/v1|lib\/api-keys|app\/api\/api-keys)/.test(f)
    );
    expect(sensitiveSurfaces.length).toBeGreaterThan(0);
    const offenders = sensitiveSurfaces.filter((f) => SECRET_FIELDS.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("only allowlisted server modules decrypt NAV secrets (right before a NAV request)", () => {
    const allowed = new Set([
      "lib/nav/credentials.ts",
      "lib/nav/resolve-credentials.ts",
      "lib/nav/reencrypt.ts",
      "lib/nav/incoming-sync.ts",
      "lib/nav-receipt/credentials.ts",
      "lib/nav-receipt/daily-report-run.ts",
      "app/api/receipts/[id]/submit-nav+api.ts",
    ]);
    const offenders = sourceFiles.filter((f) => DECRYPT_CALL.test(read(f)) && !allowed.has(f));
    expect(offenders).toEqual([]);
  });

  it("the Company read model does not decrypt secrets", () => {
    expect(read("lib/companies/service.ts")).not.toMatch(DECRYPT_CALL);
  });

  it("company API routes only ever serialize the redacted PublicCompany", () => {
    const src = read("app/api/companies+api.ts");
    expect(src).toMatch(/toPublicCompany\(company\)/);
    expect(src).not.toMatch(/jsonResponse\(\{\s*company\s*\}/);
  });

  it("client code (screens, hooks, components) never decrypts", () => {
    const clientFiles = sourceFiles.filter((f) => !f.startsWith("app/api/") && !f.startsWith("lib/"));
    const offenders = clientFiles.filter((f) => /from "@\/lib\/nav\/credentials"/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
