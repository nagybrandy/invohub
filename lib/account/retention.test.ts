// lib/account/retention.test.ts
import {
  accountRetentionUntil,
  closedAccountEmail,
  INVOICE_RETENTION_YEARS,
  retentionEndForIssueDate,
} from "@/lib/account/retention";

describe("invoice retention rules", () => {
  it("retains for 8 years", () => {
    expect(INVOICE_RETENTION_YEARS).toBe(8);
  });

  it("counts 8 years from the END of the calendar year of issue", () => {
    expect(retentionEndForIssueDate("2026-01-02").toISOString()).toBe("2034-12-31T23:59:59.999Z");
    expect(retentionEndForIssueDate("2026-12-31").toISOString()).toBe("2034-12-31T23:59:59.999Z");
    expect(retentionEndForIssueDate(new Date("2020-06-15T10:00:00Z")).toISOString()).toBe(
      "2028-12-31T23:59:59.999Z"
    );
  });

  it("rejects unparseable issue dates", () => {
    expect(() => retentionEndForIssueDate("n/a")).toThrow();
  });

  it("uses the closure year as a floor for the account retention end", () => {
    const closedAt = new Date("2026-09-22T12:00:00Z");
    expect(accountRetentionUntil(["2019-03-01", null, undefined], closedAt).toISOString()).toBe(
      "2034-12-31T23:59:59.999Z"
    );
    expect(accountRetentionUntil([], closedAt).toISOString()).toBe("2034-12-31T23:59:59.999Z");
  });

  it("extends past the closure year when a retained document is dated later", () => {
    const closedAt = new Date("2026-09-22T12:00:00Z");
    expect(
      accountRetentionUntil(["2026-01-01", new Date("2027-01-05T00:00:00Z")], closedAt).toISOString()
    ).toBe("2035-12-31T23:59:59.999Z");
  });

  it("anonymizes the login e-mail to a reserved .invalid address", () => {
    expect(closedAccountEmail("u_123")).toBe("closed-u_123@invalid");
  });
});
