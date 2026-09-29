// hooks/useInvoicePdfPreview.ts
// The ONE invoice preview: the real generated PDF (owner feedback
// 2026-09-22 — no separate HTML rendering that can drift from what the
// customer receives). Two sources:
//   - saved:  GET  /api/invoices/:id/pdf
//   - draft:  POST /api/invoices/preview/pdf with the composer's unsaved
//             payload (rendered as an unnumbered "Piszkozat").
// Web renders into a blob: object URL. A draft re-renders debounced after
// edits (the very first render is immediate), stale requests are aborted,
// and the previous URL is kept alive until the next one is committed, so
// the embed can keep showing the last good render while refreshing (no
// flicker). Native can't embed a PDF: pass enabled=false there and use
// fetchBlob() on demand to hand the file to the OS viewer.
import * as React from "react";
import { getAuthBaseUrl } from "@/lib/auth-url";
import type { Invoice } from "@/lib/invoices/types";

export type InvoicePdfSource =
  | { kind: "saved"; invoiceId: string; version?: string }
  | { kind: "draft"; invoice: Invoice };

export const DRAFT_PREVIEW_DEBOUNCE_MS = 700;
/** A render that takes longer than this fails with a retryable error instead of spinning forever (INV-11). */
export const PDF_PREVIEW_TIMEOUT_MS = 20_000;

/** Stable identity of what a preview shows — timestamps excluded, so an unchanged draft never re-renders. */
export function invoicePdfSourceKey(source: InvoicePdfSource): string {
  if (source.kind === "saved") return `saved:${source.invoiceId}:${source.version ?? ""}`;
  const { createdAt: _c, updatedAt: _u, id: _id, ...rest } = source.invoice;
  return `draft:${JSON.stringify(rest)}`;
}

export async function fetchInvoicePdf(source: InvoicePdfSource, signal?: AbortSignal): Promise<Blob> {
  const base = getAuthBaseUrl();
  const response =
    source.kind === "saved"
      ? await fetch(`${base}/api/invoices/${encodeURIComponent(source.invoiceId)}/pdf`, {
          credentials: "include",
          signal,
        })
      : await fetch(`${base}/api/invoices/preview/pdf`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice: source.invoice }),
          signal,
        });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? response.statusText);
  }
  return response.blob();
}

export type InvoicePdfPreviewState = {
  /** Object URL of the latest successful render — kept while a refresh is in flight. */
  url: string | null;
  /** A render is scheduled or in flight. */
  loading: boolean;
  /** The last render failed (the previous `url`, if any, is still valid). */
  error: string | null;
  retry: () => void;
  /** Fetch the current source's PDF on demand (native "open PDF"). */
  fetchBlob: () => Promise<Blob>;
};

export function useInvoicePdfPreview(
  source: InvoicePdfSource,
  { enabled = true, debounceMs = DRAFT_PREVIEW_DEBOUNCE_MS }: { enabled?: boolean; debounceMs?: number } = {}
): InvoicePdfPreviewState {
  const key = invoicePdfSourceKey(source);
  const sourceRef = React.useRef(source);
  sourceRef.current = source;

  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<string | null>(null);
  const [retryToken, setRetryToken] = React.useState(0);
  // [previous, current] — the previous URL stays valid until a newer one
  // replaces it, so a double-buffered embed can finish swapping.
  const liveUrls = React.useRef<string[]>([]);
  const hasRendered = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const delay = hasRendered.current && sourceRef.current.kind === "draft" ? debounceMs : 0;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        setError("PDF preview timed out");
        setLoading(false);
      }, PDF_PREVIEW_TIMEOUT_MS);
      fetchInvoicePdf(sourceRef.current, controller.signal)
        .then((blob) => {
          clearTimeout(timeout);
          if (controller.signal.aborted) return;
          const next = URL.createObjectURL(blob);
          liveUrls.current.push(next);
          while (liveUrls.current.length > 2) {
            URL.revokeObjectURL(liveUrls.current.shift()!);
          }
          hasRendered.current = true;
          setUrl(next);
          setError(null);
          setLoading(false);
        })
        .catch((e: unknown) => {
          clearTimeout(timeout);
          if (controller.signal.aborted || timedOut) return;
          setError(e instanceof Error && e.message ? e.message : "PDF preview failed");
          setLoading(false);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, enabled, debounceMs, retryToken]);

  React.useEffect(
    () => () => {
      for (const live of liveUrls.current) URL.revokeObjectURL(live);
      liveUrls.current = [];
    },
    []
  );

  const retry = React.useCallback(() => setRetryToken((n) => n + 1), []);
  const fetchBlob = React.useCallback(() => fetchInvoicePdf(sourceRef.current), []);

  return { url, loading, error, retry, fetchBlob };
}
