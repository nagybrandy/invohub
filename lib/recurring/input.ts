// lib/recurring/input.ts
// Parses untrusted JSON bodies of the recurring-invoice API into typed
// service input. Pure — no DB.
import type { TemplatePatch } from "@/lib/recurring/service";
import type { RecurrenceSchedule } from "@/lib/recurring/schedule";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function optionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return typeof v === "string" ? v : undefined;
}

function optionalInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return typeof v === "number" ? v : Number.NaN;
}

/** Schedule fields (frequency/startDate/endDate/maxOccurrences); validation happens in the service. */
export function parseSchedule(raw: unknown): RecurrenceSchedule | null {
  if (!isObject(raw)) return null;
  return {
    frequency: raw.frequency as RecurrenceSchedule["frequency"],
    startDate: raw.startDate as string,
    endDate: optionalString(raw.endDate) ?? null,
    maxOccurrences: optionalInt(raw.maxOccurrences) ?? null,
  };
}

export type CreateInput = { sourceInvoiceId: string; name?: string; schedule: RecurrenceSchedule };

export function parseCreateBody(raw: unknown): CreateInput | null {
  if (!isObject(raw)) return null;
  if (typeof raw.sourceInvoiceId !== "string" || !raw.sourceInvoiceId.trim()) return null;
  const schedule = parseSchedule(raw);
  if (!schedule) return null;
  return {
    sourceInvoiceId: raw.sourceInvoiceId,
    name: typeof raw.name === "string" ? raw.name : undefined,
    schedule,
  };
}

export function parsePatchBody(raw: unknown): TemplatePatch | null {
  if (!isObject(raw)) return null;
  const patch: TemplatePatch = {};
  const name = optionalString(raw.name);
  if (name !== undefined) patch.name = name;
  const notes = optionalString(raw.notes);
  if (notes !== undefined) patch.notes = notes;
  if (raw.paymentTermDays !== undefined) patch.paymentTermDays = raw.paymentTermDays as number;
  if (raw.status !== undefined) {
    if (raw.status !== "active" && raw.status !== "paused") return null;
    patch.status = raw.status;
  }
  if (raw.schedule !== undefined) {
    const schedule = parseSchedule(raw.schedule);
    if (!schedule) return null;
    patch.schedule = schedule;
  }
  return patch;
}
