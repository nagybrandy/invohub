// lib/i18n/used-keys.test.ts
// Every statically written translation key in the app must exist in BOTH
// locales. A key that is missing renders as its raw dotted path on screen
// ("invoices.lineItemEditor.unitPriceMode") and no other test notices — a
// regex-inserted key once landed in the wrong block and shipped that way.
import fs from "node:fs";
import path from "node:path";
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";

const ROOT = path.resolve(__dirname, "../..");
const DIRS = ["app", "components", "hooks", "lib"];
const SKIP = /(\.test\.|\.spec\.|__tests__|node_modules|\/locales\/|\.d\.ts$|\/e2e\/)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP.test(full)) out.push(full);
  }
  return out;
}

function resolve(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), dict);
}

// t("a.b.c") / i18n.t("a.b.c") / t('a.b.c', …) — static string literal only.
const T_CALL = /\bt\(\s*["']([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)["']/g;

/** Keys that are intentionally resolved some other way (plural suffixes etc.). */
const ALLOW = new Set<string>([]);

describe("translation keys used in the code exist in hu and en", () => {
  const used = new Map<string, string>();
  for (const dir of DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(T_CALL)) {
        if (!used.has(m[1])) used.set(m[1], path.relative(ROOT, file));
      }
    }
  }

  it("found a sensible number of keys (guards the scanner itself)", () => {
    expect(used.size).toBeGreaterThan(200);
  });

  it.each(["hu", "en"] as const)("%s has every statically used key", (lang) => {
    const dict = lang === "hu" ? hu : en;
    const missing = [...used.entries()]
      .filter(([key]) => !ALLOW.has(key))
      .filter(([key]) => {
        const v = resolve(dict, key);
        // a plural base ("x" with x_one/x_other) or a nested object is not a leaf string
        if (typeof v === "string") return false;
        const plural = resolve(dict, `${key}_other`) ?? resolve(dict, `${key}_one`);
        return plural === undefined;
      })
      .map(([key, file]) => `${key}  (${file})`);
    expect(missing).toEqual([]);
  });
});
