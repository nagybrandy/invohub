// hooks/usePdfTemplate.ts
// PDF template settings hook with live sample preview.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import type { InvoicePdfTemplate, InvoicePdfTemplateInput } from "@/lib/invoices/pdf-template/types";

type TemplateResponse = { template: InvoicePdfTemplate };

export function usePdfTemplate() {
  const [template, setTemplate] = React.useState<InvoicePdfTemplate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TemplateResponse>("/api/pdf-template");
      setTemplate(data.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load PDF settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = React.useCallback(async (input: InvoicePdfTemplateInput) => {
    const data = await apiFetch<TemplateResponse>("/api/pdf-template", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setTemplate(data.template);
    return data.template;
  }, []);

  const previewSample = React.useCallback(async (draft: InvoicePdfTemplateInput) => {
    const base = getAuthBaseUrl();
    const response = await fetch(`${base}/api/pdf-template`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? response.statusText);
    }

    return response.blob();
  }, []);

  return { template, loading, error, refresh, save, previewSample };
}
