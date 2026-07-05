// lib/dates/format.ts
// Shared date/time formatting for invoices, receipts, and documents.
const DOCUMENT_LOCALE = "hu-HU";

function parseDatePart(value: string): Date | null {
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeSource(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(value: string): string {
  const parsed = parseDatePart(value);
  if (!parsed) return value;

  return parsed.toLocaleDateString(DOCUMENT_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateWithTime(dateValue: string, timeSource?: string): string {
  const dateFormatted = formatDateOnly(dateValue);
  const timeFrom = parseTimeSource(timeSource ?? dateValue);
  if (!timeFrom) return dateFormatted;

  const timeFormatted = timeFrom.toLocaleTimeString(DOCUMENT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateFormatted} ${timeFormatted}`;
}

export function formatInvoiceIssueDateTime(invoice: {
  issueDate: string;
  createdAt: string;
}): string {
  return formatDateWithTime(invoice.issueDate, invoice.createdAt);
}

export function formatInvoiceDueDate(invoice: { dueDate: string }): string {
  return formatDateOnly(invoice.dueDate);
}
