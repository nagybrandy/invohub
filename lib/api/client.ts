// lib/api/client.ts
// Authenticated fetch wrapper for Expo web + native (cookies / credentials).
import { getAuthBaseUrl } from "@/lib/auth-url";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const base = getAuthBaseUrl();
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new ApiError(body.error ?? response.statusText, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Fetch binary response (e.g. invoice PDF) with session cookies. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const base = getAuthBaseUrl();
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? response.statusText, response.status);
  }

  return response.blob();
}

export function invoicePdfUrl(invoiceId: string): string {
  return `${getAuthBaseUrl()}/api/invoices/${invoiceId}/pdf`;
}
