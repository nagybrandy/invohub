// lib/email/smtp.test.ts
import { createTransporter, getFromAddress, getSmtpConfig } from "@/lib/email/smtp";

describe("smtp config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it("reads SMTP settings from environment", () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "465";
    expect(getSmtpConfig()).toMatchObject({
      host: "smtp.test.com",
      port: 465,
    });
  });

  it("returns null transporter without credentials", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(createTransporter()).toBeNull();
  });

  it("prefers SMTP_FROM for from address", () => {
    process.env.SMTP_FROM = "billing@test.com";
    process.env.SMTP_USER = "user@test.com";
    expect(getFromAddress()).toBe("billing@test.com");
  });
});
