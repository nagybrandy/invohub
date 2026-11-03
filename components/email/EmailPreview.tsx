// components/email/EmailPreview.tsx
// Native preview: the rendered mail as text (no HTML view without a WebView
// dependency). Web renders the real HTML — EmailPreview.web.tsx.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { htmlToText, SAMPLE_VARIABLES } from "@/lib/email/templates/editor";
import { renderTemplate } from "@/lib/email/templates/render";

export type EmailPreviewProps = { subject: string; bodyHtml: string; testID?: string };

export function EmailPreview({ subject, bodyHtml, testID = "email-preview" }: EmailPreviewProps) {
  return (
    <Box className="rounded-control border border-line bg-surface p-4" testID={testID}>
      <Text className="mb-2 text-sm font-bold text-ink">{renderTemplate(subject, SAMPLE_VARIABLES)}</Text>
      <Text className="text-sm text-ink">{htmlToText(renderTemplate(bodyHtml, SAMPLE_VARIABLES))}</Text>
    </Box>
  );
}
