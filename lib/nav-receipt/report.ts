// lib/nav-receipt/report.ts
import type {
  DailyReceiptReport,
  NavReceiptCredentials,
  NavReceiptEnvironment,
  NavReceiptSubmissionResult,
} from "./types";
import { authenticate } from "./auth";
import { getReceiptBaseUrl } from "./environment";
import { parseNavReceiptResponse } from "./response";
import { buildCreateReceiptXml } from "./xml-builder";

/**
 * Submits one `CreateReceiptRequest` (one currency-group day report) to NAV
 * eRECEIPT. Single attempt — no retry on a NAV-reported error (plan AC16).
 */
export async function submitReceiptDataReport(
  report: DailyReceiptReport,
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment
): Promise<NavReceiptSubmissionResult> {
  const { token } = await authenticate(credentials, env);
  const baseUrl = getReceiptBaseUrl(env);
  const xml = buildCreateReceiptXml(report);

  const res = await fetch(`${baseUrl}/receipt/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Authorization: `Bearer ${token}`,
    },
    body: xml,
  });

  const body = await res.text();
  const parsed = parseNavReceiptResponse(body, ["id"]);

  if (!parsed) {
    return { ok: false, error: `NAV eNyugta submission failed (HTTP ${res.status}): ${body.slice(0, 200)}` };
  }

  if (res.ok && parsed.id) {
    return { ok: true, reportId: parsed.id };
  }

  const resultCode = parsed.resultCode ?? String(res.status);
  const message = parsed.message ?? "Unknown NAV error.";
  return { ok: false, error: `${resultCode} ${message}`.trim() };
}
