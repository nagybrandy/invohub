// lib/email/recipients.ts
// Normalizes and validates email recipient lists for invoice notifications.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailRecipientsInput = string | string[] | undefined;

export function normalizeEmailList(value: EmailRecipientsInput): string[] {
  if (value == null) return [];

  const entries = Array.isArray(value) ? value : value.split(/[,;]/);
  const normalized = entries.map((entry) => entry.trim()).filter(Boolean);

  return [...new Set(normalized)];
}

export function validateEmailList(emails: string[]): string | null {
  for (const email of emails) {
    if (!EMAIL_PATTERN.test(email)) {
      return `Invalid email address: ${email}`;
    }
  }
  return null;
}

export function validateEmailRecipientsInput(
  fieldName: string,
  value: EmailRecipientsInput
): string | null {
  const emails = normalizeEmailList(value);
  if (emails.length === 0) return null;
  const error = validateEmailList(emails);
  return error ? `${fieldName}: ${error}` : null;
}
