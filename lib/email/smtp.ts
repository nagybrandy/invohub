// lib/email/smtp.ts
// Nodemailer SMTP transporter configured from environment variables.
import nodemailer from "nodemailer";

export function getSmtpConfig() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  // 465 is SMTPS (implicit TLS); 587/25 start plain and upgrade with STARTTLS.
  // SMTP_SECURE=true/false overrides when a host is unusual.
  const secure =
    process.env.SMTP_SECURE === "true" ? true : process.env.SMTP_SECURE === "false" ? false : port === 465;
  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
}

export function createTransporter() {
  const config = getSmtpConfig();
  if (!config.auth.user || !config.auth.pass) {
    return null;
  }
  return nodemailer.createTransport(config);
}

export function getFromAddress(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@invohub.app";
}
