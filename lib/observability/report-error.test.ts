import { describeError, reportError } from "@/lib/observability/report-error";

describe("describeError", () => {
  it("uses class name and Postgres-style code, never the message", () => {
    const err = Object.assign(new Error("duplicate key value (a@b.hu)"), { code: "23505" });
    expect(describeError(err)).toEqual({ errorClass: "Error", code: "23505" });
  });
  it("handles non-errors", () => {
    expect(describeError("boom")).toEqual({ errorClass: "NonError", code: undefined });
  });
  it("ignores non-string/odd codes", () => {
    expect(describeError(Object.assign(new Error("x"), { code: { a: 1 } })).code).toBeUndefined();
  });
});

describe("reportError", () => {
  it("logs one structured line without the message", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    reportError("cron:reminders", Object.assign(new TypeError("secret@x.hu"), { code: "XX" }), { stage: "run" });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0][0]);
    expect(line).toContain('"source":"cron:reminders"');
    expect(line).toContain('"errorClass":"TypeError"');
    expect(line).toContain('"code":"XX"');
    expect(line).not.toContain("secret@x.hu");
    spy.mockRestore();
  });
});
