// components/email/EmailPreview.web.tsx
// The mail as the recipient sees it: subject line, then the HTML body in a
// sandboxed frame (no scripts, no navigation) with the sample data filled in.
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { buildPreviewDocument, SAMPLE_VARIABLES } from "@/lib/email/templates/editor";
import { renderTemplate } from "@/lib/email/templates/render";
import type { EmailPreviewProps } from "@/components/email/EmailPreview";

export type { EmailPreviewProps };

export function EmailPreview({ subject, bodyHtml, testID = "email-preview" }: EmailPreviewProps) {
  return (
    <Box className="overflow-hidden rounded-lg border border-subtle bg-surface" testID={testID}>
      <Box className="border-b border-subtle px-4 py-3">
        <Text size="xs" className="text-muted-foreground">Tárgy</Text>
        <Text className="font-semibold text-foreground" testID="email-preview-subject">
          {renderTemplate(subject, SAMPLE_VARIABLES)}
        </Text>
      </Box>
      <iframe
        title="email-preview"
        sandbox=""
        srcDoc={buildPreviewDocument(bodyHtml)}
        data-testid="email-preview-frame"
        style={{ width: "100%", height: 420, border: 0, background: "#fff" }}
      />
    </Box>
  );
}
