// lib/api/safe-error.test.ts
import { logSafeError, safeErrorMessage } from "@/lib/api/safe-error";

describe("safeErrorMessage", () => {
  it("keeps an ordinary error message", () => {
    expect(safeErrorMessage(new Error("DB connection lost"), "fallback")).toBe("DB connection lost");
  });

  it("uses the fallback for non-Error values", () => {
    expect(safeErrorMessage("boom", "fallback")).toBe("fallback");
    expect(safeErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("never echoes a failed SQL query or its bound params (Drizzle includes both in the message)", () => {
    const err = new Error(
      'Failed query: update "company" set "nav_technical_password" = $1 where "company"."id" = $2\nparams: gcm2:k1:aaa:bbb:ccc,c1'
    );
    const msg = safeErrorMessage(err, "Failed to save company profile.");
    expect(msg).toBe("Failed to save company profile.");
  });

  it("strips a trailing params: section and any sealed-secret token", () => {
    const msg = safeErrorMessage(new Error("oops gcm2:k1:AAA=:BBB=:CCC= happened\nparams: secret-pw"), "fb");
    expect(msg).not.toContain("secret-pw");
    expect(msg).not.toContain("AAA=");
    expect(msg).toContain("oops");
  });
});

describe("logSafeError", () => {
  it("logs only name + sanitized message, never the raw error object (cause/params)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("Failed query: insert ...\nparams: plain-password"), {
      cause: { params: ["plain-password"] },
    });
    logSafeError("[POST /api/companies]", err);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("plain-password");
    expect(logged).toContain("[POST /api/companies]");
    spy.mockRestore();
  });
});
