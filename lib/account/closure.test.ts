// lib/account/closure.test.ts
// Closure must never delete the user row or an issued invoice. The SQL is
// asserted on the real drizzle query builder (drizzle.mock(), no Postgres).
const mockBatch = jest.fn();
const mockSelect = jest.fn();

// `db` is a real drizzle.mock() query builder (produces real SQL, never
// connects) with select/batch spied so closeAccount's reads can be stubbed.
jest.mock("@/db", () => {
  const { drizzle } = jest.requireActual("drizzle-orm/neon-http");
  const { schema } = jest.requireActual("@/db/schema");
  const real = drizzle.mock({ schema });
  const realSelect = real.select.bind(real);
  return {
    realSelect,
    db: Object.assign(real, {
      select: (...args: unknown[]) => mockSelect(...args),
      batch: (...args: unknown[]) => mockBatch(...args),
    }),
  };
});

import { db } from "@/db";
import { buildClosureStatements, closeAccount } from "@/lib/account/closure";

const mockDb = db;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { realSelect } = require("@/db") as { realSelect: (...a: unknown[]) => unknown };

beforeEach(() => {
  mockSelect.mockReset().mockImplementation(realSelect);
  mockBatch.mockReset().mockResolvedValue([]);
});

type Sqlish = { toSQL: () => { sql: string; params: unknown[] } };

function sqlOf(statements: ReadonlyArray<unknown>) {
  return (statements as Sqlish[]).map((s) => s.toSQL());
}

const NOW = new Date("2026-09-22T10:00:00Z");
const RETENTION = new Date("2034-12-31T23:59:59.999Z");

function build() {
  return sqlOf(
    buildClosureStatements(mockDb as never, {
      userId: "u1",
      previousEmail: "ev@example.hu",
      now: NOW,
      retentionUntil: RETENTION,
    })
  );
}

describe("buildClosureStatements", () => {
  it("never deletes the user row", () => {
    for (const { sql } of build()) {
      expect(sql).not.toMatch(/^delete from "user"/i);
    }
  });

  it("only deletes DRAFT invoices — issued invoices are retained", () => {
    const invoiceDeletes = build().filter(({ sql }) => /^delete from "invoice"/i.test(sql));
    expect(invoiceDeletes).toHaveLength(1);
    expect(invoiceDeletes[0].sql).toMatch(/"invoice"\."status" = \$\d/);
    expect(invoiceDeletes[0].params).toEqual(["u1", "draft"]);
  });

  it("never deletes line items, NAV submissions, company, receipts, incoming invoices or sequences", () => {
    const retained = [
      "invoice_line_item",
      "nav_submission",
      "company",
      "receipt",
      "receipt_line_item",
      "nav_receipt_submission",
      "incoming_invoice",
      "document_sequence",
    ];
    for (const { sql } of build()) {
      for (const table of retained) {
        expect(sql).not.toMatch(new RegExp(`^delete from "${table}"`, "i"));
      }
    }
  });

  it("deletes what is not legally required", () => {
    const deleted = build()
      .map(({ sql }) => /^delete from "([a-z_]+)"/i.exec(sql)?.[1])
      .filter(Boolean);
    expect(deleted).toEqual(
      expect.arrayContaining([
        "payment_reminder_schedule",
        "api_key",
        "session",
        "account",
        "verification",
        "idempotency_key",
        "email_template",
        "notification",
        "product",
        "client",
      ])
    );
  });

  it("deletes drafts before pruning clients, and keeps clients referenced by retained invoices", () => {
    const statements = build();
    const draftIdx = statements.findIndex(({ sql }) => /^delete from "invoice"/i.test(sql));
    const clientIdx = statements.findIndex(({ sql }) => /^delete from "client"/i.test(sql));
    expect(draftIdx).toBeLessThan(clientIdx);
    expect(statements[clientIdx].sql).toMatch(/not in \(select "client_id" from "invoice"/i);
  });

  it("wipes NAV credentials but keeps seller data on the company", () => {
    const companyUpdate = build().find(({ sql }) => /^update "company"/i.test(sql));
    expect(companyUpdate).toBeDefined();
    const sql = companyUpdate!.sql;
    for (const col of ["nav_technical_user", "nav_technical_password", "nav_xml_sign_key", "nav_xml_change_key"]) {
      expect(sql).toContain(`"${col}" = $`);
    }
    for (const col of ["name", "tax_number", "address", "bank_account"]) {
      expect(sql).not.toContain(`"${col}" = $`);
    }
    expect(companyUpdate!.params.slice(0, 6)).toEqual([null, null, null, null, null, null]);
  });

  it("anonymizes and marks the user row closed", () => {
    const userUpdate = build().find(({ sql }) => /^update "user"/i.test(sql));
    expect(userUpdate).toBeDefined();
    expect(userUpdate!.params).toEqual(
      expect.arrayContaining(["closed-u1@invalid", "Closed account", NOW.toISOString(), RETENTION.toISOString(), "u1"])
    );
    expect(userUpdate!.sql).toContain('"closed_at" = $');
    expect(userUpdate!.sql).toContain('"retention_until" = $');
  });
});

function selectReturning(rows: unknown[]) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn(() => chain);
  chain.where = jest.fn(() => Object.assign(Promise.resolve(rows), chain));
  chain.limit = jest.fn(() => Promise.resolve(rows));
  return chain;
}

describe("closeAccount", () => {
  it("returns not_found for an unknown user and runs nothing", async () => {
    mockSelect.mockReturnValueOnce(selectReturning([]));
    await expect(closeAccount("nope", NOW)).resolves.toEqual({ status: "not_found" });
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("is idempotent for an already-closed account", async () => {
    const closedAt = new Date("2026-01-01T00:00:00Z");
    mockSelect.mockReturnValueOnce(
      selectReturning([{ id: "u1", email: "closed-u1@invalid", closedAt, retentionUntil: RETENTION }])
    );
    await expect(closeAccount("u1", NOW)).resolves.toEqual({
      status: "already_closed",
      closedAt,
      retentionUntil: RETENTION,
    });
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("runs every closure statement in one batch and derives retentionUntil from the latest issued document", async () => {
    mockSelect
      .mockReturnValueOnce(
        selectReturning([{ id: "u1", email: "ev@example.hu", closedAt: null, retentionUntil: null }])
      )
      .mockReturnValueOnce(selectReturning([{ value: "2027-01-03" }]))
      .mockReturnValueOnce(selectReturning([{ value: new Date("2026-05-01T00:00:00Z") }]));

    const result = await closeAccount("u1", NOW);

    expect(result).toEqual({
      status: "closed",
      closedAt: NOW,
      retentionUntil: new Date("2035-12-31T23:59:59.999Z"),
    });
    expect(mockBatch).toHaveBeenCalledTimes(1);
    const statements = sqlOf(mockBatch.mock.calls[0][0]);
    expect(statements.some(({ sql }) => /^delete from "user"/i.test(sql))).toBe(false);
    expect(statements.some(({ sql }) => /^update "user"/i.test(sql))).toBe(true);
  });
});
