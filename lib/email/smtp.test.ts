// lib/email/smtp.test.ts
import { getSmtpConfig } from "@/lib/email/smtp";

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("getSmtpConfig — TLS mode follows the port", () => {
  it("uses implicit TLS on 465 (SMTPS), as a cPanel-style host like we006.tarhely.com requires", () => {
    process.env.SMTP_HOST = "we006.tarhely.com";
    process.env.SMTP_PORT = "465";
    expect(getSmtpConfig()).toMatchObject({ host: "we006.tarhely.com", port: 465, secure: true });
  });

  it("stays STARTTLS on 587 (the default)", () => {
    expect(getSmtpConfig()).toMatchObject({ port: 587, secure: false });
    process.env.SMTP_PORT = "587";
    expect(getSmtpConfig().secure).toBe(false);
  });

  it("lets SMTP_SECURE override either way", () => {
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "false";
    expect(getSmtpConfig().secure).toBe(false);
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_SECURE = "true";
    expect(getSmtpConfig().secure).toBe(true);
  });
});
