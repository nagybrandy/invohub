// lib/auth-password-rules.test.ts
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth-password-rules";

describe("validateNewPassword", () => {
  it("refuses a short password before anything is sent", () => {
    expect(validateNewPassword("1234567", "1234567")).toBe("tooShort");
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
  it("refuses a mismatch", () => {
    expect(validateNewPassword("12345678", "12345679")).toBe("mismatch");
  });
  it("accepts a matching pair of 8+", () => {
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
  });
});
