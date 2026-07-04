// lib/email/smtp.ts
// Nodemailer SMTP transporter configured from environment variables.
import nodemailer from "nodemailer";

export function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
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
