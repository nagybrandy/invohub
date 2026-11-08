// The closure PLAN is a pure description of what would happen. It must cover
// every table, never touch a DB, and not be wired to anything executable.
import fs from "fs";
import path from "path";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { ACCOUNT_DATA_CLASSIFICATION, planAccountClosure } from "@/lib/account/deletion-plan";

const ROOT = path.resolve(__dirname, "../..");
const allTables = Object.values(schema)
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => getTableConfig(t).name);

describe("ACCOUNT_DATA_CLASSIFICATION", () => {
  it("has a decision for every table in db/schema.ts (add one when you add a table)", () => {
    expect(Object.keys(ACCOUNT_DATA_CLASSIFICATION).sort()).toEqual([...new Set(allTables)].sort());
  });
  it("marks every retention / deletability judgement as LEGAL: confirm", () => {
    for (const t of ["invoice", "nav_submission", "receipt", "incoming_invoice", "document_sequence", "client"]) {
      expect(ACCOUNT_DATA_CLASSIFICATION[t].legalConfirm).toBe(true);
    }
  });
  it("never classifies the user row or issued-document tables as delete", () => {
    expect(ACCOUNT_DATA_CLASSIFICATION.user.action).toBe("anonymise");
    for (const t of ["invoice", "invoice_line_item", "nav_submission", "receipt", "receipt_line_item", "nav_receipt_submission", "company", "document_sequence"]) {
      expect(ACCOUNT_DATA_CLASSIFICATION[t].action).not.toBe("delete");
    }
  });
});

describe("planAccountClosure", () => {
  const plan = planAccountClosure({
    closedAt: new Date("2026-12-10T00:00:00Z"),
    invoices: [
      { id: "i1", status: "draft", issueDate: "2026-01-02", clientId: "c1" },
      { id: "i2", status: "issued", issueDate: "2029-05-01", clientId: "c2" },
      { id: "i3", status: "storno", issueDate: "2027-05-01", clientId: null },
    ],
    clientIds: ["c1", "c2", "c3"],
    counts: { session: 2, account: 1, api_key: 3, product: 4 },
  });
  const row = (t: string) => plan.tables.find((x) => x.table === t)!;

  it("splits invoices into retained (non-draft) and deleted (draft)", () => {
    expect(row("invoice")).toMatchObject({ retain: 2, delete: 1 });
  });
  it("keeps only clients referenced by retained invoices; the rest are deleted", () => {
    expect(row("client")).toMatchObject({ retain: 1, delete: 2, anonymise: 1 });
    expect(plan.retainedClientIds).toEqual(["c2"]);
  });
  it("counts deletable tables and anonymises the user", () => {
    expect(row("session")).toMatchObject({ delete: 2, action: "delete" });
    expect(row("api_key")).toMatchObject({ delete: 3 });
    expect(row("user")).toMatchObject({ anonymise: 1, retain: 0, delete: 0 });
  });
  it("computes the retention end from the latest retained invoice (8y default)", () => {
    expect(plan.retentionUntil.toISOString()).toBe("2037-12-31T23:59:59.999Z");
  });
  it("is flagged as a plan, not an execution", () => {
    expect(plan.executed).toBe(false);
    expect(plan.legalConfirm).toBe(true);
  });
  it("is pure: same input, same output; input not mutated", () => {
    const input = { closedAt: new Date("2026-12-10"), invoices: [], clientIds: [], counts: {} };
    const snapshot = JSON.stringify(input);
    expect(planAccountClosure(input)).toEqual(planAccountClosure(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("nothing irreversible is reachable from the self-serve path", () => {
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
  /** Source without comments, so prose may mention the closure. */
  const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const SELF_SERVE = [
    "lib/account/deletion-plan.ts",
    "lib/account/deletion-request.ts",
    "lib/account/deletion-flag.ts",
    "app/api/account/deletion+api.ts",
  ];
  it("self-serve files never import the executable closure, @/db writes beyond the request table, or auth deleteUser", () => {
    for (const f of SELF_SERVE) {
      const src = code(f);
      expect(src).not.toMatch(/account\/closure/);
      expect(src).not.toMatch(/closeAccount|buildClosureStatements/);
      expect(src).not.toMatch(/\.delete\(/);
      expect(src).not.toMatch(/deleteUser|removeUser/);
    }
    expect(code("lib/account/deletion-plan.ts")).not.toMatch(/from "@\/db"/);
  });
  it("the plan is not imported by any route, cron or job", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        if (e.name === "node_modules") continue;
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && rel !== "lib/account/deletion-plan.ts") {
          if (/account\/deletion-plan/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))) offenders.push(rel);
        }
      }
    };
    ["app", "lib", "hooks", "components", "scripts"].forEach(walk);
    expect(offenders).toEqual([]);
  });
  it("no cron / vercel.json entry mentions account deletion", () => {
    expect(read("vercel.json")).not.toMatch(/deletion|closure|account/i);
  });
  it("Better Auth deleteUser stays disabled", () => {
    expect(read("lib/auth.ts")).toMatch(/deleteUser:\s*\{\s*enabled:\s*false/);
  });
});
