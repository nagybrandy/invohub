// components/email/EmailPreview.web.tsx
// The mail as the recipient sees it: subject line, then the HTML body in a
// sandboxed frame (no scripts, no navigation) with the sample data filled in.
// The frame is a mail document, white in both themes.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { buildPreviewDocument, SAMPLE_VARIABLES } from "@/lib/email/templates/editor";
import { renderTemplate } from "@/lib/email/templates/render";
import type { EmailPreviewProps } from "@/components/email/EmailPreview";

export type { EmailPreviewProps };

export function EmailPreview({ subject, bodyHtml, testID = "email-preview" }: EmailPreviewProps) {
  const { t } = useTranslation();
  return (
    <Box className="overflow-hidden rounded-control border border-line bg-surface" testID={testID}>
      <Box className="border-b border-line bg-wash2 px-4 py-3">
        <Text className="text-xs text-muted-ink">{t("emailEditor.subject")}</Text>
        <Text className="text-sm font-bold text-ink" testID="email-preview-subject">
          {renderTemplate(subject, SAMPLE_VARIABLES)}
        </Text>
      </Box>
      <iframe
        title={t("emailEditor.preview")}
        sandbox=""
        srcDoc={buildPreviewDocument(bodyHtml)}
        data-testid="email-preview-frame"
        className="block h-[380px] w-full border-0 bg-white"
      />
    </Box>
  );
}
