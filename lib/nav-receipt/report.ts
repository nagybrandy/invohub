// lib/nav-receipt/report.ts
import { randomUUID } from "crypto";

import type {
  DailyReceiptReport,
  NavReceiptCredentials,
  NavReceiptEnvironment,
  NavReceiptSubmissionResult,
  SoftwareRegistrationResult,
} from "./types";
import { authenticate } from "./auth";
import { getReceiptBaseUrl } from "./environment";
import { buildReceiptDataReportXml, buildSoftwareRegistrationXml } from "./xml-builder";

async function postXml(
  url: string,
  xml: string,
  token: string
): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Authorization: `Bearer ${token}`,
      "X-Request-Id": randomUUID(),
    },
    body: xml,
  });
  const body = await res.text();
  return { status: res.status, body };
}

function extractXmlValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match?.[1];
}

export async function submitDailyReceiptReport(
  report: DailyReceiptReport,
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment
): Promise<NavReceiptSubmissionResult> {
  const { token } = await authenticate(credentials, env);
  const baseUrl = getReceiptBaseUrl(env);
  const xml = buildReceiptDataReportXml(report);

  const { status, body } = await postXml(`${baseUrl}/createReceiptDataReport`, xml, token);

  if (status >= 200 && status < 300) {
    const transactionId = extractXmlValue(body, "transactionId");
    return { ok: true, transactionId };
  }

  const errorMsg = extractXmlValue(body, "message") ?? extractXmlValue(body, "resultMessage") ?? body.slice(0, 200);
  return { ok: false, error: `HTTP ${status}: ${errorMsg}` };
}

export async function registerReceiptSoftware(
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment,
  softwareName = "InvoHub"
): Promise<SoftwareRegistrationResult> {
  const { token } = await authenticate(credentials, env);
  const baseUrl = getReceiptBaseUrl(env);
  const xml = buildSoftwareRegistrationXml(credentials, softwareName);

  const { status, body } = await postXml(`${baseUrl}/registerSoftware`, xml, token);

  if (status >= 200 && status < 300) {
    const softwareId = extractXmlValue(body, "softwareId");
    return { ok: true, softwareId };
  }

  const errorMsg = extractXmlValue(body, "message") ?? extractXmlValue(body, "resultMessage") ?? body.slice(0, 200);
  return { ok: false, error: `HTTP ${status}: ${errorMsg}` };
}

export async function queryReceiptReport(
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment,
  dateFrom: string,
  dateTo: string
): Promise<{ ok: boolean; body: string }> {
  const { token } = await authenticate(credentials, env);
  const baseUrl = getReceiptBaseUrl(env);

  const res = await fetch(
    `${baseUrl}/queryReceiptDataReport?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Request-Id": randomUUID(),
      },
    }
  );

  const body = await res.text();
  return { ok: res.ok, body };
}
