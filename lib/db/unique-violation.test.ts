// lib/db/unique-violation.test.ts
import { isUniqueViolation } from "@/lib/db/unique-violation";

describe("isUniqueViolation", () => {
  it("returns true for a Postgres 23505 error", () => {
    const error = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("returns true when the 23505 code is on error.cause", () => {
    const error = new Error("insert failed");
    (error as unknown as { cause: unknown }).cause = { code: "23505" };
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("returns true when the given index name appears in the message, even without a code", () => {
    const error = new Error(
      'duplicate key value violates unique constraint "invoice_converted_from_live_unique_idx"'
    );
    expect(isUniqueViolation(error, "invoice_converted_from_live_unique_idx")).toBe(true);
  });

  it("returns false when an index name is given but neither the code nor the message match", () => {
    const error = new Error('unique constraint "invoice_user_number_unique_idx"');
    expect(isUniqueViolation(error, "invoice_converted_from_live_unique_idx")).toBe(false);
  });

  it("returns false for a plain Error with an unrelated message", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });

  it("returns false for a non-23505 Postgres error code", () => {
    expect(isUniqueViolation({ code: "23503", message: "foreign key violation" })).toBe(false);
  });

  it("returns false for undefined, null, and non-object values", () => {
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("boom")).toBe(false);
    expect(isUniqueViolation(42)).toBe(false);
  });
});
