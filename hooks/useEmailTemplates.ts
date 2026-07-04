// hooks/useEmailTemplates.ts
// Email template list and update hook.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { EmailTemplateRecord } from "@/lib/email/templates/service";

type TemplatesResponse = { templates: EmailTemplateRecord[] };

export function useEmailTemplates() {
  const [templates, setTemplates] = React.useState<EmailTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TemplatesResponse>("/api/email-templates");
      setTemplates(data.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = React.useCallback(
    async (
      id: string,
      input: { subject?: string; bodyHtml?: string; bodyText?: string }
    ) => {
      await apiFetch(`/api/email-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  return { templates, loading, error, refresh, update };
}
